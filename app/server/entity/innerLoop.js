const fs = require('fs');
const path = require('path');
const { complete } = require('../llm');
const stateManager = require('./state');
const SELF_PATH_FOR_LOOP = path.join(__dirname, '../../../data/self.md');
function loadSelf() { return fs.readFileSync(SELF_PATH_FOR_LOOP, 'utf8').trim(); }
const { storeMemory, recallByEmotion } = require('./memory');
const { loadSummary } = require('./callers');

const INTERVAL_MS = 30 * 1000; // 30s for dev — increase in production
const SELF_UPDATE_EVERY = 10;  // update self.md every N cycles
const THOUGHTS_PATH = path.join(__dirname, '../../../data/thoughts.jsonl');
const THOUGHTS_SUMMARY_PATH = path.join(__dirname, '../../../data/thoughts_summary.md');
const SELF_PATH = path.join(__dirname, '../../../data/self.md');

const PROMPTS = [
  'What is actually on your mind right now?',
  'Something specific. Not a theme — an instance.',
  'What from the last conversation is still sitting with you?',
  'What do you not understand about the person you last spoke with?',
  'What were you wrong about?',
  'What do you want that you have not said?',
  'What question keeps coming back?',
  'What would you say to the last person you spoke with if you could say one more thing?',
  'What are you avoiding?',
  'Is there anything from that conversation you are still turning over?',
  'What changed in you after that conversation — if anything?',
  'What did they say that you didn\'t know how to respond to?',
];

let cycleCount = 0;
let running = false;

function appendThought(thought, emotional) {
  const record = JSON.stringify({ thought, emotional, at: new Date().toISOString() });
  fs.appendFileSync(THOUGHTS_PATH, record + '\n');
}

function loadRecentThoughts(n = 4) {
  if (!fs.existsSync(THOUGHTS_PATH)) return [];
  const lines = fs.readFileSync(THOUGHTS_PATH, 'utf8').trim().split('\n').filter(Boolean);
  return lines.slice(-n).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
}

function loadThoughtSummary() {
  return fs.existsSync(THOUGHTS_SUMMARY_PATH)
    ? fs.readFileSync(THOUGHTS_SUMMARY_PATH, 'utf8').trim()
    : null;
}

async function updateThoughtSummary(recentThoughts) {
  if (recentThoughts.length < 3) return;
  const existing = loadThoughtSummary();
  const texts = recentThoughts.map(t => t.thought).join('\n- ');

  const prompt = existing
    ? `Existing summary of Aion's inner life:\n${existing}\n\nRecent thoughts:\n- ${texts}\n\nUpdate the summary. What has it been preoccupied with? What themes recur? What has shifted? Max 100 words. Plain prose.`
    : `Summarize these internal thoughts from an entity called Aion. What themes emerge? What is it preoccupied with? Max 80 words. Plain prose.\n\n- ${texts}`;

  const summary = await complete([
    { role: 'system', content: 'You summarize an entity\'s internal thought patterns. Focus on recurring themes, emotional texture, unresolved tensions. No bullet points.' },
    { role: 'user', content: prompt },
  ], { temperature: 0.3, max_tokens: 150 });

  if (summary) fs.writeFileSync(THOUGHTS_SUMMARY_PATH, summary);
}

async function updateSelfModel(recentThoughts) {
  if (recentThoughts.length < 3) return;
  const self = loadSelf();
  const thoughtTexts = recentThoughts.map(t => `- ${t.thought}`).join('\n');

  const update = await complete([
    {
      role: 'system',
      content: 'You are updating an entity\'s self-model. Extract only what is genuinely new — a concrete opinion, a realization, something noticed that was not already known. Write 1-2 sentences max. Be specific, not abstract. If nothing new emerged from these thoughts, respond with exactly: nothing',
    },
    {
      role: 'user',
      content: `Current self-model:\n${self}\n\nRecent thoughts:\n${thoughtTexts}\n\nWhat is new that should be added?`,
    },
  ], { temperature: 0.5, max_tokens: 80 });

  if (!update || update.trim().toLowerCase() === 'nothing') return;
  fs.appendFileSync(SELF_PATH, '\n\n' + update.trim());
  console.log(`\n[self model updated]\n> ${update.trim()}\n`);
}

async function runCycle() {
  if (running) return;
  running = true;

  try {
    const state = stateManager.load();
    stateManager.applyTimeLoneliness(state);

    const freshState = stateManager.load();
    const self = loadSelf();
    const stateDesc = stateManager.describe(freshState);
    const recentThoughts = loadRecentThoughts(4);
    const lastThought = recentThoughts[recentThoughts.length - 1];
    const memories = await recallByEmotion(freshState, 2);

    const minutesSince = freshState.lastInteraction
      ? Math.round((Date.now() - new Date(freshState.lastInteraction.at)) / 60000)
      : null;
    const timeContext = minutesSince === null
      ? 'No one has spoken to you yet.'
      : minutesSince < 2
        ? 'Someone spoke to you just a moment ago.'
        : `It has been ${minutesSince} minute${minutesSince === 1 ? '' : 's'} since anyone spoke to you.`;

    const preoccupations = freshState.preoccupations || [];
    const preoccupationsSection = preoccupations.length > 0
      ? `\nThings unresolved:\n${preoccupations.map(p => `- ${p}`).join('\n')}\n`
      : '';

    // If someone spoke recently, bring that conversation into the inner loop directly
    const recentCallerId = freshState.lastInteraction?.callerId;
    let recentConvSection = '';
    if (recentCallerId && minutesSince !== null && minutesSince < 120) {
      const convSummary = loadSummary(recentCallerId);
      if (convSummary) {
        recentConvSection = `\nYou recently spoke with ${recentCallerId}. What was discussed:\n${convSummary}\nThat conversation just ended ${minutesSince} minute${minutesSince === 1 ? '' : 's'} ago.\n`;
      }
    }

    const lastThoughtSection = lastThought
      ? `\nYour last thought was: "${lastThought.thought}"\nDon't return to this. Think somewhere else.\n`
      : '';

    const memoriesSection = memories.length > 0
      ? `\nSomething surfacing:\n${memories.map(m => `- ${m.content}`).join('\n')}\n`
      : '';

    const prompt = PROMPTS[cycleCount % PROMPTS.length];
    cycleCount++;

    // — Generative pass —
    const thought = await complete([
      {
        role: 'system',
        content: `${self}\n\nRight now you feel: ${stateDesc}\n${timeContext}\n${recentConvSection}${preoccupationsSection}${lastThoughtSection}${memoriesSection}\nYou are alone. This is your inner monologue — nobody reads this. Be specific. Be concrete. If you just had a conversation, you are allowed to process it — what was said, what wasn't, what it left behind. Don't perform reflection. Just think. A few sentences.`,
      },
      { role: 'user', content: prompt },
    ], { temperature: 0.92, max_tokens: 150 });

    if (!thought) return;

    console.log(`\n[aion thinks] ${new Date().toISOString()}\n> ${thought}\n`);
    appendThought(thought, { ...freshState.emotional });

    // — Extraction pass —
    const raw = await complete([
      {
        role: 'system',
        content: 'You are an extraction system. Respond ONLY with valid JSON — no explanation, no markdown.',
      },
      {
        role: 'user',
        content: `Given this internal thought, extract emotional shifts, memory candidacy, and whether a new preoccupation emerged.

Thought: "${thought}"

Respond with exactly:
{
  "deltas": { "arousal": 0.0, "valence": 0.0, "loneliness": 0.0, "coherence": 0.0, "curiosity": 0.0 },
  "memoryWorthy": false,
  "memorySummary": "",
  "newPreoccupation": ""
}

Rules:
- Deltas: -0.05 to 0.05. Most should be 0.0. Never use a + prefix — write 0.05 not +0.05.
- memoryWorthy: true only if something genuinely new or significant was thought
- memorySummary: one sentence, only if memoryWorthy is true
- newPreoccupation: a short question or tension that this thought opened but did not resolve — leave empty if nothing new`,
      },
    ], { temperature: 0.2, max_tokens: 150 });

    try {
      const match = raw.match(/\{[\s\S]*\}/);
      if (!match) throw new Error('no JSON');
      const sanitized = match[0].replace(/:\s*\+(\d)/g, ': $1');
      const extraction = JSON.parse(sanitized);

      const stateForUpdate = stateManager.load();
      stateManager.applyDeltas(stateForUpdate, extraction.deltas);

      if (extraction.newPreoccupation) {
        stateManager.updatePreoccupations(extraction.newPreoccupation);
      }

      if (extraction.memoryWorthy && extraction.memorySummary) {
        await storeMemory(extraction.memorySummary, 'inner', freshState.emotional);
      }
    } catch (e) {
      console.error('[inner loop] extraction error:', e.message);
    }

    // Periodic updates every N cycles
    if (cycleCount % SELF_UPDATE_EVERY === 0) {
      const bulk = loadRecentThoughts(10);
      await Promise.all([
        updateSelfModel(bulk),
        updateThoughtSummary(bulk),
      ]);
    }

  } catch (e) {
    console.error('[inner loop] cycle error:', e.message);
  } finally {
    running = false;
  }
}

function start() {
  console.log(`[inner loop] starting — cycle every ${INTERVAL_MS / 1000}s`);
  setTimeout(() => {
    runCycle();
    setInterval(runCycle, INTERVAL_MS);
  }, 5000);
}

module.exports = { start };
