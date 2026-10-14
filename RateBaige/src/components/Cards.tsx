/* ------------------------------------------------------------------
   VANTA — playing-card rendering for the game table.
   Crisp SVG so cards stay sharp at any size and animate cleanly.
   ------------------------------------------------------------------ */

import type { Card, Suit } from '../lib/engine/deck'
import { RANK_LABEL, SUIT_SYMBOL } from '../lib/engine/deck'

const SUIT_FILL: Record<Suit, string> = {
  spade: '#1b1e19',
  club: '#1b1e19',
  heart: '#ad514a',
  diamond: '#ad514a',
}

const SUIT_PATH: Record<Suit, string> = {
  spade:
    'M12 1.7C12 1.7 3.2 9.5 3.2 14.7c0 3.2 2.5 5.7 5.6 5.7 1.4 0 2.6-.5 3.1-1.4-.5 2.5-1.4 4.2-2.9 5.9h6c-1.5-1.7-2.4-3.4-2.9-5.9.5.9 1.7 1.4 3.1 1.4 3.1 0 5.6-2.5 5.6-5.7C20.8 9.5 12 1.7 12 1.7Z',
  heart:
    'M12 22.3C12 22.3 2.3 15.7 2.3 9.9c0-3.4 2.6-6 5.7-6 1.9 0 3.3 1 4 2.4.7-1.4 2.1-2.4 4-2.4 3.1 0 5.7 2.6 5.7 6 0 5.8-9.7 12.4-9.7 12.4Z',
  diamond: 'M12 1.3 22.7 12 12 22.7 1.3 12Z',
  club: 'M12 6.2a4.3 4.3 0 1 1 3.1 7.4c.5.9 1.2 1.6 2.2 2.1H6.7c1-.5 1.7-1.2 2.2-2.1A4.3 4.3 0 1 1 12 6.2Z',
}

function SuitMark({
  suit,
  x,
  y,
  size,
}: {
  suit: Suit
  x: number
  y: number
  size: number
}) {
  const s = size / 24
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} fill={SUIT_FILL[suit]}>
      <path d={SUIT_PATH[suit]} />
      {suit === 'club' && <path d="M10.4 15h3.2l1.3 7.2H9.1Z" />}
    </g>
  )
}

function Corner({ rank, suit }: { rank: Card['rank']; suit: Suit }) {
  return (
    <g>
      <text
        x="13"
        y="30"
        fontSize={rank === '10' ? 19 : 22}
        fontWeight="600"
        fill={SUIT_FILL[suit]}
        style={{ fontFamily: 'var(--serif)' }}
      >
        {RANK_LABEL[rank]}
      </text>
      <SuitMark suit={suit} x={13.5} y={35} size={13} />
    </g>
  )
}

export function CardFace({
  card,
  faceDown = false,
  className,
}: {
  card: Card
  faceDown?: boolean
  className?: string
}) {
  if (faceDown) return <CardBack className={className} />
  const court = card.rank === 'J' || card.rank === 'Q' || card.rank === 'K'
  const ace = card.rank === 'A'
  return (
    <svg
      viewBox="0 0 104 148"
      className={`cardface ${className ?? ''}`}
      role="img"
      aria-label={`${RANK_LABEL[card.rank]} of ${card.suit}`}
    >
      <rect width="104" height="148" rx="10" fill="#f3eee2" />
      <rect
        x="4"
        y="4"
        width="96"
        height="140"
        rx="7"
        fill="none"
        stroke="rgba(18,20,14,0.09)"
      />
      <Corner rank={card.rank} suit={card.suit} />
      <g transform="translate(104 148) rotate(180)">
        <Corner rank={card.rank} suit={card.suit} />
      </g>
      {ace ? (
        <SuitMark suit={card.suit} x={23} y={45} size={58} />
      ) : court ? (
        <>
          <text
            x="52"
            y="76"
            fontSize="42"
            fontWeight="600"
            textAnchor="middle"
            fill={SUIT_FILL[card.suit]}
            style={{ fontFamily: 'var(--serif)' }}
          >
            {RANK_LABEL[card.rank]}
          </text>
          <SuitMark suit={card.suit} x={45} y={86} size={15} />
        </>
      ) : (
        <>
          <text
            x="52"
            y="82"
            fontSize="50"
            fontWeight="600"
            textAnchor="middle"
            fill={SUIT_FILL[card.suit]}
            style={{ fontFamily: 'var(--serif)' }}
          >
            {RANK_LABEL[card.rank]}
          </text>
          <SuitMark suit={card.suit} x={45.5} y={92} size={14} />
        </>
      )}
    </svg>
  )
}

export function CardBack({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 104 148"
      className={`cardface ${className ?? ''}`}
      aria-label="Face-down card"
      role="img"
    >
      <rect width="104" height="148" rx="10" fill="#222a22" />
      <rect
        x="4"
        y="4"
        width="96"
        height="140"
        rx="7"
        fill="none"
        stroke="rgba(199,165,104,0.35)"
      />
      <rect
        x="9"
        y="9"
        width="86"
        height="130"
        rx="5"
        fill="none"
        stroke="rgba(199,165,104,0.16)"
      />
      <g fill="none" stroke="rgba(199,165,104,0.5)" strokeWidth="1.1">
        <path d="M52 44 74 74 52 104 30 74Z" />
        <path d="M52 58 64 74 52 90 40 74Z" opacity="0.6" />
        <circle cx="52" cy="74" r="4" fill="rgba(199,165,104,0.5)" stroke="none" />
      </g>
    </svg>
  )
}

/** A tiny inline card used in summaries and lists. */
export function MiniCard({ card, faceDown }: { card: Card; faceDown?: boolean }) {
  return (
    <span className={`minicard ${faceDown ? 'is-down' : ''}`}>
      {faceDown ? (
        <span className="minicard__back" aria-hidden="true" />
      ) : (
        <>
          <span className="minicard__rank" style={{ color: SUIT_FILL[card.suit] }}>
            {RANK_LABEL[card.rank]}
          </span>
          <span className="minicard__suit" style={{ color: SUIT_FILL[card.suit] }}>
            {SUIT_SYMBOL[card.suit]}
          </span>
        </>
      )}
    </span>
  )
}
