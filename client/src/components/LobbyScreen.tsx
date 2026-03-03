import { useEffect, useRef, useState } from 'react';
import type { AuthUser, GameState, Player, Role, RoomInfo, Team } from '@codenames/shared';
import socket from '../socket';
import sampleWords from '../data/sampleWords';

interface Props {
  gameState: GameState | null;
  myPlayer: Player | null;
  authUser: AuthUser | null;
  onLogout: () => void;
}

export default function LobbyScreen({ gameState, myPlayer, authUser, onLogout }: Props) {
  const [name, setName]         = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [rooms, setRooms]       = useState<RoomInfo[]>([]);

  // Auth form state
  const [authMode, setAuthMode]   = useState<'login' | 'register'>('login');
  const [authNick, setAuthNick]   = useState('');
  const [authPass, setAuthPass]   = useState('');
  const [authError, setAuthError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Pre-fill name with nickname when logged in
  useEffect(() => {
    if (authUser) setName(authUser.nickname);
  }, [authUser?.nickname]);

  // Fetch room list and keep it live while on the join screen
  useEffect(() => {
    if (myPlayer) return;
    socket.emit('getRooms');
    socket.on('roomList', setRooms);
    return () => { socket.off('roomList', setRooms); };
  }, [myPlayer]);

  // Listen for auth errors from the server
  useEffect(() => {
    function onAuthResult(result: { user: AuthUser; token: string } | { error: string }) {
      if ('error' in result) setAuthError(result.error);
      else { setAuthError(null); setAuthNick(''); setAuthPass(''); }
    }
    socket.on('authResult', onAuthResult);
    return () => { socket.off('authResult', onAuthResult); };
  }, []);

  function submitAuth() {
    if (!authNick.trim() || !authPass) return;
    setAuthError(null);
    if (authMode === 'register') {
      socket.emit('register', { nickname: authNick.trim(), password: authPass });
    } else {
      socket.emit('login', { nickname: authNick.trim(), password: authPass });
    }
  }

  function join() {
    if (!name.trim() || !roomCode.trim()) return;
    socket.emit('joinRoom', { roomCode: roomCode.trim().toUpperCase(), playerName: name.trim() });
  }

  function selectTeam(team: Team) { socket.emit('chooseTeam', { team }); }
  function selectRole(role: Role)  { socket.emit('chooseRole', { role }); }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const words: string[] = JSON.parse(ev.target?.result as string);
        if (!Array.isArray(words) || words.some(w => typeof w !== 'string')) {
          alert('Невірний формат. Очікується масив рядків JSON.');
          return;
        }
        socket.emit('uploadWords', { words });
      } catch {
        alert('Не вдалося прочитати JSON файл.');
      }
    };
    reader.readAsText(file);
  }

  // ── Join screen ─────────────────────────────────────────────────────────────
  if (!myPlayer) {
    const phaseLabel = (phase: RoomInfo['phase']) =>
      phase === 'lobby' ? 'Лобі' : phase === 'playing' ? 'Грається' : 'Завершено';

    return (
      <div className="lobby-join">
        <h1>CODENAMES</h1>

        {/* ── Auth section ───────────────────────────────────────────────── */}
        {authUser ? (
          <div className="auth-card logged-in">
            <span className="auth-greeting">👤 {authUser.nickname}</span>
            <button className="auth-logout-btn" onClick={onLogout}>Вийти з акаунту</button>
          </div>
        ) : (
          <div className="auth-card">
            <div className="auth-tabs">
              <button
                className={authMode === 'login' ? 'active' : ''}
                onClick={() => { setAuthMode('login'); setAuthError(null); }}
              >Вхід</button>
              <button
                className={authMode === 'register' ? 'active' : ''}
                onClick={() => { setAuthMode('register'); setAuthError(null); }}
              >Реєстрація</button>
            </div>
            <input
              className="auth-input"
              placeholder="Нікнейм"
              value={authNick}
              onChange={e => setAuthNick(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && submitAuth()}
            />
            <input
              className="auth-input"
              type="password"
              placeholder="Пароль"
              value={authPass}
              onChange={e => setAuthPass(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && submitAuth()}
            />
            {authError && <div className="auth-error">{authError}</div>}
            <button className="auth-submit-btn" onClick={submitAuth}>
              {authMode === 'login' ? 'Увійти' : 'Зареєструватись'}
            </button>
          </div>
        )}

        {/* ── Room join form ──────────────────────────────────────────────── */}
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

  // ── Room lobby ───────────────────────────────────────────────────────────────
  const isHost = myPlayer.id === gameState?.hostId;
  const redPlayers  = gameState?.players.filter(p => p.team === 'red')  ?? [];
  const bluePlayers = gameState?.players.filter(p => p.team === 'blue') ?? [];
  const hasWords = (gameState?.wordPool.length ?? 0) >= 25;

  const hasRedSpy  = redPlayers.some(p => p.role === 'spymaster');
  const hasRedOp   = redPlayers.some(p => p.role === 'operative');
  const hasBlueSpy = bluePlayers.some(p => p.role === 'spymaster');
  const hasBlueOp  = bluePlayers.some(p => p.role === 'operative');
  const teamsReady = hasRedSpy && hasRedOp && hasBlueSpy && hasBlueOp;

  const myTeamPlayers   = (gameState?.players ?? []).filter(p => p.team === myPlayer.team);
  const teamAlreadyHasSpy = myTeamPlayers.some(p => p.role === 'spymaster' && p.id !== myPlayer.id);

  const startHint = !isHost       ? 'Тільки хост може розпочати гру'
    : !hasWords   ? 'Спочатку завантажте слова'
    : !hasRedSpy  ? 'Червоній команді потрібен шпигун'
    : !hasRedOp   ? 'Червоній команді потрібен оперативник'
    : !hasBlueSpy ? 'Синій команді потрібен шпигун'
    : !hasBlueOp  ? 'Синій команді потрібен оперативник'
    : null;

  function leaveRoom() {
    sessionStorage.removeItem('codenames_session');
    socket.emit('leaveRoom');
  }

  return (
    <div className="lobby-room">
      <div className="lobby-room-header">
        <h1>CODENAMES — Кімната: {gameState?.roomCode ?? roomCode}</h1>
        <button className="leave-btn" onClick={leaveRoom}>← Вийти</button>
      </div>

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
          <button className={myPlayer.team === 'red'  ? 'active red'  : ''} onClick={() => selectTeam('red')} >Червона</button>
          <button className={myPlayer.team === 'blue' ? 'active blue' : ''} onClick={() => selectTeam('blue')}>Синя</button>
        </div>

        <div className="control-group">
          <span>Роль:</span>
          <button className={myPlayer.role === 'operative'  ? 'active' : ''} onClick={() => selectRole('operative')}>Оперативник</button>
          <button className={myPlayer.role === 'spymaster'  ? 'active' : ''} disabled={teamAlreadyHasSpy} onClick={() => selectRole('spymaster')}>Шпигун</button>
        </div>

        <div className="control-group">
          <button onClick={() => fileInputRef.current?.click()}>
            {hasWords ? `✓ ${gameState!.wordPool.length} слів завантажено` : 'Завантажити список слів (JSON)'}
          </button>
          <input ref={fileInputRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleFileUpload} />
          {!hasWords && (
            <button onClick={() => socket.emit('uploadWords', { words: sampleWords })}>Стандартні слова</button>
          )}
        </div>

        {startHint && <span className="start-hint">{startHint}</span>}
        {isHost ? (
          <button className="start-btn" disabled={!hasWords || !teamsReady} onClick={() => socket.emit('startGame')}>
            Почати гру
          </button>
        ) : (
          <span className="start-hint">Очікуємо на хоста…</span>
        )}
      </div>
    </div>
  );
}
