import { useEffect, useState } from 'react';

export default function Toast({ message }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (message) {
      setVisible(true);
      const t = setTimeout(() => setVisible(false), 3500);
      return () => clearTimeout(t);
    }
  }, [message]);

  if (!message || !visible) return null;

  return (
    <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 animate-slide-up">
      <div className="bg-red-900/90 border border-red-500/50 text-white px-5 py-3 rounded-xl shadow-xl text-sm">
        {message}
      </div>
    </div>
  );
}
