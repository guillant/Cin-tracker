/**
 * Local persistence (localStorage). Every read and write goes through here so
 * a full, blocked or corrupted storage never throws into the UI: reads fall
 * back to a default value, writes report failure by returning false.
 * Depends on normalizeCollectionItem from collection.js.
 */

const STORAGE_KEYS = {
  collection: "watchlist",
  theme: "theme",
  viewMode: "viewMode",
  userProviders: "cinetrackerUserProviders",
  groupProfiles: "cinetrackerGroupProfiles",
  activeGroupProfiles: "cinetrackerGroupActiveProfiles",
  suggestionHistory: "cinetrackerSuggestionRecentHistory",
  assistantHistory: "cinetrackerAssistantHistory",
  assistantConsent: "cinetrackerAssistantRemoteConsent",
  tmdbMatchMisses: "cinetrackerTmdbMatchMisses",
};

function readStoredString(key, fallback = null) {
  try {
    const value = localStorage.getItem(key);
    return value === null ? fallback : value;
  } catch {
    return fallback;
  }
}

function writeStoredString(key, value) {
  try {
    localStorage.setItem(key, String(value));
    return true;
  } catch (error) {
    console.warn(`Sauvegarde locale impossible (${key}):`, error);
    return false;
  }
}

function removeStoredValue(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    // Nothing to clean up if storage is unavailable.
  }
}

function readStoredJson(key, fallback) {
  const raw = readStoredString(key);
  if (raw === null) return fallback;
  try {
    return JSON.parse(raw);
  } catch (error) {
    console.warn(`Données locales illisibles (${key}), valeur par défaut utilisée.`, error);
    return fallback;
  }
}

function writeStoredJson(key, value) {
  let serialized;
  try {
    serialized = JSON.stringify(value);
  } catch (error) {
    console.warn(`Sauvegarde locale impossible (${key}):`, error);
    return false;
  }
  return writeStoredString(key, serialized);
}

function loadStoredItems() {
  const storedItems = readStoredJson(STORAGE_KEYS.collection, []);
  if (!Array.isArray(storedItems)) return [];
  return storedItems
    .map((item, index) => normalizeCollectionItem(item, index))
    .filter(Boolean);
}

// localStorage throws when full (quota ~5 MB): the caller decides how to
// warn the user.
function saveStoredItems(items) {
  return writeStoredJson(STORAGE_KEYS.collection, items);
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    STORAGE_KEYS,
    readStoredString,
    writeStoredString,
    removeStoredValue,
    readStoredJson,
    writeStoredJson,
    loadStoredItems,
    saveStoredItems,
  };
}
