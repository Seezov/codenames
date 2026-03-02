import { useEffect, useRef } from 'react';
import type { GameState, Player } from '@codenames/shared';
import Board from './Board';
import TeamSidebar from './TeamSidebar';
import CluePanel from './CluePanel';
import WinModal from './WinModal';

interface Props {
  gameState: GameState;
  myPlayer: Player | null;
}

function playClueSound() {
  try {
    const ctx = new AudioContext();
    [523, 659].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      const t = ctx.currentTime + i * 0.18;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.25, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
      osc.start(t);
      osc.stop(t + 0.45);
    });
  } catch { /* AudioContext unavailable */ }
}

export default function GameScreen({ gameState, myPlayer }: Props) {
  const isMyTurn = myPlayer?.team === gameState.currentTeam;
  const prevClueWordRef = useRef<string | null>(null);

  useEffect(() => {
    const clueWord = gameState.clue?.word ?? null;
    if (clueWord !== null && prevClueWordRef.current === null) {
      playClueSound();
    }
    prevClueWordRef.current = clueWord;
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
