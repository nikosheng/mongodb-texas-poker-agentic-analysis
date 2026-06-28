import Card from './Card';

const PHASE_LABELS = {
  preflop:  'Pre-Flop',
  flop:     'Flop',
  turn:     'Turn',
  river:    'River',
  showdown: 'Showdown',
};

// Placeholder slot matches Card size="lg" width clamp and the local image
// aspect-ratio (500×726 ≈ 2:2.9, close enough to treat as 2:3).
const SLOT_STYLE = {
  width:       'clamp(52px, 6.2vw, 86px)',
  aspectRatio: '500 / 726',
  flexShrink:  0,
  borderRadius: 4,
  border:      '2px dashed rgba(255,255,255,0.18)',
  background:  'rgba(0,0,0,0.22)',
};

export default function CommunityCards({ cards = [], phase, pot }) {
  return (
    <div className="flex flex-col items-center gap-3">
      {/* Phase label */}
      <div className="text-gold/80 font-cinzel tracking-widest uppercase"
           style={{ fontSize: 'clamp(10px, 1.1vw, 15px)' }}>
        {PHASE_LABELS[phase] || phase}
      </div>

      {/* Cards row */}
      <div className="flex items-end gap-2">
        {cards.map((card, i) => (
          <Card key={i} code={card} size="lg" />
        ))}
        {Array.from({ length: Math.max(0, 5 - cards.length) }).map((_, i) => (
          <div key={`ph-${i}`} style={SLOT_STYLE} />
        ))}
      </div>

      {/* Pot */}
      <div className="bg-black/40 border border-gold/30 rounded-full flex items-center gap-2"
           style={{ padding: 'clamp(4px,0.5vw,8px) clamp(14px,2vw,28px)' }}>
        <span className="text-gray-400" style={{ fontSize: 'clamp(10px,1vw,13px)' }}>底池</span>
        <span className="text-gold font-bold font-cinzel"
              style={{ fontSize: 'clamp(14px,1.5vw,22px)' }}>
          {pot?.toLocaleString() || 0}
        </span>
        <span className="text-gray-400" style={{ fontSize: 'clamp(10px,1vw,13px)' }}>籌碼</span>
      </div>
    </div>
  );
}
