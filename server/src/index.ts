import cors from 'cors';
import express from 'express';
import { createServer } from 'http';
import path from 'path';
import { Server } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '@codenames/shared';
import {
  addPlayer,
  chooseRole,
  chooseTeam,
  endTurn,
  getOrCreateRoom,
  getRoomBySocket,
  giveClue,
  removeSocket,
  returnToLobby,
  revealCard,
  setSocketRoom,
  setWordPool,
  startGame,
} from './gameManager';

const app = express();
app.use(cors());

const httpServer = createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: { origin: '*' },
});

function broadcast(roomCode: string, state: Parameters<ServerToClientEvents['gameState']>[0]): void {
  io.to(roomCode).emit('gameState', state);
}

io.on('connection', socket => {
  console.log(`Socket connected: ${socket.id}`);

  socket.on('joinRoom', ({ roomCode, playerName }) => {
    const state = getOrCreateRoom(roomCode);
    const player = {
      id: socket.id,
      name: playerName,
      team: 'red' as const,
      role: 'operative' as const,
    };
    addPlayer(state, player);
    setSocketRoom(socket.id, roomCode);
    socket.join(roomCode);
    broadcast(roomCode, state);
  });

  socket.on('chooseTeam', ({ team }) => {
    const state = getRoomBySocket(socket.id);
    if (!state) return;
    chooseTeam(state, socket.id, team);
    broadcast(state.roomCode, state);
  });

  socket.on('chooseRole', ({ role }) => {
    const state = getRoomBySocket(socket.id);
    if (!state) return;
    chooseRole(state, socket.id, role);
    broadcast(state.roomCode, state);
  });

  socket.on('uploadWords', ({ words }) => {
    const state = getRoomBySocket(socket.id);
    if (!state) return;
    setWordPool(state, words);
    broadcast(state.roomCode, state);
  });

  socket.on('startGame', () => {
    const state = getRoomBySocket(socket.id);
    if (!state) return;
    const err = startGame(state);
    if (err) {
      socket.emit('error', err);
      return;
    }
    broadcast(state.roomCode, state);
  });

  socket.on('returnToLobby', () => {
    const state = getRoomBySocket(socket.id);
    if (!state) return;
    returnToLobby(state);
    broadcast(state.roomCode, state);
  });

  socket.on('giveClue', ({ word, count }) => {
    const state = getRoomBySocket(socket.id);
    if (!state) return;
    const err = giveClue(state, socket.id, word, count);
    if (err) {
      socket.emit('error', err);
      return;
    }
    broadcast(state.roomCode, state);
  });

  socket.on('revealCard', ({ cardIndex }) => {
    const state = getRoomBySocket(socket.id);
    if (!state) return;
    const err = revealCard(state, socket.id, cardIndex);
    if (err) {
      socket.emit('error', err);
      return;
    }
    broadcast(state.roomCode, state);
  });

  socket.on('endTurn', () => {
    const state = getRoomBySocket(socket.id);
    if (!state) return;
    const player = state.players.find(p => p.id === socket.id);
    if (!player || player.role !== 'operative' || player.team !== state.currentTeam) return;
    endTurn(state);
    broadcast(state.roomCode, state);
  });

  socket.on('disconnect', () => {
    console.log(`Socket disconnected: ${socket.id}`);
    const result = removeSocket(socket.id);
    if (result) broadcast(result.roomCode, result.state);
  });
});

// Serve built React client in production
if (process.env.NODE_ENV === 'production') {
  const clientDist = path.join(__dirname, '../../client/dist');
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));
}

const PORT = process.env.PORT ?? 3001;
httpServer.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
