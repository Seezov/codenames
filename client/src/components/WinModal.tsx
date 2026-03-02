import type { Team } from '@codenames/shared';
import socket from '../socket';

interface Props {
  winner: Team;
}

export default function WinModal({ winner }: Props) {
  return (
    <div className={`win-banner ${winner}`}>
      <div className="win-title">
        {winner === 'red' ? '🔴 ЧЕРВОНІ' : '🔵 СИНІ'} ПЕРЕМОГЛИ!
      </div>
      <div className="win-actions">
        <button className="win-btn new-game" onClick={() => socket.emit('startGame')}>
          Нова гра
          <span className="win-btn-sub">ті самі ролі</span>
        </button>
        <button className="win-btn shuffle" onClick={() => socket.emit('startGameShuffled')}>
          Нова гра
          <span className="win-btn-sub">перемішати ролі</span>
        </button>
        <button className="win-btn lobby" onClick={() => socket.emit('returnToLobby')}>
          До лобі
        </button>
      </div>
    </div>
  );
}
