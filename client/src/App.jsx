import { useGame } from './hooks/useGame';
import PlayerLogin from './components/lobby/PlayerLogin';
import PokerTable from './components/game/PokerTable';
import Toast from './components/common/Toast';

export default function App() {
  const {
    phase, myName, myProfile, botMode,
    gameState, myHoleCards, gameLog,
    handResult, gameResult, errorMsg, countdown, botThinking, botLastAction,
    joinGame, sendAction, endGame, resetToLogin,
  } = useGame();

  return (
    <>
      <Toast message={errorMsg} />

      {phase === 'login' && (
        <PlayerLogin onJoin={joinGame} />
      )}

      {phase === 'playing' && (
        <PokerTable
          gameState={gameState}
          myName={myName}
          myHoleCards={myHoleCards}
          gameLog={gameLog}
          handResult={handResult}
          countdown={countdown}
          botThinking={botThinking}
          botLastAction={botLastAction}
          botMode={botMode}
          onAction={sendAction}
          onEndGame={endGame}
        />
      )}

      {phase === 'ended' && (
        <div className="min-h-screen flex items-center justify-center bg-[#0a1f10] p-4">
          <div className="w-full max-w-md text-center">
            <div className="mb-8">
              <div className="w-20 h-20 rounded-full bg-gold/20 border-2 border-gold/50 flex items-center justify-center mx-auto mb-4">
                <span className="text-gold font-cinzel text-3xl font-black">✓</span>
              </div>
              <h1 className="font-cinzel text-4xl font-black text-gold mb-2">遊戲結束</h1>
              <p className="text-gray-400 text-sm">感謝參與！行為數據已記錄至 MongoDB Atlas</p>
            </div>

            {gameResult && (
              <div className="bg-[#0f2d18] border border-gold/30 rounded-2xl p-5 shadow-2xl space-y-3 mb-6">
                {gameResult.map((r) => (
                  <div key={r.name}
                    className={`flex items-center justify-between rounded-xl px-4 py-3
                      ${r.rank === 1 ? 'bg-gold/20 border border-gold/40' : 'bg-[#1a3d24]'}
                      ${r.name === myName ? 'ring-2 ring-blue-400/50' : ''}`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm font-cinzel
                        ${r.rank === 1 ? 'bg-gold text-black' : 'bg-white/10 text-white'}`}>
                        {r.rank}
                      </div>
                      <span className="text-white font-semibold">
                        {r.name}
                        {r.name === myName && <span className="text-blue-300 text-xs ml-1">(你)</span>}
                        {r.isBot && <span className="text-purple-300 text-xs ml-1">(機器人)</span>}
                      </span>
                    </div>
                    <div className="text-right">
                      <div className="text-gold font-bold font-cinzel">{r.chips?.toLocaleString()}</div>
                      <div className={`text-xs ${r.netChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {r.netChange >= 0 ? '+' : ''}{r.netChange?.toLocaleString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="bg-[#0f2d18] border border-green-500/20 rounded-xl p-3 mb-6 flex items-center justify-center gap-2 text-xs text-green-400/80">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              行為向量已儲存至 MongoDB Atlas — 下一位玩家可開始
            </div>

            <button
              onClick={resetToLogin}
              className="w-full bg-gold hover:bg-gold-light text-black font-bold text-lg
                         py-4 rounded-2xl font-cinzel transition-all active:scale-95 shadow-lg shadow-gold/20"
            >
              下一位玩家
            </button>
          </div>
        </div>
      )}
    </>
  );
}
