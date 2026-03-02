import type { Team } from '@codenames/shared';
import socket from '../socket';

interface Props {
  winner: Team;
}

export default function WinModal({ winner }: Props) {
  return (
    <div className="win-overlay">
      <div className="win-modal">
        <div className={`win-title ${winner}`}>
          {winner.toUpperCase()} TEAM WINS!
        </div>
        <div className="win-actions">
          <button className="win-btn new-game" onClick={() => socket.emit('startGame')}>
            New Game
            <span className="win-btn-sub">same roles</span>
          </button>
          <button className="win-btn shuffle" onClick={() => socket.emit('startGameShuffled')}>
            New Game
            <span className="win-btn-sub">shuffle roles</span>
          </button>
          <button className="win-btn lobby" onClick={() => socket.emit('returnToLobby')}>
            Back to Lobby
          </button>
        </div>
      </div>
    </div>
  );
}
