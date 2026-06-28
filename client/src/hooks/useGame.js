import { useState, useEffect, useCallback } from 'react';
import { useSocket } from './useSocket';

const BOT_NAME = 'Atlas';

export function useGame() {
  const { emit, on, off } = useSocket();

  // Phase: 'login' | 'playing' | 'ended'
  const [phase, setPhase] = useState('login');
  const [myName, setMyName] = useState('');
  const [myProfile, setMyProfile] = useState(null);
  const [botMode, setBotMode] = useState('normal');

  // Game state
  const [gameState, setGameState] = useState(null);
  const [myHoleCards, setMyHoleCards] = useState([]);
  const [sessionId, setSessionId] = useState('');
  const [gameLog, setGameLog] = useState([]);
  const [handResult, setHandResult] = useState(null);
  const [gameResult, setGameResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [countdown, setCountdown] = useState(null);
  const [botThinking, setBotThinking] = useState(false);
  const [botLastAction, setBotLastAction] = useState(null); // { action, amount, ts }

  const addLog = useCallback((msg) => {
    setGameLog((prev) => [...prev.slice(-50), { msg, ts: Date.now() }]);
  }, []);

  useEffect(() => {
    const handlers = [
      ['game_started', ({ sessionId: sid, playerNames, state, profile, botMode: mode }) => {
        setSessionId(sid);
        setGameState(state);
        setPhase('playing');
        setGameLog([]);
        setBotThinking(false);
        if (profile) setMyProfile(profile);
        if (mode) setBotMode(mode);
        addLog(`遊戲開始！你 vs ${BOT_NAME}${mode === 'aggressive' ? '（激進模式）' : ''}`);
      }],

      ['hand_started', ({ handNumber, state }) => {
        setGameState(state);
        setHandResult(null);
        setBotThinking(false);
        setBotLastAction(null);
        addLog(`── 第 ${handNumber} 手開始 ──`);
      }],

      ['hand_dealt', ({ holeCards }) => {
        // Human player's private hole cards
        setMyHoleCards(holeCards);
      }],

      ['street_changed', ({ phase: p, communityCards, state }) => {
        setGameState(state);
        setBotThinking(false);
        const phaseNames = { flop: 'Flop', turn: 'Turn', river: 'River' };
        addLog(`${phaseNames[p] || p}：${communityCards.join(' ')}`);
      }],

      ['player_acted', ({ playerName, action, amount, state }) => {
        setGameState(state);
        setBotThinking(false);
        const actionZh = { fold: '棄牌', check: '過牌', call: '跟注', raise: '加注', bet: '下注', 'all-in': '全押' };
        const amtStr = amount > 0 ? ` ${amount}` : '';
        addLog(`${playerName}: ${actionZh[action] || action}${amtStr}`);
        if (playerName === BOT_NAME) {
          setBotLastAction({ action, amount, ts: Date.now() });
        }
      }],

      ['bot_thinking', ({ botName }) => {
        setBotThinking(true);
        addLog(`${botName} 思考中...`);
      }],

      ['turn_changed', ({ currentPlayer, timeLimit, state }) => {
        setGameState(state);
        setCountdown(timeLimit);
        if (currentPlayer !== BOT_NAME) {
          setBotThinking(false);
        }
        addLog(`輪到 ${currentPlayer === BOT_NAME ? BOT_NAME + '（機器人）' : currentPlayer} 行動`);
      }],

      ['hand_ended', ({ winners, pot, hands, communityCards, playerCards, state }) => {
        setGameState(state);
        setHandResult({ winners, pot, hands, communityCards, playerCards });
        setBotThinking(false);
        const winnerStr = winners.join('、');
        addLog(`本手結束！贏家：${winnerStr}，底池：${pot}`);
        if (hands && hands.length > 0) {
          for (const h of hands) {
            addLog(`  ${h.name}: ${h.nameZh || h.name}`);
          }
        }
      }],

      ['game_ended', ({ rankings }) => {
        setGameResult(rankings);
        setPhase('ended');
        setBotThinking(false);
        addLog('遊戲結束！');
        for (const r of rankings) {
          const change = r.netChange >= 0 ? `+${r.netChange}` : `${r.netChange}`;
          addLog(`  #${r.rank} ${r.name}: ${r.chips} 籌碼 (${change})`);
        }
      }],

      ['error', ({ message }) => {
        setErrorMsg(message);
        setTimeout(() => setErrorMsg(''), 4000);
      }],
    ];

    handlers.forEach(([evt, fn]) => on(evt, fn));
    return () => handlers.forEach(([evt, fn]) => off(evt, fn));
  }, [on, off, addLog]);

  // Countdown timer
  useEffect(() => {
    if (countdown === null) return;
    if (countdown <= 0) { setCountdown(null); return; }
    const t = setTimeout(() => setCountdown((c) => (c !== null ? c - 1 : null)), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const joinGame = useCallback((name, botMode = 'normal') => {
    setMyName(name);
    emit('join_game', { playerName: name, botMode });
  }, [emit]);

  const sendAction = useCallback((action, amount = 0) => {
    emit('player_action', { action, amount });
  }, [emit]);

  const nextHand = useCallback(() => {
    emit('next_hand', {});
  }, [emit]);

  const endGame = useCallback(() => {
    emit('end_game', {});
  }, [emit]);

  const resetToLogin = useCallback(() => {
    setPhase('login');
    setMyName('');
    setMyProfile(null);
    setGameState(null);
    setMyHoleCards([]);
    setHandResult(null);
    setGameResult(null);
    setGameLog([]);
    setBotThinking(false);
    setCountdown(null);
    setBotMode('normal');
  }, []);

  return {
    phase, myName, myProfile, botMode,
    gameState, myHoleCards, sessionId,
    gameLog, handResult, gameResult,
    errorMsg, countdown, botThinking, botLastAction,
    joinGame, sendAction, nextHand, endGame, resetToLogin,
  };
}
