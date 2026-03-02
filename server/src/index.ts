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
  getRoom,
  getRoomBySocket,
  giveClue,
  listRooms,
  removeSocket,
  returnToLobby,
  setSocketRoom,
  setWordPool,
  startGame,
  shuffleAndStart,
  voteCard,
} from './gameManager';

const app = express();
app.use(cors());

const httpServer = createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: { origin: '*' },
  pingTimeout: 60000,   // wait 60 s before declaring a client disconnected
  pingInterval: 25000,  // send heartbeat every 25 s (default)
});

function broadcast(roomCode: string, state: Parameters<ServerToClientEvents['gameState']>[0]): void {
  io.to(roomCode).emit('gameState', state);
}

function broadcastRoomList(): void {
  io.emit('roomList', listRooms());
}

// ── Turn timers ──────────────────────────────────────────────────────────────
// Reads turnStartedAt + turnDuration from state to compute remaining ms.
const turnTimers = new Map<string, ReturnType<typeof setTimeout>>();

function clearTurnTimer(roomCode: string): void {
  const t = turnTimers.get(roomCode);
  if (t) clearTimeout(t);
  turnTimers.delete(roomCode);
}

function scheduleTurnTimer(roomCode: string): void {
  clearTurnTimer(roomCode);
  const state = getRoom(roomCode);
  if (!state || state.phase !== 'playing' || !state.turnStartedAt) return;

  const elapsedMs    = Date.now() - state.turnStartedAt;
  const remainingMs  = Math.max(500, state.turnDuration * 1000 - elapsedMs);

  const t = setTimeout(() => {
    const s = getRoom(roomCode);
    if (!s || s.phase !== 'playing') return;
    endTurn(s);
    broadcast(roomCode, s);
    scheduleTurnTimer(roomCode); // next clue phase
  }, remainingMs);

  turnTimers.set(roomCode, t);
}
// ────────────────────────────────────────────────────────────────────────────

io.on('connection', socket => {
  console.log(`Socket connected: ${socket.id}`);

  socket.on('getRooms', () => {
    socket.emit('roomList', listRooms());
  });

  socket.on('joinRoom', ({ roomCode, playerName }) => {
    const state = getOrCreateRoom(roomCode);
    addPlayer(state, {
      id: socket.id,
      name: playerName,
      team: 'red',
      role: 'operative',
    });
    setSocketRoom(socket.id, roomCode);
    socket.join(roomCode);
    broadcast(roomCode, state);
    broadcastRoomList();
  });

  socket.on('chooseTeam', ({ team }) => {
    const state = getRoomBySocket(socket.id);
    if (!state) return;
    const err = chooseTeam(state, socket.id, team);
    if (err) { socket.emit('error', err); return; }
    broadcast(state.roomCode, state);
  });

  socket.on('chooseRole', ({ role }) => {
    const state = getRoomBySocket(socket.id);
    if (!state) return;
    const err = chooseRole(state, socket.id, role);
    if (err) { socket.emit('error', err); return; }
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
    if (err) { socket.emit('error', err); return; }
    broadcast(state.roomCode, state);
    scheduleTurnTimer(state.roomCode);
    broadcastRoomList();
  });

  socket.on('startGameShuffled', () => {
    const state = getRoomBySocket(socket.id);
    if (!state) return;
    const err = shuffleAndStart(state);
    if (err) { socket.emit('error', err); return; }
    broadcast(state.roomCode, state);
    scheduleTurnTimer(state.roomCode);
    broadcastRoomList();
  });

  socket.on('returnToLobby', () => {
    const state = getRoomBySocket(socket.id);
    if (!state) return;
    clearTurnTimer(state.roomCode);
    returnToLobby(state);
    broadcast(state.roomCode, state);
    broadcastRoomList();
  });

  socket.on('giveClue', ({ word, count }) => {
    const state = getRoomBySocket(socket.id);
    if (!state) return;
    const err = giveClue(state, socket.id, word, count);
    if (err) { socket.emit('error', err); return; }
    broadcast(state.roomCode, state);
    // Switch to guess-phase timer (1 min)
    scheduleTurnTimer(state.roomCode);
  });

  socket.on('voteCard', ({ cardIndex }) => {
    const state = getRoomBySocket(socket.id);
    if (!state) return;
    const { error, result } = voteCard(state, socket.id, cardIndex);
    if (error) { socket.emit('error', error); return; }
    broadcast(state.roomCode, state);

    if (result === 'game_ended') {
      clearTurnTimer(state.roomCode);
    } else if (result === 'turn_ended') {
      // endTurn was called inside voteCard → new clue phase timer
      scheduleTurnTimer(state.roomCode);
    } else if (result === 'correct') {
      // +15 s was already applied in state; reschedule with new remaining
      scheduleTurnTimer(state.roomCode);
    }
    // result === null → just a vote placed, no card revealed yet
  });

  socket.on('endTurn', () => {
    const state = getRoomBySocket(socket.id);
    if (!state) return;
    const player = state.players.find(p => p.id === socket.id);
    if (!player || player.role !== 'operative' || player.team !== state.currentTeam) return;
    endTurn(state);
    broadcast(state.roomCode, state);
    scheduleTurnTimer(state.roomCode);
  });

  socket.on('leaveRoom', () => {
    const state = getRoomBySocket(socket.id);
    if (!state) return;
    const { roomCode } = state;
    const result = removeSocket(socket.id);
    if (result) {
      // Socket is still in the io room here, so leaver receives this broadcast too,
      // sees themselves removed from players → myPlayer becomes null → join screen
      broadcast(result.roomCode, result.state);
    } else {
      // Last player — room deleted; send a blank lobby state directly
      socket.emit('gameState', { ...state, players: [], hostId: '' });
    }
    socket.leave(roomCode);
    broadcastRoomList();
  });

  socket.on('disconnect', () => {
    console.log(`Socket disconnected: ${socket.id}`);
    const result = removeSocket(socket.id);
    if (result) broadcast(result.roomCode, result.state);
    broadcastRoomList();
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
