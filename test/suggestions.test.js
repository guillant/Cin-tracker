"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

// suggestions.js is a classic browser script: it reads CONSTANTS, the
// storage.js helpers and the app.js provider helpers as globals.
const storedValues = new Map();
const userPlatformTitles = new Set(["On my Netflix"]);
Object.assign(globalThis, require("../js/storage"), {
  CONSTANTS: require("../js/config").CONSTANTS,
  localStorage: {
    getItem: (key) => (storedValues.has(key) ? storedValues.get(key) : null),
    setItem: (key, value) => storedValues.set(key, String(value)),
    removeItem: (key) => storedValues.delete(key),
  },
  isUserProviderAvailableItem: (item) => userPlatformTitles.has(item.title),
  getGroupProviderMatchCountForItem: () => 0,
});
const suggestions = require("../js/suggestions");
const { suggestionFilters } = suggestions;

function withFilters(overrides, run) {
  const previous = { ...suggestionFilters };
  Object.assign(suggestionFilters, overrides);
  try {
    run();
  } finally {
    Object.assign(suggestionFilters, previous);
  }
}

test("watch time falls back to average durations", () => {
  assert.equal(suggestions.getEstimatedWatchMinutes({ type: "series" }), 45);
  assert.equal(suggestions.getEstimatedWatchMinutes({ type: "movie" }), 120);
  assert.equal(suggestions.getEstimatedWatchMinutes({ type: "movie", runtime: 95 }), 95);
  assert.equal(suggestions.getEstimatedWatchMinutes({ type: "movie", runtime: "abc" }), 120);
});

test("watch time is formatted in minutes then hours", () => {
  assert.equal(suggestions.formatWatchMinutes(45), "45 min");
  assert.equal(suggestions.formatWatchMinutes(120), "2h");
  assert.equal(suggestions.formatWatchMinutes(95), "1h35");
  assert.equal(suggestions.formatWatchMinutes(0), "");
});

test("the time filter keeps titles that fit the available time", () => {
  withFilters({ time: "60" }, () => {
    assert.equal(suggestions.matchesSuggestionTimeFilter({ type: "series" }), true);
    assert.equal(suggestions.matchesSuggestionTimeFilter({ type: "movie", runtime: 130 }), false);
  });
  withFilters({ time: "all" }, () => {
    assert.equal(suggestions.matchesSuggestionTimeFilter({ type: "movie", runtime: 300 }), true);
  });
});

test("mood comes from genre words, light before intense", () => {
  assert.equal(suggestions.getItemMood({ genre: "Comédie, Romance" }), "light");
  assert.equal(suggestions.getItemMood({ genre: "Thriller" }), "intense");
  assert.equal(suggestions.getItemMood({ genre: "Comédie, Crime" }), "light");
  assert.equal(suggestions.getItemMood({ genre: "Western" }), "all");
});

test("filters combine source, type, mood and platform availability", () => {
  const thriller = { title: "Heat", type: "movie", genre: "Thriller" };
  withFilters({ type: "series" }, () => {
    assert.equal(suggestions.matchesSuggestionFilters(thriller, "collection"), false);
  });
  withFilters({ source: "discover" }, () => {
    assert.equal(suggestions.matchesSuggestionFilters(thriller, "collection"), false);
  });
  withFilters({ mood: "light" }, () => {
    assert.equal(suggestions.matchesSuggestionFilters(thriller, "collection"), false);
  });
  withFilters({ availability: "mine", mode: "solo" }, () => {
    assert.equal(suggestions.matchesSuggestionFilters(thriller, "collection"), false);
    assert.equal(
      suggestions.matchesSuggestionFilters(thriller, "collection", { ignoreAvailability: true }),
      true,
    );
    assert.equal(
      suggestions.matchesSuggestionFilters({ ...thriller, title: "On my Netflix" }, "collection"),
      true,
    );
  });
});

test("recent suggestions are remembered most recent first, without duplicates", () => {
  for (const id of ["a", "b", "a", "c"]) suggestions.rememberSuggestion({ id });
  assert.deepEqual(suggestions.loadRecentSuggestionHistory(), ["c", "a", "b"]);

  for (let i = 0; i < 20; i += 1) suggestions.rememberSuggestion({ id: `x${i}` });
  assert.equal(suggestions.loadRecentSuggestionHistory().length, 8);
});
