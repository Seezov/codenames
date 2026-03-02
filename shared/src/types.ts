export type Team = 'red' | 'blue';
export type Role = 'spymaster' | 'operative';
export type CardType = Team | 'neutral' | 'assassin';

export interface Card {
  word: string;
  type: CardType;
  revealed: boolean;
}

export interface Player {
  id: string;
  name: string;
  team: Team;
  role: Role;
  color: string; // unique personal color (hex)
}

export interface Clue {
  word: string;
  count: number;
  givenBy: string;
}

export interface LogEntry {
  team: Team;
  type: 'clue' | 'guess';
  word: string;
  count?: number;   // clue entries
  result?: CardType; // guess entries: what the card actually was
}

export interface GameState {
  roomCode: string;
  board: Card[];
  players: Player[];
  currentTeam: Team;
  phase: 'lobby' | 'playing' | 'ended';
  clue: Clue | null;
  guessesLeft: number;
  scores: { red: number; blue: number };
  winner: Team | null;
  wordPool: string[];
  log: LogEntry[];
  turnNumber: number;
  turnDuration: number;   // seconds
  turnStartedAt: number | null; // Date.now() timestamp
  // playerId → cardIndex the player is currently voting for
  cardVotes: Record<string, number>;
}

export interface ClientToServerEvents {
  joinRoom: (payload: { roomCode: string; playerName: string }) => void;
  chooseTeam: (payload: { team: Team }) => void;
  chooseRole: (payload: { role: Role }) => void;
  uploadWords: (payload: { words: string[] }) => void;
  startGame: () => void;
  startGameShuffled: () => void;
  returnToLobby: () => void;
  giveClue: (payload: { word: string; count: number }) => void;
  voteCard: (payload: { cardIndex: number }) => void;
  endTurn: () => void;
}

export interface ServerToClientEvents {
  gameState: (state: GameState) => void;
  error: (message: string) => void;
}
