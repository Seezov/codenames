import { Card, CardType, GameState, Player, Role, Team } from '@codenames/shared';

const rooms = new Map<string, GameState>();
const socketToRoom = new Map<string, string>();

// Distinct personal colors for players (avoid pure red/blue)
const PLAYER_COLORS = [
  '#f4a261', // orange
  '#2a9d8f', // teal
  '#e9c46a', // gold
  '#c77dff', // purple
  '#48cae4', // cyan
  '#f72585', // pink
  '#95d5b2', // mint
  '#ff9f1c', // amber
];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── Internal reveal helper ────────────────────────────────────────────────────
// Returns true if the turn ended or game ended (so caller can reschedule timer).
export type RevealResult = 'correct' | 'turn_ended' | 'game_ended';

function applyReveal(state: GameState, cardIndex: number): RevealResult {
  const card = state.board[cardIndex];
  card.revealed = true;
  state.log.push({ team: state.currentTeam, type: 'guess', word: card.word, result: card.type });
  state.cardVotes = {};

  if (card.type === 'assassin') {
    state.winner = state.currentTeam === 'red' ? 'blue' : 'red';
    state.phase = 'ended';
    rooms.set(state.roomCode, state);
    return 'game_ended';
  }

  if (card.type === 'red') state.scores.red++;
  if (card.type === 'blue') state.scores.blue++;

  const redTotal  = state.board.filter(c => c.type === 'red').length;
  const blueTotal = state.board.filter(c => c.type === 'blue').length;
  if (state.scores.red >= redTotal)  { state.winner = 'red';  state.phase = 'ended'; rooms.set(state.roomCode, state); return 'game_ended'; }
  if (state.scores.blue >= blueTotal){ state.winner = 'blue'; state.phase = 'ended'; rooms.set(state.roomCode, state); return 'game_ended'; }

  if (card.type !== state.currentTeam) {
    endTurn(state);
    return 'turn_ended';
  }

  // Correct guess — add 15 s bonus
  state.turnDuration += 15;
  rooms.set(state.roomCode, state);
  return 'correct';
}
// ─────────────────────────────────────────────────────────────────────────────

export function createRoom(roomCode: string): GameState {
  const state: GameState = {
    roomCode,
    board: [],
    players: [],
    currentTeam: 'red',
    phase: 'lobby',
    clue: null,
    guessesLeft: 0,
    scores: { red: 0, blue: 0 },
    winner: null,
    wordPool: [],
    log: [],
    turnNumber: 0,
    turnDuration: 0,
    turnStartedAt: null,
    cardVotes: {},
    hostId: '',
  };
  rooms.set(roomCode, state);
  return state;
}

export function getRoom(roomCode: string): GameState | undefined {
  return rooms.get(roomCode);
}

export function getOrCreateRoom(roomCode: string): GameState {
  return rooms.get(roomCode) ?? createRoom(roomCode);
}

export function setSocketRoom(socketId: string, roomCode: string): void {
  socketToRoom.set(socketId, roomCode);
}

export function getRoomBySocket(socketId: string): GameState | undefined {
  const roomCode = socketToRoom.get(socketId);
  return roomCode ? rooms.get(roomCode) : undefined;
}

export function removeSocket(socketId: string): { roomCode: string; state: GameState } | undefined {
  const roomCode = socketToRoom.get(socketId);
  if (!roomCode) return undefined;
  socketToRoom.delete(socketId);

  const state = rooms.get(roomCode);
  if (!state) return undefined;

  state.players = state.players.filter(p => p.id !== socketId);
  // Remove any pending vote from the disconnected player
  delete state.cardVotes[socketId];

  if (state.players.length === 0) {
    rooms.delete(roomCode);
    return undefined;
  }

  // Transfer host if the host left
  if (state.hostId === socketId) {
    state.hostId = state.players[0].id;
  }

  rooms.set(roomCode, state);
  return { roomCode, state };
}

export function addPlayer(state: GameState, player: Omit<Player, 'color'>): void {
  const existing = state.players.find(p => p.id === player.id);
  if (!existing) {
    const usedColors = new Set(state.players.map(p => p.color));
    const color = PLAYER_COLORS.find(c => !usedColors.has(c)) ?? PLAYER_COLORS[state.players.length % PLAYER_COLORS.length];
    state.players.push({ ...player, color });
    // First player to join becomes host
    if (state.players.length === 1) state.hostId = player.id;
  }
  rooms.set(state.roomCode, state);
}

export function chooseTeam(state: GameState, playerId: string, team: Team): string | null {
  const player = state.players.find(p => p.id === playerId);
  if (!player) return 'Player not found.';
  if (player.team === team) return null;

  if (state.phase === 'playing') {
    // Ensure old team keeps spy + op after this player leaves
    const remaining = state.players.filter(p => p.team === player.team && p.id !== playerId);
    if (!remaining.some(p => p.role === 'spymaster')) return 'Your team would have no spymaster left.';
    if (!remaining.some(p => p.role === 'operative')) return 'Your team would have no operative left.';
    // Spymaster cannot join a team that already has one
    if (player.role === 'spymaster' && state.players.some(p => p.team === team && p.role === 'spymaster')) {
      return 'That team already has a spymaster.';
    }
  }

  player.team = team;
  delete state.cardVotes[playerId];
  rooms.set(state.roomCode, state);
  return null;
}

export function chooseRole(state: GameState, playerId: string, role: Role): string | null {
  const player = state.players.find(p => p.id === playerId);
  if (!player) return 'Player not found.';
  if (role === 'spymaster') {
    const teamAlreadyHasSpy = state.players.some(
      p => p.team === player.team && p.role === 'spymaster' && p.id !== playerId
    );
    if (teamAlreadyHasSpy) return 'Your team already has a spymaster.';
  }
  player.role = role;
  rooms.set(state.roomCode, state);
  return null;
}

export function setWordPool(state: GameState, words: string[]): void {
  state.wordPool = words;
  rooms.set(state.roomCode, state);
}

export function startGame(state: GameState): string | null {
  if (state.wordPool.length < 25) return 'Need at least 25 words in the word pool.';

  const hasRedSpy  = state.players.some(p => p.team === 'red'  && p.role === 'spymaster');
  const hasRedOp   = state.players.some(p => p.team === 'red'  && p.role === 'operative');
  const hasBlueSpy = state.players.some(p => p.team === 'blue' && p.role === 'spymaster');
  const hasBlueOp  = state.players.some(p => p.team === 'blue' && p.role === 'operative');
  if (!hasRedSpy || !hasRedOp)   return 'Red team needs at least 1 spymaster and 1 operative.';
  if (!hasBlueSpy || !hasBlueOp) return 'Blue team needs at least 1 spymaster and 1 operative.';

  const words = shuffle(state.wordPool).slice(0, 25);

  // Red goes first → 9 red cards; blue gets 8; 1 assassin; 7 neutral
  const types: CardType[] = [
    ...Array(9).fill('red'),
    ...Array(8).fill('blue'),
    'assassin',
    ...Array(7).fill('neutral'),
  ];
  const shuffledTypes = shuffle(types);

  state.board = words.map((word, i) => ({
    word,
    type: shuffledTypes[i] as CardType,
    revealed: false,
  }));

  state.currentTeam = 'red';
  state.phase = 'playing';
  state.clue = null;
  state.guessesLeft = 0;
  state.scores = { red: 0, blue: 0 };
  state.winner = null;
  state.log = [];
  state.cardVotes = {};
  state.turnNumber = 1;
  state.turnDuration = 120; // first clue phase: 2 min
  state.turnStartedAt = Date.now();

  rooms.set(state.roomCode, state);
  return null;
}

export function giveClue(
  state: GameState,
  playerId: string,
  word: string,
  count: number
): string | null {
  const player = state.players.find(p => p.id === playerId);
  if (!player) return 'Player not found.';
  if (player.role !== 'spymaster') return 'Only the spymaster can give clues.';
  if (player.team !== state.currentTeam) return 'It is not your team\'s turn.';
  if (state.clue) return 'A clue has already been given this turn.';

  const clueWordLower = word.toLowerCase();
  const boardWordMatch = state.board.some(
    c => !c.revealed && c.word.toLowerCase() === clueWordLower
  );
  if (boardWordMatch) return 'Clue cannot be a word on the board.';

  state.clue = { word, count, givenBy: player.name };
  state.guessesLeft = count + 1;
  state.log.push({ team: state.currentTeam, type: 'clue', word, count });

  // Switch to guess phase: 1 min timer
  state.turnDuration = 60;
  state.turnStartedAt = Date.now();

  rooms.set(state.roomCode, state);
  return null;
}

export function voteCard(
  state: GameState,
  playerId: string,
  cardIndex: number
): { error: string | null; result: RevealResult | null } {
  const player = state.players.find(p => p.id === playerId);
  if (!player) return { error: 'Player not found.', result: null };
  if (player.role !== 'operative') return { error: 'Only operatives can vote.', result: null };
  if (player.team !== state.currentTeam) return { error: 'It is not your team\'s turn.', result: null };
  if (!state.clue) return { error: 'Wait for the spymaster to give a clue.', result: null };
  if (state.phase !== 'playing') return { error: 'Game not in progress.', result: null };

  const card = state.board[cardIndex];
  if (!card || card.revealed) return { error: 'Invalid card.', result: null };

  // Toggle: clicking your current vote deselects it
  if (state.cardVotes[playerId] === cardIndex) {
    delete state.cardVotes[playerId];
    rooms.set(state.roomCode, state);
    return { error: null, result: null };
  }

  state.cardVotes[playerId] = cardIndex;

  // Check consensus: all operatives on this team vote for the same card
  const teamOps = state.players.filter(
    p => p.team === state.currentTeam && p.role === 'operative'
  );
  const allAgreed = teamOps.length > 0 && teamOps.every(p => state.cardVotes[p.id] === cardIndex);

  if (allAgreed) {
    const result = applyReveal(state, cardIndex);
    return { error: null, result };
  }

  rooms.set(state.roomCode, state);
  return { error: null, result: null };
}

export function endTurn(state: GameState): void {
  state.currentTeam = state.currentTeam === 'red' ? 'blue' : 'red';
  state.clue = null;
  state.guessesLeft = 0;
  state.cardVotes = {};
  state.turnNumber += 1;
  state.turnDuration = 60; // clue phase for next team
  state.turnStartedAt = Date.now();
  rooms.set(state.roomCode, state);
}

export function returnToLobby(state: GameState): void {
  state.phase = 'lobby';
  state.board = [];
  state.clue = null;
  state.guessesLeft = 0;
  state.scores = { red: 0, blue: 0 };
  state.winner = null;
  state.log = [];
  state.cardVotes = {};
  state.turnNumber = 0;
  state.turnDuration = 0;
  state.turnStartedAt = null;
  rooms.set(state.roomCode, state);
}

// Shuffle roles within each team, then start the game.
export function shuffleAndStart(state: GameState): string | null {
  for (const team of ['red', 'blue'] as Team[]) {
    const members = state.players.filter(p => p.team === team);
    if (members.length >= 2) {
      const roles = shuffle(members.map(p => p.role));
      members.forEach((p, i) => { p.role = roles[i]; });
    }
  }
  return startGame(state);
}
