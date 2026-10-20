"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

// assistant.js is a classic browser script: it reads CONFIG, the storage.js
// helpers and a few app.js values as globals, exactly like in index.html.
Object.assign(globalThis, require("../js/storage"), {
  CONFIG: { AI_ASSISTANT_API_URL: "/api/assistant" },
  USER_PROVIDER_OPTIONS: [
    { key: "netflix", label: "Netflix", tmdbId: 8 },
    { key: "arte", label: "Arte", tmdbId: 234 },
    { key: "disney+", label: "Disney+", tmdbId: 337 },
  ],
});
const assistant = require("../js/assistant");

test("the request timeout defaults to 15 s and outwaits the server", () => {
  assert.equal(assistant.getAssistantRequestTimeoutMs(), 15000);
});

test("recommendations without a titled item are dropped", () => {
  assert.equal(assistant.normalizeAssistantRecommendations(null), null);
  assert.equal(assistant.normalizeAssistantRecommendations({ items: [] }), null);
  assert.equal(assistant.normalizeAssistantRecommendations({ items: [{ title: "  " }] }), null);
});

test("recommendations are trimmed, ranked and capped", () => {
  const result = assistant.normalizeAssistantRecommendations({
    chips: ["a", "", "b", "c", "d", "e"],
    items: [
      { title: " Heat ", reason: "Polar" },
      { title: "" },
      { title: "Dark" },
      { title: "Ran" },
      { title: "Alien" },
      { title: "Too many" },
    ],
  });
  assert.equal(result.eyebrow, "Suggestion");
  assert.deepEqual(result.chips, ["a", "b", "c", "d"]);
  assert.deepEqual(
    result.items.map((item) => item.title),
    ["Heat", "Dark", "Ran", "Alien"],
  );
  assert.equal(result.items[0].rank, "1");
  assert.equal(result.items[1].rank, "3");
});

test("accents and case are ignored when reading prompts", () => {
  assert.equal(assistant.normalizeAssistantText("Série DÉJÀ vue"), "serie deja vue");
  assert.equal(assistant.shouldSendFullCollectionSnapshot("Quel bilan pour MES SÉRIES ?"), true);
  assert.equal(assistant.shouldSendFullCollectionSnapshot("bonjour"), false);
});

test("a discovery request yields media type, genre and platform", () => {
  assert.deepEqual(
    assistant.parseAssistantCatalogIntent("Trouve-moi une série thriller sur Netflix"),
    {
      mediaType: "tv",
      genreId: 9648,
      genreLabel: "thriller",
      providerId: 8,
      providerLabel: "Netflix",
    },
  );
});

test("films are the default media type", () => {
  const intent = assistant.parseAssistantCatalogIntent("Une idée de comédie ?");
  assert.equal(intent.mediaType, "movie");
  assert.equal(intent.genreId, 35);
  assert.equal(intent.providerId, null);
});

test("platforms and genres must be whole words", () => {
  // "carte" contains "arte", "satisfaction" contains "action".
  const intent = assistant.parseAssistantCatalogIntent(
    "Trouve un film à la carte, satisfaction maximum",
  );
  assert.equal(intent.providerId, null);
  assert.equal(intent.genreId, null);
});

test("plurals and punctuated platform names still match", () => {
  const intent = assistant.parseAssistantCatalogIntent("Des comédies sur Arte ?");
  assert.equal(intent.genreId, 35);
  assert.equal(intent.providerId, 234);
  assert.equal(assistant.parseAssistantCatalogIntent("des thrillers").genreLabel, "thriller");
  for (const prompt of ["un film de science-fiction", "un film de science fiction", "du sci-fi"]) {
    assert.equal(assistant.parseAssistantCatalogIntent(prompt).genreLabel, "science-fiction", prompt);
  }
  assert.equal(assistant.parseAssistantCatalogIntent("une série Disney+").providerId, 337);
});

test("small talk is not a catalog request", () => {
  assert.equal(assistant.parseAssistantCatalogIntent("Salut, ça va ?"), null);
});
