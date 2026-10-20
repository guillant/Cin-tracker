"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

// storage.js is a classic browser script: it reads localStorage and the
// collection.js helpers as globals, exactly like in index.html.
Object.assign(globalThis, require("../js/collection"));
const storage = require("../js/storage");

// In-memory localStorage; `failWith` makes every access throw, like a full
// quota (setItem) or storage disabled by the browser (all methods).
function installFakeStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  const fake = {
    data,
    failOn: new Set(),
    getItem(key) {
      if (fake.failOn.has("getItem")) throw new Error("SecurityError");
      return data.has(key) ? data.get(key) : null;
    },
    setItem(key, value) {
      if (fake.failOn.has("setItem")) throw new Error("QuotaExceededError");
      data.set(key, String(value));
    },
    removeItem(key) {
      if (fake.failOn.has("removeItem")) throw new Error("SecurityError");
      data.delete(key);
    },
  };
  globalThis.localStorage = fake;
  return fake;
}

// The module warns on bad data; keep the test output readable.
function silenceWarnings() {
  const previous = console.warn;
  console.warn = () => {};
  return () => {
    console.warn = previous;
  };
}

test("JSON values round-trip and missing keys return the fallback", () => {
  const fake = installFakeStorage();
  assert.deepEqual(storage.readStoredJson("missing", ["default"]), ["default"]);

  assert.equal(storage.writeStoredJson("profiles", [{ id: "me" }]), true);
  assert.equal(fake.data.get("profiles"), '[{"id":"me"}]');
  assert.deepEqual(storage.readStoredJson("profiles", []), [{ id: "me" }]);
});

test("corrupted JSON returns the fallback instead of throwing", () => {
  installFakeStorage({ profiles: "{not json" });
  const restore = silenceWarnings();
  try {
    assert.deepEqual(storage.readStoredJson("profiles", []), []);
  } finally {
    restore();
  }
});

test("a full storage makes writes return false instead of throwing", () => {
  const fake = installFakeStorage();
  fake.failOn.add("setItem");
  const restore = silenceWarnings();
  try {
    assert.equal(storage.writeStoredJson("profiles", []), false);
    assert.equal(storage.writeStoredString("theme", "dark"), false);
    assert.equal(storage.saveStoredItems([]), false);
  } finally {
    restore();
  }
});

test("blocked storage reads return the fallback and removal is a no-op", () => {
  const fake = installFakeStorage({ theme: "dark" });
  fake.failOn.add("getItem");
  fake.failOn.add("removeItem");
  assert.equal(storage.readStoredString("theme", "light"), "light");
  assert.deepEqual(storage.readStoredJson("theme", {}), {});
  assert.doesNotThrow(() => storage.removeStoredValue("theme"));
});

test("strings are stored as-is, booleans as text", () => {
  const fake = installFakeStorage();
  storage.writeStoredString(storage.STORAGE_KEYS.assistantConsent, true);
  assert.equal(fake.data.get("cinetrackerAssistantRemoteConsent"), "true");
  assert.equal(storage.readStoredString(storage.STORAGE_KEYS.viewMode, "grid"), "grid");
});

test("the collection keeps its historical key so existing data still loads", () => {
  assert.equal(storage.STORAGE_KEYS.collection, "watchlist");
  installFakeStorage({
    watchlist: JSON.stringify([
      { id: "a", title: "Heat", type: "movie", status: "watched", rating: "4" },
      null,
      "garbage",
    ]),
  });
  const items = storage.loadStoredItems();
  assert.equal(items.length, 1);
  assert.equal(items[0].title, "Heat");
  assert.equal(items[0].rating, 4);
});

test("a collection that is not an array loads as empty", () => {
  installFakeStorage({ watchlist: '{"id":"a"}' });
  assert.deepEqual(storage.loadStoredItems(), []);
});

test("saved collection items load back unchanged", () => {
  installFakeStorage();
  const items = storage.loadStoredItems();
  assert.deepEqual(items, []);
  const item = { id: "b", title: "Dark", type: "series", status: "watching" };
  assert.equal(storage.saveStoredItems([item]), true);
  const [loaded] = storage.loadStoredItems();
  assert.equal(loaded.id, "b");
  assert.equal(loaded.title, "Dark");
  assert.equal(loaded.status, "watching");
});
