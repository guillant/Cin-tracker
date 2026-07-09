"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  sanitizeAssistantPayload,
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
