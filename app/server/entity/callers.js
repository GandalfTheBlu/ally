const fs = require('fs');
const path = require('path');
const { complete } = require('../llm');

const CONV_DIR = path.join(__dirname, '../../../data/conversations');

// Verbatim turns kept in the message array — immediate coherent context
const VERBATIM_TURNS = 6;

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

if (!fs.existsSync(CONV_DIR)) fs.mkdirSync(CONV_DIR, { recursive: true });

function convPath(callerId)    { return path.join(CONV_DIR, `${callerId}.json`); }
function summaryPath(callerId) { return path.join(CONV_DIR, `${callerId}_summary.md`); }

function loadHistory(callerId) {
  const p = convPath(callerId);
  if (!fs.existsSync(p)) return [];
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function saveHistory(callerId, history) {
  fs.writeFileSync(convPath(callerId), JSON.stringify(history, null, 2));
}

function loadSummary(callerId) {
  const p = summaryPath(callerId);
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf8').trim() : null;
}

function saveSummary(callerId, text) {
  fs.writeFileSync(summaryPath(callerId), text);
}

function appendTurn(callerId, role, content) {
  const history = loadHistory(callerId);
  history.push({ role, content, at: new Date().toISOString() });
  saveHistory(callerId, history);
  return history;
}

// Returns only the verbatim recent turns for the message array
function getRecentTurns(callerId) {
  const history = loadHistory(callerId);
  return history
    .slice(-VERBATIM_TURNS)
    .map(({ role, content }) => ({ role, content }));
}

// Summarize turns that have fallen outside the verbatim window into rolling summary
async function updateSummary(callerId) {
  const history = loadHistory(callerId);
  if (history.length <= VERBATIM_TURNS) return;

  const older = history.slice(0, history.length - VERBATIM_TURNS);
  const existing = loadSummary(callerId);
  const turns = older.map(t => `${t.role === 'user' ? 'them' : 'aion'}: ${t.content}`).join('\n');

  const prompt = existing
    ? `Existing summary:\n${existing}\n\nNew turns to fold in:\n${turns}\n\nUpdate the summary. What was discussed, what was revealed, what tensions or questions were left open. Max 120 words. Plain prose.`
    : `Summarize this conversation between a caller and Aion. What was discussed, what was revealed, what was left unresolved. Max 80 words. Plain prose.\n\n${turns}`;

  const summary = await complete([
    { role: 'system', content: 'You write concise conversation summaries. Focus on what matters: revelations, unresolved tensions, shifts in tone or understanding. No bullet points.' },
    { role: 'user', content: prompt },
  ], { temperature: 0.3, max_tokens: 180 });

  if (summary) saveSummary(callerId, summary);
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

module.exports = { loadHistory, appendTurn, getRecentTurns, loadSummary, updateSummary, describeRelationship };
