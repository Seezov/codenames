import type { Card, Player } from '@codenames/shared';

interface Props {
  card: Card;
  index: number;
  isSpymaster: boolean;
  canVote: boolean;
  myVote: boolean;
  voters: Player[];
  onVote: (index: number) => void;
}

export default function CardTile({ card, index, isSpymaster, canVote, myVote, voters, onVote }: Props) {
  const classes = [
    'card',
    card.revealed ? `revealed ${card.type}` : '',
    !card.revealed && isSpymaster ? `spy-hint ${card.type}` : '',
    canVote && !card.revealed ? 'guessable' : '',
    myVote && !card.revealed ? 'my-vote' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes} onClick={() => !card.revealed && onVote(index)}>
      <div className="card-inner">
        <div className="card-front">
          <span className="card-word">{card.word}</span>
          {voters.length > 0 && !card.revealed && (
            <div className="card-votes">
              {voters.map(p => (
                <span
                  key={p.id}
                  className="vote-dot"
                  style={{ background: p.color }}
                  title={p.name}
                />
              ))}
            </div>
          )}
        </div>
        <div className="card-back">
          <span className="card-word">{card.word}</span>
        </div>
      </div>
    </div>
  );
}
