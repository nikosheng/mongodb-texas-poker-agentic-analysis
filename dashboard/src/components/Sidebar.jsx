const NAV = [
  { id: 'overview', label: '總覽', icon: '▦' },
  { id: 'players', label: '玩家分析', icon: '◉' },
  { id: 'games', label: '遊戲記錄', icon: '♠' },
  { id: 'chatbot', label: 'AI Chatbot', icon: '✦' },
];

export default function Sidebar({ active, onSelect }) {
  return (
    <aside className="w-60 min-h-screen bg-[#001428] border-r border-white/10 flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-mongo-green flex items-center justify-center">
            <span className="text-mongo-black font-black text-sm">M</span>
          </div>
          <div>
            <div className="font-cinzel text-white font-bold text-sm">MongoDB</div>
            <div className="text-gray-500 text-xs">Marketing Hub</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-4 space-y-1">
        {NAV.map((item) => (
          <button
            key={item.id}
            onClick={() => onSelect(item.id)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all
              ${active === item.id
                ? 'bg-mongo-green/20 text-mongo-green border border-mongo-green/30'
                : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}
          >
            <span className="text-lg">{item.icon}</span>
            <span className="font-medium text-sm">{item.label}</span>
          </button>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-white/10">
        <div className="text-gray-600 text-xs text-center">
          Powered by Atlas Vector Search
          <br />
          + Voyage-4 Embedding
        </div>
      </div>
    </aside>
  );
}
