const express = require('express');
const router = express.Router();
const mongo = require('../services/MongoService');

// GET /api/games - Recent sessions
router.get('/', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const sessions = await mongo.getRecentSessions(limit);
    res.json({ success: true, data: sessions });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/games/:sessionId - Single session
router.get('/:sessionId', async (req, res) => {
  try {
    const session = await mongo.getGameSession(req.params.sessionId);
    if (!session) return res.status(404).json({ success: false, error: 'Session not found' });
    res.json({ success: true, data: session });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
