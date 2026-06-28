import PlayerSeat from './PlayerSeat';
import CommunityCards from './CommunityCards';
import BettingPanel from './BettingPanel';
import GameLog from './GameLog';
import Card from './Card';

const BOT_NAME = 'Atlas';

const ACTION_TOAST = {
  'fold':   { bg: 'bg-gray-800/90',   border: 'border-gray-500/50',   text: 'text-gray-200',   icon: '✗', zh: '棄牌' },
  'check':  { bg: 'bg-blue-900/90',   border: 'border-blue-400/50',   text: 'text-blue-100',   icon: '✓', zh: '過牌' },
  'call':   { bg: 'bg-yellow-900/90', border: 'border-yellow-400/50', text: 'text-yellow-100', icon: '●', zh: '跟注' },
  'raise':  { bg: 'bg-red-900/90',    border: 'border-red-400/50',    text: 'text-red-100',    icon: '↑', zh: '加注' },
  'bet':    { bg: 'bg-orange-900/90', border: 'border-orange-400/50', text: 'text-orange-100', icon: '↑', zh: '下注' },
  'all-in': { bg: 'bg-red-950/95',    border: 'border-red-300',       text: 'text-white',      icon: '⚡', zh: '全押' },
};

export default function PokerTable({
  gameState, myName, myHoleCards,
  gameLog, handResult, countdown, botThinking, botLastAction,
  botMode, onAction, onEndGame,
}) {
  if (!gameState) return null;

  const { players, phase, pot, communityCards, currentPlayer, dealerIndex, handNumber } = gameState;
  const isMyTurn = currentPlayer === myName;
  const isBotTurn = currentPlayer === BOT_NAME;

  return (
    <div className="min-h-screen flex flex-col bg-[#0a1f10]">

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-black/40 border-b border-gold/20">
        <div className="flex items-center gap-2">
            <span className="font-cinzel text-gold text-sm">MongoDB</span>
            <span className="text-gray-600 text-sm">Texas Poker</span>
            {botMode === 'aggressive' && (
              <span className="ml-1 px-2 py-0.5 rounded-full bg-red-900/60 border border-red-500/50 text-red-400 text-xs font-bold animate-pulse">
                🔥 激進
              </span>
            )}
          </div>
          <div className="text-gray-400 text-xs">Hand #{handNumber}</div>
        {phase !== 'showdown' && (
          <button
            onClick={onEndGame}
            className="text-gray-500 hover:text-red-400 text-xs border border-gray-700 rounded px-2 py-1 transition-colors"
          >
            結束遊戲
          </button>
        )}
        {phase === 'showdown' && <div className="w-16" />}
      </div>

      {/* Main table area */}
      <div className="flex-1 flex flex-col lg:flex-row gap-4 p-4 min-h-0">

        {/* Poker table felt */}
        <div className="flex-1 relative felt-table rounded-3xl min-h-[420px] overflow-hidden shadow-2xl border-4 border-[#6b3d00]/40">
          <div className="absolute inset-2 rounded-2xl border border-gold/10 pointer-events-none" />

          {/* Player seats */}
          {players?.map((player, idx) => (
            <PlayerSeat
              key={player.name}
              player={player}
              isCurrentPlayer={currentPlayer === player.name}
              isMe={player.name === myName}
              seatIndex={idx}
              totalSeats={players.length}
              isDealer={idx === dealerIndex}
            />
          ))}

          {/* Community cards */}
          <div className="absolute inset-0 flex items-center justify-center">
            <CommunityCards
              cards={communityCards || []}
              phase={phase}
              pot={pot}
            />
          </div>



          {/* Bot action / thinking — right-side floating panel */}
          {(botThinking || botLastAction) && phase !== 'showdown' && (() => {
            const toast = botLastAction ? (ACTION_TOAST[botLastAction.action] || ACTION_TOAST['call']) : null;
            return (
              <div
                key={botLastAction ? `act-${botLastAction.ts}` : 'thinking'}
                className={`absolute top-4 right-4 z-10 animate-slide-up
                            rounded-2xl flex flex-col items-center justify-center gap-1
                            shadow-xl backdrop-blur-sm border-2
                            ${toast
                              ? `${toast.bg} ${toast.border} ${toast.text}`
                              : 'bg-purple-900/85 border-purple-400/50 text-purple-200'}`}
                style={{ minWidth: 'clamp(64px,7vw,96px)', padding: 'clamp(8px,1vw,14px) clamp(10px,1.2vw,18px)' }}
              >
                {toast ? (
                  <>
                    <span style={{ fontSize: 'clamp(18px,2.2vw,30px)', lineHeight: 1 }}>{toast.icon}</span>
                    <span style={{ fontSize: 'clamp(11px,1.2vw,16px)', fontWeight: 700 }}>{toast.zh}</span>
                    {botLastAction.amount > 0 && (
                      <span className="font-cinzel opacity-90"
                            style={{ fontSize: 'clamp(10px,1.1vw,15px)' }}>
                        {botLastAction.amount.toLocaleString()}
                      </span>
                    )}
                  </>
                ) : (
                  <>
                    <div className="flex gap-1 mb-1">
                      {[0, 150, 300].map((d) => (
                        <span key={d} className="w-1.5 h-1.5 rounded-full bg-purple-300 animate-bounce"
                              style={{ animationDelay: `${d}ms` }} />
                      ))}
                    </div>
                    <span style={{ fontSize: 'clamp(10px,1vw,13px)', fontWeight: 600 }}>思考中</span>
                  </>
                )}
              </div>
            );
          })()}

          {/* Showdown overlay */}
          {phase === 'showdown' && handResult && (() => {
            const winners = handResult.winners || [];
            const playerCards = handResult.playerCards || {};
            const handsMap = Object.fromEntries(
              (handResult.hands || []).map((h) => [h.name, h])
            );
            // Ensure human always left, Atlas always right
            const seats = [
              { name: myName,   isBot: false, cards: playerCards[myName]   || null },
              { name: BOT_NAME, isBot: true,  cards: playerCards[BOT_NAME] || null },
            ];

            return (
              <div className="absolute inset-0 bg-black/80 flex items-center justify-center rounded-2xl overflow-auto py-4">
                <div className="animate-slide-up w-full px-4" style={{ maxWidth: 'clamp(320px, 80vw, 760px)' }}>

                  {/* ── Title ── */}
                  <div className="text-center mb-2">
                    <div className="font-cinzel font-black text-gold"
                         style={{ fontSize: 'clamp(22px, 3.2vw, 46px)' }}>
                      {winners.includes(myName) ? '你贏了！' : `${winners.join(' & ')} 贏了！`}
                    </div>
                    <div className="text-white/70 mt-1"
                         style={{ fontSize: 'clamp(11px, 1.3vw, 18px)' }}>
                      底池 <span className="text-gold font-bold font-cinzel">{handResult.pot?.toLocaleString()}</span> 籌碼
                    </div>
                  </div>

                  {/* ── Community cards ── */}
                  {handResult.communityCards?.length > 0 && (
                    <div className="flex flex-col items-center mb-4">
                      <div className="text-gray-500 uppercase tracking-widest mb-2 font-cinzel"
                           style={{ fontSize: 'clamp(9px, 0.9vw, 12px)' }}>公共牌</div>
                      <div className="flex gap-2">
                        {handResult.communityCards.map((c, i) => (
                          <Card key={i} code={c} size="md" />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ── Player cards ── */}
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    {seats.map(({ name, isBot, cards }) => {
                      const isWinner = winners.includes(name);
                      const handInfo  = handsMap[name];
                      const folded    = !cards;

                      return (
                        <div key={name}
                          className={`rounded-2xl border-2 flex flex-col items-center transition-all
                            ${isWinner
                              ? 'border-gold bg-gold/10 shadow-[0_0_20px_rgba(212,175,55,0.3)]'
                              : 'border-white/10 bg-black/30 opacity-75'}
                          `}
                          style={{ padding: 'clamp(10px,1.2vw,18px)' }}
                        >
                          {/* Player label */}
                          <div className="flex items-center gap-2 mb-2">
                            <span className={`font-semibold ${isBot ? 'text-purple-300' : 'text-blue-300'}`}
                                  style={{ fontSize: 'clamp(11px, 1.2vw, 16px)' }}>
                              {isBot ? '🤖' : '👤'} {name}
                              {!isBot && <span className="text-blue-400/70 ml-1">(你)</span>}
                            </span>
                          </div>

                          {/* Hole cards */}
                          <div className={`flex gap-2 mb-2 ${isWinner ? '' : 'opacity-80'}`}>
                            {folded ? (
                              <>
                                <Card code="XX" size="lg" />
                                <Card code="XX" size="lg" />
                              </>
                            ) : (
                              (cards || []).map((c, i) => (
                                <Card key={i} code={c} size="lg" />
                              ))
                            )}
                          </div>

                          {/* Hand name */}
                          <div style={{ fontSize: 'clamp(10px, 1.1vw, 15px)' }}
                               className={folded ? 'text-red-400' : isWinner ? 'text-gold font-semibold' : 'text-gray-400'}>
                            {folded ? '棄牌' : (handInfo?.nameZh || handInfo?.name || '—')}
                          </div>

                          {/* Winner badge */}
                          {isWinner && (
                            <div className="mt-2 px-3 py-0.5 rounded-full bg-gold text-black font-black font-cinzel"
                                 style={{ fontSize: 'clamp(9px, 0.9vw, 13px)' }}>
                              🏆 贏家
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* ── Chip deltas ── */}
                  <div className="flex justify-center gap-6 mb-3">
                    {handResult.state?.players?.map((p) => {
                      const delta = p.chips - 10000;
                      return (
                        <div key={p.name} className="text-center">
                          <span className={p.name === myName ? 'text-blue-300' : 'text-purple-300'}
                                style={{ fontSize: 'clamp(10px, 1.1vw, 15px)' }}>
                            {p.name}
                          </span>
                          <span className="text-gray-500 mx-1">→</span>
                          <span className="text-gold font-bold font-cinzel"
                                style={{ fontSize: 'clamp(11px, 1.2vw, 16px)' }}>
                            {p.chips?.toLocaleString()}
                          </span>
                          <span className={`ml-1 ${delta >= 0 ? 'text-green-400' : 'text-red-400'}`}
                                style={{ fontSize: 'clamp(9px, 1vw, 13px)' }}>
                            ({delta >= 0 ? '+' : ''}{delta?.toLocaleString()})
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* ── Footer ── */}
                  <div className="text-center">
                    <div className="text-gray-500 mb-3"
                         style={{ fontSize: 'clamp(9px, 0.9vw, 12px)' }}>
                      行為數據正在分析並向量化至 MongoDB Atlas...
                    </div>
                    <button
                      onClick={onEndGame}
                      className="bg-gold hover:bg-gold-light text-black font-bold rounded-xl
                                 font-cinzel transition-all active:scale-95 shadow-lg shadow-gold/30"
                      style={{ padding: 'clamp(8px,1vw,14px) clamp(28px,3vw,52px)',
                               fontSize: 'clamp(12px,1.2vw,18px)' }}
                    >
                      結束遊戲
                    </button>
                  </div>

                </div>
              </div>
            );
          })()}
        </div>

        {/* Right panel — scales from 256px to 360px based on viewport */}
        <div className="w-full flex flex-col gap-3" style={{ flexBasis: 'clamp(256px, 22vw, 360px)', flexShrink: 0, flexGrow: 0 }}>

          {/* Human's hole cards — always visible */}
          {myHoleCards.length > 0 && phase !== 'showdown' && (
            <div className="bg-black/60 border border-gold/30 rounded-xl p-4">
              <div className="text-gray-400 mb-3" style={{ fontSize: 'clamp(10px,1vw,13px)' }}>
                <span className="text-gold font-semibold">{myName}</span> 的手牌
                <span className="text-blue-300 ml-2">(你)</span>
              </div>
              <div className="flex gap-3 justify-center">
                {myHoleCards.map((card, i) => (
                  <Card key={i} code={card} size="xl" />
                ))}
              </div>
            </div>
          )}

          <GameLog logs={gameLog} />

          {/* Chips summary */}
          <div className="bg-black/50 border border-white/10 rounded-xl p-3">
            <div className="text-gold/60 text-xs font-cinzel mb-2 uppercase tracking-wider">籌碼統計</div>
            {players?.map((p) => (
              <div key={p.name} className={`flex justify-between text-sm py-1 ${p.folded ? 'opacity-40' : ''}`}>
                <span className={p.name === myName ? 'text-blue-300' : 'text-purple-300'}>
                  {p.name === myName ? '▶ ' : '🤖 '}{p.name}
                </span>
                <span className="text-gold font-bold font-cinzel">{p.chips?.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Betting panel — human's turn only */}
      {isMyTurn && phase !== 'showdown' && (
        <BettingPanel
          gameState={gameState}
          myName={myName}
          myHoleCards={myHoleCards}
          countdown={countdown}
          onAction={onAction}
        />
      )}


    </div>
  );
}
