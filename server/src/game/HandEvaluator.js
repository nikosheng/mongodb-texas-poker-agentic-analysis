const { RANK_VALUE } = require('./DeckManager');

/**
 * Evaluates the best 5-card hand from any number of cards (typically 7).
 * Returns { rank, name, cards } where rank is a numeric score (higher = better).
 */

const HAND_NAMES = [
  'High Card',      // 0
  'One Pair',       // 1
  'Two Pair',       // 2
  'Three of a Kind',// 3
  'Straight',       // 4
  'Flush',          // 5
  'Full House',     // 6
  'Four of a Kind', // 7
  'Straight Flush', // 8
  'Royal Flush',    // 9
];

const HAND_NAMES_ZH = [
  '高牌',
  '一對',
  '兩對',
  '三條',
  '順子',
  '同花',
  '葫蘆',
  '四條',
  '同花順',
  '皇家同花順',
];

function rankValue(card) {
  return RANK_VALUE[card.slice(0, -1)] || 0;
}

function suitOf(card) {
  return card[card.length - 1];
}

function rankOf(card) {
  return card.slice(0, -1);
}

// Generate all combinations of k from arr
function combinations(arr, k) {
  if (k === 0) return [[]];
  if (arr.length < k) return [];
  const [first, ...rest] = arr;
  const withFirst = combinations(rest, k - 1).map((c) => [first, ...c]);
  const withoutFirst = combinations(rest, k);
  return [...withFirst, ...withoutFirst];
}

// Evaluate exactly 5 cards -> numeric score (comparable)
function evaluate5(cards) {
  const vals = cards.map(rankValue).sort((a, b) => b - a);
  const suits = cards.map(suitOf);
  const isFlush = suits.every((s) => s === suits[0]);

  // Check straight
  const uniqueVals = [...new Set(vals)];
  let isStraight = false;
  let straightHigh = 0;
  if (uniqueVals.length === 5 && vals[0] - vals[4] === 4) {
    isStraight = true;
    straightHigh = vals[0];
  }
  // Ace-low straight: A-2-3-4-5
  if (!isStraight && uniqueVals.length === 5) {
    const sorted = [...uniqueVals].sort((a, b) => a - b);
    if (
      sorted[4] === 14 &&
      sorted[0] === 2 &&
      sorted[1] === 3 &&
      sorted[2] === 4 &&
      sorted[3] === 5
    ) {
      isStraight = true;
      straightHigh = 5;
    }
  }

  // Count rank frequencies
  const freq = {};
  for (const v of vals) freq[v] = (freq[v] || 0) + 1;
  const counts = Object.values(freq).sort((a, b) => b - a);
  const countKeys = Object.entries(freq)
    .sort((a, b) => b[1] - a[1] || b[0] - a[0])
    .map(([k]) => Number(k));

  // Royal Flush
  if (isFlush && isStraight && straightHigh === 14) {
    return { category: 9, tiebreakers: [14], name: HAND_NAMES[9], nameZh: HAND_NAMES_ZH[9] };
  }
  // Straight Flush
  if (isFlush && isStraight) {
    return { category: 8, tiebreakers: [straightHigh], name: HAND_NAMES[8], nameZh: HAND_NAMES_ZH[8] };
  }
  // Four of a Kind
  if (counts[0] === 4) {
    const quad = countKeys[0];
    const kicker = countKeys[1];
    return { category: 7, tiebreakers: [quad, kicker], name: HAND_NAMES[7], nameZh: HAND_NAMES_ZH[7] };
  }
  // Full House
  if (counts[0] === 3 && counts[1] === 2) {
    return { category: 6, tiebreakers: [countKeys[0], countKeys[1]], name: HAND_NAMES[6], nameZh: HAND_NAMES_ZH[6] };
  }
  // Flush
  if (isFlush) {
    return { category: 5, tiebreakers: vals, name: HAND_NAMES[5], nameZh: HAND_NAMES_ZH[5] };
  }
  // Straight
  if (isStraight) {
    return { category: 4, tiebreakers: [straightHigh], name: HAND_NAMES[4], nameZh: HAND_NAMES_ZH[4] };
  }
  // Three of a Kind
  if (counts[0] === 3) {
    const trips = countKeys[0];
    const kickers = countKeys.slice(1);
    return { category: 3, tiebreakers: [trips, ...kickers], name: HAND_NAMES[3], nameZh: HAND_NAMES_ZH[3] };
  }
  // Two Pair
  if (counts[0] === 2 && counts[1] === 2) {
    const pair1 = Math.max(countKeys[0], countKeys[1]);
    const pair2 = Math.min(countKeys[0], countKeys[1]);
    const kicker = countKeys[2];
    return { category: 2, tiebreakers: [pair1, pair2, kicker], name: HAND_NAMES[2], nameZh: HAND_NAMES_ZH[2] };
  }
  // One Pair
  if (counts[0] === 2) {
    const pair = countKeys[0];
    const kickers = countKeys.slice(1);
    return { category: 1, tiebreakers: [pair, ...kickers], name: HAND_NAMES[1], nameZh: HAND_NAMES_ZH[1] };
  }
  // High Card
  return { category: 0, tiebreakers: vals, name: HAND_NAMES[0], nameZh: HAND_NAMES_ZH[0] };
}

// Compare two evaluated hands; returns positive if a > b
function compareHands(a, b) {
  if (a.category !== b.category) return a.category - b.category;
  for (let i = 0; i < Math.max(a.tiebreakers.length, b.tiebreakers.length); i++) {
    const diff = (a.tiebreakers[i] || 0) - (b.tiebreakers[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

/**
 * Best hand from 5–7 cards
 * @param {string[]} cards
 * @returns {{ category, name, nameZh, tiebreakers, bestCards }}
 */
function evaluate(cards) {
  if (cards.length < 5) throw new Error('Need at least 5 cards');
  if (cards.length === 5) {
    return { ...evaluate5(cards), bestCards: cards };
  }
  const combos = combinations(cards, 5);
  let best = null;
  let bestCards = null;
  for (const combo of combos) {
    const result = evaluate5(combo);
    if (!best || compareHands(result, best) > 0) {
      best = result;
      bestCards = combo;
    }
  }
  return { ...best, bestCards };
}

/**
 * Determine winners from an array of { name, holeCards } + communityCards
 * Returns array of winner names (could be ties)
 */
function determineWinners(players, communityCards) {
  const evaluated = players.map((p) => ({
    name: p.name,
    hand: evaluate([...p.holeCards, ...communityCards]),
  }));

  evaluated.sort((a, b) => compareHands(b.hand, a.hand));
  const best = evaluated[0].hand;
  const winners = evaluated.filter((e) => compareHands(e.hand, best) === 0);
  return {
    winners: winners.map((w) => w.name),
    hands: evaluated.map((e) => ({ name: e.name, ...e.hand })),
  };
}

/**
 * Classify hand strength relative to street for behavior tracking
 * strong / medium / weak
 */
function classifyStrength(holeCards, communityCards) {
  const allCards = [...holeCards, ...communityCards];

  if (allCards.length < 5) {
    // ── Pre-flop: use standard poker hand groupings ────────────────────────
    const vals = holeCards.map((c) => RANK_VALUE[c.slice(0, -1)]);
    const hi = Math.max(...vals);
    const lo = Math.min(...vals);
    const isPair = vals[0] === vals[1];
    const suited = holeCards[0][holeCards[0].length - 1] === holeCards[1][holeCards[1].length - 1];
    const gap = hi - lo;

    // Premium: high pairs (TT+), AK, AQ suited
    if ((isPair && hi >= 10) || (hi === 14 && lo >= 12) || (hi === 14 && lo === 11 && suited)) {
      return 'strong';
    }
    // Playable: any pair, any ace, KQ, KJ, QJ, suited connectors (gap ≤ 2, both ≥ 7)
    if (
      isPair ||
      hi === 14 ||
      (hi === 13 && lo >= 11) ||
      (hi === 12 && lo >= 11) ||
      (suited && gap <= 2 && lo >= 7)
    ) {
      return 'medium';
    }
    // Everything else: weak but still playable — don't auto-fold
    // Off-suit broadways (KJ, QT, JT) or suited with decent ranks
    if ((hi >= 11 && lo >= 9) || (suited && lo >= 6)) return 'medium';
    return 'weak';
  }

  // ── Post-flop: evaluate actual hand ────────────────────────────────────
  const result = evaluate(allCards);
  if (result.category >= 3) return 'strong';   // Three of a kind or better
  if (result.category >= 1) return 'medium';   // One pair / two pair
  return 'weak';                                // High card only
}

module.exports = { evaluate, determineWinners, classifyStrength, compareHands, HAND_NAMES_ZH };
