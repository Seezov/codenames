import { useEffect, useRef, useState } from 'react';
import type { GameState, Player, Role, RoomInfo, Team } from '@codenames/shared';
import socket from '../socket';
import sampleWords from '../data/sampleWords';

interface Props {
  gameState: GameState | null;
  myPlayer: Player | null;
}

export default function LobbyScreen({ gameState, myPlayer }: Props) {
  const [name, setName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [rooms, setRooms] = useState<RoomInfo[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch room list and keep it live while on the join screen
  useEffect(() => {
    if (myPlayer) return;
    socket.emit('getRooms');
    socket.on('roomList', setRooms);
    return () => { socket.off('roomList', setRooms); };
  }, [myPlayer]);

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
    const phaseLabel = (phase: RoomInfo['phase']) =>
      phase === 'lobby' ? 'Лобі' : phase === 'playing' ? 'Грається' : 'Завершено';

    return (
      <div className="lobby-join">
        <h1>CODENAMES</h1>
        <input
          placeholder="Ваше ім'я"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && join()}
        />
        <input
          placeholder="Код кімнати"
          value={roomCode}
          onChange={e => setRoomCode(e.target.value.toUpperCase())}
          onKeyDown={e => e.key === 'Enter' && join()}
        />
        <button onClick={join}>Увійти / Створити кімнату</button>

        {rooms.length > 0 && (
          <div className="room-browser">
            <div className="room-browser-title">Активні кімнати</div>
            <ul className="room-list">
              {rooms.map(r => (
                <li
                  key={r.roomCode}
                  className={`room-item ${r.phase}`}
                  onClick={() => setRoomCode(r.roomCode)}
                  title="Натисніть, щоб заповнити код"
                >
                  <span className="room-code">{r.roomCode}</span>
                  <span className="room-host">{r.hostName}</span>
                  <span className="room-players">{r.playerCount} {r.playerCount === 1 ? 'гравець' : 'гравців'}</span>
                  <span className="room-phase">{phaseLabel(r.phase)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }

  const isHost = myPlayer.id === gameState?.hostId;
  const redPlayers = gameState?.players.filter(p => p.team === 'red') ?? [];
  const bluePlayers = gameState?.players.filter(p => p.team === 'blue') ?? [];
  const hasWords = (gameState?.wordPool.length ?? 0) >= 25;

  const hasRedSpy  = redPlayers.some(p => p.role === 'spymaster');
  const hasRedOp   = redPlayers.some(p => p.role === 'operative');
  const hasBlueSpy = bluePlayers.some(p => p.role === 'spymaster');
  const hasBlueOp  = bluePlayers.some(p => p.role === 'operative');
  const teamsReady = hasRedSpy && hasRedOp && hasBlueSpy && hasBlueOp;

  const myTeamPlayers = (gameState?.players ?? []).filter(p => p.team === myPlayer.team);
  const teamAlreadyHasSpy = myTeamPlayers.some(p => p.role === 'spymaster' && p.id !== myPlayer.id);

  const startHint = !isHost ? 'Тільки хост може розпочати гру'
    : !hasWords  ? 'Спочатку завантажте слова'
    : !hasRedSpy  ? 'Червоній команді потрібен шпигун'
    : !hasRedOp   ? 'Червоній команді потрібен оперативник'
    : !hasBlueSpy ? 'Синій команді потрібен шпигун'
    : !hasBlueOp  ? 'Синій команді потрібен оперативник'
    : null;

  return (
    <div className="lobby-room">
      <h1>CODENAMES — Кімната: {gameState?.roomCode ?? roomCode}</h1>

      <div className="lobby-teams">
        <div className="team-column red">
          <h2>Червона команда</h2>
          {redPlayers.map(p => (
            <div key={p.id} className="player-entry">
              <span className="player-color-dot" style={{ background: p.color }} />
              {p.name}
              {p.id === gameState?.hostId && <span className="host-badge">👑</span>}
              <span className="role-badge">{p.role === 'spymaster' ? 'Шпигун' : 'Оператив'}</span>
            </div>
          ))}
        </div>
        <div className="team-column blue">
          <h2>Синя команда</h2>
          {bluePlayers.map(p => (
            <div key={p.id} className="player-entry">
              <span className="player-color-dot" style={{ background: p.color }} />
              {p.name}
              {p.id === gameState?.hostId && <span className="host-badge">👑</span>}
              <span className="role-badge">{p.role === 'spymaster' ? 'Шпигун' : 'Оператив'}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="lobby-controls">
        <div className="control-group">
          <span>Команда:</span>
          <button
            className={myPlayer.team === 'red' ? 'active red' : ''}
            onClick={() => selectTeam('red')}
          >Червона</button>
          <button
            className={myPlayer.team === 'blue' ? 'active blue' : ''}
            onClick={() => selectTeam('blue')}
          >Синя</button>
        </div>

        <div className="control-group">
          <span>Роль:</span>
          <button
            className={myPlayer.role === 'operative' ? 'active' : ''}
            onClick={() => selectRole('operative')}
          >Оперативник</button>
          <button
            className={myPlayer.role === 'spymaster' ? 'active' : ''}
            disabled={teamAlreadyHasSpy}
            onClick={() => selectRole('spymaster')}
          >Шпигун</button>
        </div>

        <div className="control-group">
          <button onClick={() => fileInputRef.current?.click()}>
            {hasWords ? `✓ ${gameState!.wordPool.length} слів завантажено` : 'Завантажити список слів (JSON)'}
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
              Стандартні слова
            </button>
          )}
        </div>

        {startHint && <span className="start-hint">{startHint}</span>}
        {isHost ? (
          <button
            className="start-btn"
            disabled={!hasWords || !teamsReady}
            onClick={() => socket.emit('startGame')}
          >
            Почати гру
          </button>
        ) : (
          <span className="start-hint">Очікуємо на хоста…</span>
        )}
      </div>
    </div>
  );
}
