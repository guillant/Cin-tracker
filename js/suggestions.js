/**
 * « Que regarder ? » suggestions: filters, solo/group modes, scoring,
 * TMDB discovery candidates and the suggestion modal.
 * Reads app.js state and helpers (items, provider and group profile
 * helpers, openDetail...) at call time only, so it must load before app.js.
 */

const SUGGESTION_RECENT_HISTORY_LIMIT = 8;
const SUGGESTION_PROVIDER_CACHE_VERSION = 3;

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

function loadRecentSuggestionHistory() {
  const stored = readStoredJson(STORAGE_KEYS.suggestionHistory, []);
  return Array.isArray(stored)
    ? stored.filter(Boolean).slice(0, SUGGESTION_RECENT_HISTORY_LIMIT)
    : [];
}

function rememberSuggestion(item) {
  if (!item?.id) return;
  recentSuggestionHistory = [
    item.id,
    ...recentSuggestionHistory.filter((id) => id !== item.id),
  ].slice(0, SUGGESTION_RECENT_HISTORY_LIMIT);
  writeStoredJson(STORAGE_KEYS.suggestionHistory, recentSuggestionHistory);
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
      url: buildTmdbUrl("trending/movie/week"),
    });
  }
  if (suggestionFilters.type === "all" || suggestionFilters.type === "series") {
    endpoints.push({
      mediaType: "tv",
      url: buildTmdbUrl("trending/tv/week"),
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

  const providerDiscoverParams = {
    watch_region: TMDB_WATCH_REGION,
    with_watch_providers: providerTmdbIds.join("|"),
    with_watch_monetization_types: "flatrate|free|ads",
    sort_by: "popularity.desc",
  };
  const selectedProviderLabel = getUserProviderLabelList().join(" ou ");
  const endpoints = [];
  if (suggestionFilters.type === "all" || suggestionFilters.type === "movie") {
    endpoints.push({
      mediaType: "movie",
      url: buildTmdbUrl("discover/movie", providerDiscoverParams),
    });
  }
  if (suggestionFilters.type === "all" || suggestionFilters.type === "series") {
    endpoints.push({
      mediaType: "tv",
      url: buildTmdbUrl("discover/tv", providerDiscoverParams),
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
          buildTmdbUrl(`tv/${item.tmdbId}`),
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

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    suggestionFilters,
    loadRecentSuggestionHistory,
    rememberSuggestion,
    getEstimatedWatchMinutes,
    matchesSuggestionTimeFilter,
    formatWatchMinutes,
    getItemMood,
    matchesSuggestionFilters,
  };
}
