import { 
  AVAILABLE_WORDS, WORD_TO_FILENAME, MULTI_WORD_SIGNS, TIME_WORDS, FUNCTION_WORDS, 
  SEMANTIC_ALIASES, LEMMA_OVERRIDES, LEMMA_SUFFIX_RULES, 
  SEMANTIC_CATEGORY_KEYWORDS, SEMANTIC_CATEGORY_LIST, LOCAL_EMBED_DIM, LOCAL_EMBED_EXTRA, LOCAL_EMBED_HASH_SPACE,
  SEMANTIC_MATCH_SETTINGS, EMBEDDING_CACHE, FINGERSPELLING_ENABLED
} from './constants.js';

// Derived constants
export const AVAILABLE_WORD_SET = new Set(AVAILABLE_WORDS);
export const ALIAS_TO_CANONICAL = buildAliasMap(SEMANTIC_ALIASES);
export const RECOGNIZED_PHRASES = [...new Set([...AVAILABLE_WORDS, ...Object.keys(ALIAS_TO_CANONICAL)])];

export const semanticIndexState = {
  method: SEMANTIC_MATCH_SETTINGS.endpoint ? 'remote' : 'local',
  ready: false,
  entries: [],
  dimension: LOCAL_EMBED_DIM,
  loading: null
};

// ---------- Hindi to English Sentence Mapping ----------
export const HINDI_TO_ENGLISH_MAP = {
  "आज सोमवार को मैं मोबाइल और कंप्यूटर देख रहा हूँ।": "Monday mobile computer",
  "सुबह बेडरूम में घड़ी और लैम्प चालू थे।": "bedroom clock lamp",
  "मेज़ पर पेन, किताब और अख़बार पड़े हैं।": "pen book newspaper",
  "मैंने आज कमीज़ और सूट पहना है।": "shirt suit",
  "रसोई में पंखा और लैम्प चालू है।": "kitchen fan lamp",
  "यह तस्वीर बहुत सुंदर है।": "photograph",
  "यह पोशाक सस्ती नहीं, महंगी है।": "dress",
  "पुरुष और महिला दोनों यहाँ बैठे हैं।": "male female",
  "बंदूक और युद्ध से शांति नहीं मिलती।": "gun war peace",
  "अंधे और बहिरे लोगों में भी ऊर्जा होती है।": "blind deaf energy"
};

function buildAliasMap(table) {
  const map = {};
  Object.entries(table).forEach(([canonical, variants]) => {
    const key = (canonical || '').trim().toLowerCase();
    if (key) map[key] = canonical;
    if (!Array.isArray(variants)) return;
    variants.forEach(variant => {
      const aliasKey = (variant || '').trim().toLowerCase();
      if (aliasKey) map[aliasKey] = canonical;
    });
  });
  return map;
}

function lemmatizeWord(word) {
  if (!word) return '';
  const lower = word.toLowerCase();
  if (LEMMA_OVERRIDES[lower]) return LEMMA_OVERRIDES[lower];
  for (const rule of LEMMA_SUFFIX_RULES) {
    if (!lower.endsWith(rule.suffix)) continue;
    if (lower.length <= (rule.min || 0)) continue;
    if (rule.skipDouble && lower.endsWith(rule.suffix + rule.suffix[rule.suffix.length - 1])) continue;
    if (rule.suffix === 's' && lower.endsWith('ss')) continue;
    const stem = lower.slice(0, lower.length - rule.suffix.length) + (rule.replacement || '');
    if (stem.length >= 2) return stem;
  }
  return lower;
}

function resolveCanonicalPhrase(candidate, candidateLemma) {
  if (AVAILABLE_WORD_SET.has(candidate)) return { canonical: candidate, source: 'exact' };
  if (candidateLemma && AVAILABLE_WORD_SET.has(candidateLemma)) return { canonical: candidateLemma, source: 'lemma' };
  if (ALIAS_TO_CANONICAL[candidate]) return { canonical: ALIAS_TO_CANONICAL[candidate], source: 'alias' };
  if (candidateLemma && ALIAS_TO_CANONICAL[candidateLemma]) return { canonical: ALIAS_TO_CANONICAL[candidateLemma], source: 'alias' };
  return null;
}

function isTimePhrase(phrase) {
  return phrase.split(' ').some(word => TIME_WORDS.has(word));
}

export function buildGlossSequence(tokens) {
  // Include matched, semantic, and (if fingerspelling enabled) raw unmatched tokens
  const accepted = tokens.filter(t => {
    if (t.kind === 'match' || t.kind === 'semantic') return t.accepted !== false;
    if (FINGERSPELLING_ENABLED && t.kind === 'raw') return true; // Include for fingerspelling
    return false;
  });
  
  const timeFirst = [];
  const others = [];
  accepted.forEach(token => {
    const word = token.canonical || token.original; // Use original for raw tokens
    if (token.kind !== 'raw' && isTimePhrase(word)) {
      timeFirst.push({ ...token, word });
    } else {
      others.push({ ...token, word });
    }
  });
  
  return [...timeFirst, ...others].map(token => token.word);
}

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function detectCategoryActivations(text) {
  const activations = new Array(SEMANTIC_CATEGORY_LIST.length).fill(0);
  SEMANTIC_CATEGORY_LIST.forEach((name, idx) => {
    const keywords = SEMANTIC_CATEGORY_KEYWORDS[name];
    if (!keywords) return;
    for (const kw of keywords) {
      if (text.includes(kw)) {
        activations[idx] = 1;
        break;
      }
    }
  });
  return activations;
}

function localSimpleEmbedding(text) {
  const cleaned = (text || '').toLowerCase().trim();
  const vec = new Float32Array(LOCAL_EMBED_DIM);
  if (!cleaned) return vec;

  for (let i = 0; i < cleaned.length; i++) {
    const code = cleaned.charCodeAt(i);
    const idx = (code + i) % LOCAL_EMBED_HASH_SPACE;
    vec[idx] += 1;
    if (i < cleaned.length - 2) {
      const trigram = cleaned.slice(i, i + 3);
      const triIdx = hashString(trigram) % LOCAL_EMBED_HASH_SPACE;
      vec[triIdx] += 0.5;
    }
  }

  vec[LOCAL_EMBED_HASH_SPACE] = Math.min(3, cleaned.length / 4);
  vec[LOCAL_EMBED_HASH_SPACE + 1] = (cleaned.match(/[aeiou]/g) || []).length;

  const categories = detectCategoryActivations(cleaned);
  categories.forEach((value, idx) => {
    const target = LOCAL_EMBED_DIM - categories.length + idx;
    vec[target] = value;
  });

  return vec;
}

function vectorNorm(vec) {
  if (!vec) return 0;
  let sum = 0;
  for (let i = 0; i < vec.length; i++) {
    sum += vec[i] * vec[i];
  }
  return Math.sqrt(sum);
}

function cosineSimilarity(vecA, vecB, normA, normB) {
  if (!vecA || !vecB || !normA || !normB) return 0;
  const len = Math.min(vecA.length, vecB.length);
  let dot = 0;
  for (let i = 0; i < len; i++) {
    dot += vecA[i] * vecB[i];
  }
  return dot / (normA * normB);
}

async function ensureSemanticIndexReady() {
  if (semanticIndexState.ready) return semanticIndexState;
  if (!semanticIndexState.loading) {
    semanticIndexState.loading = loadSemanticIndex();
  }
  return semanticIndexState.loading;
}

async function loadSemanticIndex() {
  if (SEMANTIC_MATCH_SETTINGS.endpoint) {
    const remoteEntries = await buildIndexWithEndpoint();
    if (remoteEntries.length) {
      semanticIndexState.method = 'remote';
      semanticIndexState.entries = remoteEntries;
      semanticIndexState.dimension = remoteEntries[0].vector.length;
      semanticIndexState.ready = true;
      return semanticIndexState;
    }
  }
  semanticIndexState.method = 'local';
  semanticIndexState.entries = generateLocalSemanticIndex();
  semanticIndexState.dimension = LOCAL_EMBED_DIM;
  semanticIndexState.ready = true;
  return semanticIndexState;
}

function wordTokenCount(text) {
  return (text || '').trim().split(/\s+/).filter(Boolean).length || 1;
}

function generateLocalSemanticIndex() {
  return AVAILABLE_WORDS.map(word => {
    const vector = localSimpleEmbedding(word);
    return { word, vector, norm: vectorNorm(vector), tokens: wordTokenCount(word) };
  });
}

async function buildIndexWithEndpoint() {
  const entries = [];
  for (const word of AVAILABLE_WORDS) {
    const vector = await fetchEmbeddingFromEndpoint(word);
    if (!vector) {
      return [];
    }
    entries.push({ word, vector, norm: vectorNorm(vector), tokens: wordTokenCount(word) });
  }
  return entries;
}

async function fetchEmbeddingFromEndpoint(text) {
  try {
    const headers = { 'Content-Type': 'application/json' };
    if (SEMANTIC_MATCH_SETTINGS.apiKey) {
      headers['Authorization'] = `Bearer ${SEMANTIC_MATCH_SETTINGS.apiKey}`;
    }
    const res = await fetch(SEMANTIC_MATCH_SETTINGS.endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({ text })
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (Array.isArray(data.vector)) {
      return Float32Array.from(data.vector.map(Number));
    }
  } catch (err) {
    console.warn('Embedding endpoint error:', err);
  }
  return null;
}

async function embedText(text) {
  const key = (text || '').toLowerCase();
  if (EMBEDDING_CACHE.has(key)) return EMBEDDING_CACHE.get(key);

  let vector = null;
  if (semanticIndexState.method === 'remote' && SEMANTIC_MATCH_SETTINGS.endpoint) {
    vector = await fetchEmbeddingFromEndpoint(text);
    if (!vector) return null;
  } else {
    vector = localSimpleEmbedding(text);
  }
  EMBEDDING_CACHE.set(key, vector);
  return vector;
}

async function findSemanticFallbackForToken(token) {
  await ensureSemanticIndexReady();
  if (!semanticIndexState.entries.length) return null;
  const query = token.lemma || token.normalized || token.original;
  const vector = await embedText(query);
  if (!vector) return null;
  const norm = vectorNorm(vector);
  if (!norm) return null;
  const tokenLength = wordTokenCount(token.original || token.lemma || token.normalized);
  let best = null;
  for (const entry of semanticIndexState.entries) {
    if (entry.tokens && entry.tokens !== tokenLength) continue;
    if (!entry.norm || !entry.vector) continue;
    const score = cosineSimilarity(vector, entry.vector, norm, entry.norm);
    if (!best || score > best.score) {
      best = { word: entry.word, score };
    }
  }
  if (best && best.score >= SEMANTIC_MATCH_SETTINGS.minSimilarity) {
    return best;
  }
  return null;
}

export async function applySemanticFallback(tokens) {
  const applied = [];
  const needsFallback = tokens.some(t => t.kind === 'raw');
  if (!needsFallback) return applied;

  await ensureSemanticIndexReady();
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token.kind !== 'raw') continue;
    const fallback = await findSemanticFallbackForToken(token);
    if (fallback) {
      token.kind = 'semantic';
      token.canonical = fallback.word;
      token.source = 'semantic';
      token.score = fallback.score;
      token.accepted = true;
      applied.push({ index: i, original: token.original, canonical: fallback.word, score: fallback.score });
    }
  }
  return applied;
}

export function getUnmatchedWords(tokens) {
  return tokens.filter(t => t.kind === 'raw').map(t => t.original.toLowerCase());
}

export function getUnmatchedForDisplay(tokens) {
  // Get unmatched words that aren't function words (those are truly skipped)
  const rawTokens = tokens.filter(t => t.kind === 'raw');
  const willFingerSpell = FINGERSPELLING_ENABLED ? rawTokens.map(t => t.original.toLowerCase()) : [];
  return { willFingerSpell };
}

// ---------- ISL Grammar Conversion (Longest-Match-First Algorithm) ----------
export async function convertSentenceToGloss(sentence) {
  let original = sentence.trim();
  if (!original) return { tokens: [], semanticApplied: [], currentGlosses: [] };

  // Check if input matches a Hindi sentence and convert to English
  if (HINDI_TO_ENGLISH_MAP[original]) {
    console.log(`Hindi sentence detected: "${original}"`);
    console.log(`Converting to: "${HINDI_TO_ENGLISH_MAP[original]}"`);
    original = HINDI_TO_ENGLISH_MAP[original];
  }

  const cleaned = original
    .replace(/[.,!?;:]/g, '')
    .replace(/['’"]/g, '')
    .replace(/[-/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return { tokens: [], semanticApplied: [], currentGlosses: [] };

  const rawWords = cleaned.split(' ');
  const normalizedWords = rawWords.map(w => w.toLowerCase());
  const lemmaWords = normalizedWords.map(lemmatizeWord);

  const tokens = [];
  let position = 0;
  
  const maxLen = normalizedWords.length;

  while (position < maxLen) {
    let foundMatch = false;
    for (let len = maxLen - position; len >= 1; len--) {
      const spanNormalized = normalizedWords.slice(position, position + len).join(' ');
      const spanLemma = lemmaWords.slice(position, position + len).join(' ');
      const resolved = resolveCanonicalPhrase(spanNormalized, spanLemma);
      if (resolved) {
        tokens.push({
          kind: 'match',
          canonical: resolved.canonical,
          source: resolved.source,
          original: rawWords.slice(position, position + len).join(' '),
          accepted: true
        });
        position += len;
        foundMatch = true;
        break;
      }
    }
    
    if (!foundMatch) {
      const currentWord = normalizedWords[position];
      if (!FUNCTION_WORDS.has(currentWord)) {
        tokens.push({
          kind: 'raw',
          original: rawWords[position],
          normalized: currentWord,
          lemma: lemmaWords[position],
          accepted: false
        });
      }
      position++;
    }
  }
  
  const semanticApplied = await applySemanticFallback(tokens);
  const currentGlosses = buildGlossSequence(tokens);

  return { tokens, semanticApplied, currentGlosses };
}