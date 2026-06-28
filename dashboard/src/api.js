import axios from 'axios';

const BASE = '/api';

export const api = {
  // Players
  getPlayers: () => axios.get(`${BASE}/players`).then(r => r.data.data),
  getPlayer: (name) => axios.get(`${BASE}/players/${encodeURIComponent(name)}`).then(r => r.data.data),
  getPlayerActions: (name, limit = 10) =>
    axios.get(`${BASE}/players/${encodeURIComponent(name)}/actions?limit=${limit}`).then(r => r.data.data),
  getPlayerStats: (name) =>
    axios.get(`${BASE}/players/${encodeURIComponent(name)}/stats`).then(r => r.data.data),

  // Games
  getGames: (limit = 20) => axios.get(`${BASE}/games?limit=${limit}`).then(r => r.data.data),
  getGame: (sessionId) => axios.get(`${BASE}/games/${sessionId}`).then(r => r.data.data),

  // Chatbot
  queryChatbot: (question, playerName = null) =>
    axios.post(`${BASE}/chatbot/query`, { question, playerName }).then(r => r.data.data),
  getChatbotPlayers: () => axios.get(`${BASE}/chatbot/players`).then(r => r.data.data),
};
