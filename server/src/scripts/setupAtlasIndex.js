/**
 * Atlas Vector Search Index Setup Script
 *
 * Run once after connecting to MongoDB Atlas:
 *   node src/scripts/setupAtlasIndex.js
 *
 * This creates the vector search index on player_actions.embedding
 * and a text search index on players.
 *
 * NOTE: Atlas Search/Vector Search indexes must be created via the
 * Atlas Data API or Atlas Admin API. The MongoDB driver createSearchIndex()
 * method requires MongoDB 7.0+ Atlas cluster.
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const { MongoClient } = require('mongodb');

async function run() {
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  console.log('[Setup] Connected to MongoDB Atlas');

  const db = client.db(process.env.MONGODB_DB_NAME);

  // ─── 1. Ensure collections exist ────────────────────────────────────────────
  const collections = await db.listCollections().toArray();
  const names = collections.map(c => c.name);

  for (const col of ['players', 'game_sessions', 'player_actions']) {
    if (!names.includes(col)) {
      await db.createCollection(col);
      console.log(`[Setup] Created collection: ${col}`);
    } else {
      console.log(`[Setup] Collection already exists: ${col}`);
    }
  }

  // ─── 2. Create regular indexes ───────────────────────────────────────────────
  await db.collection('players').createIndex({ name: 1 }, { unique: true });
  console.log('[Setup] Index: players.name (unique)');

  await db.collection('players').createIndex({ lastSeenAt: -1 });
  console.log('[Setup] Index: players.lastSeenAt');

  await db.collection('game_sessions').createIndex({ sessionId: 1 }, { unique: true });
  console.log('[Setup] Index: game_sessions.sessionId (unique)');

  await db.collection('game_sessions').createIndex({ startedAt: -1 });
  console.log('[Setup] Index: game_sessions.startedAt');

  await db.collection('player_actions').createIndex({ playerId: 1 });
  console.log('[Setup] Index: player_actions.playerId');

  await db.collection('player_actions').createIndex({ playerId: 1, timestamp: -1 });
  console.log('[Setup] Index: player_actions.playerId + timestamp');

  // ─── 3. Atlas Vector Search Index ───────────────────────────────────────────
  // This requires MongoDB Atlas cluster with Atlas Search enabled.
  // The index definition below is what you need to create in Atlas UI or via API.

  console.log('\n[Setup] ============================================');
  console.log('[Setup] IMPORTANT: Create Vector Search Index manually');
  console.log('[Setup] ============================================');
  console.log('[Setup] Go to: Atlas UI → Your Cluster → Search Indexes → Create Index');
  console.log('[Setup] Collection: texas_poker.player_actions');
  console.log('[Setup] Index name: player_actions_vector_index');
  console.log('[Setup] Index definition (JSON):');
  console.log(JSON.stringify({
    fields: [
      {
        type: 'vector',
        path: 'embedding',
        numDimensions: 1024,
        similarity: 'cosine',
      },
      {
        type: 'filter',
        path: 'playerId',
      },
      {
        type: 'filter',
        path: 'timestamp',
      },
    ],
  }, null, 2));

  // Try programmatic creation (requires Atlas + MongoDB driver 6.x+)
  try {
    const col = db.collection('player_actions');
    await col.createSearchIndex({
      name: 'player_actions_vector_index',
      type: 'vectorSearch',
      definition: {
        fields: [
          {
            type: 'vector',
            path: 'embedding',
            numDimensions: 1024,
            similarity: 'cosine',
          },
          {
            type: 'filter',
            path: 'playerId',
          },
          {
            type: 'filter',
            path: 'timestamp',
          },
        ],
      },
    });
    console.log('\n[Setup] Vector Search index created programmatically!');
  } catch (err) {
    console.log('\n[Setup] Programmatic index creation not supported on this tier.');
    console.log('[Setup] Please create the index manually via Atlas UI (definition above).');
    console.log(`[Setup] Error: ${err.message}`);
  }

  // ─── 4. Atlas Search Index for players (full-text) ──────────────────────────
  try {
    const col = db.collection('players');
    await col.createSearchIndex({
      name: 'players_search_index',
      definition: {
        mappings: {
          dynamic: false,
          fields: {
            name: { type: 'string' },
            behaviorTags: { type: 'string' },
            behaviorSummary: { type: 'string' },
          },
        },
      },
    });
    console.log('[Setup] Atlas Search index on players created!');
  } catch (err) {
    console.log('[Setup] Players search index skipped:', err.message);
  }

  console.log('\n[Setup] Done! Regular indexes created.');
  await client.close();
}

run().catch(err => {
  console.error('[Setup] Fatal error:', err);
  process.exit(1);
});
