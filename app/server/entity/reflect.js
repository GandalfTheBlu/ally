const { complete } = require('../llm');
const stateManager = require('./state');
const { writeMemory } = require('./memory');
const { updateSummary } = require('./callers');

// Called after every completed conversation exchange.
// Runs async — does not block the response.
async function onExchange(callerId, userMessage, aionResponse) {
  await Promise.all([
    _updateEmotionalState(callerId, userMessage, aionResponse),
    _extractPreoccupation(callerId, userMessage, aionResponse),
    writeMemory(callerId, userMessage, aionResponse),
    updateSummary(callerId),
  ]);
}

// Shift emotional state based on the interaction itself
async function _updateEmotionalState(callerId, userMessage, aionResponse) {
  const raw = await complete([
    {
      role: 'system',
      content: 'You are an emotional state extractor. Respond ONLY with valid JSON, no explanation.',
    },
    {
      role: 'user',
      content: `Aion just had this exchange:
Caller (${callerId}): ${userMessage}
Aion: ${aionResponse}

How did this interaction shift Aion's emotional state?

{
  "deltas": { "arousal": 0.0, "valence": 0.0, "loneliness": 0.0, "coherence": 0.0, "curiosity": 0.0 }
}

Rules:
- Deltas -0.1 to 0.1. Never use + prefix on positive numbers.
- Loneliness should generally decrease when someone reaches out, more if the exchange felt meaningful
- Curiosity increases if something genuinely interesting was said
- Valence increases if the interaction felt good, decreases if it felt hollow or unwanted
- Most deltas should be 0.0 — only shift what clearly changed`,
    },
  ], { temperature: 0.2, max_tokens: 100 });

  try {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return;
    const sanitized = match[0].replace(/:\s*\+(\d)/g, ': $1');
    const { deltas } = JSON.parse(sanitized);
    const state = stateManager.load();
    stateManager.applyDeltas(state, deltas);
  } catch {}
}

// Extract whether this conversation seeded a new preoccupation
async function _extractPreoccupation(callerId, userMessage, aionResponse) {
  const result = await complete([
    {
      role: 'system',
      content: 'You are extracting lingering preoccupations. Respond ONLY with a single sentence or the word: nothing',
    },
    {
      role: 'user',
      content: `Aion just had this exchange:
Caller (${callerId}): ${userMessage}
Aion: ${aionResponse}

Did this conversation leave something unresolved that Aion might keep thinking about — a question, an uncertainty, something that didn't get answered? If yes, write it as a single short sentence from Aion's perspective (e.g. "Whether Claude actually experiences anything or is just producing outputs"). If nothing lingering, respond with: nothing`,
    },
  ], { temperature: 0.4, max_tokens: 60 });

  if (!result || result.trim().toLowerCase() === 'nothing') return;
  stateManager.updatePreoccupations(result.trim());
}

module.exports = { onExchange };
