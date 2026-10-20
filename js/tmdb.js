/**
 * TMDB catalog and streaming availability layer: API URLs, movie details,
 * title matching, watch providers, collection item hydration.
 *
 * No DOM and no app state (no `items`, no rendering): callers in app.js
 * decide what to save and render. Loaded as a classic script after
 * config.js and collection.js, whose globals it uses (CONFIG, GENRE_MAP,
 * title matching helpers). In Node, set those as globals before requiring
 * this file (see test/tmdb.test.js).
 */

// Utilisation des constantes depuis config.js
const TMDB_API_KEY = CONFIG.TMDB_API_KEY;
const TMDB_BASE_URL = CONFIG.TMDB_BASE_URL;
const TMDB_IMAGE_BASE = CONFIG.TMDB_IMAGE_BASE;
const AVAILABILITY_SOURCE = String(CONFIG.AVAILABILITY_SOURCE || "tmdb").toLowerCase();
const FRESH_AVAILABILITY_URL_TEMPLATE =
  CONFIG.FRESH_AVAILABILITY_URL_TEMPLATE || "";
const BACKEND_ACCESS_TOKEN = String(CONFIG.BACKEND_ACCESS_TOKEN || "").trim();

function getBackendAuthHeaders() {
  return BACKEND_ACCESS_TOKEN ? { "X-CineTracker-Token": BACKEND_ACCESS_TOKEN } : {};
}

const TMDB_WATCH_REGION = "FR";
const TMDB_IMAGE_LANGUAGE_PREFERENCE = "fr,null,en";
const TMDB_MOVIE_LOCALIZATION_VERSION = 1;
const WATCH_PROVIDER_GROUP_ORDER = ["flatrate", "free", "ads", "rent", "buy"];
const WATCH_PROVIDER_INCLUDED_GROUPS = new Set(["flatrate", "free", "ads"]);
const WATCH_PROVIDER_PRIORITY_VERSION = 2;

// Single place that knows the TMDB base URL, API key and default language.
// Pass `language: null` to omit the language; empty/undefined params are skipped.
function buildTmdbUrl(path, params = {}) {
  const { language = "fr-FR", ...query } = params;
  const url = new URL(`${TMDB_BASE_URL}/${String(path).replace(/^\/+/, "")}`);
  url.searchParams.set("api_key", TMDB_API_KEY);
  if (language) url.searchParams.set("language", language);
  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    url.searchParams.set(key, String(value));
  });
  return url.toString();
}

const STREAMING_PROVIDER_PRIORITY = [
  "netflix",
  "max",
  "disney+",
  "prime-video",
  "canal+",
  "apple-tv+",
  "ocs",
  "paramount+",
  "universal+",
  "crunchyroll",
  "mubi",
  "arte",
  "france-tv",
  "tf1+",
  "6play",
  "sfr-play",
];

async function fetchTmdbMovieDetails(tmdbId) {
  if (!tmdbId || TMDB_API_KEY === "VOTRE_CLE_API_ICI") return null;

  const imageParams = {
    append_to_response: "images",
    include_image_language: TMDB_IMAGE_LANGUAGE_PREFERENCE,
  };
  const urls = [
    buildTmdbUrl(`movie/${tmdbId}`, imageParams),
    buildTmdbUrl(`movie/${tmdbId}`, { ...imageParams, language: null }),
  ];

  for (const url of urls) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      return await res.json();
    } catch (error) {
      console.error("Erreur détail TMDB import:", error);
    }
  }

  return null;
}

function getPreferredTmdbPosterPath(tmdbDetails) {
  const posters = Array.isArray(tmdbDetails?.images?.posters)
    ? tmdbDetails.images.posters
    : [];

  const preferredPoster =
    posters.find((poster) => poster?.iso_639_1 === "fr") ||
    posters.find((poster) => poster?.iso_639_1 === null) ||
    posters.find((poster) => poster?.iso_639_1 === "en") ||
    posters[0];

  return preferredPoster?.file_path || tmdbDetails?.poster_path || null;
}

async function hydrateMovieItemFromTmdb(item, tmdbId, statusOverride = null) {
  if (!item || !tmdbId || TMDB_API_KEY === "VOTRE_CLE_API_ICI") return item;

  const tmdbDetails = await fetchTmdbMovieDetails(tmdbId);
  const forcedMatch = getForcedTmdbMovieMatch(item);
  if (!tmdbDetails) {
    if (!forcedMatch) return item;

    return {
      ...item,
      tmdbId,
      title: forcedMatch.fallbackTitle || item.title,
      year: forcedMatch.year || item.year,
      posterUrl: item.posterUrl || forcedMatch.fallbackPosterUrl || "",
      tmdbLocalizationVersion: TMDB_MOVIE_LOCALIZATION_VERSION,
    };
  }

  const preferredPosterPath = getPreferredTmdbPosterPath(tmdbDetails);

  let provider = null;
  try {
    const watchProviders = await fetchWatchProviders("movie", tmdbId);
    provider = getPrimaryWatchProvider(watchProviders, {
      includedOnly: true,
    });
  } catch (error) {
    console.error("Erreur providers hydrate import:", error);
  }

  const hydratedItem = buildCollectionItemFromTrending(
    {
      ...tmdbDetails,
      media_type: "movie",
      poster_path: preferredPosterPath || tmdbDetails.poster_path,
    },
    "movie",
    provider,
    statusOverride || item.status || "towatch",
  );

  return {
    ...hydratedItem,
    id: item.id,
    title: hydratedItem.title || forcedMatch?.fallbackTitle || item.title,
    year: hydratedItem.year || item.year,
    releaseDate: hydratedItem.releaseDate || item.releaseDate || null,
    posterUrl: hydratedItem.posterUrl || item.posterUrl || "",
    rating: item.rating ?? hydratedItem.rating ?? null,
    notes: item.notes || "",
    tags: [...new Set([...(hydratedItem.tags || []), ...(item.tags || [])])],
    dateAdded: item.dateAdded || hydratedItem.dateAdded,
    watchedAt:
      item.watchedAt ||
      (item.status === "watched" ? hydratedItem.watchedAt : null),
    status: item.status || statusOverride || hydratedItem.status,
    letterboxdUri: item.letterboxdUri || "",
    tmdbLocalizationVersion: TMDB_MOVIE_LOCALIZATION_VERSION,
  };
}

// Titles with no TMDB match are remembered so the automatic repair does not
// re-run the same searches on every launch.
const TMDB_MATCH_MISS_TTL_MS = 14 * 24 * 60 * 60 * 1000;

const TMDB_MATCH_MISS_LIMIT = 2000;

const tmdbMovieMatchRequests = new Map();

let tmdbMatchMisses = null;

function getTmdbMatchMisses() {
  if (tmdbMatchMisses) return tmdbMatchMisses;
  const stored = readStoredJson(STORAGE_KEYS.tmdbMatchMisses, {});
  tmdbMatchMisses = stored && typeof stored === "object" && !Array.isArray(stored) ? stored : {};
  return tmdbMatchMisses;
}

function recordTmdbMatchMiss(key) {
  const misses = getTmdbMatchMisses();
  misses[key] = Date.now();
  tmdbMatchMisses = Object.fromEntries(
    Object.entries(misses)
      .sort((left, right) => right[1] - left[1])
      .slice(0, TMDB_MATCH_MISS_LIMIT),
  );
  // Best effort cache: losing it only costs extra searches.
  writeStoredJson(STORAGE_KEYS.tmdbMatchMisses, tmdbMatchMisses);
}

function findTmdbMovieMatch(title, year) {
  if (!title || TMDB_API_KEY === "VOTRE_CLE_API_ICI") return Promise.resolve(null);

  const key = `${slugifyImportPart(title)}|${String(year || "").trim()}`;
  const missedAt = Number(getTmdbMatchMisses()[key]);
  if (Number.isFinite(missedAt) && Date.now() - missedAt < TMDB_MATCH_MISS_TTL_MS) {
    return Promise.resolve(null);
  }

  // Share one search between the startup repair and the render-time hydration.
  if (!tmdbMovieMatchRequests.has(key)) {
    tmdbMovieMatchRequests.set(
      key,
      searchTmdbMovieMatch(title, year).then(({ match, complete }) => {
        if (!match && complete) recordTmdbMatchMiss(key);
        if (!complete) tmdbMovieMatchRequests.delete(key);
        return match;
      }),
    );
  }
  return tmdbMovieMatchRequests.get(key);
}

// Returns { match, complete }: complete is false when a request failed, so a
// network/rate-limit error is never remembered as "no match".
async function searchTmdbMovieMatch(title, year) {
  const normalizedYear = /^\d{4}$/.test(String(year || "").trim())
    ? String(year).trim()
    : "";
  const rankedCandidates = new Map();
  const titleVariants = getMovieTitleSearchVariants(title);
  let complete = true;

  try {
    for (const variant of titleVariants) {
      const searchParams = { query: variant, include_adult: "false" };
      // Without a year the first two searches are identical: dedupe them.
      const urls = [
        ...new Set([
          buildTmdbUrl("search/movie", {
            ...searchParams,
            primary_release_year: normalizedYear,
          }),
          buildTmdbUrl("search/movie", searchParams),
          buildTmdbUrl("search/movie", { ...searchParams, language: null }),
        ]),
      ];

      for (const url of urls) {
        const res = await fetch(url);
        if (!res.ok) {
          complete = false;
          continue;
        }

        const data = await res.json();
        const results = Array.isArray(data.results)
          ? data.results.slice(0, 12)
          : [];

        results.forEach((candidate) => {
          const score = scoreMovieMatch(candidate, title, year);
          const existingEntry = rankedCandidates.get(candidate.id);

          if (!existingEntry || score > existingEntry.score) {
            rankedCandidates.set(candidate.id, { candidate, score });
          }
        });

        const exactishMatch = [...rankedCandidates.values()].sort(
          (left, right) => right.score - left.score,
        )[0];

        if (exactishMatch && exactishMatch.score >= 72) {
          return { match: exactishMatch.candidate, complete: true };
        }
      }
    }

    const bestMatch = [...rankedCandidates.values()].sort(
      (left, right) => right.score - left.score,
    )[0];
    if (!bestMatch || bestMatch.score < 48) return { match: null, complete };
    return { match: bestMatch.candidate, complete: true };
  } catch (error) {
    console.error("Erreur recherche TMDB import:", error);
    return { match: null, complete: false };
  }
}

async function enrichImportedMovieItem(item) {
  if (item.type !== "movie" || TMDB_API_KEY === "VOTRE_CLE_API_ICI") {
    return item;
  }

  const forcedMatch = getForcedTmdbMovieMatch(item);
  if (forcedMatch && shouldForceMovieTmdbOverride(item)) {
    return hydrateMovieItemFromTmdb(
      item,
      forcedMatch.tmdbId,
      item.status || "towatch",
    );
  }

  if (item.tmdbId) {
    const needsHydration =
      !item.posterUrl ||
      !item.genre ||
      !item.year ||
      !item.releaseDate ||
      (isLikelyLetterboxdImportedMovie(item) &&
        (item.tmdbLocalizationVersion || 0) < TMDB_MOVIE_LOCALIZATION_VERSION);
    return needsHydration
      ? hydrateMovieItemFromTmdb(item, item.tmdbId, item.status || "towatch")
      : item;
  }

  const tmdbMatch = await findTmdbMovieMatch(item.title, item.year);
  if (!tmdbMatch) return item;

  return hydrateMovieItemFromTmdb(item, tmdbMatch.id, item.status || "towatch");
}

async function enrichImportedItems(itemsToEnrich) {
  if (!Array.isArray(itemsToEnrich) || itemsToEnrich.length === 0) {
    return { items: [], matchedCount: 0 };
  }

  const results = [];
  let matchedCount = 0;
  const batchSize = 4;

  for (let index = 0; index < itemsToEnrich.length; index += batchSize) {
    const batch = itemsToEnrich.slice(index, index + batchSize);
    const enrichedBatch = await Promise.all(
      batch.map(async (item) => {
        const enrichedItem = await enrichImportedMovieItem(item);
        if (enrichedItem.tmdbId) matchedCount++;
        return enrichedItem;
      }),
    );
    results.push(...enrichedBatch);
  }

  return { items: results, matchedCount };
}

function getCompactProviderLabel(providerName) {
  if (!providerName) return "";

  const normalized = providerName.trim();
  const aliases = {
    "Apple TV Plus": "Apple TV+",
    "Apple TV+": "Apple TV+",
    "Disney Plus": "Disney+",
    "Disney+": "Disney+",
    "Amazon Prime Video": "Prime Video",
    Netflix: "Netflix",
    Max: "Max",
    "Canal+": "Canal+",
  };

  return aliases[normalized] || normalized;
}

function getProviderPriorityKey(providerName) {
  const normalized = getCompactProviderLabel(providerName)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

  if (normalized === "premiere max") return "premiere-max";
  if (normalized === "prime video") return "prime-video";
  if (normalized === "apple tv+") return "apple-tv+";
  if (normalized === "disney+") return "disney+";
  if (normalized === "canal+") return "canal+";
  if (normalized === "paramount+") return "paramount+";
  if (normalized === "universal+") return "universal+";
  if (normalized === "france.tv") return "france-tv";
  if (normalized === "tf1+") return "tf1+";
  if (normalized === "6play") return "6play";
  if (/\bocs\b/.test(normalized)) return "ocs";
  if (/\bsfr\b/.test(normalized)) return "sfr-play";
  if (/\bnetflix\b/.test(normalized)) return "netflix";
  if (
    normalized === "max" ||
    normalized === "hbo max" ||
    /^max\b/.test(normalized)
  )
    return "max";
  if (/\bdisney\b/.test(normalized)) return "disney+";
  if (/prime/.test(normalized)) return "prime-video";
  if (/apple/.test(normalized)) return "apple-tv+";
  if (/canal/.test(normalized)) return "canal+";
  if (/paramount/.test(normalized)) return "paramount+";
  if (/universal/.test(normalized)) return "universal+";
  if (/crunchyroll/.test(normalized)) return "crunchyroll";
  if (/mubi/.test(normalized)) return "mubi";
  if (/arte/.test(normalized)) return "arte";
  if (/france/.test(normalized)) return "france-tv";
  if (/tf1/.test(normalized)) return "tf1+";

  return normalized.replace(/[^a-z0-9+]+/g, "-").replace(/^-+|-+$/g, "");
}

function compareProvidersByPriority(leftProvider, rightProvider) {
  const leftName = leftProvider?.provider_name || "";
  const rightName = rightProvider?.provider_name || "";
  const leftKey = getProviderPriorityKey(leftName);
  const rightKey = getProviderPriorityKey(rightName);
  const leftRank = STREAMING_PROVIDER_PRIORITY.indexOf(leftKey);
  const rightRank = STREAMING_PROVIDER_PRIORITY.indexOf(rightKey);

  if (leftRank !== -1 || rightRank !== -1) {
    if (leftRank === -1) return 1;
    if (rightRank === -1) return -1;
    if (leftRank !== rightRank) return leftRank - rightRank;
  }

  return getCompactProviderLabel(leftName).localeCompare(
    getCompactProviderLabel(rightName),
    "fr",
    { sensitivity: "base" },
  );
}

function normalizeTmdbMediaType(type) {
  return type === "tv" || type === "series" ? "tv" : "movie";
}

function getCollectionTypeFromTmdbType(type) {
  return normalizeTmdbMediaType(type) === "tv" ? "series" : "movie";
}

// Utilise GENRE_MAP depuis config.js
function getGenreNames(genreIds, mediaType) {
  const map = GENRE_MAP[mediaType] || GENRE_MAP.movie;
  return genreIds
    .slice(0, 3)
    .map((id) => map[id] || "")
    .filter(Boolean)
    .join(", ");
}

function resolveProviderLogoUrl(logoPath) {
  const raw = String(logoPath || "").trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://image.tmdb.org/t/p/w92${raw}`;
}

function normalizeWatchProviders(payload, region = TMDB_WATCH_REGION) {
  const regionData = payload?.results?.[region];
  if (!regionData) return null;

  const groupLabels = {
    flatrate: "Streaming",
    free: "Gratuit",
    ads: "Avec pub",
    rent: "Location",
    buy: "Achat",
  };

  const groups = WATCH_PROVIDER_GROUP_ORDER.map((groupKey) => ({
    key: groupKey,
    label: groupLabels[groupKey] || groupKey,
  }))
    .map((group) => ({
      ...group,
      providers: [...(regionData[group.key] || [])]
        .sort(compareProvidersByPriority)
        .slice(0, 8),
    }))
    .filter((group) => group.providers.length > 0);

  if (groups.length === 0) return null;

  return {
    region,
    link: regionData.link || "",
    sourceLabel: "TMDB",
    groups,
  };
}

function getAvailabilityMode() {
  return ["tmdb", "hybrid", "fresh"].includes(AVAILABILITY_SOURCE)
    ? AVAILABILITY_SOURCE
    : "tmdb";
}

function buildFreshAvailabilityUrl(endpoint, tmdbId, region = TMDB_WATCH_REGION) {
  if (!FRESH_AVAILABILITY_URL_TEMPLATE) return "";
  const mediaType = endpoint === "movie" ? "movie" : "tv";
  const countryCode = String(region || "").toLowerCase();
  return FRESH_AVAILABILITY_URL_TEMPLATE.replace(/\{mediaType\}/g, mediaType)
    .replace(/\{tmdbId\}/g, encodeURIComponent(String(tmdbId)))
    .replace(/\{country\}/g, encodeURIComponent(countryCode));
}

function normalizeFreshProviderType(rawType) {
  const value = String(rawType || "").toLowerCase();
  if (["subscription", "sub", "flatrate", "stream", "streaming"].includes(value)) return "flatrate";
  if (["free", "free_with_ads"].includes(value)) return "free";
  if (["ads", "ad", "ad_supported"].includes(value)) return "ads";
  if (value === "rent" || value === "rental") return "rent";
  if (["buy", "purchase"].includes(value)) return "buy";
  return null;
}

function normalizeFreshWatchProviders(payload, region = TMDB_WATCH_REGION) {
  if (!payload) return null;

  // Accept already-normalized payload from a custom proxy.
  if (Array.isArray(payload.groups) && payload.groups.length > 0) {
    return {
      region,
      link: payload.link || "",
      sourceLabel: payload.sourceLabel || "Source externe",
      groups: payload.groups,
    };
  }

  // Accept TMDB-shaped payload if proxy forwards TMDB compatibility format.
  if (payload?.results?.[region]) {
    const normalized = normalizeWatchProviders(payload, region);
    if (!normalized) return null;
    return {
      ...normalized,
      sourceLabel: payload.sourceLabel || "Source externe",
    };
  }

  // Streaming-availability style shape: payload.streamingOptions[countryCode].
  const countryKey = String(region || "").toLowerCase();
  const optionsByCountry = payload.streamingOptions || payload?.result?.streamingOptions;
  const entries = Array.isArray(optionsByCountry?.[countryKey])
    ? optionsByCountry[countryKey]
    : Array.isArray(optionsByCountry?.[region])
      ? optionsByCountry[region]
      : [];

  if (!entries.length) return null;

  const groupsMap = new Map(
    WATCH_PROVIDER_GROUP_ORDER.map((groupKey) => [groupKey, new Map()]),
  );

  entries.forEach((entry) => {
    const groupKey = normalizeFreshProviderType(entry?.type);
    if (!groupKey || !groupsMap.has(groupKey)) return;

    const service = entry?.service || {};
    const providerId = service.id || service.providerId || service.name || "unknown";
    const providerName = service.name || entry?.provider_name || "Plateforme";
    const logoPath =
      service?.imageSet?.lightThemeImage ||
      service?.imageSet?.darkThemeImage ||
      service?.logo_path ||
      "";

    groupsMap.get(groupKey).set(String(providerId), {
      provider_id: providerId,
      provider_name: providerName,
      logo_path: logoPath,
    });
  });

  const groupLabels = {
    flatrate: "Streaming",
    free: "Gratuit",
    ads: "Avec pub",
    rent: "Location",
    buy: "Achat",
  };

  const groups = WATCH_PROVIDER_GROUP_ORDER.map((groupKey) => ({
    key: groupKey,
    label: groupLabels[groupKey] || groupKey,
    providers: [...(groupsMap.get(groupKey)?.values() || [])]
      .sort(compareProvidersByPriority)
      .slice(0, 8),
  })).filter((group) => group.providers.length > 0);

  if (!groups.length) return null;

  return {
    region,
    link: payload.link || payload.moreInfoUrl || "",
    sourceLabel: payload.sourceLabel || "Source externe",
    groups,
  };
}

async function fetchFreshWatchProviders(endpoint, tmdbId) {
  const url = buildFreshAvailabilityUrl(endpoint, tmdbId);
  if (!url) return null;

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: getBackendAuthHeaders(),
    });
    if (!res.ok) return null;

    const payload = await res.json();
    return normalizeFreshWatchProviders(payload, TMDB_WATCH_REGION);
  } catch (error) {
    console.error("Erreur availability source externe:", error);
    return null;
  }
}

function getPrimaryWatchProvider(watchProviders, options = {}) {
  const includedOnly = Boolean(options.includedOnly);
  const sortedGroups = Array.isArray(watchProviders?.groups)
    ? [...watchProviders.groups].sort(
        (leftGroup, rightGroup) =>
          WATCH_PROVIDER_GROUP_ORDER.indexOf(leftGroup?.key) -
          WATCH_PROVIDER_GROUP_ORDER.indexOf(rightGroup?.key),
      )
    : [];
  const group = sortedGroups.find(
    (candidateGroup) =>
      (!includedOnly ||
        WATCH_PROVIDER_INCLUDED_GROUPS.has(candidateGroup?.key)) &&
      Array.isArray(candidateGroup?.providers) &&
      candidateGroup.providers.length > 0,
  );
  const provider = group?.providers?.[0];
  if (!provider) return null;

  return {
    providerName: provider.provider_name || "",
    providerLogo: resolveProviderLogoUrl(provider.logo_path),
    providerAccessType: group?.key || null,
  };
}

async function fetchWatchProviders(endpoint, tmdbId) {
  const mode = getAvailabilityMode();

  if (mode === "fresh") {
    const fresh = await fetchFreshWatchProviders(endpoint, tmdbId);
    if (fresh) return fresh;
  }

  try {
    const res = await fetch(
      buildTmdbUrl(`${endpoint}/${tmdbId}/watch/providers`, { language: null }),
    );
    if (!res.ok) {
      if (mode === "hybrid") {
        return await fetchFreshWatchProviders(endpoint, tmdbId);
      }
      return null;
    }

    const payload = await res.json();
    const tmdbProviders = normalizeWatchProviders(payload);
    
    // Return TMDB data if available (includes all types: flatrate, rent, buy, etc.)
    if (tmdbProviders) {
      return tmdbProviders;
    }

    // Only fallback to fresh if TMDB has absolutely nothing
    if (mode === "hybrid") {
      const fresh = await fetchFreshWatchProviders(endpoint, tmdbId);
      if (fresh) return fresh;
    }
    
    return null;
  } catch (error) {
    console.error("Erreur watch providers:", error);
    if (mode === "hybrid") {
      return await fetchFreshWatchProviders(endpoint, tmdbId);
    }
    return null;
  }
}

function buildCollectionItemFromTrending(
  item,
  type,
  provider,
  status = "towatch",
) {
  const title = item.title || item.name;
  const releaseDate = item.release_date || item.first_air_date || null;
  const year = (item.release_date || item.first_air_date || "").substring(0, 4);
  const genres = item.genre_ids
    ? getGenreNames(item.genre_ids, type)
    : Array.isArray(item.genres)
      ? item.genres
          .map((genre) => genre?.name)
          .filter(Boolean)
          .join(", ")
      : "";
  const rating = item.vote_average ? (item.vote_average / 2).toFixed(1) : "";
  const posterUrl = item.poster_path
    ? `${TMDB_IMAGE_BASE}${item.poster_path}`
    : null;

  return {
    id: Date.now().toString(),
    title,
    type: type === "movie" ? "movie" : "series",
    year,
    releaseDate,
    status,
    rating: null,
    tmdbRating: parseFloat(rating) || null,
    genre: genres,
    notes: "",
    posterUrl,
    tmdbId: item.id,
    providerLogo: provider?.providerLogo || null,
    providerName: provider?.providerName || null,
    providerAccessType: provider?.providerAccessType || null,
    providerPriorityVersion: WATCH_PROVIDER_PRIORITY_VERSION,
    tags: [],
    currentSeason: type === "tv" ? 1 : null,
    currentEpisode: type === "tv" ? 1 : null,
    dateAdded: new Date().toISOString(),
    watchedAt: status === "watched" ? new Date().toISOString() : null,
  };
}

function hasConfiguredTmdbApiKey() {
  return Boolean(TMDB_API_KEY && TMDB_API_KEY !== "VOTRE_CLE_API_ICI");
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    TMDB_API_KEY,
    TMDB_BASE_URL,
    buildTmdbUrl,
    TMDB_IMAGE_BASE,
    AVAILABILITY_SOURCE,
    FRESH_AVAILABILITY_URL_TEMPLATE,
    BACKEND_ACCESS_TOKEN,
    getBackendAuthHeaders,
    TMDB_WATCH_REGION,
    TMDB_IMAGE_LANGUAGE_PREFERENCE,
    TMDB_MOVIE_LOCALIZATION_VERSION,
    WATCH_PROVIDER_GROUP_ORDER,
    WATCH_PROVIDER_INCLUDED_GROUPS,
    WATCH_PROVIDER_PRIORITY_VERSION,
    STREAMING_PROVIDER_PRIORITY,
    fetchTmdbMovieDetails,
    getPreferredTmdbPosterPath,
    hydrateMovieItemFromTmdb,
    TMDB_MATCH_MISS_TTL_MS,
    TMDB_MATCH_MISS_LIMIT,
    tmdbMovieMatchRequests,
    tmdbMatchMisses,
    getTmdbMatchMisses,
    recordTmdbMatchMiss,
    findTmdbMovieMatch,
    searchTmdbMovieMatch,
    enrichImportedMovieItem,
    enrichImportedItems,
    getCompactProviderLabel,
    getProviderPriorityKey,
    compareProvidersByPriority,
    normalizeTmdbMediaType,
    getCollectionTypeFromTmdbType,
    getGenreNames,
    resolveProviderLogoUrl,
    normalizeWatchProviders,
    getAvailabilityMode,
    buildFreshAvailabilityUrl,
    normalizeFreshProviderType,
    normalizeFreshWatchProviders,
    fetchFreshWatchProviders,
    getPrimaryWatchProvider,
    fetchWatchProviders,
    buildCollectionItemFromTrending,
    hasConfiguredTmdbApiKey,
  };
}
