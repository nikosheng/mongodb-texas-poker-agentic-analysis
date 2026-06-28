import Card from './Card';

// 2-player layout: both players on the left side, same X axis
const POSITIONS = [
  'bottom-2 left-4',  // 0: human (bottom-left, same column as bot)
  'top-2 left-4',     // 1: bot  (top-left, avoids community cards)
];

export default function PlayerSeat({ player, isCurrentPlayer, isMe, seatIndex, isDealer }) {
  const isActive = !player.folded && player.chips > 0;
  const posClass = POSITIONS[seatIndex % POSITIONS.length];

  const showFaceDown = player.isBot;

  return (
    <div className={`absolute ${posClass} flex flex-col items-center gap-1`}>

      {/* Hole cards */}
      <div className="flex gap-1 mb-1">
        {isActive && !player.folded && (
          showFaceDown ? (
            <>
              <Card code="XX" size="sm" />
              <Card code="XX" size="sm" />
            </>
          ) : (
            player.holeCards && player.holeCards.length > 0
              ? player.holeCards.map((card, i) => (
                  <Card key={i} code={card === 'XX' ? 'XX' : card} size="sm" />
                ))
              : (
                <>
                  <Card code="XX" size="sm" />
                  <Card code="XX" size="sm" />
                </>
              )
          )
        )}
      </div>

      {/* Info box — font sizes scale with vw */}
      <div className={`relative rounded-xl text-center border-2 transition-all
        ${isCurrentPlayer && !player.folded ? 'active-player-glow border-gold bg-[#1a3d24]' : 'border-white/20 bg-black/50'}
        ${player.folded ? 'opacity-40' : ''}
        ${player.allIn ? 'border-orange-400' : ''}
        ${isMe ? 'ring-2 ring-blue-400/50' : ''}
        ${player.isBot && !isMe ? 'border-purple-500/40' : ''}
      `}
        style={{
          minWidth:    'clamp(72px, 8vw, 110px)',
          padding:     'clamp(4px,0.6vw,10px) clamp(8px,1.2vw,18px)',
        }}
      >
        {/* Dealer badge — top-right corner of info box */}
        {isDealer && (
          <div className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-white text-black
                          font-black flex items-center justify-center border-2 border-gold shadow-md z-10"
               style={{ fontSize: 'clamp(8px,0.8vw,11px)' }}>
            D
          </div>
        )}

        {isCurrentPlayer && !player.folded && (
          <div className="absolute -top-2 left-1/2 -translate-x-1/2 bg-gold text-black font-bold
                          rounded-full whitespace-nowrap"
               style={{ fontSize: 'clamp(9px,0.85vw,12px)', padding: '2px clamp(6px,0.7vw,10px)' }}>
            行動中
          </div>
        )}

        <div className="font-semibold text-white truncate"
             style={{ fontSize: 'clamp(10px,1.1vw,15px)', maxWidth: 'clamp(64px,7vw,96px)' }}>
          {player.name}
          {isMe && <span className="text-blue-300 ml-1" style={{ fontSize: 'clamp(9px,0.9vw,12px)' }}>(你)</span>}
          {player.isBot && <span className="text-purple-300 ml-1">🤖</span>}
        </div>

        <div className="text-gold font-bold font-cinzel"
             style={{ fontSize: 'clamp(11px,1.2vw,17px)' }}>
          {player.chips.toLocaleString()}
        </div>

        {player.bet > 0 && (
          <div className="text-yellow-300"
               style={{ fontSize: 'clamp(9px,0.9vw,13px)' }}>
            投 {player.bet.toLocaleString()}
          </div>
        )}

        {player.folded && (
          <div className="text-red-400 font-bold"
               style={{ fontSize: 'clamp(9px,0.9vw,13px)' }}>FOLD</div>
        )}
        {player.allIn && !player.folded && (
          <div className="text-orange-400 font-bold animate-pulse"
               style={{ fontSize: 'clamp(9px,0.9vw,13px)' }}>ALL IN</div>
        )}
      </div>
    </div>
  );
}
