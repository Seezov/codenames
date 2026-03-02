import { useEffect, useState } from 'react';
import type { GameState } from '@codenames/shared';
import socket from './socket';
import LobbyScreen from './components/LobbyScreen';
import GameScreen from './components/GameScreen';

export default function App() {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    socket.on('gameState', state => {
      setGameState(state);
      setError(null);
    });
    socket.on('error', msg => setError(msg));
    return () => {
      socket.off('gameState');
      socket.off('error');
    };
  }, []);

  const myPlayer = gameState?.players.find(p => p.id === socket.id);

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
