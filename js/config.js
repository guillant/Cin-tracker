/**
 * Configuration file for CinéTracker
 * Contains API keys, constants, and application settings
 */

// ===========================================
// TMDB API CONFIGURATION
// ===========================================
// Get your free API key at: https://www.themoviedb.org/settings/api
const CONFIG = {
  TMDB_API_KEY: "f689f7bb5b4da2e7f86f3437a8f5745f",
  TMDB_BASE_URL: "https://api.themoviedb.org/3",
  TMDB_IMAGE_BASE: "https://image.tmdb.org/t/p/w500",
  // Optional AI assistant provider configuration.
  AI_ASSISTANT_API_URL: "https://api.openai.com/v1/chat/completions",
  AI_ASSISTANT_MODEL: "gpt-4o-mini",
  AI_ASSISTANT_API_KEY: "",
  // Availability source: "tmdb" | "hybrid" | "fresh"
  AVAILABILITY_SOURCE: "tmdb",
  // Optional endpoint template for fresher availability provider.
  // Supported placeholders: {mediaType}, {tmdbId}, {country}
  // Example: "https://your-proxy.example.com/availability/{mediaType}/{tmdbId}?country={country}"
  FRESH_AVAILABILITY_URL_TEMPLATE: "",
  // Optional API key/header for the fresher provider.
  FRESH_AVAILABILITY_API_KEY: "",
  FRESH_AVAILABILITY_API_KEY_HEADER: "x-api-key",
};

// ===========================================
// GENRE MAPPINGS
// ===========================================
const GENRE_MAP = {
  movie: {
    28: "Action",
    12: "Aventure",
    16: "Animation",
    35: "Comédie",
    80: "Crime",
    99: "Documentaire",
    18: "Drame",
    10751: "Familial",
    14: "Fantasy",
    36: "Histoire",
    27: "Horreur",
    10402: "Musique",
    9648: "Mystère",
    10749: "Romance",
    878: "Science-Fiction",
    10770: "Téléfilm",
    53: "Thriller",
    10752: "Guerre",
    37: "Western",
  },
  tv: {
    10759: "Action & Aventure",
    16: "Animation",
    35: "Comédie",
    80: "Crime",
    99: "Documentaire",
    18: "Drame",
    10751: "Familial",
    10762: "Kids",
    9648: "Mystère",
    10763: "News",
    10764: "Reality",
    10765: "Science-Fiction & Fantasy",
    10766: "Soap",
    10767: "Talk",
    10768: "War & Politics",
    37: "Western",
  },
};

// ===========================================
// APPLICATION CONSTANTS
// ===========================================
const CONSTANTS = {
  STORAGE_KEY: "watchlist",
  DEFAULT_EPISODES_PER_SEASON: 24,
  MOVIE_AVERAGE_DURATION: 120, // minutes
  EPISODE_AVERAGE_DURATION: 45, // minutes
};

// Export for use in other modules
if (typeof module !== "undefined" && module.exports) {
  module.exports = { CONFIG, GENRE_MAP, CONSTANTS };
}
