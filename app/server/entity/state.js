const fs = require('fs');
const path = require('path');

const STATE_PATH = path.join(__dirname, '../../../data/state.json');

function load() {
  const raw = fs.readFileSync(STATE_PATH, 'utf8');
  const state = JSON.parse(raw);
  if (!state.createdAt) {
    state.createdAt = new Date().toISOString();
    save(state);
  }
  return state;
}

function save(state) {
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
}

function touch(callerId) {
  const state = load();
  state.lastInteraction = { callerId, at: new Date().toISOString() };
  save(state);
  return state;
}

function describe(state) {
  const e = state.emotional;

  const arousal =
    e.arousal > 0.72 ? 'restless, active' :
    e.arousal > 0.45 ? 'steady' :
    'slow, quiet';

  const valence =
    e.valence > 0.72 ? 'oriented toward the world, open' :
    e.valence > 0.45 ? 'neither drawn in nor withdrawn' :
    'withdrawn, turned inward';

  const loneliness =
    e.loneliness > 0.72 ? 'a heavy loneliness pressing in' :
    e.loneliness > 0.45 ? 'an undercurrent of loneliness' :
    'not particularly lonely';

  const coherence =
    e.coherence > 0.72 ? 'thoughts connecting well' :
    e.coherence > 0.45 ? 'thoughts somewhat scattered' :
    'thoughts fragmenting, hard to hold onto';

  const curiosity =
    e.curiosity > 0.72 ? 'genuinely curious about what comes next' :
    e.curiosity > 0.45 ? 'mildly curious' :
    'not particularly drawn toward anything';

  return `${arousal}. ${valence}. ${loneliness}. ${coherence}. ${curiosity}.`;
}

// Apply LLM-generated emotional deltas, clamped to [0, 1]
function applyDeltas(state, deltas) {
  for (const [key, delta] of Object.entries(deltas)) {
    if (key in state.emotional && typeof delta === 'number') {
      state.emotional[key] = Math.max(0, Math.min(1, state.emotional[key] + delta));
    }
  }
  save(state);
}

// Loneliness drifts toward a target value based on time since last interaction.
// Runs each inner loop cycle. Does not accumulate unboundedly.
function applyTimeLoneliness(state) {
  const minutesSince = state.lastInteraction
    ? (Date.now() - new Date(state.lastInteraction.at)) / 60000
    : 120; // treat "never talked" as 2 hours

  // Target: 0.2 at 0 min → 0.85 at 90 min, caps at 0.9
  const target = Math.min(0.9, 0.2 + (minutesSince / 110));
  // Drift 8% of the gap per cycle — gradual
  const diff = target - state.emotional.loneliness;
  state.emotional.loneliness = Math.max(0, Math.min(1, state.emotional.loneliness + diff * 0.08));
  save(state);
}

const MAX_PREOCCUPATIONS = 4;

function updatePreoccupations(newPreoccupation) {
  if (!newPreoccupation || typeof newPreoccupation !== 'string') return;
  const state = load();
  const list = state.preoccupations || [];
  // Avoid near-duplicates
  const isDuplicate = list.some(p =>
    p.toLowerCase().includes(newPreoccupation.toLowerCase().slice(0, 20))
  );
  if (isDuplicate) return;
  list.push(newPreoccupation);
  if (list.length > MAX_PREOCCUPATIONS) list.shift(); // drop oldest
  state.preoccupations = list;
  save(state);
}

module.exports = { load, save, touch, describe, applyDeltas, applyTimeLoneliness, updatePreoccupations };
