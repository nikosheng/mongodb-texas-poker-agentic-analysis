import { useState } from 'react';
import Sidebar from './components/Sidebar';
import Overview from './components/Overview';
import PlayerAnalysis from './components/PlayerAnalysis';
import GameRecords from './components/GameRecords';
import Chatbot from './components/Chatbot';

export default function App() {
  const [page, setPage] = useState('overview');
  const [playerFocus, setPlayerFocus] = useState(null);

  const navigate = (target, param = null) => {
    setPage(target);
    if (target === 'players' && param) setPlayerFocus(param);
  };

  return (
    <div className="flex min-h-screen">
      <Sidebar active={page} onSelect={(p) => { setPage(p); setPlayerFocus(null); }} />

      <main className="flex-1 overflow-y-auto">
        {page === 'overview' && <Overview onNavigate={navigate} />}
        {page === 'players' && (
          <PlayerAnalysis initialPlayer={playerFocus} key={playerFocus} />
        )}
        {page === 'games' && <GameRecords />}
        {page === 'chatbot' && <Chatbot />}
      </main>
    </div>
  );
}
