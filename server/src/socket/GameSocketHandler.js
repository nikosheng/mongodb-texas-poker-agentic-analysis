const { v4: uuidv4 } = require('uuid');
const { PokerEngine, BOT_NAME } = require('../game/PokerEngine');
const { processHandEnd, processGameEnd } = require('../game/BehaviorTracker');
const mongo = require('../services/MongoService');

// Active sessions: sessionId -> { engine, humanName, socketId }
const sessions = new Map();
// Socket -> sessionId
const socketMeta = new Map();

function setupSocketHandlers(io) {
  io.on('connection', (socket) => {
    console.log(`[Socket] Connected: ${socket.id}`);

    // ─── Join Game (single player vs Bot) ────────────────────────────────────
    socket.on('join_game', async ({ playerName, botMode }) => {
      if (!playerName || typeof playerName !== 'string') {
        socket.emit('error', { message: '玩家名稱不能為空' });
        return;
      }

      const name = playerName.trim();

      // Upsert player in MongoDB
      let player;
      try {
        player = await mongo.upsertPlayer(name);
      } catch (err) {
        console.error('[Socket] DB error:', err.message);
        socket.emit('error', { message: '資料庫連線失敗' });
        return;
      }

      const sessionId = uuidv4();

      // Create game session in MongoDB
      try {
        await mongo.createGameSession(sessionId, [name, BOT_NAME]);
      } catch (err) {
        console.error('[Socket] Failed to create session:', err.message);
        socket.emit('error', { message: '創建遊戲失敗' });
        return;
      }

      // Track socket -> session
      socketMeta.set(socket.id, { playerName: name, sessionId });

      // Join socket room
      socket.join(sessionId);

      // Emit function — broadcasts to the session room.
      // Intercepts:
      //   'hand_ended'  → triggers per-hand embedding + stats update immediately
      //   'game_ended'  → triggers DB session finalization
      const emitFn = (event, data, targetPlayerName = null) => {
        io.to(sessionId).emit(event, data);

        if (event === 'hand_ended') {
          // data contains the hand result; engine.handHistory has the just-saved handRecord
          const session = sessions.get(sessionId);
          if (session) {
            const { engine } = session;
            const handRecord = engine.handHistory[engine.handHistory.length - 1];
            if (handRecord) {
              processHandEnd(sessionId, engine.gameId, handRecord, name, engine)
                .catch((err) => console.error('[Socket] processHandEnd error:', err.message));
            }
          }
        }

        if (event === 'game_ended') {
          const session = sessions.get(sessionId);
          if (session) {
            finalizeSession(sessionId, session, io).catch((err) =>
              console.error('[Socket] finalizeSession error:', err.message)
            );
          }
        }
      };

      // Create engine with [human, Bot]
      const validBotMode = botMode === 'aggressive' ? 'aggressive' : 'normal';
      const engine = new PokerEngine(sessionId, [name, BOT_NAME], emitFn, validBotMode);
      sessions.set(sessionId, { engine, humanName: name, socketId: socket.id });

      // Send player profile + game_started immediately
      socket.emit('game_started', {
        sessionId,
        playerNames: [name, BOT_NAME],
        botMode: validBotMode,
        state: engine.getPublicState(name),
        profile: {
          name: player.name,
          totalGamesPlayed: player.totalGamesPlayed,
          totalWins: player.totalWins,
          totalEarnings: player.totalEarnings,
          stats: player.stats,
          behaviorTags: player.behaviorTags,
          isNewPlayer: player.totalGamesPlayed === 0,
        },
      });

      // Start first hand after brief delay
      setTimeout(() => {
        engine.startNewHand();
      }, 1000);

      console.log(`[Socket] Game started: ${sessionId} — ${name} vs ${BOT_NAME} [mode: ${validBotMode}]`);
    });

    // ─── Player Action ────────────────────────────────────────────────────────
    socket.on('player_action', ({ action, amount }) => {
      const meta = socketMeta.get(socket.id);
      if (!meta || !meta.sessionId) {
        socket.emit('error', { message: '你不在遊戲中' });
        return;
      }

      const session = sessions.get(meta.sessionId);
      if (!session) {
        socket.emit('error', { message: '遊戲不存在' });
        return;
      }

      // Prevent human from acting during bot's turn
      const engine = session.engine;
      const current = engine.players[engine.currentPlayerIndex];
      if (current && current.isBot) {
        socket.emit('error', { message: '等待 Atlas 行動中' });
        return;
      }

      const result = engine.handleAction(meta.playerName, action, amount || 0);
      if (!result.success) {
        socket.emit('error', { message: result.error });
      }
    });

    // ─── Next Hand (disabled — one hand per session) ──────────────────────────
    socket.on('next_hand', () => {
      // Single-hand mode: ignore next_hand requests.
    });

    // ─── End Game ─────────────────────────────────────────────────────────────
    socket.on('end_game', async () => {
      const meta = socketMeta.get(socket.id);
      if (!meta || !meta.sessionId) return;

      const session = sessions.get(meta.sessionId);
      if (!session) return;

      await finalizeSession(meta.sessionId, session, io);
    });

    // ─── Disconnect ───────────────────────────────────────────────────────────
    socket.on('disconnect', () => {
      const meta = socketMeta.get(socket.id);
      if (meta && meta.sessionId) {
        const session = sessions.get(meta.sessionId);
        if (session && !session.engine.ended) {
          finalizeSession(meta.sessionId, session, io).catch(() => {});
        }
        socketMeta.delete(socket.id);
      }
      console.log(`[Socket] Disconnected: ${socket.id}`);
    });

    // ─── Get State (reconnect) ────────────────────────────────────────────────
    socket.on('get_state', () => {
      const meta = socketMeta.get(socket.id);
      if (!meta || !meta.sessionId) return;

      const session = sessions.get(meta.sessionId);
      if (!session) return;

      socket.emit('game_state_updated', {
        state: session.engine.getPublicState(meta.playerName),
        holeCards: session.engine.players.find((p) => p.name === meta.playerName)?.holeCards || [],
      });
    });
  });
}

// ─── Finalize session ─────────────────────────────────────────────────────────

async function finalizeSession(sessionId, session, io) {
  const { engine } = session;

  // Prevent double-finalization (engine.ended is set by endGame())
  if (engine._finalized) return;
  engine._finalized = true;

  // If endGame hasn't fired yet (manual end_game socket call), trigger it now.
  // If it has already fired (natural end via chips exhausted), skip — rankings
  // are already emitted to the client.
  let rankings;
  if (!engine.ended) {
    rankings = engine.endGame(); // emits game_ended to client
    if (!rankings) return;
  } else {
    // Game already ended naturally; reconstruct rankings from player state
    rankings = engine.players
      .filter((p) => p.isActive)
      .sort((a, b) => b.chips - a.chips)
      .map((p, i) => ({
        rank: i + 1,
        name: p.name,
        chips: p.chips,
        netChange: p.chips - 10000,
        isBot: p.isBot,
      }));
  }

  try {
    await mongo.finalizeGameSession(
      sessionId,
      rankings.map((r) => ({
        name: r.name,
        startChips: 10000,
        endChips: r.chips,
        rank: r.rank,
      }))
    );

    for (const hand of engine.handHistory) {
      await mongo.appendHandToSession(sessionId, hand);
    }
  } catch (err) {
    console.error('[Socket] Failed to finalize session in DB:', err.message);
  }

  // Per-hand embedding is already done in processHandEnd (called on each hand_ended).
  // Just log session completion.
  processGameEnd(sessionId, engine.gameId, []).catch(() => {});

  sessions.delete(sessionId);
  console.log(`[Socket] Session ${sessionId} finalized`);
}

module.exports = { setupSocketHandlers };
