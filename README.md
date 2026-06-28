# MongoDB Texas Poker — AI Demo

1 對 1 德州撲克遊戲，展示 MongoDB Atlas AI 全套能力：Atlas Vector Search、Voyage-4 Embedding、Azure OpenAI RAG Chatbot、Aggregation Pipeline。

## 架構總覽

```
mongodb-texas-poker/
├── server/      Node.js + Express + Socket.io   :3001  後端 API
├── client/      React + Vite                    :5173  遊戲前端
└── dashboard/   React + Vite                    :5174  Marketing 管理後台
```

### 技術棧

| 層級 | 技術 |
|------|------|
| 後端 | Node.js 20、Express 5、Socket.io 4 |
| 前端 | React 18、Vite 5、Tailwind CSS 3、Framer Motion |
| 後台 | React 18、Vite 5、Tailwind CSS 3、Recharts、react-markdown |
| 資料庫 | MongoDB Atlas（Vector Search + Atlas Search） |
| AI | MongoDB-hosted Voyage-4（Embedding）、Azure OpenAI GPT（RAG + 行為摘要） |

---

## 快速啟動

### 前置條件

- Node.js >= 18
- MongoDB Atlas 帳戶（已建立 cluster，並開啟 Vector Search）
- Azure OpenAI 帳戶（已部署 Chat Completions 模型）

### 1. 安裝依賴

```bash
npm run install:all
```

### 2. 設定環境變數

建立 `server/.env`（參考以下範本）：

```env
# MongoDB Atlas
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/?appName=<appName>
MONGODB_DB_NAME=texas_poker

# MongoDB-hosted Voyage-4 Embedding
VOYAGE_API_KEY=<your-atlas-model-api-key>
VOYAGE_MODEL=voyage-4

# Azure OpenAI
AZURE_OPENAI_ENDPOINT=https://<your-resource>.cognitiveservices.azure.com/
AZURE_OPENAI_API_KEY=<your-azure-openai-api-key>
AZURE_OPENAI_API_VERSION=2024-12-01-preview
AZURE_OPENAI_DEPLOYMENT=<your-deployment-name>

# Server
PORT=3001
CLIENT_URL=http://localhost:5173
DASHBOARD_URL=http://localhost:5174
```

### 3. 建立 Atlas 索引

執行一次性腳本，自動建立 Atlas Vector Search 索引（1024 維、cosine）和 Atlas Search 全文索引：

```bash
npm run setup
```

### 4. 啟動所有服務

```bash
npm run dev
```

三個服務同時啟動：
- 遊戲前端：http://localhost:5173
- Marketing 後台：http://localhost:5174
- 後端 API：http://localhost:3001

---

## 功能介紹

### 遊戲前端（:5173）

**德州撲克核心**
- 1 人對戰 AI Bot（Atlas）
- 完整規則：Preflop → Flop → Turn → River → Showdown
- 手牌評估：10 種牌型、7 選 5 最佳組合、tiebreaker 邏輯
- 盲注：Small Blind 100 / Big Blind 200；起始籌碼 10,000
- 30 秒行動計時器，逾時自動 fold

**Bot AI（Atlas）**
- 激進模式（`aggro`）：
  - Pre-river（Preflop/Flop/Turn）：60% 機率加注 50–75% pot；facing bet 有 30% 再加注；其餘跟注；絕不 fold
  - River：50% 機率全押加注；facing bet 有 40% 全押再加注
  - Human 全押 → 永遠跟注
- 行動展示：右側浮動面板即時顯示 Atlas 最新動作（fold / check / call / raise / all-in）；持續顯示直到下一個動作

**UI**
- 牌桌背景：實際賭場桌面貼圖 + 半透明遮罩
- 卡牌：本地 PNG（53 張，含背面）
- 莊家按鈕（D）：每局依 dealer index 自動切換，顯示於對應玩家資訊框角落
- Showdown 疊加層：顯示雙方手牌與勝負結果，手動點擊「結束遊戲」才結束

### Marketing 管理後台（:5174）

**總覽（Overview）**
- 已玩局數、激進型玩家比例、總盈虧
- 玩家行為標籤分佈圓餅圖（Recharts）

**玩家分析（Player Analysis）**
- 每位玩家的 EMA 統計：aggressionScore、foldRate、callRate、avgBetSize
- 行為標籤（behaviorTags）：豪賭型、激進型、保守型、穩健型、新手
- 歷史行為記錄時間線

**遊戲記錄（Game Records）**
- 每局完整記錄：時間、參與玩家、結果、籌碼變化

**AI Chatbot（RAG）**
- 下拉選擇查詢對象：所有玩家 或 特定玩家
- 支援自然語言問句，例如：
  - 「幫我找出豪賭型的用戶」→ 直接查詢 `players.behaviorTags` 並列出符合玩家
  - 「這位玩家適合什麼 Offer？」→ 向量搜尋 + LLM 生成個性化推薦
- Markdown 渲染回應（react-markdown + @tailwindcss/typography prose 樣式）

---

## MongoDB Atlas 功能展示

| 功能 | 說明 | 觸發時機 |
|------|------|----------|
| **Atlas Vector Search** | 玩家行為語義搜索（1024 維、cosine） | Chatbot 每次查詢 |
| **Voyage-4 Embedding** | 行為摘要向量化（MongoDB-hosted endpoint） | 每局 Showdown 後立即執行 |
| **Azure OpenAI RAG** | 行為摘要生成 + Chatbot 個性化 Offer 推薦 | 每局結束後 + Chatbot 查詢 |
| **Aggregation Pipeline** | 玩家統計（$group、$avg、$sum、$cond） | 後台玩家分析頁面 |
| **Atlas Search** | 玩家全文搜索 | 玩家查詢 dropdown |

---

## Collections

| Collection | 說明 |
|-----------|------|
| `players` | 玩家檔案：籌碼歷史、EMA 統計（aggressionScore、foldRate、callRate、avgBetSize）、behaviorTags、最近 50 筆行動 |
| `game_sessions` | 每局完整記錄：開始/結束時間、玩家結果、手牌歷史 |
| `player_actions` | 每局每玩家：原始行動、統計、LLM 行為摘要（`behaviorSummary`）、1024 維向量（`embedding`） |

---

## 專案結構

```
server/src/
├── index.js                      Express + Socket.io 入口
├── routes/
│   ├── players.js                GET /api/players, /api/players/:name
│   ├── games.js                  GET /api/games
│   └── chatbot.js                POST /api/chatbot/query, GET /api/chatbot/players
├── services/
│   ├── MongoService.js           所有 MongoDB 操作（CRUD、vector search、aggregation）
│   ├── EmbeddingService.js       Voyage-4 Embedding（MongoDB-hosted endpoint）
│   └── ChatbotService.js         RAG Chatbot + LLM 行為摘要
├── socket/
│   └── GameSocketHandler.js      Socket.io 事件（join_game、player_action、end_game）
├── game/
│   ├── PokerEngine.js            德州撲克完整引擎（盲注、Bot AI、行動計時器）
│   ├── HandEvaluator.js          手牌評估（10 種牌型、7 選 5、tiebreaker）
│   ├── DeckManager.js            52 張牌 Fisher-Yates 洗牌
│   └── BehaviorTracker.js        局後行為分析（EMA 統計、標籤分類、embedding 存檔）
└── scripts/
    └── setupAtlasIndex.js        一次性建立 Atlas 索引

client/src/
├── App.jsx                       路由：Lobby ↔ 遊戲桌
├── hooks/
│   ├── useSocket.js              Socket.io 連線管理
│   └── useGame.js                遊戲狀態管理、botLastAction
└── components/game/
    ├── PokerTable.jsx            主牌桌畫面、Atlas 行動浮動面板
    ├── PlayerSeat.jsx            玩家座位（籌碼、手牌、莊家按鈕）
    ├── Card.jsx                  單張牌（PNG 圖片）
    ├── CommunityCards.jsx        公共牌區
    ├── BettingPanel.jsx          行動按鈕（fold/check/call/raise/all-in）
    └── GameLog.jsx               行動記錄

dashboard/src/
├── App.jsx                       側欄路由
├── api.js                        axios 封裝（/api/*）
└── components/
    ├── Overview.jsx              總覽統計與圖表
    ├── PlayerAnalysis.jsx        玩家深度分析
    ├── Chatbot.jsx               RAG Chatbot UI（Markdown 渲染）
    ├── GameRecords.jsx           遊戲記錄
    ├── PlayerBadge.jsx           行為標籤 Badge
    └── StatCard.jsx              統計數字卡片
```

---

## 可用 npm Scripts

| 指令 | 說明 |
|------|------|
| `npm run install:all` | 安裝 server、client、dashboard 所有依賴 |
| `npm run dev` | 同時啟動三個服務（需先完成 .env 設定） |
| `npm run dev:server` | 只啟動後端（nodemon 熱重載） |
| `npm run dev:client` | 只啟動遊戲前端 |
| `npm run dev:dashboard` | 只啟動 Marketing 後台 |
| `npm run setup` | 建立 Atlas Vector Search 與 Atlas Search 索引（僅需執行一次） |
