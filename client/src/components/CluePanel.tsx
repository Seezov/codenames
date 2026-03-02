import { useEffect, useState } from 'react';
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
  const [timeLeft, setTimeLeft] = useState(0);

  useEffect(() => {
    if (!gameState.turnStartedAt || gameState.phase !== 'playing') {
      setTimeLeft(0);
      return;
    }
    function tick() {
      const elapsed = Math.floor((Date.now() - gameState.turnStartedAt!) / 1000);
      setTimeLeft(Math.max(0, gameState.turnDuration - elapsed));
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [gameState.turnStartedAt, gameState.turnDuration, gameState.phase]);

  const isSpymaster = myPlayer?.role === 'spymaster';
  const isOperative = myPlayer?.role === 'operative';
  const canGiveClue = isMyTurn && isSpymaster && !gameState.clue && gameState.phase === 'playing';
  const canEndTurn  = isMyTurn && isOperative && !!gameState.clue && gameState.phase === 'playing';

  function submitClue() {
    if (!clueWord.trim()) return;
    socket.emit('giveClue', { word: clueWord.trim(), count: clueCount });
    setClueWord('');
    setClueCount(1);
  }

  const mins = Math.floor(timeLeft / 60);
  const secs = timeLeft % 60;
  const timerStr = `${mins}:${String(secs).padStart(2, '0')}`;
  const timerUrgent = timeLeft <= 30 && timeLeft > 0;

  const teamColor = gameState.currentTeam;
  const phase = gameState.clue ? 'guess' : 'clue';

  return (
    <div className="clue-panel">
      {/* Turn + phase label */}
      <div className={`clue-turn-label ${teamColor}`}>
        {teamColor === 'red' ? '🔴 ЧЕРВОНІ' : '🔵 СИНІ'}{' '}—{' '}
        {phase === 'clue' ? 'ПІДКАЗКА' : 'ВІДГАДУВАННЯ'}
      </div>

      {/* Big timer */}
      {gameState.phase === 'playing' && (
        <div className={`clue-timer${timerUrgent ? ' urgent' : ''}`}>{timerStr}</div>
      )}

      {/* Clue area */}
      {gameState.clue ? (
        <div className="current-clue">
          <span className="clue-word">{gameState.clue.word}</span>
          <span className="clue-count">{gameState.clue.count}</span>
          <span className="clue-meta">від {gameState.clue.givenBy}</span>
          {canEndTurn && (
            <button className="end-turn-btn" onClick={() => socket.emit('endTurn')}>
              Завершити хід
            </button>
          )}
        </div>
      ) : canGiveClue ? (
        <div className="clue-input">
          <input
            placeholder="Слово-підказка"
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
          <button onClick={submitClue}>Дати підказку</button>
        </div>
      ) : (
        <div className="clue-waiting">
          {isMyTurn
            ? 'Чекаємо підказку від вашого шпигуна…'
            : `Хід команди ${gameState.currentTeam === 'red' ? 'ЧЕРВОНИХ' : 'СИНІХ'}`}
        </div>
      )}
    </div>
  );
}
