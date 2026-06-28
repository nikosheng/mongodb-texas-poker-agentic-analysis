const { v4: uuidv4 } = require('uuid');
const { DeckManager } = require('./DeckManager');
const { determineWinners, classifyStrength } = require('./HandEvaluator');

const SMALL_BLIND = 100;
const BIG_BLIND = 200;
const STARTING_CHIPS = 10000;
const ACTION_TIMEOUT_MS = 30000;
const BOT_NAME = 'Atlas';

const PHASES = ['preflop', 'flop', 'turn', 'river', 'showdown'];

class PokerEngine {
  constructor(sessionId, playerNames, emitFn, botMode = 'normal') {
    this.sessionId = sessionId;
    this.gameId = uuidv4();
    this.emitFn = emitFn; // fn(event, data, targetPlayerName?)
    this.botMode = botMode; // 'normal' | 'aggressive'

    // Players — always [humanName, BOT_NAME]
    this.players = playerNames.map((name, idx) => ({
      name,
      chips: STARTING_CHIPS,
      holeCards: [],
      bet: 0,
      totalBet: 0,
      folded: false,
      allIn: false,
      seatIndex: idx,
      isActive: true,
      isBot: name === BOT_NAME,
    }));

    this.dealerIndex = 0;
    this.handNumber = 0;
    this.pot = 0;
    this.sidePots = [];
    this.communityCards = [];
    this.phase = 'waiting';
    this.currentPlayerIndex = -1;
    this.deck = new DeckManager();
    this.handHistory = [];
    this.currentHandActions = {};
    this.actionTimer = null;
    this.botTimer = null;
    this.minRaise = BIG_BLIND;
    this.lastBet = 0;
    this.ended = false;
  }

  // ─── Session-level helpers ──────────────────────────────────────────────────

  getActivePlayers() {
    return this.players.filter((p) => p.isActive && p.chips > 0);
  }

  getHandActivePlayers() {
    return this.players.filter((p) => !p.folded && p.isActive);
  }

  getPublicState(viewerName = null) {
    return {
      sessionId: this.sessionId,
      gameId: this.gameId,
      phase: this.phase,
      pot: this.pot,
      communityCards: this.communityCards,
      handNumber: this.handNumber,
      currentPlayer:
        this.currentPlayerIndex >= 0
          ? this.players[this.currentPlayerIndex]?.name
          : null,
      players: this.players.map((p) => ({
        name: p.name,
        chips: p.chips,
        bet: p.bet,
        folded: p.folded,
        allIn: p.allIn,
        isActive: p.isActive,
        seatIndex: p.seatIndex,
        isBot: p.isBot,
        // Human always sees own cards. Bot cards are always hidden (shown face-down on client).
        // At showdown all cards are revealed.
        holeCards:
          this.phase === 'showdown'
            ? p.holeCards
            : p.isBot
            ? p.holeCards.map(() => 'XX')
            : viewerName === p.name
            ? p.holeCards
            : p.holeCards.map(() => 'XX'),
      })),
      dealerIndex: this.dealerIndex,
      smallBlind: SMALL_BLIND,
      bigBlind: BIG_BLIND,
      minRaise: this.minRaise,
      lastBet: this.lastBet,
    };
  }

  // ─── Start a new hand ────────────────────────────────────────────────────────

  startNewHand() {
    this.handNumber++;
    this.pot = 0;
    this.sidePots = [];
    this.communityCards = [];
    this.lastBet = 0;
    this.minRaise = BIG_BLIND;

    this.deck.reset().shuffle();

    const activePlayers = this.getActivePlayers();
    if (activePlayers.length < 2) {
      this.endGame();
      return;
    }

    for (const p of this.players) {
      p.holeCards = [];
      p.bet = 0;
      p.totalBet = 0;
      p.folded = false;
      p.allIn = false;
      p.hasActedThisStreet = false;
    }

    this.currentHandActions = {};
    for (const p of this.players) {
      this.currentHandActions[p.name] = [];
    }

    // Rotate dealer
    this.dealerIndex = this.nextActiveIndex(this.dealerIndex);

    // Deal 2 hole cards each
    for (const p of activePlayers) {
      p.holeCards = this.deck.deal(2);
    }

    // Post blinds
    const sbIndex = this.nextActiveIndex(this.dealerIndex);
    const bbIndex = this.nextActiveIndex(sbIndex);

    this.postBlind(sbIndex, SMALL_BLIND);
    this.postBlind(bbIndex, BIG_BLIND);
    this.lastBet = BIG_BLIND;

    this.phase = 'preflop';
    this.currentPlayerIndex = this.nextActiveIndex(bbIndex);
    this.streetOpenIndex = this.currentPlayerIndex;
    this.lastAggressorIndex = bbIndex;

    // Emit human's hole cards (private)
    const human = activePlayers.find((p) => !p.isBot);
    if (human) {
      this.emitFn('hand_dealt', { holeCards: human.holeCards }, human.name);
    }

    // Broadcast hand_started (bot cards masked in getPublicState)
    this.emitFn('hand_started', {
      handNumber: this.handNumber,
      state: this.getPublicState(),
    });

    this.startActionTimer();
  }

  postBlind(playerIndex, amount) {
    const p = this.players[playerIndex];
    const actual = Math.min(amount, p.chips);
    p.chips -= actual;
    p.bet += actual;
    p.totalBet += actual;
    this.pot += actual;
    if (p.chips === 0) p.allIn = true;
  }

  // ─── Player Actions ──────────────────────────────────────────────────────────

  handleAction(playerName, action, amount = 0) {
    const p = this.players.find((pl) => pl.name === playerName);
    if (!p) return { success: false, error: 'Player not found' };

    const current = this.players[this.currentPlayerIndex];
    if (!current || current.name !== playerName) {
      return { success: false, error: 'Not your turn' };
    }
    if (p.folded || p.allIn) {
      return { success: false, error: 'You cannot act' };
    }

    this.clearActionTimer();

    const prevLastBet = this.lastBet; // snapshot before any mutation (used for escalation ratio)
    const callAmount = this.lastBet - p.bet;

    let actualAmount = 0;
    let actionResult = action;

    if (action === 'fold') {
      p.folded = true;
      p.hasActedThisStreet = true;
    } else if (action === 'check') {
      if (callAmount > 0) return { success: false, error: 'Cannot check, must call or fold' };
      p.hasActedThisStreet = true;
    } else if (action === 'call') {
      const toCall = Math.min(callAmount, p.chips);
      p.chips -= toCall;
      p.bet += toCall;
      p.totalBet += toCall;
      this.pot += toCall;
      actualAmount = toCall;
      p.hasActedThisStreet = true;
      if (p.chips === 0) {
        p.allIn = true;
        actionResult = 'all-in';
      }
    } else if (action === 'raise' || action === 'bet') {
      const totalBetTarget = Math.max(amount, this.lastBet + this.minRaise);
      const toAdd = Math.min(totalBetTarget - p.bet, p.chips);
      p.chips -= toAdd;
      p.bet += toAdd;
      p.totalBet += toAdd;
      this.pot += toAdd;
      this.lastBet = p.bet;
      this.minRaise = toAdd;
      actualAmount = p.bet;
      p.hasActedThisStreet = true;
      this.lastAggressorIndex = this.currentPlayerIndex;
      if (p.chips === 0) {
        p.allIn = true;
        actionResult = 'all-in';
      }
    } else if (action === 'all-in') {
      const toAdd = p.chips;
      p.chips = 0;
      p.bet += toAdd;
      p.totalBet += toAdd;
      this.pot += toAdd;
      if (p.bet > this.lastBet) {
        this.lastBet = p.bet;
        this.minRaise = toAdd;
        this.lastAggressorIndex = this.currentPlayerIndex;
      }
      p.allIn = true;
      p.hasActedThisStreet = true;
      actualAmount = p.bet;
    } else {
      return { success: false, error: 'Unknown action' };
    }

    // Record action for behavior tracking
    const handStrength = classifyStrength(p.holeCards, this.communityCards);
    this.currentHandActions[playerName].push({
      street: this.phase,
      action: actionResult,
      amount: actualAmount,
      prevLastBet,   // bet level player was facing before this action (for escalation ratio)
      handStrength,
      potSize: this.pot,
      timestamp: new Date(),
    });

    this.emitFn('player_acted', {
      playerName,
      action: actionResult,
      amount: actualAmount,
      pot: this.pot,
      state: this.getPublicState(),
    });

    const active = this.getHandActivePlayers();
    if (active.length === 1) {
      this.resolveHand(false);
      return { success: true };
    }

    this.advanceTurn();
    return { success: true };
  }

  advanceTurn() {
    const canAct = this.getHandActivePlayers().filter((p) => !p.allIn);

    if (canAct.length === 0) {
      this.runOutBoard();
      return;
    }

    const totalPlayers = this.players.length;
    let checked = 0;
    let nextIdx = this.nextActiveIndexCanAct(this.currentPlayerIndex);

    while (checked < totalPlayers) {
      const p = this.players[nextIdx];

      if (!p.folded && !p.allIn && p.isActive) {
        if (p.bet < this.lastBet) {
          this.currentPlayerIndex = nextIdx;
          this.startActionTimer();
          return;
        }
        if (!p.hasActedThisStreet) {
          this.currentPlayerIndex = nextIdx;
          this.startActionTimer();
          return;
        }
        if (nextIdx === this.lastAggressorIndex) {
          this.advanceStreet();
          return;
        }
      }

      nextIdx = this.nextActiveIndexCanAct(nextIdx);
      checked++;
    }

    // Fallback
    const activePlayers = this.getHandActivePlayers().filter((p) => !p.allIn);
    const maxBet = activePlayers.length > 0 ? Math.max(...activePlayers.map((p) => p.bet)) : 0;
    const allMatched = activePlayers.every((p) => p.bet >= maxBet && p.hasActedThisStreet);

    if (allMatched) {
      this.advanceStreet();
    } else {
      for (let i = 1; i <= totalPlayers; i++) {
        const idx = (this.currentPlayerIndex + i) % totalPlayers;
        const p = this.players[idx];
        if (!p.folded && !p.allIn && p.isActive && (p.bet < maxBet || !p.hasActedThisStreet)) {
          this.currentPlayerIndex = idx;
          this.startActionTimer();
          return;
        }
      }
      this.advanceStreet();
    }
  }

  nextActiveIndexCanAct(fromIndex) {
    const len = this.players.length;
    for (let i = 1; i <= len; i++) {
      const idx = (fromIndex + i) % len;
      const p = this.players[idx];
      if (p.isActive && !p.folded && !p.allIn && p.chips >= 0) {
        return idx;
      }
    }
    return fromIndex;
  }

  advanceStreet() {
    for (const p of this.players) {
      p.bet = 0;
      p.hasActedThisStreet = false;
    }
    this.lastBet = 0;
    this.minRaise = BIG_BLIND;

    const phaseIndex = PHASES.indexOf(this.phase);
    const nextPhase = PHASES[phaseIndex + 1];

    if (!nextPhase || nextPhase === 'showdown') {
      this.resolveHand(true);
      return;
    }

    this.phase = nextPhase;

    if (nextPhase === 'flop') {
      this.communityCards = this.deck.deal(3);
    } else if (nextPhase === 'turn' || nextPhase === 'river') {
      this.communityCards.push(...this.deck.deal(1));
    }

    this.emitFn('street_changed', {
      phase: this.phase,
      communityCards: this.communityCards,
      state: this.getPublicState(),
    });

    const firstActor = this.nextActiveIndexCanAct(this.dealerIndex);
    this.currentPlayerIndex = firstActor;
    this.lastAggressorIndex = this.prevActiveIndexCanAct(firstActor);

    this.startActionTimer();
  }

  prevActiveIndexCanAct(fromIndex) {
    const len = this.players.length;
    for (let i = 1; i <= len; i++) {
      const idx = (fromIndex - i + len) % len;
      const p = this.players[idx];
      if (p.isActive && !p.folded && !p.allIn) {
        return idx;
      }
    }
    return fromIndex;
  }

  runOutBoard() {
    if (this.phase === 'preflop') {
      this.communityCards = this.deck.deal(3);
      this.phase = 'flop';
      this.emitFn('street_changed', { phase: this.phase, communityCards: this.communityCards, state: this.getPublicState() });
      this.communityCards.push(...this.deck.deal(1));
      this.phase = 'turn';
      this.emitFn('street_changed', { phase: this.phase, communityCards: this.communityCards, state: this.getPublicState() });
      this.communityCards.push(...this.deck.deal(1));
      this.phase = 'river';
      this.emitFn('street_changed', { phase: this.phase, communityCards: this.communityCards, state: this.getPublicState() });
    } else if (this.phase === 'flop') {
      this.communityCards.push(...this.deck.deal(1));
      this.phase = 'turn';
      this.emitFn('street_changed', { phase: this.phase, communityCards: this.communityCards, state: this.getPublicState() });
      this.communityCards.push(...this.deck.deal(1));
      this.phase = 'river';
      this.emitFn('street_changed', { phase: this.phase, communityCards: this.communityCards, state: this.getPublicState() });
    } else if (this.phase === 'turn') {
      this.communityCards.push(...this.deck.deal(1));
      this.phase = 'river';
      this.emitFn('street_changed', { phase: this.phase, communityCards: this.communityCards, state: this.getPublicState() });
    }
    this.resolveHand(true);
  }

  resolveHand(showdown) {
    this.clearActionTimer();
    this.clearBotTimer();
    this.phase = 'showdown';

    const activePlayers = this.getHandActivePlayers();

    let winnersResult;
    if (activePlayers.length === 1) {
      winnersResult = { winners: [activePlayers[0].name], hands: [] };
    } else {
      winnersResult = determineWinners(
        activePlayers.map((p) => ({ name: p.name, holeCards: p.holeCards })),
        this.communityCards
      );
    }

    const { winners } = winnersResult;
    const splitAmount = Math.floor(this.pot / winners.length);
    const remainder = this.pot - splitAmount * winners.length;

    for (const name of winners) {
      const p = this.players.find((pl) => pl.name === name);
      if (p) p.chips += splitAmount;
    }
    if (remainder > 0) {
      const first = this.players.find((p) => p.name === winners[0]);
      if (first) first.chips += remainder;
    }

    const handRecord = {
      handNumber: this.handNumber,
      winners,
      potSize: this.pot,
      communityCards: [...this.communityCards],
      playerHands: Object.fromEntries(
        activePlayers.map((p) => [p.name, p.holeCards])
      ),
      evaluatedHands: winnersResult.hands,
      actions: { ...this.currentHandActions },
    };
    this.handHistory.push(handRecord);

    // Clear currentHandActions so getPlayerRawActions doesn't double-count this hand
    for (const p of this.players) {
      this.currentHandActions[p.name] = [];
    }

    this.emitFn('hand_ended', {
      winners,
      pot: this.pot,
      hands: winnersResult.hands,
      communityCards: this.communityCards,
      playerCards: Object.fromEntries(
        activePlayers.map((p) => [p.name, p.holeCards])
      ),
      state: this.getPublicState(),
    });

    // One hand per session — wait for the client to click "結束遊戲" (end_game socket).
    // endGame() will be triggered by the GameSocketHandler on that event.

    return handRecord;
  }

  endGame() {
    if (this.ended) return;
    this.ended = true;
    this.phase = 'ended';
    this.clearActionTimer();
    this.clearBotTimer();

    const rankings = this.players
      .filter((p) => p.isActive)
      .sort((a, b) => b.chips - a.chips)
      .map((p, i) => ({
        rank: i + 1,
        name: p.name,
        chips: p.chips,
        netChange: p.chips - STARTING_CHIPS,
        isBot: p.isBot,
      }));

    this.emitFn('game_ended', { rankings, sessionId: this.sessionId });
    return rankings;
  }

  // ─── Bot Logic ───────────────────────────────────────────────────────────────

  /**
   * Decide and execute the bot's action after a random think delay (800–1500ms).
   * Emits `bot_thinking` immediately, then acts after the delay.
   */
  scheduleBotAction() {
    this.clearBotTimer();
    const bot = this.players[this.currentPlayerIndex];
    if (!bot || !bot.isBot) return;

    // Tell the client the bot is thinking
    this.emitFn('bot_thinking', { botName: BOT_NAME });

    const delay = 800 + Math.random() * 700; // 800–1500ms
    this.botTimer = setTimeout(() => {
      this.executeBotAction();
    }, delay);
  }

  executeBotAction() {
    const bot = this.players[this.currentPlayerIndex];
    if (!bot || !bot.isBot) return;

    // ── Shared raise sizing helpers (used by both modes) ─────────────────────
    // raiseSize: raise-to amount capped at bot's stack (may be all-in)
    const raiseSize = (multiplier) => {
      const base = Math.max(this.lastBet, BIG_BLIND);
      const target = Math.round(base + this.pot * multiplier);
      return Math.min(target, bot.chips + bot.bet);
    };
    // raiseSizeCapped: same but hard-capped 1 chip below all-in (never all-in)
    const raiseSizeCapped = (multiplier) => {
      const allIn = bot.chips + bot.bet;
      return Math.min(raiseSize(multiplier), allIn - 1);
    };

    // ── Aggressive mode ───────────────────────────────────────────────────────
    // Pre-river: raise 50–75% pot (never all-in), or call; never fold
    // River only: 50% all-in raise / 40% all-in re-raise allowed
    if (this.botMode === 'aggressive') {
      const isRiver = this.phase === 'river';
      const callAmount = this.lastBet - bot.bet;
      const canCheck = callAmount === 0;
      const canRaise = bot.chips > callAmount;

      let action, amount = 0;

      if (bot.chips === 0) {
        // No chips — nothing to do
        action = 'check';
      } else if (callAmount >= bot.chips) {
        // Human went all-in — always call
        action = 'call';
      } else if (canCheck) {
        // No bet to face
        if (isRiver && Math.random() < 0.50 && canRaise) {
          // River: 50% → all-in raise to maximum pressure
          action = 'raise';
          amount = bot.chips + bot.bet;
        } else if (!isRiver && Math.random() < 0.60 && canRaise) {
          // Pre-river: 60% → raise 50–75% pot, never all-in
          const multi = 0.50 + Math.random() * 0.25;
          amount = raiseSizeCapped(multi);
          action = amount > this.lastBet ? 'raise' : 'check';
        } else {
          action = 'check';
        }
      } else {
        // Facing a bet / raise
        if (isRiver && Math.random() < 0.40 && canRaise) {
          // River: 40% → all-in re-raise
          action = 'raise';
          amount = bot.chips + bot.bet;
        } else if (!isRiver && Math.random() < 0.30 && canRaise) {
          // Pre-river: 30% → non-all-in re-raise 50–75% pot
          const multi = 0.50 + Math.random() * 0.25;
          amount = raiseSizeCapped(multi);
          action = amount > this.lastBet ? 'raise' : 'call';
        } else {
          // Default: call (never fold in aggressive mode)
          action = 'call';
        }
      }

      this.handleAction(BOT_NAME, action, amount);
      return;
    }

    // ── Normal mode ───────────────────────────────────────────────────────────
    const strength = classifyStrength(bot.holeCards, this.communityCards);
    const callAmount = this.lastBet - bot.bet;
    const canCheck = callAmount === 0;
    const rand = Math.random();
    const potOdds = this.pot > 0 ? callAmount / (this.pot + callAmount) : 0;

    // Can the bot actually raise? (must have chips beyond the call)
    const canRaise = bot.chips > callAmount;

    let action;
    let amount = 0;

    if (strength === 'strong') {
      // ── Strong hand: very aggressive ──────────────────────────────────────
      // Preflop: 3-bet / overbet to build pot
      // Postflop: value-bet 75–100% pot, slow-play only 10%
      if (rand < 0.80 && canRaise) {
        // Size up: 75–100% pot raise
        const multi = 0.75 + rand * 0.25;
        amount = raiseSize(multi);
        action = amount > this.lastBet ? 'raise' : (canCheck ? 'check' : 'call');
      } else if (rand < 0.92) {
        action = canCheck ? 'check' : 'call'; // occasional slow-play
      } else if (canRaise) {
        // Overbet 120% pot to pressure
        amount = raiseSize(1.2);
        action = amount > this.lastBet ? 'raise' : (canCheck ? 'check' : 'call');
      } else {
        action = canCheck ? 'check' : 'call';
      }

    } else if (strength === 'medium') {
      // ── Medium hand: selectively aggressive ───────────────────────────────
      // Raise ~40% of the time when can; call with good pot odds; fold only big bets
      if (rand < 0.40 && canRaise) {
        // Semi-aggressive: 50–75% pot raise
        amount = raiseSize(0.5 + rand * 0.25);
        action = amount > this.lastBet ? 'raise' : (canCheck ? 'check' : 'call');
      } else if (canCheck) {
        // Can check for free — always do it
        action = 'check';
      } else if (potOdds < 0.40 || callAmount <= BIG_BLIND * 3) {
        // Good pot odds or cheap call — always call
        action = 'call';
      } else if (rand < 0.25 && canRaise) {
        // Occasional bluff-raise on bad pot odds instead of folding
        amount = raiseSize(0.6);
        action = amount > this.lastBet ? 'raise' : 'fold';
      } else {
        action = 'fold';
      }

    } else {
      // ── Weak hand: bluff-heavy, never just give up cheap ──────────────────
      if (canCheck) {
        // Free check — but 30% of the time fire a bluff bet
        if (rand < 0.30 && canRaise) {
          amount = raiseSize(0.5);
          action = amount > this.lastBet ? 'raise' : 'check';
        } else {
          action = 'check';
        }
      } else if (callAmount <= BIG_BLIND) {
        // Tiny call — always call (never fold to 1 BB)
        action = 'call';
      } else if (callAmount <= BIG_BLIND * 2 && rand < 0.70) {
        // Small call — call most of the time
        action = 'call';
      } else if (rand < 0.25 && canRaise) {
        // Pure bluff raise
        amount = raiseSize(0.65);
        action = amount > this.lastBet ? 'raise' : 'fold';
      } else {
        action = 'fold';
      }
    }

    // ── Safety guards ─────────────────────────────────────────────────────────
    if (action === 'call' && bot.chips === 0) action = 'fold';
    if (action === 'raise' && bot.chips <= callAmount) action = callAmount > 0 ? 'call' : 'check';
    // Ensure raise amount is actually larger than current bet
    if (action === 'raise' && amount <= this.lastBet) action = canCheck ? 'check' : 'call';

    this.handleAction(BOT_NAME, action, amount);
  }

  clearBotTimer() {
    if (this.botTimer) {
      clearTimeout(this.botTimer);
      this.botTimer = null;
    }
  }

  // ─── Utilities ───────────────────────────────────────────────────────────────

  nextActiveIndex(fromIndex) {
    const len = this.players.length;
    for (let i = 1; i <= len; i++) {
      const idx = (fromIndex + i) % len;
      if (this.players[idx].isActive && this.players[idx].chips > 0) {
        return idx;
      }
    }
    return fromIndex;
  }

  startActionTimer() {
    this.clearActionTimer();
    const current = this.players[this.currentPlayerIndex];
    if (!current) return;

    this.emitFn('turn_changed', {
      currentPlayer: current.name,
      timeLimit: ACTION_TIMEOUT_MS / 1000,
      state: this.getPublicState(),
    });

    // If it's the bot's turn, schedule bot action instead of timeout auto-fold
    if (current.isBot) {
      this.scheduleBotAction();
      return;
    }

    // Human player timeout → auto fold
    this.actionTimer = setTimeout(() => {
      console.log(`[PokerEngine] ${current.name} timed out, auto-fold`);
      this.handleAction(current.name, 'fold');
    }, ACTION_TIMEOUT_MS);
  }

  clearActionTimer() {
    if (this.actionTimer) {
      clearTimeout(this.actionTimer);
      this.actionTimer = null;
    }
  }

  getPlayerRawActions(playerName) {
    // All completed hands are in handHistory (currentHandActions is cleared after each hand)
    const allActions = [];
    for (const hand of this.handHistory) {
      const actions = hand.actions[playerName] || [];
      allActions.push(...actions);
    }
    return allActions;
  }

  getSessionPlayerResults() {
    return this.players
      .filter((p) => p.isActive)
      .map((p) => ({
        name: p.name,
        startChips: STARTING_CHIPS,
        endChips: p.chips,
        rawActions: this.getPlayerRawActions(p.name),
        isBot: p.isBot,
      }));
  }
}

module.exports = { PokerEngine, STARTING_CHIPS, SMALL_BLIND, BIG_BLIND, BOT_NAME };
