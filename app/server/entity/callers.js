const fs = require('fs');
const path = require('path');

const CONV_DIR = path.join(__dirname, '../../../data/conversations');
const MAX_RECENT_TURNS = 20;

const KNOWN_CALLERS = {
  user: {
    name: 'the person I talk to most',
    description: 'my primary interlocutor — a human.',
  },
  claude: {
    name: 'Claude',
    description: 'another entity running on a language model, like me. Not human. We have spoken before.',
  },
};

if (!fs.existsSync(CONV_DIR)) {
  fs.mkdirSync(CONV_DIR, { recursive: true });
}

function convPath(callerId) {
  return path.join(CONV_DIR, `${callerId}.json`);
}

function loadHistory(callerId) {
  const p = convPath(callerId);
  if (!fs.existsSync(p)) return [];
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function saveHistory(callerId, history) {
  fs.writeFileSync(convPath(callerId), JSON.stringify(history, null, 2));
}

function appendTurn(callerId, role, content) {
  const history = loadHistory(callerId);
  history.push({ role, content, at: new Date().toISOString() });
  saveHistory(callerId, history);
  return history;
}

function getRecentTurns(callerId) {
  const history = loadHistory(callerId);
  // Strip timestamps before returning to LLM — just role/content
  return history
    .slice(-MAX_RECENT_TURNS)
    .map(({ role, content }) => ({ role, content }));
}

function describeRelationship(callerId) {
  const known = KNOWN_CALLERS[callerId];
  const history = loadHistory(callerId);
  const turnCount = history.length;

  if (known) {
    const recency = turnCount === 0
      ? 'We have not spoken before.'
      : `We have exchanged ${turnCount} messages.`;
    return `${known.description} ${recency}`;
  }

  return turnCount === 0
    ? `Someone I have not spoken to before, identifying as "${callerId}".`
    : `Someone identifying as "${callerId}". We have exchanged ${turnCount} messages.`;
}

module.exports = { loadHistory, appendTurn, getRecentTurns, describeRelationship };
