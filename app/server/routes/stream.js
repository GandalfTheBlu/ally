const express = require('express');
const router = express.Router();
const clients = require('../entity/clients');

// GET /api/stream/:callerId — SSE connection for push events
router.get('/:callerId', (req, res) => {
  const { callerId } = req.params;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  clients.register(callerId, res);

  const heartbeat = setInterval(() => {
    try {
      res.write('data: {"type":"ping"}\n\n');
    } catch {
      clearInterval(heartbeat);
    }
  }, 25000);

  req.on('close', () => {
    clearInterval(heartbeat);
    clients.unregister(callerId);
  });
});

module.exports = router;
