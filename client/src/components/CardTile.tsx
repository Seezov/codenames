import type { Card } from '@codenames/shared';

interface Props {
  card: Card;
  index: number;
  isSpymaster: boolean;
  canGuess: boolean;
  onReveal: (index: number) => void;
}

export default function CardTile({ card, index, isSpymaster, canGuess, onReveal }: Props) {
  const classes = [
    'card',
    card.revealed ? `revealed ${card.type}` : '',
    !card.revealed && isSpymaster ? `spy-hint ${card.type}` : '',
    canGuess && !card.revealed ? 'guessable' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes} onClick={() => !card.revealed && onReveal(index)}>
      <div className="card-inner">
        <div className="card-front">
          <span className="card-word">{card.word}</span>
        </div>
        <div className="card-back">
          <span className="card-word">{card.word}</span>
        </div>
      </div>
    </div>
  );
}
