/**
 * CinéTracker - Application JavaScript complète
 * Contient toute la logique de l'application
 *
 * Configuration API: Voir js/config.js
 */

// Utilisation des constantes depuis config.js
const TMDB_API_KEY = CONFIG.TMDB_API_KEY;
const TMDB_BASE_URL = CONFIG.TMDB_BASE_URL;
const TMDB_IMAGE_BASE = CONFIG.TMDB_IMAGE_BASE;
const TMDB_WATCH_REGION = "FR";
const TMDB_IMAGE_LANGUAGE_PREFERENCE = "fr,null,en";
const TMDB_MOVIE_LOCALIZATION_VERSION = 1;
const WATCH_PROVIDER_GROUP_ORDER = ["flatrate", "free", "ads", "rent", "buy"];
const WATCH_PROVIDER_INCLUDED_GROUPS = new Set(["flatrate", "free", "ads"]);
const WATCH_PROVIDER_PRIORITY_VERSION = 2;
const HIDDEN_SYSTEM_TAGS = new Set(["Letterboxd"]);
const STREAMING_PROVIDER_PRIORITY = [
  "netflix",
  "max",
  "disney+",
  "prime-video",
  "canal+",
  "apple-tv+",
  "ocs",
  "paramount+",
  "universal+",
  "crunchyroll",
  "mubi",
  "arte",
  "france-tv",
  "tf1+",
  "6play",
  "sfr-play",
];
const USER_PROVIDERS_STORAGE_KEY = "cinetrackerUserProviders";
const GROUP_PROFILES_STORAGE_KEY = "cinetrackerGroupProfiles";
const GROUP_ACTIVE_PROFILES_STORAGE_KEY = "cinetrackerGroupActiveProfiles";
const SUGGESTION_RECENT_HISTORY_STORAGE_KEY = "cinetrackerSuggestionRecentHistory";
const SUGGESTION_RECENT_HISTORY_LIMIT = 8;
const SUGGESTION_PROVIDER_CACHE_VERSION = 3;
const USER_PROVIDER_OPTIONS = [
  { key: "netflix", label: "Netflix", tmdbId: 8 },
  { key: "prime-video", label: "Prime Video", tmdbId: 119 },
  { key: "disney+", label: "Disney+", tmdbId: 337 },
  { key: "canal+", label: "Canal+", tmdbId: 381 },
  { key: "apple-tv+", label: "Apple TV+", tmdbId: 350 },
  { key: "arte", label: "Arte", tmdbId: 234 },
  { key: "france-tv", label: "France.tv", tmdbId: 190 },
  { key: "max", label: "Max", tmdbId: 1899 },
  { key: "paramount+", label: "Paramount+", tmdbId: 531 },
  { key: "crunchyroll", label: "Crunchyroll", tmdbId: 283 },
  { key: "mubi", label: "MUBI", tmdbId: 11 },
];
const GROUP_GENRE_OPTIONS = [
  { key: "comedy", label: "Comedie", terms: ["comedie", "comedy"] },
  { key: "drama", label: "Drame", terms: ["drame", "drama"] },
  { key: "horror", label: "Horreur", terms: ["horreur", "horror"] },
  { key: "thriller", label: "Thriller", terms: ["thriller"] },
  { key: "action", label: "Action", terms: ["action"] },
  { key: "romance", label: "Romance", terms: ["romance"] },
  { key: "animation", label: "Animation", terms: ["animation"] },
  { key: "family", label: "Famille", terms: ["familial", "family"] },
  { key: "documentary", label: "Docu", terms: ["documentaire", "documentary"] },
  {
    key: "scifi",
    label: "Science-fiction",
    terms: ["science-fiction", "sci-fi"],
  },
];

const STATUS_LABELS = {
  watched: "Vu",
  watching: "En cours",
  towatch: "À voir",
  paused: "En pause",
  waiting: "Attente saison",
  dropped: "Abandonné",
};

const DEFAULT_ITEM_STATUS = "towatch";

function normalizeStatusValue(status) {
  const raw = String(status || "")
    .toLowerCase()
    .trim();
  return Object.prototype.hasOwnProperty.call(STATUS_LABELS, raw)
    ? raw
    : DEFAULT_ITEM_STATUS;
}

function getStatusLabel(status) {
  return STATUS_LABELS[normalizeStatusValue(status)] || STATUS_LABELS.towatch;
}

function normalizeCollectionItem(item, index = 0) {
  if (!item || typeof item !== "object") return null;

  const normalized = {
    ...item,
    id: String(item.id || `item-${Date.now()}-${index}`),
    title: String(item.title || "")
      .trim()
      .slice(0, 300),
    type: item.type === "series" ? "series" : "movie",
    status: normalizeStatusValue(item.status),
    year: String(item.year || "")
      .trim()
      .slice(0, 16),
    genre: String(item.genre || "")
      .trim()
      .slice(0, 400),
    notes: String(item.notes || ""),
    posterUrl: typeof item.posterUrl === "string" ? item.posterUrl : "",
    tags: Array.isArray(item.tags)
      ? item.tags
          .map((tag) => String(tag || "").trim())
          .filter(Boolean)
          .slice(0, 50)
      : [],
  };

  if (!normalized.title) return null;
  return normalized;
}

const FORCED_TMDB_MOVIE_MATCHES = [
  {
    tmdbId: 1152014,
    year: "2024",
    aliases: ["A Little Something Extra", "Un p'tit truc en plus"],
    fallbackTitle: "Un p'tit truc en plus",
    fallbackPosterUrl:
      "https://media.themoviedb.org/t/p/w500/uIlJ1wOlEt5K3NowJQDG4qscQAC.jpg",
  },
  {
    tmdbId: 1084736,
    year: "2024",
    aliases: ["The Count of Monte Cristo", "Le Comte de Monte-Cristo"],
    fallbackTitle: "Le Comte de Monte-Cristo",
    fallbackPosterUrl:
      "https://media.themoviedb.org/t/p/w500/g7kiprYdXxaYCZABWQwTWAgRYjl.jpg",
  },
  {
    tmdbId: 1145164,
    year: "2022",
    aliases: ["Masquerades of Research"],
    fallbackTitle: "Masquerades of Research",
    fallbackPosterUrl:
      "https://media.themoviedb.org/t/p/w500/zV6JLcq4tbcbfKBX56a5DYrbzo8.jpg",
  },
  {
    tmdbId: 1628532,
    year: "2026",
    aliases: ["The Penguin"],
    fallbackTitle: "The Penguin",
    fallbackPosterUrl:
      "https://media.themoviedb.org/t/p/w188_and_h282_face/dZAMyBj3K71D2P1r3E4yesOgf1d.jpg",
  },
  {
    tmdbId: 1641813,
    year: "2023",
    aliases: ["Beating Hearts"],
    fallbackTitle: "Beating Hearts",
    fallbackPosterUrl:
      "https://media.themoviedb.org/t/p/w188_and_h282_face/rN38Pf2GQFvuqX5kaocF50F9S4h.jpg",
  },
  {
    tmdbId: 659959,
    year: "2020",
    aliases: ["Summer of '85", "Summer of 85", "Été 85"],
    fallbackTitle: "Été 85",
    fallbackPosterUrl:
      "https://media.themoviedb.org/t/p/w188_and_h282_face/x8TN36iSbeObyOEdmrHO9gnjfZG.jpg",
    ignoreYear: true,
  },
];

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function inlineJsString(value) {
  return escapeHtml(JSON.stringify(String(value ?? "")));
}

function parseItemDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date;
}

function slugifyImportPart(value) {
  return (
    String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "item"
  );
}

function getImportTitleYearKey(item) {
  const type = item?.type || "movie";
  const title = slugifyImportPart(item?.title);
  const year = String(item?.year || "").trim() || "na";
  return `${type}:${title}:${year}`;
}

function getImportComparisonKey(item) {
  const type = item?.type || "movie";
  if (item?.tmdbId) return `${type}:tmdb:${item.tmdbId}`;
  return getImportTitleYearKey(item);
}

function normalizeCsvHeader(header) {
  return String(header || "")
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function parseCsvText(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    const nextChar = text[index + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        field += '"';
        index++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(field);
      field = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && nextChar === "\n") index++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      continue;
    }

    field += char;
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  const normalizedRows = rows.filter((currentRow) =>
    currentRow.some((cell) => String(cell || "").trim() !== ""),
  );

  if (!normalizedRows.length) return [];

  const headers = normalizedRows[0].map((header) => normalizeCsvHeader(header));
  return normalizedRows.slice(1).map((values) => {
    const entry = {};
    headers.forEach((header, headerIndex) => {
      if (!header) return;
      entry[header] = String(values[headerIndex] || "").trim();
    });
    return entry;
  });
}

function getCsvValue(row, keys) {
  for (const key of keys) {
    if (row[key]) return row[key];
  }
  return "";
}

function parseImportDateToIso(value) {
  const rawValue = String(value || "").trim();
  if (!rawValue) return null;

  const isoMatch = rawValue.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return new Date(
      Date.UTC(Number(year), Number(month) - 1, Number(day), 12),
    ).toISOString();
  }

  const frMatch = rawValue.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (frMatch) {
    const [, day, month, year] = frMatch;
    return new Date(
      Date.UTC(Number(year), Number(month) - 1, Number(day), 12),
    ).toISOString();
  }

  const parsed = new Date(rawValue);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function parseLetterboxdRating(value) {
  const rawValue = String(value || "").trim();
  if (!rawValue) return null;

  const normalizedValue = rawValue.replace(",", ".");
  if (/^\d(?:\.5)?$/.test(normalizedValue)) {
    return Math.max(0, Math.min(5, Number.parseFloat(normalizedValue)));
  }

  if (/^[★☆½]+$/.test(rawValue)) {
    let score = 0;
    for (const char of rawValue) {
      if (char === "★") score += 1;
      if (char === "½") score += 0.5;
    }
    return score > 0 ? score : null;
  }

  return null;
}

function getLetterboxdFileInfo(fileName = "") {
  const baseName = String(fileName || "")
    .replace(/\.[^.]+$/, "")
    .trim();
  const normalized = baseName.toLowerCase();

  const knownKinds = {
    watchlist: "watchlist",
    watched: "watched",
    ratings: "ratings",
    diary: "diary",
    reviews: "reviews",
  };

  const kind = knownKinds[normalized] || "list";
  const cleanedLabel = baseName
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const listLabel =
    kind === "list" && cleanedLabel
      ? cleanedLabel.replace(/\b\w/g, (char) => char.toUpperCase())
      : null;

  return {
    kind,
    listLabel,
  };
}

function parseLetterboxdCsv(text, fileName = "") {
  const rows = parseCsvText(text);
  if (!rows.length) {
    throw new Error("CSV vide");
  }

  const sample = rows[0];
  const looksLikeLetterboxd =
    "letterboxduri" in sample ||
    (("name" in sample || "title" in sample) && "year" in sample);

  if (!looksLikeLetterboxd) {
    throw new Error("CSV non reconnu");
  }

  const fileInfo = getLetterboxdFileInfo(fileName);
  const isWatchlistFile = fileInfo.kind === "watchlist";
  const importedMap = new Map();

  rows.forEach((row, index) => {
    const title = getCsvValue(row, ["name", "title", "film"]).trim();
    const year = getCsvValue(row, ["year", "releaseyear"]).trim();
    if (!title) return;

    const watchedAt = parseImportDateToIso(
      getCsvValue(row, ["watcheddate", "date", "diarydate", "viewingdate"]),
    );
    const rating = parseLetterboxdRating(
      getCsvValue(row, ["rating", "yourrating"]),
    );
    const letterboxdUri = getCsvValue(row, ["letterboxduri", "uri"]);
    const status = isWatchlistFile
      ? "towatch"
      : watchedAt || rating !== null
        ? "watched"
        : "towatch";
    const dateAdded = watchedAt || new Date().toISOString();
    const key = `${slugifyImportPart(title)}:${year || "na"}`;
    const importTags = [];

    const nextItem = {
      id: `letterboxd-${key}-${index}`,
      title,
      type: "movie",
      year,
      releaseDate: /^\d{4}$/.test(year) ? `${year}-01-01` : null,
      status,
      rating,
      genre: "",
      notes: "",
      posterUrl: "",
      tmdbId: null,
      providerLogo: null,
      providerName: null,
      providerAccessType: null,
      providerPriorityVersion: 0,
      tags: importTags,
      currentSeason: null,
      currentEpisode: null,
      seasonData: null,
      totalEpisodes: null,
      dateAdded,
      watchedAt: status === "watched" ? watchedAt || dateAdded : null,
      tmdbRating: null,
      letterboxdUri,
    };

    const existingItem = importedMap.get(key);
    if (!existingItem) {
      importedMap.set(key, nextItem);
      return;
    }

    if (
      nextItem.watchedAt &&
      (!existingItem.watchedAt || nextItem.watchedAt > existingItem.watchedAt)
    ) {
      existingItem.watchedAt = nextItem.watchedAt;
      existingItem.dateAdded = nextItem.watchedAt;
      existingItem.status = "watched";
    }

    if (nextItem.rating !== null) {
      existingItem.rating = nextItem.rating;
    }

    existingItem.tags = [
      ...new Set([...(existingItem.tags || []), ...importTags]),
    ];

    if (!existingItem.letterboxdUri && nextItem.letterboxdUri) {
      existingItem.letterboxdUri = nextItem.letterboxdUri;
    }
  });

  const importedItems = [...importedMap.values()].sort(
    (left, right) =>
      new Date(right.watchedAt || right.dateAdded) -
      new Date(left.watchedAt || left.dateAdded),
  );

  if (!importedItems.length) {
    throw new Error("Aucun film importable trouvé dans ce CSV");
  }

  return importedItems;
}

function normalizeTitleForMatch(value) {
  return slugifyImportPart(value).replace(/-/g, " ").trim();
}

function getMovieTitleSearchVariants(title) {
  const rawTitle = String(title || "")
    .replace(/\s+/g, " ")
    .trim();

  if (!rawTitle) return [];

  const variants = new Set([rawTitle]);
  const queue = [rawTitle];
  const separators = [":", " - ", " – ", " — ", " / "];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) continue;

    const withoutParens = current.replace(/\s*\([^)]*\)\s*/g, " ").trim();
    if (withoutParens && !variants.has(withoutParens)) {
      variants.add(withoutParens);
      queue.push(withoutParens);
    }

    separators.forEach((separator) => {
      if (!current.includes(separator)) return;
      const head = current.split(separator)[0].trim();
      if (head.length >= 2 && !variants.has(head)) {
        variants.add(head);
        queue.push(head);
      }
    });

    const andVariant = current.replace(/\s*&\s*/g, " and ").trim();
    if (andVariant && !variants.has(andVariant)) {
      variants.add(andVariant);
      queue.push(andVariant);
    }

    const ampVariant = current.replace(/\sand\s/gi, " & ").trim();
    if (ampVariant && !variants.has(ampVariant)) {
      variants.add(ampVariant);
      queue.push(ampVariant);
    }
  }

  return [...variants].filter(Boolean).slice(0, 8);
}

function getMovieTitleMatchScore(leftTitle, rightTitle) {
  const left = normalizeTitleForMatch(leftTitle);
  const right = normalizeTitleForMatch(rightTitle);

  if (!left || !right) return 0;
  if (left === right) return 120;
  if (left.startsWith(right) || right.startsWith(left)) return 78;
  if (left.includes(right) || right.includes(left)) return 56;

  const leftTokens = new Set(left.split(/\s+/).filter(Boolean));
  const rightTokens = new Set(right.split(/\s+/).filter(Boolean));
  const sharedTokens = [...leftTokens].filter((token) =>
    rightTokens.has(token),
  );
  if (!sharedTokens.length) return 0;

  return Math.round(
    (sharedTokens.length / Math.max(leftTokens.size, rightTokens.size)) * 52,
  );
}

function getMovieYearMatchScore(leftYear, rightYear) {
  const left = Number.parseInt(String(leftYear || "").trim(), 10);
  const right = Number.parseInt(String(rightYear || "").trim(), 10);

  if (!Number.isFinite(left) || !Number.isFinite(right)) return 0;

  const diff = Math.abs(left - right);
  if (diff === 0) return 34;
  if (diff === 1) return 20;
  if (diff === 2) return 8;
  return -Math.min(diff * 4, 20);
}

function getForcedTmdbMovieMatch(item) {
  if (!item || item.type !== "movie") return null;

  const itemYear = String(item.year || "").trim();
  const normalizedTitle = normalizeTitleForMatch(item.title || "");
  if (!normalizedTitle) return null;

  return (
    FORCED_TMDB_MOVIE_MATCHES.find((entry) => {
      if (
        !entry.ignoreYear &&
        entry.year &&
        itemYear &&
        entry.year !== itemYear
      ) {
        return false;
      }
      return entry.aliases.some(
        (alias) => normalizeTitleForMatch(alias) === normalizedTitle,
      );
    }) || null
  );
}

function shouldForceMovieTmdbOverride(item) {
  const forcedMatch = getForcedTmdbMovieMatch(item);
  if (!forcedMatch) return false;

  return String(item.tmdbId || "") !== String(forcedMatch.tmdbId);
}

function findExistingMovieMergeCandidateIndex(itemList, targetItem) {
  if (!Array.isArray(itemList) || !targetItem || targetItem.type !== "movie") {
    return undefined;
  }

  const targetVariants = getMovieTitleSearchVariants(targetItem.title);
  let bestIndex;
  let bestScore = -Infinity;

  itemList.forEach((candidate, index) => {
    if (!candidate || candidate === targetItem || candidate.type !== "movie")
      return;

    const candidateVariants = getMovieTitleSearchVariants(candidate.title);
    let titleScore = 0;

    targetVariants.forEach((leftTitle) => {
      candidateVariants.forEach((rightTitle) => {
        titleScore = Math.max(
          titleScore,
          getMovieTitleMatchScore(leftTitle, rightTitle),
        );
      });
    });

    if (titleScore < 56) return;

    let score =
      titleScore + getMovieYearMatchScore(targetItem.year, candidate.year);
    if (candidate.tmdbId) score += 22;
    if (candidate.posterUrl) score += 8;
    if (candidate.genre) score += 4;
    if (!targetItem.tmdbId && candidate.id === targetItem.id) score -= 100;

    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  });

  return bestScore >= 84 ? bestIndex : undefined;
}

function isLikelyLetterboxdImportedMovie(item) {
  return (
    item?.type === "movie" &&
    (String(item?.id || "").startsWith("letterboxd-") ||
      Boolean(item?.letterboxdUri) ||
      (Array.isArray(item?.tags) && item.tags.includes("Letterboxd")))
  );
}

function shouldAttemptMovieAutoRepair(item) {
  if (!item || item.type !== "movie" || !String(item.title || "").trim()) {
    return false;
  }

  if (getForcedTmdbMovieMatch(item)) return true;
  if (isLikelyLetterboxdImportedMovie(item)) return true;

  const missingCoreTmdbData = !item.tmdbId || !item.posterUrl;
  const sparseMetadata = !item.genre || !item.year || !item.releaseDate;
  const hasImportLikeSignals =
    item.rating !== null ||
    Boolean(item.watchedAt) ||
    Boolean(item.dateAdded) ||
    Array.isArray(item.tags);

  return missingCoreTmdbData && sparseMetadata && hasImportLikeSignals;
}

function scoreMovieMatch(candidate, wantedTitle, wantedYear) {
  const wantedVariants = getMovieTitleSearchVariants(wantedTitle);
  const candidateVariants = getMovieTitleSearchVariants(candidate.title || "");
  const originalTitleVariants = getMovieTitleSearchVariants(
    candidate.original_title || "",
  );
  const candidateYear = String(candidate.release_date || "").slice(0, 4);

  let score = 0;
  wantedVariants.forEach((wantedVariant) => {
    candidateVariants.forEach((candidateVariant) => {
      score = Math.max(
        score,
        getMovieTitleMatchScore(candidateVariant, wantedVariant),
      );
    });
    originalTitleVariants.forEach((originalVariant) => {
      score = Math.max(
        score,
        getMovieTitleMatchScore(originalVariant, wantedVariant),
      );
    });
  });

  score += getMovieYearMatchScore(wantedYear, candidateYear);

  if (candidate.poster_path) score += 10;
  if (candidate.backdrop_path) score += 4;
  score += Math.min((candidate.vote_count || 0) / 150, 10);
  score += Math.min((candidate.popularity || 0) / 10, 8);
  return score;
}

async function fetchTmdbMovieDetails(tmdbId) {
  if (!tmdbId || TMDB_API_KEY === "VOTRE_CLE_API_ICI") return null;

  const urls = [
    `${TMDB_BASE_URL}/movie/${tmdbId}?api_key=${TMDB_API_KEY}&language=fr-FR&append_to_response=images&include_image_language=${encodeURIComponent(TMDB_IMAGE_LANGUAGE_PREFERENCE)}`,
    `${TMDB_BASE_URL}/movie/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=images&include_image_language=${encodeURIComponent(TMDB_IMAGE_LANGUAGE_PREFERENCE)}`,
  ];

  for (const url of urls) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      return await res.json();
    } catch (error) {
      console.error("Erreur détail TMDB import:", error);
    }
  }

  return null;
}

function getPreferredTmdbPosterPath(tmdbDetails) {
  const posters = Array.isArray(tmdbDetails?.images?.posters)
    ? tmdbDetails.images.posters
    : [];

  const preferredPoster =
    posters.find((poster) => poster?.iso_639_1 === "fr") ||
    posters.find((poster) => poster?.iso_639_1 === null) ||
    posters.find((poster) => poster?.iso_639_1 === "en") ||
    posters[0];

  return preferredPoster?.file_path || tmdbDetails?.poster_path || null;
}

function shouldPreferImportedMovieMetadata(existingItem, importedItem) {
  if (!existingItem || !importedItem || existingItem.type !== "movie") {
    return false;
  }

  const existingLocalizationVersion = existingItem.tmdbLocalizationVersion || 0;
  const importedLocalizationVersion = importedItem.tmdbLocalizationVersion || 0;

  return (
    Boolean(importedItem.tmdbId) &&
    (!existingItem.tmdbId ||
      existingItem.tmdbId === importedItem.tmdbId ||
      importedLocalizationVersion > existingLocalizationVersion ||
      isLikelyLetterboxdImportedMovie(existingItem))
  );
}

async function hydrateMovieItemFromTmdb(item, tmdbId, statusOverride = null) {
  if (!item || !tmdbId || TMDB_API_KEY === "VOTRE_CLE_API_ICI") return item;

  const tmdbDetails = await fetchTmdbMovieDetails(tmdbId);
  const forcedMatch = getForcedTmdbMovieMatch(item);
  if (!tmdbDetails) {
    if (!forcedMatch) return item;

    return {
      ...item,
      tmdbId,
      title: forcedMatch.fallbackTitle || item.title,
      year: forcedMatch.year || item.year,
      posterUrl: item.posterUrl || forcedMatch.fallbackPosterUrl || "",
      tmdbLocalizationVersion: TMDB_MOVIE_LOCALIZATION_VERSION,
    };
  }

  const preferredPosterPath = getPreferredTmdbPosterPath(tmdbDetails);

  let provider = null;
  try {
    const watchProviders = await fetchWatchProviders("movie", tmdbId);
    provider = getPrimaryWatchProvider(watchProviders, {
      includedOnly: true,
    });
  } catch (error) {
    console.error("Erreur providers hydrate import:", error);
  }

  const hydratedItem = buildCollectionItemFromTrending(
    {
      ...tmdbDetails,
      media_type: "movie",
      poster_path: preferredPosterPath || tmdbDetails.poster_path,
    },
    "movie",
    provider,
    statusOverride || item.status || "towatch",
  );

  return {
    ...hydratedItem,
    id: item.id,
    title: hydratedItem.title || forcedMatch?.fallbackTitle || item.title,
    year: hydratedItem.year || item.year,
    releaseDate: hydratedItem.releaseDate || item.releaseDate || null,
    posterUrl: hydratedItem.posterUrl || item.posterUrl || "",
    rating: item.rating ?? hydratedItem.rating ?? null,
    notes: item.notes || "",
    tags: [...new Set([...(hydratedItem.tags || []), ...(item.tags || [])])],
    dateAdded: item.dateAdded || hydratedItem.dateAdded,
    watchedAt:
      item.watchedAt ||
      (item.status === "watched" ? hydratedItem.watchedAt : null),
    status: item.status || statusOverride || hydratedItem.status,
    letterboxdUri: item.letterboxdUri || "",
    tmdbLocalizationVersion: TMDB_MOVIE_LOCALIZATION_VERSION,
  };
}

async function findTmdbMovieMatch(title, year) {
  if (!title || TMDB_API_KEY === "VOTRE_CLE_API_ICI") return null;

  const normalizedYear = /^\d{4}$/.test(String(year || "").trim())
    ? String(year).trim()
    : "";
  const rankedCandidates = new Map();
  const titleVariants = getMovieTitleSearchVariants(title);

  try {
    for (const variant of titleVariants) {
      const urls = [
        `${TMDB_BASE_URL}/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(variant)}&language=fr-FR&include_adult=false${normalizedYear ? `&primary_release_year=${encodeURIComponent(normalizedYear)}` : ""}`,
        `${TMDB_BASE_URL}/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(variant)}&language=fr-FR&include_adult=false`,
        `${TMDB_BASE_URL}/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(variant)}&include_adult=false`,
      ];

      for (const url of urls) {
        const res = await fetch(url);
        if (!res.ok) continue;

        const data = await res.json();
        const results = Array.isArray(data.results)
          ? data.results.slice(0, 12)
          : [];

        results.forEach((candidate) => {
          const score = scoreMovieMatch(candidate, title, year);
          const existingEntry = rankedCandidates.get(candidate.id);

          if (!existingEntry || score > existingEntry.score) {
            rankedCandidates.set(candidate.id, { candidate, score });
          }
        });

        const exactishMatch = [...rankedCandidates.values()].sort(
          (left, right) => right.score - left.score,
        )[0];

        if (exactishMatch && exactishMatch.score >= 72) {
          return exactishMatch.candidate;
        }
      }
    }

    const bestMatch = [...rankedCandidates.values()].sort(
      (left, right) => right.score - left.score,
    )[0];
    if (!bestMatch || bestMatch.score < 48) return null;
    return bestMatch.candidate;
  } catch (error) {
    console.error("Erreur recherche TMDB import:", error);
    return null;
  }
}

function mergeImportedIntoExistingItem(existingItem, importedItem) {
  const preferImportedMovieMetadata = shouldPreferImportedMovieMetadata(
    existingItem,
    importedItem,
  );
  const mergedTags = [
    ...new Set([...(existingItem.tags || []), ...(importedItem.tags || [])]),
  ];
  const existingStatus = normalizeStatusValue(existingItem.status);
  const importedStatus = normalizeStatusValue(importedItem.status);
  const mergedStatus =
    importedStatus === "watched"
      ? "watched"
      : existingStatus === "watched"
        ? "watched"
        : importedStatus || existingStatus;

  return {
    ...existingItem,
    title: preferImportedMovieMetadata
      ? importedItem.title || existingItem.title
      : existingItem.title || importedItem.title,
    year: preferImportedMovieMetadata
      ? importedItem.year || existingItem.year
      : existingItem.year || importedItem.year,
    releaseDate: preferImportedMovieMetadata
      ? importedItem.releaseDate || existingItem.releaseDate
      : existingItem.releaseDate || importedItem.releaseDate,
    posterUrl: preferImportedMovieMetadata
      ? importedItem.posterUrl || existingItem.posterUrl
      : existingItem.posterUrl || importedItem.posterUrl,
    tmdbId: preferImportedMovieMetadata
      ? importedItem.tmdbId || existingItem.tmdbId || null
      : existingItem.tmdbId || importedItem.tmdbId || null,
    providerLogo: preferImportedMovieMetadata
      ? importedItem.providerLogo || existingItem.providerLogo || null
      : existingItem.providerLogo || importedItem.providerLogo || null,
    providerName: preferImportedMovieMetadata
      ? importedItem.providerName || existingItem.providerName || null
      : existingItem.providerName || importedItem.providerName || null,
    providerAccessType: preferImportedMovieMetadata
      ? importedItem.providerAccessType ||
        existingItem.providerAccessType ||
        null
      : existingItem.providerAccessType ||
        importedItem.providerAccessType ||
        null,
    genre: preferImportedMovieMetadata
      ? importedItem.genre || existingItem.genre || ""
      : existingItem.genre || importedItem.genre || "",
    tmdbRating: preferImportedMovieMetadata
      ? importedItem.tmdbRating || existingItem.tmdbRating || null
      : existingItem.tmdbRating || importedItem.tmdbRating || null,
    rating: importedItem.rating ?? existingItem.rating ?? null,
    notes: existingItem.notes || importedItem.notes || "",
    tags: mergedTags,
    status: mergedStatus,
    watchedAt:
      importedItem.watchedAt ||
      existingItem.watchedAt ||
      (mergedStatus === "watched" ? new Date().toISOString() : null),
    dateAdded:
      existingItem.dateAdded ||
      importedItem.dateAdded ||
      new Date().toISOString(),
    letterboxdUri:
      existingItem.letterboxdUri || importedItem.letterboxdUri || "",
    tmdbLocalizationVersion: Math.max(
      existingItem.tmdbLocalizationVersion || 0,
      importedItem.tmdbLocalizationVersion || 0,
    ),
  };
}

async function enrichImportedMovieItem(item) {
  if (item.type !== "movie" || TMDB_API_KEY === "VOTRE_CLE_API_ICI") {
    return item;
  }

  const forcedMatch = getForcedTmdbMovieMatch(item);
  if (forcedMatch && shouldForceMovieTmdbOverride(item)) {
    return hydrateMovieItemFromTmdb(
      item,
      forcedMatch.tmdbId,
      item.status || "towatch",
    );
  }

  if (item.tmdbId) {
    const needsHydration =
      !item.posterUrl ||
      !item.genre ||
      !item.year ||
      !item.releaseDate ||
      (isLikelyLetterboxdImportedMovie(item) &&
        (item.tmdbLocalizationVersion || 0) < TMDB_MOVIE_LOCALIZATION_VERSION);
    return needsHydration
      ? hydrateMovieItemFromTmdb(item, item.tmdbId, item.status || "towatch")
      : item;
  }

  const tmdbMatch = await findTmdbMovieMatch(item.title, item.year);
  if (!tmdbMatch) return item;

  return hydrateMovieItemFromTmdb(item, tmdbMatch.id, item.status || "towatch");
}

async function enrichImportedItems(itemsToEnrich) {
  if (!Array.isArray(itemsToEnrich) || itemsToEnrich.length === 0) {
    return { items: [], matchedCount: 0 };
  }

  const results = [];
  let matchedCount = 0;
  const batchSize = 4;

  for (let index = 0; index < itemsToEnrich.length; index += batchSize) {
    const batch = itemsToEnrich.slice(index, index + batchSize);
    const enrichedBatch = await Promise.all(
      batch.map(async (item) => {
        const enrichedItem = await enrichImportedMovieItem(item);
        if (enrichedItem.tmdbId) matchedCount++;
        return enrichedItem;
      }),
    );
    results.push(...enrichedBatch);
  }

  return { items: results, matchedCount };
}

let letterboxdRepairAttempted = false;

async function repairExistingLetterboxdImports() {
  if (letterboxdRepairAttempted) return;
  letterboxdRepairAttempted = true;

  if (TMDB_API_KEY === "VOTRE_CLE_API_ICI") return;

  const unresolvedItems = items.filter(
    (item) =>
      shouldAttemptMovieAutoRepair(item) &&
      (!item.tmdbId ||
        !item.posterUrl ||
        !item.genre ||
        !item.year ||
        !item.releaseDate ||
        (item.tmdbId &&
          isLikelyLetterboxdImportedMovie(item) &&
          (item.tmdbLocalizationVersion || 0) <
            TMDB_MOVIE_LOCALIZATION_VERSION)),
  );

  if (!unresolvedItems.length) return;

  const { items: repairedItems, matchedCount } =
    await enrichImportedItems(unresolvedItems);
  if (!matchedCount) return;

  const itemsById = new Map(items.map((item) => [item.id, item]));
  repairedItems.forEach((item) => {
    itemsById.set(item.id, item);
  });

  let nextItems = [...itemsById.values()];
  const canonicalMap = new Map();

  nextItems.forEach((item) => {
    const key = getImportComparisonKey(item);
    const fallbackKey = getImportTitleYearKey(item);
    const existingIndex =
      canonicalMap.get(key) ??
      canonicalMap.get(fallbackKey) ??
      findExistingMovieMergeCandidateIndex(nextItems, item);

    if (existingIndex === undefined) {
      canonicalMap.set(key, nextItems.indexOf(item));
      canonicalMap.set(fallbackKey, nextItems.indexOf(item));
      return;
    }

    nextItems[existingIndex] = mergeImportedIntoExistingItem(
      nextItems[existingIndex],
      item,
    );
    const mergedItem = nextItems[existingIndex];
    canonicalMap.set(getImportComparisonKey(mergedItem), existingIndex);
    canonicalMap.set(getImportTitleYearKey(mergedItem), existingIndex);
    item.__remove = true;
  });

  nextItems = nextItems.filter((item) => !item.__remove);
  if (!nextItems.length) return;

  items = nextItems;
  localStorage.setItem("watchlist", JSON.stringify(items));
  renderItems();
  showToast(`${matchedCount} fiches Letterboxd réparées`);
}

function isUpcomingMovieItem(item) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const releaseDate = parseItemDate(item.releaseDate);
  if (releaseDate) return releaseDate > today;

  const year = parseInt(item.year, 10);
  return Number.isFinite(year) && year > today.getFullYear();
}

function isSeriesReleased(item) {
  if (!item || item.type !== "series") return true;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const firstAirDate = parseItemDate(item.releaseDate);
  if (firstAirDate) return firstAirDate <= today;

  const year = parseInt(item.year, 10);
  if (Number.isFinite(year)) return year <= today.getFullYear();

  return true;
}

function formatFutureDistanceLabel(targetDate, fromDate) {
  const diffDays = Math.round((targetDate - fromDate) / 86400000);
  if (diffDays <= 1) return diffDays === 0 ? "Aujourd'hui" : "Demain";
  if (diffDays < 30) return `${diffDays} jours`;

  const diffMonths = Math.round(diffDays / 30);
  if (diffMonths < 12) return `${diffMonths} mois`;

  const diffYears = Math.round(diffMonths / 12);
  return `${diffYears} an${diffYears > 1 ? "s" : ""}`;
}

function getEditorialUpcomingLabel(targetDate, fromDate) {
  const diffDays = Math.round((targetDate - fromDate) / 86400000);
  if (diffDays <= 0) return "Ce soir";
  if (diffDays === 1) return "Demain";
  if (diffDays < 7) return "Cette semaine";
  if (diffDays < 14) return "Semaine prochaine";
  return "Bientôt";
}

function getCompactProviderLabel(providerName) {
  if (!providerName) return "";

  const normalized = providerName.trim();
  const aliases = {
    "Apple TV Plus": "Apple TV+",
    "Apple TV+": "Apple TV+",
    "Disney Plus": "Disney+",
    "Disney+": "Disney+",
    "Amazon Prime Video": "Prime Video",
    Netflix: "Netflix",
    Max: "Max",
    "Canal+": "Canal+",
  };

  return aliases[normalized] || normalized;
}

function getProviderPriorityKey(providerName) {
  const normalized = getCompactProviderLabel(providerName)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

  if (normalized === "premiere max") return "premiere-max";
  if (normalized === "prime video") return "prime-video";
  if (normalized === "apple tv+") return "apple-tv+";
  if (normalized === "disney+") return "disney+";
  if (normalized === "canal+") return "canal+";
  if (normalized === "paramount+") return "paramount+";
  if (normalized === "universal+") return "universal+";
  if (normalized === "france.tv") return "france-tv";
  if (normalized === "tf1+") return "tf1+";
  if (normalized === "6play") return "6play";
  if (/\bocs\b/.test(normalized)) return "ocs";
  if (/\bsfr\b/.test(normalized)) return "sfr-play";
  if (/\bnetflix\b/.test(normalized)) return "netflix";
  if (
    normalized === "max" ||
    normalized === "hbo max" ||
    /^max\b/.test(normalized)
  )
    return "max";
  if (/\bdisney\b/.test(normalized)) return "disney+";
  if (/prime/.test(normalized)) return "prime-video";
  if (/apple/.test(normalized)) return "apple-tv+";
  if (/canal/.test(normalized)) return "canal+";
  if (/paramount/.test(normalized)) return "paramount+";
  if (/universal/.test(normalized)) return "universal+";
  if (/crunchyroll/.test(normalized)) return "crunchyroll";
  if (/mubi/.test(normalized)) return "mubi";
  if (/arte/.test(normalized)) return "arte";
  if (/france/.test(normalized)) return "france-tv";
  if (/tf1/.test(normalized)) return "tf1+";

  return normalized.replace(/[^a-z0-9+]+/g, "-").replace(/^-+|-+$/g, "");
}

function loadUserProviderKeys() {
  try {
    const stored = JSON.parse(
      localStorage.getItem(USER_PROVIDERS_STORAGE_KEY) || "[]",
    );
    return Array.isArray(stored) ? stored : [];
  } catch {
    return [];
  }
}

function saveUserProviderKeys() {
  localStorage.setItem(
    USER_PROVIDERS_STORAGE_KEY,
    JSON.stringify(userProviderKeys),
  );
}

function syncCurrentUserGroupProfile() {
  const currentUserProfileIndex = groupProfiles.findIndex(
    (profile) => profile.id === "me",
  );
  if (currentUserProfileIndex === -1) return;

  groupProfiles[currentUserProfileIndex] = {
    ...groupProfiles[currentUserProfileIndex],
    providers: userProviderKeys,
  };
  saveGroupProfiles();
}

function isUserProvider(providerName) {
  if (!providerName || !userProviderKeys.length) return false;
  return userProviderKeys.includes(getProviderPriorityKey(providerName));
}

function hasIncludedWatchProvider(item) {
  return Boolean(
    item?.providerName &&
    WATCH_PROVIDER_INCLUDED_GROUPS.has(item.providerAccessType || ""),
  );
}

function isUserProviderAvailableItem(item) {
  return Boolean(
    item?.onUserPlatforms ||
      (isUserProvider(item?.providerName) &&
        (!item?.providerAccessType || hasIncludedWatchProvider(item))),
  );
}

function getGroupProviderMatchCountForItem(item) {
  if (!hasIncludedWatchProvider(item)) return 0;
  return getGroupProviderMatchCount(item.providerName);
}

function getUserProviderTmdbIds() {
  return USER_PROVIDER_OPTIONS.filter(
    (p) => userProviderKeys.includes(p.key) && p.tmdbId,
  ).map((p) => p.tmdbId);
}

function getUserProviderLabelList() {
  return USER_PROVIDER_OPTIONS.filter((provider) =>
    userProviderKeys.includes(provider.key),
  ).map((provider) => provider.label);
}

function normalizeGroupProfile(profile) {
  return {
    id: profile.id,
    name: profile.name || "Profil",
    providers: Array.isArray(profile.providers) ? profile.providers : [],
    likedGenres: Array.isArray(profile.likedGenres) ? profile.likedGenres : [],
    dislikedGenres: Array.isArray(profile.dislikedGenres)
      ? profile.dislikedGenres
      : Array.isArray(profile.dislikes)
        ? profile.dislikes
        : [],
  };
}

function createDefaultGroupProfiles() {
  return [
    {
      id: "me",
      name: "Moi",
      providers: userProviderKeys,
      likedGenres: [],
      dislikedGenres: [],
    },
  ];
}

function loadGroupProfiles() {
  try {
    const stored = JSON.parse(
      localStorage.getItem(GROUP_PROFILES_STORAGE_KEY) || "[]",
    );
    return Array.isArray(stored) && stored.length
      ? stored.map(normalizeGroupProfile)
      : createDefaultGroupProfiles();
  } catch {
    return createDefaultGroupProfiles();
  }
}

function saveGroupProfiles() {
  localStorage.setItem(
    GROUP_PROFILES_STORAGE_KEY,
    JSON.stringify(groupProfiles),
  );
}

function loadActiveGroupProfileIds() {
  try {
    const stored = JSON.parse(
      localStorage.getItem(GROUP_ACTIVE_PROFILES_STORAGE_KEY) || "[]",
    );
    return Array.isArray(stored) ? stored : ["me"];
  } catch {
    return ["me"];
  }
}

function saveActiveGroupProfileIds() {
  localStorage.setItem(
    GROUP_ACTIVE_PROFILES_STORAGE_KEY,
    JSON.stringify(activeGroupProfileIds),
  );
}

function getActiveGroupProfiles() {
  const active = groupProfiles.filter((profile) =>
    activeGroupProfileIds.includes(profile.id),
  );
  return active.length ? active : groupProfiles.slice(0, 1);
}

function getGroupCommonProviderKeys() {
  const active = getActiveGroupProfiles();
  if (!active.length) return [];

  return active.reduce((common, profile, index) => {
    const providerSet = new Set(profile.providers || []);
    if (index === 0) return [...providerSet];
    return common.filter((providerKey) => providerSet.has(providerKey));
  }, []);
}

function getGroupProviderMatchCount(providerName) {
  const providerKey = getProviderPriorityKey(providerName);
  if (!providerKey) return 0;
  return getActiveGroupProfiles().filter((profile) =>
    (profile.providers || []).includes(providerKey),
  ).length;
}

function getItemGenreKeys(item) {
  const text = `${item.genre || ""}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  return GROUP_GENRE_OPTIONS.filter((genre) =>
    genre.terms.some((term) => text.includes(term)),
  ).map((genre) => genre.key);
}

function getGroupGenrePreferenceStats(item) {
  const itemGenreKeys = getItemGenreKeys(item);
  if (!itemGenreKeys.length) {
    return { likedBy: [], dislikedBy: [], itemGenreKeys };
  }

  return getActiveGroupProfiles().reduce(
    (stats, profile) => {
      const liked = itemGenreKeys.some((genreKey) =>
        (profile.likedGenres || []).includes(genreKey),
      );
      const disliked = itemGenreKeys.some((genreKey) =>
        (profile.dislikedGenres || []).includes(genreKey),
      );

      if (liked) stats.likedBy.push(profile.name);
      if (disliked) stats.dislikedBy.push(profile.name);
      return stats;
    },
    { likedBy: [], dislikedBy: [], itemGenreKeys },
  );
}

function getProviderOptionLabel(providerKey) {
  return (
    USER_PROVIDER_OPTIONS.find((provider) => provider.key === providerKey)
      ?.label || providerKey
  );
}

function getGenreOptionLabel(genreKey) {
  return (
    GROUP_GENRE_OPTIONS.find((genre) => genre.key === genreKey)?.label ||
    genreKey
  );
}

function compareProvidersByPriority(leftProvider, rightProvider) {
  const leftName = leftProvider?.provider_name || "";
  const rightName = rightProvider?.provider_name || "";
  const leftKey = getProviderPriorityKey(leftName);
  const rightKey = getProviderPriorityKey(rightName);
  const leftRank = STREAMING_PROVIDER_PRIORITY.indexOf(leftKey);
  const rightRank = STREAMING_PROVIDER_PRIORITY.indexOf(rightKey);

  if (leftRank !== -1 || rightRank !== -1) {
    if (leftRank === -1) return 1;
    if (rightRank === -1) return -1;
    if (leftRank !== rightRank) return leftRank - rightRank;
  }

  return getCompactProviderLabel(leftName).localeCompare(
    getCompactProviderLabel(rightName),
    "fr",
    { sensitivity: "base" },
  );
}

const providerRefreshInFlight = new Set();

function shouldRefreshItemProvider(item) {
  return Boolean(
    item?.tmdbId &&
    (item.providerPriorityVersion || 0) < WATCH_PROVIDER_PRIORITY_VERSION,
  );
}

async function ensureItemProviderUpToDate(item) {
  if (!item?.tmdbId || providerRefreshInFlight.has(item.id)) return;
  if (!shouldRefreshItemProvider(item)) return;

  providerRefreshInFlight.add(item.id);

  try {
    const endpoint = item.type === "series" ? "tv" : "movie";
    const watchProviders = await fetchWatchProviders(endpoint, item.tmdbId);
    const provider = getPrimaryWatchProvider(watchProviders, {
      includedOnly: true,
    });
    const index = items.findIndex((entry) => entry.id === item.id);
    if (index === -1) return;

    const nextProviderLogo = provider?.providerLogo || null;
    const nextProviderName = provider?.providerName || null;
    const nextProviderAccessType = provider?.providerAccessType || null;
    const hasChanged =
      items[index].providerLogo !== nextProviderLogo ||
      items[index].providerName !== nextProviderName ||
      items[index].providerAccessType !== nextProviderAccessType ||
      (items[index].providerPriorityVersion || 0) !==
        WATCH_PROVIDER_PRIORITY_VERSION;

    if (!hasChanged) return;

    items[index] = {
      ...items[index],
      providerLogo: nextProviderLogo,
      providerName: nextProviderName,
      providerAccessType: nextProviderAccessType,
      providerPriorityVersion: WATCH_PROVIDER_PRIORITY_VERSION,
    };
    localStorage.setItem("watchlist", JSON.stringify(items));
    renderItems();
  } catch (error) {
    console.error("Erreur mise a jour providers:", error);
  } finally {
    providerRefreshInFlight.delete(item.id);
  }
}

async function refreshSuggestionProviderAvailability() {
  if (
    suggestionFilters.availability !== "mine" ||
    TMDB_API_KEY === "VOTRE_CLE_API_ICI"
  ) {
    return;
  }

  const candidates = items
    .filter((item) => ["towatch", "watching", "paused"].includes(item.status))
    .filter((item) => shouldRefreshItemProvider(item))
    .slice(0, 12);

  await Promise.all(candidates.map((item) => ensureItemProviderUpToDate(item)));
}

function getUpcomingMovieReleaseLabel(item, compact = false) {
  if (!isUpcomingMovieItem(item)) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const releaseDate = parseItemDate(item.releaseDate);

  if (!releaseDate) {
    const year = parseInt(item.year, 10);
    return Number.isFinite(year) ? `À venir ${year}` : "À venir";
  }

  const diffDays = Math.ceil((releaseDate - today) / 86400000);
  if (compact) {
    if (diffDays <= 0) return "Aujourd'hui";
    if (diffDays === 1) return "Demain";
    return `J-${diffDays}`;
  }

  const dateLabel = releaseDate.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  if (diffDays <= 0) return `Sortie aujourd'hui`;
  if (diffDays === 1) return `Sortie demain (${dateLabel})`;
  return `Sortie le ${dateLabel} (J-${diffDays})`;
}

function getSeriesEpisodeProgress(item) {
  if (!item || item.type !== "series") {
    return {
      totalEpisodes: 0,
      watchedEpisodes: 0,
      remainingEpisodes: 0,
    };
  }

  const currentSeason = Math.max(1, item.currentSeason || 1);
  const currentEpisode = Math.max(1, item.currentEpisode || 1);

  const normalizedSeasonData = item.seasonData
    ? Object.entries(item.seasonData)
        .map(([seasonNumber, episodeCount]) => [
          Number(seasonNumber),
          Number(episodeCount) || 0,
        ])
        .filter(
          ([seasonNumber, episodeCount]) =>
            seasonNumber > 0 && episodeCount > 0,
        )
        .sort((a, b) => a[0] - b[0])
    : [];

  const totalEpisodesFromSeasons = normalizedSeasonData.reduce(
    (sum, [, episodeCount]) => sum + episodeCount,
    0,
  );
  const totalEpisodes =
    Number(item.totalEpisodes) ||
    totalEpisodesFromSeasons ||
    CONSTANTS.DEFAULT_EPISODES_PER_SEASON;

  let watchedBeforeCurrentSeason = 0;
  if (normalizedSeasonData.length > 0) {
    watchedBeforeCurrentSeason = normalizedSeasonData
      .filter(([seasonNumber]) => seasonNumber < currentSeason)
      .reduce((sum, [, episodeCount]) => sum + episodeCount, 0);
  } else {
    watchedBeforeCurrentSeason =
      (currentSeason - 1) * CONSTANTS.DEFAULT_EPISODES_PER_SEASON;
  }

  let watchedEpisodes =
    watchedBeforeCurrentSeason + Math.max(0, currentEpisode - 1);

  if (item.status === "watched") {
    watchedEpisodes = totalEpisodes;
  } else {
    watchedEpisodes = Math.min(watchedEpisodes, totalEpisodes);
  }

  const remainingEpisodes = Math.max(0, totalEpisodes - watchedEpisodes);

  return {
    totalEpisodes,
    watchedEpisodes,
    remainingEpisodes,
  };
}

function getNextEpisodeDisplay(item, mode = "short") {
  if (!item || item.type !== "series" || !item.currentSeason) return "";

  const season = String(item.currentSeason).padStart(2, "0");
  const episode = String(item.currentEpisode || 1).padStart(2, "0");

  if (mode === "compact") return `Prochain: S${season} E${episode}`;
  if (mode === "inline") return `Prochain épisode S${season} E${episode}`;
  return `Prochain épisode · S${season} E${episode}`;
}

function getSeasonProgressState(item, seasonNumber, episodeCount = 0) {
  const currentSeason = Math.max(1, item.currentSeason || 1);
  const currentEpisode = Math.max(1, item.currentEpisode || 1);
  const isSeriesWatched = item.status === "watched";

  let watchedEpisodes =
    seasonNumber < currentSeason
      ? episodeCount
      : seasonNumber === currentSeason
        ? isSeriesWatched
          ? episodeCount
          : Math.max(0, currentEpisode - 1)
        : 0;

  if (episodeCount > 0) {
    watchedEpisodes = Math.min(watchedEpisodes, episodeCount);
  }

  const isDone = episodeCount > 0 && watchedEpisodes >= episodeCount;
  const isCurrent =
    !isSeriesWatched && seasonNumber === currentSeason && !isDone;
  const pct =
    episodeCount > 0
      ? Math.min(100, Math.round((watchedEpisodes / episodeCount) * 100))
      : 0;

  return {
    watchedEpisodes,
    isDone,
    isCurrent,
    pct,
  };
}

function loadStoredItems() {
  try {
    const storedItems = JSON.parse(localStorage.getItem("watchlist") || "[]");
    if (!Array.isArray(storedItems)) return [];

    return storedItems
      .map((item, index) => normalizeCollectionItem(item, index))
      .filter(Boolean);
  } catch (error) {
    console.warn(
      "Données locales illisibles, démarrage avec une collection vide.",
      error,
    );
    return [];
  }
}

function normalizeTmdbMediaType(type) {
  return type === "tv" || type === "series" ? "tv" : "movie";
}

function getCollectionTypeFromTmdbType(type) {
  return normalizeTmdbMediaType(type) === "tv" ? "series" : "movie";
}

function getTrendingCacheKey(id, type) {
  return `${normalizeTmdbMediaType(type)}:${id}`;
}

function setTrendingCacheItem(item, type = item?.media_type || "movie") {
  if (!item?.id) return null;

  const mediaType = normalizeTmdbMediaType(type);
  const key = getTrendingCacheKey(item.id, mediaType);
  trendingCache[key] = {
    item: { ...item, media_type: mediaType },
    type: mediaType,
  };
  return key;
}

function getTrendingCacheItem(id, type) {
  if (type) return trendingCache[getTrendingCacheKey(id, type)] || null;
  return (
    trendingCache[getTrendingCacheKey(id, "movie")] ||
    trendingCache[getTrendingCacheKey(id, "tv")] ||
    trendingCache[id] ||
    null
  );
}

function isSameTmdbCollectionItem(item, tmdbId, type) {
  return (
    String(item?.tmdbId) === String(tmdbId) &&
    item?.type === getCollectionTypeFromTmdbType(type)
  );
}

let items = loadStoredItems();
let currentFilter = "movie";
let currentStatus = null;
let currentSort = "date-desc";
let currentViewMode = localStorage.getItem("viewMode") || "grid";
let collectionTagFilter = "";
const trendingCache = {}; // stocke les items TMDB par type et id
const seasonEpisodesCache = {};
const movieReleaseEnrichmentInFlight = new Set();
const orphanMovieRepairInFlight = new Set();
const seriesUpcomingEpisodesCache = {};
const seriesUpcomingFetchInFlight = new Set();
let collectionBrowseItems = [];
let collectionBrowseLabel = "";
let currentItemId = null;
let currentDetailTmdb = null;
let currentTags = [];
let currentWatchedWith = [];
let currentSeason = 1;
let currentEpisode = 1;
let searchTimeout;
let deferredPrompt;
let lastSuggestedItemId = null;
let currentSuggestionCandidates = [];
let recentSuggestionHistory = loadRecentSuggestionHistory();
let suggestionFilters = {
  mode: "solo",
  source: "all",
  type: "all",
  mood: "all",
  availability: "all",
  time: "all",
};
let suggestionFiltersOpen = true;
let userProviderKeys = loadUserProviderKeys();
let groupProfiles = loadGroupProfiles();
let activeGroupProfileIds = loadActiveGroupProfileIds();
syncCurrentUserGroupProfile();
let suggestionExternalCache = {
  key: "",
  items: [],
  fetchedAt: 0,
};
let suggestionProviderCache = {
  key: "",
  items: [],
  fetchedAt: 0,
};
let personalGenreProfileCache = {
  signature: "",
  scores: new Map(),
  topGenres: [],
};
let discoverBrowseState = {
  key: null,
  page: 0,
  totalPages: 0,
  loading: false,
};

function stripHiddenSystemTags(tagList) {
  if (!Array.isArray(tagList) || tagList.length === 0) return [];
  return tagList.filter((tag) => !HIDDEN_SYSTEM_TAGS.has(tag));
}

function sanitizeImportedSystemTags() {
  let hasChanges = false;

  items = items.map((item) => {
    const cleanedTags = stripHiddenSystemTags(item.tags || []);
    if (cleanedTags.length === (item.tags || []).length) {
      return item;
    }

    hasChanges = true;
    return {
      ...item,
      tags: cleanedTags,
    };
  });

  if (hasChanges) {
    localStorage.setItem("watchlist", JSON.stringify(items));
  }
}

function isIosDevice() {
  return (
    /iphone|ipad|ipod/i.test(window.navigator.userAgent) ||
    (window.navigator.platform === "MacIntel" &&
      window.navigator.maxTouchPoints > 1)
  );
}

function isStandaloneMode() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true
  );
}

function updateInstallButtonVisibility() {
  const installBtn = document.getElementById("installBtn");
  if (!installBtn) return;

  const manualInstallAvailable = isIosDevice() && !isStandaloneMode();
  const promptInstallAvailable = Boolean(deferredPrompt);

  installBtn.style.display =
    manualInstallAvailable || promptInstallAvailable ? "flex" : "none";
  installBtn.title = manualInstallAvailable
    ? "Installer sur l'écran d'accueil"
    : "Installer";
}

async function registerServiceWorker() {
  const canRegister = "serviceWorker" in navigator;
  const isLocalHost = ["localhost", "127.0.0.1"].includes(
    window.location.hostname,
  );

  if (!canRegister) return;
  if (!window.isSecureContext && !isLocalHost) return;

  // Reload when a new SW takes over so stale JS (including CONFIG) is replaced
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    window.location.reload();
  });

  try {
    const registration = await navigator.serviceWorker.register(
      "./service-worker.js",
      {
        scope: "./",
        updateViaCache: "none",
      },
    );
    registration.update().catch(() => {});
  } catch (error) {
    console.warn("Service worker registration failed", error);
  }
}

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e;
  updateInstallButtonVisibility();
});

window.addEventListener("appinstalled", () => {
  deferredPrompt = null;
  updateInstallButtonVisibility();
  showToast("Application installee");
});

function installPWA() {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then((choiceResult) => {
      if (choiceResult.outcome === "accepted") {
        showToast("Application installee");
      }
      deferredPrompt = null;
      updateInstallButtonVisibility();
    });
    return;
  }

  if (isIosDevice() && !isStandaloneMode()) {
    showToast("iPhone: Safari > Partager > Sur l'ecran d'accueil");
    return;
  }

  showToast("Installation non disponible dans ce navigateur");
}

function switchTab(tabName, element) {
  document
    .querySelectorAll(".nav-item, .mobile-nav-item")
    .forEach((item) => item.classList.remove("active"));
  document
    .querySelectorAll(".section")
    .forEach((section) => section.classList.remove("active"));

  document
    .querySelectorAll(`[data-tab="${tabName}"]`)
    .forEach((item) => item.classList.add("active"));
  if (element) element.classList.add("active");
  document.getElementById(tabName + "Section").classList.add("active");
  closeMobileActionsMenu();

  if (tabName === "stats") renderStats();
  else if (tabName === "lists") renderLists();
  else if (tabName === "discover") loadDiscover();
  else if (tabName === "search") focusSearchSection();
}

function toggleMobileActionsMenu() {
  const menu = document.getElementById("mobileActionsMenu");
  const button = document.querySelector(".mobile-more-btn");
  const isOpen = menu?.classList.toggle("active") || false;
  button?.setAttribute("aria-expanded", String(isOpen));
}

function closeMobileActionsMenu() {
  document.getElementById("mobileActionsMenu")?.classList.remove("active");
  document
    .querySelector(".mobile-more-btn")
    ?.setAttribute("aria-expanded", "false");
}

function activateTabByName(tabName) {
  const tabButton = Array.from(document.querySelectorAll(".nav-item")).find(
    (button) =>
      button.textContent.trim().toLowerCase() === tabName.toLowerCase(),
  );

  if (tabButton) {
    switchTab(tabName, tabButton);
  }
}

function applyLaunchActionFromHash() {
  const hash = window.location.hash.toLowerCase();

  if (hash === "#add") {
    openAddModal();
    return;
  }

  if (hash === "#trending") {
    showTrending();
    return;
  }

  if (hash === "#discover") {
    activateTabByName("discover");
    return;
  }

  if (hash === "#search") {
    switchTab("search", document.querySelector('[data-tab="search"]'));
  }
}


function getEpisodesInSeason(season) {
  // Lit seasonData depuis le dataset si on est dans le formulaire
  try {
    const raw = document.getElementById("titleInput")?.dataset?.seasonData;
    if (raw) {
      const data = JSON.parse(raw);
      return data[season] || CONSTANTS.DEFAULT_EPISODES_PER_SEASON;
    }
  } catch (e) {}
  return CONSTANTS.DEFAULT_EPISODES_PER_SEASON;
}

function changeEpisode(delta) {
  if (delta > 0) {
    currentEpisode++;
    const maxEp = getEpisodesInSeason(currentSeason);
    if (currentEpisode > maxEp) {
      currentEpisode = 1;
      currentSeason++;
    }
  } else {
    currentEpisode--;
    if (currentEpisode < 1) {
      if (currentSeason > 1) {
        currentSeason--;
        currentEpisode = getEpisodesInSeason(currentSeason);
      } else {
        currentEpisode = 1;
      }
    }
  }
  updateEpisodeDisplay();
}

function quickNextEpisode(id, event) {
  event.stopPropagation(); // ne pas ouvrir la fiche détail
  const idx = items.findIndex((i) => i.id === id);
  if (idx === -1) return;
  const item = { ...items[idx] };

  if (!isSeriesReleased(item)) {
    showToast("Série pas encore sortie");
    return;
  }

  let season = item.currentSeason || 1;
  let episode = item.currentEpisode || 1;

  const maxEp =
    item.seasonData?.[season] ||
    item.seasonData?.[String(season)] ||
    CONSTANTS.DEFAULT_EPISODES_PER_SEASON;
  episode++;
  if (episode > maxEp) {
    episode = 1;
    season++;
  }

  item.currentSeason = season;
  item.currentEpisode = episode;
  if (item.status === "towatch") item.status = "watching";

  items[idx] = item;
  localStorage.setItem("watchlist", JSON.stringify(items));
  renderItems();
  showToast(`S${season} E${episode} ✓`);
}

function resetEpisode() {
  currentSeason = 1;
  currentEpisode = 1;
  updateEpisodeDisplay();
}

function updateEpisodeDisplay() {
  const display = document.getElementById("episodeDisplay");
  if (!display) return;
  display.textContent = `S${currentSeason} E${currentEpisode}`;
}

function updateSelectedTMDBUI(item) {
  const card = document.getElementById("selectedTmdbCard");
  const titleEl = document.getElementById("selectedTmdbTitle");
  const metaEl = document.getElementById("selectedTmdbMeta");
  const posterEl = document.getElementById("selectedTmdbPoster");
  const choices = document.getElementById("addChoiceGroup");
  const submitBtn = document.getElementById("addSubmitBtn");

  if (!card || !titleEl || !metaEl || !posterEl || !choices || !submitBtn) {
    return;
  }

  if (!item) {
    card.style.display = "none";
    choices.style.display = "none";
    submitBtn.disabled = true;
    submitBtn.style.opacity = "0.7";
    return;
  }

  const title = item.title || item.name || "";
  const year = (item.release_date || item.first_air_date || "").substring(0, 4);
  const typeLabel = item.media_type === "tv" ? "Série" : "Film";
  const posterPath = item.posterUrl
    ? item.posterUrl
    : item.poster_path
      ? item.poster_path.startsWith("http")
        ? item.poster_path
        : `${TMDB_IMAGE_BASE}${item.poster_path}`
      : "";

  titleEl.textContent = title;
  metaEl.textContent = `${typeLabel}${year ? ` • ${year}` : ""}`;
  if (posterPath) {
    posterEl.src = posterPath;
    posterEl.style.display = "block";
  } else {
    posterEl.removeAttribute("src");
    posterEl.style.display = "none";
  }

  card.style.display = "flex";
  choices.style.display = "block";
  submitBtn.disabled = false;
  submitBtn.style.opacity = "1";
}

function getTodayDateInputValue() {
  const today = new Date();
  const localDate = new Date(
    today.getTime() - today.getTimezoneOffset() * 60000,
  );
  return localDate.toISOString().slice(0, 10);
}

function setDefaultWatchedDateIfEmpty() {
  const watchedDateInput = document.getElementById("watchedDateInput");
  if (watchedDateInput && !watchedDateInput.value) {
    watchedDateInput.value = getTodayDateInputValue();
  }
}

function selectAddStatus(status, preset = false) {
  const statusInput = document.getElementById("statusInput");
  const watchedExtras = document.getElementById("watchedExtras");
  const towatchBtn = document.getElementById("addChoiceTowatch");
  const watchedBtn = document.getElementById("addChoiceWatched");
  const submitBtn = document.getElementById("addSubmitBtn");
  const choiceGroup = document.getElementById("addChoiceGroup");
  if (
    !statusInput ||
    !watchedExtras ||
    !towatchBtn ||
    !watchedBtn ||
    !submitBtn
  ) {
    return;
  }

  const normalized = status === "watched" ? "watched" : "towatch";
  statusInput.value = normalized;

  if (preset) {
    if (choiceGroup) choiceGroup.style.display = "none";
    watchedExtras.style.display = "block";
  } else {
    towatchBtn.classList.toggle("active", normalized === "towatch");
    watchedBtn.classList.toggle("active", normalized === "watched");
    watchedExtras.style.display = normalized === "watched" ? "block" : "none";
  }

  submitBtn.textContent =
    normalized === "watched"
      ? "Enregistrer comme vu"
      : "Ajouter à la collection";
  if (normalized === "watched") setDefaultWatchedDateIfEmpty();
}

function normalizeHalfStepRating(value) {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) return 0;
  const clamped = Math.max(0, Math.min(5, parsed));
  return Math.round(clamped * 2) / 2;
}

function formatRatingDisplayValue(value) {
  const normalized = normalizeHalfStepRating(value);
  return Number.isInteger(normalized)
    ? String(normalized)
    : normalized.toFixed(1);
}

function formatRatingDisplayLabel(value) {
  return formatRatingDisplayValue(value).replace(".", ",");
}

function buildRatingStarsHTML(rating, options = {}) {
  const { max = 5, includeEmpty = true, extraClass = "" } = options;
  const normalized = normalizeHalfStepRating(rating);
  if (!normalized && !includeEmpty) return "";

  const stars = [];
  for (let index = 1; index <= max; index++) {
    if (normalized >= index) {
      stars.push('<span class="rating-star rating-star-full">★</span>');
    } else if (normalized >= index - 0.5) {
      stars.push('<span class="rating-star rating-star-half">★</span>');
    } else if (includeEmpty) {
      stars.push('<span class="rating-star rating-star-empty">★</span>');
    }
  }

  const classNames = ["rating-stars", extraClass].filter(Boolean).join(" ");
  return `<span class="${classNames}">${stars.join("")}</span>`;
}

function getPickerRatingFromPointer(starElement, event) {
  const starValue = Number.parseInt(starElement.dataset.value, 10) || 0;
  if (!event || typeof event.clientX !== "number") {
    return normalizeHalfStepRating(starValue);
  }

  const bounds = starElement.getBoundingClientRect();
  const isLeftHalf = event.clientX - bounds.left <= bounds.width / 2;
  return normalizeHalfStepRating(starValue - (isLeftHalf ? 0.5 : 0));
}

function setStarPickerVisualState(value, stateClass, halfClass) {
  const normalized = normalizeHalfStepRating(value);
  document.querySelectorAll("#starPicker .star-pick").forEach((star) => {
    const starValue = Number.parseInt(star.dataset.value, 10) || 0;
    const full = normalized >= starValue;
    const half = !full && normalized >= starValue - 0.5;
    star.classList.toggle(stateClass, full || half);
    star.classList.toggle(halfClass, half);
  });
}

function initStarPicker() {
  const starPicker = document.getElementById("starPicker");
  const ratingInput = document.getElementById("ratingInput");
  const ratingClearBtn = document.getElementById("ratingClearBtn");
  if (!starPicker || !ratingInput) return;

  const stars = starPicker.querySelectorAll(".star-pick");
  let suppressMouseUntil = 0;

  const isMouseSuppressed = () => Date.now() < suppressMouseUntil;

  if (starPicker.dataset.boundLeave !== "true") {
    starPicker.dataset.boundLeave = "true";
    starPicker.addEventListener("mouseleave", () => {
      setStarPickerVisualState(0, "hovered", "hovered-half");
      updateStarPicker(ratingInput.value);
    });
  }

  if (starPicker.dataset.boundTouch !== "true") {
    starPicker.dataset.boundTouch = "true";
    let touchValue = 0;

    const getTouchRating = (touch) => {
      if (!touch || !stars.length) return null;

      const firstStarRect = stars[0].getBoundingClientRect();
      const lastStarRect = stars[stars.length - 1].getBoundingClientRect();
      const starsWidth = lastStarRect.right - firstStarRect.left;
      if (starsWidth <= 0) return null;

      const xMin = firstStarRect.left;
      const xMax = lastStarRect.right - 0.001;
      const clampedX = Math.min(Math.max(touch.clientX, xMin), xMax);
      const ratio = (clampedX - xMin) / starsWidth;
      const rawRating = ratio * 5;
      const snappedHalf = Math.ceil(rawRating * 2) / 2;
      const minInsidePicker = 0.5;
      return normalizeHalfStepRating(
        Math.max(minInsidePicker, Math.min(5, snappedHalf)),
      );
    };

    starPicker.addEventListener(
      "touchstart",
      (event) => {
        const val = getTouchRating(event.touches[0]);
        if (val === null) return;
        suppressMouseUntil = Date.now() + 500;
        starPicker.classList.add("touching");
        touchValue = val;
        setStarPickerVisualState(0, "selected", "selected-half");
        setStarPickerVisualState(val, "hovered", "hovered-half");
        event.preventDefault();
      },
      { passive: false },
    );

    starPicker.addEventListener(
      "touchmove",
      (event) => {
        const val = getTouchRating(event.touches[0]);
        if (val === null) return;
        suppressMouseUntil = Date.now() + 500;
        touchValue = val;
        setStarPickerVisualState(0, "selected", "selected-half");
        setStarPickerVisualState(val, "hovered", "hovered-half");
        event.preventDefault();
      },
      { passive: false },
    );

    starPicker.addEventListener(
      "touchend",
      (event) => {
        const val = getTouchRating(event.changedTouches[0]) ?? touchValue;
        suppressMouseUntil = Date.now() + 500;
        starPicker.classList.remove("touching");
        if (!val) {
          updateStarPicker(ratingInput.value);
          return;
        }

        const newVal = formatRatingDisplayValue(normalizeHalfStepRating(val));
        ratingInput.value = newVal;
        touchValue = 0;
        updateStarPicker(newVal);
        event.preventDefault();
      },
      { passive: false },
    );

    starPicker.addEventListener("touchcancel", () => {
      suppressMouseUntil = Date.now() + 500;
      starPicker.classList.remove("touching");
      touchValue = 0;
      updateStarPicker(ratingInput.value);
    });
  }

  if (ratingClearBtn && ratingClearBtn.dataset.bound !== "true") {
    ratingClearBtn.dataset.bound = "true";
    ratingClearBtn.addEventListener("click", () => {
      ratingInput.value = "";
      updateStarPicker("");
    });
  }

  if (starPicker.dataset.boundKeyboard !== "true") {
    starPicker.dataset.boundKeyboard = "true";
    starPicker.addEventListener("keydown", (event) => {
      const current = normalizeHalfStepRating(ratingInput.value);
      let next = current;
      let handled = true;

      switch (event.key) {
      case "ArrowLeft":
      case "ArrowDown":
        next = Math.max(0, current - 0.5);
        break;
      case "ArrowRight":
      case "ArrowUp":
        next = Math.min(5, current + 0.5);
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = 5;
        break;
      case "Enter":
      case " ":
      case "Delete":
      case "Backspace":
        next = 0;
        break;
      default:
        handled = false;
      }

      if (!handled) return;
      event.preventDefault();

      const newVal = next > 0 ? formatRatingDisplayValue(next) : "";
      ratingInput.value = newVal;
      updateStarPicker(newVal);
    });
  }

  stars.forEach((star) => {
    if (star.dataset.bound === "true") return;
    star.dataset.bound = "true";
    star.addEventListener("mouseenter", (event) => {
      if (isMouseSuppressed()) return;
      const val = getPickerRatingFromPointer(star, event);
      setStarPickerVisualState(val, "hovered", "hovered-half");
    });
    star.addEventListener("mousemove", (event) => {
      if (isMouseSuppressed()) return;
      const val = getPickerRatingFromPointer(star, event);
      setStarPickerVisualState(val, "hovered", "hovered-half");
    });
    star.addEventListener("click", (event) => {
      if (isMouseSuppressed()) return;
      const val = getPickerRatingFromPointer(star, event);
      const newVal = formatRatingDisplayValue(val);
      ratingInput.value = newVal;
      updateStarPicker(newVal);
    });
  });

  updateRatingPickerUI(ratingInput.value);
}

function updateStarPicker(value) {
  setStarPickerVisualState(0, "hovered", "hovered-half");
  setStarPickerVisualState(value, "selected", "selected-half");
  updateRatingPickerUI(value);
}

function updateRatingPickerUI(value) {
  const ratingPanel = document.getElementById("ratingPanel");
  const ratingValueDisplay = document.getElementById("ratingValueDisplay");
  const ratingHintText = document.getElementById("ratingHintText");
  const ratingClearBtn = document.getElementById("ratingClearBtn");
  const starPicker = document.getElementById("starPicker");
  const normalized = normalizeHalfStepRating(value);
  const hasValue = normalized > 0;

  ratingPanel?.classList.toggle("rating-panel-has-value", hasValue);

  if (ratingValueDisplay) {
    ratingValueDisplay.textContent = hasValue
      ? `${formatRatingDisplayLabel(normalized)}/5`
      : "Aucune note";
  }

  if (ratingHintText) {
    ratingHintText.textContent = hasValue
      ? "Utilise Effacer pour retirer la note."
      : "Clique ou glisse pour noter.";
  }

  if (ratingClearBtn) {
    ratingClearBtn.disabled = !hasValue;
    ratingClearBtn.setAttribute("aria-disabled", String(!hasValue));
  }

  if (starPicker) {
    starPicker.setAttribute("aria-valuenow", String(normalized));
    starPicker.setAttribute(
      "aria-valuetext",
      hasValue ? `${formatRatingDisplayLabel(normalized)} sur 5` : "Aucune note",
    );
  }
}

document.getElementById("tagInput")?.addEventListener("keydown", function (e) {
  if (e.key === "Enter" || e.key === ",") {
    e.preventDefault();
    const tag = this.value.trim();
    if (tag && !currentTags.includes(tag)) {
      currentTags.push(tag);
      renderTags();
      this.value = "";
    }
  }
});

function addQuickTag(tag) {
  if (!currentTags.includes(tag)) {
    currentTags.push(tag);
    renderTags();
  }
}

function renderTags() {
  const container = document.getElementById("tagsContainer");
  const input = document.getElementById("tagInput");

  container.innerHTML =
    currentTags
      .map(
        (tag) => `
        <span class="tag-item">
          ${escapeHtml(tag)}
          <button type="button" class="tag-remove" data-tag="${escapeHtml(tag)}">×</button>
        </span>
      `,
      )
      .join("") +
    '<input type="text" class="tag-input" id="tagInput" placeholder="Ajouter un tag..." style="flex: 1; border: none; background: transparent; outline: none; font-size: 14px; min-width: 120px; color: inherit;">';

  container.querySelectorAll(".tag-remove").forEach((btn) => {
    btn.addEventListener("click", () => removeTag(btn.dataset.tag));
  });

  const newInput = container.querySelector(".tag-input");
  newInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      const tag = this.value.trim();
      if (tag && !currentTags.includes(tag)) {
        currentTags.push(tag);
        renderTags();
        this.value = "";
      }
    }
  });
}

function removeTag(tag) {
  currentTags = currentTags.filter((t) => t !== tag);
  renderTags();
}

function addWatchedWithName(name) {
  const names = getWatchedWithNames(name);
  let didChange = false;

  names.forEach((person) => {
    if (!currentWatchedWith.includes(person)) {
      currentWatchedWith.push(person);
      didChange = true;
    }
  });

  if (didChange) renderWatchedWith();
}

function renderWatchedWith() {
  const container = document.getElementById("watchedWithContainer");
  if (!container) return;

  container.innerHTML =
    currentWatchedWith
      .map(
        (name) => `
        <span class="tag-item person-item">
          ${escapeHtml(name)}
          <button type="button" class="tag-remove" data-name="${escapeHtml(name)}">&times;</button>
        </span>
      `,
      )
      .join("") +
    '<input type="text" class="tag-input" id="watchedWithInput" placeholder="Ajouter une personne..." style="flex: 1; border: none; background: transparent; outline: none; font-size: 14px; min-width: 120px; color: inherit;">';

  container.querySelectorAll(".tag-remove").forEach((btn) => {
    btn.addEventListener("click", () => removeWatchedWithName(btn.dataset.name));
  });

  const input = container.querySelector(".tag-input");
  input.addEventListener("keydown", function (e) {
    if (e.key === "Enter" || e.key === "," || e.key === ";") {
      e.preventDefault();
      addWatchedWithName(this.value);
      this.value = "";
    }
  });
}

function removeWatchedWithName(name) {
  currentWatchedWith = currentWatchedWith.filter((person) => person !== name);
  renderWatchedWith();
}

async function searchTMDB(query) {
  if (!query || query.length < 2) {
    document.getElementById("searchResults").innerHTML = "";
    return;
  }

  if (TMDB_API_KEY === "VOTRE_CLE_API_ICI") {
    document.getElementById("searchResults").innerHTML = `
          <div style="padding: 20px; text-align: center; background: var(--bg-tertiary); border-radius: var(--radius-sm); color: var(--text-secondary); font-size: 13px;">
            Clé API TMDB manquante. <a href="https://www.themoviedb.org/settings/api" target="_blank" style="color: var(--accent); text-decoration: underline;">Obtenir une clé</a>
          </div>
        `;
    return;
  }

  document.getElementById("searchLoader").style.display = "block";

  try {
    const [movieRes, tvRes] = await Promise.all([
      fetch(
        `${TMDB_BASE_URL}/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&language=fr-FR`,
      ),
      fetch(
        `${TMDB_BASE_URL}/search/tv?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&language=fr-FR`,
      ),
    ]);

    if (!movieRes.ok || !tvRes.ok) throw new Error("Erreur API");

    const movies = await movieRes.json();
    const tv = await tvRes.json();

    const combined = [
      ...movies.results.slice(0, 3).map((m) => ({ ...m, media_type: "movie" })),
      ...tv.results.slice(0, 3).map((t) => ({ ...t, media_type: "tv" })),
    ]
      .sort((a, b) => (b.popularity || 0) - (a.popularity || 0))
      .slice(0, 5);

    displaySearchResults(combined);
  } catch (error) {
    console.error("Erreur TMDB:", error);
    document.getElementById("searchResults").innerHTML = `
          <div style="padding: 20px; text-align: center; background: var(--bg-tertiary); border-radius: var(--radius-sm); color: var(--text-secondary); font-size: 13px;">
            Erreur lors de la recherche
          </div>
        `;
  } finally {
    document.getElementById("searchLoader").style.display = "none";
  }
}

function displaySearchResults(results) {
  const container = document.getElementById("searchResults");

  if (results.length === 0) {
    container.innerHTML =
      '<div style="padding: 20px; text-align: center; color: var(--text-tertiary); font-size: 13px;">Aucun résultat</div>';
    return;
  }

  container.innerHTML = results
    .map((item) => {
      const title = item.title || item.name;
      const year = (item.release_date || item.first_air_date || "").substring(
        0,
        4,
      );
      const posterPath = item.poster_path
        ? `${TMDB_IMAGE_BASE}${item.poster_path}`
        : "";

      return `
          <div class="search-result" onclick='selectTMDBItem(${JSON.stringify(item).replace(/'/g, "&#39;")})'>
            ${
              posterPath
                ? `<img src="${posterPath}" alt="${escapeHtml(title)}" class="search-result-poster">`
                : `<div class="search-result-poster" style="display: flex; align-items: center; justify-content: center;">${item.media_type === "movie" ? "🎬" : "📺"}</div>`
            }
            <div class="search-result-info">
              <div class="search-result-title">${escapeHtml(title)}</div>
              <div class="search-result-meta">${item.media_type === "movie" ? "Film" : "Série"} • ${escapeHtml(year) || "—"} ${item.vote_average ? `• ⭐ ${item.vote_average.toFixed(1)}` : ""}</div>
            </div>
          </div>
        `;
    })
    .join("");
}

async function selectTMDBItem(item) {
  const title = item.title || item.name;
  const releaseDate = item.release_date || item.first_air_date || "";
  const year = (item.release_date || item.first_air_date || "").substring(0, 4);
  const genres = item.genre_ids
    ? getGenreNames(item.genre_ids, item.media_type)
    : "";

  document.getElementById("titleInput").value = title;
  document.getElementById("typeInput").value =
    item.media_type === "movie" ? "movie" : "series";
  document.getElementById("yearInput").value = year;
  document.getElementById("genreInput").value = genres;
  document.getElementById("ratingInput").value = "";
  updateStarPicker("");
  selectAddStatus("towatch");
  updateSelectedTMDBUI(item);

  if (item.poster_path) {
    document.getElementById("titleInput").dataset.poster =
      `${TMDB_IMAGE_BASE}${item.poster_path}`;
    document.getElementById("titleInput").dataset.tmdbId = item.id;
  }
  if (releaseDate) {
    document.getElementById("titleInput").dataset.releaseDate = releaseDate;
  } else {
    delete document.getElementById("titleInput").dataset.releaseDate;
  }

  const titleInput = document.getElementById("titleInput");
  const endpoint = item.media_type === "movie" ? "movie" : "tv";
  const watchProviders = await fetchWatchProviders(endpoint, item.id);
  setProviderDataset(titleInput, watchProviders);

  // Pour les séries, charger le vrai nombre d'épisodes par saison
  if (item.media_type === "tv") {
    try {
      const res = await fetch(
        `${TMDB_BASE_URL}/tv/${item.id}?api_key=${TMDB_API_KEY}&language=fr-FR`,
      );
      if (res.ok) {
        const tvData = await res.json();
        const seasonData = {};
        (tvData.seasons || [])
          .filter((s) => s.season_number > 0)
          .forEach((s) => {
            seasonData[s.season_number] = s.episode_count;
          });
        document.getElementById("titleInput").dataset.seasonData =
          JSON.stringify(seasonData);
        document.getElementById("titleInput").dataset.totalEpisodes =
          tvData.number_of_episodes || "";
        document.getElementById("titleInput").dataset.totalSeasons =
          tvData.number_of_seasons || "";
      }
    } catch (e) {
      console.error("Erreur chargement saisons:", e);
    }
  }

  document.getElementById("searchResults").innerHTML = "";
  document.getElementById("tmdbSearch").value = "";
  showToast("Informations remplies ✓");
}

// Utilise GENRE_MAP depuis config.js
function getGenreNames(genreIds, mediaType) {
  const map = GENRE_MAP[mediaType] || GENRE_MAP.movie;
  return genreIds
    .slice(0, 3)
    .map((id) => map[id] || "")
    .filter(Boolean)
    .join(", ");
}

document.getElementById("tmdbSearch")?.addEventListener("input", function (e) {
  clearTimeout(searchTimeout);
  const query = e.target.value.trim();

  if (query.length < 2) {
    document.getElementById("searchResults").innerHTML = "";
    return;
  }

  searchTimeout = setTimeout(() => searchTMDB(query), 500);
});

// watched = épisodes vus (détermine le remplissage), label = texte affiché au centre
function buildCircularProgress(watched, total, label, size = 52) {
  const radius = (size - 6) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = total > 0 ? Math.min(watched / total, 1) : 0;
  const offset = circumference * (1 - pct);
  const cx = size / 2;
  const innerRadius = Math.max(radius - 5, 0);
  const outerRadius = Math.min(radius + 2, size / 2 - 1);

  return `
    <svg class="ep-ring" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <circle cx="${cx}" cy="${cx}" r="${outerRadius}" class="ep-ring-halo"/>
      <circle cx="${cx}" cy="${cx}" r="${innerRadius}" class="ep-ring-core"/>
      <circle cx="${cx}" cy="${cx}" r="${innerRadius}" class="ep-ring-shine"/>
      <circle cx="${cx}" cy="${cx}" r="${radius}" class="ep-ring-bg"/>
      <circle cx="${cx}" cy="${cx}" r="${radius}" class="ep-ring-fill"
        stroke-dasharray="${circumference}"
        stroke-dashoffset="${offset}"
        transform="rotate(-90 ${cx} ${cx})"/>
      <text x="${cx}" y="${cx}" class="ep-ring-text" text-anchor="middle" dominant-baseline="central">${label}</text>
    </svg>`;
}

function renderWatchingStrip() {
  const strip = document.getElementById("watchingStrip");
  const scroll = document.getElementById("watchingStripScroll");

  if (!strip || !scroll) return;

  if (currentFilter !== "series") {
    scroll.innerHTML = "";
    strip.style.display = "none";
    return;
  }

  const watching = items.filter(
    (i) => i.type === "series" && i.status === "watching",
  );

  if (watching.length === 0) {
    scroll.innerHTML = "";
    strip.style.display = "none";
    return;
  }

  strip.style.display = "block";

  scroll.innerHTML = watching
    .map((item) => {
      const season = item.currentSeason || 1;
      const episode = item.currentEpisode || 1;
      const progress = getSeriesEpisodeProgress(item);
      const remaining = progress.remainingEpisodes;
      const ring = buildCircularProgress(
        progress.watchedEpisodes,
        progress.totalEpisodes,
        remaining,
      );
      const episodeLabel = getNextEpisodeDisplay(item, "compact");

      return `
      <div class="watching-card" onclick="openDetail(${inlineJsString(item.id)})">
        <div class="watching-card-poster">
          ${
            item.posterUrl
              ? `<img src="${escapeHtml(item.posterUrl)}" alt="${escapeHtml(item.title)}">`
              : `<div class="watching-card-placeholder">📺</div>`
          }
          <div class="watching-card-chip watching-card-chip-left">${episodeLabel}</div>
          <div class="watching-card-overlay">
            <div class="watching-card-title">${escapeHtml(item.title)}</div>
          </div>
          <div class="watching-card-ring">${ring}</div>
        </div>
      </div>`;
    })
    .join("");
}

async function enrichMovieReleaseDate(item) {
  if (
    item.type !== "movie" ||
    item.releaseDate ||
    !item.tmdbId ||
    TMDB_API_KEY === "VOTRE_CLE_API_ICI"
  ) {
    return;
  }

  if (movieReleaseEnrichmentInFlight.has(item.tmdbId)) return;
  movieReleaseEnrichmentInFlight.add(item.tmdbId);

  try {
    const res = await fetch(
      `${TMDB_BASE_URL}/movie/${item.tmdbId}?api_key=${TMDB_API_KEY}&language=fr-FR`,
    );
    if (!res.ok) return;

    const tmdb = await res.json();
    const releaseDate = tmdb?.release_date;
    if (!releaseDate) return;

    const idx = items.findIndex((i) => i.id === item.id);
    if (idx === -1) return;

    items[idx] = {
      ...items[idx],
      releaseDate,
      year: releaseDate.substring(0, 4) || items[idx].year,
    };
    localStorage.setItem("watchlist", JSON.stringify(items));
    renderItems();
  } catch (e) {
    console.error("Erreur enrichissement date film:", e);
  } finally {
    movieReleaseEnrichmentInFlight.delete(item.tmdbId);
  }
}

async function ensureMovieItemHydrated(item) {
  if (
    !item ||
    item.type !== "movie" ||
    !shouldAttemptMovieAutoRepair(item) ||
    TMDB_API_KEY === "VOTRE_CLE_API_ICI"
  ) {
    return;
  }

  const needsHydration =
    shouldForceMovieTmdbOverride(item) ||
    !item.tmdbId ||
    !item.posterUrl ||
    !item.genre ||
    !item.year ||
    !item.releaseDate ||
    (item.tmdbId &&
      isLikelyLetterboxdImportedMovie(item) &&
      (item.tmdbLocalizationVersion || 0) < TMDB_MOVIE_LOCALIZATION_VERSION);
  if (!needsHydration) return;

  if (orphanMovieRepairInFlight.has(item.id)) return;
  orphanMovieRepairInFlight.add(item.id);

  try {
    const repairedItem = await enrichImportedMovieItem(item);
    if (!repairedItem) return;

    const hasMeaningfulUpdate =
      repairedItem.tmdbId !== item.tmdbId ||
      repairedItem.title !== item.title ||
      repairedItem.posterUrl !== item.posterUrl ||
      repairedItem.providerLogo !== item.providerLogo ||
      repairedItem.providerName !== item.providerName ||
      repairedItem.genre !== item.genre ||
      repairedItem.year !== item.year ||
      repairedItem.releaseDate !== item.releaseDate ||
      (repairedItem.tmdbLocalizationVersion || 0) !==
        (item.tmdbLocalizationVersion || 0);

    if (!hasMeaningfulUpdate) return;

    const index = items.findIndex((entry) => entry.id === item.id);
    if (index === -1) return;

    items[index] = mergeImportedIntoExistingItem(items[index], repairedItem);
    localStorage.setItem("watchlist", JSON.stringify(items));
    renderItems();
  } catch (error) {
    console.error("Erreur reparation film orphelin:", error);
  } finally {
    orphanMovieRepairInFlight.delete(item.id);
  }
}

async function enrichSeriesUpcomingEpisode(item) {
  if (
    item.type !== "series" ||
    !item.tmdbId ||
    TMDB_API_KEY === "VOTRE_CLE_API_ICI"
  ) {
    return;
  }

  if (seriesUpcomingFetchInFlight.has(item.tmdbId)) return;
  seriesUpcomingFetchInFlight.add(item.tmdbId);

  try {
    const res = await fetch(
      `${TMDB_BASE_URL}/tv/${item.tmdbId}?api_key=${TMDB_API_KEY}&language=fr-FR`,
    );
    if (!res.ok) {
      seriesUpcomingEpisodesCache[item.id] = null;
      return;
    }

    const tmdb = await res.json();
    const next = tmdb?.next_episode_to_air;
    if (!next?.air_date) {
      seriesUpcomingEpisodesCache[item.id] = null;
      return;
    }

    seriesUpcomingEpisodesCache[item.id] = {
      next,
      airDate: next.air_date,
      seasons: tmdb.seasons || [],
    };
  } catch (e) {
    console.error("Erreur chargement prochain épisode:", e);
    seriesUpcomingEpisodesCache[item.id] = null;
  } finally {
    seriesUpcomingFetchInFlight.delete(item.tmdbId);
    if (currentFilter === "series") renderItems();
  }
}

function buildSeriesUpcomingSeasonsRow(seriesItems) {
  const tracked = seriesItems.filter(
    (item) => item.tmdbId && item.status !== "dropped",
  );

  tracked.forEach((item) => {
    if (!(item.id in seriesUpcomingEpisodesCache)) {
      enrichSeriesUpcomingEpisode(item);
    }
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const upcomingSeasons = tracked
    .flatMap((item) => {
      const seasons = seriesUpcomingEpisodesCache[item.id]?.seasons || [];
      return seasons
        .filter((season) => {
          if (season.season_number === 0 || !season.air_date) return false;
          const airDate = new Date(season.air_date);
          airDate.setHours(0, 0, 0, 0);
          return airDate > today;
        })
        .map((season) => {
          const airDate = new Date(season.air_date);
          airDate.setHours(0, 0, 0, 0);
          return { item, season, airDate };
        });
    })
    .sort((a, b) => a.airDate - b.airDate)
    .slice(0, 12);

  let body = "";
  if (upcomingSeasons.length > 0) {
    body = `
      <div class="collection-upcoming-seasons-row">
        ${upcomingSeasons
          .map(({ item, season, airDate }) => {
            const dateLabel = formatFutureDistanceLabel(airDate, today);
            return `
              <article class="collection-upcoming-season-card" onclick="openDetail(${inlineJsString(item.id)})">
                <div class="collection-upcoming-season-poster">
                  ${
                    season.poster_path
                      ? `<img src="${TMDB_IMAGE_BASE}${season.poster_path}" alt="${escapeHtml(season.name || item.title)}">`
                      : item.posterUrl
                        ? `<img src="${escapeHtml(item.posterUrl)}" alt="${escapeHtml(item.title)}">`
                        : `<div class="upcoming-poster-placeholder">📺</div>`
                  }
                </div>
                <div class="collection-upcoming-season-body">
                  <div class="collection-upcoming-season-title">${escapeHtml(item.title)}</div>
                  <div class="collection-upcoming-season-num">SAISON ${String(season.season_number).padStart(2, "0")}</div>
                  <div class="collection-upcoming-season-date">${escapeHtml(dateLabel)}</div>
                </div>
              </article>
            `;
          })
          .join("")}
      </div>
    `;
  } else if (tracked.length === 0) {
    body = renderUpcomingEmpty("Aucune série suivie avec TMDB.");
  } else {
    const isLoading = tracked.some(
      (item) => !(item.id in seriesUpcomingEpisodesCache),
    );
    body = isLoading
      ? `<div class="upcoming-loading">Chargement des saisons à venir…</div>`
      : renderUpcomingEmpty("Aucune saison à venir pour le moment.");
  }

  return `
    <section class="collection-group collection-upcoming-group collection-upcoming-seasons-group">
      <div class="collection-row-header">
        <h3 class="collection-group-title">Saisons à venir</h3>
      </div>
      ${body}
    </section>
  `;
}

function buildSeriesUpcomingEpisodesRow(seriesItems) {
  const tracked = seriesItems.filter(
    (item) => item.tmdbId && item.status !== "dropped",
  );

  tracked.forEach((item) => {
    if (!(item.id in seriesUpcomingEpisodesCache)) {
      enrichSeriesUpcomingEpisode(item);
    }
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const upcoming = tracked
    .map((item) => {
      const data = seriesUpcomingEpisodesCache[item.id];
      if (!data?.airDate || !data?.next) return null;

      const airDate = new Date(data.airDate);
      airDate.setHours(0, 0, 0, 0);
      if (airDate < today) return null;

      return {
        item,
        next: data.next,
        airDate,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.airDate - b.airDate);

  let body = "";
  if (upcoming.length > 0) {
    const getWeekStart = (date) => {
      const weekStart = new Date(date);
      const day = weekStart.getDay();
      const diff = day === 0 ? -6 : 1 - day;
      weekStart.setDate(weekStart.getDate() + diff);
      weekStart.setHours(0, 0, 0, 0);
      return weekStart;
    };

    const currentWeekStart = getWeekStart(today);

    const currentWeekEntries = upcoming.filter(
      ({ airDate }) =>
        getWeekStart(airDate).getTime() === currentWeekStart.getTime(),
    );
    const futureWeekEntries = upcoming.filter(
      ({ airDate }) =>
        getWeekStart(airDate).getTime() !== currentWeekStart.getTime(),
    );

    const sections = [];

    const currentWeekGroups = currentWeekEntries.reduce((groups, entry) => {
      const key = entry.airDate.toISOString().split("T")[0];
      if (!groups[key]) groups[key] = [];
      groups[key].push(entry);
      return groups;
    }, {});

    Object.entries(currentWeekGroups).forEach(([key, entries]) => {
      const airDate = entries[0].airDate;
      const distanceLabel = getEditorialUpcomingLabel(airDate, today);
      const diffDays = Math.round((airDate - today) / 86400000);
      sections.push({
        key: `day-${key}`,
        type: "day",
        entries,
        badge:
          diffDays <= 1
            ? distanceLabel
            : airDate.toLocaleDateString("fr-FR", { weekday: "long" }),
        meta: airDate.toLocaleDateString("fr-FR", {
          day: "numeric",
          month: "long",
        }),
      });
    });

    if (futureWeekEntries.length > 0) {
      const firstFuture = futureWeekEntries[0].airDate;
      sections.push({
        key: "week-later",
        type: "week",
        entries: futureWeekEntries,
        badge: "Bientôt",
        meta: `À partir du ${firstFuture.toLocaleDateString("fr-FR", {
          day: "numeric",
          month: "long",
        })}`,
      });
    }

    if (upcoming.length === 1) {
      const { item, next, airDate } = upcoming[0];
      const episodeCode = `S${String(next.season_number).padStart(2, "0")} · E${String(next.episode_number).padStart(2, "0")}`;
      const daysLeft = Math.round((airDate - today) / 86400000);
      const dateLabel =
        daysLeft === 0
          ? "Aujourd'hui"
          : daysLeft === 1
            ? "Demain"
            : airDate.toLocaleDateString("fr-FR", {
                weekday: "long",
                day: "numeric",
                month: "long",
              });
      body = `
        <article class="upcoming-single-ep" onclick="openDetail(${inlineJsString(item.id)})">
          <div class="upcoming-single-ep-thumb">
            ${item.posterUrl ? `<img src="${escapeHtml(item.posterUrl)}" alt="${escapeHtml(item.title)}">` : `<div class="upcoming-poster-placeholder">📺</div>`}
          </div>
          <div class="upcoming-single-ep-info">
            <div class="upcoming-single-ep-show">${escapeHtml(item.title)}</div>
            <div class="upcoming-single-ep-code">${escapeHtml(episodeCode)}</div>
            <div class="upcoming-single-ep-date">${escapeHtml(dateLabel)}</div>
          </div>
        </article>
      `;
    } else {
      body = `
        <div class="collection-upcoming-shell">
          ${sections
            .map((section) => {
              return `
                <section class="collection-upcoming-day collection-upcoming-day-${section.type}" style="--upcoming-count:${section.entries.length}">
                  <div class="collection-upcoming-dayhead">
                    <div class="collection-upcoming-daybadge">${escapeHtml(section.badge)}</div>
                  </div>
                  <div class="collection-upcoming-daymeta">${escapeHtml(section.meta)}</div>
                  <div class="collection-upcoming-cards">
                    ${section.entries
                      .map(({ item, next, airDate }, index) => {
                        const daysLeft = Math.round(
                          (airDate - today) / 86400000,
                        );
                        const isUrgent = daysLeft <= 2;
                        const isFeatured = index === 0;
                        const episodeCode = `S${String(next.season_number).padStart(2, "0")} E${String(next.episode_number).padStart(2, "0")}`;
                        const providerLabel = getCompactProviderLabel(
                          item.providerName,
                        );
                        return `
                  <article class="collection-upcoming-card ${isFeatured ? "collection-upcoming-card-featured" : ""} ${isUrgent ? "collection-upcoming-card-urgent" : ""}" onclick="openDetail(${inlineJsString(item.id)})">
                    <div class="collection-upcoming-card-image">
                      ${item.posterUrl ? `<img src="${escapeHtml(item.posterUrl)}" alt="${escapeHtml(item.title)}">` : `<div class="upcoming-poster-placeholder">📺</div>`}
                      <div class="collection-upcoming-card-imagefade"></div>
                      ${providerLabel ? `<div class="collection-upcoming-card-provider">${escapeHtml(providerLabel)}</div>` : ""}
                      <div class="collection-upcoming-card-info">
                        <div class="collection-upcoming-show">${escapeHtml(item.title)}</div>
                        <div class="collection-upcoming-episode">${escapeHtml(episodeCode)}</div>
                      </div>
                    </div>
                  </article>
                `;
                      })
                      .join("")}
                  </div>
                </section>
              `;
            })
            .join("")}
        </div>
      `;
    }
  } else if (tracked.length === 0) {
    body = renderUpcomingEmpty("Aucune série suivie avec TMDB.");
  } else {
    const isLoading = tracked.some(
      (item) => !(item.id in seriesUpcomingEpisodesCache),
    );
    body = isLoading
      ? `<div class="upcoming-loading">Chargement des prochains épisodes…</div>`
      : renderUpcomingEmpty("Aucun épisode à venir pour le moment.");
  }

  return `
    <section class="collection-group collection-upcoming-group">
      <div class="collection-row-header">
        <h3 class="collection-group-title">Épisodes à venir</h3>
      </div>
      ${body}
    </section>
  `;
}

// ── DARK MODE ──────────────────────────────────────────────────────────────

function toggleDarkMode() {
  const isDark = document.documentElement.getAttribute("data-theme") === "dark";
  const next = isDark ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem("theme", next);
}

(function initTheme() {
  const saved = localStorage.getItem("theme");
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const theme = saved || (prefersDark ? "dark" : "light");
  if (theme === "dark") {
    document.documentElement.setAttribute("data-theme", "dark");
  }
})();

// ── VIEW MODE ───────────────────────────────────────────────────────────────

function setViewMode(mode) {
  currentViewMode = mode;
  localStorage.setItem("viewMode", mode);
  document
    .getElementById("viewGrid")
    ?.classList.toggle("active", mode === "grid");
  document
    .getElementById("viewList")
    ?.classList.toggle("active", mode === "list");
  renderItems();
}

(function initViewMode() {
  const mode = localStorage.getItem("viewMode") || "grid";
  document
    .getElementById("viewGrid")
    ?.classList.toggle("active", mode === "grid");
  document
    .getElementById("viewList")
    ?.classList.toggle("active", mode === "list");
})();

function renderListRow(item) {
  if (item.type === "movie") {
    ensureMovieItemHydrated(item);
  }
  ensureItemProviderUpToDate(item);

  const normalizedStatus = normalizeStatusValue(item.status);
  const statusText =
    (item.type === "movie" && getUpcomingMovieReleaseLabel(item, true)) ||
    getStatusLabel(normalizedStatus);
  const stars = item.rating
    ? buildRatingStarsHTML(item.rating, {
        includeEmpty: true,
        extraClass: "list-row-stars-inline",
      })
    : "";

  return `
    <div class="list-row" onclick="openDetail(${inlineJsString(item.id)})">
      <div class="list-row-poster">
        ${
          item.posterUrl
            ? `<img src="${escapeHtml(item.posterUrl)}" alt="${escapeHtml(item.title)}">`
            : `<div class="list-row-placeholder">${item.type === "movie" ? "🎬" : "📺"}</div>`
        }
      </div>
      <div class="list-row-info">
        <div class="list-row-title">${escapeHtml(item.title)}</div>
        <div class="list-row-meta">
          ${item.year ? `<span>${escapeHtml(item.year)}</span>` : ""}
          ${item.genre ? `<span>${escapeHtml(item.genre.split(",")[0].trim())}</span>` : ""}
          ${item.type === "series" && item.currentSeason ? `<span>${escapeHtml(getNextEpisodeDisplay(item, "compact"))}</span>` : ""}
        </div>
      </div>
      <div class="list-row-right">
        ${stars ? `<span class="list-row-stars">${stars}</span>` : ""}
        <span class="list-row-badge card-badge ${normalizedStatus}">${escapeHtml(statusText)}</span>
        ${item.providerLogo ? `<img src="${escapeHtml(item.providerLogo)}" class="list-row-provider" title="${escapeHtml(item.providerName || "")}" alt="">` : ""}
      </div>
    </div>`;
}

function renderItems() {
  const grid = document.getElementById("contentGrid");
  const emptyState = document.getElementById("emptyState");
  const searchTerm = collectionTagFilter;

  renderWatchingStrip();

  let filtered = items.filter((item) => {
    const matchesSearch =
      item.title.toLowerCase().includes(searchTerm) ||
      (item.genre && item.genre.toLowerCase().includes(searchTerm)) ||
      (item.tags &&
        item.tags.some((tag) => tag.toLowerCase().includes(searchTerm)));
    const matchesType = currentFilter === "all" || item.type === currentFilter;
    const matchesStatus = true;
    return matchesSearch && matchesType && matchesStatus;
  });

  const [sortKey, sortDir] = currentSort.split("-");
  filtered.sort((a, b) => {
    let valA, valB;
    if (sortKey === "date") {
      valA = new Date(a.dateAdded || 0).getTime();
      valB = new Date(b.dateAdded || 0).getTime();
    } else if (sortKey === "title") {
      valA = (a.title || "").toLowerCase();
      valB = (b.title || "").toLowerCase();
      return sortDir === "asc"
        ? valA.localeCompare(valB)
        : valB.localeCompare(valA);
    } else if (sortKey === "rating") {
      valA = a.rating || 0;
      valB = b.rating || 0;
    } else if (sortKey === "year") {
      valA = parseInt(a.year) || 0;
      valB = parseInt(b.year) || 0;
    }
    return sortDir === "asc" ? valA - valB : valB - valA;
  });

  if (filtered.length === 0) {
    grid.style.display = "none";
    emptyState.style.display = "block";
    return;
  }
  emptyState.style.display = "none";

  // Vue liste : s'applique à tous les filtres
  if (currentViewMode === "list") {
    grid.style.display = "block";
    grid.innerHTML = `<div class="list-view">${filtered.map(renderListRow).join("")}</div>`;
    updateStats();
    return;
  }

  const renderCard = (item) => {
    if (item.type === "movie") {
      ensureMovieItemHydrated(item);
    }
    ensureItemProviderUpToDate(item);

    const statusClass = normalizeStatusValue(item.status);
    const itemTypeClass = item.type === "movie" ? "card-movie" : "card-series";
    const itemTypeLabel = item.type === "movie" ? "Film" : "Série";
    const statusText =
      (item.type === "movie" && getUpcomingMovieReleaseLabel(item, true)) ||
      getStatusLabel(statusClass);

    const stars = item.rating
      ? buildRatingStarsHTML(item.rating, {
          includeEmpty: true,
          extraClass: "card-rating-stars-inline",
        })
      : "";
    const ratingText = item.rating ? item.rating.toFixed(1) : "";

    const tagsHtml =
      item.tags && item.tags.length > 0
        ? `<div class="card-tags">
            ${item.tags
              .slice(0, 2)
              .map((tag) => `<span class="card-tag">${escapeHtml(tag)}</span>`)
              .join("")}
          </div>`
        : "";

    // Calcul de la progression pour les séries
    let progressHTML = "";
    if (item.type === "series" && item.currentSeason && item.currentEpisode) {
      progressHTML = `
          <div class="card-progress">
            <div class="card-progress-info">
              <span>${escapeHtml(getNextEpisodeDisplay(item, "compact"))}</span>
            </div>
          </div>`;
    }

    const isActiveSeries = item.type === "series" && item.status !== "watched";
    const canQuickAdvanceSeries = isActiveSeries && isSeriesReleased(item);

    return `
          <div class="card ${itemTypeClass}" onclick="openDetail(${inlineJsString(item.id)})">
            <div class="card-image">
              ${
                item.posterUrl
                  ? `<img src="${escapeHtml(item.posterUrl)}" alt="${escapeHtml(item.title)}">`
                  : `<div class="card-placeholder">${item.type === "movie" ? "🎬" : "📺"}</div>`
              }
              <div class="card-imagefade"></div>
              <div class="card-badge ${statusClass}">${escapeHtml(statusText)}</div>
              ${buildCardProviderHTML(item)}
              ${tagsHtml}
              ${canQuickAdvanceSeries ? `<button class="card-next-ep" onclick="quickNextEpisode(${inlineJsString(item.id)}, event)" title="Épisode suivant">+1 ▶</button>` : ""}
            </div>
            <div class="card-content">
              <div class="card-kicker">${itemTypeLabel}</div>
              <div class="card-title">${escapeHtml(item.title)}</div>
              <div class="card-meta">
                <span>${escapeHtml(item.year) || "—"}</span>
                ${item.genre ? `<span>${escapeHtml(item.genre.split(",")[0].trim())}</span>` : ""}
              </div>
              ${progressHTML}
              ${
                item.rating
                  ? `
                <div class="card-rating">
                  ${stars}
                  <span>${ratingText}</span>
                </div>
              `
                  : ""
              }
            </div>
          </div>
        `;
  };

  const buildMovieRow = (label, key, movieList) => {
    if (!movieList.length) return "";

    const PREVIEW_COUNT = 6;
    const visible = movieList.slice(0, PREVIEW_COUNT);

    return `
      <section class="collection-group">
        <div class="collection-row-header">
          <h3 class="collection-group-title">${label}</h3>
          ${
            movieList.length > PREVIEW_COUNT
              ? `<button class="collection-row-action" onclick="openCollectionBrowse(${inlineJsString(key)}, ${inlineJsString(label)})">Voir tout (${movieList.length})</button>`
              : `<span class="collection-row-count">${movieList.length}</span>`
          }
        </div>
        <div class="grid collection-split-grid">
          ${visible.map(renderCard).join("")}
        </div>
      </section>
    `;
  };

  if (currentFilter === "all") {
    const seriesItems = filtered.filter((item) => item.type === "series");
    const movieItems = filtered.filter((item) => item.type === "movie");

    grid.style.display = "block";
    grid.innerHTML = `
      ${
        seriesItems.length > 0
          ? `
        <section class="collection-group">
          <h3 class="collection-group-title">Séries</h3>
          <div class="grid collection-split-grid">
            ${seriesItems.map(renderCard).join("")}
          </div>
        </section>
      `
          : ""
      }
      ${
        movieItems.length > 0
          ? `
        <section class="collection-group">
          <h3 class="collection-group-title">Films</h3>
          <div class="grid collection-split-grid">
            ${movieItems.map(renderCard).join("")}
          </div>
        </section>
      `
          : ""
      }
    `;
  } else if (currentFilter === "movie") {
    const movieItems = filtered.filter((item) => item.type === "movie");

    movieItems.forEach((item) => {
      if (item.status !== "watched" && !item.releaseDate && item.tmdbId) {
        enrichMovieReleaseDate(item);
      }
    });

    const upcomingItems = movieItems
      .filter((item) => item.status !== "watched" && isUpcomingMovieItem(item))
      .sort((a, b) => {
        const dateA = parseItemDate(a.releaseDate) || new Date(9999, 11, 31);
        const dateB = parseItemDate(b.releaseDate) || new Date(9999, 11, 31);
        return dateA - dateB;
      });
    const towatchItems = movieItems.filter(
      (item) => item.status === "towatch" && !isUpcomingMovieItem(item),
    );
    const watchedItems = movieItems.filter((item) => item.status === "watched");

    const usedIds = new Set([
      ...upcomingItems.map((i) => i.id),
      ...towatchItems.map((i) => i.id),
      ...watchedItems.map((i) => i.id),
    ]);
    const otherItems = movieItems.filter((item) => !usedIds.has(item.id));

    grid.style.display = "block";
    grid.innerHTML = `
      ${buildMovieRow("Films à voir", "towatch", towatchItems)}
      ${buildMovieRow("Films à venir", "upcoming", upcomingItems)}
      ${buildMovieRow("Films vus", "watched", watchedItems)}
      ${buildMovieRow("Autres films", "other", otherItems)}
    `;
  } else if (currentFilter === "series") {
    const seriesItems = filtered.filter((item) => item.type === "series");

    const watchingItems = seriesItems.filter(
      (item) => item.status === "watching",
    );
    const towatchItems = seriesItems.filter(
      (item) => item.status === "towatch",
    );
    const watchedItems = seriesItems.filter(
      (item) => item.status === "watched",
    );

    const usedIds = new Set([
      ...watchingItems.map((i) => i.id),
      ...towatchItems.map((i) => i.id),
      ...watchedItems.map((i) => i.id),
    ]);
    const otherItems = seriesItems.filter((item) => !usedIds.has(item.id));

    grid.style.display = "block";
    grid.innerHTML = `
      ${buildSeriesUpcomingEpisodesRow(seriesItems)}
      ${buildSeriesUpcomingSeasonsRow(seriesItems)}
      ${buildMovieRow("Séries en cours", "seriesWatching", watchingItems)}
      ${buildMovieRow("Séries à voir", "seriesTowatch", towatchItems)}
      ${buildMovieRow("Séries vues", "seriesWatched", watchedItems)}
      ${buildMovieRow("Autres séries", "seriesOther", otherItems)}
    `;
  } else {
    grid.style.display = "grid";
    grid.innerHTML = filtered.map(renderCard).join("");
  }

  updateStats();
  updateCollectionControls();
}

function openCollectionBrowse(key, label) {
  const grid = document.getElementById("contentGrid");
  const emptyState = document.getElementById("emptyState");
  const watchingStrip = document.getElementById("watchingStrip");
  const controls = document.querySelector("#collectionSection .controls");
  const typeSwitch = document.querySelector("#collectionSection .collection-type-switch");
  const panel = document.getElementById("collectionBrowsePanel");
  const browseGrid = document.getElementById("collectionBrowseGrid");
  const browseTitle = document.getElementById("collectionBrowseTitle");
  const browseCount = document.getElementById("collectionBrowseCount");

  // Collect items for this key from the current filtered set
  const renderItems_ = () => {
    const allMovieItems = items.filter((item) => item.type === "movie");
    const allSeriesItems = items.filter((item) => item.type === "series");
    allMovieItems.forEach((item) => {
      if (item.status !== "watched" && !item.releaseDate && item.tmdbId) enrichMovieReleaseDate(item);
    });
    const upcomingItems = allMovieItems.filter((item) => item.status !== "watched" && isUpcomingMovieItem(item));
    const map = {
      towatch:        allMovieItems.filter((item) => item.status === "towatch" && !isUpcomingMovieItem(item)),
      upcoming:       upcomingItems,
      watched:        allMovieItems.filter((item) => item.status === "watched"),
      other:          allMovieItems.filter((item) => !["towatch","watched"].includes(item.status) && !isUpcomingMovieItem(item)),
      seriesWatching: allSeriesItems.filter((item) => item.status === "watching"),
      seriesTowatch:  allSeriesItems.filter((item) => item.status === "towatch"),
      seriesWatched:  allSeriesItems.filter((item) => item.status === "watched"),
      seriesOther:    allSeriesItems.filter((item) => !["watching","towatch","watched"].includes(item.status)),
    };
    return map[key] || [];
  };

  collectionBrowseItems = renderItems_();
  collectionBrowseLabel = label;

  if (grid) grid.style.display = "none";
  if (emptyState) emptyState.style.display = "none";
  if (watchingStrip) watchingStrip.style.display = "none";
  if (controls) controls.style.display = "none";
  if (typeSwitch) typeSwitch.style.display = "none";
  panel.style.display = "block";

  browseTitle.textContent = label;
  browseCount.textContent = `${collectionBrowseItems.length} titre${collectionBrowseItems.length > 1 ? "s" : ""}`;
  browseGrid.innerHTML = collectionBrowseItems.map((item) => {
    ensureItemProviderUpToDate(item);
    const statusClass = normalizeStatusValue(item.status);
    const itemTypeClass = item.type === "movie" ? "card-movie" : "card-series";
    const itemTypeLabel = item.type === "movie" ? "Film" : "Série";
    const statusText = (item.type === "movie" && getUpcomingMovieReleaseLabel(item, true)) || getStatusLabel(statusClass);
    const stars = item.rating ? buildRatingStarsHTML(item.rating, { includeEmpty: true, extraClass: "card-rating-stars-inline" }) : "";
    const ratingText = item.rating ? item.rating.toFixed(1) : "";
    let progressHTML = "";
    if (item.type === "series" && item.currentSeason && item.currentEpisode) {
      progressHTML = `<div class="card-progress"><div class="card-progress-info"><span>${escapeHtml(getNextEpisodeDisplay(item, "compact"))}</span></div></div>`;
    }
    return `
      <div class="card ${itemTypeClass}" onclick="openDetail(${inlineJsString(item.id)})">
        <div class="card-image">
          ${item.posterUrl ? `<img src="${escapeHtml(item.posterUrl)}" alt="${escapeHtml(item.title)}">` : `<div class="card-placeholder">${item.type === "movie" ? "🎬" : "📺"}</div>`}
          <div class="card-imagefade"></div>
          <div class="card-badge ${statusClass}">${escapeHtml(statusText)}</div>
          ${buildCardProviderHTML(item)}
        </div>
        <div class="card-content">
          <div class="card-kicker">${itemTypeLabel}</div>
          <div class="card-title">${escapeHtml(item.title)}</div>
          <div class="card-meta">
            <span>${escapeHtml(item.year) || "—"}</span>
            ${item.genre ? `<span>${escapeHtml(item.genre.split(",")[0].trim())}</span>` : ""}
          </div>
          ${progressHTML}
          ${item.rating ? `<div class="card-rating">${stars}<span>${ratingText}</span></div>` : ""}
        </div>
      </div>`;
  }).join("");
}

function closeCollectionBrowse() {
  const panel = document.getElementById("collectionBrowsePanel");
  const controls = document.querySelector("#collectionSection .controls");
  const typeSwitch = document.querySelector("#collectionSection .collection-type-switch");
  panel.style.display = "none";
  if (controls) controls.style.display = "";
  if (typeSwitch) typeSwitch.style.display = "";
  renderItems();
}

function updateStats() {
  const stats = {
    total: items.length,
    watched: items.filter((i) => i.status === "watched").length,
    watching: items.filter((i) => i.status === "watching").length,
    towatch: items.filter((i) => i.status === "towatch").length,
    movies: items.filter((i) => i.type === "movie").length,
    series: items.filter((i) => i.type === "series").length,
  };

  document.getElementById("statsGrid").innerHTML = `
        <div class="stat-card">
          <div class="stat-value">${stats.total}</div>
          <div class="stat-label">Total</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${stats.movies}</div>
          <div class="stat-label">Films</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${stats.series}</div>
          <div class="stat-label">Séries</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${stats.watched}</div>
          <div class="stat-label">Vus</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${stats.watching}</div>
          <div class="stat-label">En cours</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${stats.towatch}</div>
          <div class="stat-label">À voir</div>
        </div>
      `;
}

function renderStats() {
  const totalMinutes = items.reduce((acc, item) => {
    if (item.type === "movie" && item.status === "watched") {
      return acc + 120;
    } else if (
      item.type === "series" &&
      item.currentSeason &&
      item.currentEpisode
    ) {
      const episodes = (item.currentSeason - 1) * 24 + item.currentEpisode;
      return acc + episodes * 45;
    }
    return acc;
  }, 0);
  const hours = Math.floor(totalMinutes / 60);
  document.getElementById("totalHours").textContent = `${hours}h`;

  const watchedCount = items.filter((i) => i.status === "watched").length;
  const completionRate =
    items.length > 0 ? Math.round((watchedCount / items.length) * 100) : 0;
  document.getElementById("completionRate").textContent = `${completionRate}%`;

  const activeSeries = items.filter(
    (i) => i.type === "series" && i.status === "watching",
  ).length;
  document.getElementById("activeSeries").textContent = activeSeries;

  const remainingMinutes = items.reduce((acc, item) => {
    if (item.status === "watched") return acc;
    if (item.type === "movie") return acc + CONSTANTS.MOVIE_AVERAGE_DURATION;

    const progress = getSeriesEpisodeProgress(item);
    return (
      acc + progress.remainingEpisodes * CONSTANTS.EPISODE_AVERAGE_DURATION
    );
  }, 0);

  document.getElementById("remainingHours").textContent = `${Math.floor(
    remainingMinutes / 60,
  )}h`;

  const ratedItems = items.filter((i) => i.rating);
  const avgRating =
    ratedItems.length > 0
      ? (
          ratedItems.reduce((acc, i) => acc + i.rating, 0) / ratedItems.length
        ).toFixed(1)
      : "0";
  document.getElementById("avgRating").textContent = avgRating;

  const now = new Date();
  // Utilise watchedAt pour les items vus, dateAdded sinon
  const watchDate = (i) => new Date(i.watchedAt || i.dateAdded);
  const thisMonth = items.filter((i) => {
    const date = watchDate(i);
    return (
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear()
    );
  }).length;
  const thisYear = items.filter((i) => {
    return watchDate(i).getFullYear() === now.getFullYear();
  }).length;
  document.getElementById("thisMonth").textContent = thisMonth;
  document.getElementById("thisYear").textContent = thisYear;

  const genreCount = {};
  items.forEach((item) => {
    if (item.genre) {
      item.genre.split(",").forEach((g) => {
        const genre = g.trim();
        genreCount[genre] = (genreCount[genre] || 0) + 1;
      });
    }
  });

  const sortedGenres = Object.entries(genreCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  const maxCount = sortedGenres[0]?.[1] || 1;

  document.getElementById("genresChart").innerHTML = sortedGenres.length
    ? sortedGenres
        .map(([genre, count]) => {
          const pct = Math.round((count / maxCount) * 100);
          const label = `${genre} : ${count} contenu${count > 1 ? "s" : ""}, ${pct}% du top genres`;
          return `
        <div class="genre-bar genre-bar-active" title="${escapeHtml(label)}" aria-label="${escapeHtml(label)}">
          <div class="genre-bar-header">
            <span class="genre-bar-name">${escapeHtml(genre)}</span>
            <span class="genre-bar-count">${count}</span>
          </div>
          <div class="genre-bar-track">
            <div class="genre-bar-fill" style="width: ${pct}%"></div>
          </div>
        </div>
      `;
        })
        .join("")
    : '<p class="stats-empty">Aucun genre assez représenté pour le moment.</p>';

  renderProvidersChart();
  renderMonthlyChart();
  renderRatingDistribution();
  renderHeatmap();
}

function renderHistory() {
  const el = document.getElementById("recentActivity");
  if (!el) return;

  const watchedHistory = [...items]
    .filter((i) => i.watchedAt)
    .sort((a, b) => new Date(b.watchedAt) - new Date(a.watchedAt))
    .slice(0, 30);

  const recentAdded = [...items]
    .filter((i) => !i.watchedAt)
    .sort((a, b) => new Date(b.dateAdded) - new Date(a.dateAdded))
    .slice(0, 10);

  const historyItems = watchedHistory.length > 0 ? watchedHistory : recentAdded;

  el.innerHTML =
    historyItems.length === 0
      ? '<p class="stats-empty">Aucun visionnage enregistré pour l\'instant.</p>'
      : historyItems
          .map((item) => {
            const isWatched = !!item.watchedAt;
            const date = new Date(isWatched ? item.watchedAt : item.dateAdded);
            const dateStr = date.toLocaleDateString("fr-FR", {
              day: "numeric",
              month: "long",
              year: "numeric",
            });
            const watchedDateStr =
              isWatched && item.watchedDate
                ? formatDateInputDisplay(item.watchedDate)
                : dateStr;
            const watchedWithNames = getWatchedWithNames(item.watchedWith);
            const noteExcerpt = buildHistoryNoteExcerpt(item.notes);
            const hasRating = normalizeHalfStepRating(item.rating) > 0;
            const stars = hasRating
              ? buildRatingStarsHTML(item.rating, {
                  includeEmpty: false,
                  extraClass: "history-rating-stars",
                })
              : "";
            const typeIcon = item.type === "movie" ? "🎬" : "📺";
            const historyClasses = [
              "timeline-item",
              "history-item",
              hasRating ? "history-item-rated" : "history-item-unrated",
              item.type === "series"
                ? "history-item-series"
                : "history-item-movie",
            ].join(" ");
            return `
        <div class="${historyClasses}" onclick="openDetail(${inlineJsString(item.id)})">
          <div class="history-poster">
            ${
              item.posterUrl
                ? `<img src="${escapeHtml(item.posterUrl)}" alt="${escapeHtml(item.title)}">`
                : `<div class="history-poster-placeholder">${typeIcon}</div>`
            }
          </div>
          <div class="timeline-content">
            <div class="timeline-date">${isWatched ? "Vu le " : "Ajouté le "}${watchedDateStr}</div>
            <div class="timeline-text">
              <strong>${escapeHtml(item.title)}</strong>
              ${item.year ? `<span class="history-year"> · ${escapeHtml(item.year)}</span>` : ""}
            </div>
            ${stars ? `<div class="history-rating">${stars} <span class="history-rating-value">${formatRatingDisplayValue(item.rating)}/5</span></div>` : ""}
            ${
              watchedWithNames.length
                ? `<div class="history-extra"><span class="history-extra-label">Vu avec</span>${buildHistoryPeopleList(watchedWithNames)}</div>`
                : ""
            }
            ${noteExcerpt ? `<div class="history-note">${noteExcerpt}</div>` : ""}
          </div>
        </div>
      `;
          })
          .join("");
}

function renderProvidersChart() {
  const container = document.getElementById("providersChart");
  if (!container) return;

  const counts = {};
  const logos = {};
  items.forEach((item) => {
    if (!item.providerName) return;
    const name = item.providerName;
    counts[name] = (counts[name] || 0) + 1;
    if (!logos[name] && item.providerLogo) logos[name] = item.providerLogo;
  });

  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const max = sorted[0]?.[1] || 1;

  container.innerHTML = sorted.length
    ? sorted.map(([name, count]) => {
        const pct = Math.round((count / max) * 100);
        const logoHtml = logos[name]
          ? `<img class="provider-bar-logo" src="${escapeHtml(logos[name])}" alt="" aria-hidden="true">`
          : "";
        return `
        <div class="genre-bar genre-bar-active">
          <div class="genre-bar-header">
            <span class="genre-bar-name provider-bar-name">${logoHtml}${escapeHtml(name)}</span>
            <span class="genre-bar-count">${count}</span>
          </div>
          <div class="genre-bar-track">
            <div class="genre-bar-fill" style="width:${pct}%"></div>
          </div>
        </div>`;
      }).join("")
    : '<p class="stats-empty">Aucune plateforme enregistrée pour le moment.</p>';
}

function renderMonthlyChart() {
  const container = document.getElementById("monthlyChart");
  if (!container) return;

  const now = new Date();
  const months = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      label: d.toLocaleDateString("fr-FR", { month: "short" }),
      year: d.getFullYear(),
      month: d.getMonth(),
      movies: 0,
      series: 0,
    });
  }

  items.forEach((item) => {
    const d = new Date(item.watchedAt || item.dateAdded);
    const m = months.find(
      (m) => m.year === d.getFullYear() && m.month === d.getMonth(),
    );
    if (m) {
      if (item.type === "movie") m.movies++;
      else m.series++;
    }
  });

  const max = Math.max(...months.map((m) => m.movies + m.series), 1);

  container.innerHTML = `
    <div class="monthly-bars">
      ${months
        .map((m) => {
          const total = m.movies + m.series;
          const pctMovies = Math.round((m.movies / max) * 100);
          const pctSeries = Math.round((m.series / max) * 100);
          const isCurrentMonth =
            m.year === now.getFullYear() && m.month === now.getMonth();
          const colClasses = [
            "monthly-col",
            total > 0 ? "monthly-col-active" : "monthly-col-empty",
            isCurrentMonth ? "monthly-col-current" : "",
          ]
            .filter(Boolean)
            .join(" ");
          const label = `${m.label} : ${total} ajout${total > 1 ? "s" : ""} (${m.movies} film${m.movies > 1 ? "s" : ""}, ${m.series} série${m.series > 1 ? "s" : ""})`;
          return `
              <div class="${colClasses}" title="${label}" aria-label="${label}">
                <div class="monthly-bar-wrap">
                  ${total > 0 ? `<span class="monthly-val">${total}</span>` : ""}
                  <div class="monthly-bar-stack">
                    <div class="monthly-bar monthly-bar-series" style="height:${pctSeries}%"></div>
                    <div class="monthly-bar monthly-bar-movies" style="height:${pctMovies}%"></div>
                  </div>
                </div>
                <div class="monthly-label ${isCurrentMonth ? "monthly-label-current" : ""}">${m.label}</div>
              </div>
            `;
        })
        .join("")}
    </div>
    <div class="monthly-legend">
      <span class="monthly-legend-group"><span class="monthly-legend-dot monthly-legend-movie"></span> Films</span>
      <span class="monthly-legend-group"><span class="monthly-legend-dot monthly-legend-serie"></span> Séries</span>
    </div>
  `;
}

function renderRatingDistribution() {
  const container = document.getElementById("ratingChart");
  if (!container) return;

  const ratingSteps = Array.from({ length: 10 }, (_, index) =>
    (10 - index) / 2,
  );
  const dist = Object.fromEntries(
    ratingSteps.map((step) => [formatRatingDisplayValue(step), 0]),
  );

  items.forEach((item) => {
    if (item.rating) {
      const r = normalizeHalfStepRating(item.rating);
      if (r >= 0.5) {
        const key = formatRatingDisplayValue(r);
        if (Object.prototype.hasOwnProperty.call(dist, key)) {
          dist[key]++;
        }
      }
    }
  });

  const total = Object.values(dist).reduce((a, b) => a + b, 0);
  const max = Math.max(...Object.values(dist), 1);

  if (total === 0) {
    container.innerHTML =
      '<p class="stats-empty">Aucun contenu noté pour l\'instant.</p>';
    return;
  }

  container.innerHTML = Object.entries(dist)
    .map(([starLabel, count]) => {
      const starValue = Number.parseFloat(starLabel);
      const pct = total > 0 ? Math.round((count / total) * 100) : 0;
      const width = Math.round((count / max) * 100);
      const rowClass = `rating-dist-row ${count > 0 ? "rating-dist-row-active" : "rating-dist-row-empty"}`;
      const label = `${starLabel} étoile${starValue > 1 ? "s" : ""} : ${count} note${count > 1 ? "s" : ""}, ${pct}%`;
      return `
      <div class="${rowClass}" title="${label}" aria-label="${label}">
        <div class="rating-dist-label">${buildRatingStarsHTML(starValue, { includeEmpty: true, extraClass: "rating-dist-stars-inline" })}</div>
        <div class="rating-dist-bar-wrap">
          <div class="rating-dist-bar" style="width:${width}%"></div>
        </div>
        <div class="rating-dist-count">${count}</div>
        <div class="rating-dist-pct">${pct}%</div>
      </div>
    `;
    })
    .join("");
}

function renderHeatmap() {
  const container = document.getElementById("heatmapChart");
  if (!container) return;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Start from Monday of the week 52 weeks ago
  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - 364);
  const dow = startDate.getDay();
  startDate.setDate(startDate.getDate() - (dow === 0 ? 6 : dow - 1));

  // Build date -> count map (préfère watchedAt si disponible)
  const countMap = {};
  items.forEach((item) => {
    const d = new Date(item.watchedAt || item.dateAdded);
    d.setHours(0, 0, 0, 0);
    const key = d.toISOString().slice(0, 10);
    countMap[key] = (countMap[key] || 0) + 1;
  });

  // Build weeks array (each week = array of 7 days Mon→Sun)
  const weeks = [];
  const current = new Date(startDate);
  while (current <= today) {
    const week = [];
    for (let d = 0; d < 7; d++) {
      if (current > today) {
        week.push(null);
      } else {
        const key = current.toISOString().slice(0, 10);
        week.push({ date: new Date(current), count: countMap[key] || 0 });
      }
      current.setDate(current.getDate() + 1);
    }
    weeks.push(week);
  }

  // Month label positions
  const monthLabels = [];
  weeks.forEach((week, i) => {
    const firstDay = week.find((d) => d !== null);
    if (!firstDay) return;
    const d = firstDay.date;
    if (i === 0 || d.getDate() <= 7) {
      monthLabels.push({
        col: i,
        label: d.toLocaleDateString("fr-FR", { month: "short" }),
      });
    }
  });

  const cellColor = (count) => {
    if (count === 0) return "var(--heatmap-empty, #ebedf0)";
    if (count === 1) return "#c6e48b";
    if (count === 2) return "#7bc96f";
    if (count === 3) return "#239a3b";
    return "#196127";
  };

  const activeDays = Object.values(countMap).filter(
    (count) => count > 0,
  ).length;
  const peakDayCount = Math.max(0, ...Object.values(countMap));

  const dayLabels = ["L", "", "M", "", "J", "", "S"];

  let html = `<div class="heatmap-container">`;

  // Month labels row — one div per week, show label only when month changes
  html += `<div class="heatmap-months">`;
  let lastMonthLabel = "";
  weeks.forEach((week) => {
    const firstDay = week.find((d) => d !== null);
    const label = firstDay
      ? firstDay.date.toLocaleDateString("fr-FR", { month: "short" })
      : "";
    const show = label && label !== lastMonthLabel;
    if (show) lastMonthLabel = label;
    html += `<div class="heatmap-month-label">${show ? label : ""}</div>`;
  });
  html += `</div>`;

  // Grid body
  html += `<div class="heatmap-body">`;

  // Day labels column
  html += `<div class="heatmap-day-col">`;
  dayLabels.forEach(
    (l) => (html += `<div class="heatmap-day-label">${l}</div>`),
  );
  html += `</div>`;

  // Week columns
  weeks.forEach((week) => {
    html += `<div class="heatmap-week">`;
    week.forEach((day) => {
      if (day === null) {
        html += `<div class="heatmap-cell heatmap-cell-empty"></div>`;
      } else {
        const dateStr = day.date.toLocaleDateString("fr-FR", {
          day: "numeric",
          month: "short",
          year: "numeric",
        });
        const title =
          day.count > 0
            ? `${day.count} ajout${day.count > 1 ? "s" : ""} — ${dateStr}`
            : dateStr;
        const levelClass =
          day.count === 0
            ? "heatmap-cell-level-0"
            : day.count === 1
              ? "heatmap-cell-level-1"
              : day.count === 2
                ? "heatmap-cell-level-2"
                : day.count === 3
                  ? "heatmap-cell-level-3"
                  : "heatmap-cell-level-4";
        html += `<div class="heatmap-cell ${levelClass}" style="background:${cellColor(day.count)}" title="${escapeHtml(title)}"></div>`;
      }
    });
    html += `</div>`;
  });

  html += `</div>`; // heatmap-body
  html += `
    <div class="heatmap-legend">
      <span class="heatmap-legend-copy">${activeDays} jours actifs</span>
      <div class="heatmap-legend-scale" aria-hidden="true">
        <span class="heatmap-legend-cell heatmap-cell-level-0"></span>
        <span class="heatmap-legend-cell heatmap-cell-level-1"></span>
        <span class="heatmap-legend-cell heatmap-cell-level-2"></span>
        <span class="heatmap-legend-cell heatmap-cell-level-3"></span>
        <span class="heatmap-legend-cell heatmap-cell-level-4"></span>
      </div>
      <span class="heatmap-legend-copy">pic : ${peakDayCount}</span>
    </div>
  `;
  html += `</div>`; // heatmap-container

  container.innerHTML = html;
}

function renderLists() {
  const allTags = [
    ...new Set(items.flatMap((i) => stripHiddenSystemTags(i.tags || []))),
  ].sort();
  const totalTaggedItems = items.filter(
    (item) => stripHiddenSystemTags(item.tags || []).length > 0,
  ).length;
  const introEl = document.querySelector("#listsSection .lists-intro");

  if (introEl) {
    introEl.innerHTML = `
      <span class="lists-intro-copy">Organisez vos contenus par tags</span>
      <span class="lists-intro-stats">
        <span class="lists-intro-pill">${allTags.length} liste${allTags.length > 1 ? "s" : ""}</span>
        <span class="lists-intro-pill">${totalTaggedItems} contenu${totalTaggedItems > 1 ? "s" : ""}</span>
      </span>
    `;
  }

  if (allTags.length === 0) {
    document.getElementById("tagFilters").innerHTML = "";
    document.getElementById("taggedContent").innerHTML = `
          <div class="empty-state lists-empty-state">
            <div class="empty-icon">🏷️</div>
            <p class="empty-text">Vous n'avez pas encore de tags personnalisés</p>
          </div>
        `;
    return;
  }

  document.getElementById("tagFilters").innerHTML = `
        <div class="filters">
          ${allTags
            .map((tag) => {
              const tagCount = items.filter(
                (item) => item.tags && item.tags.includes(tag),
              ).length;
              return `
            <button class="filter-tag" onclick="filterByTag(${inlineJsString(tag)})">
              <span class="lists-filter-label">${escapeHtml(tag)}</span>
              <span class="lists-filter-count">${tagCount}</span>
            </button>
          `;
            })
            .join("")}
        </div>
      `;

  const taggedItemsHtml = allTags
    .map((tag) => {
      const tagItems = items.filter((i) => i.tags && i.tags.includes(tag));
      return `
          <section class="lists-tag-group">
            <div class="lists-tag-header">
              <div class="lists-tag-heading">
                <div class="lists-tag-eyebrow">Liste curatée</div>
                <h4 class="lists-tag-title">
                  ${escapeHtml(tag)} <span class="lists-tag-count">${tagItems.length}</span>
                </h4>
              </div>
            </div>
            <div class="lists-poster-grid">
              ${tagItems.map((item) => `
                <div class="lists-poster-item" onclick="openDetail(${inlineJsString(item.id)})" title="${escapeHtml(item.title)}">
                  ${item.posterUrl ? `<img src="${escapeHtml(item.posterUrl)}" alt="${escapeHtml(item.title)}">` : `<div class="lists-poster-placeholder">${item.type === "movie" ? "🎬" : "📺"}</div>`}
                </div>`).join("")}
            </div>
          </section>
        `;
    })
    .join("");

  document.getElementById("taggedContent").innerHTML = taggedItemsHtml;
  renderHistory();
}

function filterByTag(tag) {
  collectionTagFilter = tag.toLowerCase();
  switchTab("collection", document.querySelector(".nav-item"));
  setTimeout(() => renderItems(), 100);
}

function openAddModal() {
  document.getElementById("addModal").classList.add("active");
  document.getElementById("addForm").reset();
  document.getElementById("tmdbSearch").value = "";
  document.getElementById("searchResults").innerHTML = "";
  const titleInput = document.getElementById("titleInput");
  delete titleInput.dataset.poster;
  delete titleInput.dataset.tmdbId;
  delete titleInput.dataset.providerLogo;
  delete titleInput.dataset.providerName;
  delete titleInput.dataset.releaseDate;
  currentItemId = null;
  currentTags = [];
  currentWatchedWith = [];
  currentSeason = 1;
  currentEpisode = 1;
  updateEpisodeDisplay();
  renderTags();
  renderWatchedWith();
  updateSelectedTMDBUI(null);
  selectAddStatus("towatch");
  document.getElementById("ratingInput").value = "";
  updateStarPicker("");
  initStarPicker();
  const tmdbSearchGroup = document.getElementById("tmdbSearchGroup");
  if (tmdbSearchGroup) tmdbSearchGroup.style.display = "";
  const watchedDateInput = document.getElementById("watchedDateInput");
  if (watchedDateInput) watchedDateInput.value = "";
  const watchedWithInput = document.getElementById("watchedWithInput");
  if (watchedWithInput) watchedWithInput.value = "";
}

function closeAddModal() {
  document.getElementById("addModal").classList.remove("active");
}

function getTrailerKey(tmdb) {
  if (!tmdb?.videos?.results?.length) return null;
  const videos = tmdb.videos.results.filter((v) => v.site === "YouTube");
  return (
    (
      videos.find((v) => v.type === "Trailer" && v.official) ||
      videos.find((v) => v.type === "Trailer") ||
      videos.find((v) => v.type === "Teaser") ||
      videos[0]
    )?.key || null
  );
}

function buildTrailerHTML(trailerKey) {
  if (!trailerKey) return "";
  return `
    <div class="detail-trailer detail-feature-video">
      <div class="trailer-thumb" onclick="loadTrailer(this, '${escapeHtml(trailerKey)}')">
        <img src="https://img.youtube.com/vi/${escapeHtml(trailerKey)}/mqdefault.jpg" alt="Bande-annonce" class="trailer-img">
        <div class="trailer-play">▶</div>
      </div>
    </div>
  `;
}

function buildDetailTextSurface(title, text, surfaceClass = "") {
  if (!text) return "";

  return `
    <section class="detail-feature-surface ${surfaceClass}">
      <div class="detail-feature-header">
        <div class="sd-section-title">${escapeHtml(title)}</div>
      </div>
      <div class="detail-feature-copy">
        <p>${escapeHtml(text)}</p>
      </div>
    </section>
  `;
}

function buildDetailMediaSurface(title, content, surfaceClass = "") {
  if (!content) return "";

  return `
    <section class="detail-feature-surface ${surfaceClass}">
      <div class="detail-feature-header">
        <div class="sd-section-title">${escapeHtml(title)}</div>
      </div>
      <div class="detail-feature-media">${content}</div>
    </section>
  `;
}

function buildDetailInfoRow(label, valueHtml, rowClass = "") {
  if (!valueHtml) return "";

  const rowClassAttr = rowClass ? ` ${rowClass}` : "";
  return `<div class="detail-row${rowClassAttr}"><div class="detail-label">${escapeHtml(label)}</div><div class="detail-value">${valueHtml}</div></div>`;
}

function buildDetailTagList(tags) {
  if (!tags?.length) return "";
  return `<div class="detail-tag-list">${tags.map((tag) => `<span class="detail-tag-chip">${escapeHtml(tag)}</span>`).join("")}</div>`;
}

function getWatchedWithNames(value) {
  const rawNames = Array.isArray(value)
    ? value
    : String(value || "")
        .split(/[,;]+/)
        .map((name) => name.trim());

  return [...new Set(rawNames.filter(Boolean))];
}

function formatDateInputDisplay(value) {
  const [year, month, day] = String(value || "")
    .split("-")
    .map((part) => Number.parseInt(part, 10));

  if (!year || !month || !day) return "";

  return new Date(year, month - 1, day).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatWatchedWithInput(value) {
  return getWatchedWithNames(value).join(", ");
}

function buildWatchedWithList(value) {
  return buildDetailTagList(getWatchedWithNames(value));
}

function buildHistoryPeopleList(names) {
  if (!names?.length) return "";
  return `<span class="history-people-list">${names
    .map((name) => `<span class="history-person-chip">${escapeHtml(name)}</span>`)
    .join("")}</span>`;
}

function buildHistoryNoteExcerpt(notes) {
  const cleanNotes = String(notes || "").trim();
  if (!cleanNotes) return "";

  const excerpt =
    cleanNotes.length > 120 ? `${cleanNotes.slice(0, 120).trim()}...` : cleanNotes;
  return escapeHtml(excerpt).replace(/\n/g, "<br>");
}

function buildTmdbRatingInline(score, voteCount) {
  if (!score) return "";
  return `<span class="detail-rating-inline"><span class="detail-rating-stars">★</span><span>${score}/5</span><span class="detail-muted-meta">(${voteCount ? voteCount.toLocaleString() : "?"} votes)</span></span>`;
}

function buildUserRatingInline(rating) {
  if (!rating) return "";
  const stars = buildRatingStarsHTML(rating, {
    includeEmpty: true,
    extraClass: "detail-rating-stars detail-rating-stars-user",
  });
  return `<span class="detail-rating-inline">${stars}<span class="detail-muted-meta-strong">${formatRatingDisplayValue(rating)}/5</span></span>`;
}

function loadTrailer(container, key) {
  container.innerHTML = `
    <iframe
      src="https://www.youtube.com/embed/${escapeHtml(key)}?autoplay=1"
      class="trailer-iframe"
      allowfullscreen
      allow="autoplay; encrypted-media">
    </iframe>
  `;
}

function normalizeWatchProviders(payload, region = TMDB_WATCH_REGION) {
  const regionData = payload?.results?.[region];
  if (!regionData) return null;

  const groupLabels = {
    flatrate: "Streaming",
    free: "Gratuit",
    ads: "Avec pub",
    rent: "Location",
    buy: "Achat",
  };

  const groups = WATCH_PROVIDER_GROUP_ORDER.map((groupKey) => ({
    key: groupKey,
    label: groupLabels[groupKey] || groupKey,
  }))
    .map((group) => ({
      ...group,
      providers: [...(regionData[group.key] || [])]
        .sort(compareProvidersByPriority)
        .slice(0, 8),
    }))
    .filter((group) => group.providers.length > 0);

  if (groups.length === 0) return null;

  return {
    region,
    link: regionData.link || "",
    groups,
  };
}

function getPrimaryWatchProvider(watchProviders, options = {}) {
  const includedOnly = Boolean(options.includedOnly);
  const sortedGroups = Array.isArray(watchProviders?.groups)
    ? [...watchProviders.groups].sort(
        (leftGroup, rightGroup) =>
          WATCH_PROVIDER_GROUP_ORDER.indexOf(leftGroup?.key) -
          WATCH_PROVIDER_GROUP_ORDER.indexOf(rightGroup?.key),
      )
    : [];
  const group = sortedGroups.find(
    (candidateGroup) =>
      (!includedOnly ||
        WATCH_PROVIDER_INCLUDED_GROUPS.has(candidateGroup?.key)) &&
      Array.isArray(candidateGroup?.providers) &&
      candidateGroup.providers.length > 0,
  );
  const provider = group?.providers?.[0];
  if (!provider) return null;

  return {
    providerName: provider.provider_name || "",
    providerLogo: provider.logo_path
      ? `https://image.tmdb.org/t/p/w92${provider.logo_path}`
      : null,
    providerAccessType: group?.key || null,
  };
}

function getUserMatchingWatchProvider(watchProviders) {
  if (!userProviderKeys.length || !Array.isArray(watchProviders?.groups)) {
    return null;
  }

  for (const group of watchProviders.groups) {
    if (!WATCH_PROVIDER_INCLUDED_GROUPS.has(group?.key || "")) continue;
    const provider = (group.providers || []).find((candidate) =>
      userProviderKeys.includes(getProviderPriorityKey(candidate.provider_name)),
    );
    if (provider) {
      return {
        providerName: provider.provider_name || "",
        providerLogo: provider.logo_path
          ? `https://image.tmdb.org/t/p/w92${provider.logo_path}`
          : null,
        providerAccessType: group.key || null,
      };
    }
  }

  return null;
}

function getUserMatchingNetworkProvider(tmdbDetails) {
  if (!userProviderKeys.length || !Array.isArray(tmdbDetails?.networks)) {
    return null;
  }

  const network = tmdbDetails.networks.find((candidate) =>
    userProviderKeys.includes(getProviderPriorityKey(candidate.name)),
  );
  if (!network) return null;

  return {
    providerName: network.name || "",
    providerLogo: network.logo_path
      ? `https://image.tmdb.org/t/p/w92${network.logo_path}`
      : null,
    providerAccessType: "flatrate",
  };
}

function getPrimaryStreamingNetworkProvider(tmdbDetails) {
  if (!Array.isArray(tmdbDetails?.networks)) return null;

  const network = tmdbDetails.networks.find((candidate) =>
    STREAMING_PROVIDER_PRIORITY.includes(getProviderPriorityKey(candidate.name)),
  );
  if (!network) return null;

  return {
    providerName: network.name || "",
    providerLogo: network.logo_path
      ? `https://image.tmdb.org/t/p/w92${network.logo_path}`
      : null,
    providerAccessType: "flatrate",
  };
}

function setProviderDataset(input, watchProviders) {
  const provider = getPrimaryWatchProvider(watchProviders, {
    includedOnly: true,
  });
  if (provider?.providerLogo) {
    input.dataset.providerLogo = provider.providerLogo;
    input.dataset.providerName = provider.providerName;
    input.dataset.providerAccessType = provider.providerAccessType || "";
    return;
  }

  delete input.dataset.providerLogo;
  delete input.dataset.providerName;
  delete input.dataset.providerAccessType;
}

function buildCardProviderHTML(item) {
  if (!item.providerLogo) return "";

  return `
    <div class="card-provider" title="Disponible sur ${escapeHtml(item.providerName || "plateforme")}">
      <img src="${escapeHtml(item.providerLogo)}" alt="${escapeHtml(item.providerName || "Plateforme")}" class="card-provider-logo">
    </div>
  `;
}

function buildSeasonsHTML(item, tmdb) {
  if (item.type !== "series") return "";

  // Construire la liste des saisons depuis TMDB ou depuis seasonData local
  let seasons = [];
  if (tmdb?.seasons) {
    seasons = tmdb.seasons
      .filter((s) => s.season_number > 0)
      .map((s) => ({
        number: s.season_number,
        name: s.name || `Saison ${s.season_number}`,
        episodeCount: s.episode_count,
        posterPath: s.poster_path,
        airDate: s.air_date,
      }));
  } else if (item.seasonData) {
    seasons = Object.entries(item.seasonData).map(([num, count]) => ({
      number: parseInt(num),
      name: `Saison ${num}`,
      episodeCount: count,
      posterPath: null,
      airDate: null,
    }));
  }

  if (seasons.length === 0) return "";

  const currentSeason = item.currentSeason || 1;
  const currentEpisode = item.currentEpisode || 1;
  const canQuickAdvanceSeries = isSeriesReleased(item);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const seasonsHTML = seasons
    .map((season) => {
      const epCount = season.episodeCount || 0;
      const seasonState = getSeasonProgressState(item, season.number, epCount);
      const isCurrent = seasonState.isCurrent;
      const isDone = seasonState.isDone;
      const isStarted = season.number <= currentSeason;
      const epDone = seasonState.watchedEpisodes;
      const pct = epCount > 0 ? seasonState.pct : null;

      const statusIcon = isDone ? "✓" : isCurrent ? "▶" : "○";
      const statusColor = isDone
        ? "var(--success,#10b981)"
        : isCurrent
          ? "var(--accent)"
          : "var(--text-tertiary)";

      return `
      <div class="season-row ${isCurrent ? "season-current" : ""} ${isDone ? "season-done" : ""}">
        <div class="season-header">
          <div class="season-status" style="color:${statusColor}">${statusIcon}</div>
          <div class="season-info">
            <div class="season-name">${escapeHtml(season.name)}</div>
            <div class="season-meta">
              ${epCount ? `${isStarted ? epDone : 0}/${epCount} épisodes` : "— épisodes"}
              ${season.airDate ? ` · ${new Date(season.airDate).getFullYear()}` : ""}
            </div>
            ${
              pct !== null && epCount > 0
                ? `
              <div class="season-progress-bar">
                <div class="season-progress-fill" style="width:${pct}%"></div>
              </div>`
                : ""
            }
          </div>
          <div class="season-actions">
            ${
              !isDone && epCount > 0
                ? `<button class="btn season-btn" onclick="markSeasonDone(${inlineJsString(item.id)}, ${season.number}, event)">Terminée ✓</button>`
                : ""
            }
            ${
              !isCurrent && !isDone && season.airDate
                ? `<button class="btn season-btn" onclick="jumpToSeason(${inlineJsString(item.id)}, ${season.number}, ${inlineJsString(season.airDate)}, event)">Reprendre</button>`
                : ""
            }
            ${
              isCurrent && canQuickAdvanceSeries
                ? `<button class="btn season-btn season-btn-active" onclick="quickNextEpisodeInDetail(${inlineJsString(item.id)}, event)">+1 ▶</button>`
                : ""
            }
          </div>
        </div>
      </div>`;
    })
    .join("");

  return `
    <div class="detail-seasons">
      <div class="form-label" style="margin-bottom:12px;">Saisons</div>
      ${seasonsHTML}
    </div>`;
}

function jumpToSeason(itemId, season, seasonAirDate, event) {
  event.stopPropagation();
  const idx = items.findIndex((i) => i.id === itemId);
  if (idx === -1) return;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const parsedSeasonAirDate = parseItemDate(seasonAirDate);

  if (parsedSeasonAirDate && parsedSeasonAirDate > today) {
    showToast("Saison pas encore sortie");
    return;
  }

  if (season === 1 && !isSeriesReleased(items[idx])) {
    showToast("Série pas encore sortie");
    return;
  }

  items[idx] = {
    ...items[idx],
    currentSeason: season,
    currentEpisode: 1,
    status: "watching",
  };
  localStorage.setItem("watchlist", JSON.stringify(items));
  renderItems();
  // Recharger la fiche
  openDetail(itemId);
  showToast(`Saison ${season} — Épisode 1`);
}

function markSeasonDone(itemId, season, event) {
  event?.stopPropagation();
  const viewState = getSeriesProgressViewState(itemId, season);
  const idx = items.findIndex((i) => i.id === itemId);
  if (idx === -1) return;
  const item = items[idx];

  // Calculer le nb d'épisodes de cette saison
  const epCount =
    item.seasonData?.[season] ||
    item.seasonData?.[String(season)] ||
    CONSTANTS.DEFAULT_EPISODES_PER_SEASON;
  const seasonState = getSeasonProgressState(item, season, epCount);
  if (seasonState.isDone) {
    unmarkSeasonDone(itemId, season, event);
    return;
  }
  const nextSeason = season + 1;
  const hasNextSeason = item.seasonData ? !!item.seasonData[nextSeason] : false;

  if (hasNextSeason) {
    items[idx] = {
      ...item,
      currentSeason: nextSeason,
      currentEpisode: 1,
      status: "watching",
    };
    showToast(`Saison ${season} terminée · Saison ${nextSeason} en cours`);
  } else {
    items[idx] = {
      ...item,
      currentSeason: season,
      currentEpisode: epCount,
      status: "watched",
      watchedAt: new Date().toISOString(),
    };
    showToast(`Série terminée ✓`);
  }
  localStorage.setItem("watchlist", JSON.stringify(items));
  renderItems();
  reopenDetailAtSeason(itemId, season, viewState);
}

function unmarkSeasonDone(itemId, season, event) {
  event?.stopPropagation();
  const viewState = getSeriesProgressViewState(itemId, season);
  const idx = items.findIndex((i) => i.id === itemId);
  if (idx === -1) return;

  items[idx] = {
    ...items[idx],
    currentSeason: season,
    currentEpisode: 1,
    status: "watching",
    watchedAt: null,
    lastWatchedAt: new Date().toISOString(),
  };
  localStorage.setItem("watchlist", JSON.stringify(items));
  renderItems();
  reopenDetailAtSeason(itemId, season, viewState);
  showToast(`Saison ${season} remise à zéro`);
}

function quickNextEpisodeInDetail(itemId, event) {
  event.stopPropagation();
  quickNextEpisode(itemId, event);
  // Recharger la fiche après la mise à jour
  setTimeout(() => openDetail(itemId), 50);
}

function markEpisodeSeen(itemId, season, episode, event) {
  event?.stopPropagation();
  const viewState = getSeriesProgressViewState(itemId, season);

  const idx = items.findIndex((i) => i.id === itemId);
  if (idx === -1) return;

  const item = items[idx];
  const currentSeason = item.currentSeason || 1;
  const currentEpisode = item.currentEpisode || 1;

  const alreadySeen =
    season < currentSeason ||
    (season === currentSeason && episode < currentEpisode);

  if (alreadySeen) {
    showToast("Episode déjà marqué vu");
    return;
  }

  const seasonTotal =
    item.seasonData?.[season] ||
    item.seasonData?.[String(season)] ||
    CONSTANTS.DEFAULT_EPISODES_PER_SEASON;

  const nextSeason = season + 1;
  const hasNextSeason =
    !!item.seasonData?.[nextSeason] || !!item.seasonData?.[String(nextSeason)];

  let updated = {
    ...item,
    status: "watching",
    lastWatchedAt: new Date().toISOString(),
  };

  if (episode >= seasonTotal) {
    if (hasNextSeason) {
      updated.currentSeason = nextSeason;
      updated.currentEpisode = 1;
      showToast(`Saison ${season} terminée · Saison ${nextSeason} en cours`);
    } else {
      updated.currentSeason = season;
      updated.currentEpisode = seasonTotal;
      updated.status = "watched";
      updated.watchedAt = new Date().toISOString();
      showToast("Série terminée ✓");
    }
  } else {
    updated.currentSeason = season;
    updated.currentEpisode = episode + 1;
    showToast(`S${season} E${episode} marqué vu`);
  }

  items[idx] = updated;
  localStorage.setItem("watchlist", JSON.stringify(items));
  renderItems();
  refreshOpenSeasonProgressInPlace(itemId, season, viewState);
}

function unmarkEpisodeSeen(itemId, season, episode, event) {
  event?.stopPropagation();
  const viewState = getSeriesProgressViewState(itemId, season);
  const idx = items.findIndex((i) => i.id === itemId);
  if (idx === -1) return;

  items[idx] = {
    ...items[idx],
    currentSeason: season,
    currentEpisode: episode,
    status: "watching",
    watchedAt: null,
    lastWatchedAt: new Date().toISOString(),
  };
  localStorage.setItem("watchlist", JSON.stringify(items));
  renderItems();
  refreshOpenSeasonProgressInPlace(itemId, season, viewState);
  showToast(`S${season} E${episode} remis en non vu`);
}

function toggleEpisodeSeen(itemId, season, episode, isDone, event) {
  if (isDone) {
    unmarkEpisodeSeen(itemId, season, episode, event);
  } else {
    markEpisodeSeen(itemId, season, episode, event);
  }
}

function getSeriesProgressViewState(itemId, season) {
  const detailBody = document.getElementById("detailContent");
  const block = document.getElementById(`sdSeasonBlock_${itemId}_${season}`);
  return {
    scrollTop: detailBody?.scrollTop || 0,
    keepSeasonOpen: Boolean(block?.classList.contains("sd-open")),
  };
}

function refreshOpenSeasonProgressInPlace(itemId, season, viewState = {}) {
  const item = items.find((entry) => entry.id === itemId);
  const block = document.getElementById(`sdSeasonBlock_${itemId}_${season}`);
  const list = document.getElementById(`sdEpList_${itemId}_${season}`);
  if (!item || !block || !list || !block.classList.contains("sd-open")) {
    reopenDetailAtSeason(itemId, season, { ...viewState, keepSeasonOpen: true });
    return;
  }

  const episodeButtons = list.querySelectorAll(".sd-ep-item");
  const currentSeason = item.currentSeason || 1;
  const currentEpisode = item.currentEpisode || 1;
  const isSeriesWatched = item.status === "watched";

  episodeButtons.forEach((row) => {
    const epNum = Number(
      row.querySelector(".sd-ep-num")?.textContent?.replace(/\D/g, "") || 0,
    );
    if (!epNum) return;
    const isDone =
      season < currentSeason ||
      (season === currentSeason &&
        (isSeriesWatched ? epNum <= currentEpisode : epNum < currentEpisode));
    const isCurrent =
      !isSeriesWatched && season === currentSeason && epNum === currentEpisode;
    const button = row.querySelector(".sd-ep-mark");

    row.classList.toggle("sd-ep-done", isDone);
    row.classList.toggle("sd-ep-current", isCurrent);
    if (button) {
      button.classList.toggle("sd-ep-mark-done", isDone);
      button.classList.toggle("sd-ep-mark-current", isCurrent);
      button.textContent = isDone ? "✓ Vu" : "Pas vu";
      button.disabled = false;
      button.removeAttribute("disabled");
      button.setAttribute(
        "onclick",
        `toggleEpisodeSeen(${JSON.stringify(String(itemId ?? ""))}, ${season}, ${epNum}, ${isDone ? "true" : "false"}, event)`,
      );
    }
  });

  const epCount = episodeButtons.length || 0;
  const seasonState = getSeasonProgressState(item, season, epCount);
  const fill = block.querySelector(".sd-season-fill");
  const pct = block.querySelector(".sd-season-pct");
  if (fill) {
    fill.style.width = `${seasonState.pct}%`;
    fill.classList.toggle("sd-fill-done", seasonState.isDone);
  }
  if (pct) pct.textContent = `${seasonState.watchedEpisodes}/${epCount}`;

  const detailBody = document.getElementById("detailContent");
  if (detailBody) detailBody.scrollTop = viewState.scrollTop || 0;
}

function reopenDetailAtSeason(itemId, season, viewState = {}) {
  const item = items.find((entry) => entry.id === itemId);
  const progressTab = document.getElementById("sdTabProgress");
  if (!item || !progressTab) {
    openDetail(itemId);
    return;
  }

  const detailBody = document.getElementById("detailContent");
  if (detailBody) detailBody.scrollTop = viewState.scrollTop || 0;
  progressTab.innerHTML = buildProgressTab(item, currentDetailTmdb);

  setTimeout(async () => {
    if (viewState.keepSeasonOpen) {
      const block = document.getElementById(`sdSeasonBlock_${itemId}_${season}`);
      if (block && !block.classList.contains("sd-open")) {
        await toggleSeasonEpisodes(itemId, season, { stopPropagation() {} });
      }
    }
    if (detailBody) detailBody.scrollTop = viewState.scrollTop || 0;
  }, 80);
}

function buildWatchProvidersHTML(watchProviders) {
  if (!watchProviders) return "";

  const groupsHTML = watchProviders.groups
    .map(
      (group) => `
        <div class="providers-group">
          <div class="providers-group-label">${group.label}</div>
          <div class="providers-list">
            ${group.providers
              .map(
                (provider) => `
                <span class="provider-chip" title="${escapeHtml(provider.provider_name)}">
                  ${provider.logo_path ? `<img src="https://image.tmdb.org/t/p/w92${provider.logo_path}" alt="${escapeHtml(provider.provider_name)}" class="provider-logo">` : ""}
                  <span class="provider-name">${escapeHtml(provider.provider_name)}</span>
                </span>
              `,
              )
              .join("")}
          </div>
        </div>
      `,
    )
    .join("");

  return `
    <div class="detail-providers">
      <div class="providers-header">
        <span class="providers-title">Disponibilité (${watchProviders.region})</span>
        ${watchProviders.link ? `<a href="${escapeHtml(watchProviders.link)}" target="_blank" rel="noopener noreferrer" class="providers-link">Voir sur TMDB</a>` : ""}
      </div>
      ${groupsHTML}
    </div>
  `;
}

function getWatchProviderGroup(watchProviders, groupKey) {
  return (
    watchProviders?.groups?.find((group) => group.key === groupKey) || null
  );
}

function getWatchProviderNamesFromGroups(watchProviders, groupKeys) {
  const names = [];
  groupKeys.forEach((groupKey) => {
    const group = getWatchProviderGroup(watchProviders, groupKey);
    (group?.providers || []).forEach((provider) => {
      if (provider?.provider_name && !names.includes(provider.provider_name)) {
        names.push(provider.provider_name);
      }
    });
  });
  return names;
}

function buildAvailabilityInline(names, variant = "") {
  if (!names.length) return "";
  const variantClass = variant ? ` ${variant}` : "";
  return `
    <div class="detail-availability-inline${variantClass}">
      ${names
        .slice(0, 4)
        .map(
          (name) => `<span>${escapeHtml(getCompactProviderLabel(name))}</span>`,
        )
        .join("")}
      ${names.length > 4 ? `<small>+${names.length - 4}</small>` : ""}
    </div>
  `;
}

function buildAvailabilityInfoRow(item, watchProviders, tmdb = null) {
  const networkProvider =
    item.type === "series"
      ? getPrimaryStreamingNetworkProvider(tmdb) ||
        (item.providerName
          ? {
              providerName: item.providerName,
              providerLogo: item.providerLogo || null,
              providerAccessType: item.providerAccessType || null,
            }
          : null)
      : null;

  if (!watchProviders && !hasIncludedWatchProvider(item) && !networkProvider) {
    return buildDetailInfoRow(
      "Disponibilite",
      `<span class="detail-availability-note">Verification des plateformes en cours...</span>`,
      "detail-row-availability detail-row-availability-muted",
    );
  }

  const includedNames = getWatchProviderNamesFromGroups(watchProviders, [
    "flatrate",
    "free",
    "ads",
  ]);

  if (includedNames.length) {
    return buildDetailInfoRow(
      "Disponibilite",
      `<strong>Inclus en streaming</strong>${buildAvailabilityInline(includedNames)}`,
      "detail-row-availability",
    );
  }

  if (hasIncludedWatchProvider(item)) {
    return buildDetailInfoRow(
      "Disponibilite",
      `<strong>Inclus en streaming</strong>${buildAvailabilityInline([item.providerName])}`,
      "detail-row-availability",
    );
  }

  if (networkProvider?.providerName) {
    return buildDetailInfoRow(
      "Plateforme",
      `<strong>${escapeHtml(getCompactProviderLabel(networkProvider.providerName))}</strong><span class="detail-availability-note">Diffuseur TMDB</span>`,
      "detail-row-availability",
    );
  }

  const paidNames = getWatchProviderNamesFromGroups(watchProviders, [
    "rent",
    "buy",
  ]);
  if (paidNames.length) {
    return buildDetailInfoRow(
      "Disponibilite",
      `<strong>Pas inclus en streaming</strong><span class="detail-availability-note">Location/achat sur ${escapeHtml(paidNames.slice(0, 3).map(getCompactProviderLabel).join(", "))}</span>`,
      "detail-row-availability detail-row-availability-muted",
    );
  }

  return buildDetailInfoRow(
    "Disponibilite",
    `<span class="detail-availability-note">Aucune disponibilite FR detectee pour le moment.</span>`,
    "detail-row-availability detail-row-availability-muted",
  );
}

async function fetchWatchProviders(endpoint, tmdbId) {
  try {
    const res = await fetch(
      `${TMDB_BASE_URL}/${endpoint}/${tmdbId}/watch/providers?api_key=${TMDB_API_KEY}`,
    );
    if (!res.ok) return null;

    const payload = await res.json();
    return normalizeWatchProviders(payload);
  } catch (error) {
    console.error("Erreur watch providers:", error);
    return null;
  }
}

function buildCastHTML(tmdb) {
  const cast = tmdb?.credits?.cast?.slice(0, 6) || [];
  if (cast.length === 0) return "";
  return `<div class="detail-cast">
    ${cast
      .map(
        (actor) => `
      <div class="detail-cast-item">
        ${
          actor.profile_path
            ? `<img src="https://image.tmdb.org/t/p/w185${actor.profile_path}" alt="${escapeHtml(actor.name)}" class="detail-cast-photo">`
            : `<div class="detail-cast-photo detail-cast-placeholder">👤</div>`
        }
        <div class="detail-cast-name">${escapeHtml(actor.name)}</div>
        <div class="detail-cast-role">${escapeHtml(actor.character || "")}</div>
      </div>`,
      )
      .join("")}
  </div>`;
}

function getSeriesCompletionPoint(item) {
  const seasonEntries = Object.entries(item.seasonData || {})
    .map(([season, count]) => [parseInt(season, 10), count])
    .filter(
      ([season, count]) => Number.isFinite(season) && Number.isFinite(count),
    );

  if (seasonEntries.length === 0) {
    return {
      currentSeason: item.currentSeason || 1,
      currentEpisode: item.currentEpisode || 1,
    };
  }

  seasonEntries.sort((a, b) => a[0] - b[0]);
  const [lastSeason, lastEpisodeCount] =
    seasonEntries[seasonEntries.length - 1];

  return {
    currentSeason: lastSeason,
    currentEpisode: lastEpisodeCount || 1,
  };
}

function setItemStatusFromDetail(status) {
  const index = items.findIndex((item) => item.id === currentItemId);
  if (index === -1) return;

  const currentItem = items[index];
  const updatedItem = { ...currentItem, status };

  if (status === "watched") {
    updatedItem.watchedAt = currentItem.watchedAt || new Date().toISOString();
    if (currentItem.type === "series") {
      const completion = getSeriesCompletionPoint(currentItem);
      updatedItem.currentSeason = completion.currentSeason;
      updatedItem.currentEpisode = completion.currentEpisode;
    }
  } else {
    updatedItem.watchedAt = null;
    if (currentItem.type === "series" && status === "towatch") {
      updatedItem.currentSeason = 1;
      updatedItem.currentEpisode = 1;
    }
  }

  items[index] = updatedItem;
  localStorage.setItem("watchlist", JSON.stringify(items));
  renderItems();
  openDetail(updatedItem.id);

  const statusLabel = STATUS_LABELS[status] || status;
  showToast(`Statut mis à jour · ${statusLabel}`);
}

function openCollectionDetailFromTmdbId(tmdbId) {
  const existingItem = items.find(
    (item) => String(item.tmdbId) === String(tmdbId),
  );
  if (!existingItem) return;

  closeDetailModal();
  setTimeout(() => openDetail(existingItem.id), 50);
}

function openCollectionEditFromTmdbId(tmdbId) {
  const existingItem = items.find(
    (item) => String(item.tmdbId) === String(tmdbId),
  );
  if (!existingItem) return;

  closeDetailModal();
  setTimeout(() => {
    currentItemId = existingItem.id;
    editItem();
  }, 60);
}

function buildDetailHeroHTML({
  title,
  kicker,
  meta,
  chips = [],
  backdropUrl,
  posterUrl,
  actionHtml = "",
  score = null,
  providerLogo = null,
  providerName = null,
}) {
  const visualUrl = backdropUrl || posterUrl || "";
  const posterEl = posterUrl
    ? `<img src="${escapeHtml(posterUrl)}" alt="${escapeHtml(title)}" class="detail-poster-thumb">`
    : `<div class="detail-poster-thumb detail-poster-placeholder">${escapeHtml((title || "?").charAt(0).toUpperCase())}</div>`;

  return `
    <div class="detail-stream-hero-wrap">
      <div class="detail-stream-hero">
        ${
          visualUrl
            ? `<div class="detail-stream-bg" style="background-image:url('${escapeHtml(visualUrl)}')"></div>`
            : `<div class="detail-stream-bg detail-stream-bg-empty"></div>`
        }
        <div class="detail-stream-overlay"></div>
        ${
          score || providerLogo
            ? `
          <div class="detail-hero-badges">
            ${providerLogo ? `<span class="detail-hero-provider"><img src="${escapeHtml(providerLogo)}" alt="${escapeHtml(providerName || "")}"></span>` : ""}
            ${score ? `<span class="detail-hero-score">★ ${escapeHtml(String(score))}</span>` : ""}
          </div>`
            : ""
        }
      </div>
      <div class="detail-poster-row">
        <div class="detail-poster-col">${posterEl}</div>
        <div class="detail-poster-info">
          ${kicker ? `<div class="detail-stream-kicker">${escapeHtml(kicker)}</div>` : ""}
          <h3 class="detail-poster-title">${escapeHtml(title)}</h3>
          ${meta ? `<div class="detail-poster-meta">${escapeHtml(meta)}</div>` : ""}
          ${
            chips.length
              ? `<div class="detail-stream-chips">${chips.map((c) => `<span class="detail-stream-chip">${escapeHtml(c)}</span>`).join("")}</div>`
              : ""
          }
        </div>
      </div>
      ${actionHtml ? `<div class="detail-hero-actions-row">${actionHtml}</div>` : ""}
    </div>`;
}

function buildDetailAnchorButton(label, targetId, isPrimary = false) {
  return `<button class="detail-mini-btn detail-mini-btn-anchor ${isPrimary ? "active" : "detail-mini-btn-ghost"}" onclick="scrollDetailTo('${escapeHtml(targetId)}')">${escapeHtml(label)}</button>`;
}

function buildDetailDockHTML({
  posterUrl,
  title,
  subtitle,
  pills = [],
  actionsHtml,
  state = "default",
}) {
  return `
    <div class="detail-stream-dock detail-stream-dock-${escapeHtml(state)}">
      <div class="detail-stream-dock-poster-wrap">
        ${
          posterUrl
            ? `<img src="${escapeHtml(posterUrl)}" alt="${escapeHtml(title)}" class="detail-stream-dock-poster">`
            : `<div class="detail-stream-dock-poster detail-stream-dock-poster-placeholder">${escapeHtml((title || "?").charAt(0).toUpperCase())}</div>`
        }
      </div>
      <div class="detail-stream-dock-body">
        ${
          title || subtitle
            ? `<div class="detail-stream-dock-copy">
          ${title ? `<div class="detail-stream-dock-title">${escapeHtml(title)}</div>` : ""}
          ${subtitle ? `<div class="detail-stream-dock-subtitle">${escapeHtml(subtitle)}</div>` : ""}
        </div>`
            : ""
        }
        ${
          pills.length
            ? `<div class="detail-stream-dock-pills">${pills
                .map(
                  (pill) =>
                    `<span class="detail-stream-dock-pill">${escapeHtml(pill)}</span>`,
                )
                .join("")}</div>`
            : ""
        }
      </div>
      <div class="detail-stream-dock-actions">${actionsHtml}</div>
    </div>`;
}

function buildDetailQuickBarHTML({
  title,
  text,
  actionsHtml,
  state = "default",
}) {
  return `
    <div class="detail-stream-quickbar detail-stream-quickbar-${escapeHtml(state)}">
      <div class="detail-stream-quickcopy">
        <div class="detail-stream-quicktitle">${escapeHtml(title)}</div>
        <div class="detail-stream-quicktext">${escapeHtml(text)}</div>
      </div>
      <div class="detail-stream-quickactions">
        ${actionsHtml}
      </div>
    </div>`;
}

function buildCollectionQuickBar(item) {
  const watchedLabel = getWatchedRatingActionLabel(item);

  const buttons = [
    `<button class="detail-mini-btn detail-mini-btn-toolbar ${item.status === "towatch" ? "active" : ""}" onclick="setItemStatusFromDetail('towatch')">À voir</button>`,
  ];

  if (item.type === "series") {
    buttons.push(
      `<button class="detail-mini-btn detail-mini-btn-toolbar ${item.status === "watching" ? "active" : ""}" onclick="setItemStatusFromDetail('watching')">En cours</button>`,
    );
  }

  buttons.push(
    `<button class="detail-mini-btn detail-mini-btn-toolbar ${item.status === "watched" ? "active" : ""}" onclick="openWatchedFlowForCurrentItem()">${watchedLabel}</button>`,
  );

  return `<div class="detail-action-bar">${buttons.join("")}</div>`;
}

function buildTrendingQuickBar(item, type, alreadyAdded) {
  if (alreadyAdded) {
    return `<div class="detail-action-bar">
      <button class="btn btn-primary" style="flex:1;justify-content:center;" onclick="openCollectionDetailFromTmdbId(${item.id})">Ouvrir dans la collection</button>
      <button class="btn" style="flex:1;justify-content:center;" onclick="openCollectionEditFromTmdbId(${item.id})">Modifier</button>
    </div>`;
  }
  return `<div class="detail-action-bar">
    <button class="btn btn-primary" style="flex:1;justify-content:center;" onclick="quickAddFromTrendingById(${item.id}, 'towatch', '${type}')">+ Ajouter</button>
    <button class="btn" style="flex:1;justify-content:center;" onclick="openWatchedFlowFromTrendingById(${item.id}, '${type}')">✓ Marquer comme vu + noter</button>
  </div>`;
}

function buildCollectionItemFromTrending(
  item,
  type,
  provider,
  status = "towatch",
) {
  const title = item.title || item.name;
  const releaseDate = item.release_date || item.first_air_date || null;
  const year = (item.release_date || item.first_air_date || "").substring(0, 4);
  const genres = item.genre_ids
    ? getGenreNames(item.genre_ids, type)
    : Array.isArray(item.genres)
      ? item.genres
          .map((genre) => genre?.name)
          .filter(Boolean)
          .join(", ")
      : "";
  const rating = item.vote_average ? (item.vote_average / 2).toFixed(1) : "";
  const posterUrl = item.poster_path
    ? `${TMDB_IMAGE_BASE}${item.poster_path}`
    : null;

  return {
    id: Date.now().toString(),
    title,
    type: type === "movie" ? "movie" : "series",
    year,
    releaseDate,
    status,
    rating: null,
    tmdbRating: parseFloat(rating) || null,
    genre: genres,
    notes: "",
    posterUrl,
    tmdbId: item.id,
    providerLogo: provider?.providerLogo || null,
    providerName: provider?.providerName || null,
    providerAccessType: provider?.providerAccessType || null,
    providerPriorityVersion: WATCH_PROVIDER_PRIORITY_VERSION,
    tags: [],
    currentSeason: type === "tv" ? 1 : null,
    currentEpisode: type === "tv" ? 1 : null,
    dateAdded: new Date().toISOString(),
    watchedAt: status === "watched" ? new Date().toISOString() : null,
  };
}

async function quickAddFromTrendingById(id, status = "towatch", type = null) {
  const cached = getTrendingCacheItem(id, type);
  if (!cached) return;

  await addFromTrending(cached.item, cached.type, status, {
    closeAfter: false,
  });
  showTrendingDetail(id, cached.type);
}

function populateAddModalFromCollectionItem(
  item,
  preferredStatus = item.status,
) {
  const savedId = item.id;

  currentItemId = savedId;
  currentTags = item.tags || [];
  currentWatchedWith = getWatchedWithNames(item.watchedWith);
  currentSeason = item.currentSeason || 1;
  currentEpisode = item.currentEpisode || 1;

  document.getElementById("titleInput").value = item.title;
  document.getElementById("typeInput").value = item.type;
  document.getElementById("yearInput").value = item.year || "";
  document.getElementById("statusInput").value =
    preferredStatus === "watched"
      ? "watched"
      : item.status === "watched"
        ? "watched"
        : "towatch";
  document.getElementById("ratingInput").value = item.rating || "";
  document.getElementById("genreInput").value = item.genre || "";
  document.getElementById("notesInput").value = item.notes || "";
  const wdInput = document.getElementById("watchedDateInput");
  if (wdInput) wdInput.value = item.watchedDate || "";
  renderWatchedWith();
  updateStarPicker(item.rating || "");

  if (item.posterUrl) {
    document.getElementById("titleInput").dataset.poster = item.posterUrl;
  }
  if (item.tmdbId) {
    document.getElementById("titleInput").dataset.tmdbId = item.tmdbId;
  }
  if (item.releaseDate) {
    document.getElementById("titleInput").dataset.releaseDate =
      item.releaseDate;
  }
  if (item.providerLogo) {
    document.getElementById("titleInput").dataset.providerLogo =
      item.providerLogo;
    document.getElementById("titleInput").dataset.providerName =
      item.providerName || "";
    document.getElementById("titleInput").dataset.providerAccessType =
      item.providerAccessType || "";
  }
  if (item.seasonData) {
    document.getElementById("titleInput").dataset.seasonData = JSON.stringify(
      item.seasonData,
    );
  }
  if (item.totalEpisodes) {
    document.getElementById("titleInput").dataset.totalEpisodes =
      item.totalEpisodes;
  }

  updateSelectedTMDBUI({
    id: item.tmdbId || item.id,
    title: item.title,
    media_type: item.type === "series" ? "tv" : "movie",
    release_date: item.releaseDate || (item.year ? `${item.year}-01-01` : ""),
    first_air_date: item.releaseDate || (item.year ? `${item.year}-01-01` : ""),
    posterUrl: item.posterUrl || "",
  });
  const resolvedStatus =
    preferredStatus === "watched"
      ? "watched"
      : item.status === "watched"
        ? "watched"
        : "towatch";
  selectAddStatus(resolvedStatus, resolvedStatus === "watched");
  if (resolvedStatus === "watched") {
    const tmdbSearchGroup = document.getElementById("tmdbSearchGroup");
    if (tmdbSearchGroup) tmdbSearchGroup.style.display = "none";
  }

  updateEpisodeDisplay();
  renderTags();
}

function openWatchedFlowForCurrentItem() {
  const item = items.find((entry) => entry.id === currentItemId);
  if (!item) return;

  closeDetailModal();
  openAddModal();
  populateAddModalFromCollectionItem(item, "watched");
}

function getWatchedRatingActionLabel(item) {
  const status = normalizeStatusValue(item?.status);
  if (status !== "watched") return "Marquer comme vu + noter";
  return item?.rating ? "Mettre a jour ma note" : "Ajouter ma note";
}

function getWatchedRatingActionIcon(item) {
  const status = normalizeStatusValue(item?.status);
  return status === "watched" ? "★" : "✓";
}

async function openWatchedFlowFromTrendingById(id, type = null) {
  const cached = getTrendingCacheItem(id, type);
  if (!cached) return;

  closeDetailModal();
  openAddModal();
  await selectTMDBItem({
    ...cached.item,
    media_type: cached.type,
  });
  selectAddStatus("watched", true);
  const tmdbSearchGroup = document.getElementById("tmdbSearchGroup");
  if (tmdbSearchGroup) tmdbSearchGroup.style.display = "none";
}

function buildDetailHTML(item, tmdb) {
  if (item.type === "series") return buildSeriesDetailHTML(item, tmdb);

  const watchedActionLabel = getWatchedRatingActionLabel(item);
  const watchedActionIcon = getWatchedRatingActionIcon(item);

  const backdropUrl = tmdb?.backdrop_path
    ? `https://image.tmdb.org/t/p/w1280${tmdb.backdrop_path}`
    : null;
  const synopsis = tmdb?.overview || "";

  let extraRows = "";
  if (tmdb?.runtime) {
    const h = Math.floor(tmdb.runtime / 60),
      m = tmdb.runtime % 60;
    extraRows += `<div class="detail-row"><div class="detail-label">Durée</div><div class="detail-value">${h}h${m > 0 ? ` ${m}min` : ""}</div></div>`;
  }
  const director = tmdb?.credits?.crew?.find((c) => c.job === "Director");
  if (director)
    extraRows += `<div class="detail-row"><div class="detail-label">Réalisateur</div><div class="detail-value">${escapeHtml(director.name)}</div></div>`;

  const statusText =
    getUpcomingMovieReleaseLabel(item, false) ||
    STATUS_LABELS[item.status] ||
    item.status;

  const tmdbScore =
    item.tmdbRating ||
    (tmdb?.vote_average ? (tmdb.vote_average / 2).toFixed(1) : null);
  const heroMeta = [item.year || null, item.genre || null]
    .filter(Boolean)
    .join(" · ");
  const heroChips = [];
  const heroActions = [];
  if (getTrailerKey(tmdb)) {
    heroActions.push(
      buildDetailAnchorButton("Bande-annonce", "detailTrailerAnchor", true),
    );
  }
  if (synopsis) {
    heroActions.push(
      buildDetailAnchorButton("Synopsis", "detailSynopsisAnchor"),
    );
  }
  const castHTML = buildCastHTML(tmdb);

  return `
    <div class="detail-stream-shell detail-layout-d">
      ${buildDetailHeroHTML({
        title: item.title,
        kicker: "Film · Dans ta collection",
        meta: heroMeta,
        chips: heroChips,
        backdropUrl,
        posterUrl: item.posterUrl,
        actionHtml: heroActions.join(""),
        score: tmdbScore,
        providerLogo: item.providerLogo || null,
        providerName: item.providerName || null,
      })}
      <div class="detail-action-bar detail-action-bar-priority detail-action-bar-priority-minimal">
        <button class="btn btn-primary detail-action-primary-a" onclick="openWatchedFlowForCurrentItem()"><span class="detail-action-primary-icon">${watchedActionIcon}</span><span>${watchedActionLabel}</span></button>
        <button class="btn detail-action-danger" onclick="deleteItem()">Supprimer</button>
      </div>
      <div class="detail-stream-panel detail-stream-panel-info">
        <div class="sd-section-title">Informations</div>
        ${buildDetailInfoRow("Année", escapeHtml(item.year) || "—")}
        ${buildDetailInfoRow("Statut", `${statusText}${item.watchedAt ? ` <span class="watched-date">· Vu le ${new Date(item.watchedAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}</span>` : ""}`)}
        ${buildAvailabilityInfoRow(item, tmdb?.watchProviders, tmdb)}
        ${item.rating ? buildDetailInfoRow("Ma note", buildUserRatingInline(item.rating), "detail-row-highlight") : ""}
        ${buildDetailInfoRow("Vu avec", buildWatchedWithList(item.watchedWith), "detail-row-tags")}
        ${item.genre ? buildDetailInfoRow("Genre", escapeHtml(item.genre)) : ""}
        ${extraRows}
        ${item.tags?.length ? buildDetailInfoRow("Tags", buildDetailTagList(item.tags), "detail-row-tags") : ""}
      </div>
      ${tmdb?.watchProviders ? `<div class="detail-stream-panel">${buildWatchProvidersHTML(tmdb.watchProviders)}</div>` : ""}
      ${synopsis ? `<div class="detail-stream-panel detail-stream-panel-feature" id="detailSynopsisAnchor">${buildDetailTextSurface("Synopsis", synopsis, "detail-feature-surface-synopsis")}</div>` : ""}
      ${castHTML ? `<div class="detail-stream-panel"><div class="sd-section-title">Casting principal</div>${castHTML}</div>` : ""}
      ${item.notes ? `<div class="detail-stream-panel detail-stream-panel-feature">${buildDetailTextSurface("Mes notes", item.notes, "detail-feature-surface-notes")}</div>` : ""}
      ${getTrailerKey(tmdb) ? `<div class="detail-stream-panel detail-stream-panel-feature" id="detailTrailerAnchor">${buildDetailMediaSurface("Bande-annonce", buildTrailerHTML(getTrailerKey(tmdb)), "detail-feature-surface-trailer")}</div>` : ""}
      ${
        item.tmdbId
          ? `<div class="detail-stream-panel"><div class="sd-section-title">À regarder ensuite</div><div class="similars-grid" id="similarsContainer"><div class="similars-loading">Chargement…</div></div></div>`
          : ""
      }
    </div>`;
}

function buildSeriesDetailHTML(item, tmdb) {
  const backdropUrl = tmdb?.backdrop_path
    ? `https://image.tmdb.org/t/p/w1280${tmdb.backdrop_path}`
    : null;
  const totalSeasons =
    tmdb?.number_of_seasons || Object.keys(item.seasonData || {}).length || "?";
  const totalEpisodes = tmdb?.number_of_episodes || item.totalEpisodes || "?";
  const firstAir = tmdb?.first_air_date
    ? new Date(tmdb.first_air_date).toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : item.year || "";
  const isReleasedSeries = isSeriesReleased(item);

  // Progression globale
  const globalProgress = getSeriesEpisodeProgress(item);
  const epDone = isReleasedSeries ? globalProgress.watchedEpisodes : 0;
  const pct =
    isReleasedSeries && totalEpisodes && epDone
      ? Math.min(100, Math.round((epDone / totalEpisodes) * 100))
      : null;

  const tmdbScore =
    item.tmdbRating ||
    (tmdb?.vote_average ? (tmdb.vote_average / 2).toFixed(1) : null);
  const heroChips = [`${totalSeasons} saison${totalSeasons > 1 ? "s" : ""}`];
  if (totalEpisodes !== "?") heroChips.push(`${totalEpisodes} épisodes`);
  const heroActions = [];
  if (getTrailerKey(tmdb)) {
    heroActions.push(
      buildDetailAnchorButton("Bande-annonce", "sdTabVideos", true),
    );
  }
  heroActions.push(buildDetailAnchorButton("Détails", "sdTabDetails"));

  return `
    <div class="detail-stream-shell detail-stream-shell-series detail-layout-d">
      ${buildDetailHeroHTML({
        title: item.title,
        kicker: "Série · Dans ta collection",
        meta: firstAir ? `Première diffusion ${firstAir}` : item.year || "",
        chips: heroChips,
        backdropUrl,
        posterUrl: item.posterUrl,
        actionHtml: heroActions.join(""),
        score: tmdbScore,
        providerLogo: item.providerLogo || null,
        providerName: item.providerName || null,
      })}
      <div class="detail-stream-panel detail-stream-panel-series">
        <div class="sd-info-bar">
          <div class="sd-info-text">
            <div class="sd-first-air">Progression de visionnage</div>
            <div class="sd-counts">${escapeHtml(getNextEpisodeDisplay(item, "inline"))} · ${totalSeasons} SAISON${totalSeasons > 1 ? "S" : ""} · ${totalEpisodes} ÉPISODES</div>
            ${
              pct !== null
                ? `
              <div class="sd-progress-row">
                <div class="sd-progress-bar"><div class="sd-progress-fill" style="width:${pct}%"></div></div>
                <span class="sd-progress-pct">${pct}% complete</span>
              </div>`
                : ""
            }
          </div>
        </div>

        <div class="sd-tabs">
          <button class="sd-tab active" onclick="switchSeriesTab('progress', this)">Progrès</button>
          <button class="sd-tab" onclick="switchSeriesTab('details', this)">Détails</button>
          <button class="sd-tab" onclick="switchSeriesTab('videos', this)">Vidéos</button>
          ${item.tmdbId ? `<button class="sd-tab" onclick="switchSeriesTab('similar', this)">Similaires</button>` : ""}
        </div>

        <div id="sdTabProgress" class="sd-tab-content active">
          ${buildProgressTab(item, tmdb)}
        </div>

        <div id="sdTabDetails" class="sd-tab-content">
          ${buildDetailsTab(item, tmdb)}
        </div>

        <div id="sdTabVideos" class="sd-tab-content">
          <div class="sd-tab-stack">
            ${buildDetailMediaSurface("Bande-annonce", buildTrailerHTML(getTrailerKey(tmdb)), "sd-tab-surface sd-video-surface detail-feature-surface-trailer")}
          </div>
        </div>

        ${
          item.tmdbId
            ? `
        <div id="sdTabSimilar" class="sd-tab-content">
          <div class="sd-tab-stack">
            <section class="sd-tab-surface sd-similar-surface">
              <div class="sd-section-title">À regarder ensuite</div>
              <div class="similars-grid" id="similarsContainer">
                <div class="similars-loading">Chargement…</div>
              </div>
            </section>
          </div>
        </div>`
            : ""
        }
      </div>

      <div class="detail-actions detail-actions-compact detail-actions-series detail-actions-series-minimal">
        <button class="btn detail-action-danger" onclick="deleteItem()">Supprimer</button>
      </div>
    </div>`;
}

function switchSeriesTab(name, el) {
  document
    .querySelectorAll(".sd-tab")
    .forEach((t) => t.classList.remove("active"));
  document
    .querySelectorAll(".sd-tab-content")
    .forEach((t) => t.classList.remove("active"));
  el.classList.add("active");
  const map = {
    progress: "sdTabProgress",
    details: "sdTabDetails",
    videos: "sdTabVideos",
    similar: "sdTabSimilar",
  };
  document.getElementById(map[name])?.classList.add("active");
}

function buildProgressTab(item, tmdb) {
  const currentSeason = item.currentSeason || 1;
  const currentEpisode = item.currentEpisode || 1;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Liste des saisons depuis tmdb ou seasonData
  let seasons = [];
  if (tmdb?.seasons) {
    seasons = tmdb.seasons.filter((s) => s.season_number > 0);
  } else if (item.seasonData) {
    seasons = Object.entries(item.seasonData).map(([n, c]) => ({
      season_number: parseInt(n),
      episode_count: c,
      name: `Saison ${n}`,
    }));
  }

  const seasonsHTML = seasons
    .map((s) => {
      const sNum = s.season_number;
      const epCount = s.episode_count || 0;
      const seasonAirDate = s.air_date ? new Date(s.air_date) : null;
      if (seasonAirDate) seasonAirDate.setHours(0, 0, 0, 0);
      const isUnreleased = seasonAirDate && seasonAirDate > today;
      const seasonAirDateLabel = seasonAirDate
        ? seasonAirDate.toLocaleDateString("fr-FR", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })
        : "";
      const seasonState = getSeasonProgressState(item, sNum, epCount);
      const isDone = !isUnreleased && seasonState.isDone;
      const isCurrent = !isUnreleased && seasonState.isCurrent;
      const epDone = isUnreleased ? 0 : seasonState.watchedEpisodes;
      const pct = isUnreleased ? 0 : seasonState.pct;

      return `
      <div class="sd-season-block" id="sdSeasonBlock_${escapeHtml(item.id)}_${sNum}">
        <div class="sd-season-header" onclick="toggleSeasonEpisodes(${inlineJsString(item.id)}, ${sNum}, event)">
          <div class="sd-season-title-wrap">
            <div class="sd-season-title">${escapeHtml(s.name || `Saison ${sNum}`)}</div>
            <span class="sd-season-chevron">▸</span>
          </div>
          <button class="sd-mark-btn ${isDone ? "sd-mark-done" : ""} ${isUnreleased ? "sd-mark-disabled" : ""}"
            type="button"
            ${isUnreleased ? "disabled" : ""}
            onclick="markSeasonDone(${inlineJsString(item.id)}, ${sNum}, event)">
            ${isDone ? "✓ Terminée" : isUnreleased ? "Pas sortie" : "Marquer terminée"}
          </button>
        </div>
        <div class="sd-season-progress">
          <div class="sd-season-bar-wrap">
            <div class="sd-season-bar"><div class="sd-season-fill ${isDone ? "sd-fill-done" : ""}" style="width:${pct}%"></div></div>
          </div>
          <span class="sd-season-pct">${isUnreleased ? escapeHtml(seasonAirDateLabel) : `${epDone}/${epCount}`}</span>
        </div>

        <div class="sd-ep-list" id="sdEpList_${escapeHtml(item.id)}_${sNum}" style="display:none;"></div>

        ${
          !isCurrent && !isDone && !isUnreleased
            ? `
          <button class="btn season-btn" type="button" style="margin-top:8px;" onclick="jumpToSeason(${inlineJsString(item.id)}, ${sNum}, ${inlineJsString(s.air_date || "")}, event)">
            Reprendre cette saison
          </button>`
            : ""
        }
      </div>`;
    })
    .join("");

  return (
    seasonsHTML ||
    `<p style="color:var(--text-tertiary);font-size:14px;">Aucune donnée de saison disponible.</p>`
  );
}

async function toggleSeasonEpisodes(itemId, season, event) {
  event.stopPropagation();

  const block = document.getElementById(`sdSeasonBlock_${itemId}_${season}`);
  const list = document.getElementById(`sdEpList_${itemId}_${season}`);
  if (!block || !list) return;

  const isOpen = block.classList.contains("sd-open");
  if (isOpen) {
    block.classList.remove("sd-open");
    list.style.display = "none";
    return;
  }

  block.classList.add("sd-open");
  list.style.display = "block";

  if (list.dataset.loaded === "1") return;

  const item = items.find((i) => i.id === itemId);
  if (!item?.tmdbId || TMDB_API_KEY === "VOTRE_CLE_API_ICI") {
    list.innerHTML = `<div class="sd-ep-loading">Episodes indisponibles (TMDB requis).</div>`;
    list.dataset.loaded = "1";
    return;
  }

  list.innerHTML = `<div class="sd-ep-loading">Chargement des épisodes…</div>`;

  const cacheKey = `${item.tmdbId}-${season}`;
  let episodes = seasonEpisodesCache[cacheKey];

  if (!episodes) {
    try {
      const res = await fetch(
        `${TMDB_BASE_URL}/tv/${item.tmdbId}/season/${season}?api_key=${TMDB_API_KEY}&language=fr-FR`,
      );

      if (!res.ok) throw new Error("Erreur API saison");
      const payload = await res.json();
      episodes = payload.episodes || [];
      seasonEpisodesCache[cacheKey] = episodes;
    } catch (error) {
      console.error("Erreur episodes saison:", error);
      list.innerHTML = `<div class="sd-ep-loading">Impossible de charger les épisodes.</div>`;
      return;
    }
  }

  const currentSeason = item.currentSeason || 1;
  const currentEpisode = item.currentEpisode || 1;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (episodes.length === 0) {
    list.innerHTML = `<div class="sd-ep-loading">Aucun épisode trouvé pour cette saison.</div>`;
    list.dataset.loaded = "1";
    return;
  }

  list.innerHTML = episodes
    .map((ep) => {
      const epNum = ep.episode_number || 0;
      const airDate = ep.air_date ? new Date(ep.air_date) : null;
      const isUpcoming = airDate && airDate > today;
      let airDateLabel = "Date inconnue";
      if (airDate) {
        const normalizedAirDate = new Date(airDate);
        normalizedAirDate.setHours(0, 0, 0, 0);
        const diffDays = Math.round(
          (normalizedAirDate.getTime() - today.getTime()) / 86400000,
        );

        if (diffDays === 0) {
          airDateLabel = "Aujourd'hui";
        } else if (diffDays === 1) {
          airDateLabel = "Demain";
        } else {
          airDateLabel = normalizedAirDate.toLocaleDateString("fr-FR", {
            day: "numeric",
            month: "short",
            year: "numeric",
          });
        }
      }
      const isSeriesWatched = item.status === "watched";
      const isDone =
        season < currentSeason ||
        (season === currentSeason &&
          epNum > 0 &&
          (isSeriesWatched ? epNum <= currentEpisode : epNum < currentEpisode));
      const isCurrent =
        !isSeriesWatched &&
        season === currentSeason &&
        epNum > 0 &&
        epNum === currentEpisode;

      const stillUrl = ep.still_path
        ? `https://image.tmdb.org/t/p/w300${ep.still_path}`
        : null;
      const epRating =
        ep.vote_average && ep.vote_count > 3
          ? ep.vote_average.toFixed(1)
          : null;

      return `
        <div class="sd-ep-item ${isDone ? "sd-ep-done" : ""} ${isCurrent ? "sd-ep-current" : ""}">
          <div class="sd-ep-still">
            ${
              stillUrl
                ? `<img src="${escapeHtml(stillUrl)}" alt="" loading="lazy">`
                : `<div class="sd-ep-still-placeholder">${isUpcoming ? "🔜" : "📺"}</div>`
            }
            ${epRating ? `<span class="sd-ep-rating">★ ${epRating}</span>` : ""}
          </div>
          <div class="sd-ep-body">
            <div class="sd-ep-header">
              <span class="sd-ep-num">E${String(epNum).padStart(2, "0")}</span>
              <span class="sd-ep-name">${escapeHtml(ep.name || `Épisode ${epNum}`)}</span>
            </div>
            ${ep.overview ? `<p class="sd-ep-overview">${escapeHtml(ep.overview)}</p>` : ""}
          </div>
          <div class="sd-ep-action">
            ${
              isUpcoming
                ? `<span class="sd-ep-airdate">${escapeHtml(airDateLabel)}</span>`
                : `<button
                  type="button"
                  class="sd-ep-mark ${isDone ? "sd-ep-mark-done" : ""} ${isCurrent ? "sd-ep-mark-current" : ""}"
                  onclick="toggleEpisodeSeen(${inlineJsString(itemId)}, ${season}, ${epNum}, ${isDone ? "true" : "false"}, event)">
                  ${isDone ? "✓ Vu" : "Pas vu"}
                </button>`
            }
          </div>
        </div>
      `;
    })
    .join("");

  list.dataset.loaded = "1";
}

function buildDetailsTab(item, tmdb) {
  const synopsis = tmdb?.overview || "";
  const creators = tmdb?.created_by
    ?.slice(0, 2)
    .map((c) => escapeHtml(c.name))
    .join(", ");
  let rows = "";
  if (item.year) rows += buildDetailInfoRow("Année", escapeHtml(item.year));
  if (item.watchedAt)
    rows += buildDetailInfoRow(
      "Terminée le",
      `<span class="watched-date-full">${new Date(item.watchedAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}</span>`,
    );
  rows += buildAvailabilityInfoRow(item, tmdb?.watchProviders, tmdb);
  if (item.genre) rows += buildDetailInfoRow("Genre", escapeHtml(item.genre));
  if (creators) rows += buildDetailInfoRow("Créateur", creators);
  const tmdbScore =
    item.tmdbRating ||
    (tmdb?.vote_average ? (tmdb.vote_average / 2).toFixed(1) : null);
  if (tmdbScore)
    rows += buildDetailInfoRow(
      "Note TMDB",
      buildTmdbRatingInline(tmdbScore, tmdb?.vote_count),
      "detail-row-highlight",
    );
  if (item.rating) {
    rows += buildDetailInfoRow(
      "Ma note",
      buildUserRatingInline(item.rating),
      "detail-row-highlight",
    );
  }
  rows += buildDetailInfoRow(
    "Vu avec",
    buildWatchedWithList(item.watchedWith),
    "detail-row-tags",
  );
  if (tmdb?.next_episode_to_air) {
    const next = tmdb.next_episode_to_air;
    const dateStr = new Date(next.air_date).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    rows += buildDetailInfoRow(
      "Prochain ep.",
      `<span class="detail-value-accent">S${next.season_number} E${next.episode_number} — ${dateStr}</span>`,
      "detail-row-highlight",
    );
  }
  if (item.tags?.length)
    rows += buildDetailInfoRow(
      "Tags",
      buildDetailTagList(item.tags),
      "detail-row-tags",
    );

  return `
    <div class="sd-tab-stack">
      <section class="sd-tab-surface sd-tab-surface-rows detail-info-surface">
        ${rows}
      </section>
      ${tmdb?.watchProviders ? `<section class="sd-tab-surface">${buildWatchProvidersHTML(tmdb?.watchProviders)}</section>` : ""}
      ${synopsis ? buildDetailTextSurface("Synopsis", synopsis, "sd-tab-surface detail-feature-surface-synopsis") : ""}
      ${buildCastHTML(tmdb) ? `<section class="sd-tab-surface"><div class="sd-section-title">Casting principal</div>${buildCastHTML(tmdb)}</section>` : ""}
      ${item.notes ? buildDetailTextSurface("Mes notes", item.notes, "sd-tab-surface detail-feature-surface-notes") : ""}
    </div>`;
}

async function openDetail(id) {
  let item = items.find((i) => i.id === id);
  if (!item) return;

  currentItemId = id;
  currentDetailTmdb = null;
  document.getElementById("detailTitle").textContent = item.title;
  document.getElementById("detailContent").innerHTML = buildDetailHTML(
    item,
    null,
  );
  document.getElementById("detailModal").classList.add("active");

  if (item.tmdbId && TMDB_API_KEY !== "VOTRE_CLE_API_ICI") {
    try {
      const endpoint = item.type === "movie" ? "movie" : "tv";
      const [res, watchProviders] = await Promise.all([
        fetch(
          `${TMDB_BASE_URL}/${endpoint}/${item.tmdbId}?api_key=${TMDB_API_KEY}&language=fr-FR&append_to_response=credits,videos`,
        ),
        fetchWatchProviders(endpoint, item.tmdbId),
      ]);
      if (res.ok) {
        const tmdb = await res.json();
        tmdb.watchProviders = watchProviders;
        currentDetailTmdb = tmdb;
        const provider =
          getPrimaryWatchProvider(watchProviders, {
            includedOnly: true,
          }) ||
          (item.type === "series"
            ? getUserMatchingNetworkProvider(tmdb) ||
              getPrimaryStreamingNetworkProvider(tmdb)
            : null);
        const canonicalReleaseDate =
          item.type === "movie" ? tmdb.release_date : tmdb.first_air_date;

        // Enrichir l'item en localStorage si seasonData manque
        if (item.type === "series" && tmdb.seasons && !item.seasonData) {
          const seasonData = {};
          tmdb.seasons
            .filter((s) => s.season_number > 0)
            .forEach((s) => {
              seasonData[String(s.season_number)] = s.episode_count;
            });
          const idx = items.findIndex((i) => i.id === item.id);
          if (idx !== -1) {
            items[idx] = {
              ...items[idx],
              seasonData,
              totalEpisodes:
                tmdb.number_of_episodes || items[idx].totalEpisodes,
              providerLogo:
                provider?.providerLogo || items[idx].providerLogo || null,
              providerName:
                provider?.providerName || items[idx].providerName || null,
              providerAccessType:
                provider?.providerAccessType ||
                items[idx].providerAccessType ||
                null,
              providerPriorityVersion: WATCH_PROVIDER_PRIORITY_VERSION,
              releaseDate:
                canonicalReleaseDate || items[idx].releaseDate || null,
              year:
                (canonicalReleaseDate || "").substring(0, 4) || items[idx].year,
            };
            item = items[idx];
            localStorage.setItem("watchlist", JSON.stringify(items));
          }
        } else if (provider?.providerName) {
          const idx = items.findIndex((i) => i.id === item.id);
          if (idx !== -1) {
            items[idx] = {
              ...items[idx],
              providerLogo: provider.providerLogo || null,
              providerName: provider.providerName,
              providerAccessType: provider.providerAccessType || null,
              providerPriorityVersion: WATCH_PROVIDER_PRIORITY_VERSION,
              releaseDate:
                canonicalReleaseDate || items[idx].releaseDate || null,
              year:
                (canonicalReleaseDate || "").substring(0, 4) || items[idx].year,
            };
            item = items[idx];
            localStorage.setItem("watchlist", JSON.stringify(items));
          }
        }

        const detailContentEl = document.getElementById("detailContent");
        const openSeasonBlock = detailContentEl?.querySelector(".sd-season-block.sd-open");
        const openSeasonId = openSeasonBlock?.id || null;
        const openSeasonNum = openSeasonId
          ? parseInt(openSeasonId.split("_").pop(), 10)
          : NaN;
        const savedScrollTop = detailContentEl?.scrollTop || 0;

        detailContentEl.innerHTML = buildDetailHTML(item, tmdb);

        if (!isNaN(openSeasonNum)) {
          setTimeout(async () => {
            const block = document.getElementById(`sdSeasonBlock_${id}_${openSeasonNum}`);
            if (block && !block.classList.contains("sd-open")) {
              await toggleSeasonEpisodes(id, openSeasonNum, { stopPropagation() {} });
            }
            const dc = document.getElementById("detailContent");
            if (dc) dc.scrollTop = savedScrollTop;
          }, 50);
        }

        // Charger les similaires en arrière-plan
        const endpoint = item.type === "movie" ? "movie" : "tv";
        loadSimilars(endpoint, item.tmdbId, item, tmdb);
      }
    } catch (e) {
      console.error("Erreur enrichissement TMDB:", e);
    }
  }
}

const similarsCache = {};

function getReferenceGenreIds(referenceItem, referenceTmdb, endpoint) {
  if (Array.isArray(referenceTmdb?.genres) && referenceTmdb.genres.length) {
    return referenceTmdb.genres
      .map((genre) => Number(genre?.id))
      .filter((genreId) => Number.isFinite(genreId));
  }

  const genreLabelSource = String(referenceItem?.genre || "");
  if (!genreLabelSource.trim()) return [];

  const genreMap = endpoint === "movie" ? GENRE_MAP.movie : GENRE_MAP.tv;
  const labelToId = new Map(
    Object.entries(genreMap).map(([genreId, label]) => [
      label,
      Number(genreId),
    ]),
  );

  return genreLabelSource
    .split(",")
    .map((label) => label.trim())
    .map((label) => labelToId.get(label))
    .filter((genreId) => Number.isFinite(genreId));
}

function getReferenceYear(referenceItem, referenceTmdb, endpoint) {
  const rawDate =
    endpoint === "movie"
      ? referenceTmdb?.release_date || referenceItem?.releaseDate
      : referenceTmdb?.first_air_date || referenceItem?.releaseDate;
  const rawYear = String(rawDate || referenceItem?.year || "").slice(0, 4);
  return Number.parseInt(rawYear, 10) || null;
}

function scoreSimilarCandidate(
  candidate,
  referenceItem,
  referenceTmdb,
  endpoint,
  sourceFlags,
) {
  const referenceGenreIds = new Set(
    getReferenceGenreIds(referenceItem, referenceTmdb, endpoint),
  );
  const candidateGenreIds = Array.isArray(candidate?.genre_ids)
    ? candidate.genre_ids.filter((genreId) => Number.isFinite(Number(genreId)))
    : [];
  const sharedGenres = candidateGenreIds.filter((genreId) =>
    referenceGenreIds.has(Number(genreId)),
  ).length;
  const referenceYear = getReferenceYear(
    referenceItem,
    referenceTmdb,
    endpoint,
  );
  const candidateYear = Number.parseInt(
    String(candidate?.release_date || candidate?.first_air_date || "").slice(
      0,
      4,
    ),
    10,
  );
  const yearDelta =
    referenceYear && candidateYear
      ? Math.abs(referenceYear - candidateYear)
      : null;

  let score = 0;

  if (sourceFlags.recommendation) score += 28;
  if (sourceFlags.similar) score += 18;
  if (sourceFlags.recommendation && sourceFlags.similar) score += 10;

  score += Math.min(sharedGenres * 16, 40);

  if (yearDelta !== null) {
    if (yearDelta <= 2) score += 18;
    else if (yearDelta <= 5) score += 12;
    else if (yearDelta <= 10) score += 5;
    else if (yearDelta >= 20) score -= 14;
    else if (yearDelta >= 30) score -= 22;
  }

  if (candidate?.poster_path) score += 12;
  else score -= 10;

  if (candidate?.backdrop_path) score += 4;

  const voteAverage = Number(candidate?.vote_average || 0);
  const voteCount = Number(candidate?.vote_count || 0);
  const popularity = Number(candidate?.popularity || 0);

  score += Math.min(voteAverage * 1.6, 14);
  score += Math.min(voteCount / 120, 10);
  score += Math.min(popularity / 18, 8);

  if (voteCount < 8) score -= 6;
  if (!candidateYear) score -= 4;

  return score;
}

function rankSimilarResults(
  endpoint,
  referenceItem,
  referenceTmdb,
  similarResults,
  recommendedResults,
) {
  const merged = new Map();

  similarResults.forEach((candidate) => {
    if (!candidate?.id) return;
    merged.set(candidate.id, {
      ...candidate,
      __sources: { similar: true, recommendation: false },
    });
  });

  recommendedResults.forEach((candidate) => {
    if (!candidate?.id) return;
    const existing = merged.get(candidate.id);
    if (existing) {
      merged.set(candidate.id, {
        ...existing,
        ...candidate,
        __sources: { similar: true, recommendation: true },
      });
      return;
    }

    merged.set(candidate.id, {
      ...candidate,
      __sources: { similar: false, recommendation: true },
    });
  });

  return [...merged.values()]
    .map((candidate) => ({
      ...candidate,
      __score: scoreSimilarCandidate(
        candidate,
        referenceItem,
        referenceTmdb,
        endpoint,
        candidate.__sources || { similar: false, recommendation: false },
      ),
    }))
    .filter((candidate) => candidate.__score >= 18)
    .sort((left, right) => right.__score - left.__score)
    .slice(0, 12)
    .map(({ __score, __sources, ...candidate }) => candidate);
}

async function loadSimilars(
  endpoint,
  tmdbId,
  referenceItem = null,
  referenceTmdb = null,
) {
  const container = document.getElementById("similarsContainer");
  if (!container) return;

  const cacheKey = `${endpoint}-${tmdbId}`;
  if (similarsCache[cacheKey]) {
    container.innerHTML = renderSimilarsHTML(similarsCache[cacheKey], endpoint);
    return;
  }

  try {
    const [similarRes, recommendationsRes] = await Promise.all([
      fetch(
        `${TMDB_BASE_URL}/${endpoint}/${tmdbId}/similar?api_key=${TMDB_API_KEY}&language=fr-FR&page=1`,
      ),
      fetch(
        `${TMDB_BASE_URL}/${endpoint}/${tmdbId}/recommendations?api_key=${TMDB_API_KEY}&language=fr-FR&page=1`,
      ),
    ]);
    if (!similarRes.ok && !recommendationsRes.ok) throw new Error();

    const similarData = similarRes.ok
      ? await similarRes.json()
      : { results: [] };
    const recommendationsData = recommendationsRes.ok
      ? await recommendationsRes.json()
      : { results: [] };
    const results = rankSimilarResults(
      endpoint,
      referenceItem,
      referenceTmdb,
      Array.isArray(similarData.results)
        ? similarData.results.slice(0, 20)
        : [],
      Array.isArray(recommendationsData.results)
        ? recommendationsData.results.slice(0, 20)
        : [],
    );
    similarsCache[cacheKey] = results;
    if (document.getElementById("similarsContainer")) {
      document.getElementById("similarsContainer").innerHTML =
        renderSimilarsHTML(results, endpoint);
    }
  } catch {
    if (document.getElementById("similarsContainer")) {
      document.getElementById("similarsContainer").innerHTML =
        `<p class="similars-empty">Impossible de charger les suggestions.</p>`;
    }
  }
}

function renderSimilarsHTML(results, endpoint) {
  const type = endpoint === "movie" ? "movie" : "series";
  if (!results.length) {
    return `<p class="similars-empty">Aucune suggestion disponible.</p>`;
  }

  return results
    .map((r) => {
      const title = r.title || r.name || "";
      const year = (r.release_date || r.first_air_date || "").slice(0, 4);
      const poster = r.poster_path
        ? `${TMDB_IMAGE_BASE}${r.poster_path}`
        : null;
      const rating = r.vote_average ? r.vote_average.toFixed(1) : null;
      const mediaType = endpoint === "movie" ? "movie" : "tv";
      const alreadyIn = items.some((i) =>
        isSameTmdbCollectionItem(i, r.id, mediaType),
      );

      setTrendingCacheItem(r, mediaType);

      return `
        <div class="similar-card" onclick="showTrendingDetail(${r.id}, '${mediaType}')">
          <div class="similar-poster">
            ${
              poster
                ? `<img src="${escapeHtml(poster)}" alt="${escapeHtml(title)}" loading="lazy">`
                : `<div class="similar-placeholder">${type === "movie" ? "🎬" : "📺"}</div>`
            }
            ${rating ? `<span class="similar-rating">★ ${rating}</span>` : ""}
          </div>
          <div class="similar-info">
            <div class="similar-title">${escapeHtml(title)}</div>
            ${year ? `<div class="similar-year">${year}</div>` : ""}
          </div>
          ${
            alreadyIn
              ? `<div class="similar-owned">✓ Collection</div>`
              : `<button class="similar-add" onclick="event.stopPropagation(); addFromTrendingById(${r.id}, '${mediaType}')" title="Ajouter à la collection">+</button>`
          }
        </div>`;
    })
    .join("");
}

function closeDetailModal() {
  document.getElementById("detailModal").classList.remove("active");
}

function editItem() {
  const item = items.find((i) => i.id === currentItemId);
  if (!item) return;

  closeDetailModal();
  openAddModal(); // réinitialise le formulaire et ouvre la modal
  populateAddModalFromCollectionItem(item);
}

function deleteItem() {
  if (!confirm("Supprimer ce contenu ?")) return;

  items = items.filter((i) => i.id !== currentItemId);
  localStorage.setItem("watchlist", JSON.stringify(items));
  closeDetailModal();
  renderItems();
  showToast("Contenu supprimé");
}

function hasConfiguredTmdbApiKey() {
  return Boolean(TMDB_API_KEY && TMDB_API_KEY !== "VOTRE_CLE_API_ICI");
}

function loadRecentSuggestionHistory() {
  try {
    const stored = JSON.parse(
      localStorage.getItem(SUGGESTION_RECENT_HISTORY_STORAGE_KEY) || "[]",
    );
    return Array.isArray(stored)
      ? stored.filter(Boolean).slice(0, SUGGESTION_RECENT_HISTORY_LIMIT)
      : [];
  } catch {
    return [];
  }
}

function rememberSuggestion(item) {
  if (!item?.id) return;
  recentSuggestionHistory = [
    item.id,
    ...recentSuggestionHistory.filter((id) => id !== item.id),
  ].slice(0, SUGGESTION_RECENT_HISTORY_LIMIT);
  localStorage.setItem(
    SUGGESTION_RECENT_HISTORY_STORAGE_KEY,
    JSON.stringify(recentSuggestionHistory),
  );
}

function getEstimatedWatchMinutes(item) {
  if (!item) return null;
  if (item.type === "series") return CONSTANTS.EPISODE_AVERAGE_DURATION;

  const duration =
    item.runtime ||
    item.duration ||
    item.runtimeMinutes ||
    item.durationMinutes ||
    CONSTANTS.MOVIE_AVERAGE_DURATION;
  const minutes = Number(duration);
  return Number.isFinite(minutes) && minutes > 0
    ? minutes
    : CONSTANTS.MOVIE_AVERAGE_DURATION;
}

function matchesSuggestionTimeFilter(item) {
  const value = suggestionFilters.time;
  if (!value || value === "all") return true;

  const minutes = getEstimatedWatchMinutes(item);
  if (!minutes) return true;

  const maxByFilter = {
    "30": 30,
    "60": 60,
    "120": 120,
    evening: 180,
  };
  const maxMinutes = maxByFilter[value];
  return !maxMinutes || minutes <= maxMinutes;
}

function formatWatchMinutes(minutes) {
  if (!minutes) return "";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h${String(rest).padStart(2, "0")}` : `${hours}h`;
}

function getSuggestionFilterGroups() {
  return [
    {
      key: "mode",
      label: "Mode",
      options: [
        { value: "solo", label: "Solo" },
        { value: "group", label: "Groupe" },
      ],
    },
    {
      key: "source",
      label: "Source",
      options: [
        { value: "all", label: "Tout" },
        { value: "collection", label: "Ma liste" },
        { value: "discover", label: "Découvrir" },
      ],
    },
    {
      key: "type",
      label: "Type",
      options: [
        { value: "all", label: "Tout" },
        { value: "movie", label: "Films" },
        { value: "series", label: "Séries" },
      ],
    },
    {
      key: "mood",
      label: "Ambiance",
      options: [
        { value: "all", label: "Toute" },
        { value: "light", label: "Léger" },
        { value: "intense", label: "Intense" },
      ],
    },
    {
      key: "availability",
      label: "Dispo",
      options: [
        { value: "all", label: "Tout" },
        { value: "mine", label: "Mes plateformes" },
      ],
    },
    {
      key: "time",
      label: "Temps",
      options: [
        { value: "all", label: "Tout" },
        { value: "30", label: "30 min" },
        { value: "60", label: "1h" },
        { value: "120", label: "2h" },
        { value: "evening", label: "Soiree" },
      ],
    },
  ];
}

function buildSuggestionFiltersHTML() {
  const groups = getSuggestionFilterGroups();
  const activeLabels = groups
    .map((g) => g.options.find((o) => o.value === suggestionFilters[g.key])?.label)
    .filter(Boolean)
    .filter((label, i, arr) => arr.indexOf(label) === i)
    .join(" · ");

  const rows = groups
    .map(
      (group) => `
      <div class="watch-pick-filter-row">
        <span class="watch-pick-filter-label">${escapeHtml(group.label)}</span>
        <div class="watch-pick-filter-group">
          ${group.options
            .map(
              (option) => `<button
                class="${suggestionFilters[group.key] === option.value ? "active" : ""}"
                onclick="setSuggestionFilter('${group.key}', '${option.value}')"
              >${escapeHtml(option.label)}</button>`,
            )
            .join("")}
        </div>
      </div>
    `,
    )
    .join("");

  return `
    <div class="watch-pick-filters-header" onclick="toggleSuggestionFilters()">
      <span class="watch-pick-filters-summary">${escapeHtml(activeLabels)}</span>
      <span class="watch-pick-filters-arrow">${suggestionFiltersOpen ? "▲" : "▼"}</span>
    </div>
    <div class="watch-pick-filters-body${suggestionFiltersOpen ? "" : " collapsed"}">
      ${rows}
    </div>
  `;
}

function buildGroupPickerHTML() {
  if (suggestionFilters.mode !== "group") return "";
  const activeProfiles = getActiveGroupProfiles();
  const commonProviders = getGroupCommonProviderKeys();
  const commonProviderLabel = commonProviders.length
    ? commonProviders.map(getProviderOptionLabel).join(", ")
    : "Aucune plateforme commune";

  return `
    <div class="watch-pick-group">
      <div class="watch-pick-group-head">
        <span>Mode groupe</span>
        <button onclick="addGroupProfile()">+ Profil</button>
      </div>
      <div class="watch-pick-group-people">
        ${groupProfiles
          .map(
            (profile) => `
          <button
            class="${activeGroupProfileIds.includes(profile.id) ? "active" : ""}"
            onclick="toggleActiveGroupProfile('${profile.id}')"
          >
            ${escapeHtml(profile.name)}
          </button>
        `,
          )
          .join("")}
      </div>
      <div class="watch-pick-group-common">
        <strong>${activeProfiles.length}/${groupProfiles.length} participant${activeProfiles.length > 1 ? "s" : ""}</strong>
        <span>Plateformes communes: ${escapeHtml(commonProviderLabel)}</span>
      </div>
      <div class="watch-pick-group-profiles">
        ${activeProfiles
          .map(
            (profile) => `
          <div class="watch-pick-profile">
            <div class="watch-pick-profile-title">
              <strong>${escapeHtml(profile.name)}</strong>
              <span>${(profile.providers || []).length} plateforme${(profile.providers || []).length > 1 ? "s" : ""}</span>
            </div>
            <div class="watch-pick-profile-label">Plateformes</div>
            <div class="watch-pick-profile-chips">
              ${USER_PROVIDER_OPTIONS.map(
                (provider) => `
                <button
                  class="${(profile.providers || []).includes(provider.key) ? "active" : ""}"
                  onclick="toggleGroupProfileProvider('${profile.id}', '${provider.key}')"
                >
                  ${escapeHtml(provider.label)}
                </button>
              `,
              ).join("")}
            </div>
            <div class="watch-pick-profile-label">Genres a eviter</div>
            <div class="watch-pick-profile-chips">
              ${GROUP_GENRE_OPTIONS.map(
                (genre) => `
                <button
                  class="${(profile.dislikedGenres || []).includes(genre.key) ? "danger active" : ""}"
                  onclick="toggleGroupProfileGenre('${profile.id}', '${genre.key}', 'dislikedGenres')"
                >
                  ${escapeHtml(genre.label)}
                </button>
              `,
              ).join("")}
            </div>
          </div>
        `,
          )
          .join("")}
      </div>
    </div>
  `;
}

function setSuggestionFilter(key, value) {
  if (!(key in suggestionFilters)) return;
  suggestionFilters[key] = value;
  randomSuggestion();
}

function toggleSuggestionFilters() {
  suggestionFiltersOpen = !suggestionFiltersOpen;
  const body = document.querySelector(".watch-pick-filters-body");
  const arrow = document.querySelector(".watch-pick-filters-arrow");
  if (body) body.classList.toggle("collapsed", !suggestionFiltersOpen);
  if (arrow) arrow.textContent = suggestionFiltersOpen ? "▲" : "▼";
}

function toggleActiveGroupProfile(profileId) {
  if (activeGroupProfileIds.includes(profileId)) {
    activeGroupProfileIds = activeGroupProfileIds.filter(
      (id) => id !== profileId,
    );
  } else {
    activeGroupProfileIds = [...activeGroupProfileIds, profileId];
  }
  if (!activeGroupProfileIds.length && groupProfiles.length) {
    activeGroupProfileIds = [groupProfiles[0].id];
  }
  saveActiveGroupProfileIds();
  randomSuggestion();
}

function addGroupProfile() {
  const name = prompt("Nom du profil");
  if (!name || !name.trim()) return;
  const id = `profile-${Date.now()}`;
  groupProfiles = [
    ...groupProfiles,
    {
      id,
      name: name.trim().slice(0, 24),
      providers: userProviderKeys,
      likedGenres: [],
      dislikedGenres: [],
    },
  ];
  activeGroupProfileIds = [...new Set([...activeGroupProfileIds, id])];
  saveGroupProfiles();
  saveActiveGroupProfileIds();
  randomSuggestion();
}

function updateGroupProfile(profileId, updater) {
  groupProfiles = groupProfiles.map((profile) =>
    profile.id === profileId
      ? normalizeGroupProfile(updater(profile))
      : profile,
  );
  saveGroupProfiles();
  if (profileId === "me") {
    userProviderKeys =
      groupProfiles.find((profile) => profile.id === "me")?.providers || [];
    saveUserProviderKeys();
  }
  randomSuggestion();
}

function toggleGroupProfileProvider(profileId, providerKey) {
  updateGroupProfile(profileId, (profile) => {
    const providers = profile.providers || [];
    return {
      ...profile,
      providers: providers.includes(providerKey)
        ? providers.filter((key) => key !== providerKey)
        : [...providers, providerKey],
    };
  });
}

function toggleGroupProfileGenre(profileId, genreKey, preferenceKey) {
  if (!["likedGenres", "dislikedGenres"].includes(preferenceKey)) return;

  updateGroupProfile(profileId, (profile) => {
    const preferences = profile[preferenceKey] || [];
    return {
      ...profile,
      [preferenceKey]: preferences.includes(genreKey)
        ? preferences.filter((key) => key !== genreKey)
        : [...preferences, genreKey],
    };
  });
}

function getItemMood(item) {
  const text = `${item.genre || ""} ${item.title || ""}`.toLowerCase();
  const lightWords = [
    "animation",
    "comédie",
    "comedie",
    "familial",
    "family",
    "romance",
    "music",
    "musique",
  ];
  const intenseWords = [
    "crime",
    "drame",
    "drama",
    "horreur",
    "horror",
    "thriller",
    "guerre",
    "war",
    "mystère",
    "mystery",
  ];

  if (lightWords.some((word) => text.includes(word))) return "light";
  if (intenseWords.some((word) => text.includes(word))) return "intense";
  return "all";
}

function getPersonalGenreProfile() {
  const signature = items
    .map(
      (item) =>
        `${item.id}|${item.genre || ""}|${item.status || ""}|${item.rating || ""}|${item.tmdbRating || ""}`,
    )
    .join("~");

  if (personalGenreProfileCache.signature === signature) {
    return personalGenreProfileCache;
  }

  const scores = new Map();

  items.forEach((item) => {
    if (item?.isExternalSuggestion || item?.status === "external") return;

    const genreKeys = getItemGenreKeys(item);
    if (!genreKeys.length) return;

    let weight = 1;

    if (item.status === "watched") weight += 1.6;
    else if (item.status === "watching") weight += 1.3;
    else if (item.status === "towatch") weight += 0.9;
    else if (item.status === "paused") weight += 0.4;
    else if (item.status === "dropped") weight -= 0.8;

    if (item.rating) {
      weight += Math.max(0, Number(item.rating) - 2.5) * 0.9;
    } else if (item.tmdbRating) {
      weight += Math.max(0, Number(item.tmdbRating) - 2.5) * 0.45;
    }

    if (!Number.isFinite(weight) || weight <= 0) return;

    genreKeys.forEach((genreKey) => {
      scores.set(genreKey, (scores.get(genreKey) || 0) + weight);
    });
  });

  const topGenres = [...scores.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 3)
    .map(([genreKey]) => genreKey);

  personalGenreProfileCache = {
    signature,
    scores,
    topGenres,
  };

  return personalGenreProfileCache;
}

function getPersonalGenreAffinity(item) {
  const profile = getPersonalGenreProfile();
  const genreKeys = getItemGenreKeys(item);
  if (!genreKeys.length || !profile.scores.size) {
    return { boost: 0, matchedGenres: [], topGenres: profile.topGenres };
  }

  const maxScore = Math.max(...profile.scores.values(), 1);
  const matchedGenres = genreKeys.filter((genreKey) =>
    profile.scores.has(genreKey),
  );

  if (!matchedGenres.length) {
    return { boost: 0, matchedGenres: [], topGenres: profile.topGenres };
  }

  const affinity =
    matchedGenres.reduce(
      (total, genreKey) => total + (profile.scores.get(genreKey) || 0) / maxScore,
      0,
    ) / Math.max(1, genreKeys.length);

  return {
    boost: Math.round(Math.min(26, affinity * 26)),
    matchedGenres,
    topGenres: profile.topGenres,
  };
}

function matchesSuggestionFilters(item, source, { ignoreAvailability = false } = {}) {
  if (
    suggestionFilters.source !== "all" &&
    suggestionFilters.source !== source
  ) {
    return false;
  }
  if (
    suggestionFilters.type !== "all" &&
    item.type !== suggestionFilters.type
  ) {
    return false;
  }
  if (
    suggestionFilters.mood !== "all" &&
    getItemMood(item) !== suggestionFilters.mood
  ) {
    return false;
  }
  if (!matchesSuggestionTimeFilter(item)) {
    return false;
  }
  if (!ignoreAvailability && suggestionFilters.availability === "mine") {
    if (suggestionFilters.mode === "group") {
      if (!getGroupProviderMatchCountForItem(item)) return false;
    } else if (!isUserProviderAvailableItem(item) && !item.onUserPlatforms) {
      return false;
    }
  }
  return true;
}

function getSuggestionScore(item, index) {
  let score = 0;
  const genreAffinity = getPersonalGenreAffinity(item);

  if (item.isExternalSuggestion) score += 54;
  if (item.status === "towatch") score += 70;
  if (item.status === "watching") score += 62;
  if (item.status === "paused") score += 22;
  if (item.status === "watched") score -= 45;

  if (item.rating) score += Number(item.rating) * 8;
  if (item.tmdbRating) score += Number(item.tmdbRating) * 4;
  if (hasIncludedWatchProvider(item)) score += 12;
  if (isUserProviderAvailableItem(item)) score += 38;
  if (suggestionFilters.mode === "group" && hasIncludedWatchProvider(item)) {
    const activeCount = getActiveGroupProfiles().length || 1;
    const matchCount = getGroupProviderMatchCountForItem(item);
    score += matchCount * 22;
    if (matchCount === activeCount) score += 28;
  }
  if (suggestionFilters.mode === "group") {
    const genreStats = getGroupGenrePreferenceStats(item);
    score += genreStats.likedBy.length * 12;
    score -= genreStats.dislikedBy.length * 55;
  }
  if (item.posterUrl) score += 6;
  if (item.notes) score += 4;
  score += genreAffinity.boost;
  if (item.id === lastSuggestedItemId) score -= 80;

  const addedTime = new Date(item.dateAdded || 0).getTime();
  if (addedTime) {
    const ageDays = Math.max(0, (Date.now() - addedTime) / 86400000);
    score += Math.min(ageDays / 7, 16);
  }

  return score + Math.max(0, 8 - index) * 0.6;
}

function getSuggestionReasons(item) {
  const reasons = [];
  const genreAffinity = getPersonalGenreAffinity(item);
  const estimatedMinutes = getEstimatedWatchMinutes(item);

  if (suggestionFilters.time !== "all" && estimatedMinutes) {
    const label = item.type === "series" ? "Un episode" : "Ce film";
    const providerLabel =
      item.providerName || getUserProviderLabelList().join(" ou ");
    reasons.push(
      `${label} tient dans ton temps disponible (${formatWatchMinutes(estimatedMinutes)}).`,
    );
  }

  if (item.isExternalSuggestion) {
    reasons.push("Suggestion hors collection, trouvée via TMDB.");
  }
  if (item.status === "towatch") reasons.push("Il est dans ta liste à voir.");
  if (item.status === "watching") reasons.push("Tu l'as déjà commencé.");
  if (hasIncludedWatchProvider(item)) {
    const groupMatchCount =
      suggestionFilters.mode === "group"
        ? getGroupProviderMatchCountForItem(item)
        : 0;
    reasons.push(
      suggestionFilters.mode === "group" && groupMatchCount > 0
        ? `Disponible pour ${groupMatchCount}/${getActiveGroupProfiles().length} participant${getActiveGroupProfiles().length > 1 ? "s" : ""} via ${providerLabel}.`
        : isUserProvider(item.providerName)
          ? `Disponible sur ${item.providerName}, une de tes plateformes.`
          : `Plateforme détectée: ${item.providerName}.`,
    );
  }
  if (suggestionFilters.mode === "group") {
    const genreStats = getGroupGenrePreferenceStats(item);
    if (genreStats.likedBy.length) {
      reasons.push(
        `Genre apprecie par ${genreStats.likedBy.slice(0, 2).join(", ")}.`,
      );
    }
    if (genreStats.dislikedBy.length) {
      reasons.push(
        `Compromis imparfait: ${genreStats.dislikedBy.slice(0, 2).join(", ")} evite ce genre.`,
      );
    }
  }
  if (item.rating) {
    reasons.push(`Tu lui as mis ${item.rating}/5.`);
  } else if (item.tmdbRating) {
    reasons.push(`Bon signal TMDB: ${item.tmdbRating}/5.`);
  }
  if (genreAffinity.matchedGenres.length) {
    const labels = genreAffinity.matchedGenres
      .slice(0, 2)
      .map(getGenreOptionLabel)
      .join(", ");
    reasons.push(`Proche de tes genres favoris: ${labels}.`);
  }
  if (item.dateAdded) {
    const ageDays = Math.floor(
      Math.max(0, Date.now() - new Date(item.dateAdded).getTime()) / 86400000,
    );
    if (ageDays >= 14) reasons.push(`Ajouté depuis ${ageDays} jours.`);
  }
  if (item.type === "series" && item.currentSeason && item.currentEpisode) {
    reasons.push(
      `Reprise possible à ${getNextEpisodeDisplay(item, "compact")}.`,
    );
  }

  return reasons.length
    ? reasons.slice(0, 3)
    : [
        "Choix équilibré dans ta collection.",
        "Pas besoin de repartir chercher ailleurs.",
      ];
}

function normalizeExternalSuggestionItem(
  tmdbItem,
  mediaType,
  {
    onUserPlatforms = false,
    providerName = null,
    providerLogo = null,
    providerAccessType = null,
  } = {},
) {
  const type = getCollectionTypeFromTmdbType(mediaType);
  const genreMap = type === "movie" ? GENRE_MAP.movie : GENRE_MAP.tv;
  const genre = Array.isArray(tmdbItem.genre_ids)
    ? tmdbItem.genre_ids
        .map((genreId) => genreMap[genreId])
        .filter(Boolean)
        .slice(0, 2)
        .join(", ")
    : "";

  setTrendingCacheItem(tmdbItem, mediaType);

  return {
    id: `tmdb-${mediaType}-${tmdbItem.id}`,
    title: tmdbItem.title || tmdbItem.name || "",
    type,
    year: (tmdbItem.release_date || tmdbItem.first_air_date || "").slice(0, 4),
    status: "external",
    rating: null,
    genre,
    notes: "",
    posterUrl: tmdbItem.poster_path
      ? `${TMDB_IMAGE_BASE}${tmdbItem.poster_path}`
      : "",
    tmdbId: tmdbItem.id,
    providerLogo,
    providerName,
    providerAccessType,
    providerPriorityVersion: WATCH_PROVIDER_PRIORITY_VERSION,
    tags: [],
    currentSeason: null,
    currentEpisode: null,
    dateAdded: null,
    watchedAt: null,
    tmdbRating: tmdbItem.vote_average
      ? (tmdbItem.vote_average / 2).toFixed(1)
      : null,
    isExternalSuggestion: true,
    mediaType,
    releaseDate: tmdbItem.release_date || tmdbItem.first_air_date || null,
    onUserPlatforms,
  };
}

async function fetchExternalSuggestionItems() {
  if (!hasConfiguredTmdbApiKey()) return [];

  const cacheKey = `${suggestionFilters.type}:${suggestionFilters.mood}`;
  const cacheIsFresh =
    suggestionExternalCache.key === cacheKey &&
    Date.now() - suggestionExternalCache.fetchedAt < 10 * 60 * 1000;
  if (cacheIsFresh) return suggestionExternalCache.items;

  const endpoints = [];
  if (suggestionFilters.type === "all" || suggestionFilters.type === "movie") {
    endpoints.push({
      mediaType: "movie",
      url: `${TMDB_BASE_URL}/trending/movie/week?api_key=${TMDB_API_KEY}&language=fr-FR`,
    });
  }
  if (suggestionFilters.type === "all" || suggestionFilters.type === "series") {
    endpoints.push({
      mediaType: "tv",
      url: `${TMDB_BASE_URL}/trending/tv/week?api_key=${TMDB_API_KEY}&language=fr-FR`,
    });
  }

  try {
    const payloads = await Promise.all(
      endpoints.map(async (endpoint) => {
        const response = await fetch(endpoint.url);
        if (!response.ok) return [];
        const data = await response.json();
        return (data.results || [])
          .filter(
            (tmdbItem) =>
              !items.some((item) =>
                isSameTmdbCollectionItem(item, tmdbItem.id, endpoint.mediaType),
              ),
          )
          .slice(0, 14)
          .map((tmdbItem) =>
            normalizeExternalSuggestionItem(tmdbItem, endpoint.mediaType),
          );
      }),
    );
    const externalItems = payloads.flat();
    suggestionExternalCache = {
      key: cacheKey,
      items: externalItems,
      fetchedAt: Date.now(),
    };
    return externalItems;
  } catch (error) {
    console.error("Erreur suggestion découverte:", error);
    return [];
  }
}

async function fetchExternalProviderItems() {
  if (!hasConfiguredTmdbApiKey()) return [];

  const providerTmdbIds = getUserProviderTmdbIds();
  if (!providerTmdbIds.length) return [];

  const cacheKey = `${SUGGESTION_PROVIDER_CACHE_VERSION}:${suggestionFilters.type}:providers:${[...userProviderKeys].sort().join(",")}`;
  const cacheIsFresh =
    suggestionProviderCache.key === cacheKey &&
    Date.now() - suggestionProviderCache.fetchedAt < 10 * 60 * 1000;
  if (cacheIsFresh) return suggestionProviderCache.items;

  const providerParam = providerTmdbIds.join("%7C");
  const selectedProviderLabel = getUserProviderLabelList().join(" ou ");
  const endpoints = [];
  if (suggestionFilters.type === "all" || suggestionFilters.type === "movie") {
    endpoints.push({
      mediaType: "movie",
      url: `${TMDB_BASE_URL}/discover/movie?api_key=${TMDB_API_KEY}&language=fr-FR&watch_region=FR&with_watch_providers=${providerParam}&with_watch_monetization_types=flatrate%7Cfree%7Cads&sort_by=popularity.desc`,
    });
  }
  if (suggestionFilters.type === "all" || suggestionFilters.type === "series") {
    endpoints.push({
      mediaType: "tv",
      url: `${TMDB_BASE_URL}/discover/tv?api_key=${TMDB_API_KEY}&language=fr-FR&watch_region=FR&with_watch_providers=${providerParam}&with_watch_monetization_types=flatrate%7Cfree%7Cads&sort_by=popularity.desc`,
    });
  }

  try {
    const payloads = await Promise.all(
      endpoints.map(async (endpoint) => {
        const response = await fetch(endpoint.url);
        if (!response.ok) return [];
        const data = await response.json();
        const candidates = (data.results || [])
          .filter(
            (tmdbItem) =>
              !items.some((item) =>
                isSameTmdbCollectionItem(item, tmdbItem.id, endpoint.mediaType),
              ),
          )
          .slice(0, 14);

        return Promise.all(
          candidates.map(async (tmdbItem) => {
            const watchProviders = await fetchWatchProviders(
              endpoint.mediaType,
              tmdbItem.id,
            );
            const provider =
              getUserMatchingWatchProvider(watchProviders) ||
              getPrimaryWatchProvider(watchProviders, { includedOnly: true });

            return normalizeExternalSuggestionItem(tmdbItem, endpoint.mediaType, {
              onUserPlatforms: true,
              providerName:
                provider?.providerName ||
                selectedProviderLabel ||
                "Tes plateformes",
              providerLogo: provider?.providerLogo || null,
              providerAccessType: provider?.providerAccessType || "flatrate",
            });
          }),
        );
      }),
    );
    const providerItems = payloads.flat();
    suggestionProviderCache = {
      key: cacheKey,
      items: providerItems,
      fetchedAt: Date.now(),
    };
    return providerItems;
  } catch (error) {
    console.error("Erreur suggestion plateformes:", error);
    return [];
  }
}

async function fetchExternalNetworkProviderItems(trendingItems) {
  if (
    suggestionFilters.availability !== "mine" ||
    !hasConfiguredTmdbApiKey() ||
    !userProviderKeys.length
  ) {
    return [];
  }

  const seriesItems = trendingItems
    .filter((item) => item.type === "series" && item.tmdbId)
    .slice(0, 12);
  if (!seriesItems.length) return [];

  try {
    const enriched = await Promise.all(
      seriesItems.map(async (item) => {
        const response = await fetch(
          `${TMDB_BASE_URL}/tv/${item.tmdbId}?api_key=${TMDB_API_KEY}&language=fr-FR`,
        );
        if (!response.ok) return null;
        const tmdbDetails = await response.json();
        const provider = getUserMatchingNetworkProvider(tmdbDetails);
        if (!provider) return null;

        return {
          ...item,
          onUserPlatforms: true,
          providerName: provider.providerName,
          providerLogo: provider.providerLogo,
          providerAccessType: provider.providerAccessType,
        };
      }),
    );
    return enriched.filter(Boolean);
  } catch (error) {
    console.error("Erreur suggestion reseaux plateformes:", error);
    return [];
  }
}

async function getSuggestionCandidatePool() {
  await refreshSuggestionProviderAvailability();

  const wantsExternal = suggestionFilters.source !== "collection";
  const wantsCollection = suggestionFilters.source !== "discover";
  const providerTmdbIds = getUserProviderTmdbIds();
  const wantsPlatforms =
    suggestionFilters.availability === "mine" && providerTmdbIds.length > 0;

  const releasedFilter = (item) => !isUpcomingMovieItem(item);
  const watchableStatuses = ["towatch", "watching", "paused"];

  // Fetch external items upfront (both trending and provider-filtered if needed).
  // Both are cached so parallel fetch is cheap on repeat calls.
  let trendingItems = [];
  let providerItems = [];
  let networkProviderItems = [];
  if (wantsExternal) {
    [trendingItems, providerItems] = await Promise.all([
      fetchExternalSuggestionItems(),
      wantsPlatforms ? fetchExternalProviderItems() : Promise.resolve([]),
    ]);
    if (wantsPlatforms) {
      networkProviderItems =
        await fetchExternalNetworkProviderItems(trendingItems);
    }
  }

  // Main pool: items that strictly match all active filters.
  const collectionCandidates = wantsCollection
    ? items
        .filter((item) => watchableStatuses.includes(item.status))
        .filter(releasedFilter)
        .filter((item) => matchesSuggestionFilters(item, "collection"))
    : [];

  const externalSourceItems = wantsPlatforms
    ? [
        ...providerItems,
        ...networkProviderItems.filter(
          (item) =>
            !providerItems.some((providerItem) => providerItem.id === item.id),
        ),
      ]
    : trendingItems;

  const externalCandidates = wantsExternal
    ? externalSourceItems
        .filter(releasedFilter)
        .filter((item) => matchesSuggestionFilters(item, "discover"))
    : [];

  let pool = [...collectionCandidates, ...externalCandidates];

  // Fallback: relax provider filter for collection items (provider data may be missing).
  if (!pool.length && suggestionFilters.availability === "mine" && wantsCollection) {
    const collectionFallback = items
      .filter((item) => watchableStatuses.includes(item.status))
      .filter(releasedFilter)
      .filter((item) =>
        matchesSuggestionFilters(item, "collection", { ignoreAvailability: true }),
      );
    pool = collectionFallback;
  }

  // Last resort: collection items that still respect hard filters.
  if (!pool.length && wantsCollection) {
    pool = items
      .filter((item) => watchableStatuses.includes(item.status))
      .filter(releasedFilter)
      .filter((item) =>
        suggestionFilters.type === "all" || item.type === suggestionFilters.type,
      )
      .filter(matchesSuggestionTimeFilter);
  }

  return pool;
}

async function getSmartSuggestion({ excludeIds = [] } = {}) {
  const pool = await getSuggestionCandidatePool();
  currentSuggestionCandidates = pool;

  const excludedIds = new Set(
    [...recentSuggestionHistory, ...excludeIds].filter(Boolean),
  );
  const filteredPool = pool.filter((item) => !excludedIds.has(item.id));
  const scoredPool = filteredPool.length ? filteredPool : pool;

  return [...scoredPool]
    .map((item, index) => ({
      item,
      score: getSuggestionScore(item, index),
      randomTieBreaker: Math.random(),
    }))
    .sort(
      (left, right) =>
        right.score - left.score ||
        right.randomTieBreaker - left.randomTieBreaker,
    )[0]?.item;
}

async function randomSuggestion() {
  if (items.length === 0 && suggestionFilters.source === "collection") {
    showToast("Ajoutez des contenus d'abord !");
    return;
  }

  document.getElementById("suggestionModalTitle").textContent =
    "Que regarder ?";
  document.getElementById("suggestionModal").classList.add("active");
  document.getElementById("suggestionContent").innerHTML = `
    <div class="watch-pick">
      <div class="watch-pick-filters">${buildSuggestionFiltersHTML()}</div>
      ${buildGroupPickerHTML()}
      <div class="watch-pick-loading">Recherche d'une bonne option...</div>
    </div>
  `;

  const suggestedItem = await getSmartSuggestion({
    excludeIds: [lastSuggestedItemId],
  });
  if (!suggestedItem) {
    const tmdbUnavailable =
      !hasConfiguredTmdbApiKey() && suggestionFilters.source !== "collection";
    const providerUnavailable =
      !tmdbUnavailable &&
      suggestionFilters.availability === "mine" &&
      suggestionFilters.source === "discover";
    const emptyTitle = tmdbUnavailable
      ? "Découvrir nécessite une clé TMDB."
      : providerUnavailable
      ? "Aucun titre trouve sur tes plateformes."
      : "Aucune suggestion avec ces filtres.";
    const emptyText = tmdbUnavailable
      ? "Ajoute une clé dans js/config.local.js, ou repasse sur Ma liste."
      : providerUnavailable
      ? "Essaie Tout dans Source, ou ajoute d'autres plateformes."
      : "Essaie Tout, ou repasse sur Ma liste.";
    document.getElementById("suggestionContent").innerHTML = `
      <div class="watch-pick">
        <div class="watch-pick-filters">${buildSuggestionFiltersHTML()}</div>
        ${buildGroupPickerHTML()}
        <div class="watch-pick-empty">
          <strong>${escapeHtml(emptyTitle)}</strong>
          <p>${escapeHtml(emptyText)}</p>
        </div>
      </div>
    `;
    return;
  }

  lastSuggestedItemId = suggestedItem.id;
  rememberSuggestion(suggestedItem);
  renderSuggestion(suggestedItem);
}

function renderSuggestion(item) {
  const statusText = item.isExternalSuggestion
    ? "Hors collection"
    : getStatusLabel(item.status);
  const year = item.year ? `<span>${escapeHtml(item.year)}</span>` : "";
  const genre = item.genre
    ? `<span>${escapeHtml(item.genre.split(",")[0].trim())}</span>`
    : "";
  const platformLabel =
    item.providerName ||
    (item.onUserPlatforms ? getUserProviderLabelList().join(" ou ") : "");
  const platformRow =
    platformLabel
      ? `<div class="watch-pick-platform">${item.providerLogo ? `<img src="${escapeHtml(item.providerLogo)}" alt="${escapeHtml(platformLabel)}">` : ""}<span>${escapeHtml(platformLabel)}</span></div>`
      : "";
  const rating = item.rating || item.tmdbRating || null;
  const ratingLabel = item.rating ? "Ta note" : "TMDB";
  const watchMinutes = getEstimatedWatchMinutes(item);
  const watchTimeLabel = watchMinutes
    ? item.type === "series"
      ? `Episode ~${formatWatchMinutes(watchMinutes)}`
      : `~${formatWatchMinutes(watchMinutes)}`
    : "";
  const reasons = getSuggestionReasons(item);
  const primaryAction = item.isExternalSuggestion
    ? `showTrendingDetail(${Number(item.tmdbId)}, '${item.mediaType}')`
    : `openDetail(${inlineJsString(item.id)})`;
  const secondaryAction = item.isExternalSuggestion
    ? `addFromTrendingById(${Number(item.tmdbId)}, '${item.mediaType}')`
    : `openWatchedFlowForSuggestion(${inlineJsString(item.id)})`;
  const alternatives = currentSuggestionCandidates
    .filter((candidate) => candidate.id !== item.id)
    .sort(
      (left, right) =>
        getSuggestionScore(right, 0) - getSuggestionScore(left, 0),
    )
    .slice(0, 3);

  document.getElementById("suggestionContent").innerHTML = `
        <div class="watch-pick">
          <div class="watch-pick-filters">${buildSuggestionFiltersHTML()}</div>
          ${buildGroupPickerHTML()}

          <div class="watch-pick-hero">
            ${item.posterUrl ? `<div class="watch-pick-hero-bg" style="background-image:url('${escapeHtml(item.posterUrl)}')"></div>` : ""}
            <div class="watch-pick-hero-inner">
              <div class="watch-pick-poster">
                ${
                  item.posterUrl
                    ? `<img src="${escapeHtml(item.posterUrl)}" alt="${escapeHtml(item.title)}">`
                    : `<div class="watch-pick-placeholder">${item.type === "movie" ? "🎬" : "📺"}</div>`
                }
              </div>
              <div class="watch-pick-main">
                <span class="watch-pick-kicker">Notre choix</span>
                <h3>${escapeHtml(item.title)}</h3>
                <div class="watch-pick-meta">
                  <span>${item.type === "movie" ? "Film" : "Série"}</span>
                  ${year}
                  ${genre}
                </div>
                ${platformRow}
                <div class="watch-pick-badges">
                  <span>${escapeHtml(statusText)}</span>
                  ${item.isExternalSuggestion ? `<span>Découverte TMDB</span>` : ""}
                  ${rating ? `<span>${ratingLabel}: ${Number(rating).toFixed(1)}/5</span>` : ""}
                  ${watchTimeLabel ? `<span>${escapeHtml(watchTimeLabel)}</span>` : ""}
                  ${
                    item.type === "series" && item.currentSeason && item.currentEpisode
                      ? `<span>${escapeHtml(getNextEpisodeDisplay(item, "compact"))}</span>`
                      : ""
                  }
                </div>
              </div>
            </div>
          </div>

          <div class="watch-pick-reasons">
            <span>Pourquoi celui-là ?</span>
            <ul>
              ${reasons.map((reason) => `<li>${escapeHtml(reason)}</li>`).join("")}
            </ul>
          </div>

          ${
            item.notes
              ? `
            <div class="watch-pick-note">
              <span>Ta note</span>
              <p>${escapeHtml(item.notes)}</p>
            </div>
          `
              : ""
          }

          <div class="watch-pick-actions">
            <button class="btn btn-primary" onclick="${primaryAction}; closeSuggestion();">
              Ouvrir la fiche
            </button>
            <button class="btn" onclick="${secondaryAction}; closeSuggestion();">
              ${item.isExternalSuggestion ? "Ajouter" : getWatchedRatingActionLabel(item)}
            </button>
            <button class="btn btn-shuffle" onclick="randomSuggestion()">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 18h1.4c1.3 0 2.5-.6 3.3-1.7l6.1-8.6c.7-1.1 2-1.7 3.3-1.7H22"/><path d="m18 2 4 4-4 4"/><path d="M2 6h1.9c1.5 0 2.9.9 3.5 2.2"/><path d="M22 18h-5.9c-1.3 0-2.5-.7-3.1-1.8l-.5-.8"/><path d="m18 14 4 4-4 4"/></svg>
              Autre choix
            </button>
          </div>

          ${
            alternatives.length
              ? `
            <div class="watch-pick-alternatives">
              <span>Autres pistes</span>
              <div>
                ${alternatives
                  .map(
                    (candidate) => `
                  <button onclick="showSuggestionById(${inlineJsString(candidate.id)})">
                    ${
                      candidate.posterUrl
                        ? `<img src="${escapeHtml(candidate.posterUrl)}" alt="">`
                        : `<span>${candidate.type === "movie" ? "🎬" : "📺"}</span>`
                    }
                    <strong>${escapeHtml(candidate.title)}</strong>
                  </button>
                `,
                  )
                  .join("")}
              </div>
            </div>
          `
              : ""
          }
        </div>
      `;
}

function showSuggestionById(itemId) {
  const item =
    currentSuggestionCandidates.find((entry) => entry.id === itemId) ||
    items.find((entry) => entry.id === itemId);
  if (!item) return;
  lastSuggestedItemId = item.id;
  rememberSuggestion(item);
  renderSuggestion(item);
}

function openWatchedFlowForSuggestion(itemId) {
  currentItemId = itemId;
  closeSuggestion();
  openWatchedFlowForCurrentItem();
}

function closeSuggestion() {
  document.getElementById("suggestionModal").classList.remove("active");
}

function openProviderSettings() {
  renderProviderSettings();
  document.getElementById("providerSettingsModal").classList.add("active");
}

function closeProviderSettings() {
  document.getElementById("providerSettingsModal").classList.remove("active");
}

function toggleUserProvider(providerKey) {
  if (userProviderKeys.includes(providerKey)) {
    userProviderKeys = userProviderKeys.filter((key) => key !== providerKey);
  } else {
    userProviderKeys = [...userProviderKeys, providerKey];
  }
  saveUserProviderKeys();
  syncCurrentUserGroupProfile();
  renderProviderSettings();
  showToast("Plateformes mises à jour");
}

function renderProviderSettings() {
  const container = document.getElementById("providerSettingsContent");
  if (!container) return;

  const selectedLabels = getUserProviderLabelList();

  container.innerHTML = `
    <div class="provider-settings">
      <p class="provider-settings-copy">
        Ces plateformes servent à mieux classer les suggestions dans "Que regarder ?".
      </p>
      <div class="provider-settings-grid">
        ${USER_PROVIDER_OPTIONS.map(
          (provider) => `
            <button
              class="${userProviderKeys.includes(provider.key) ? "active" : ""}"
              onclick="toggleUserProvider('${provider.key}')"
            >
              <span>${escapeHtml(provider.label)}</span>
              <small>${userProviderKeys.includes(provider.key) ? "Activée" : "Désactivée"}</small>
            </button>
          `,
        ).join("")}
      </div>
      <div class="provider-settings-summary">
        ${
          selectedLabels.length
            ? `Actives: ${escapeHtml(selectedLabels.join(", "))}`
            : "Aucune plateforme active pour le moment."
        }
      </div>
    </div>
  `;
}

function openDesignMockups() {
  const targetUrl = `design-lab.html?v=${Date.now()}#mockup-info-layouts`;
  const isMobileViewport = window.matchMedia("(max-width: 900px)").matches;

  if (isMobileViewport) {
    window.location.href = targetUrl;
    return;
  }

  const popup = window.open(targetUrl, "mockups", "width=1200,height=900");
  if (!popup) {
    window.location.href = targetUrl;
  }
}

function closeDesignMockups() {
  // Design mockups modal no longer exists
}

async function loadUpcoming() {
  const epContainer = document.getElementById("upcomingEpisodes");
  const seasonContainer = document.getElementById("upcomingSeasons");

  epContainer.innerHTML = `<div class="upcoming-loading">Chargement…</div>`;
  seasonContainer.innerHTML = `<div class="upcoming-loading">Chargement…</div>`;

  // Pour les épisodes : seulement les séries en cours ou à voir
  // Pour les saisons : toute la collection (une série "vue" peut avoir une nouvelle saison)
  const seriesForEpisodes = items.filter(
    (i) => i.type === "series" && i.tmdbId && i.status !== "watched",
  );
  const seriesForSeasons = items.filter((i) => i.type === "series" && i.tmdbId);

  const allSeriesIds = [...new Set(seriesForSeasons.map((i) => i.tmdbId))];

  if (allSeriesIds.length === 0) {
    epContainer.innerHTML = renderUpcomingEmpty(
      "Aucune série avec suivi TMDB dans votre collection.",
    );
    seasonContainer.innerHTML = renderUpcomingEmpty(
      "Aucune série avec suivi TMDB dans votre collection.",
    );
    return;
  }

  const results = await Promise.all(
    seriesForSeasons.map(async (item) => {
      try {
        const res = await fetch(
          `${TMDB_BASE_URL}/tv/${item.tmdbId}?api_key=${TMDB_API_KEY}&language=fr-FR`,
        );
        if (!res.ok) return null;
        const tmdb = await res.json();
        return { item, tmdb };
      } catch (e) {
        return null;
      }
    }),
  );

  const valid = results.filter(Boolean);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const in30days = new Date(today);
  in30days.setDate(today.getDate() + 30);

  // Épisodes à venir : seulement les séries non terminées
  const validForEpisodes = valid.filter(({ item }) =>
    seriesForEpisodes.some((s) => s.id === item.id),
  );

  const upcomingEps = validForEpisodes
    .filter(({ tmdb }) => tmdb.next_episode_to_air?.air_date)
    .map(({ item, tmdb }) => {
      const next = tmdb.next_episode_to_air;
      const airDate = new Date(next.air_date);
      return { item, tmdb, next, airDate };
    })
    .filter(({ airDate }) => airDate >= today && airDate <= in30days)
    .sort((a, b) => a.airDate - b.airDate);

  if (upcomingEps.length === 0) {
    epContainer.innerHTML = renderUpcomingEmpty(
      "Aucun épisode prévu dans les 30 prochains jours.",
    );
  } else {
    epContainer.innerHTML = upcomingEps
      .map(({ item, next, airDate }) => {
        const daysLeft = Math.round((airDate - today) / 86400000);
        const dateStr = airDate.toLocaleDateString("fr-FR", {
          weekday: "long",
          day: "numeric",
          month: "long",
        });
        const label =
          daysLeft === 0
            ? "Aujourd'hui"
            : daysLeft === 1
              ? "Demain"
              : `Dans ${daysLeft} jours`;
        const isUrgent = daysLeft <= 2;

        return `
        <div class="upcoming-row" onclick="openDetail(${inlineJsString(item.id)})">
          <div class="upcoming-poster">
            ${
              item.posterUrl
                ? `<img src="${escapeHtml(item.posterUrl)}" alt="${escapeHtml(item.title)}">`
                : `<div class="upcoming-poster-placeholder">📺</div>`
            }
          </div>
          <div class="upcoming-info">
            <div class="upcoming-title">${escapeHtml(item.title)}</div>
            <div class="upcoming-ep">S${next.season_number} E${next.episode_number}${next.name ? ` — ${escapeHtml(next.name)}` : ""}</div>
            <div class="upcoming-date">${dateStr}</div>
          </div>
          <div class="upcoming-badge ${isUrgent ? "upcoming-badge-urgent" : ""}">${label}</div>
        </div>`;
      })
      .join("");
  }

  // Saisons à venir (prochaine saison avec date future)
  const upcomingSeasons = valid
    .flatMap(({ item, tmdb }) => {
      if (!tmdb.seasons) return [];
      return tmdb.seasons
        .filter((s) => {
          if (s.season_number === 0) return false;
          if (!s.air_date) return false;
          const d = new Date(s.air_date);
          return d > today;
        })
        .map((s) => ({ item, season: s, airDate: new Date(s.air_date) }));
    })
    .sort((a, b) => a.airDate - b.airDate);

  if (upcomingSeasons.length === 0) {
    seasonContainer.innerHTML = renderUpcomingEmpty(
      "Aucune nouvelle saison annoncée pour vos séries.",
    );
  } else {
    // Grouper par mois
    const byMonth = {};
    upcomingSeasons.forEach(({ item, season, airDate }) => {
      const key = airDate.toLocaleDateString("fr-FR", {
        month: "long",
        year: "numeric",
      });
      if (!byMonth[key]) byMonth[key] = [];
      byMonth[key].push({ item, season, airDate });
    });

    seasonContainer.innerHTML = Object.entries(byMonth)
      .map(
        ([month, entries]) => `
      <div class="upcoming-month-group">
        <div class="upcoming-month-label">${month.toUpperCase()}</div>
        <div class="upcoming-seasons-grid">
          ${entries
            .map(({ item, season, airDate }) => {
              const daysLeft = Math.round((airDate - today) / 86400000);
              const label =
                daysLeft <= 30
                  ? `Dans ${daysLeft} jours`
                  : airDate.toLocaleDateString("fr-FR", {
                      day: "numeric",
                      month: "short",
                    });

              return `
              <div class="upcoming-season-card" onclick="openDetail(${inlineJsString(item.id)})">
                <div class="upcoming-season-poster">
                  ${
                    season.poster_path
                      ? `<img src="${TMDB_IMAGE_BASE}${season.poster_path}" alt="${escapeHtml(season.name)}">`
                      : item.posterUrl
                        ? `<img src="${escapeHtml(item.posterUrl)}" alt="${escapeHtml(item.title)}">`
                        : `<div class="upcoming-poster-placeholder">📺</div>`
                  }
                </div>
                <div class="upcoming-season-title">${escapeHtml(item.title)}</div>
                <div class="upcoming-season-num">SAISON ${String(season.season_number).padStart(2, "0")}</div>
                <div class="upcoming-season-date">${label}</div>
              </div>`;
            })
            .join("")}
        </div>
      </div>`,
      )
      .join("");
  }
}

function renderUpcomingEmpty(msg) {
  return `
    <div class="upcoming-empty">
      <span class="upcoming-empty-icon">✓</span>
      <p>${escapeHtml(msg)}</p>
    </div>`;
}

function getDiscoverRowsConfig() {
  const today = new Date().toISOString().split("T")[0];
  const in6months = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  return [
    {
      key: "trending-movies",
      title: "Films tendances",
      description: "Les films les plus populaires de la semaine sur TMDB.",
      gridId: "discoverTrendingMoviesGrid",
      url: `${TMDB_BASE_URL}/trending/movie/week?api_key=${TMDB_API_KEY}&language=fr-FR`,
      type: "movie",
      showDate: false,
    },
    {
      key: "trending-series",
      title: "Séries tendances",
      description: "Les séries qui font le plus parler d'elles cette semaine.",
      gridId: "discoverTrendingSeriesGrid",
      url: `${TMDB_BASE_URL}/trending/tv/week?api_key=${TMDB_API_KEY}&language=fr-FR`,
      type: "tv",
      showDate: false,
    },
    {
      key: "anticipated-movies",
      title: "Films les plus attendus",
      description: "Les prochaines sorties cinéma et streaming à surveiller.",
      gridId: "discoverAnticipatedMoviesGrid",
      url: `${TMDB_BASE_URL}/discover/movie?api_key=${TMDB_API_KEY}&language=fr-FR&sort_by=popularity.desc&primary_release_date.gte=${today}&primary_release_date.lte=${in6months}&with_release_type=2|3`,
      type: "movie",
      showDate: true,
    },
    {
      key: "anticipated-series",
      title: "Séries les plus attendues",
      description: "Les nouveautés séries à venir dans les prochains mois.",
      gridId: "discoverAnticipatedSeriesGrid",
      url: `${TMDB_BASE_URL}/discover/tv?api_key=${TMDB_API_KEY}&language=fr-FR&sort_by=popularity.desc&first_air_date.gte=${today}&first_air_date.lte=${in6months}`,
      type: "tv",
      showDate: true,
    },
    {
      key: "now-playing",
      title: "Actuellement au cinéma",
      description: "Les films en salle en ce moment, côté France.",
      gridId: "discoverNowPlayingGrid",
      url: `${TMDB_BASE_URL}/movie/now_playing?api_key=${TMDB_API_KEY}&language=fr-FR&region=FR`,
      type: "movie",
      showDate: false,
    },
  ];
}

function getDiscoverConfigByKey(key) {
  return getDiscoverRowsConfig().find((config) => config.key === key) || null;
}

function buildPagedUrl(url, page) {
  return `${url}${url.includes("?") ? "&" : "?"}page=${page}`;
}

function buildDiscoverRowCardHTML(item, type, showDate = false) {
  const title = item.title || item.name || "";
  const dateRaw = item.release_date || item.first_air_date || "";
  const year = dateRaw.slice(0, 4);
  const dateLabel =
    showDate && dateRaw
      ? new Date(dateRaw).toLocaleDateString("fr-FR", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })
      : null;
  const poster = item.poster_path
    ? `${TMDB_IMAGE_BASE}${item.poster_path}`
    : null;
  const rating = item.vote_average ? (item.vote_average / 2).toFixed(1) : null;
  const inCollection = items.some((i) =>
    isSameTmdbCollectionItem(i, item.id, type),
  );

  return `
    <div class="discover-card" onclick="showTrendingDetail(${item.id}, '${type}')">
      <div class="discover-card-poster">
        ${
          poster
            ? `<img src="${escapeHtml(poster)}" alt="${escapeHtml(title)}" loading="lazy">`
            : `<div class="discover-card-placeholder">${type === "movie" ? "🎬" : "📺"}</div>`
        }
        ${rating ? `<span class="discover-card-rating">★ ${rating}</span>` : ""}
        ${
          inCollection
            ? `<span class="discover-card-owned">✓</span>`
            : `<button class="discover-card-add" onclick="event.stopPropagation(); addFromTrendingById(${item.id}, '${type}'); this.outerHTML='<span class=\\'discover-card-owned\\'>✓</span>';" title="Ajouter">+</button>`
        }
      </div>
      <div class="discover-card-info">
        <div class="discover-card-title">${escapeHtml(title)}</div>
        <div class="discover-card-year">${dateLabel || year || "—"}</div>
      </div>
    </div>`;
}

function buildDiscoverMoreCardHTML(key) {
  return `
    <button class="discover-more-card" onclick="app.openDiscoverCollection('${key}')">
      <span class="discover-more-icon">→</span>
      <span class="discover-more-label">Voir plus</span>
      <span class="discover-more-meta">Afficher la liste complete</span>
    </button>`;
}

function buildDiscoverGridCardHTML(item, type, showDate = false) {
  const title = item.title || item.name;
  const itemType = item._type || type;
  const dateRaw = item.release_date || item.first_air_date || "";
  const year = dateRaw.substring(0, 4);
  const dateLabel =
    showDate && dateRaw
      ? new Date(dateRaw).toLocaleDateString("fr-FR", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })
      : null;
  const posterPath = item.poster_path
    ? `${TMDB_IMAGE_BASE}${item.poster_path}`
    : "";
  const rating = item.vote_average ? (item.vote_average / 2).toFixed(1) : "";
  const stars = rating
    ? buildRatingStarsHTML(rating, {
        includeEmpty: true,
        extraClass: "card-rating-stars-inline",
      })
    : "";

  return `
    <div class="card" onclick="showTrendingDetail(${item.id}, '${itemType}')">
      <div class="card-image">
        ${
          posterPath
            ? `<img src="${posterPath}" alt="${escapeHtml(title)}">`
            : `<div class="card-placeholder">${itemType === "movie" ? "🎬" : "📺"}</div>`
        }
        <div class="card-badge" style="background: rgba(59, 130, 246, 0.95); color: white;">${itemType === "movie" ? "Film" : "Série"}</div>
      </div>
      <div class="card-content">
        <div class="card-title">${escapeHtml(title)}</div>
        <div class="card-meta">
          <span>${dateLabel ? escapeHtml(dateLabel) : escapeHtml(year) || "—"}</span>
        </div>
        ${rating ? `<div class="card-rating">${stars}<span>${rating}/5</span></div>` : ""}
      </div>
    </div>`;
}

async function loadTrending(type, buttonElement) {
  const fallbackKey = type === "tv" ? "trending-series" : "trending-movies";
  openDiscoverCollection(fallbackKey);
}

async function loadDiscover() {
  getDiscoverRowsConfig().forEach((config) => {
    loadDiscoverRow(config);
  });
}

async function loadDiscoverRow({ gridId, url, type, showDate, key }) {
  const container = document.getElementById(gridId);
  if (!container) return;

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error();
    const data = await res.json();
    const results = (data.results || []).slice(0, 11);

    results.forEach((item) => {
      setTrendingCacheItem(item, type);
    });

    if (results.length === 0) {
      container.innerHTML = `<p class="discover-loading">Aucun contenu disponible.</p>`;
      return;
    }

    container.innerHTML = `${results
      .map((item) => buildDiscoverRowCardHTML(item, type, showDate))
      .join("")}${buildDiscoverMoreCardHTML(key)}`;
  } catch {
    container.innerHTML = `<p class="discover-loading">Erreur de chargement.</p>`;
  }
}

function displayDiscoverGrid(results, type, showDate = false) {
  const grid = document.getElementById("discoverGrid");
  grid.innerHTML = results
    .map((item) => buildDiscoverGridCardHTML(item, type, showDate))
    .join("");
}

function closeDiscoverCollection() {
  const rows = document.getElementById("discoverRows");
  const panel = document.getElementById("discoverBrowsePanel");
  if (!rows || !panel) return;

  panel.classList.remove("active");
  rows.style.display = "block";
  discoverBrowseState = {
    key: null,
    page: 0,
    totalPages: 0,
    loading: false,
  };
}

async function openDiscoverCollection(key) {
  const config = getDiscoverConfigByKey(key);
  const rows = document.getElementById("discoverRows");
  const panel = document.getElementById("discoverBrowsePanel");
  const title = document.getElementById("discoverBrowseTitle");
  const description = document.getElementById("discoverBrowseDescription");
  const grid = document.getElementById("discoverBrowseGrid");

  if (!config || !rows || !panel || !title || !description || !grid) return;

  rows.style.display = "none";
  panel.classList.add("active");
  title.textContent = config.title;
  description.textContent = config.description;
  grid.innerHTML = `<p class="discover-loading">Chargement…</p>`;

  discoverBrowseState = {
    key,
    page: 0,
    totalPages: 0,
    loading: false,
  };

  await loadMoreDiscoverCollection();
}

async function loadMoreDiscoverCollection() {
  if (discoverBrowseState.loading || !discoverBrowseState.key) return;

  const config = getDiscoverConfigByKey(discoverBrowseState.key);
  const grid = document.getElementById("discoverBrowseGrid");
  const loadMoreWrap = document.getElementById("discoverBrowseLoadMoreWrap");
  const loadMoreBtn = document.getElementById("discoverBrowseLoadMoreBtn");

  if (!config || !grid || !loadMoreWrap || !loadMoreBtn) return;

  discoverBrowseState.loading = true;
  loadMoreBtn.disabled = true;
  loadMoreBtn.textContent = "Chargement…";

  try {
    const nextPage = discoverBrowseState.page + 1;
    const res = await fetch(buildPagedUrl(config.url, nextPage));
    if (!res.ok) throw new Error("Erreur API");

    const data = await res.json();
    const results = data.results || [];

    results.forEach((item) => {
      setTrendingCacheItem(item, config.type);
    });

    if (nextPage === 1 && results.length === 0) {
      grid.innerHTML = `<div class="empty-state" style="grid-column: 1/-1;"><div class="empty-icon">😕</div><p class="empty-text">Aucun contenu disponible.</p></div>`;
      loadMoreWrap.style.display = "none";
      return;
    }

    if (nextPage === 1) {
      grid.innerHTML = results
        .map((item) =>
          buildDiscoverGridCardHTML(item, config.type, config.showDate),
        )
        .join("");
    } else {
      grid.insertAdjacentHTML(
        "beforeend",
        results
          .map((item) =>
            buildDiscoverGridCardHTML(item, config.type, config.showDate),
          )
          .join(""),
      );
    }

    discoverBrowseState.page = nextPage;
    discoverBrowseState.totalPages = data.total_pages || nextPage;
    loadMoreWrap.style.display =
      discoverBrowseState.page < discoverBrowseState.totalPages
        ? "flex"
        : "none";
  } catch (error) {
    console.error("Erreur chargement decouverte:", error);
    if (discoverBrowseState.page === 0) {
      grid.innerHTML = `<div class="empty-state" style="grid-column: 1/-1;"><div class="empty-icon">😕</div><p class="empty-text">Impossible de charger cette liste.</p></div>`;
    }
    loadMoreWrap.style.display = "none";
  } finally {
    discoverBrowseState.loading = false;
    loadMoreBtn.disabled = false;
    loadMoreBtn.textContent = "Charger plus";
  }
}

function buildTrendingDetailHTML(item, type, tmdb) {
  const title = item.title || item.name;
  const year = (item.release_date || item.first_air_date || "").substring(0, 4);
  const posterPath = item.poster_path
    ? `${TMDB_IMAGE_BASE}${item.poster_path}`
    : "";
  const overview = tmdb?.overview || item.overview || "";
  const tmdbRating = item.vote_average
    ? (item.vote_average / 2).toFixed(1)
    : "";
  const alreadyAdded = items.find((i) =>
    isSameTmdbCollectionItem(i, item.id, type),
  );

  const backdropUrl = tmdb?.backdrop_path
    ? `https://image.tmdb.org/t/p/w1280${tmdb.backdrop_path}`
    : null;

  let extraRows = "";
  if (tmdb) {
    if (type === "movie" && tmdb.runtime) {
      const h = Math.floor(tmdb.runtime / 60);
      const m = tmdb.runtime % 60;
      extraRows += `<div class="detail-row"><div class="detail-label">Durée</div><div class="detail-value">${h}h${m > 0 ? ` ${m}min` : ""}</div></div>`;
    }
    if (type === "tv") {
      if (tmdb.number_of_seasons) {
        extraRows += `<div class="detail-row"><div class="detail-label">Saisons</div><div class="detail-value">${tmdb.number_of_seasons} saison${tmdb.number_of_seasons > 1 ? "s" : ""} · ${tmdb.number_of_episodes || "?"} épisodes</div></div>`;
      }
      const creators = tmdb.created_by
        ?.slice(0, 2)
        .map((c) => escapeHtml(c.name))
        .join(", ");
      if (creators) {
        extraRows += `<div class="detail-row"><div class="detail-label">Créateur</div><div class="detail-value">${creators}</div></div>`;
      }
    }
    if (type === "movie") {
      const director = tmdb.credits?.crew?.find((c) => c.job === "Director");
      if (director) {
        extraRows += `<div class="detail-row"><div class="detail-label">Réalisateur</div><div class="detail-value">${escapeHtml(director.name)}</div></div>`;
      }
    }
    const genres = tmdb.genres
      ?.slice(0, 3)
      .map((g) => escapeHtml(g.name))
      .join(", ");
    if (genres) {
      extraRows += `<div class="detail-row"><div class="detail-label">Genre</div><div class="detail-value">${genres}</div></div>`;
    }
  }

  const heroMeta = [type === "movie" ? "Film" : "Série", year || null]
    .filter(Boolean)
    .join(" · ");
  const heroChips = [];
  if (tmdb?.genres?.length) {
    heroChips.push(...tmdb.genres.slice(0, 2).map((genre) => genre.name));
  }
  const heroActions = [];
  if (getTrailerKey(tmdb)) {
    heroActions.push(
      buildDetailAnchorButton("Bande-annonce", "detailTrailerAnchor", true),
    );
  }
  if (overview) {
    heroActions.push(
      buildDetailAnchorButton("Synopsis", "detailSynopsisAnchor"),
    );
  }
  const castHTML = buildCastHTML(tmdb);
  const discoverProvider =
    getPrimaryWatchProvider(tmdb?.watchProviders, { includedOnly: true }) ||
    (type === "tv" ? getPrimaryStreamingNetworkProvider(tmdb) : null);

  return `
    <div class="detail-stream-shell detail-layout-d detail-layout-d-discover">
      ${buildDetailHeroHTML({
        title,
        kicker: alreadyAdded
          ? "Disponible dans ta collection"
          : "Découverte TMDB",
        meta: heroMeta,
        chips: heroChips,
        backdropUrl,
        posterUrl: posterPath,
        actionHtml: heroActions.join(""),
        score: tmdbRating || null,
        providerLogo: discoverProvider?.providerLogo || null,
        providerName: discoverProvider?.providerName || null,
      })}
      ${buildTrendingQuickBar(item, type, alreadyAdded)}
      <div class="detail-stream-panel">
        <div class="sd-section-title">Informations</div>
        <div class="detail-row"><div class="detail-label">Type</div><div class="detail-value">${type === "movie" ? "Film" : "Série"}</div></div>
        <div class="detail-row"><div class="detail-label">Année</div><div class="detail-value">${escapeHtml(year) || "—"}</div></div>
        ${
          tmdbRating
            ? `<div class="detail-row"><div class="detail-label">Note TMDB</div><div class="detail-value">${buildRatingStarsHTML(tmdbRating, { includeEmpty: true })} <span style="color:var(--text-secondary)">${tmdbRating}/5</span></div></div>`
            : ""
        }
        ${extraRows}
        ${
          type === "tv" && discoverProvider?.providerName
            ? buildDetailInfoRow(
                "Plateforme",
                `<strong>${escapeHtml(getCompactProviderLabel(discoverProvider.providerName))}</strong><span class="detail-availability-note">${tmdb?.watchProviders ? "Inclus en streaming" : "Diffuseur TMDB"}</span>`,
                "detail-row-availability",
              )
            : ""
        }
      </div>
      ${tmdb?.watchProviders ? `<div class="detail-stream-panel">${buildWatchProvidersHTML(tmdb.watchProviders)}</div>` : ""}
      ${overview ? `<div class="detail-stream-panel" id="detailSynopsisAnchor"><div class="sd-section-title">Synopsis</div><div class="detail-synopsis sd-inline-block"><p>${escapeHtml(overview)}</p></div></div>` : ""}
      ${castHTML ? `<div class="detail-stream-panel"><div class="sd-section-title">Casting principal</div>${castHTML}</div>` : ""}
      ${getTrailerKey(tmdb) ? `<div class="detail-stream-panel" id="detailTrailerAnchor"><div class="sd-section-title">Bande-annonce</div>${buildTrailerHTML(getTrailerKey(tmdb))}</div>` : ""}
    </div>`;
}

function scrollDetailTo(targetId) {
  const target = document.getElementById(targetId);
  if (!target) return;

  if (targetId === "sdTabDetails") {
    const detailsTabButton = document.querySelector(
      ".sd-tab[onclick*=\"switchSeriesTab('details'\"]",
    );
    if (detailsTabButton) {
      switchSeriesTab("details", detailsTabButton);
    }
  }

  if (targetId === "sdTabVideos") {
    const videosTabButton = document.querySelector(
      ".sd-tab[onclick*=\"switchSeriesTab('videos'\"]",
    );
    if (videosTabButton) {
      switchSeriesTab("videos", videosTabButton);
    }
  }

  requestAnimationFrame(() => {
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

async function showTrendingDetail(id, mediaType = null) {
  const cached = getTrendingCacheItem(id, mediaType);
  if (!cached) return;
  const { item, type } = cached;

  currentItemId = null;
  const title = item.title || item.name;
  document.getElementById("detailTitle").textContent = title;
  document.getElementById("detailContent").innerHTML = buildTrendingDetailHTML(
    item,
    type,
    null,
  );
  document.getElementById("detailModal").classList.add("active");

  try {
    const endpoint = type === "movie" ? "movie" : "tv";
    const [res, watchProviders] = await Promise.all([
      fetch(
        `${TMDB_BASE_URL}/${endpoint}/${item.id}?api_key=${TMDB_API_KEY}&language=fr-FR&append_to_response=credits,videos`,
      ),
      fetchWatchProviders(endpoint, item.id),
    ]);
    if (res.ok) {
      const tmdb = await res.json();
      tmdb.watchProviders = watchProviders;
      document.getElementById("detailContent").innerHTML =
        buildTrendingDetailHTML(item, type, tmdb);
    }
  } catch (e) {
    console.error("Erreur détail trending:", e);
  }
}

async function fetchTrendingNetworkProvider(tmdbId) {
  if (!hasConfiguredTmdbApiKey() || !tmdbId) return null;
  try {
    const response = await fetch(
      `${TMDB_BASE_URL}/tv/${tmdbId}?api_key=${TMDB_API_KEY}&language=fr-FR`,
    );
    if (!response.ok) return null;
    const tmdb = await response.json();
    return (
      getUserMatchingNetworkProvider(tmdb) ||
      getPrimaryStreamingNetworkProvider(tmdb)
    );
  } catch (error) {
    console.error("Erreur reseau serie:", error);
    return null;
  }
}

function addFromTrendingById(id, type = null) {
  const cached = getTrendingCacheItem(id, type);
  if (!cached) return;
  addFromTrending(cached.item, cached.type);
}

async function addFromTrending(
  item,
  type,
  status = "towatch",
  options = { closeAfter: true },
) {
  const title = item.title || item.name;

  if (
    items.some((existing) => isSameTmdbCollectionItem(existing, item.id, type))
  ) {
    showToast("Déjà dans la collection");
    return null;
  }

  const watchProviders = await fetchWatchProviders(
    type === "movie" ? "movie" : "tv",
    item.id,
  );
  const provider = getPrimaryWatchProvider(watchProviders, {
    includedOnly: true,
  }) || (type === "tv" ? await fetchTrendingNetworkProvider(item.id) : null);
  const newItem = buildCollectionItemFromTrending(item, type, provider, status);

  items.unshift(newItem);
  localStorage.setItem("watchlist", JSON.stringify(items));
  if (options.closeAfter) closeDetailModal();
  showToast(
    status === "watched" ? `${title} ajouté comme vu` : `${title} ajouté ! 🎉`,
  );
  renderItems();
  return newItem;
}

function showTrending() {
  activateTabByName("discover");
  openDiscoverCollection("trending-movies");
}

function openImportExport() {
  document.getElementById("importExportModal").classList.add("active");
}

function closeImportExport() {
  document.getElementById("importExportModal").classList.remove("active");
}

function exportData() {
  const data = {
    version: "2.0",
    exportDate: new Date().toISOString(),
    items: items,
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `cinetracker-${new Date().toISOString().split("T")[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);

  showToast("Sauvegarde téléchargée");
  closeImportExport();
}

function importData() {
  const file = document.getElementById("importFile").files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async function (e) {
    try {
      const fileContent = String(e.target.result || "");
      let importedItems;

      if (/\.json$/i.test(file.name)) {
        const data = JSON.parse(fileContent);
        importedItems = data.items || data;
      } else if (/\.csv$/i.test(file.name)) {
        importedItems = parseLetterboxdCsv(fileContent, file.name);
      } else {
        try {
          const data = JSON.parse(fileContent);
          importedItems = data.items || data;
        } catch (_) {
          importedItems = parseLetterboxdCsv(fileContent, file.name);
        }
      }

      if (!Array.isArray(importedItems)) {
        throw new Error("Format invalide");
      }

      importedItems = importedItems
        .map((item, index) => normalizeCollectionItem(item, index))
        .filter(Boolean);

      if (importedItems.length === 0) {
        throw new Error("Aucun élément valide dans le fichier");
      }

      const isLetterboxdCsv = /\.csv$/i.test(file.name);
      let matchedCount = 0;

      if (isLetterboxdCsv) {
        showToast("Association des films Letterboxd avec TMDB...");
        const enriched = await enrichImportedItems(importedItems);
        importedItems = enriched.items;
        matchedCount = enriched.matchedCount;
      }

      const merge = confirm(
        `${importedItems.length} éléments trouvés\n\n` +
          `${isLetterboxdCsv ? `${matchedCount} fiches TMDB associées\n\n` : ""}` +
          `OK = Fusionner avec vos données (${items.length})\n` +
          `Annuler = Remplacer toutes vos données`,
      );

      if (merge) {
        const existingByKey = new Map();
        items.forEach((item, index) => {
          existingByKey.set(getImportComparisonKey(item), index);
          existingByKey.set(getImportTitleYearKey(item), index);
        });
        let addedCount = 0;
        let mergedCount = 0;

        importedItems.forEach((item) => {
          const key = getImportComparisonKey(item);
          const fallbackKey = getImportTitleYearKey(item);
          const existingIndex =
            existingByKey.get(key) ??
            existingByKey.get(fallbackKey) ??
            findExistingMovieMergeCandidateIndex(items, item);

          if (existingIndex === undefined) {
            existingByKey.set(key, items.length);
            existingByKey.set(fallbackKey, items.length);
            items.push(item);
            addedCount++;
            return;
          }

          items[existingIndex] = mergeImportedIntoExistingItem(
            items[existingIndex],
            item,
          );
          existingByKey.set(
            getImportComparisonKey(items[existingIndex]),
            existingIndex,
          );
          existingByKey.set(
            getImportTitleYearKey(items[existingIndex]),
            existingIndex,
          );
          mergedCount++;
        });

        showToast(
          mergedCount > 0
            ? `${addedCount} ajoutés · ${mergedCount} fiches fusionnées`
            : `${addedCount} nouveaux éléments`,
        );
      } else {
        items = importedItems;
        showToast(`${items.length} éléments restaurés`);
      }

      localStorage.setItem("watchlist", JSON.stringify(items));
      letterboxdRepairAttempted = false;
      await repairExistingLetterboxdImports();
      renderItems();
      closeImportExport();
    } catch (error) {
      showToast(
        "Import impossible: JSON CinéTracker ou CSV Letterboxd attendu",
      );
      console.error(error);
    } finally {
      document.getElementById("importFile").value = "";
    }
  };
  reader.readAsText(file);
}

let toastHideTimer = null;

function showToast(message) {
  const toast = document.getElementById("toast");
  const normalizedMessage = String(message || "").toLowerCase();

  let tone = "info";
  if (
    /ajout|mis a jour|mis à jour|restaur|installe|installé|mises à jour|repare|répar|terminee|terminée|marqué vu|✓/.test(
      normalizedMessage,
    )
  ) {
    tone = "success";
  } else if (
    /impossible|non disponible|pas encore|d'abord|ajoutez|selectionne|sélectionne/.test(
      normalizedMessage,
    )
  ) {
    tone = "warning";
  }

  toast.textContent = message;
  toast.classList.remove("toast-info", "toast-success", "toast-warning");
  toast.classList.add(`toast-${tone}`);

  // Rejoue l'animation correctement si plusieurs toasts arrivent vite.
  toast.classList.remove("show");
  void toast.offsetWidth;
  toast.classList.add("show");

  if (toastHideTimer) {
    clearTimeout(toastHideTimer);
  }

  toastHideTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, 3200);
}

document.getElementById("addForm").addEventListener("submit", function (e) {
  e.preventDefault();

  const titleInput = document.getElementById("titleInput");
  const posterUrl = titleInput.dataset.poster || null;
  const tmdbId = titleInput.dataset.tmdbId || null;
  const releaseDate = titleInput.dataset.releaseDate || null;
  const providerLogo = titleInput.dataset.providerLogo || null;
  const providerName = titleInput.dataset.providerName || null;
  const providerAccessType = titleInput.dataset.providerAccessType || null;

  if (!tmdbId) {
    showToast("Sélectionne d'abord un résultat TMDB");
    return;
  }

  const isSeries = document.getElementById("typeInput").value === "series";
  const selectedStatus = document.getElementById("statusInput").value;
  const isWatchedStatus = selectedStatus === "watched";
  if (isWatchedStatus) {
    const watchedWithInput = document.getElementById("watchedWithInput");
    if (watchedWithInput?.value.trim()) {
      addWatchedWithName(watchedWithInput.value);
      watchedWithInput.value = "";
    }
  }
  const existingItem = currentItemId
    ? items.find((i) => i.id === currentItemId)
    : null;

  // Récupérer seasonData depuis le dataset ou conserver l'existant
  let seasonData = existingItem?.seasonData || null;
  if (titleInput.dataset.seasonData) {
    try {
      seasonData = JSON.parse(titleInput.dataset.seasonData);
    } catch (e) {}
  }

  const formData = {
    id: currentItemId || Date.now().toString(),
    title: titleInput.value,
    type: document.getElementById("typeInput").value,
    year: document.getElementById("yearInput").value,
    releaseDate: releaseDate || existingItem?.releaseDate || null,
    status: selectedStatus,
    rating: isWatchedStatus
      ? parseFloat(document.getElementById("ratingInput").value) || null
      : null,
    genre: document.getElementById("genreInput").value,
    notes: isWatchedStatus ? document.getElementById("notesInput").value : "",
    watchedDate: isWatchedStatus
      ? document.getElementById("watchedDateInput")?.value || null
      : null,
    watchedWith: isWatchedStatus
      ? formatWatchedWithInput(currentWatchedWith) || null
      : null,
    posterUrl: posterUrl,
    tmdbId: tmdbId,
    providerLogo: providerLogo,
    providerName: providerName,
    providerAccessType: providerAccessType,
    providerPriorityVersion: WATCH_PROVIDER_PRIORITY_VERSION,
    tags: isWatchedStatus ? currentTags : [],
    currentSeason: isSeries ? currentSeason : null,
    currentEpisode: isSeries ? currentEpisode : null,
    seasonData: isSeries ? seasonData : null,
    totalEpisodes: isSeries
      ? parseInt(titleInput.dataset.totalEpisodes) ||
        existingItem?.totalEpisodes ||
        null
      : null,
    dateAdded: existingItem?.dateAdded || new Date().toISOString(),
    watchedAt: (() => {
      if (selectedStatus === "watched") {
        // Conserver la date existante si déjà "watched", sinon mettre maintenant
        if (existingItem?.status === "watched" && existingItem?.watchedAt) {
          return existingItem.watchedAt;
        }
        return new Date().toISOString();
      }
      return null;
    })(),
    tmdbRating: existingItem?.tmdbRating || null,
  };

  if (currentItemId) {
    const index = items.findIndex((i) => i.id === currentItemId);
    items[index] = formData;
    showToast("Contenu mis à jour");
  } else {
    items.unshift(formData);
    showToast("Contenu ajouté");
  }

  localStorage.setItem("watchlist", JSON.stringify(items));
  closeAddModal();
  renderItems();

  delete titleInput.dataset.poster;
  delete titleInput.dataset.tmdbId;
  delete titleInput.dataset.providerLogo;
  delete titleInput.dataset.providerName;
  delete titleInput.dataset.providerAccessType;
  delete titleInput.dataset.releaseDate;
  updateSelectedTMDBUI(null);
});

// ── SEARCH OVERLAY ──────────────────────────────────────────────────────────

let searchOverlayTimeout = null;
let searchSectionTimeout = null;

function openSearch() {
  const overlay = document.getElementById("searchOverlay");
  overlay.classList.add("active");
  const input = document.getElementById("searchInput");
  input.value = "";
  document.getElementById("overlaySearchResults").innerHTML =
    `<p class="search-overlay-hint">Tapez un titre de film ou de série…</p>`;
  requestAnimationFrame(() => input.focus());
}

function closeSearch() {
  document.getElementById("searchOverlay").classList.remove("active");
  document.getElementById("searchInput").value = "";
  clearTimeout(searchOverlayTimeout);
}

function focusSearchSection() {
  const input = document.getElementById("sectionSearchInput");
  const results = document.getElementById("sectionSearchResults");
  const hint = document.getElementById("sectionSearchHint");
  const clear = document.getElementById("sectionSearchClear");
  if (!input || !results) return;

  if (!input.value.trim()) {
    results.innerHTML = "";
    if (hint) hint.style.display = "";
    if (clear) clear.style.display = "none";
  }

  requestAnimationFrame(() => input.focus());
}

async function runSectionSearch(query) {
  const container = document.getElementById("sectionSearchResults");
  const hint = document.getElementById("sectionSearchHint");
  const clear = document.getElementById("sectionSearchClear");
  if (!container) return;

  if (clear) clear.style.display = query?.trim() ? "" : "none";

  if (!query || query.length < 2) {
    container.innerHTML = "";
    if (hint) hint.style.display = "";
    return;
  }

  if (hint) hint.style.display = "none";
  container.innerHTML = `<p class="search-overlay-hint">Recherche en cours…</p>`;

  try {
    const [movieRes, tvRes] = await Promise.all([
      fetch(
        `${TMDB_BASE_URL}/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&language=fr-FR`,
      ),
      fetch(
        `${TMDB_BASE_URL}/search/tv?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&language=fr-FR`,
      ),
    ]);
    const [movies, tv] = await Promise.all([movieRes.json(), tvRes.json()]);

    const results = [
      ...movies.results.slice(0, 6).map((m) => ({ ...m, media_type: "movie" })),
      ...(tv.results || [])
        .slice(0, 6)
        .map((t) => ({ ...t, media_type: "tv" })),
    ]
      .sort((a, b) => (b.popularity || 0) - (a.popularity || 0))
      .slice(0, 10);

    if (results.length === 0) {
      container.innerHTML = `<p class="search-overlay-hint">Aucun résultat pour « ${escapeHtml(query)} »</p>`;
      return;
    }

    container.innerHTML = results
      .map((r) => {
        const title = r.title || r.name || "";
        const year = (r.release_date || r.first_air_date || "").slice(0, 4);
        const poster = r.poster_path
          ? `${TMDB_IMAGE_BASE}${r.poster_path}`
          : null;
        const typeLabel = r.media_type === "movie" ? "Film" : "Série";
        const typeIcon = r.media_type === "movie" ? "🎬" : "📺";
        const rating = r.vote_average ? r.vote_average.toFixed(1) : null;
        const inCollection = items.some((i) =>
          isSameTmdbCollectionItem(i, r.id, r.media_type),
        );

        setTrendingCacheItem(r, r.media_type);

        return `
        <div class="search-overlay-item">
          <div class="search-overlay-poster" onclick="showTrendingDetail(${r.id}, '${r.media_type}')" style="cursor:pointer;">
            ${
              poster
                ? `<img src="${escapeHtml(poster)}" alt="${escapeHtml(title)}">`
                : `<div class="search-overlay-poster-ph">${typeIcon}</div>`
            }
          </div>
          <div class="search-overlay-info" onclick="showTrendingDetail(${r.id}, '${r.media_type}')" style="cursor:pointer;">
            <div class="search-overlay-title">${escapeHtml(title)}</div>
            <div class="search-overlay-meta">
              <span>${typeLabel}</span>
              ${year ? `<span>${year}</span>` : ""}
              ${rating ? `<span>⭐ ${rating}</span>` : ""}
            </div>
          </div>
          <div class="search-overlay-actions">
            ${
              inCollection
                ? `<span class="search-overlay-owned">✓ Collection</span>`
                : `<button class="search-overlay-add" onclick="addFromTrendingById(${r.id}, '${r.media_type}'); this.textContent='✓'; this.disabled=true;" title="Ajouter à la collection">+ Ajouter</button>`
            }
          </div>
        </div>`;
      })
      .join("");
  } catch {
    container.innerHTML = `<p class="search-overlay-hint">Erreur lors de la recherche.</p>`;
  }
}

async function runOverlaySearch(query) {
  const container = document.getElementById("overlaySearchResults");
  if (!query || query.length < 2) {
    container.innerHTML = `<p class="search-overlay-hint">Tapez un titre de film ou de série…</p>`;
    return;
  }

  container.innerHTML = `<p class="search-overlay-hint">Recherche en cours…</p>`;

  try {
    const [movieRes, tvRes] = await Promise.all([
      fetch(
        `${TMDB_BASE_URL}/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&language=fr-FR`,
      ),
      fetch(
        `${TMDB_BASE_URL}/search/tv?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&language=fr-FR`,
      ),
    ]);
    const [movies, tv] = await Promise.all([movieRes.json(), tvRes.json()]);

    const results = [
      ...movies.results.slice(0, 6).map((m) => ({ ...m, media_type: "movie" })),
      ...(tv.results || [])
        .slice(0, 6)
        .map((t) => ({ ...t, media_type: "tv" })),
    ]
      .sort((a, b) => (b.popularity || 0) - (a.popularity || 0))
      .slice(0, 10);

    if (results.length === 0) {
      container.innerHTML = `<p class="search-overlay-hint">Aucun résultat pour « ${escapeHtml(query)} »</p>`;
      return;
    }

    container.innerHTML = results
      .map((r) => {
        const title = r.title || r.name || "";
        const year = (r.release_date || r.first_air_date || "").slice(0, 4);
        const poster = r.poster_path
          ? `${TMDB_IMAGE_BASE}${r.poster_path}`
          : null;
        const typeLabel = r.media_type === "movie" ? "Film" : "Série";
        const typeIcon = r.media_type === "movie" ? "🎬" : "📺";
        const rating = r.vote_average ? r.vote_average.toFixed(1) : null;
        const inCollection = items.some((i) =>
          isSameTmdbCollectionItem(i, r.id, r.media_type),
        );

        setTrendingCacheItem(r, r.media_type);

        return `
        <div class="search-overlay-item">
          <div class="search-overlay-poster" onclick="closeSearch(); showTrendingDetail(${r.id}, '${r.media_type}')" style="cursor:pointer;">
            ${
              poster
                ? `<img src="${escapeHtml(poster)}" alt="${escapeHtml(title)}">`
                : `<div class="search-overlay-poster-ph">${typeIcon}</div>`
            }
          </div>
          <div class="search-overlay-info" onclick="closeSearch(); showTrendingDetail(${r.id}, '${r.media_type}')" style="cursor:pointer;">
            <div class="search-overlay-title">${escapeHtml(title)}</div>
            <div class="search-overlay-meta">
              <span>${typeLabel}</span>
              ${year ? `<span>${year}</span>` : ""}
              ${rating ? `<span>⭐ ${rating}</span>` : ""}
            </div>
          </div>
          <div class="search-overlay-actions">
            ${
              inCollection
                ? `<span class="search-overlay-owned">✓ Collection</span>`
                : `<button class="search-overlay-add" onclick="addFromTrendingById(${r.id}, '${r.media_type}'); this.textContent='✓'; this.disabled=true;" title="Ajouter à la collection">+ Ajouter</button>`
            }
          </div>
        </div>`;
      })
      .join("");
  } catch {
    container.innerHTML = `<p class="search-overlay-hint">Erreur lors de la recherche.</p>`;
  }
}

document.getElementById("searchInput").addEventListener("input", function () {
  clearTimeout(searchOverlayTimeout);
  searchOverlayTimeout = setTimeout(() => runOverlaySearch(this.value), 350);
});

document
  .getElementById("sectionSearchInput")
  ?.addEventListener("input", function () {
    clearTimeout(searchSectionTimeout);
    searchSectionTimeout = setTimeout(() => runSectionSearch(this.value), 350);
  });

document.getElementById("sectionSearchClear")?.addEventListener("click", () => {
  const input = document.getElementById("sectionSearchInput");
  if (input) {
    input.value = "";
    input.focus();
  }
  runSectionSearch("");
});

document
  .getElementById("searchOverlay")
  .addEventListener("click", function (e) {
    if (e.target === this) closeSearch();
  });

document.addEventListener("keydown", function (e) {
  if (
    e.key === "Escape" &&
    document.getElementById("searchOverlay").classList.contains("active")
  ) {
    closeSearch();
  }
});

document.getElementById("sortSelect").addEventListener("change", function () {
  currentSort = this.value;
  renderItems();
});

document.querySelectorAll("[data-filter]").forEach((btn) => {
  btn.addEventListener("click", function () {
    document
      .querySelectorAll("[data-filter]")
      .forEach((b) => b.classList.remove("active"));
    this.classList.add("active");
    currentFilter = this.dataset.filter;
    renderItems();
  });
});

function updateCollectionControls() {
  const isGrouped = currentFilter === "movie" || currentFilter === "series";
  document.getElementById("viewGrid").parentElement.style.display = isGrouped
    ? "none"
    : "";
  document.getElementById("sortSelect").style.display = isGrouped ? "none" : "";
}

currentStatus = null;

window.addEventListener("click", function (e) {
  if (e.target.classList.contains("modal")) {
    e.target.classList.remove("active");
  }
});

updateInstallButtonVisibility();
registerServiceWorker();
window.addEventListener("hashchange", applyLaunchActionFromHash);

// Expose public actions for inline handlers used in index.html
window.app = {
  installPWA,
  switchTab,
  toggleMobileActionsMenu,
  closeMobileActionsMenu,
  changeEpisode,
  resetEpisode,
  quickNextEpisode,
  quickNextEpisodeInDetail,
  markEpisodeSeen,
  toggleEpisodeSeen,
  unmarkEpisodeSeen,
  toggleSeasonEpisodes,
  jumpToSeason,
  markSeasonDone,
  unmarkSeasonDone,
  addQuickTag,
  selectAddStatus,
  removeTag,
  openAddModal,
  closeAddModal,
  openDetail,
  closeDetailModal,
  editItem,
  deleteItem,
  randomSuggestion,
  closeSuggestion,
  openProviderSettings,
  closeProviderSettings,
  toggleUserProvider,
  setSuggestionFilter,
  toggleSuggestionFilters,
  toggleActiveGroupProfile,
  addGroupProfile,
  toggleGroupProfileProvider,
  toggleGroupProfileGenre,
  openDesignMockups,
  closeDesignMockups,
  loadUpcoming,
  loadTrending,
  loadDiscover,
  openDiscoverCollection,
  openCollectionBrowse,
  closeCollectionBrowse,
  closeDiscoverCollection,
  loadMoreDiscoverCollection,
  showTrending,
  showTrendingDetail,
  addFromTrending,
  addFromTrendingById,
  loadTrailer,
  openImportExport,
  closeImportExport,
  exportData,
  importData,
  toggleDarkMode,
  setViewMode,
  loadSimilars,
  openSearch,
  closeSearch,
  scrollDetailTo,
  openWatchedFlowForCurrentItem,
  openWatchedFlowFromTrendingById,
};

sanitizeImportedSystemTags();
renderItems();
applyLaunchActionFromHash();
repairExistingLetterboxdImports();
window.addEventListener("load", () => {
  setTimeout(() => {
    letterboxdRepairAttempted = false;
    repairExistingLetterboxdImports();
  }, 1200);
});
