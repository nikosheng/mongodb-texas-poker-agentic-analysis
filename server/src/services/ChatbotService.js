const axios = require('axios');
const { embed } = require('./EmbeddingService');
const mongo = require('./MongoService');

// ─── Azure OpenAI client ─────────────────────────────────────────────────────

async function callAzureOpenAI(messages, maxTokens = 1000) {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const apiKey = process.env.AZURE_OPENAI_API_KEY;
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o';
  const apiVersion = process.env.AZURE_OPENAI_API_VERSION || '2024-02-01';

  if (!endpoint || !apiKey) {
    // Placeholder: Azure OpenAI not yet configured
    return '[Azure OpenAI 尚未設定，請在 .env 填入 AZURE_OPENAI_ENDPOINT 和 AZURE_OPENAI_API_KEY]';
  }

  const url = `${endpoint}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`;

  const response = await axios.post(
    url,
    {
      messages,
      max_completion_tokens: maxTokens,
      temperature: 0.7,
    },
    {
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json',
      },
      timeout: 60000,
    }
  );

  return response.data.choices[0].message.content;
}

// ─── Behavior Summary (LLM) ──────────────────────────────────────────────────

/**
 * Use Azure OpenAI to summarize a player's behavior for one game session
 * Called after each game ends, once per player
 */
async function summarizePlayerBehavior(playerName, rawActions, sessionStats) {
  const actionLines = rawActions
    .map(
      (a) =>
        `  - ${a.street.toUpperCase()}: ${a.action}${a.amount > 0 ? ` ${a.amount} 籌碼` : ''}（手牌強度：${translateStrength(a.handStrength)}）`
    )
    .join('\n');

  const resultText = sessionStats.won
    ? `贏得 ${sessionStats.netChange} 籌碼`
    : `損失 ${Math.abs(sessionStats.netChange)} 籌碼`;

  const messages = [
    {
      role: 'system',
      content:
        '你是一個德州撲克行為分析師。請根據玩家的行為數據，生成一段簡潔的中文行為描述（150字以內）。' +
        '重點描述：投注模式、資金管理風格、Bluff 傾向、風險偏好。語氣客觀專業。',
    },
    {
      role: 'user',
      content:
        `玩家名稱：${playerName}\n` +
        `本局行為：\n${actionLines}\n` +
        `本局結果：${resultText}\n` +
        `本局統計：激進行動 ${sessionStats.aggressiveActions} 次，被動行動 ${sessionStats.passiveActions} 次，棄牌 ${sessionStats.folds} 次`,
    },
  ];

  const summary = await callAzureOpenAI(messages, 300);
  return summary;
}

// ─── Marketing Chatbot RAG ───────────────────────────────────────────────────

/**
 * Main chatbot query: given a user question, do RAG and return analysis + offer
 */
async function queryChatbot(question, targetPlayerName = null) {
  // Step 1: Embed the question
  let queryEmbedding;
  try {
    queryEmbedding = await embed(question);
  } catch (err) {
    console.error('[Chatbot] Embedding failed:', err.message);
    return { answer: '向量化查詢失敗，請稍後再試。', sources: [] };
  }

  // Step 2: Vector search for relevant behavior records
  const vectorResults = await mongo.vectorSearchPlayerActions(
    queryEmbedding,
    targetPlayerName,
    5
  );

  // Step 3: Get aggregate stats / tag-based player list for context
  let playerStats = null;
  let playerProfile = null;
  let taggedPlayers = [];

  if (targetPlayerName) {
    playerStats = await mongo.getPlayerAggregateStats(targetPlayerName);
    playerProfile = await mongo.findPlayerByName(targetPlayerName);
  } else {
    // 所有玩家模式：偵測問句中的 behaviorTag 關鍵字，直接查 players collection
    const TAG_KEYWORDS = [
      '豪賭型', '激進型', '保守型', '新手', '高頻', '穩健型',
    ];
    const detectedTag = TAG_KEYWORDS.find((t) => question.includes(t));
    if (detectedTag) {
      taggedPlayers = await mongo.getPlayersByTag(detectedTag);
    }
  }

  // Step 4: Build context
  const behaviorContext = vectorResults.length > 0
    ? vectorResults
        .map(
          (r, i) =>
            `[行為記錄 ${i + 1}] 玩家: ${r.playerId} | 時間: ${new Date(r.timestamp).toLocaleString('zh-TW')}\n${r.behaviorSummary}`
        )
        .join('\n\n')
    : '暫無相關行為記錄';

  const statsContext = playerStats
    ? `統計數據（共 ${playerStats.totalSessions} 局）：
- 平均投注：${Math.round(playerStats.avgBetSize || 0)} 籌碼
- 勝率：${playerStats.totalSessions > 0 ? Math.round((playerStats.totalWins / playerStats.totalSessions) * 100) : 0}%
- 平均激進行動次數：${Math.round(playerStats.avgAggressiveActions || 0)}
- 平均被動行動次數：${Math.round(playerStats.avgPassiveActions || 0)}
- 平均棄牌次數：${Math.round(playerStats.avgFolds || 0)}
- 總盈虧：${playerStats.totalEarnings > 0 ? '+' : ''}${playerStats.totalEarnings} 籌碼`
    : '';

  const profileContext = playerProfile
    ? `玩家標籤：${(playerProfile.behaviorTags || []).join('、') || '待分析'}
激進度評分：${((playerProfile.stats?.aggressionScore || 0) * 100).toFixed(0)}%`
    : '';

  const taggedContext = taggedPlayers.length > 0
    ? `=== 符合條件的玩家列表 ===\n` +
      taggedPlayers
        .map((p) =>
          `玩家：${p.playerName || p._id} | 標籤：${(p.behaviorTags || []).join('、')} | ` +
          `激進度：${((p.stats?.aggressionScore || 0) * 100).toFixed(0)}% | ` +
          `已玩局數：${p.totalHandsPlayed || 0} | ` +
          `勝率：${p.totalHandsPlayed > 0 ? Math.round(((p.totalWins || 0) / p.totalHandsPlayed) * 100) : 0}%`
        )
        .join('\n')
    : taggedPlayers.length === 0 && !targetPlayerName && ['豪賭型', '激進型', '保守型', '新手', '高頻', '穩健型'].some((t) => question.includes(t))
      ? '=== 符合條件的玩家列表 ===\n（目前資料庫中尚無此標籤的玩家）'
      : '';

  // Step 5: Call Azure OpenAI
  const messages = [
    {
      role: 'system',
      content:
        '你是一個賭場 Marketing 分析師，專門根據玩家的德州撲克行為分析其消費特性，並推薦個性化的 Offer。\n\n' +
        'Offer 類型參考：\n' +
        '- 激進型玩家（aggressionScore > 0.6）→ 高額泥碼優惠、VIP 牌桌資格\n' +
        '- 保守型玩家（foldRate > 0.5）→ 酒店房晚、餐飲優惠、Spa 體驗\n' +
        '- 高頻玩家（totalSessions > 10）→ 忠誠度禮品、最新手機\n' +
        '- 豪賭型（avgBetSize > 2000）→ 豪華套房、專屬服務\n' +
        '- 新玩家（totalSessions < 3）→ 新手禮包、小額泥碼體驗\n\n' +
        '請用繁體中文回覆，格式包含：玩家類型分析、推薦 Offer 及理由。',
    },
    {
      role: 'user',
      content:
        `問題：${question}\n\n` +
        (taggedContext ? `${taggedContext}\n\n` : '') +
        `=== 玩家行為記錄（向量搜索結果）===\n${behaviorContext}\n\n` +
        (statsContext ? `=== 統計數據 ===\n${statsContext}\n\n` : '') +
        (profileContext ? `=== 玩家概況 ===\n${profileContext}\n` : ''),
    },
  ];

  const answer = await callAzureOpenAI(messages, 800);

  return {
    answer,
    sources: vectorResults.map((r) => ({
      playerId: r.playerId,
      summary: r.behaviorSummary,
      score: r.score,
      timestamp: r.timestamp,
    })),
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function translateStrength(strength) {
  const map = { strong: '強牌', medium: '中等牌', weak: '弱牌' };
  return map[strength] || strength;
}

module.exports = { summarizePlayerBehavior, queryChatbot, callAzureOpenAI };
