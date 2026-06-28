import { useState } from 'react';

export default function BettingPanel({ gameState, myName, myHoleCards, countdown, onAction }) {
  const [raiseAmount, setRaiseAmount] = useState('');

  if (!gameState) return null;

  const currentPlayer = gameState.currentPlayer;
  const isMyTurn = currentPlayer === myName;
  const me = gameState.players?.find((p) => p.name === myName);

  if (!isMyTurn || !me || me.folded || me.allIn) return null;

  const callAmount = Math.max(0, (gameState.lastBet || 0) - (me.bet || 0));
  const minRaise = (gameState.lastBet || 0) + (gameState.minRaise || 200);
  const maxRaise = me.chips + (me.bet || 0);
  const canCheck = callAmount === 0;
  const canCall = callAmount > 0 && me.chips > 0;
  const canRaise = me.chips > callAmount;

  const presetRaises = [
    { label: '1/2 底池', value: Math.floor(gameState.pot * 0.5) },
    { label: '底池', value: gameState.pot },
    { label: '2x', value: (gameState.lastBet || 200) * 2 },
  ];

  const handleRaise = () => {
    const amount = parseInt(raiseAmount);
    if (!amount || amount < minRaise) return;
    onAction('raise', amount);
    setRaiseAmount('');
  };

  return (
    <div className="bg-black/80 border-t border-gold/20 rounded-t-2xl p-4 animate-slide-up">
      {/* Countdown */}
      {countdown !== null && (
        <div className="flex items-center justify-center mb-3 gap-2">
          <div className={`text-2xl font-bold font-cinzel ${countdown <= 10 ? 'text-red-400 animate-pulse' : 'text-gold'}`}>
            {countdown}
          </div>
          <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-1000 ${countdown <= 10 ? 'bg-red-400' : 'bg-gold'}`}
              style={{ width: `${(countdown / 30) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Info row */}
      <div className="flex justify-between text-sm text-gray-400 mb-3">
        <span>你的籌碼: <span className="text-gold font-bold">{me.chips?.toLocaleString()}</span></span>
        {callAmount > 0 && <span>需跟注: <span className="text-yellow-300 font-bold">{callAmount.toLocaleString()}</span></span>}
        <span>底池: <span className="text-white font-bold">{gameState.pot?.toLocaleString()}</span></span>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2 mb-3">
        <button
          onClick={() => onAction('fold')}
          className="flex-1 bg-red-900/80 hover:bg-red-800 border border-red-700/50 text-white
                     font-bold py-3 rounded-xl transition-all active:scale-95"
        >
          棄牌
        </button>

        {canCheck ? (
          <button
            onClick={() => onAction('check')}
            className="flex-1 bg-blue-900/80 hover:bg-blue-800 border border-blue-700/50 text-white
                       font-bold py-3 rounded-xl transition-all active:scale-95"
          >
            過牌
          </button>
        ) : (
          <button
            onClick={() => onAction('call', callAmount)}
            disabled={!canCall}
            className="flex-1 bg-blue-900/80 hover:bg-blue-800 border border-blue-700/50 text-white
                       font-bold py-3 rounded-xl transition-all active:scale-95 disabled:opacity-40"
          >
            跟注 {callAmount > 0 && `(${callAmount.toLocaleString()})`}
          </button>
        )}

        <button
          onClick={() => onAction('all-in')}
          className="flex-1 bg-orange-900/80 hover:bg-orange-800 border border-orange-700/50 text-orange-300
                     font-bold py-3 rounded-xl transition-all active:scale-95"
        >
          全押
        </button>
      </div>

      {/* Raise section */}
      {canRaise && (
        <div className="space-y-2">
          {/* Preset raise buttons */}
          <div className="flex gap-2">
            {presetRaises.map(({ label, value }) => (
              <button
                key={label}
                onClick={() => setRaiseAmount(String(Math.min(value, maxRaise)))}
                className="flex-1 bg-[#1a3d24] hover:bg-felt-light border border-gold/30 text-gold
                           text-xs font-bold py-2 rounded-lg transition-all active:scale-95"
              >
                {label}
              </button>
            ))}
          </div>

          {/* Custom raise */}
          <div className="flex gap-2">
            <input
              type="number"
              value={raiseAmount}
              onChange={(e) => setRaiseAmount(e.target.value)}
              placeholder={`加注 (最少 ${minRaise})`}
              min={minRaise}
              max={maxRaise}
              className="flex-1 bg-[#1a3d24] border border-gold/30 rounded-xl px-3 py-2.5
                         text-white placeholder-gray-600 text-sm focus:outline-none focus:border-gold"
            />
            <button
              onClick={handleRaise}
              disabled={!raiseAmount || parseInt(raiseAmount) < minRaise}
              className="bg-gold hover:bg-gold-light disabled:opacity-40 text-black font-bold
                         px-5 py-2.5 rounded-xl transition-all active:scale-95"
            >
              加注
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
