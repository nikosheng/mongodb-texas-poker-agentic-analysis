const TAG_STYLES = {
  '激進型': 'badge-aggressive',
  '保守型': 'badge-conservative',
  '均衡型': 'badge-balanced',
  '謹慎型': 'badge-conservative',
  '豪賭型': 'badge-whale',
  '高頻玩家': 'bg-yellow-900/40 text-yellow-300 border border-yellow-700/40',
  '新玩家': 'badge-new',
};

export default function PlayerBadge({ tag }) {
  const cls = TAG_STYLES[tag] || 'badge-new';
  return (
    <span className={`text-xs px-2.5 py-0.5 rounded-full border font-medium ${cls}`}>
      {tag}
    </span>
  );
}
