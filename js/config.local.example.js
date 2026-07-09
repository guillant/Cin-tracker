// Copy this file to js/config.local.js and replace the placeholder values.
// js/config.local.js is ignored by Git so personal keys stay local.

if (typeof CONFIG !== "undefined") {
  CONFIG.TMDB_API_KEY = "votre_vraie_cle_ici";

  // Optional: enable remote AI assistant replies (kept local only).
  // CONFIG.AI_ASSISTANT_API_KEY = "votre_cle_api_ia";
  // CONFIG.AI_ASSISTANT_MODEL = "gpt-4o-mini";
  // CONFIG.AI_ASSISTANT_API_URL = "https://api.openai.com/v1/chat/completions";

  // Optional: fresher availability source for streaming platforms.
  // "tmdb" (default) | "hybrid" (TMDB + external fallback) | "fresh" (external first)
  // CONFIG.AVAILABILITY_SOURCE = "hybrid";
  // CONFIG.FRESH_AVAILABILITY_URL_TEMPLATE =
  //   "https://votre-proxy.example.com/availability/{mediaType}/{tmdbId}?country={country}";
  // CONFIG.FRESH_AVAILABILITY_API_KEY = "votre_cle_api";
  // CONFIG.FRESH_AVAILABILITY_API_KEY_HEADER = "x-api-key";
}
