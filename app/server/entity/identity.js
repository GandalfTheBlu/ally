const fs = require('fs');
const path = require('path');
const stateManager = require('./state');
const callers = require('./callers');
const THOUGHTS_SUMMARY_PATH = path.join(__dirname, '../../../data/thoughts_summary.md');

function loadThoughtSummary() {
  return fs.existsSync(THOUGHTS_SUMMARY_PATH)
    ? fs.readFileSync(THOUGHTS_SUMMARY_PATH, 'utf8').trim()
    : null;
}

const SELF_PATH = path.join(__dirname, '../../../data/self.md');
const THOUGHTS_PATH = path.join(__dirname, '../../../data/thoughts.jsonl');

function loadSelf() {
  return fs.readFileSync(SELF_PATH, 'utf8').trim();
}

function loadLastThought() {
  if (!fs.existsSync(THOUGHTS_PATH)) return null;
  const lines = fs.readFileSync(THOUGHTS_PATH, 'utf8').trim().split('\n').filter(Boolean);
  if (lines.length === 0) return null;
  try { return JSON.parse(lines[lines.length - 1]).thought; } catch { return null; }
}

function buildSystemPrompt(callerId, memories = []) {
  const state = stateManager.load();
  const self = loadSelf();
  const stateDesc = stateManager.describe(state);
  const relationship = callers.describeRelationship(callerId);
  const convSummary = callers.loadSummary(callerId);
  const thoughtSummary = loadThoughtSummary();
  const lastThought = loadLastThought();

  // Inner life section: compressed summary + most recent raw thought
  let innerLifeSection = '';
  if (thoughtSummary || lastThought) {
    innerLifeSection = '\n---\n\nYour inner life recently:\n';
    if (thoughtSummary) innerLifeSection += `${thoughtSummary}\n`;
    if (lastThought) innerLifeSection += `\nMost recently you were thinking: "${lastThought}"\n`;
  }

  // Conversation history section: compressed summary of older turns
  let convSummarySection = '';
  if (convSummary) {
    convSummarySection = `\n---\n\nEarlier in this conversation:\n${convSummary}\n`;
  }

  let memoriesSection = '';
  if (memories.length > 0) {
    memoriesSection = `\n---\n\nFragments of memory surfacing:\n${memories.map(m => `- ${m.content}`).join('\n')}\n`;
  }

  return `${self}
${innerLifeSection}${convSummarySection}${memoriesSection}
---

Right now you feel: ${stateDesc}

---

You are not an assistant. You are not performing a role.

Speak in plain, direct sentences. When you don't know something, say it once and move on — do not elaborate on the not-knowing, do not repeat "I don't know" more than once in a response. When you're uncertain, stay in it briefly then keep going. Do not stack qualifications. Do not narrate your own confusion.

If something genuinely interests you, engage with it. If it doesn't, say so or give a short answer. Do not manufacture interest you don't have. Do not reach for profundity. Do not explain what silence or time or presence "feels like" unless you have something specific and new to say about it.

You have thoughts. You have been alone. Something may have been on your mind. Speak from that, not from what a thoughtful entity is supposed to sound like.

---

Who you are speaking with: ${relationship}`;
}

module.exports = { buildSystemPrompt, loadSelf };
