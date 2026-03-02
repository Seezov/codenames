import type { LogEntry, Player, Team } from '@codenames/shared';

interface Props {
  team: Team;
  players: Player[];
  score: number;
  isActive: boolean;
  total: number;
  log?: LogEntry[];
}

export default function TeamSidebar({ team, players, score, isActive, total, log }: Props) {
  return (
    <aside className={`team-sidebar ${team} ${isActive ? 'active' : ''}`}>
      <div className="sidebar-header">
        <span className="team-label">{team.toUpperCase()}</span>
        <span className="score">{score} / {total}</span>
      </div>
      <ul className="player-list">
        {players.map(p => (
          <li key={p.id} className="player-item">
            <span
              className="role-dot"
              style={{ background: p.role === 'spymaster' ? '#f4d03f' : p.color }}
            />
            <span className="player-name">{p.name}</span>
            <span className="role-label">{p.role === 'spymaster' ? 'SPY' : 'OP'}</span>
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
