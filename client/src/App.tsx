import { useEffect, useState } from 'react';
import type { AuthUser, GameState } from '@codenames/shared';
import socket from './socket';
import LobbyScreen from './components/LobbyScreen';
import GameScreen from './components/GameScreen';

const SESSION_KEY = 'codenames_session';
const AUTH_TOKEN_KEY = 'auth_token';
const AUTH_USER_KEY  = 'auth_user';

function attemptRejoin() {
  const saved = sessionStorage.getItem(SESSION_KEY);
  if (!saved) return;
  try {
    const { name, roomCode } = JSON.parse(saved);
    if (name && roomCode) socket.emit('joinRoom', { roomCode, playerName: name });
  } catch {
    sessionStorage.removeItem(SESSION_KEY);
  }
}

function attemptResumeAuth() {
  const token = localStorage.getItem(AUTH_TOKEN_KEY);
  if (token) socket.emit('resumeSession', { token });
}

function loadStoredUser(): AuthUser | null {
  try { return JSON.parse(localStorage.getItem(AUTH_USER_KEY) ?? 'null'); }
  catch { return null; }
}

export default function App() {
  const [gameState, setGameState]   = useState<GameState | null>(null);
  const [error, setError]           = useState<string | null>(null);
  const [authUser, setAuthUser]     = useState<AuthUser | null>(loadStoredUser);

  const myPlayer = gameState?.players.find(p => p.id === socket.id) ?? null;

  // Persist game session for auto-rejoin after disconnect
  useEffect(() => {
    if (myPlayer && gameState) {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({
        name: myPlayer.name,
        roomCode: gameState.roomCode,
      }));
    }
  }, [myPlayer?.name, gameState?.roomCode]);

  useEffect(() => {
    socket.on('gameState', state => { setGameState(state); setError(null); });
    socket.on('error', msg => setError(msg));

    socket.on('authResult', result => {
      if ('error' in result) return; // LobbyScreen handles auth errors
      setAuthUser(result.user);
      localStorage.setItem(AUTH_USER_KEY, JSON.stringify(result.user));
      localStorage.setItem(AUTH_TOKEN_KEY, result.token);
    });

    function onConnect() {
      attemptRejoin();
      attemptResumeAuth();
    }
    socket.on('connect', onConnect);
    if (socket.connected) onConnect();

    return () => {
      socket.off('gameState');
      socket.off('error');
      socket.off('authResult');
      socket.off('connect', onConnect);
    };
  }, []);

  function logout() {
    localStorage.removeItem(AUTH_USER_KEY);
    localStorage.removeItem(AUTH_TOKEN_KEY);
    setAuthUser(null);
  }

  return (
    <>
      {error && <div className="error-toast">{error}</div>}
      {!gameState || gameState.phase === 'lobby' ? (
        <LobbyScreen
          gameState={gameState}
          myPlayer={myPlayer ?? null}
          authUser={authUser}
          onLogout={logout}
        />
      ) : (
        <GameScreen gameState={gameState} myPlayer={myPlayer ?? null} />
      )}
    </>
  );
}
