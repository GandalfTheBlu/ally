const express = require('express');
const stateManager = require('../entity/state');

const router = express.Router();

router.get('/', (req, res) => {
  const state = stateManager.load();
  res.json({
    emotional: state.emotional,
    preoccupations: state.preoccupations,
    lastInteraction: state.lastInteraction,
    description: stateManager.describe(state),
  });
});

module.exports = router;
