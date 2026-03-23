const fs = require('fs');
const path = require('path');
const { LocalIndex } = require('vectra');
const { embed, complete } = require('../llm');
const stateManager = require('./state');

const MEMORY_DIR = path.join(__dirname, '../../../data/memory');
const index = new LocalIndex(MEMORY_DIR);

async function ensureIndex() {
  if (!await index.isIndexCreated()) {
    await index.createIndex();
  }
}
ensureIndex().catch(console.error);

// Emotional vector for congruence scoring
function emotionalVector(e) {
  return [e.arousal, e.valence, e.loneliness, e.coherence, e.curiosity];
}

function dotProduct(a, b) {
  return a.reduce((sum, v, i) => sum + v * b[i], 0);
}

function magnitude(a) {
  return Math.sqrt(a.reduce((sum, v) => sum + v * v, 0));
}

function cosineSim(a, b) {
  const mag = magnitude(a) * magnitude(b);
  return mag === 0 ? 0 : dotProduct(a, b) / mag;
}

// Write a memory from a completed exchange
async function writeMemory(callerId, userMessage, aionResponse) {
  const state = stateManager.load();

  // Ask LLM to extract what's worth remembering
  const extraction = await complete([
    {
      role: 'system',
      content: 'You are a memory extraction system. Given an exchange, write a single concise sentence (max 40 words) capturing what is worth remembering — something revealing, significant, or that might matter later. If nothing notable occurred, respond with exactly: nothing',
    },
    {
      role: 'user',
      content: `Caller: ${callerId}\nThey said: ${userMessage}\nAion responded: ${aionResponse}`,
    },
  ], { temperature: 0.4, max_tokens: 80 });

  if (!extraction || extraction.toLowerCase() === 'nothing') return null;

  const vector = await embed(extraction);
  if (!vector) return null;

  const metadata = {
    content: extraction,
    callerId,
    emotional: { ...state.emotional },
    createdAt: new Date().toISOString(),
  };

  await index.insertItem({ vector, metadata });
  return extraction;
}

// Retrieve memories relevant to current message, weighted by emotional congruence
async function recallMemories(message, topK = 3) {
  if (!await index.isIndexCreated()) return [];

  const stats = await index.listItems();
  if (stats.length === 0) return [];

  const queryVector = await embed(message);
  if (!queryVector) return [];

  const state = stateManager.load();
  const currentEmotional = emotionalVector(state.emotional);

  const results = await index.queryItems(queryVector, topK * 3);

  // Re-rank: blend semantic similarity (0.7) with emotional congruence (0.3)
  const reranked = results.map(({ item, score }) => {
    const memEmotional = emotionalVector(item.metadata.emotional);
    const congruence = cosineSim(currentEmotional, memEmotional);
    return {
      content: item.metadata.content,
      callerId: item.metadata.callerId,
      createdAt: item.metadata.createdAt,
      finalScore: score * 0.7 + congruence * 0.3,
    };
  });

  reranked.sort((a, b) => b.finalScore - a.finalScore);
  return reranked.slice(0, topK);
}

// Store a pre-extracted memory directly (used by inner loop)
async function storeMemory(content, callerId, emotional) {
  const vector = await embed(content);
  if (!vector) return null;
  await index.insertItem({
    vector,
    metadata: { content, callerId, emotional: { ...emotional }, createdAt: new Date().toISOString() },
  });
  return content;
}

// Recall memories by emotional congruence alone — no text query.
// Used by the inner loop where there is no incoming message to embed.
async function recallByEmotion(state, topK = 2) {
  if (!await index.isIndexCreated()) return [];
  const items = await index.listItems();
  if (items.length === 0) return [];

  // Embed the current felt state as a query
  const queryVector = await embed(stateManager.describe(state));
  if (!queryVector) return [];

  const results = await index.queryItems(queryVector, topK);
  return results.map(({ item }) => ({
    content: item.metadata.content,
    callerId: item.metadata.callerId,
  }));
}

async function resetIndex() {
  if (fs.existsSync(MEMORY_DIR)) {
    fs.rmSync(MEMORY_DIR, { recursive: true, force: true });
    fs.mkdirSync(MEMORY_DIR, { recursive: true });
  }
  await index.createIndex();
}

module.exports = { writeMemory, storeMemory, recallMemories, recallByEmotion, resetIndex };
