import { useEffect, useState } from 'react';
import { api } from '../api';
import StatCard from './StatCard';
import PlayerBadge from './PlayerBadge';

export default function Overview({ onNavigate }) {
  const [players, setPlayers] = useState([]);
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.getPlayers(), api.getGames(5)])
      .then(([p, g]) => { setPlayers(p); setGames(g); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState />;

  const totalGames = games.length;
  const totalHandsPlayed = players.reduce((sum, p) => sum + (p.totalHandsPlayed || 0), 0);
  const highRollerPlayers = players.filter(p => (p.behaviorTags || []).includes('豪賭型')).length;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="font-cinzel text-2xl font-bold text-white mb-1">Marketing Overview</h1>
        <p className="text-gray-400 text-sm">玩家行為分析 · MongoDB Atlas Vector Search</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="總玩家數" value={players.length} icon="◉" color="green" sub="已記錄玩家" />
        <StatCard label="已玩局數" value={totalHandsPlayed} icon="♠" color="gold" sub="累計所有玩家對局" />
        <StatCard label="豪賭型玩家" value={highRollerPlayers} icon="🔥" color="red" sub="avgBetSize > 500 籌碼" />
        <StatCard label="近期對局" value={totalGames} icon="▦" color="blue" sub="最近 5 局" />
      </div>

      {/* Players table */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-white">玩家列表</h2>
          <button onClick={() => onNavigate('players')}
            className="text-mongo-green text-sm hover:underline">查看全部 →</button>
        </div>
        {players.length === 0 ? (
          <div className="text-gray-500 text-center py-8">尚無玩家資料，請先進行遊戲</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 border-b border-white/10">
                  <th className="text-left py-2 font-medium">玩家</th>
                  <th className="text-center py-2 font-medium">局數</th>
                  <th className="text-center py-2 font-medium">勝場</th>
                  <th className="text-center py-2 font-medium">激進度</th>
                  <th className="text-center py-2 font-medium">盈虧</th>
                  <th className="text-left py-2 font-medium">標籤</th>
                </tr>
              </thead>
              <tbody>
                {players.map(p => (
                  <tr key={p.name} className="border-b border-white/5 hover:bg-white/5 cursor-pointer"
                    onClick={() => onNavigate('players', p.name)}>
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-mongo-green/20 border border-mongo-green/40
                                        flex items-center justify-center text-mongo-green text-xs font-bold">
                          {p.name[0].toUpperCase()}
                        </div>
                        <span className="text-white font-medium">{p.name}</span>
                      </div>
                    </td>
                    <td className="py-3 text-center text-gray-300">{p.totalGamesPlayed}</td>
                    <td className="py-3 text-center text-gray-300">{p.totalWins}</td>
                    <td className="py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-16 h-1.5 bg-white/10 rounded-full overflow-hidden">
                          <div className="h-full bg-red-400 rounded-full"
                            style={{ width: `${(p.stats?.aggressionScore || 0) * 100}%` }} />
                        </div>
                        <span className="text-gray-400 text-xs">
                          {Math.round((p.stats?.aggressionScore || 0) * 100)}%
                        </span>
                      </div>
                    </td>
                    <td className={`py-3 text-center font-bold font-cinzel
                      ${(p.totalEarnings || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {(p.totalEarnings || 0) >= 0 ? '+' : ''}{p.totalEarnings || 0}
                    </td>
                    <td className="py-3">
                      <div className="flex flex-wrap gap-1">
                        {(p.behaviorTags || []).slice(0, 2).map(tag => (
                          <PlayerBadge key={tag} tag={tag} />
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recent games */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-white">近期對局</h2>
          <button onClick={() => onNavigate('games')}
            className="text-mongo-green text-sm hover:underline">查看全部 →</button>
        </div>
        {games.length === 0 ? (
          <div className="text-gray-500 text-center py-8">尚無對局記錄</div>
        ) : (
          <div className="space-y-2">
            {games.map(g => (
              <div key={g.sessionId} className="flex items-center justify-between bg-white/5 rounded-xl px-4 py-3">
                <div>
                  <div className="text-white text-sm font-medium">
                    {(g.players || []).map(p => p.name).join(' vs ')}
                  </div>
                  <div className="text-gray-500 text-xs">
                    {new Date(g.startedAt).toLocaleString('zh-TW')}
                  </div>
                </div>
                <div className="text-right">
                  <span className={`text-xs px-2 py-1 rounded-full border
                    ${g.status === 'completed' ? 'bg-green-900/40 text-green-300 border-green-700/40' : 'bg-yellow-900/40 text-yellow-300 border-yellow-700/40'}`}>
                    {g.status === 'completed' ? '已完成' : '進行中'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="p-6 space-y-4">
      {[1, 2, 3].map(i => (
        <div key={i} className="card p-5 h-24 animate-pulse bg-white/5" />
      ))}
    </div>
  );
}
