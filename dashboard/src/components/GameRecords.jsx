import { useEffect, useState } from 'react';
import { api } from '../api';

export default function GameRecords() {
  const [games, setGames] = useState([]);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getGames(30).then(setGames).catch(console.error).finally(() => setLoading(false));
  }, []);

  const loadDetail = async (g) => {
    setSelected(g.sessionId);
    const full = await api.getGame(g.sessionId);
    setDetail(full);
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="font-cinzel text-2xl font-bold text-white mb-1">遊戲記錄</h1>
        <p className="text-gray-400 text-sm">所有對局 · game_sessions collection</p>
      </div>

      <div className="flex gap-6">
        {/* List */}
        <div className="w-80 flex-shrink-0 space-y-2">
          {loading && [1,2,3].map(i => (
            <div key={i} className="card p-4 h-20 animate-pulse bg-white/5" />
          ))}
          {!loading && games.length === 0 && (
            <div className="card p-6 text-gray-500 text-center">尚無對局記錄</div>
          )}
          {games.map(g => (
            <button key={g.sessionId} onClick={() => loadDetail(g)}
              className={`w-full card p-4 text-left hover:border-mongo-green/40 transition-all
                ${selected === g.sessionId ? 'border-mongo-green/60 bg-mongo-green/10' : ''}`}>
              <div className="flex justify-between items-start mb-1">
                <span className="text-white text-sm font-medium truncate">
                  {(g.players || []).map(p => p.name).join(', ')}
                </span>
                <span className={`text-xs px-1.5 py-0.5 rounded border ml-2 flex-shrink-0
                  ${g.status === 'completed' ? 'text-green-300 border-green-700/40 bg-green-900/30' : 'text-yellow-300 border-yellow-700/40 bg-yellow-900/30'}`}>
                  {g.status === 'completed' ? '完成' : '進行中'}
                </span>
              </div>
              <div className="text-gray-500 text-xs">
                {new Date(g.startedAt).toLocaleString('zh-TW')}
              </div>
              <div className="text-gray-400 text-xs mt-1">
                {(g.hands || []).length} 手牌
              </div>
            </button>
          ))}
        </div>

        {/* Detail */}
        <div className="flex-1 min-w-0">
          {!detail ? (
            <div className="card p-12 text-center text-gray-500">點擊左側對局查看詳情</div>
          ) : (
            <div className="space-y-4">
              {/* Session header */}
              <div className="card p-5">
                <h3 className="font-cinzel text-white font-bold mb-3">對局詳情</h3>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    { label: '狀態', val: detail.status === 'completed' ? '已完成' : '進行中' },
                    { label: '手牌數', val: (detail.hands || []).length },
                    { label: '開始時間', val: new Date(detail.startedAt).toLocaleTimeString('zh-TW') },
                    { label: '結束時間', val: detail.endedAt ? new Date(detail.endedAt).toLocaleTimeString('zh-TW') : '-' },
                  ].map(({ label, val }) => (
                    <div key={label} className="bg-white/5 rounded-xl p-3 text-center">
                      <div className="text-white font-bold">{val}</div>
                      <div className="text-gray-500 text-xs mt-0.5">{label}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Players result */}
              <div className="card p-5">
                <h3 className="font-semibold text-white mb-3">玩家結果</h3>
                <div className="space-y-2">
                  {(detail.players || [])
                    .sort((a, b) => (b.endChips || 0) - (a.endChips || 0))
                    .map((p, i) => {
                      const net = (p.endChips || 0) - (p.startChips || 10000);
                      return (
                        <div key={p.name} className="flex items-center justify-between bg-white/5 rounded-xl px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold
                              ${i === 0 ? 'bg-yellow-400 text-black' : 'bg-white/10 text-white'}`}>{i + 1}</div>
                            <span className="text-white">{p.name}</span>
                          </div>
                          <div className="text-right">
                            <div className="text-gold font-bold font-cinzel">{(p.endChips || 0).toLocaleString()}</div>
                            <div className={`text-xs ${net >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                              {net >= 0 ? '+' : ''}{net}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* Hands */}
              {(detail.hands || []).length > 0 && (
                <div className="card p-5">
                  <h3 className="font-semibold text-white mb-3">手牌記錄</h3>
                  <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                    {detail.hands.map(hand => (
                      <div key={hand.handNumber} className="bg-white/5 rounded-xl p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-gray-400 text-sm">Hand #{hand.handNumber}</span>
                          <span className="text-mongo-green text-sm font-semibold">
                            贏家: {(hand.winners || []).join(', ')}
                          </span>
                        </div>
                        <div className="flex gap-1.5 flex-wrap">
                          {(hand.communityCards || []).map((c, ci) => (
                            <CardChip key={ci} code={c} />
                          ))}
                        </div>
                        <div className="text-gray-500 text-xs mt-2">
                          底池: {hand.potSize?.toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CardChip({ code }) {
  if (!code || code === 'XX') return null;
  const rank = code.slice(0, -1);
  const suit = code[code.length - 1];
  const isRed = suit === 'h' || suit === 'd';
  const suitSymbol = { s: '♠', h: '♥', d: '♦', c: '♣' }[suit] || suit;
  const rankLabel = { T: '10', J: 'J', Q: 'Q', K: 'K', A: 'A' }[rank] || rank;
  return (
    <span className={`inline-block bg-white rounded px-1.5 py-0.5 text-xs font-bold
      ${isRed ? 'text-red-600' : 'text-gray-900'}`}>
      {rankLabel}{suitSymbol}
    </span>
  );
}
