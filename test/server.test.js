"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { sanitizeAssistantPayload } = require("../server");

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
