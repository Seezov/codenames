import type { GameState, Player } from '@codenames/shared';
import Board from './Board';
import TeamSidebar from './TeamSidebar';
import CluePanel from './CluePanel';
import WinModal from './WinModal';

interface Props {
  gameState: GameState;
  myPlayer: Player | null;
}

export default function GameScreen({ gameState, myPlayer }: Props) {
  const isMyTurn = myPlayer?.team === gameState.currentTeam;

  return (
    <div className="game-screen">
      <TeamSidebar
        team="red"
        players={gameState.players.filter(p => p.team === 'red')}
        score={gameState.scores.red}
        isActive={gameState.currentTeam === 'red'}
        total={gameState.board.filter(c => c.type === 'red').length}
        log={gameState.log.filter(e => e.team === 'red')}
      />

      <div className="game-center">
        <CluePanel gameState={gameState} myPlayer={myPlayer} isMyTurn={isMyTurn} />
        <Board gameState={gameState} myPlayer={myPlayer} isMyTurn={isMyTurn} />
        {gameState.phase === 'ended' && gameState.winner && (
          <WinModal winner={gameState.winner} />
        )}
      </div>

      <TeamSidebar
        team="blue"
        players={gameState.players.filter(p => p.team === 'blue')}
        score={gameState.scores.blue}
        isActive={gameState.currentTeam === 'blue'}
        total={gameState.board.filter(c => c.type === 'blue').length}
        log={gameState.log.filter(e => e.team === 'blue')}
      />
    </div>
  );
}
