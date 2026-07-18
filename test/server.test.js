"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  sanitizeAssistantPayload,
  parseRecommendationIntent,
  buildSmartRecommendationReply,
  searchTmdbCatalog,
  parseToolArguments,
} = require("../server");

test("assistant payload keeps one bounded conversation ending with the user", () => {
  const payload = sanitizeAssistantPayload({
    collection: "x".repeat(13000),
    messages: [
      { role: "system", content: "ignored" },
      { role: "assistant", content: "Bonjour" },
      { role: "user", content: "Une suggestion ?" },
    ],
  });
  assert.equal(payload.collection.length, 12000);
  assert.deepEqual(payload.messages, [
    { role: "assistant", content: "Bonjour" },
    { role: "user", content: "Une suggestion ?" },
  ]);
  assert.deepEqual(payload.collectionItems, []);
});

test("assistant payload sanitizes structured collection items", () => {
  const payload = sanitizeAssistantPayload({
    messages: [{ role: "user", content: "que regarder ?" }],
    collectionItems: [
      {
        title: "  The Thing  ",
        type: "movie",
        status: "towatch",
        genre: "Horreur, Science-fiction",
        platform: "Netflix",
        year: "1982",
        rating: 4.5,
      },
    ],
  });
  assert.equal(payload.collectionItems.length, 1);
  assert.equal(payload.collectionItems[0].title, "The Thing");
  assert.equal(payload.collectionItems[0].type, "movie");
  assert.equal(payload.collectionItems[0].status, "towatch");
  assert.equal(payload.collectionItems[0].rating, 4.5);
});

test("assistant payload rejects a conversation not ending with a user", () => {
  assert.throws(
    () =>
      sanitizeAssistantPayload({
        messages: [{ role: "assistant", content: "Bonjour" }],
      }),
    /final user message/i,
  );
});

test("catalog search fails safely when TMDB is not configured", async () => {
  const previousKey = process.env.TMDB_API_KEY;
  delete process.env.TMDB_API_KEY;
  const result = await searchTmdbCatalog(
    { query: "science fiction", media_type: "movie" },
    undefined,
  );
  assert.deepEqual(result.results, []);
  assert.match(result.error, /TMDB/i);
  if (previousKey) process.env.TMDB_API_KEY = previousKey;
});

test("tool arguments support both OpenAI JSON strings and Ollama objects", () => {
  const args = { query: "", media_type: "movie", genre: "science_fiction" };
  assert.deepEqual(parseToolArguments(JSON.stringify(args)), args);
  assert.deepEqual(parseToolArguments(args), args);
});

test("recommendation intent parser detects genre and platform constraints", () => {
  const intent = parseRecommendationIntent("Que regarder comme thriller sur Netflix ?");
  assert.equal(intent.wantsRecommendation, true);
  assert.equal(intent.genreLabel, "thriller");
  assert.equal(intent.platformLabel, "Netflix");
});

test("recommendation intent parser detects find phrasing", () => {
  const intent = parseRecommendationIntent("Trouve-moi un film sympa");
  assert.equal(intent.wantsRecommendation, true);
  assert.equal(intent.type, "movie");
});

test("recommendation intent parser detects compact genre platform requests", () => {
  const intent = parseRecommendationIntent("film d'action sur netflix");
  assert.equal(intent.wantsRecommendation, true);
  assert.equal(intent.type, "movie");
  assert.equal(intent.genreLabel, "action");
  assert.equal(intent.platformLabel, "Netflix");
});

test("catalog search can discover popular movies without query or genre", async () => {
  const previousKey = process.env.TMDB_API_KEY;
  const previousFetch = global.fetch;
  process.env.TMDB_API_KEY = "test-key";
  global.fetch = async (url) => {
    assert.match(String(url), /\/discover\/movie/);
    return {
      ok: true,
      async json() {
        return {
          results: [
            {
              id: 1,
              title: "Popular Film",
              release_date: "2026-01-01",
              overview: "A popular pick.",
              vote_average: 7.5,
              popularity: 100,
            },
          ],
        };
      },
    };
  };

  try {
    const result = await searchTmdbCatalog(
      { query: "", media_type: "movie" },
      undefined,
    );
    assert.equal(result.results[0].title, "Popular Film");
  } finally {
    global.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.TMDB_API_KEY;
    else process.env.TMDB_API_KEY = previousKey;
  }
});

test("smart recommendation prefers matching items from collection", () => {
  const reply = buildSmartRecommendationReply(
    [{ role: "user", content: "Que regarder comme thriller sur Netflix ce soir ?" }],
    [
      {
        title: "Film A",
        type: "movie",
        status: "towatch",
        genre: "thriller",
        platform: "Netflix",
        year: "2024",
        rating: 4.2,
      },
      {
        title: "Film B",
        type: "movie",
        status: "watched",
        genre: "comedie",
        platform: "Prime Video",
        year: "2021",
        rating: 2,
      },
    ],
  );

  assert.match(reply, /Film A/);
  assert.ok(reply.indexOf("Film A") < reply.indexOf("Film B"));
});
