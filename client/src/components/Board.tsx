import type { GameState, Player } from '@codenames/shared';
import socket from '../socket';
import CardTile from './CardTile';

interface Props {
  gameState: GameState;
  myPlayer: Player | null;
  isMyTurn: boolean;
}

export default function Board({ gameState, myPlayer, isMyTurn }: Props) {
  const isSpymaster = myPlayer?.role === 'spymaster' || gameState.phase === 'ended';
  const canVote = isMyTurn && myPlayer?.role === 'operative' && !!gameState.clue && gameState.guessesLeft > 0;

  function handleVote(index: number) {
    if (!canVote) return;
    socket.emit('voteCard', { cardIndex: index });
  }

  return (
    <div className="board">
      {gameState.board.map((card, i) => {
        const voters = gameState.players.filter(p => gameState.cardVotes[p.id] === i);
        return (
          <CardTile
            key={i}
            card={card}
            index={i}
            isSpymaster={isSpymaster}
            canVote={canVote}
            myVote={myPlayer ? gameState.cardVotes[myPlayer.id] === i : false}
            voters={voters}
            onVote={handleVote}
          />
        );
      })}
    </div>
  );
}
