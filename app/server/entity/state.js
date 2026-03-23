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

module.exports = { load, save, touch, describe };
