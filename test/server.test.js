"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const {
  requestHandler,
  isPublicStaticPath,
  isRateLimited,
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

test("static allowlist only exposes app assets", () => {
  assert.equal(isPublicStaticPath("index.html"), true);
  assert.equal(isPublicStaticPath("js/app.js"), true);
  assert.equal(isPublicStaticPath("assets/icon-192.svg"), true);
  assert.equal(isPublicStaticPath(".env"), false);
  assert.equal(isPublicStaticPath(".git/config"), false);
  assert.equal(isPublicStaticPath("server.js"), false);
  assert.equal(isPublicStaticPath("package.json"), false);
  assert.equal(isPublicStaticPath("js/.hidden"), false);
});

test("static server refuses private files and malformed paths", async () => {
  const server = http.createServer(requestHandler);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const expectations = {
      "/": 200,
      "/js/app.js": 200,
      "/.env": 404,
      "/.env.example": 404,
      "/.git/config": 404,
      "/server.js": 404,
      "/js/..%2Fserver.js": 404,
      "/js/..%5Cserver.js": 404,
      "/%E0%A4%A": 400,
    };
    for (const [pathname, expectedStatus] of Object.entries(expectations)) {
      const response = await fetch(`${base}${pathname}`);
      await response.arrayBuffer();
      assert.equal(response.status, expectedStatus, pathname);
    }
  } finally {
    server.close();
  }
});

test("rate limiter blocks a client after the per-minute quota", () => {
  const now = 1_000_000;
  let limited = false;
  for (let index = 0; index < 20; index++) {
    limited = isRateLimited("test-client", now);
    assert.equal(limited, false);
  }
  assert.equal(isRateLimited("test-client", now), true);
  assert.equal(isRateLimited("other-client", now), false);
  assert.equal(isRateLimited("test-client", now + 61_000), false);
});
