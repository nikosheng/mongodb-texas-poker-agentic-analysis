import { useEffect, useState } from 'react';
import { api } from '../api';
import PlayerBadge from './PlayerBadge';

const ACTION_ZH = {
  fold: '棄牌', check: '過牌', call: '跟注',
  raise: '加注', bet: '下注', 'all-in': '全押',
};
const STREET_ZH = {
  preflop: 'Preflop', flop: 'Flop', turn: 'Turn', river: 'River',
};

export default function PlayerAnalysis({ initialPlayer }) {
  const [players, setPlayers] = useState([]);
  const [selected, setSelected] = useState(initialPlayer || null);
  const [profile, setProfile] = useState(null);
  const [actions, setActions] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.getPlayers().then(setPlayers).catch(console.error);
  }, []);

  useEffect(() => {
    if (initialPlayer) setSelected(initialPlayer);
  }, [initialPlayer]);

  useEffect(() => {
    if (!selected) return;
    setLoading(true);
    Promise.all([
      api.getPlayer(selected),
      api.getPlayerActions(selected, 10),
      api.getPlayerStats(selected),
    ])
      .then(([p, a, s]) => { setProfile(p); setActions(a); setStats(s); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [selected]);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="font-cinzel text-2xl font-bold text-white mb-1">玩家分析</h1>
        <p className="text-gray-400 text-sm">行為模式 · 投注風格 · Offer 推薦依據</p>
      </div>

      {/* Player selector */}
      <div className="card p-4">
        <label className="text-gray-400 text-sm mb-2 block">選擇玩家</label>
        <select
          value={selected || ''}
          onChange={e => setSelected(e.target.value || null)}
          className="w-full bg-[#0d1f2d] border border-white/20 rounded-xl px-4 py-3 text-white
                     focus:outline-none focus:border-mongo-green"
        >
          <option value="">-- 選擇玩家 --</option>
          {players.map(p => (
            <option key={p.name} value={p.name}>{p.name}</option>
          ))}
        </select>
      </div>

      {loading && (
        <div className="space-y-4">
          {[1,2,3].map(i => <div key={i} className="card p-5 h-24 animate-pulse bg-white/5" />)}
        </div>
      )}

      {!loading && profile && (
        <>
          {/* Profile header */}
          <div className="card p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-mongo-green/20 border border-mongo-green/40
                                flex items-center justify-center text-mongo-green text-2xl font-bold">
                  {profile.name[0].toUpperCase()}
                </div>
                <div>
                  <h2 className="text-white text-xl font-bold font-cinzel">{profile.name}</h2>
                  <div className="text-gray-400 text-sm">
                    加入: {new Date(profile.createdAt).toLocaleDateString('zh-TW')} ·
                    最近: {new Date(profile.lastSeenAt).toLocaleDateString('zh-TW')}
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 justify-end">
                {(profile.behaviorTags || []).map(tag => <PlayerBadge key={tag} tag={tag} />)}
              </div>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: '總手數', val: profile.totalHandsPlayed || profile.totalGamesPlayed || 0, color: 'text-mongo-green' },
                { label: '勝場', val: profile.totalWins || 0, color: 'text-yellow-400' },
                { label: '總盈虧', val: `${(profile.totalEarnings || 0) >= 0 ? '+' : ''}${profile.totalEarnings || 0}`, color: (profile.totalEarnings || 0) >= 0 ? 'text-green-400' : 'text-red-400' },
                { label: '平均投注', val: Math.round(profile.stats?.avgBetSize || 0), color: 'text-blue-400' },
              ].map(({ label, val, color }) => (
                <div key={label} className="bg-white/5 rounded-xl p-4 text-center">
                  <div className={`text-2xl font-bold font-cinzel ${color}`}>{val}</div>
                  <div className="text-gray-400 text-xs mt-1">{label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Behavior bars */}
          <div className="card p-5">
            <h3 className="font-semibold text-white mb-4">行為指標</h3>
            <div className="space-y-4">
              {[
                { label: '激進度 (Aggression)', val: profile.stats?.aggressionScore || 0, color: 'bg-red-400', desc: '加注/下注佔總行動的比例' },
                { label: '棄牌率 (Fold Rate)', val: profile.stats?.foldRate || 0, color: 'bg-blue-400', desc: '主動放棄的頻率' },
                { label: '跟注率 (Call Rate)', val: profile.stats?.callRate || 0, color: 'bg-yellow-400', desc: '選擇跟注的頻率' },
              ].map(({ label, val, color, desc }) => (
                <div key={label}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-300">{label}</span>
                    <span className="text-white font-bold">{Math.round(val * 100)}%</span>
                  </div>
                  <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                    <div className={`h-full ${color} rounded-full transition-all duration-500`}
                      style={{ width: `${val * 100}%` }} />
                  </div>
                  <div className="text-gray-600 text-xs mt-1">{desc}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Offer recommendation */}
          <OfferRecommendation profile={profile} />

          {/* Behavior records (vector-stored summaries) */}
          <div className="card p-5">
            <h3 className="font-semibold text-white mb-4">
              行為記錄
              <span className="text-gray-500 text-xs ml-2 font-normal">（每局 LLM 匯總 + Voyage-4 向量化）</span>
            </h3>
            {actions.length === 0 ? (
              <div className="text-gray-500 text-center py-6">尚無行為記錄</div>
            ) : (
              <div className="space-y-3">
                {actions.map((a, i) => (
                  <div key={i} className="bg-white/5 rounded-xl p-4 border border-white/10">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-gray-400 text-xs">
                        {new Date(a.timestamp).toLocaleString('zh-TW')}
                      </span>
                      <div className="flex gap-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full border
                          ${a.sessionStats?.won ? 'bg-green-900/40 text-green-300 border-green-700/40' : 'bg-red-900/40 text-red-300 border-red-700/40'}`}>
                          {a.sessionStats?.won ? `+${a.sessionStats.netChange}` : `${a.sessionStats?.netChange || 0}`}
                        </span>
                        {a.embedding && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-purple-900/40 text-purple-300 border border-purple-700/40">
                            ✦ 已向量化
                          </span>
                        )}
                      </div>
                    </div>

                    {/* LLM Summary */}
                    <p className="text-gray-200 text-sm leading-relaxed mb-3">
                      {a.behaviorSummary}
                    </p>

                    {/* Raw actions mini table */}
                    {a.rawActions && a.rawActions.length > 0 && (
                      <div className="border-t border-white/10 pt-3">
                        <div className="text-gray-500 text-xs mb-2">原始行動記錄</div>
                        <div className="flex flex-wrap gap-1.5">
                          {a.rawActions.map((ra, ri) => (
                            <span key={ri}
                              className={`text-xs px-2 py-0.5 rounded border
                                ${ra.action === 'fold' ? 'bg-red-900/30 text-red-300 border-red-800/40' :
                                  ra.action === 'raise' || ra.action === 'bet' || ra.action === 'all-in'
                                    ? 'bg-orange-900/30 text-orange-300 border-orange-800/40'
                                    : 'bg-blue-900/30 text-blue-300 border-blue-800/40'}`}>
                              {STREET_ZH[ra.street]}: {ACTION_ZH[ra.action] || ra.action}
                              {ra.amount > 0 ? ` ${ra.amount}` : ''}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Session stats */}
                    {a.sessionStats && (
                      <div className="flex gap-4 mt-2 text-xs text-gray-500">
                        <span>激進: {a.sessionStats.aggressiveActions}</span>
                        <span>被動: {a.sessionStats.passiveActions}</span>
                        <span>棄牌: {a.sessionStats.folds}</span>
                        <span>投注: {a.sessionStats.totalBet}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {!loading && !profile && selected && (
        <div className="card p-8 text-center text-gray-500">找不到玩家資料</div>
      )}

      {!selected && (
        <div className="card p-12 text-center text-gray-500">
          請從上方選擇玩家進行分析
        </div>
      )}
    </div>
  );
}

function OfferRecommendation({ profile }) {
  // Use behaviorTags from DB (set by BehaviorTracker) as the single source of truth.
  // This avoids re-deriving player type with different thresholds and causing contradictions.
  const tags = profile.behaviorTags || [];
  const stats = profile.stats || {};
  const avgBet = stats.avgBetSize || 0;

  const offers = [];

  if (tags.includes('激進型')) {
    offers.push({ icon: '♠', title: '高額泥碼優惠', desc: '激進型玩家偏好高風險，推薦高額泥碼或 VIP 牌桌資格', color: 'border-red-500/40 bg-red-900/20' });
  }
  if (tags.includes('保守型') || tags.includes('謹慎型')) {
    offers.push({ icon: '🏨', title: '酒店房晚 / Spa', desc: '保守型玩家注重體驗，推薦豪華住宿或餐飲優惠', color: 'border-blue-500/40 bg-blue-900/20' });
  }
  if (tags.includes('均衡型')) {
    offers.push({ icon: '🎰', title: '泥碼 + 餐飲組合優惠', desc: '均衡型玩家風格多樣，適合搭配式組合 Offer 提升體驗', color: 'border-teal-500/40 bg-teal-900/20' });
  }
  if (tags.includes('豪賭型') || avgBet > 2000) {
    offers.push({ icon: '💎', title: '豪華套房 + 專屬服務', desc: '高額投注者，值得提供最高級別的 VIP 待遇', color: 'border-purple-500/40 bg-purple-900/20' });
  }
  if (tags.includes('高頻玩家')) {
    offers.push({ icon: '📱', title: '忠誠禮品（手機/電子產品）', desc: '高頻玩家忠誠度高，送出實物禮品加強黏性', color: 'border-yellow-500/40 bg-yellow-900/20' });
  }
  if (tags.includes('新玩家')) {
    offers.push({ icon: '🎁', title: '新手禮包', desc: '新玩家體驗期，贈送小額泥碼吸引回訪', color: 'border-green-500/40 bg-green-900/20' });
  }
  if (offers.length === 0) {
    offers.push({ icon: '◉', title: '標準會員優惠', desc: '根據玩家積累更多數據後可進行更精準推薦', color: 'border-gray-500/40 bg-gray-900/20' });
  }

  return (
    <div className="card p-5">
      <h3 className="font-semibold text-white mb-1">推薦 Offer</h3>
      <p className="text-gray-500 text-xs mb-4">基於行為標籤自動生成 · 可通過 AI Chatbot 獲取更詳細分析</p>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {offers.map((o, i) => (
          <div key={i} className={`rounded-xl p-4 border ${o.color}`}>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xl">{o.icon}</span>
              <span className="text-white font-semibold text-sm">{o.title}</span>
            </div>
            <p className="text-gray-400 text-xs">{o.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
