require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const mongo = require('./services/MongoService');
const { setupSocketHandlers } = require('./socket/GameSocketHandler');
const playersRouter = require('./routes/players');
const gamesRouter = require('./routes/games');
const chatbotRouter = require('./routes/chatbot');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: [
      process.env.CLIENT_URL || 'http://localhost:5173',
      process.env.DASHBOARD_URL || 'http://localhost:5174',
    ],
    methods: ['GET', 'POST'],
  },
});

// Middleware
app.use(cors({
  origin: [
    process.env.CLIENT_URL || 'http://localhost:5173',
    process.env.DASHBOARD_URL || 'http://localhost:5174',
  ],
}));
app.use(express.json());

// Routes
app.use('/api/players', playersRouter);
app.use('/api/games', gamesRouter);
app.use('/api/chatbot', chatbotRouter);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Socket.io
setupSocketHandlers(io);

// Start
const PORT = process.env.PORT || 3001;

mongo
  .connect()
  .then(() => {
    server.listen(PORT, () => {
      console.log(`[Server] Running on port ${PORT}`);
      console.log(`[Server] Client: ${process.env.CLIENT_URL}`);
      console.log(`[Server] Dashboard: ${process.env.DASHBOARD_URL}`);
    });
  })
  .catch((err) => {
    console.error('[Server] Failed to connect to MongoDB:', err.message);
    process.exit(1);
  });
