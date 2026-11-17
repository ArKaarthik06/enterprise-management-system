// Step 3 of RAG: EMBED. An embedding turns text into a list of numbers so that
// texts with a similar MEANING end up with similar numbers.
//
// Two providers:
//   "local" - a small neural model (all-MiniLM-L6-v2) run on your own machine. Best quality.
//             Downloads ~25 MB the first time. No API key needed.
//   "hash"  - a tiny word-hashing fallback with zero downloads. Lower quality but always works
//             (offline, CI, tests). Used automatically if the local model cannot load.
const config = require('../config/ai.config');

const HASH_DIMS = 384;
let localPipelinePromise = null;
let activeProvider = null;

const STOPWORDS = new Set('a an the and or of to in on for with is are was be it this that at by as from can do does i my me you your we our how what when where which who'.split(' '));

function tokenize(text) {
  return (text.toLowerCase().match(/[a-z0-9]+/g) || []).filter((w) => w.length > 1 && !STOPWORDS.has(w));
}

// FNV-1a: a tiny, fast string hash
function fnv(str, seed = 2166136261) {
  let h = seed >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

function normalize(vec) {
  let sum = 0;
  for (const v of vec) sum += v * v;
  const norm = Math.sqrt(sum) || 1;
  return vec.map((v) => v / norm);
}

function hashEmbed(text) {
  const vec = new Array(HASH_DIMS).fill(0);
  const words = tokenize(text);
  const addFeature = (feature, weight) => {
    const bucket = fnv(feature) % HASH_DIMS;
    const sign = fnv(feature, 12345) % 2 === 0 ? 1 : -1; // random sign reduces collisions
    vec[bucket] += sign * weight;
  };
  words.forEach((w, i) => {
    addFeature(w, 1);
    // light stemming so "returns" and "return" overlap
    if (w.length > 4 && w.endsWith('s')) addFeature(w.slice(0, -1), 0.7);
    if (i > 0) addFeature(`${words[i - 1]}_${w}`, 0.5); // word pairs add a bit of context
  });
  return normalize(vec);
}

async function loadLocalPipeline() {
  if (!localPipelinePromise) {
    localPipelinePromise = (async () => {
      const { pipeline, env } = await import('@xenova/transformers'); // ESM package => dynamic import
      env.allowLocalModels = false;
      return pipeline('feature-extraction', config.rag.embeddingModel);
    })();
  }
  return localPipelinePromise;
}

// Decide which provider to use (once) and remember it.
async function getProvider() {
  if (activeProvider) return activeProvider;
  const wanted = config.rag.embeddingProvider;
  if (wanted === 'hash') {
    activeProvider = 'hash';
  } else {
    try {
      await loadLocalPipeline();
      activeProvider = 'local';
    } catch (err) {
      if (wanted === 'local') throw err;
      console.warn(`[AI] Local embedding model unavailable (${err.message}). Using the "hash" fallback.`);
      activeProvider = 'hash';
    }
  }
  console.log(`[AI] Embedding provider: ${activeProvider}`);
  return activeProvider;
}

async function embed(text) {
  const provider = await getProvider();
  if (provider === 'hash') return hashEmbed(text);
  const extractor = await loadLocalPipeline();
  const output = await extractor(text, { pooling: 'mean', normalize: true });
  return Array.from(output.data);
}

// Vectors are already length 1, so cosine similarity is just the dot product.
function cosine(a, b) {
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot;
}

module.exports = { embed, getProvider, cosine, tokenize };
