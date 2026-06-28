import { useState } from 'react';

export default function PlayerLogin({ onJoin }) {
  const [name, setName] = useState('');
  const [botMode, setBotMode] = useState('normal');
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setLoading(true);
    onJoin(trimmed, botMode);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a1f10]">
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-5"
        style={{ backgroundImage: 'repeating-linear-gradient(45deg, #d4af37 0, #d4af37 1px, transparent 0, transparent 50%)', backgroundSize: '20px 20px' }} />

      <div className="relative z-10 w-full max-w-md px-6">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-3 mb-4">
            <img src="https://www.mongodb.com/assets/images/global/favicon.ico" alt="" className="w-8 h-8" onError={(e) => e.target.style.display='none'} />
            <span className="font-cinzel text-gold text-sm tracking-widest uppercase">MongoDB</span>
          </div>
          <h1 className="font-cinzel text-5xl font-black text-gold mb-2 drop-shadow-lg">
            Texas Poker
          </h1>
          <p className="text-gray-400 text-sm tracking-wide">Powered by MongoDB Atlas AI</p>
        </div>

        {/* Card */}
        <div className="bg-[#0f2d18] border border-gold/30 rounded-2xl p-8 shadow-2xl">
          <h2 className="font-cinzel text-xl text-white text-center mb-2">
            輸入你的名字
          </h2>
          <p className="text-gray-500 text-sm text-center mb-6">
            你將對戰 AI 機器人 <span className="text-purple-300 font-semibold">Atlas</span>
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Name input */}
            <div>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="玩家名稱（作為唯一 ID）"
                maxLength={20}
                disabled={loading}
                className="w-full bg-[#1a3d24] border border-gold/40 rounded-xl px-4 py-3.5
                           text-white placeholder-gray-500 text-lg focus:outline-none
                           focus:border-gold focus:ring-1 focus:ring-gold/50
                           disabled:opacity-50 transition-all"
                autoFocus
              />
              <p className="text-gray-500 text-xs mt-2 text-center">
                相同名字可延續歷史紀錄
              </p>
            </div>

            {/* Bot mode selector */}
            <div>
              <p className="text-gray-400 text-xs text-center mb-3 uppercase tracking-widest font-cinzel">
                Atlas 模式
              </p>
              <div className="grid grid-cols-2 gap-3">
                {/* Normal mode */}
                <button
                  type="button"
                  onClick={() => setBotMode('normal')}
                  className={`relative flex flex-col items-center gap-1.5 rounded-xl border-2 px-4 py-3.5
                              transition-all duration-200
                              ${botMode === 'normal'
                                ? 'border-blue-400 bg-blue-900/30 shadow-[0_0_12px_rgba(96,165,250,0.3)]'
                                : 'border-white/15 bg-black/20 hover:border-white/30'}`}
                >
                  {botMode === 'normal' && (
                    <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-blue-400" />
                  )}
                  <span className="text-xl">🎯</span>
                  <span className={`font-cinzel font-bold text-sm ${botMode === 'normal' ? 'text-blue-300' : 'text-gray-300'}`}>
                    正常模式
                  </span>
                  <span className="text-gray-500 text-xs text-center leading-snug">
                    策略性決策<br />偶爾棄牌
                  </span>
                </button>

                {/* Aggressive mode */}
                <button
                  type="button"
                  onClick={() => setBotMode('aggressive')}
                  className={`relative flex flex-col items-center gap-1.5 rounded-xl border-2 px-4 py-3.5
                              transition-all duration-200
                              ${botMode === 'aggressive'
                                ? 'border-red-500 bg-red-900/30 shadow-[0_0_12px_rgba(239,68,68,0.35)]'
                                : 'border-white/15 bg-black/20 hover:border-white/30'}`}
                >
                  {botMode === 'aggressive' && (
                    <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-red-400 animate-pulse" />
                  )}
                  <span className="text-xl">🔥</span>
                  <span className={`font-cinzel font-bold text-sm ${botMode === 'aggressive' ? 'text-red-400' : 'text-gray-300'}`}>
                    激進模式
                  </span>
                  <span className="text-gray-500 text-xs text-center leading-snug">
                    跟注所有加注<br />含人類 All-in
                  </span>
                </button>
              </div>

              {botMode === 'aggressive' && (
                <p className="text-red-400/80 text-xs text-center mt-2">
                  ⚠ Atlas 將永不棄牌，無論下注多大
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={!name.trim() || loading}
              className="w-full bg-gold hover:bg-gold-light disabled:opacity-40
                         text-black font-bold text-lg py-3.5 rounded-xl
                         transition-all duration-200 active:scale-95 font-cinzel
                         shadow-lg shadow-gold/20"
            >
              {loading ? '連接中...' : '開始遊戲'}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-white/10">
            <div className="flex justify-around text-center">
              {[['1 vs 1', '對戰模式'], ['10,000', '起始籌碼'], ['100/200', '盲注']].map(([val, label]) => (
                <div key={label}>
                  <div className="text-gold font-bold text-lg font-cinzel">{val}</div>
                  <div className="text-gray-500 text-xs">{label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
