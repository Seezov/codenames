import { Card, CardType, GameState, LogEntry, Player, Role, Team } from '@codenames/shared';

const rooms = new Map<string, GameState>();
const socketToRoom = new Map<string, string>();

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

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

  if (state.players.length === 0) {
    rooms.delete(roomCode);
    return undefined;
  }

  rooms.set(roomCode, state);
  return { roomCode, state };
}

export function addPlayer(state: GameState, player: Player): void {
  const existing = state.players.find(p => p.id === player.id);
  if (!existing) state.players.push(player);
  rooms.set(state.roomCode, state);
}

export function chooseTeam(state: GameState, playerId: string, team: Team): void {
  const player = state.players.find(p => p.id === playerId);
  if (player) {
    player.team = team;
    rooms.set(state.roomCode, state);
  }
}

export function chooseRole(state: GameState, playerId: string, role: Role): void {
  const player = state.players.find(p => p.id === playerId);
  if (player) {
    player.role = role;
    rooms.set(state.roomCode, state);
  }
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
  state.turnNumber = 1;
  state.turnDuration = 120;
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
  rooms.set(state.roomCode, state);
  return null;
}

export function revealCard(
  state: GameState,
  playerId: string,
  cardIndex: number
): string | null {
  const player = state.players.find(p => p.id === playerId);
  if (!player) return 'Player not found.';
  if (player.role !== 'operative') return 'Only operatives can reveal cards.';
  if (player.team !== state.currentTeam) return 'It is not your team\'s turn.';
  if (!state.clue) return 'Wait for the spymaster to give a clue.';
  if (state.guessesLeft <= 0) return 'No guesses remaining.';

  const card = state.board[cardIndex];
  if (!card || card.revealed) return 'Invalid card.';

  card.revealed = true;
  state.log.push({ team: state.currentTeam, type: 'guess', word: card.word, result: card.type });

  if (card.type === 'assassin') {
    state.winner = state.currentTeam === 'red' ? 'blue' : 'red';
    state.phase = 'ended';
    rooms.set(state.roomCode, state);
    return null;
  }

  if (card.type === 'red') state.scores.red++;
  if (card.type === 'blue') state.scores.blue++;

  // Check win condition
  const redTotal = state.board.filter(c => c.type === 'red').length;
  const blueTotal = state.board.filter(c => c.type === 'blue').length;
  if (state.scores.red >= redTotal) {
    state.winner = 'red';
    state.phase = 'ended';
    rooms.set(state.roomCode, state);
    return null;
  }
  if (state.scores.blue >= blueTotal) {
    state.winner = 'blue';
    state.phase = 'ended';
    rooms.set(state.roomCode, state);
    return null;
  }

  if (card.type !== state.currentTeam) {
    // Hit opponent's or neutral card — end turn
    endTurn(state);
    return null;
  }

  // Correct guess — keep guessing indefinitely
  rooms.set(state.roomCode, state);
  return null;
}

export function endTurn(state: GameState): void {
  state.currentTeam = state.currentTeam === 'red' ? 'blue' : 'red';
  state.clue = null;
  state.guessesLeft = 0;
  state.turnNumber += 1;
  state.turnDuration = 60;
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
  state.turnNumber = 0;
  state.turnDuration = 0;
  state.turnStartedAt = null;
  rooms.set(state.roomCode, state);
}
