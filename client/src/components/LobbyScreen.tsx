import { useRef, useState } from 'react';
import type { GameState, Player, Role, Team } from '@codenames/shared';
import socket from '../socket';
import sampleWords from '../data/sampleWords';

interface Props {
  gameState: GameState | null;
  myPlayer: Player | null;
}

export default function LobbyScreen({ gameState, myPlayer }: Props) {
  const [name, setName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  function join() {
    if (!name.trim() || !roomCode.trim()) return;
    socket.emit('joinRoom', { roomCode: roomCode.trim().toUpperCase(), playerName: name.trim() });
  }

  function selectTeam(team: Team) {
    socket.emit('chooseTeam', { team });
  }

  function selectRole(role: Role) {
    socket.emit('chooseRole', { role });
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const words: string[] = JSON.parse(ev.target?.result as string);
        if (!Array.isArray(words) || words.some(w => typeof w !== 'string')) {
          alert('Invalid format. Expected a JSON array of strings.');
          return;
        }
        socket.emit('uploadWords', { words });
      } catch {
        alert('Failed to parse JSON file.');
      }
    };
    reader.readAsText(file);
  }

  if (!myPlayer) {
    return (
      <div className="lobby-join">
        <h1>CODENAMES</h1>
        <input
          placeholder="Your name"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && join()}
        />
        <input
          placeholder="Room code"
          value={roomCode}
          onChange={e => setRoomCode(e.target.value.toUpperCase())}
          onKeyDown={e => e.key === 'Enter' && join()}
        />
        <button onClick={join}>Join / Create Room</button>
      </div>
    );
  }

  const redPlayers = gameState?.players.filter(p => p.team === 'red') ?? [];
  const bluePlayers = gameState?.players.filter(p => p.team === 'blue') ?? [];
  const hasWords = (gameState?.wordPool.length ?? 0) >= 25;

  return (
    <div className="lobby-room">
      <h1>CODENAMES — Room: {gameState?.roomCode ?? roomCode}</h1>

      <div className="lobby-teams">
        <div className="team-column red">
          <h2>Red Team</h2>
          {redPlayers.map(p => (
            <div key={p.id} className="player-entry">
              {p.name} <span className="role-badge">{p.role}</span>
            </div>
          ))}
        </div>
        <div className="team-column blue">
          <h2>Blue Team</h2>
          {bluePlayers.map(p => (
            <div key={p.id} className="player-entry">
              {p.name} <span className="role-badge">{p.role}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="lobby-controls">
        <div className="control-group">
          <span>Team:</span>
          <button
            className={myPlayer?.team === 'red' ? 'active red' : ''}
            onClick={() => selectTeam('red')}
          >Red</button>
          <button
            className={myPlayer?.team === 'blue' ? 'active blue' : ''}
            onClick={() => selectTeam('blue')}
          >Blue</button>
        </div>

        <div className="control-group">
          <span>Role:</span>
          <button
            className={myPlayer?.role === 'operative' ? 'active' : ''}
            onClick={() => selectRole('operative')}
          >Operative</button>
          <button
            className={myPlayer?.role === 'spymaster' ? 'active' : ''}
            onClick={() => selectRole('spymaster')}
          >Spymaster</button>
        </div>

        <div className="control-group">
          <button onClick={() => fileInputRef.current?.click()}>
            {hasWords ? `✓ ${gameState!.wordPool.length} words loaded` : 'Upload Word List (JSON)'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            style={{ display: 'none' }}
            onChange={handleFileUpload}
          />
          {!hasWords && (
            <button onClick={() => socket.emit('uploadWords', { words: sampleWords })}>
              Use Default Words
            </button>
          )}
        </div>

        <button
          className="start-btn"
          disabled={!hasWords}
          onClick={() => socket.emit('startGame')}
        >
          Start Game
        </button>
      </div>
    </div>
  );
}
