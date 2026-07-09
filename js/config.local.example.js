// Copy this file to js/config.local.js and replace the placeholder values.
// js/config.local.js is ignored by Git so personal keys stay local.

if (typeof CONFIG !== "undefined") {
  CONFIG.TMDB_API_KEY = "votre_vraie_cle_ici";

  // Optional: backend URL. Use an HTTPS URL for the Android application.
  // Provider keys belong to the backend environment, never in this file.
  // CONFIG.AI_ASSISTANT_API_URL = "https://votre-backend.example.com/api/assistant";

  // Optional: fresher availability source for streaming platforms.
  // "tmdb" (default) | "hybrid" (TMDB + external fallback) | "fresh" (external first)
  // CONFIG.AVAILABILITY_SOURCE = "hybrid";
  // CONFIG.FRESH_AVAILABILITY_URL_TEMPLATE =
  //   "https://votre-backend.example.com/api/availability/{mediaType}/{tmdbId}?country={country}";
}
