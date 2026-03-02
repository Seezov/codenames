import { useState } from 'react';
import type { GameState, Player } from '@codenames/shared';
import socket from '../socket';

interface Props {
  gameState: GameState;
  myPlayer: Player | null;
  isMyTurn: boolean;
}

export default function CluePanel({ gameState, myPlayer, isMyTurn }: Props) {
  const [clueWord, setClueWord] = useState('');
  const [clueCount, setClueCount] = useState(1);

  const isSpymaster = myPlayer?.role === 'spymaster';
  const isOperative = myPlayer?.role === 'operative';
  const canGiveClue = isMyTurn && isSpymaster && !gameState.clue && gameState.phase === 'playing';
  const canEndTurn = isMyTurn && isOperative && !!gameState.clue && gameState.phase === 'playing';

  function submitClue() {
    if (!clueWord.trim()) return;
    socket.emit('giveClue', { word: clueWord.trim(), count: clueCount });
    setClueWord('');
    setClueCount(1);
  }

  return (
    <div className="clue-panel">
      {gameState.clue ? (
        <div className="current-clue">
          <span className="clue-word">{gameState.clue.word}</span>
          <span className="clue-count">{gameState.clue.count}</span>
          <span className="clue-meta">by {gameState.clue.givenBy}</span>
          {canEndTurn && (
            <button className="end-turn-btn" onClick={() => socket.emit('endTurn')}>
              End Turn
            </button>
          )}
        </div>
      ) : canGiveClue ? (
        <div className="clue-input">
          <input
            placeholder="Clue word"
            value={clueWord}
            onChange={e => setClueWord(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && submitClue()}
          />
          <input
            type="number"
            min={1}
            max={9}
            value={clueCount}
            onChange={e => setClueCount(Number(e.target.value))}
          />
          <button onClick={submitClue}>Give Clue</button>
        </div>
      ) : (
        <div className="clue-waiting">
          {isMyTurn
            ? 'Waiting for your spymaster to give a clue…'
            : `${gameState.currentTeam.toUpperCase()} team's turn`}
        </div>
      )}
    </div>
  );
}
