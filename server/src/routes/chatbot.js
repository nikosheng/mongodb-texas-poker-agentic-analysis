const express = require('express');
const router = express.Router();
const { queryChatbot } = require('../services/ChatbotService');
const mongo = require('../services/MongoService');

// POST /api/chatbot/query
// Body: { question: string, playerName?: string }
router.post('/query', async (req, res) => {
  try {
    const { question, playerName } = req.body;
    if (!question || typeof question !== 'string') {
      return res.status(400).json({ success: false, error: '請提供查詢問題' });
    }

    const result = await queryChatbot(question.trim(), playerName || null);
    res.json({ success: true, data: result });
  } catch (err) {
    console.error('[Chatbot Route]', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/chatbot/players - Get all players for dropdown
router.get('/players', async (req, res) => {
  try {
    const players = await mongo.getAllPlayers();
    res.json({
      success: true,
      data: players.map((p) => ({
        name: p.name,
        totalGamesPlayed: p.totalGamesPlayed,
        behaviorTags: p.behaviorTags,
        stats: p.stats,
      })),
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
