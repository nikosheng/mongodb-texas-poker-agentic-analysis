import { useEffect, useRef } from 'react';

export default function GameLog({ logs }) {
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  return (
    <div className="bg-black/50 border border-white/10 rounded-xl h-48 overflow-y-auto p-3">
      <div className="text-gold/60 text-xs font-cinzel mb-2 uppercase tracking-wider">遊戲記錄</div>
      {logs.length === 0 && (
        <div className="text-gray-600 text-xs text-center py-4">等待遊戲開始...</div>
      )}
      {logs.map((log, i) => (
        <div key={log.ts + i} className="text-gray-300 text-xs py-0.5 border-b border-white/5 last:border-0">
          {log.msg}
        </div>
      ))}
      <div ref={endRef} />
    </div>
  );
}
