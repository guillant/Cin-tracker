/**
 * Collection data model and import helpers (statuses, normalization,
 * Letterboxd CSV parsing, title matching, merge rules).
 * Pure functions: no DOM, no network, no global app state, so they can be
 * unit-tested in Node (see test/collection.test.js).
 */

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

  // Imported JSON may carry ratings as strings ("4"); the UI calls toFixed().
  const ratingNumber = Number(item.rating);
  const rating =
    item.rating != null && item.rating !== "" && Number.isFinite(ratingNumber) && ratingNumber > 0
      ? Math.min(5, ratingNumber)
      : null;

  const normalized = {
    ...item,
    id: String(item.id || `item-${Date.now()}-${index}`),
    title: String(item.title || "")
      .trim()
      .slice(0, 300),
    type: item.type === "series" ? "series" : "movie",
    status: normalizeStatusValue(item.status),
    rating,
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

    // Same title years apart is a remake (Dune 1984 / 2021), never a duplicate.
    // 1-2 years of drift is tolerated: Letterboxd and TMDB may disagree on the
    // festival vs release year.
    const targetYear = Number.parseInt(String(targetItem.year || ""), 10);
    const candidateYear = Number.parseInt(String(candidate.year || ""), 10);
    if (
      Number.isFinite(targetYear) &&
      Number.isFinite(candidateYear) &&
      Math.abs(targetYear - candidateYear) > 2
    ) {
      return;
    }

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

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    STATUS_LABELS,
    DEFAULT_ITEM_STATUS,
    normalizeStatusValue,
    getStatusLabel,
    normalizeCollectionItem,
    FORCED_TMDB_MOVIE_MATCHES,
    parseItemDate,
    slugifyImportPart,
    getImportTitleYearKey,
    getImportComparisonKey,
    normalizeCsvHeader,
    parseCsvText,
    getCsvValue,
    parseImportDateToIso,
    parseLetterboxdRating,
    getLetterboxdFileInfo,
    parseLetterboxdCsv,
    normalizeTitleForMatch,
    getMovieTitleSearchVariants,
    getMovieTitleMatchScore,
    getMovieYearMatchScore,
    getForcedTmdbMovieMatch,
    shouldForceMovieTmdbOverride,
    findExistingMovieMergeCandidateIndex,
    isLikelyLetterboxdImportedMovie,
    shouldAttemptMovieAutoRepair,
    scoreMovieMatch,
    shouldPreferImportedMovieMetadata,
    mergeImportedIntoExistingItem,
  };
}
