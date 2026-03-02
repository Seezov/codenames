import type { GameState, Player } from '@codenames/shared';
import socket from '../socket';
import CardTile from './CardTile';

interface Props {
  gameState: GameState;
  myPlayer: Player | null;
  isMyTurn: boolean;
}

export default function Board({ gameState, myPlayer, isMyTurn }: Props) {
  const isSpymaster = myPlayer?.role === 'spymaster';
  const canGuess = isMyTurn && myPlayer?.role === 'operative' && !!gameState.clue && gameState.guessesLeft > 0;

  function handleReveal(index: number) {
    if (!canGuess) return;
    socket.emit('revealCard', { cardIndex: index });
  }

  return (
    <div className="board">
      {gameState.board.map((card, i) => (
        <CardTile
          key={i}
          card={card}
          index={i}
          isSpymaster={isSpymaster}
          canGuess={canGuess}
          onReveal={handleReveal}
        />
      ))}
    </div>
  );
}
