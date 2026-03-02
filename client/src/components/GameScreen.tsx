import { useEffect, useRef } from 'react';
import type { Card, CardType, GameState, Player } from '@codenames/shared';
import Board from './Board';
import TeamSidebar from './TeamSidebar';
import CluePanel from './CluePanel';
import WinModal from './WinModal';

interface Props {
  gameState: GameState;
  myPlayer: Player | null;
}

// ── Audio helpers ─────────────────────────────────────────────────────────────
function tone(ctx: AudioContext, freq: number, start: number, duration: number, gain = 0.25) {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.connect(g);
  g.connect(ctx.destination);
  osc.frequency.value = freq;
  g.gain.setValueAtTime(0, start);
  g.gain.linearRampToValueAtTime(gain, start + 0.02);
  g.gain.exponentialRampToValueAtTime(0.001, start + duration);
  osc.start(start);
  osc.stop(start + duration);
}

function playClueSound() {
  try {
    const ctx = new AudioContext();
    tone(ctx, 523, ctx.currentTime,        0.45);
    tone(ctx, 659, ctx.currentTime + 0.18, 0.45);
  } catch { /* ignore */ }
}

function playGuessSound(type: CardType) {
  try {
    const ctx = new AudioContext();
    const t = ctx.currentTime;
    if (type === 'red') {
      // Bright win jingle
      tone(ctx, 523, t,        0.18);
      tone(ctx, 659, t + 0.12, 0.18);
      tone(ctx, 784, t + 0.24, 0.35);
    } else if (type === 'blue') {
      // Slightly different bright jingle
      tone(ctx, 587, t,        0.18);
      tone(ctx, 698, t + 0.12, 0.18);
      tone(ctx, 880, t + 0.24, 0.35);
    } else if (type === 'neutral') {
      // Flat thud
      tone(ctx, 300, t, 0.25, 0.15);
    } else {
      // Assassin — descending alarm
      tone(ctx, 440, t,        0.25, 0.3);
      tone(ctx, 330, t + 0.2,  0.25, 0.3);
      tone(ctx, 220, t + 0.4,  0.45, 0.3);
    }
  } catch { /* ignore */ }
}
// ─────────────────────────────────────────────────────────────────────────────

export default function GameScreen({ gameState, myPlayer }: Props) {
  const isMyTurn = myPlayer?.team === gameState.currentTeam;
  const prevClueWordRef = useRef<string | null>(null);
  const prevBoardRef = useRef<Card[]>([]);

  useEffect(() => {
    // Clue sound
    const clueWord = gameState.clue?.word ?? null;
    if (clueWord !== null && prevClueWordRef.current === null) {
      playClueSound();
    }
    prevClueWordRef.current = clueWord;

    // Guess sound: detect newly revealed cards
    const prev = prevBoardRef.current;
    const curr = gameState.board;
    if (prev.length === curr.length) {
      for (let i = 0; i < curr.length; i++) {
        if (!prev[i]?.revealed && curr[i].revealed) {
          playGuessSound(curr[i].type);
          break;
        }
      }
    }
    prevBoardRef.current = curr.map(c => ({ ...c }));
  });

  return (
    <div className="game-screen">
      <TeamSidebar
        team="red"
        players={gameState.players.filter(p => p.team === 'red')}
        myPlayer={myPlayer}
        score={gameState.scores.red}
        isActive={gameState.currentTeam === 'red'}
        total={gameState.board.filter(c => c.type === 'red').length}
        phase={gameState.phase}
        log={gameState.log.filter(e => e.team === 'red')}
      />

      <div className="game-center">
        <CluePanel gameState={gameState} myPlayer={myPlayer} isMyTurn={isMyTurn} />
        <Board gameState={gameState} myPlayer={myPlayer} isMyTurn={isMyTurn} />
        {gameState.phase === 'ended' && gameState.winner && (
          <WinModal winner={gameState.winner} />
        )}
      </div>

      <TeamSidebar
        team="blue"
        players={gameState.players.filter(p => p.team === 'blue')}
        myPlayer={myPlayer}
        score={gameState.scores.blue}
        isActive={gameState.currentTeam === 'blue'}
        total={gameState.board.filter(c => c.type === 'blue').length}
        phase={gameState.phase}
        log={gameState.log.filter(e => e.team === 'blue')}
      />
    </div>
  );
}
