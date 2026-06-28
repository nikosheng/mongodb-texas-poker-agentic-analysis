const SUITS = ['s', 'h', 'd', 'c']; // spades, hearts, diamonds, clubs
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];

const RANK_VALUE = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6,
  '7': 7, '8': 8, '9': 9, 'T': 10,
  'J': 11, 'Q': 12, 'K': 13, 'A': 14,
};

const SUIT_LABEL = { s: '♠', h: '♥', d: '♦', c: '♣' };
const RANK_LABEL = {
  '2': '2', '3': '3', '4': '4', '5': '5', '6': '6',
  '7': '7', '8': '8', '9': '9', 'T': '10',
  'J': 'J', 'Q': 'Q', 'K': 'K', 'A': 'A',
};

class DeckManager {
  constructor() {
    this.deck = [];
    this.init();
  }

  init() {
    this.deck = [];
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        this.deck.push(`${rank}${suit}`);
      }
    }
  }

  shuffle() {
    // Fisher-Yates
    for (let i = this.deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
    }
    return this;
  }

  deal(count) {
    if (this.deck.length < count) throw new Error('Not enough cards in deck');
    return this.deck.splice(0, count);
  }

  remaining() {
    return this.deck.length;
  }

  reset() {
    this.init();
    return this;
  }

  static rankValue(card) {
    return RANK_VALUE[card[0]] || 0;
  }

  static suitOf(card) {
    return card[card.length - 1];
  }

  static rankOf(card) {
    return card.slice(0, -1);
  }

  static cardLabel(card) {
    const rank = card.slice(0, -1);
    const suit = card[card.length - 1];
    return `${RANK_LABEL[rank]}${SUIT_LABEL[suit]}`;
  }

  static isRed(card) {
    const suit = card[card.length - 1];
    return suit === 'h' || suit === 'd';
  }
}

module.exports = { DeckManager, RANK_VALUE };
