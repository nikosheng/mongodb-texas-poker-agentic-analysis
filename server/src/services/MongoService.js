const { MongoClient } = require('mongodb');

let db = null;
let client = null;

async function connect() {
  if (db) return db;
  client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  db = client.db(process.env.MONGODB_DB_NAME);
  console.log('[MongoDB] Connected to', process.env.MONGODB_DB_NAME);
  return db;
}

function getDb() {
  if (!db) throw new Error('MongoDB not connected. Call connect() first.');
  return db;
}

// ─── Players ────────────────────────────────────────────────────────────────

async function findPlayerByName(name) {
  const col = getDb().collection('players');
  return col.findOne({ name });
}

async function createPlayer(name) {
  const col = getDb().collection('players');
  const now = new Date();
  const player = {
    name,
    createdAt: now,
    lastSeenAt: now,
    totalGamesPlayed: 0,
    totalWins: 0,
    totalEarnings: 0,
    stats: {
      avgBetSize: 0,
      aggressionScore: 0,
      bluffRate: 0,
      foldRate: 0,
      callRate: 0,
      raiseRate: 0,
      vpip: 0,
      avgPotContribution: 0,
    },
    recentActions: [],
    behaviorTags: [],
  };
  await col.insertOne(player);
  return player;
}

async function upsertPlayer(name) {
  let player = await findPlayerByName(name);
  if (!player) {
    player = await createPlayer(name);
  } else {
    await getDb().collection('players').updateOne(
      { name },
      { $set: { lastSeenAt: new Date() } }
    );
  }
  return player;
}

async function updatePlayerStats(name, statsUpdate, newAction) {
  const col = getDb().collection('players');
  const update = {
    $set: { lastSeenAt: new Date(), ...statsUpdate },
  };
  if (newAction) {
    // Keep last 50 actions
    update.$push = {
      recentActions: {
        $each: [newAction],
        $slice: -50,
      },
    };
  }
  await col.updateOne({ name }, update);
}

async function getAllPlayers() {
  const col = getDb().collection('players');
  return col.find({}).sort({ lastSeenAt: -1 }).toArray();
}

// ─── Game Sessions ───────────────────────────────────────────────────────────

async function createGameSession(sessionId, playerNames) {
  const col = getDb().collection('game_sessions');
  const session = {
    sessionId,
    status: 'playing',
    startedAt: new Date(),
    endedAt: null,
    players: playerNames.map((name) => ({
      name,
      startChips: 10000,
      endChips: 10000,
      rank: null,
    })),
    hands: [],
  };
  await col.insertOne(session);
  return session;
}

async function appendHandToSession(sessionId, handRecord) {
  const col = getDb().collection('game_sessions');
  await col.updateOne(
    { sessionId },
    { $push: { hands: handRecord } }
  );
}

async function finalizeGameSession(sessionId, playerResults) {
  const col = getDb().collection('game_sessions');
  await col.updateOne(
    { sessionId },
    {
      $set: {
        status: 'completed',
        endedAt: new Date(),
        players: playerResults,
      },
    }
  );
}

async function getGameSession(sessionId) {
  const col = getDb().collection('game_sessions');
  return col.findOne({ sessionId });
}

async function getRecentSessions(limit = 20) {
  const col = getDb().collection('game_sessions');
  return col.find({}).sort({ startedAt: -1 }).limit(limit).toArray();
}

// ─── Player Actions (Vector Store) ──────────────────────────────────────────

async function savePlayerAction(actionDoc) {
  const col = getDb().collection('player_actions');
  await col.insertOne(actionDoc);
}

async function getPlayerActions(playerId, limit = 20) {
  const col = getDb().collection('player_actions');
  return col
    .find({ playerId })
    .sort({ timestamp: -1 })
    .limit(limit)
    .toArray();
}

async function vectorSearchPlayerActions(queryEmbedding, playerId, limit = 5) {
  const col = getDb().collection('player_actions');
  const pipeline = [
    {
      $vectorSearch: {
        index: 'player_actions_vector_index',
        path: 'embedding',
        queryVector: queryEmbedding,
        numCandidates: 50,
        limit,
        ...(playerId ? { filter: { playerId } } : {}),
      },
    },
    {
      $project: {
        _id: 0,
        playerId: 1,
        gameId: 1,
        behaviorSummary: 1,
        sessionStats: 1,
        timestamp: 1,
        score: { $meta: 'vectorSearchScore' },
      },
    },
  ];
  return col.aggregate(pipeline).toArray();
}

async function getPlayerAggregateStats(playerId) {
  const col = getDb().collection('player_actions');
  const pipeline = [
    { $match: { playerId } },
    {
      $group: {
        _id: '$playerId',
        totalSessions: { $sum: 1 },
        avgBetSize: { $avg: '$sessionStats.totalBet' },
        totalWins: {
          $sum: { $cond: ['$sessionStats.won', 1, 0] },
        },
        avgAggressiveActions: { $avg: '$sessionStats.aggressiveActions' },
        avgPassiveActions: { $avg: '$sessionStats.passiveActions' },
        avgFolds: { $avg: '$sessionStats.folds' },
        totalEarnings: { $sum: '$sessionStats.netChange' },
      },
    },
  ];
  const result = await col.aggregate(pipeline).toArray();
  return result[0] || null;
}

async function getPlayersByTag(tag) {
  return getDb().collection('players').find({ behaviorTags: tag }).toArray();
}

module.exports = {
  connect,
  getDb,
  findPlayerByName,
  createPlayer,
  upsertPlayer,
  updatePlayerStats,
  getAllPlayers,
  createGameSession,
  appendHandToSession,
  finalizeGameSession,
  getGameSession,
  getRecentSessions,
  savePlayerAction,
  getPlayerActions,
  vectorSearchPlayerActions,
  getPlayerAggregateStats,
  getPlayersByTag,
};
