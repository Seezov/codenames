import { useEffect, useState } from 'react';
import type { GameState } from '@codenames/shared';
import socket from './socket';
import LobbyScreen from './components/LobbyScreen';
import GameScreen from './components/GameScreen';

const SESSION_KEY = 'codenames_session';

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

export default function App() {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const myPlayer = gameState?.players.find(p => p.id === socket.id) ?? null;

  // Persist session so we can auto-rejoin after a disconnect
  useEffect(() => {
    if (myPlayer && gameState) {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({
        name: myPlayer.name,
        roomCode: gameState.roomCode,
      }));
    }
  }, [myPlayer?.name, gameState?.roomCode]);

  useEffect(() => {
    socket.on('gameState', state => {
      setGameState(state);
      setError(null);
    });
    socket.on('error', msg => setError(msg));
    // Re-join automatically whenever the socket (re)connects
    socket.on('connect', attemptRejoin);
    // Also try immediately if the socket is already connected on mount
    if (socket.connected) attemptRejoin();

    return () => {
      socket.off('gameState');
      socket.off('error');
      socket.off('connect', attemptRejoin);
    };
  }, []);

  return (
    <>
      {error && <div className="error-toast">{error}</div>}
      {!gameState || gameState.phase === 'lobby' ? (
        <LobbyScreen gameState={gameState} myPlayer={myPlayer ?? null} />
      ) : (
        <GameScreen gameState={gameState} myPlayer={myPlayer ?? null} />
      )}
    </>
  );
}
