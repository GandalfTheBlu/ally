const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();
const THOUGHTS_PATH = path.join(__dirname, '../../../data/thoughts.jsonl');

router.get('/', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);

  if (!fs.existsSync(THOUGHTS_PATH)) {
    return res.json({ thoughts: [] });
  }

  const lines = fs.readFileSync(THOUGHTS_PATH, 'utf8')
    .trim().split('\n').filter(Boolean);

  const thoughts = lines
    .slice(-limit)
    .map(l => { try { return JSON.parse(l); } catch { return null; } })
    .filter(Boolean)
    .reverse(); // most recent first

  res.json({ thoughts });
});

module.exports = router;
