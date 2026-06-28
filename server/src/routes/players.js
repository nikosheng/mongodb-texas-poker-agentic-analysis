const express = require('express');
const router = express.Router();
const mongo = require('../services/MongoService');

// GET /api/players - Get all players
router.get('/', async (req, res) => {
  try {
    const players = await mongo.getAllPlayers();
    res.json({ success: true, data: players });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/players/:name - Get player by name
router.get('/:name', async (req, res) => {
  try {
    const player = await mongo.findPlayerByName(req.params.name);
    if (!player) return res.status(404).json({ success: false, error: 'Player not found' });
    res.json({ success: true, data: player });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/players/:name/actions - Get player behavior records
router.get('/:name/actions', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const actions = await mongo.getPlayerActions(req.params.name, limit);
    res.json({ success: true, data: actions });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/players/:name/stats - Aggregated stats from player_actions
router.get('/:name/stats', async (req, res) => {
  try {
    const stats = await mongo.getPlayerAggregateStats(req.params.name);
    const profile = await mongo.findPlayerByName(req.params.name);
    res.json({ success: true, data: { stats, profile } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
