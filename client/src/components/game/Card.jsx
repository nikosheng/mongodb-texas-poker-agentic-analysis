/**
 * Card — renders a playing card using deckofcardsapi.com PNG images.
 *
 * Card code format from the server: rank+suit, e.g. "As", "Kh", "Td", "2c", "XX"
 * CDN format: RANKSUIT.png, e.g. "AS.png", "KH.png", "0D.png" (Ten = "0"), "back.png"
 *
 * Width is controlled via clamp(min, vw, max); height is always "auto" so the
 * image keeps its natural aspect ratio — no overflow, no clipping, no manual height.
 */

const WIDTHS = {
  sm: 'clamp(28px, 3.5vw, 46px)',
  md: 'clamp(40px, 4.8vw, 64px)',
  lg: 'clamp(52px, 6.2vw, 86px)',
  xl: 'clamp(68px, 8.5vw, 118px)',
};

function toUrl(code) {
  if (!code || code === 'XX') return '/cards/back.png';
  const rank = code[0] === 'T' ? '0' : code[0].toUpperCase();
  const suit = code[code.length - 1].toUpperCase();
  return `/cards/${rank}${suit}.png`;
}

export default function Card({ code, size = 'md', faceDown = false, className = '' }) {
  const url = (faceDown || !code || code === 'XX') ? '/cards/back.png' : toUrl(code);
  const width = WIDTHS[size] || WIDTHS.md;

  return (
    <img
      src={url}
      alt={code || 'card'}
      className={`animate-deal shadow-md rounded select-none ${className}`}
      style={{ width, height: 'auto', flexShrink: 0, display: 'block' }}
      draggable={false}
      onError={(e) => { e.target.src = '/cards/back.png'; }}
    />
  );
}
