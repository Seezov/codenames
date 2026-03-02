import type { LogEntry, Player, Team } from '@codenames/shared';
import socket from '../socket';

interface Props {
  team: Team;
  players: Player[];
  myPlayer: Player | null;
  score: number;
  isActive: boolean;
  total: number;
  phase: 'lobby' | 'playing' | 'ended';
  log?: LogEntry[];
}

export default function TeamSidebar({ team, players, myPlayer, score, isActive, total, phase, log }: Props) {
  const spymasters = players.filter(p => p.role === 'spymaster');
  const operatives = players.filter(p => p.role === 'operative');
  const canJoin = phase === 'playing' && myPlayer?.team !== team;

  return (
    <aside className={`team-sidebar ${team} ${isActive ? 'active' : ''}`}>
      <div className="sidebar-header">
        <span className="team-label">{team.toUpperCase()}</span>
        <span className="score">{score} / {total}</span>
      </div>

      {canJoin && (
        <button
          className={`join-team-btn ${team}`}
          onClick={() => socket.emit('chooseTeam', { team })}
        >
          Join
        </button>
      )}

      <ul className="player-list">
        {spymasters.map(p => (
          <li key={p.id} className="player-item">
            <span className="role-dot" style={{ background: '#f4d03f' }} />
            <span className="player-name">{p.name}</span>
            <span className="role-label">SPY</span>
          </li>
        ))}
        {spymasters.length > 0 && operatives.length > 0 && (
          <li className="role-divider" />
        )}
        {operatives.map(p => (
          <li key={p.id} className="player-item">
            <span className="role-dot" style={{ background: p.color }} />
            <span className="player-name">{p.name}</span>
            <span className="role-label">OP</span>
          </li>
        ))}
      </ul>

      {log && (
        <div className="game-log">
          <div className="game-log-title">HISTORY</div>
          <ul className="log-list">
            {log.map((entry, i) =>
              entry.type === 'clue' ? (
                <li key={i} className={`log-clue ${entry.team}`}>
                  <span className="log-clue-word">{entry.word}</span>
                  <span className="log-clue-count">×{entry.count}</span>
                </li>
              ) : (
                <li key={i} className={`log-guess result-${entry.result}`}>
                  {entry.word}
                </li>
              )
            )}
          </ul>
        </div>
      )}
    </aside>
  );
}
