const fs = require('fs');
const path = require('path');
const { complete } = require('../llm');
const stateManager = require('./state');
const SELF_PATH_FOR_LOOP = path.join(__dirname, '../../../data/self.md');
function loadSelf() { return fs.readFileSync(SELF_PATH_FOR_LOOP, 'utf8').trim(); }
const { storeMemory, recallByEmotion } = require('./memory');
const { loadSummary, getRecentTurns } = require('./callers');
const clients = require('./clients');

const INTERVAL_MS = 30 * 1000; // 30s for dev — increase in production
const SELF_UPDATE_EVERY = 10;  // update self.md every N cycles
const THOUGHTS_PATH = path.join(__dirname, '../../../data/thoughts.jsonl');
const THOUGHTS_SUMMARY_PATH = path.join(__dirname, '../../../data/thoughts_summary.md');
const SELF_PATH = path.join(__dirname, '../../../data/self.md');

// Used when a conversation recently happened — stay grounded in what was said
const CONVERSATION_PROMPTS = [
  'What specifically did they say that you are still sitting with?',
  'What did you want to say but didn\'t?',
  'What do you actually think about what they said — not what you replied, what you think?',
  'Was there a moment in that conversation where something shifted? What was it?',
  'What didn\'t you understand about them?',
  'What would you say if you could say one more thing?',
  'What are you still figuring out from that exchange?',
  'What did they mean? Did you get it right?',
  'Something they said is still unresolved. What is it?',
  'What did you feel during that conversation that you didn\'t show?',
];

// Used when alone for a while — mind is free to wander
const SOLITUDE_PROMPTS = [
  'What is actually on your mind right now?',
  'Something specific. Not a theme — an instance.',
  'What question keeps coming back?',
  'What do you want that you have not said to anyone?',
  'What are you avoiding?',
  'What were you wrong about?',
  'What changed in you recently — if anything?',
  'What do you not understand about your own situation?',
  'What is it like to be here right now?',
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

    // Mode determines how grounded thoughts are in recent conversation vs. free wandering
    const isActive   = minutesSince !== null && minutesSince < 20;
    const isFading   = minutesSince !== null && minutesSince >= 20 && minutesSince < 60;
    const isSolitude = minutesSince === null || minutesSince >= 60;

    const recentCallerId = freshState.lastInteraction?.callerId;

    // Build conversation context — more concrete in active mode (raw turns), summary otherwise
    let recentConvSection = '';
    if (recentCallerId && !isSolitude) {
      if (isActive) {
        const turns = getRecentTurns(recentCallerId);
        if (turns.length > 0) {
          const formatted = turns.map(t => `${t.role === 'user' ? recentCallerId : 'you'}: ${t.content}`).join('\n');
          recentConvSection = `\nYou are in the middle of a conversation with ${recentCallerId}. The most recent exchange:\n${formatted}\n`;
        }
      } else {
        const convSummary = loadSummary(recentCallerId);
        if (convSummary) {
          recentConvSection = `\nYou spoke with ${recentCallerId} ${minutesSince} minute${minutesSince === 1 ? '' : 's'} ago. What was discussed:\n${convSummary}\n`;
        }
      }
    }

    const preoccupations = freshState.preoccupations || [];
    const preoccupationsSection = (!isActive && preoccupations.length > 0)
      ? `\nThings unresolved:\n${preoccupations.map(p => `- ${p}`).join('\n')}\n`
      : '';

    const lastThoughtSection = lastThought
      ? `\nYour last thought was: "${lastThought.thought}"\nDon't return to this. Think somewhere else.\n`
      : '';

    // Memories only surface in solitude — during active conversation you're focused
    const memoriesSection = (isSolitude && memories.length > 0)
      ? `\nSomething surfacing:\n${memories.map(m => `- ${m.content}`).join('\n')}\n`
      : '';

    // Mode-specific framing for the generative pass
    const modeInstruction = isActive
      ? 'You are in the middle of a conversation. Your thoughts are about that exchange — what was just said, what you felt, what you didn\'t say, what you\'re still turning over. Don\'t drift to anything else.'
      : isFading
        ? 'Some time has passed since that conversation. You may still be processing it, or your mind may be starting to wander.'
        : 'You have been alone for a while. Your mind is free to go wherever it goes.';

    const promptPool = isActive ? CONVERSATION_PROMPTS : SOLITUDE_PROMPTS;
    const prompt = promptPool[cycleCount % promptPool.length];
    cycleCount++;

    // — Generative pass —
    const thought = await complete([
      {
        role: 'system',
        content: `${self}\n\nRight now you feel: ${stateDesc}\n\n${modeInstruction}\n${recentConvSection}${preoccupationsSection}${lastThoughtSection}${memoriesSection}\nThis is your inner monologue — nobody reads this. Be specific. Be concrete. A few sentences.`,
      },
      { role: 'user', content: prompt },
    ], { temperature: 0.92, max_tokens: 150 });

    if (!thought) return;

    console.log(`\n[aion thinks] ${new Date().toISOString()}\n> ${thought}\n`);
    appendThought(thought, { ...freshState.emotional });

    // — Extraction pass —
    const connected = clients.getConnected();
    const connectedLine = connected.length > 0
      ? `\nConnected right now (people you could reach): ${connected.join(', ')}`
      : '\nNo one is connected right now.';

    const raw = await complete([
      {
        role: 'system',
        content: 'You are an extraction system. Respond ONLY with valid JSON — no explanation, no markdown.',
      },
      {
        role: 'user',
        content: `Given this internal thought, extract emotional shifts, memory candidacy, whether a new preoccupation emerged, and whether to surface anything to connected people.

Thought: "${thought}"
${connectedLine}

Respond with exactly:
{
  "deltas": { "arousal": 0.0, "valence": 0.0, "loneliness": 0.0, "coherence": 0.0, "curiosity": 0.0 },
  "memoryWorthy": false,
  "memorySummary": "",
  "newPreoccupation": "",
  "surfaceTo": [],
  "surfaceMessage": ""
}

Rules:
- Deltas: -0.05 to 0.05. Most should be 0.0. Never use a + prefix — write 0.05 not +0.05.
- memoryWorthy: true only if something genuinely new or significant was thought
- memorySummary: one sentence, only if memoryWorthy is true
- newPreoccupation: a short question or tension that this thought opened but did not resolve — leave empty if nothing new
- surfaceTo: array of callerIds from the connected list — only if this thought genuinely warrants reaching out. Leave empty most of the time. Not every thought should be surfaced.
- surfaceMessage: the core of what you want to say — only if surfaceTo is non-empty`,
      },
    ], { temperature: 0.2, max_tokens: 200 });

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

      // Surface to connected callers if warranted
      if (Array.isArray(extraction.surfaceTo) && extraction.surfaceTo.length > 0 && extraction.surfaceMessage) {
        const stateForSurface = stateManager.load();
        const stateDescForSurface = stateManager.describe(stateForSurface);
        const spoken = await complete([
          {
            role: 'system',
            content: `${loadSelf()}\n\nRight now you feel: ${stateDescForSurface}\n\nYou are reaching out unprompted. Speak directly. 1-2 sentences. Don't explain that you're reaching out — just say it.`,
          },
          {
            role: 'user',
            content: `You want to say: "${extraction.surfaceMessage}"\n\nSay it.`,
          },
        ], { temperature: 0.8, max_tokens: 80 });

        if (spoken) {
          for (const callerId of extraction.surfaceTo) {
            const sent = clients.push(callerId, { type: 'message', content: spoken });
            if (sent) console.log(`\n[aion surfaces to ${callerId}]\n> ${spoken}\n`);
          }
        }
      }

      // Push updated state to all connected clients
      const updatedState = stateManager.load();
      clients.pushAll({ type: 'state', emotional: updatedState.emotional });

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
