"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

// tmdb.js is a classic browser script: it reads CONFIG, GENRE_MAP and the
// collection.js helpers as globals, exactly like in index.html.
const { GENRE_MAP } = require("../js/config");
Object.assign(globalThis, require("../js/collection"), {
  GENRE_MAP,
  CONFIG: {
    TMDB_API_KEY: "test-key",
    TMDB_BASE_URL: "https://api.themoviedb.org/3",
    TMDB_IMAGE_BASE: "https://image.tmdb.org/t/p/w500",
    AVAILABILITY_SOURCE: "tmdb",
  },
});
const tmdb = require("../js/tmdb");

function mockFetch(handler) {
  const calls = [];
  const previousFetch = global.fetch;
  global.fetch = async (url) => {
    calls.push(String(url));
    const body = await handler(new URL(String(url)));
    if (body instanceof Error) throw body;
    return {
      ok: body !== null,
      status: body === null ? 500 : 200,
      async json() {
        return body;
      },
    };
  };
  return {
    calls,
    restore() {
      global.fetch = previousFetch;
    },
  };
}

// --- URL builder -------------------------------------------------------------

test("TMDB URLs carry the key, French by default and skip empty params", () => {
  const url = new URL(
    tmdb.buildTmdbUrl("/search/movie", {
      query: "Le Comte de Monte-Cristo & co",
      page: 1,
      year: "",
      region: undefined,
      with_genres: null,
    }),
  );
  assert.equal(url.origin + url.pathname, "https://api.themoviedb.org/3/search/movie");
  assert.equal(url.searchParams.get("api_key"), "test-key");
  assert.equal(url.searchParams.get("language"), "fr-FR");
  assert.equal(url.searchParams.get("query"), "Le Comte de Monte-Cristo & co");
  assert.equal(url.searchParams.get("page"), "1");
  assert.deepEqual(
    [...url.searchParams.keys()].sort(),
    ["api_key", "language", "page", "query"],
  );
});

test("TMDB URLs can omit or override the language", () => {
  const withoutLanguage = new URL(tmdb.buildTmdbUrl("movie/1/watch/providers", { language: null }));
  assert.equal(withoutLanguage.searchParams.has("language"), false);
  const english = new URL(tmdb.buildTmdbUrl("movie/1", { language: "en-US" }));
  assert.equal(english.searchParams.get("language"), "en-US");
});

test("TMDB URLs keep list separators readable by TMDB", () => {
  const url = new URL(
    tmdb.buildTmdbUrl("discover/movie", {
      with_release_type: "2|3",
      append_to_response: "credits,videos",
    }),
  );
  assert.equal(url.searchParams.get("with_release_type"), "2|3");
  assert.equal(url.searchParams.get("append_to_response"), "credits,videos");
});

// --- Providers ---------------------------------------------------------------

test("provider names are normalized to stable priority keys", () => {
  assert.equal(tmdb.getProviderPriorityKey("Amazon Prime Video"), "prime-video");
  assert.equal(tmdb.getProviderPriorityKey("HBO Max"), "max");
  assert.equal(tmdb.getProviderPriorityKey("Netflix basic with Ads"), "netflix");
  assert.equal(tmdb.getProviderPriorityKey("Disney Plus"), "disney+");
  assert.equal(tmdb.getProviderPriorityKey("France.tv"), "france-tv");
  assert.equal(tmdb.getProviderPriorityKey("Rakuten TV"), "rakuten-tv");
  assert.equal(tmdb.getCompactProviderLabel("Apple TV Plus"), "Apple TV+");
});

test("TMDB watch providers are grouped, ordered and sorted by platform priority", () => {
  const normalized = tmdb.normalizeWatchProviders({
    results: {
      FR: {
        link: "https://www.themoviedb.org/movie/1/watch",
        rent: [{ provider_name: "Apple TV", logo_path: "/apple.png" }],
        flatrate: [
          { provider_name: "Rakuten TV", logo_path: "/r.png" },
          { provider_name: "Disney Plus", logo_path: "/d.png" },
          { provider_name: "Netflix", logo_path: "/n.png" },
        ],
      },
      US: { flatrate: [{ provider_name: "Hulu" }] },
    },
  });
  assert.equal(normalized.region, "FR");
  assert.equal(normalized.sourceLabel, "TMDB");
  assert.deepEqual(normalized.groups.map((group) => group.key), ["flatrate", "rent"]);
  assert.deepEqual(
    normalized.groups[0].providers.map((provider) => provider.provider_name),
    ["Netflix", "Disney Plus", "Rakuten TV"],
  );
  assert.equal(tmdb.normalizeWatchProviders({ results: { US: {} } }), null);
});

test("primary provider prefers included streaming over rental", () => {
  const providers = tmdb.normalizeWatchProviders({
    results: {
      FR: {
        buy: [{ provider_name: "Apple TV", logo_path: "/apple.png" }],
        flatrate: [{ provider_name: "Canal+", logo_path: "/canal.png" }],
      },
    },
  });
  assert.deepEqual(tmdb.getPrimaryWatchProvider(providers, { includedOnly: true }), {
    providerName: "Canal+",
    providerLogo: "https://image.tmdb.org/t/p/w92/canal.png",
    providerAccessType: "flatrate",
  });

  const rentalOnly = tmdb.normalizeWatchProviders({
    results: { FR: { rent: [{ provider_name: "Apple TV", logo_path: "/a.png" }] } },
  });
  assert.equal(tmdb.getPrimaryWatchProvider(rentalOnly, { includedOnly: true }), null);
  assert.equal(tmdb.getPrimaryWatchProvider(rentalOnly).providerAccessType, "rent");
});

test("external availability payloads are converted to the TMDB shape", () => {
  const normalized = tmdb.normalizeFreshWatchProviders({
    link: "https://example.test/show",
    streamingOptions: {
      fr: [
        { type: "subscription", service: { id: "netflix", name: "Netflix", imageSet: { lightThemeImage: "https://img/n.svg" } } },
        // Same service listed twice (e.g. one option per audio language).
        { type: "subscription", service: { id: "netflix", name: "Netflix", imageSet: { lightThemeImage: "https://img/n.svg" } } },
        { type: "rent", service: { id: "apple", name: "Apple TV" } },
        { type: "addon", service: { id: "x", name: "Ignored" } },
      ],
    },
  });
  assert.equal(normalized.sourceLabel, "Source externe");
  assert.deepEqual(normalized.groups.map((group) => group.key), ["flatrate", "rent"]);
  assert.equal(normalized.groups[0].providers.length, 1);
  assert.equal(normalized.groups[0].providers[0].logo_path, "https://img/n.svg");
  assert.equal(tmdb.normalizeFreshWatchProviders({ streamingOptions: { fr: [] } }), null);
});

test("watch providers are fetched without a language parameter", async () => {
  const fetchMock = mockFetch(() => ({
    results: { FR: { flatrate: [{ provider_name: "Netflix", logo_path: "/n.png" }] } },
  }));
  try {
    const providers = await tmdb.fetchWatchProviders("tv", 1399);
    const url = new URL(fetchMock.calls[0]);
    assert.equal(url.pathname, "/3/tv/1399/watch/providers");
    assert.equal(url.searchParams.has("language"), false);
    assert.equal(providers.groups[0].providers[0].provider_name, "Netflix");
  } finally {
    fetchMock.restore();
  }
});

// --- Items built from TMDB -----------------------------------------------------

test("TMDB results become collection items", () => {
  const movie = tmdb.buildCollectionItemFromTrending(
    {
      id: 949,
      title: "Heat",
      release_date: "1995-12-15",
      genre_ids: [28, 80, 18, 53],
      vote_average: 7.9,
      poster_path: "/heat.jpg",
    },
    "movie",
    { providerName: "Netflix", providerLogo: "https://logo", providerAccessType: "flatrate" },
    "watched",
  );
  assert.equal(movie.type, "movie");
  assert.equal(movie.year, "1995");
  assert.equal(movie.genre, "Action, Crime, Drame");
  assert.equal(movie.tmdbRating, 4);
  assert.equal(movie.posterUrl, "https://image.tmdb.org/t/p/w500/heat.jpg");
  assert.equal(movie.providerName, "Netflix");
  assert.equal(movie.status, "watched");
  assert.ok(movie.watchedAt);
  assert.equal(movie.currentSeason, null);

  const series = tmdb.buildCollectionItemFromTrending(
    { id: 1399, name: "Game of Thrones", first_air_date: "2011-04-17", genres: [{ name: "Drame" }] },
    "tv",
    null,
  );
  assert.equal(series.type, "series");
  assert.equal(series.title, "Game of Thrones");
  assert.equal(series.genre, "Drame");
  assert.equal(series.currentSeason, 1);
  assert.equal(series.posterUrl, null);
});

test("French posters are preferred over other languages", () => {
  assert.equal(
    tmdb.getPreferredTmdbPosterPath({
      poster_path: "/default.jpg",
      images: {
        posters: [
          { iso_639_1: "en", file_path: "/en.jpg" },
          { iso_639_1: "fr", file_path: "/fr.jpg" },
        ],
      },
    }),
    "/fr.jpg",
  );
  assert.equal(tmdb.getPreferredTmdbPosterPath({ poster_path: "/default.jpg" }), "/default.jpg");
});

test("hydration keeps the user's data and adds TMDB metadata", async () => {
  const fetchMock = mockFetch((url) => {
    if (url.pathname.endsWith("/watch/providers")) {
      return { results: { FR: { flatrate: [{ provider_name: "Netflix", logo_path: "/n.png" }] } } };
    }
    return {
      id: 949,
      title: "Heat",
      release_date: "1995-12-15",
      genres: [{ name: "Action" }],
      poster_path: "/heat.jpg",
      images: { posters: [{ iso_639_1: "fr", file_path: "/heat-fr.jpg" }] },
    };
  });
  try {
    const hydrated = await tmdb.hydrateMovieItemFromTmdb(
      {
        id: "letterboxd-heat",
        type: "movie",
        title: "Heat",
        status: "watched",
        rating: 4.5,
        notes: "Culte",
        tags: ["Letterboxd"],
        watchedAt: "2024-06-01T12:00:00.000Z",
      },
      949,
    );
    assert.equal(hydrated.id, "letterboxd-heat");
    assert.equal(hydrated.tmdbId, 949);
    assert.equal(hydrated.rating, 4.5);
    assert.equal(hydrated.notes, "Culte");
    assert.equal(hydrated.status, "watched");
    assert.equal(hydrated.watchedAt, "2024-06-01T12:00:00.000Z");
    assert.equal(hydrated.posterUrl, "https://image.tmdb.org/t/p/w500/heat-fr.jpg");
    assert.equal(hydrated.providerName, "Netflix");
    assert.deepEqual(hydrated.tags, ["Letterboxd"]);
  } finally {
    fetchMock.restore();
  }
});

// --- Title matching --------------------------------------------------------------

test("title search returns the best TMDB match", async () => {
  const fetchMock = mockFetch(() => ({
    results: [
      { id: 2, title: "Heatwave", release_date: "1995-01-01" },
      { id: 949, title: "Heat", release_date: "1995-12-15", poster_path: "/p.jpg" },
    ],
  }));
  try {
    const { match, complete } = await tmdb.searchTmdbMovieMatch("Heat", "1995");
    assert.equal(match.id, 949);
    assert.equal(complete, true);
    assert.equal(new URL(fetchMock.calls[0]).searchParams.get("primary_release_year"), "1995");
  } finally {
    fetchMock.restore();
  }
});

test("title search without a year does not send the same request twice", async () => {
  const fetchMock = mockFetch(() => ({ results: [] }));
  try {
    await tmdb.searchTmdbMovieMatch("Film introuvable", "");
    assert.equal(fetchMock.calls.length, new Set(fetchMock.calls).size);
    assert.equal(fetchMock.calls.length, 2);
  } finally {
    fetchMock.restore();
  }
});

test("a failed request is reported as incomplete, not as no match", async () => {
  const fetchMock = mockFetch(() => null);
  try {
    const result = await tmdb.searchTmdbMovieMatch("Heat", "1995");
    assert.deepEqual(result, { match: null, complete: false });
  } finally {
    fetchMock.restore();
  }
});

test("missed titles are not searched again and concurrent searches are shared", async () => {
  const fetchMock = mockFetch(() => ({ results: [] }));
  try {
    const [first, second] = await Promise.all([
      tmdb.findTmdbMovieMatch("Titre vraiment introuvable", "2001"),
      tmdb.findTmdbMovieMatch("Titre vraiment introuvable", "2001"),
    ]);
    assert.equal(first, null);
    assert.equal(second, null);
    const callsAfterFirstSearch = fetchMock.calls.length;
    assert.ok(callsAfterFirstSearch > 0);

    assert.equal(await tmdb.findTmdbMovieMatch("Titre vraiment introuvable", "2001"), null);
    assert.equal(fetchMock.calls.length, callsAfterFirstSearch);
  } finally {
    fetchMock.restore();
  }
});

test("network errors are retried on the next search", async () => {
  let failing = true;
  const fetchMock = mockFetch(() => (failing ? new Error("offline") : { results: [] }));
  try {
    assert.equal(await tmdb.findTmdbMovieMatch("Titre hors ligne", "2010"), null);
    const callsWhileOffline = fetchMock.calls.length;
    failing = false;
    await tmdb.findTmdbMovieMatch("Titre hors ligne", "2010");
    assert.ok(fetchMock.calls.length > callsWhileOffline);
  } finally {
    fetchMock.restore();
  }
});

test("genre ids map to French labels, three at most", () => {
  assert.equal(tmdb.getGenreNames([28, 35, 18, 27], "movie"), "Action, Comédie, Drame");
  assert.equal(tmdb.getGenreNames([10765], "tv"), "Science-Fiction & Fantasy");
  assert.equal(tmdb.getCollectionTypeFromTmdbType("tv"), "series");
  assert.equal(tmdb.getCollectionTypeFromTmdbType("movie"), "movie");
});
