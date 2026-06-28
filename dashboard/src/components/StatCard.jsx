export default function StatCard({ label, value, sub, color = 'green', icon }) {
  const colors = {
    green: 'text-mongo-green',
    gold: 'text-yellow-400',
    red: 'text-red-400',
    blue: 'text-blue-400',
    purple: 'text-purple-400',
  };
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between mb-2">
        <span className="text-gray-400 text-sm">{label}</span>
        {icon && <span className="text-2xl opacity-60">{icon}</span>}
      </div>
      <div className={`text-3xl font-bold font-cinzel ${colors[color]}`}>{value}</div>
      {sub && <div className="text-gray-500 text-xs mt-1">{sub}</div>}
    </div>
  );
}
