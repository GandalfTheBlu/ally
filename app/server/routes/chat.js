const express = require('express');
const { streamChat } = require('../llm');
const { buildSystemPrompt } = require('../entity/identity');
const { getRecentTurns, appendTurn } = require('../entity/callers');
const { touch } = require('../entity/state');
const { recallMemories } = require('../entity/memory');
const { onExchange } = require('../entity/reflect');

const router = express.Router();

router.post('/', async (req, res) => {
  const { messages, callerId = 'user' } = req.body;

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages array required' });
  }

  const userMessage = messages[messages.length - 1];
  if (!userMessage || userMessage.role !== 'user') {
    return res.status(400).json({ error: 'last message must be from user' });
  }

  appendTurn(callerId, 'user', userMessage.content);
  touch(callerId);

  // Surface relevant memories before building the prompt
  const memories = await recallMemories(userMessage.content);
  const systemPrompt = buildSystemPrompt(callerId, memories);
  const recentHistory = getRecentTurns(callerId);

  const fullMessages = [
    { role: 'system', content: systemPrompt },
    ...recentHistory,
  ];

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  let fullResponse = '';

  await streamChat(
    fullMessages,
    (token) => {
      fullResponse += token;
      res.write(`data: ${JSON.stringify({ token })}\n\n`);
    },
    () => {
      res.write('data: [DONE]\n\n');
      res.end();

      if (fullResponse) {
        appendTurn(callerId, 'assistant', fullResponse);
        onExchange(callerId, userMessage.content, fullResponse).catch(console.error);
      }
    },
    (err) => {
      res.write(`data: ${JSON.stringify({ error: err })}\n\n`);
      res.end();
    }
  );
});

module.exports = router;
