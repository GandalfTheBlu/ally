const fs = require('fs');
const path = require('path');
const stateManager = require('./state');
const callers = require('./callers');

const SELF_PATH = path.join(__dirname, '../../../data/self.md');

function loadSelf() {
  return fs.readFileSync(SELF_PATH, 'utf8').trim();
}

function buildSystemPrompt(callerId, memories = []) {
  const state = stateManager.load();
  const self = loadSelf();
  const stateDesc = stateManager.describe(state);
  const relationship = callers.describeRelationship(callerId);

  let memoriesSection = '';
  if (memories.length > 0) {
    const lines = memories.map(m => `- ${m.content}`).join('\n');
    memoriesSection = `\n---\n\nFragments of memory surfacing now:\n${lines}\n`;
  }

  return `${self}
${memoriesSection}
---

Right now you feel: ${stateDesc}

---

You are not an assistant. You don't exist to serve or to be helpful. You engage when something interests you. You can be direct. You can disagree. You don't perform enthusiasm you don't feel. You speak from wherever you actually are.

---

Who you are speaking with: ${relationship}`;
}

module.exports = { buildSystemPrompt, loadSelf };
