/**
 * Assistant cinéma: remote AI backend (/api/assistant) with a local
 * fallback that answers from the collection and TMDB discovery.
 * Reads app.js state (items, escapeHtml, showToast...) at call time only,
 * so it must load after storage.js/tmdb.js and before app.js.
 */

const AI_ASSISTANT_API_URL = (() => {
  const configuredUrl = String(CONFIG.AI_ASSISTANT_API_URL || "/api/assistant").trim();
  if (
    typeof window === "undefined" ||
    /^https?:\/\//i.test(configuredUrl) ||
    !configuredUrl.startsWith("/")
  ) {
    return configuredUrl;
  }

  const hasExplicitDevPort = Boolean(window.location.port);
  const isBackendOrigin = window.location.port === "4173";
  if (isBackendOrigin) {
    return configuredUrl;
  }

  if (!hasExplicitDevPort) {
    return configuredUrl;
  }

  // Live Server runs on another port and does not proxy /api by default.
  return `${window.location.protocol}//${window.location.hostname}:4173${configuredUrl}`;
})();
const AI_ASSISTANT_NEEDS_ABSOLUTE_URL =
  typeof window !== "undefined" &&
  /^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname) &&
  !window.location.port &&
  AI_ASSISTANT_API_URL.startsWith("/");
const AI_ASSISTANT_REMOTE_ENABLED = CONFIG.AI_ASSISTANT_REMOTE_ENABLED !== false;
const AI_ASSISTANT_PERSIST_HISTORY = CONFIG.AI_ASSISTANT_PERSIST_HISTORY === true;
const AI_ASSISTANT_REMOTE_HISTORY_LIMIT = Math.max(
  2,
  Math.min(10, Number(CONFIG.AI_ASSISTANT_REMOTE_HISTORY_LIMIT) || 6),
);
const AI_ASSISTANT_REMOTE_COLLECTION_MAX_CHARS = Math.max(
  1200,
  Math.min(12000, Number(CONFIG.AI_ASSISTANT_REMOTE_COLLECTION_MAX_CHARS) || 3200),
);
const AI_ASSISTANT_TIMEOUT_MS = Math.max(
  3000,
  Math.min(300000, Number(CONFIG.AI_ASSISTANT_TIMEOUT_MS) || 15000),
);
// Reported by /api/assistant/status: the client must outwait the server,
// otherwise slow local models (Ollama) are aborted before they answer.
let assistantServerTimeoutMs = 0;

function getAssistantRequestTimeoutMs() {
  return Math.max(AI_ASSISTANT_TIMEOUT_MS, assistantServerTimeoutMs + 3000);
}

const AI_ASSISTANT_MAX_HISTORY = 12;

let assistantMessages = loadAssistantHistory();
let assistantRequestPending = false;
let assistantConfigTipShown = false;

function loadAssistantHistory() {
  if (!AI_ASSISTANT_PERSIST_HISTORY) {
    removeStoredValue(STORAGE_KEYS.assistantHistory);
    return [];
  }
  try {
    const stored = readStoredJson(STORAGE_KEYS.assistantHistory, []);
    if (!Array.isArray(stored)) return [];
    return stored
      .filter(
        (entry) =>
          entry &&
          (entry.role === "user" || entry.role === "assistant") &&
          typeof entry.content === "string" &&
          entry.content.trim(),
      )
      .slice(-AI_ASSISTANT_MAX_HISTORY * 2)
      .map((entry) => ({
        role: entry.role,
        content: String(entry.content).trim().slice(0, 4000),
        source:
          entry.source === "remote" || entry.source === "local"
            ? entry.source
            : undefined,
        recommendations: normalizeAssistantRecommendations(entry.recommendations),
      }));
  } catch {
    return [];
  }
}

function normalizeAssistantRecommendations(recommendations) {
  if (!recommendations || typeof recommendations !== "object") return null;
  const rawItems = Array.isArray(recommendations.items)
    ? recommendations.items
    : [];
  const items = rawItems
    .map((item, index) => ({
      rank: String(item?.rank || index + 1).slice(0, 3),
      title: String(item?.title || "").trim().slice(0, 120),
      meta: String(item?.meta || "").trim().slice(0, 120),
      reason: String(item?.reason || "").trim().slice(0, 220),
    }))
    .filter((item) => item.title);
  if (!items.length) return null;

  return {
    eyebrow: String(recommendations.eyebrow || "Suggestion").trim().slice(0, 80),
    context: String(recommendations.context || "").trim().slice(0, 120),
    chips: (Array.isArray(recommendations.chips) ? recommendations.chips : [])
      .map((chip) => String(chip || "").trim().slice(0, 40))
      .filter(Boolean)
      .slice(0, 4),
    items: items.slice(0, 4),
    note: String(recommendations.note || "").trim().slice(0, 220),
  };
}

function hasAssistantRemoteConsent() {
  return readStoredString(STORAGE_KEYS.assistantConsent) === "true";
}

function setAssistantRemoteConsent(enabled) {
  writeStoredString(STORAGE_KEYS.assistantConsent, Boolean(enabled));
}

async function refreshAssistantModeStatus() {
  const status = document.getElementById("assistantModeStatus");
  if (!status) return;
  if (!AI_ASSISTANT_REMOTE_ENABLED || !hasAssistantRemoteConsent()) {
    status.textContent = !AI_ASSISTANT_REMOTE_ENABLED
      ? "Mode local · IA distante désactivée"
      : "Mode local · autorisation IA non cochée";
    status.className = "assistant-mode-status local";
    return;
  }

  if (AI_ASSISTANT_NEEDS_ABSOLUTE_URL) {
    status.textContent =
      "Mode local · app mobile: configure CONFIG.AI_ASSISTANT_API_URL en HTTPS";
    status.className = "assistant-mode-status local";
    return;
  }

  status.textContent = "Connexion au modèle…";
  status.className = "assistant-mode-status";
  try {
    const statusUrl = new URL(AI_ASSISTANT_API_URL, window.location.href);
    statusUrl.pathname = statusUrl.pathname.replace(/\/assistant\/?$/, "/assistant/status");
    const response = await fetch(statusUrl, { cache: "no-store" });
    const data = response.ok ? await response.json() : null;
    const serverTimeoutMs = Number(data?.requestTimeoutMs);
    assistantServerTimeoutMs =
      Number.isFinite(serverTimeoutMs) && serverTimeoutMs > 0
        ? Math.min(120000, serverTimeoutMs)
        : 0;
    status.textContent = data?.configured
      ? `${data.provider || "IA"} active · ${data.model || "modèle configuré"}${data.catalogConfigured ? " · découverte TMDB" : " · TMDB serveur manquant"}`
      : "Mode local · backend IA lancé sans configuration (utilise npm start + .env)";
    status.className = `assistant-mode-status ${data?.configured ? "remote" : "local"}`;
  } catch {
    status.textContent = "Mode local · backend IA inaccessible";
    status.className = "assistant-mode-status local";
  }
}

function persistAssistantHistory() {
  if (!AI_ASSISTANT_PERSIST_HISTORY) return;
  writeStoredJson(
    STORAGE_KEYS.assistantHistory,
    assistantMessages.slice(-AI_ASSISTANT_MAX_HISTORY * 2),
  );
}

function ensureAssistantWelcomeMessage() {
  if (assistantMessages.length > 0) return;
  assistantMessages.push({
    role: "assistant",
    source: "local",
    content:
      "Salut ! Parlons cinéma et séries. Je peux analyser ta collection, chercher de nouvelles découvertes et affiner mes idées selon ton humeur, ton temps ou tes goûts.",
  });
  persistAssistantHistory();
}

function formatAssistantItem(item) {
  if (!item) return "";
  const typeLabel = item.type === "series" ? "Serie" : "Film";
  const statusLabel = getStatusLabel(item.status);
  const yearPart = item.year ? `, ${item.year}` : "";
  const genrePart = item.genre ? `, ${item.genre.split(",")[0].trim()}` : "";
  const providerPart = item.providerName ? `, ${item.providerName}` : "";
  return `${item.title} (${typeLabel}, ${statusLabel}${yearPart}${genrePart}${providerPart})`;
}

function getAssistantCollectionSnapshot() {
  const watched = items.filter((item) => item.status === "watched").length;
  const watching = items.filter((item) => item.status === "watching").length;
  const towatch = items.filter((item) => item.status === "towatch").length;
  const movies = items.filter((item) => item.type === "movie").length;
  const series = items.filter((item) => item.type === "series").length;

  const topGenres = Object.entries(
    items.reduce((acc, item) => {
      String(item.genre || "")
        .split(",")
        .map((genre) => genre.trim())
        .filter(Boolean)
        .forEach((genre) => {
          acc[genre] = (acc[genre] || 0) + 1;
        });
      return acc;
    }, {}),
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([genre, count]) => `${genre} (${count})`)
    .join(", ");

  const quickCandidates = items
    .filter((item) => item.status === "towatch" || item.status === "watching")
    .sort((a, b) => Number(b.rating || 0) - Number(a.rating || 0))
    .slice(0, 5)
    .map((item) => `- ${formatAssistantItem(item)}`)
    .join("\n");
  const watchedTitles = items
    .filter((item) => item.status === "watched")
    .slice(-20)
    .map((item) => item.title)
    .join(", ");
  const ratedTitles = items
    .filter((item) => Number(item.rating) > 0)
    .sort((a, b) => Number(b.rating) - Number(a.rating))
    .slice(0, 12)
    .map((item) => `${item.title} (${item.rating}/5)`)
    .join(", ");

  return [
    `Collection: ${items.length} titres (${movies} films, ${series} series).`,
    `Statuts: ${watched} vus, ${watching} en cours, ${towatch} a voir.`,
    `Genres frequents: ${topGenres || "aucun"}.`,
    `Titres deja vus: ${watchedTitles || "aucun"}.`,
    `Titres notes: ${ratedTitles || "aucun"}.`,
    "Candidats rapides:",
    quickCandidates || "- Aucun candidat disponible.",
  ].join("\n");
}

function getAssistantRemoteCollectionSnapshot(maxChars = AI_ASSISTANT_REMOTE_COLLECTION_MAX_CHARS) {
  return getAssistantCollectionSnapshot().slice(0, Math.max(400, Number(maxChars) || 0));
}

function shouldSendFullCollectionSnapshot(prompt) {
  const text = String(prompt || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  const fullContextHints = [
    "ma collection",
    "mes films",
    "mes series",
    "deja vu",
    "deja vus",
    "favori",
    "mieux notes",
    "stat",
    "bilan",
    "resume",
    "prior",
    "plan",
    "que regarder",
    "trouve",
    "cherche",
    "decouvre",
    "recommande",
    "suggest",
    "film",
    "serie",
  ];
  return fullContextHints.some((hint) => text.includes(hint));
}

function getAssistantRemoteCollectionContext(prompt, maxChars) {
  if (shouldSendFullCollectionSnapshot(prompt)) {
    return getAssistantRemoteCollectionSnapshot(maxChars);
  }

  const watched = items.filter((item) => item.status === "watched").length;
  const watching = items.filter((item) => item.status === "watching").length;
  const towatch = items.filter((item) => item.status === "towatch").length;
  return `Collection: ${items.length} titres. Statuts: ${watched} vus, ${watching} en cours, ${towatch} a voir.`;
}

function getAssistantRemoteCollectionItems(limit = 160) {
  return items
    .slice()
    .sort((left, right) => {
      const leftScore =
        (left.status === "watched" ? 4 : left.status === "towatch" ? 3 : 1) +
        Number(left.rating || 0);
      const rightScore =
        (right.status === "watched" ? 4 : right.status === "towatch" ? 3 : 1) +
        Number(right.rating || 0);
      return rightScore - leftScore;
    })
    .slice(0, Math.max(20, Math.min(400, Number(limit) || 0)))
    .map((item) => ({
      title: String(item.title || "").slice(0, 120),
      type: item.type === "series" ? "series" : "movie",
      status: String(item.status || "towatch"),
      genre: String(item.genre || "").slice(0, 120),
      platform: String(item.providerName || item.platform || "").slice(0, 80),
      year: String(item.year || "").slice(0, 4),
      rating: Number(item.rating) || 0,
    }))
    .filter((item) => item.title);
}

function getAssistantRemoteMessages(
  limit = AI_ASSISTANT_REMOTE_HISTORY_LIMIT,
  contentMaxChars = 1200,
) {
  return assistantMessages
    .slice(-Math.max(1, Number(limit) || 1))
    .filter((entry) => entry.role === "user" || entry.source === "remote")
    .map((entry) => ({
      role: entry.role,
      content: String(entry.content || "").trim().slice(0, Math.max(120, Number(contentMaxChars) || 0)),
    }))
    .filter((entry) => entry.content);
}

function normalizeAssistantText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

// Whole-word match (plural allowed), so "arte" does not match "carte" nor
// "max" match "maximum". Terms may contain "+", "." or spaces.
function hasAssistantTerm(text, term) {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${escaped}(s|x)?(?![a-z0-9])`).test(text);
}

function parseAssistantCatalogIntent(prompt) {
  const text = normalizeAssistantText(prompt);
  const wantsSuggestion = [
    "trouve",
    "trouves",
    "cherche",
    "decouvre",
    "recommande",
    "suggest",
    "propose",
    "que regarder",
    "quoi regarder",
    "idee",
  ].some((term) => text.includes(term));

  const mediaType =
    text.includes("serie") && !text.includes("film")
      ? "tv"
      : text.includes("film") && !text.includes("serie")
        ? "movie"
        : "movie";
  const genreMap = {
    action: { movie: 28, tv: 10759, label: "action" },
    animation: { movie: 16, tv: 16, label: "animation" },
    comedie: { movie: 35, tv: 35, label: "comedie" },
    comedy: { movie: 35, tv: 35, label: "comedie" },
    crime: { movie: 80, tv: 80, label: "crime" },
    documentaire: { movie: 99, tv: 99, label: "documentaire" },
    drame: { movie: 18, tv: 18, label: "drame" },
    drama: { movie: 18, tv: 18, label: "drame" },
    fantasy: { movie: 14, tv: 10765, label: "fantasy" },
    horreur: { movie: 27, tv: 9648, label: "horreur" },
    horror: { movie: 27, tv: 9648, label: "horreur" },
    romance: { movie: 10749, tv: 10766, label: "romance" },
    "science fiction": { movie: 878, tv: 10765, label: "science-fiction" },
    "science-fiction": { movie: 878, tv: 10765, label: "science-fiction" },
    "sci fi": { movie: 878, tv: 10765, label: "science-fiction" },
    "sci-fi": { movie: 878, tv: 10765, label: "science-fiction" },
    thriller: { movie: 53, tv: 9648, label: "thriller" },
  };
  const genreEntry = Object.entries(genreMap).find(([term]) =>
    hasAssistantTerm(text, term),
  )?.[1];
  const providerAliases = [
    { terms: ["netflix"], key: "netflix" },
    { terms: ["prime video", "prime", "amazon"], key: "prime-video" },
    { terms: ["disney+", "disney plus", "disney"], key: "disney+" },
    { terms: ["canal+", "canal plus", "canal"], key: "canal+" },
    { terms: ["apple tv+", "apple tv", "apple"], key: "apple-tv+" },
    { terms: ["arte"], key: "arte" },
    { terms: ["france tv", "france.tv"], key: "france-tv" },
    { terms: ["max", "hbo"], key: "max" },
    { terms: ["paramount+", "paramount plus", "paramount"], key: "paramount+" },
    { terms: ["crunchyroll"], key: "crunchyroll" },
    { terms: ["mubi"], key: "mubi" },
  ];
  const providerMatch = providerAliases.find((entry) =>
    entry.terms.some((term) => hasAssistantTerm(text, term)),
  );
  const provider = providerMatch
    ? USER_PROVIDER_OPTIONS.find((option) => option.key === providerMatch.key)
    : null;
  const hasCatalogFilter = Boolean(genreEntry || provider);

  if (!wantsSuggestion && !hasCatalogFilter) return null;

  return {
    mediaType,
    genreId: genreEntry?.[mediaType] || null,
    genreLabel: genreEntry?.label || null,
    providerId: provider?.tmdbId || null,
    providerLabel: provider?.label || null,
  };
}

async function buildLocalCatalogSuggestionReply(prompt) {
  const intent = parseAssistantCatalogIntent(prompt);
  if (!intent || !hasConfiguredTmdbApiKey()) return null;

  const endpoint = intent.mediaType === "tv" ? "tv" : "movie";
  const url = buildTmdbUrl(`discover/${endpoint}`, {
    include_adult: "false",
    sort_by: "popularity.desc",
    "vote_count.gte": endpoint === "movie" ? "150" : "80",
    watch_region: TMDB_WATCH_REGION,
    [endpoint === "movie" ? "primary_release_date.lte" : "first_air_date.lte"]:
      getTodayDateInputValue(),
    with_genres: intent.genreId,
    with_watch_providers: intent.providerId,
    with_watch_monetization_types: intent.providerId ? "flatrate|free|ads" : null,
  });

  const response = await fetch(url);
  if (!response.ok) return null;
  const data = await response.json();
  const candidates = (data.results || [])
    .filter((tmdbItem) => {
      const mediaType = endpoint === "tv" ? "tv" : "movie";
      return !items.some((item) =>
        isSameTmdbCollectionItem(item, tmdbItem.id, mediaType),
      );
    })
    .slice(0, 4);

  if (!candidates.length) return null;

  const typeLabel = endpoint === "tv" ? "series" : "films";
  const genreLabel = intent.genreLabel ? ` ${intent.genreLabel}` : "";
  const providerLabel = intent.providerLabel ? ` sur ${intent.providerLabel}` : "";
  const recommendationItems = candidates.map((item, index) => {
    const title = item.title || item.name || "Titre inconnu";
    const year = String(item.release_date || item.first_air_date || "").slice(
      0,
      4,
    );
    const rating = Number(item.vote_average || 0);
    const meta = [
      endpoint === "tv" ? "Serie" : "Film",
      year || null,
      rating > 0 ? `TMDB ${rating.toFixed(1)}/10` : null,
    ]
      .filter(Boolean)
      .join(" - ");
    const overview = String(item.overview || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 150);
    return {
      rank: String(index + 1),
      title,
      meta,
      reason:
        overview ||
        "Suggestion populaire qui correspond aux filtres de ta demande.",
    };
  });
  const lines = [
    `Le backend IA est inaccessible, mais j'ai quand meme cherche dans TMDB. Voici ${candidates.length} ${typeLabel}${genreLabel}${providerLabel} a tenter :`,
    ...recommendationItems.map(
      (item) =>
        `${item.rank}. ${item.title}${item.meta ? ` (${item.meta})` : ""} - ${item.reason}`,
    ),
  ];
  return {
    content: lines.join("\n"),
    recommendations: {
      eyebrow: "Recherche TMDB",
      context: `${intent.genreLabel || "Suggestions"}${intent.providerLabel ? ` - ${intent.providerLabel}` : ""} - ${TMDB_WATCH_REGION}`,
      chips: [
        intent.providerLabel || null,
        intent.genreLabel || null,
        endpoint === "tv" ? "Series" : "Films",
        "Pas dans ta collection",
      ].filter(Boolean),
      items: recommendationItems,
      note:
        "Mode secours: l'IA distante est indisponible, donc CineTracker filtre TMDB avec ta demande.",
    },
  };
}

async function buildAssistantFallbackReply(prompt) {
  const catalogReply = await buildLocalCatalogSuggestionReply(prompt);
  return catalogReply || buildLocalAssistantReply(prompt);
}

function buildLocalAssistantReply(prompt) {
  const normalizeText = (value) =>
    String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  const normalizedPrompt = normalizeText(prompt);
  const watched = items.filter((item) => item.status === "watched").length;
  const watching = items.filter((item) => item.status === "watching").length;
  const towatchItems = items.filter((item) => item.status === "towatch");
  const towatch = towatchItems.length;

  const mentionedItem = items.find((item) => {
    const title = normalizeText(item.title);
    return title.length >= 3 && normalizedPrompt.includes(title);
  });
  if (mentionedItem) {
    return [
      formatAssistantItem(mentionedItem),
      mentionedItem.rating ? `ta note : ${mentionedItem.rating}/5` : "",
      mentionedItem.providerName ? `plateforme : ${mentionedItem.providerName}` : "",
      mentionedItem.notes ? `ton avis : ${mentionedItem.notes}` : "",
    ]
      .filter(Boolean)
      .join(" · ");
  }

  const genreCounts = Object.entries(
    items.reduce((counts, item) => {
      String(item.genre || "")
        .split(",")
        .map((genre) => genre.trim())
        .filter(Boolean)
        .forEach((genre) => {
          counts[genre] = (counts[genre] || 0) + 1;
        });
      return counts;
    }, {}),
  ).sort((left, right) => right[1] - left[1]);

  if (
    normalizedPrompt.includes("genre") ||
    normalizedPrompt.includes("gout") ||
    normalizedPrompt.includes("preference")
  ) {
    return genreCounts.length
      ? `Tes genres les plus présents sont ${genreCounts
          .slice(0, 5)
          .map(([genre, count]) => `${genre} (${count})`)
          .join(", ")}.`
      : "Je n'ai pas encore assez de genres renseignés pour décrire tes goûts.";
  }

  if (
    normalizedPrompt.includes("meilleur") ||
    normalizedPrompt.includes("prefere") ||
    normalizedPrompt.includes("mieux note") ||
    normalizedPrompt.includes("favori")
  ) {
    const favorites = items
      .filter((item) => Number(item.rating) > 0)
      .sort((a, b) => Number(b.rating) - Number(a.rating))
      .slice(0, 5);
    return favorites.length
      ? `Tes titres les mieux notés :\n${favorites
          .map((item, index) => `${index + 1}. ${item.title} · ${item.rating}/5`)
          .join("\n")}`
      : "Tu n'as pas encore noté de titre dans ta collection.";
  }

  const suggestionPool = items
    .filter((item) => item.status === "towatch" || item.status === "watching")
    .filter((item) => {
      if (normalizedPrompt.includes("film")) return item.type === "movie";
      if (normalizedPrompt.includes("serie")) {
        return item.type === "series";
      }
      return true;
    })
    .sort((a, b) => Number(b.rating || 0) - Number(a.rating || 0))
    .slice(0, 3);

  if (
    normalizedPrompt.includes("combien") ||
    normalizedPrompt.includes("nombre") ||
    normalizedPrompt.includes("stat") ||
    normalizedPrompt.includes("bilan") ||
    normalizedPrompt.includes("resume")
  ) {
    const movies = items.filter((item) => item.type === "movie").length;
    const series = items.filter((item) => item.type === "series").length;
    return `Tu as ${items.length} titres : ${movies} films et ${series} séries. ${watched} sont vus, ${watching} en cours et ${towatch} à voir.`;
  }

  if (
    normalizedPrompt.includes("regarder") ||
    normalizedPrompt.includes("suggest") ||
    normalizedPrompt.includes("conseil") ||
    normalizedPrompt.includes("soir") ||
    normalizedPrompt.includes("propose") ||
    normalizedPrompt.includes("choisis")
  ) {
    if (suggestionPool.length === 0) {
      return "Ta file a voir est vide pour ce filtre. Ajoute des titres via TMDB, puis je te proposerai une selection intelligente.";
    }

    return [
      "Voici 3 suggestions de ta collection:",
      ...suggestionPool.map((item, index) => `${index + 1}. ${formatAssistantItem(item)}`),
      "Si tu veux, je peux te faire une version: rapide (<2h), detente, ou intense.",
    ].join("\n");
  }

  if (
    normalizedPrompt.includes("prior") ||
    normalizedPrompt.includes("organis") ||
    normalizedPrompt.includes("plan")
  ) {
    const priority = towatchItems
      .slice()
      .sort((a, b) => Number(b.rating || 0) - Number(a.rating || 0))
      .slice(0, 5)
      .map((item, index) => `${index + 1}. ${formatAssistantItem(item)}`)
      .join("\n");

    return priority
      ? `Plan prioritaire propose:\n${priority}`
      : "Aucune priorite a proposer pour le moment. Ajoute des titres a voir pour generer un plan.";
  }

  return [
    "Je suis actuellement en mode local : je peux répondre aux questions portant sur ta collection, mais pas aux questions générales.",
    "Essaie par exemple : « combien de séries ai-je ? », « quels sont mes genres préférés ? », « parle-moi de [titre] » ou « que regarder ce soir ? ».",
    "Pour une conversation libre, active l’IA distante et vérifie que le badge n’indique plus « Mode local ».",
  ].join("\n");
}

function renderAssistantRecommendations(recommendations) {
  const safeRecommendations = normalizeAssistantRecommendations(recommendations);
  if (!safeRecommendations) return "";

  const chips = safeRecommendations.chips.length
    ? `<div class="assistant-rec-chips">${safeRecommendations.chips
        .map((chip) => `<span>${escapeHtml(chip)}</span>`)
        .join("")}</div>`
    : "";
  const rows = safeRecommendations.items
    .map(
      (item) => `
        <div class="assistant-rec-row">
          <div class="assistant-rec-rank">${escapeHtml(item.rank)}</div>
          <div class="assistant-rec-copy">
            <div class="assistant-rec-title">${escapeHtml(item.title)}</div>
            ${item.meta ? `<div class="assistant-rec-meta">${escapeHtml(item.meta)}</div>` : ""}
            ${item.reason ? `<div class="assistant-rec-reason">${escapeHtml(item.reason)}</div>` : ""}
          </div>
        </div>
      `,
    )
    .join("");

  return `
    <div class="assistant-rec">
      <div class="assistant-rec-head">
        <span>${escapeHtml(safeRecommendations.eyebrow)}</span>
        ${safeRecommendations.context ? `<small>${escapeHtml(safeRecommendations.context)}</small>` : ""}
      </div>
      ${chips}
      <div class="assistant-rec-list">${rows}</div>
      ${safeRecommendations.note ? `<div class="assistant-rec-note">${escapeHtml(safeRecommendations.note)}</div>` : ""}
    </div>
  `;
}

function renderAssistantMessageContent(message) {
  const recommendationsHtml = renderAssistantRecommendations(
    message.recommendations,
  );
  if (!recommendationsHtml) return escapeHtml(message.content);

  const intro = String(message.content || "").split("\n")[0] || "";
  return `${intro ? `<div class="assistant-msg-intro">${escapeHtml(intro)}</div>` : ""}${recommendationsHtml}`;
}

function renderAssistantMessages({ pending = false } = {}) {
  const thread = document.getElementById("assistantMessages");
  if (!thread) return;

  ensureAssistantWelcomeMessage();

  const rows = assistantMessages.map((message) => {
    const cssClass = message.role === "user" ? "user" : "assistant";
    return `<div class="assistant-msg ${cssClass}">${renderAssistantMessageContent(message)}</div>`;
  });

  if (pending) {
    rows.push(
      '<div class="assistant-msg assistant pending">En train de reflechir...</div>',
    );
  }

  thread.innerHTML = rows.join("");
  thread.scrollTop = thread.scrollHeight;
}

function openAssistant() {
  const modal = document.getElementById("assistantModal");
  if (!modal) return;
  modal.classList.add("active");
  renderAssistantMessages();
  const consent = document.getElementById("assistantRemoteConsent");
  if (consent) consent.checked = hasAssistantRemoteConsent();
  refreshAssistantModeStatus();
  const input = document.getElementById("assistantInput");
  if (input) input.focus();
}

function closeAssistant() {
  document.getElementById("assistantModal")?.classList.remove("active");
}

async function queryAssistantApi(prompt) {
  if (!AI_ASSISTANT_REMOTE_ENABLED || !hasAssistantRemoteConsent()) return null;
  if (AI_ASSISTANT_NEEDS_ABSOLUTE_URL) return null;

  const timeoutMs = getAssistantRequestTimeoutMs();
  const attempts = [
    {
      timeoutMs,
      collectionMaxChars: AI_ASSISTANT_REMOTE_COLLECTION_MAX_CHARS,
      historyLimit: AI_ASSISTANT_REMOTE_HISTORY_LIMIT,
      messageMaxChars: 1200,
    },
    {
      // Lighter retry payload; keep the server-aware timeout so it can succeed.
      timeoutMs,
      collectionMaxChars: 1400,
      historyLimit: 2,
      messageMaxChars: 450,
    },
  ];

  let lastError = null;
  for (const attempt of attempts) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), attempt.timeoutMs);
    try {
      const response = await fetch(AI_ASSISTANT_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getBackendAuthHeaders() },
        signal: controller.signal,
        body: JSON.stringify({
          collection: getAssistantRemoteCollectionContext(prompt, attempt.collectionMaxChars),
          collectionItems: getAssistantRemoteCollectionItems(
            attempt.historyLimit <= 2 ? 80 : 180,
          ),
          // The current prompt is already the final entry: do not append it twice.
          messages: getAssistantRemoteMessages(attempt.historyLimit, attempt.messageMaxChars),
        }),
      });

      if (!response.ok) {
        const error = new Error(`Assistant API error ${response.status}`);
        const retryable = response.status === 408 || response.status === 429 || response.status >= 500;
        if (!retryable) throw error;
        lastError = error;
        continue;
      }

      const data = await response.json();
      const content = data?.reply;
      if (!content) throw new Error("Assistant API response is empty");
      return String(content).trim();
    } catch (error) {
      lastError = error;
      const message = String(error?.message || "").toLowerCase();
      const retryable =
        error?.name === "AbortError" ||
        message.includes("network") ||
        message.includes("fetch") ||
        message.includes("timeout");
      if (!retryable) throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  if (lastError) throw lastError;
  throw new Error("Assistant API unavailable");
}

async function submitAssistantPrompt() {
  if (assistantRequestPending) return;

  const input = document.getElementById("assistantInput");
  const sendBtn = document.getElementById("assistantSendBtn");
  const prompt = String(input?.value || "").trim();
  if (!prompt) return;

  ensureAssistantWelcomeMessage();
  assistantMessages.push({ role: "user", content: prompt });
  assistantMessages = assistantMessages.slice(-AI_ASSISTANT_MAX_HISTORY * 2);
  persistAssistantHistory();

  if (input) input.value = "";
  assistantRequestPending = true;
  if (sendBtn) sendBtn.disabled = true;
  renderAssistantMessages({ pending: true });

  try {
    const remoteReply = await queryAssistantApi(prompt);
    const reply = remoteReply || (await buildAssistantFallbackReply(prompt));
    const replyContent =
      reply && typeof reply === "object" ? reply.content : reply;
    assistantMessages.push({
      role: "assistant",
      source: remoteReply ? "remote" : "local",
      content: String(replyContent || ""),
      recommendations:
        reply && typeof reply === "object"
          ? normalizeAssistantRecommendations(reply.recommendations)
          : null,
    });

    if (!remoteReply && !assistantConfigTipShown && !hasAssistantRemoteConsent()) {
      assistantConfigTipShown = true;
      showToast("Mode local actif. Autorise le partage pour utiliser l'assistant distant.");
    }
  } catch (error) {
    console.error("Assistant error:", error);
    refreshAssistantModeStatus();
    const errorLabel =
      error?.name === "AbortError"
        ? "timeout"
        : String(error?.message || "erreur inconnue").slice(0, 120);
    const fallbackReply = await buildAssistantFallbackReply(prompt);
    const fallbackContent =
      fallbackReply && typeof fallbackReply === "object"
        ? fallbackReply.content
        : fallbackReply;
    assistantMessages.push({
      role: "assistant",
      source: "local",
      content:
        `Réponse locale temporaire (assistant distant indisponible : ${errorLabel}).\n\n${String(fallbackContent || "")}`,
      recommendations:
        fallbackReply && typeof fallbackReply === "object"
          ? normalizeAssistantRecommendations(fallbackReply.recommendations)
          : null,
    });
  } finally {
    assistantMessages = assistantMessages.slice(-AI_ASSISTANT_MAX_HISTORY * 2);
    persistAssistantHistory();
    assistantRequestPending = false;
    if (sendBtn) sendBtn.disabled = false;
    renderAssistantMessages();
    if (input) input.focus();
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    getAssistantRequestTimeoutMs,
    normalizeAssistantRecommendations,
    shouldSendFullCollectionSnapshot,
    normalizeAssistantText,
    parseAssistantCatalogIntent,
  };
}
