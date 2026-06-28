import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { api } from '../api';

const QUICK_QUESTIONS = [
  '這個玩家是什麼類型？適合推什麼 offer？',
  '分析這個玩家的投注模式和風險偏好',
  '這個玩家有 Bluff 的傾向嗎？',
  '根據玩家行為推薦最合適的 VIP 優惠',
  '這個玩家的資金管理風格如何？',
];

export default function Chatbot() {
  const [players, setPlayers] = useState([]);
  const [selectedPlayer, setSelectedPlayer] = useState('');
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content:
        '你好！我是 MongoDB Atlas AI 行銷分析助手。\n\n' +
        '我可以根據玩家的德州撲克行為數據，分析其消費特性並推薦個性化 Offer。\n\n' +
        '請從右上角選擇玩家，然後提問。',
      sources: [],
      ts: Date.now(),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSources, setShowSources] = useState(null);
  const bottomRef = useRef(null);

  useEffect(() => {
    api.getChatbotPlayers().then(setPlayers).catch(console.error);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async (question) => {
    const q = question || input.trim();
    if (!q || loading) return;
    setInput('');

    // Add user message
    setMessages(prev => [...prev, { role: 'user', content: q, ts: Date.now() }]);
    setLoading(true);

    try {
      const result = await api.queryChatbot(q, selectedPlayer || null);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: result.answer,
        sources: result.sources || [],
        ts: Date.now(),
      }]);
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `查詢失敗：${err.message}`,
        sources: [],
        ts: Date.now(),
        isError: true,
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const clearChat = () => {
    setMessages([{
      role: 'assistant',
      content: '對話已重置。請選擇玩家並提問。',
      sources: [],
      ts: Date.now(),
    }]);
  };

  return (
    <div className="p-6 h-[calc(100vh-0px)] flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-start justify-between flex-shrink-0">
        <div>
          <h1 className="font-cinzel text-2xl font-bold text-white mb-1">AI Marketing Chatbot</h1>
          <p className="text-gray-400 text-sm">
            Atlas Vector Search · Voyage-4 Embedding · Azure OpenAI
          </p>
        </div>
        <button onClick={clearChat}
          className="text-gray-500 hover:text-white text-xs border border-gray-700 rounded-lg px-3 py-1.5 transition-colors">
          清除對話
        </button>
      </div>

      {/* Player selector + flow diagram */}
      <div className="card p-4 flex-shrink-0">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex-1 min-w-48">
            <label className="text-gray-400 text-xs mb-1.5 block">查詢玩家（可選）</label>
            <select
              value={selectedPlayer}
              onChange={e => setSelectedPlayer(e.target.value)}
              className="w-full bg-[#0d1f2d] border border-white/20 rounded-xl px-3 py-2 text-white
                         focus:outline-none focus:border-mongo-green text-sm"
            >
              <option value="">所有玩家</option>
              {players.map(p => (
                <option key={p.name} value={p.name}>
                  {p.name} {p.behaviorTags?.length ? `(${p.behaviorTags.join(', ')})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* RAG flow indicator */}
          {/* <div className="flex items-center gap-2 text-xs flex-wrap">
            {['提問向量化', 'Vector Search', '統計聚合', 'LLM 分析', '推薦 Offer'].map((step, i) => (
              <div key={step} className="flex items-center gap-1">
                <div className="bg-mongo-dark/60 border border-mongo-green/30 rounded-lg px-2.5 py-1.5 text-mongo-green">
                  {step}
                </div>
                {i < 4 && <span className="text-gray-600">→</span>}
              </div>
            ))}
          </div> */}
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 overflow-y-auto space-y-4 min-h-0 pr-1">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-2xl ${msg.role === 'user' ? 'order-2' : ''}`}>
              {/* Avatar */}
              <div className={`flex items-end gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0
                  ${msg.role === 'assistant' ? 'bg-mongo-green text-mongo-black' : 'bg-blue-600 text-white'}`}>
                  {msg.role === 'assistant' ? 'AI' : 'M'}
                </div>

                <div className={`rounded-2xl px-4 py-3 max-w-xl
                  ${msg.role === 'user'
                    ? 'bg-blue-700/60 border border-blue-600/40 text-white rounded-tr-sm'
                    : msg.isError
                      ? 'bg-red-900/40 border border-red-700/40 text-red-200 rounded-tl-sm'
                      : 'bg-[#1c2d38] border border-white/10 text-gray-100 rounded-tl-sm'
                  }`}>
                  {/* Message content — rendered as markdown via prose */}
                  <div className="prose prose-sm prose-invert max-w-none
                    prose-p:my-1 prose-p:leading-relaxed
                    prose-headings:text-white prose-headings:font-semibold prose-headings:my-1
                    prose-h1:text-base prose-h2:text-sm prose-h3:text-sm
                    prose-strong:text-white
                    prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5
                    prose-code:text-[#00ed64] prose-code:bg-black/30 prose-code:px-1 prose-code:rounded prose-code:before:content-none prose-code:after:content-none
                    prose-pre:bg-black/40 prose-pre:rounded-lg prose-pre:text-xs
                    prose-blockquote:border-l-[#00ed64] prose-blockquote:text-gray-300 prose-blockquote:not-italic
                    prose-hr:border-white/10
                    prose-a:text-[#00ed64] prose-a:no-underline hover:prose-a:underline">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>

                  {/* Sources */}
                  {msg.sources && msg.sources.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-white/10">
                      <button
                        onClick={() => setShowSources(showSources === i ? null : i)}
                        className="text-xs text-mongo-green hover:underline flex items-center gap-1"
                      >
                        <span>✦</span>
                        {showSources === i ? '收起' : `查看 ${msg.sources.length} 條向量搜索來源`}
                      </button>

                      {showSources === i && (
                        <div className="mt-2 space-y-2">
                          {msg.sources.map((src, si) => (
                            <div key={si} className="bg-black/30 rounded-xl p-3 border border-white/10">
                              <div className="flex justify-between text-xs text-gray-400 mb-1">
                                <span className="font-medium text-mongo-green">{src.playerId}</span>
                                <span>相似度: {((src.score || 0) * 100).toFixed(1)}%</span>
                              </div>
                              <p className="text-gray-300 text-xs leading-relaxed line-clamp-3">
                                {src.summary}
                              </p>
                              <div className="text-gray-600 text-xs mt-1">
                                {src.timestamp && new Date(src.timestamp).toLocaleString('zh-TW')}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="text-gray-600 text-xs mt-2 text-right">
                    {new Date(msg.ts).toLocaleTimeString('zh-TW')}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}

        {/* Loading indicator */}
        {loading && (
          <div className="flex justify-start">
            <div className="flex items-end gap-2">
              <div className="w-8 h-8 rounded-xl bg-mongo-green flex items-center justify-center text-sm font-bold text-mongo-black flex-shrink-0">
                AI
              </div>
              <div className="bg-[#1c2d38] border border-white/10 rounded-2xl rounded-tl-sm px-5 py-4">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    {[0,1,2].map(i => (
                      <div key={i} className="w-2 h-2 rounded-full bg-mongo-green animate-bounce"
                        style={{ animationDelay: `${i * 0.15}s` }} />
                    ))}
                  </div>
                  <span className="text-gray-400 text-xs">正在分析向量數據...</span>
                </div>
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Quick questions */}
      <div className="flex-shrink-0">
        <div className="flex gap-2 flex-wrap mb-3">
          {QUICK_QUESTIONS.map((q) => (
            <button
              key={q}
              onClick={() => send(q)}
              disabled={loading}
              className="text-xs bg-[#1c2d38] hover:bg-white/10 border border-white/10
                         hover:border-mongo-green/40 text-gray-300 hover:text-white
                         px-3 py-1.5 rounded-full transition-all disabled:opacity-40"
            >
              {q}
            </button>
          ))}
        </div>

        {/* Input */}
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder={`詢問${selectedPlayer ? ` ${selectedPlayer}` : '玩家'}的行為特性... (Enter 發送)`}
              rows={2}
              disabled={loading}
              className="w-full bg-[#1c2d38] border border-white/20 rounded-2xl px-4 py-3 text-white
                         placeholder-gray-600 text-sm resize-none focus:outline-none
                         focus:border-mongo-green transition-colors disabled:opacity-60"
            />
          </div>
          <button
            onClick={() => send()}
            disabled={!input.trim() || loading}
            className="bg-mongo-green hover:bg-mongo-green/80 disabled:opacity-40
                       text-mongo-black font-bold px-6 rounded-2xl transition-all
                       active:scale-95 flex items-center justify-center"
          >
            <span className="text-lg">↑</span>
          </button>
        </div>

        {/* Tech stack indicator */}
        <div className="flex items-center gap-3 mt-2 px-1">
          {[
            { label: 'Voyage-4', desc: '查詢向量化' },
            { label: 'Atlas Vector Search', desc: '語義搜索' },
            { label: 'Aggregation Pipeline', desc: '統計分析' },
            { label: 'Azure OpenAI', desc: 'GPT-4o 生成' },
          ].map(({ label, desc }) => (
            <div key={label} className="flex items-center gap-1 text-xs text-gray-600">
              <span className="text-mongo-green/60">●</span>
              <span>{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
