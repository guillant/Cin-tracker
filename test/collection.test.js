"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  normalizeStatusValue,
  normalizeCollectionItem,
  getImportComparisonKey,
  getImportTitleYearKey,
  parseCsvText,
  parseImportDateToIso,
  parseLetterboxdRating,
  getLetterboxdFileInfo,
  parseLetterboxdCsv,
  getMovieTitleSearchVariants,
  getForcedTmdbMovieMatch,
  findExistingMovieMergeCandidateIndex,
  scoreMovieMatch,
  shouldPreferImportedMovieMetadata,
  mergeImportedIntoExistingItem,
} = require("../js/collection");

// --- CSV parsing -----------------------------------------------------------

test("CSV parser handles quotes, escaped quotes, CRLF, BOM and blank lines", () => {
  const csv =
    '﻿Name,Year,Review\r\n' +
    '"Crouching Tiger, Hidden Dragon",2000,"He said ""wow"""\r\n' +
    "\r\n" +
    'Heat,1995,"line one\nline two"\n';
  assert.deepEqual(parseCsvText(csv), [
    { name: "Crouching Tiger, Hidden Dragon", year: "2000", review: 'He said "wow"' },
    { name: "Heat", year: "1995", review: "line one\nline two" },
  ]);
});

test("CSV parser returns no rows for empty input", () => {
  assert.deepEqual(parseCsvText(""), []);
  assert.deepEqual(parseCsvText("\n\n"), []);
});

test("Letterboxd ratings accept decimals, comma decimals and stars", () => {
  assert.equal(parseLetterboxdRating("4"), 4);
  assert.equal(parseLetterboxdRating("3.5"), 3.5);
  assert.equal(parseLetterboxdRating("3,5"), 3.5);
  assert.equal(parseLetterboxdRating("★★★½"), 3.5);
  assert.equal(parseLetterboxdRating(""), null);
  assert.equal(parseLetterboxdRating("abc"), null);
  assert.equal(parseLetterboxdRating("7"), 5);
});

test("import dates accept ISO and French formats", () => {
  assert.equal(parseImportDateToIso("2024-03-05"), "2024-03-05T12:00:00.000Z");
  assert.equal(parseImportDateToIso("05/03/2024"), "2024-03-05T12:00:00.000Z");
  assert.equal(parseImportDateToIso(""), null);
  assert.equal(parseImportDateToIso("not a date"), null);
});

test("Letterboxd file kind is detected from the file name", () => {
  assert.equal(getLetterboxdFileInfo("watchlist.csv").kind, "watchlist");
  assert.equal(getLetterboxdFileInfo("ratings.csv").kind, "ratings");
  assert.deepEqual(getLetterboxdFileInfo("best-of_2024.csv"), {
    kind: "list",
    listLabel: "Best Of 2024",
  });
});

// --- Letterboxd import -------------------------------------------------------

test("Letterboxd diary merges rewatches into one item with the latest date", () => {
  const csv = [
    "Date,Name,Year,Letterboxd URI,Rating,Watched Date",
    "2024-01-02,Heat,1995,https://boxd.it/a,4,2024-01-01",
    "2024-06-02,Heat,1995,https://boxd.it/b,4.5,2024-06-01",
    "2024-02-02,Alien,1979,https://boxd.it/c,,2024-02-01",
  ].join("\n");
  const imported = parseLetterboxdCsv(csv, "diary.csv");

  assert.equal(imported.length, 2);
  const heat = imported.find((item) => item.title === "Heat");
  assert.equal(heat.status, "watched");
  assert.equal(heat.rating, 4.5);
  assert.equal(heat.watchedAt, "2024-06-01T12:00:00.000Z");
  assert.equal(heat.letterboxdUri, "https://boxd.it/a");
  assert.equal(heat.type, "movie");
  // Most recently watched first.
  assert.deepEqual(imported.map((item) => item.title), ["Heat", "Alien"]);
});

test("Letterboxd watchlist items are imported as to-watch", () => {
  const csv = "Date,Name,Year,Letterboxd URI\n2024-01-02,Dune,2021,https://boxd.it/d";
  const [dune] = parseLetterboxdCsv(csv, "watchlist.csv");
  assert.equal(dune.status, "towatch");
  assert.equal(dune.watchedAt, null);
  assert.equal(dune.releaseDate, "2021-01-01");
});

test("Letterboxd import rejects empty and unrelated CSV files", () => {
  assert.throws(() => parseLetterboxdCsv("", "x.csv"), /vide/);
  assert.throws(() => parseLetterboxdCsv("foo,bar\n1,2", "x.csv"), /non reconnu/);
});

test("Letterboxd remakes with the same title stay separate items", () => {
  const csv = [
    "Date,Name,Year,Letterboxd URI",
    "2024-01-02,Dune,1984,https://boxd.it/old",
    "2024-01-03,Dune,2021,https://boxd.it/new",
  ].join("\n");
  assert.equal(parseLetterboxdCsv(csv, "watched.csv").length, 2);
});

// --- Item normalization -----------------------------------------------------

test("collection items are normalized and invalid entries dropped", () => {
  assert.equal(normalizeCollectionItem(null), null);
  assert.equal(normalizeCollectionItem({ title: "   " }), null);

  const item = normalizeCollectionItem(
    {
      id: 42,
      title: "  Heat ",
      type: "film",
      status: "WATCHED",
      rating: "4",
      year: 1995,
      tags: ["  Polar ", "", null, "Favori"],
      posterUrl: 12,
      extra: "kept",
    },
    0,
  );
  assert.equal(item.id, "42");
  assert.equal(item.title, "Heat");
  assert.equal(item.type, "movie");
  assert.equal(item.status, "watched");
  assert.equal(item.rating, 4);
  assert.equal(item.year, "1995");
  assert.deepEqual(item.tags, ["Polar", "Favori"]);
  assert.equal(item.posterUrl, "");
  assert.equal(item.extra, "kept");
});

test("ratings are clamped and empty or invalid ratings become null", () => {
  const rating = (value) => normalizeCollectionItem({ title: "x", rating: value }).rating;
  assert.equal(rating(9), 5);
  assert.equal(rating(0), null);
  assert.equal(rating(-1), null);
  assert.equal(rating(""), null);
  assert.equal(rating("abc"), null);
  assert.equal(rating(undefined), null);
});

test("unknown statuses fall back to to-watch", () => {
  assert.equal(normalizeStatusValue("paused"), "paused");
  assert.equal(normalizeStatusValue("bogus"), "towatch");
  assert.equal(normalizeStatusValue("__proto__"), "towatch");
});

test("normalized items get unique ids when the source has none", () => {
  const first = normalizeCollectionItem({ title: "A" }, 0);
  const second = normalizeCollectionItem({ title: "B" }, 1);
  assert.ok(first.id);
  assert.notEqual(first.id, second.id);
});

// --- Matching and merge -----------------------------------------------------

test("import keys prefer the TMDB id and fall back to title + year", () => {
  assert.equal(
    getImportComparisonKey({ type: "movie", tmdbId: 949, title: "Heat" }),
    "movie:tmdb:949",
  );
  assert.equal(
    getImportComparisonKey({ type: "movie", title: "Le Comte de Monte-Cristo", year: "2024" }),
    "movie:le-comte-de-monte-cristo:2024",
  );
  assert.equal(getImportTitleYearKey({ title: "Été 85" }), "movie:ete-85:na");
});

test("title variants drop subtitles, parentheses and swap & / and", () => {
  const variants = getMovieTitleSearchVariants("Fast & Furious: Hobbs (2019)");
  assert.ok(variants.includes("Fast & Furious: Hobbs (2019)"));
  assert.ok(variants.includes("Fast & Furious"));
  assert.ok(variants.includes("Fast and Furious"));
  assert.ok(variants.length <= 8);
});

test("forced TMDB matches resolve known problematic titles", () => {
  assert.equal(
    getForcedTmdbMovieMatch({ type: "movie", title: "Un p'tit truc en plus", year: "2024" })?.tmdbId,
    1152014,
  );
  assert.equal(getForcedTmdbMovieMatch({ type: "series", title: "The Penguin" }), null);
});

test("merge candidate finds the same movie despite punctuation differences", () => {
  const collection = [
    { id: "a", type: "movie", title: "Gladiator", year: "2000", tmdbId: 98 },
    { id: "b", type: "movie", title: "Le Comte de Monte-Cristo", year: "2024", tmdbId: 1084736 },
  ];
  const imported = { id: "x", type: "movie", title: "Le Comte de Monte Cristo", year: "2024" };
  assert.equal(findExistingMovieMergeCandidateIndex(collection, imported), 1);
});

test("merge candidate never merges a remake into the original", () => {
  const collection = [{ id: "a", type: "movie", title: "Dune", year: "2021", tmdbId: 438631 }];
  assert.equal(
    findExistingMovieMergeCandidateIndex(collection, {
      id: "x",
      type: "movie",
      title: "Dune",
      year: "1984",
    }),
    undefined,
  );
});

test("merge candidate tolerates a small year drift between sources", () => {
  const collection = [{ id: "a", type: "movie", title: "Été 85", year: "2020", tmdbId: 659959 }];
  assert.equal(
    findExistingMovieMergeCandidateIndex(collection, {
      id: "x",
      type: "movie",
      title: "Ete 85",
      year: "2019",
    }),
    0,
  );
});

test("merge candidate ignores series and unrelated titles", () => {
  const collection = [
    { id: "a", type: "series", title: "Heat", year: "1995" },
    { id: "b", type: "movie", title: "Alien", year: "1979" },
  ];
  assert.equal(
    findExistingMovieMergeCandidateIndex(collection, { id: "x", type: "movie", title: "Heat", year: "1995" }),
    undefined,
  );
});

test("TMDB scoring ranks the exact title and year first", () => {
  const exact = { title: "Heat", release_date: "1995-12-15", poster_path: "/p.jpg" };
  const wrongYear = { title: "Heat", release_date: "1986-03-14", poster_path: "/p.jpg" };
  const other = { title: "Heatwave", release_date: "1995-01-01", poster_path: "/p.jpg" };
  const score = (candidate) => scoreMovieMatch(candidate, "Heat", "1995");
  assert.ok(score(exact) > score(wrongYear));
  assert.ok(score(exact) > score(other));
});

test("merging keeps watched status, local notes and the union of tags", () => {
  const existing = {
    id: "a",
    type: "movie",
    title: "Heat",
    status: "watched",
    notes: "Revoir la scène de la banque",
    rating: 5,
    tags: ["Polar"],
    dateAdded: "2023-01-01T00:00:00.000Z",
  };
  const imported = {
    id: "letterboxd-heat",
    type: "movie",
    title: "Heat",
    status: "towatch",
    notes: "",
    rating: null,
    tags: ["Letterboxd", "Polar"],
  };
  const merged = mergeImportedIntoExistingItem(existing, imported);
  assert.equal(merged.id, "a");
  assert.equal(merged.status, "watched");
  assert.equal(merged.notes, "Revoir la scène de la banque");
  assert.equal(merged.rating, 5);
  assert.deepEqual(merged.tags, ["Polar", "Letterboxd"]);
  assert.equal(merged.dateAdded, "2023-01-01T00:00:00.000Z");
});

test("merging takes the imported rating and watch date when present", () => {
  const merged = mergeImportedIntoExistingItem(
    { id: "a", type: "movie", title: "Heat", status: "towatch", rating: 2 },
    {
      id: "b",
      type: "movie",
      title: "Heat",
      status: "watched",
      rating: 4.5,
      watchedAt: "2024-06-01T12:00:00.000Z",
    },
  );
  assert.equal(merged.status, "watched");
  assert.equal(merged.rating, 4.5);
  assert.equal(merged.watchedAt, "2024-06-01T12:00:00.000Z");
});

test("imported TMDB metadata wins only when it is better", () => {
  const letterboxdOnly = { type: "movie", title: "Heat", id: "letterboxd-heat" };
  const fromTmdb = { type: "movie", title: "Heat", tmdbId: 949 };
  assert.equal(shouldPreferImportedMovieMetadata(letterboxdOnly, fromTmdb), true);
  assert.equal(
    shouldPreferImportedMovieMetadata({ type: "movie", tmdbId: 1 }, { type: "movie", tmdbId: 2 }),
    false,
  );
  assert.equal(shouldPreferImportedMovieMetadata(fromTmdb, letterboxdOnly), false);
});
