const mongo = require('../services/MongoService');
const { embed } = require('../services/EmbeddingService');
const { summarizePlayerBehavior } = require('../services/ChatbotService');

const ACTION_ZH = {
  fold: '棄牌',
  check: '過牌',
  call: '跟注',
  raise: '加注',
  'all-in': '全押',
  bet: '下注',
};

/**
 * Called immediately after each hand ends (when the showdown popup appears).
 * Processes the human player's actions for that hand:
 *   rawActions → LLM summary → Voyage-4 embed → saved to player_actions
 *   + updates players.stats, recentActions, behaviorTags
 *
 * @param {string} sessionId
 * @param {string} gameId
 * @param {object} handRecord  - the hand record just pushed into engine.handHistory
 * @param {string} humanName   - the human player's name (bot is skipped)
 * @param {object} engine      - PokerEngine instance (to read current chip counts)
 */
async function processHandEnd(sessionId, gameId, handRecord, humanName, engine) {
  const humanActions = (handRecord.actions && handRecord.actions[humanName]) || [];
  if (humanActions.length === 0) {
    // Human didn't act this hand (e.g. dealt in but timed-out immediately); skip
    return;
  }

  const humanPlayer = engine.players.find((p) => p.name === humanName);
  if (!humanPlayer) return;

  // We don't know the "start" chips for this individual hand precisely, but we
  // track cumulative chips. Use STARTING_CHIPS as base and current chips as end
  // for per-hand stats. Net change per hand = winners chip delta.
  const humanWon = handRecord.winners.includes(humanName);
  const humanHandStats = {
    startChips: 10000,           // session baseline
    endChips: humanPlayer.chips, // current chips after this hand
    netChange: humanPlayer.chips - 10000,
    won: humanWon,
    totalBet: humanActions.reduce((s, a) => s + (a.amount || 0), 0),
    aggressiveActions: humanActions.filter((a) => ['raise', 'bet', 'all-in'].includes(a.action)).length,
    passiveActions: humanActions.filter((a) => ['call', 'check'].includes(a.action)).length,
    folds: humanActions.filter((a) => a.action === 'fold').length,
    handsPlayed: 1,
    handNumber: handRecord.handNumber,
    winners: handRecord.winners,
    potSize: handRecord.potSize,
  };

  console.log(`[BehaviorTracker] Processing hand #${handRecord.handNumber} for ${humanName}`);

  try {
    await processPlayerBehavior(sessionId, gameId, {
      name: humanName,
      rawActions: humanActions,
      startChips: 10000,
      endChips: humanPlayer.chips,
    }, humanHandStats);
  } catch (err) {
    console.error(`[BehaviorTracker] processHandEnd error for ${humanName}:`, err.message);
  }
}

/**
 * Legacy: called at session end. Kept for backward compatibility but
 * now processHandEnd does the per-hand work. This function is a no-op.
 */
async function processGameEnd(sessionId, gameId, playerResults) {
  // Per-hand processing is now done in processHandEnd (called on each hand_ended).
  // Nothing to do here.
  console.log(`[BehaviorTracker] Session ${sessionId} finalized (per-hand embedding already done).`);
}

async function processPlayerBehavior(sessionId, gameId, playerData, handStats) {
  const { name, rawActions } = playerData;

  try {
    // Step 1: LLM summarize behavior
    let behaviorSummary;
    try {
      behaviorSummary = await summarizePlayerBehavior(name, rawActions, handStats);
    } catch (err) {
      console.error(`[BehaviorTracker] LLM summary failed for ${name}:`, err.message);
      behaviorSummary = generateRuleBasedSummary(name, rawActions, handStats);
    }

    // Step 2: Voyage-4 embed the summary
    let embedding;
    try {
      embedding = await embed(behaviorSummary);
    } catch (err) {
      console.error(`[BehaviorTracker] Embedding failed for ${name}:`, err.message);
      embedding = null;
    }

    // Step 3: Save to player_actions
    const actionDoc = {
      playerId: name,
      gameId,
      sessionId,
      timestamp: new Date(),
      rawActions,
      sessionStats: handStats,
      behaviorSummary,
      embedding,
    };
    await mongo.savePlayerAction(actionDoc);
    console.log(`[BehaviorTracker] Saved player_action for ${name} hand #${handStats.handNumber}: ${behaviorSummary.substring(0, 60)}...`);

    // Step 4: Update player profile stats + recentActions + behaviorTags
    await updatePlayerProfile(name, handStats, rawActions, gameId);

  } catch (err) {
    console.error(`[BehaviorTracker] Error processing ${name}:`, err.message);
  }
}

async function updatePlayerProfile(name, handStats, rawActions, gameId) {
  const player = await mongo.findPlayerByName(name);
  if (!player) return;

  // handsPlayed increments by 1 each hand (not by session games)
  const totalHandsPlayed = (player.totalHandsPlayed || 0) + 1;
  const totalWins = (player.totalWins || 0) + (handStats.won ? 1 : 0);
  // totalEarnings reflects cumulative net vs starting stack — store current chips delta
  // We overwrite with latest endChips - 10000 (absolute position in current session)
  // Better: track cumulative cross-session earnings
  const sessionNetChange = handStats.netChange;

  // Rolling averages over all hands ever played
  const prevStats = player.stats || {};

  // ── Aggression: bet escalation ratio ──────────────────────────────────────
  // For each raise/bet/all-in this hand, compute how much the player
  // escalated relative to the bet they were facing (prevLastBet).
  // ratio = amount / prevLastBet  (e.g. re-raise 600 over 200 → ratio 3.0)
  // When prevLastBet = 0 (first opener), use potSize as the base; if pot
  // is also 0 (very first action), fall back to BIG_BLIND (200).
  const aggressiveActions = rawActions.filter(
    (a) => ['raise', 'bet', 'all-in'].includes(a.action)
  );
  const escalationRatios = aggressiveActions.map((a) => {
    const base = (a.prevLastBet > 0)
      ? a.prevLastBet
      : (a.potSize > 0 ? a.potSize : 200);
    return a.amount / base;
  });
  const avgEscalation = escalationRatios.length > 0
    ? escalationRatios.reduce((s, r) => s + r, 0) / escalationRatios.length
    : 0;
  // tanh(x/3): ratio=3 → ~0.905; ratio=2 → ~0.756; ratio=1 → ~0.462; 0 → 0
  const aggressiveRate = Math.tanh(avgEscalation / 3);

  // ── Fold / call rates: normalise by total actions (0–1) ───────────────────
  const totalActions = rawActions.length;
  const foldRate  = totalActions > 0 ? handStats.folds           / totalActions : 0;
  const callRate  = totalActions > 0 ? handStats.passiveActions  / totalActions : 0;

  // Exponential moving average — alpha=0.4 lets each hand have meaningful weight
  const alpha = 0.4;
  const newAggressionScore = (prevStats.aggressionScore || 0) * (1 - alpha) + aggressiveRate * alpha;
  const newFoldRate = (prevStats.foldRate || 0) * (1 - alpha) + foldRate * alpha;
  const newCallRate = (prevStats.callRate || 0) * (1 - alpha) + callRate * alpha;
  const newAvgBetSize = (prevStats.avgBetSize || 0) * (1 - alpha) + handStats.totalBet * alpha;

  // Determine behavior tags based on updated stats
  const behaviorTags = [];
  if (newAggressionScore > 0.4) behaviorTags.push('激進型');
  else if (newAggressionScore < 0.15) behaviorTags.push('保守型');
  else behaviorTags.push('均衡型');
  if (newFoldRate > 0.5) behaviorTags.push('謹慎型');
  if (newAvgBetSize > 500) behaviorTags.push('豪賭型');
  if (totalHandsPlayed >= 30) behaviorTags.push('高頻玩家');
  if (totalHandsPlayed <= 5) behaviorTags.push('新玩家');

  const statsUpdate = {
    totalHandsPlayed,
    totalWins,
    behaviorTags,
    'stats.aggressionScore': parseFloat(newAggressionScore.toFixed(4)),
    'stats.foldRate': parseFloat(newFoldRate.toFixed(4)),
    'stats.callRate': parseFloat(newCallRate.toFixed(4)),
    'stats.avgBetSize': parseFloat(newAvgBetSize.toFixed(2)),
  };

  // Build recent action entries — one per action in this hand
  const recentActionEntry = rawActions.length > 0
    ? {
        gameId,
        handNumber: handStats.handNumber,
        actions: rawActions.map((a) => ({
          street: a.street,
          action: a.action,
          amount: a.amount || 0,
          handStrength: a.handStrength,
        })),
        won: handStats.won,
        potSize: handStats.potSize,
        timestamp: new Date(),
      }
    : null;

  await mongo.updatePlayerStats(name, statsUpdate, recentActionEntry);
  console.log(`[BehaviorTracker] Updated profile for ${name}: tags=${behaviorTags.join(',')}, aggrScore=${newAggressionScore.toFixed(3)}`);
}

/**
 * Fallback rule-based behavior summary when Azure OpenAI is not yet configured
 */
function generateRuleBasedSummary(name, rawActions, sessionStats) {
  const { aggressiveActions, passiveActions, folds, won, netChange, totalBet } = sessionStats;
  const total = rawActions.length;

  const aggrPct = total > 0 ? Math.round((aggressiveActions / total) * 100) : 0;
  const style = aggrPct > 60 ? '激進' : aggrPct > 30 ? '均衡' : '保守';
  const resultText = won
    ? `本局盈利 ${netChange} 籌碼`
    : `本局虧損 ${Math.abs(netChange)} 籌碼`;

  const raises = rawActions.filter((a) => a.action === 'raise' || a.action === 'bet');
  const strongRaises = raises.filter((a) => a.handStrength === 'strong');
  const weakRaises = raises.filter((a) => a.handStrength === 'weak');
  const bluffHint =
    weakRaises.length > 0 ? `有 ${weakRaises.length} 次在弱牌情況下主動下注，疑似 Bluff。` : '';

  return (
    `玩家 ${name} 在本局共執行 ${total} 次行動，` +
    `其中激進行動 ${aggressiveActions} 次、被動行動 ${passiveActions} 次、棄牌 ${folds} 次。` +
    `整體風格偏向${style}，投注總額 ${totalBet} 籌碼。` +
    (bluffHint ? bluffHint : '') +
    `${resultText}。`
  );
}

module.exports = { processHandEnd, processGameEnd };
