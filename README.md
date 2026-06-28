# MongoDB Texas Poker — AI Demo

多人德州撲克遊戲，展示 MongoDB Atlas AI 能力：Vector Search、Voyage-4 Embedding、Azure OpenAI RAG。

## 架構

```
client  (React + Vite)  :5173  — 遊戲前端
dashboard (React + Vite) :5174  — Marketing 管理後台
server  (Node.js + Express) :3001  — 後端 API + Socket.io
```

## 快速啟動

### 1. 安裝依賴

```bash
npm run install:all
```

### 2. 設定 .env

編輯 `server/.env`，填入 Azure OpenAI 設定：

```env
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com
AZURE_OPENAI_API_KEY=your-api-key
AZURE_OPENAI_DEPLOYMENT=gpt-4o
AZURE_OPENAI_API_VERSION=2024-02-01
```

### 3. 初始化 MongoDB 索引

```bash
npm run setup
```

### 4. 啟動所有服務

```bash
npm run dev
```

開啟：
- 遊戲: http://localhost:5173
- 後台: http://localhost:5174

---

## MongoDB 展示功能

| 功能 | 說明 |
|------|------|
| **Atlas Vector Search** | 玩家行為語義搜索 |
| **Voyage-4 Embedding** | 每局結束後向量化行為摘要 |
| **Azure OpenAI** | 局後行為匯總 + Chatbot RAG 分析 |
| **Aggregation Pipeline** | 玩家統計數據分析 |
| **Atlas Search** | 玩家全文搜索 |

## 遊戲流程

1. 玩家輸入名字（唯一 ID）→ 載入/創建 MongoDB 玩家檔案
2. 2–5 人就位後房主開始遊戲
3. 德州撲克：Preflop → Flop → Turn → River → Showdown
4. 每局結束：Azure OpenAI 匯總行為 → Voyage-4 向量化 → 存入 Atlas
5. Marketing Dashboard 可查詢玩家特性並獲取 AI Offer 推薦

## Collections

- `players` — 玩家檔案和累積統計
- `game_sessions` — 每局完整記錄
- `player_actions` — 每局行為摘要 + 1024 維向量
