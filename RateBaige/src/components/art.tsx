/* ------------------------------------------------------------------
   VANTA — vector illustration library
   Hand-built, geometric, crisp. No bitmaps, no PNGs.
   ------------------------------------------------------------------ */

type Suit = 'spade' | 'heart' | 'diamond' | 'club'

const SUIT_FILL = {
  spade: '#1c1f1a',
  club: '#1c1f1a',
  heart: '#ad514a',
  diamond: '#ad514a',
}

const SUIT_PATH: Record<Exclude<Suit, 'club'>, string> = {
  spade:
    'M12 1.7C12 1.7 3.2 9.5 3.2 14.7c0 3.2 2.5 5.7 5.6 5.7 1.4 0 2.6-.5 3.1-1.4-.5 2.5-1.4 4.2-2.9 5.9h6c-1.5-1.7-2.4-3.4-2.9-5.9.5.9 1.7 1.4 3.1 1.4 3.1 0 5.6-2.5 5.6-5.7C20.8 9.5 12 1.7 12 1.7Z',
  heart:
    'M12 22.3C12 22.3 2.3 15.7 2.3 9.9c0-3.4 2.6-6 5.7-6 1.9 0 3.3 1 4 2.4.7-1.4 2.1-2.4 4-2.4 3.1 0 5.7 2.6 5.7 6 0 5.8-9.7 12.4-9.7 12.4Z',
  diamond: 'M12 1.3 22.7 12 12 22.7 1.3 12Z',
}

/** Suit rendered inside an existing <svg>, positioned in a 24×24 box. */
function SuitShape({
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
  if (suit === 'club') {
    return (
      <g transform={`translate(${x} ${y}) scale(${s})`} fill={SUIT_FILL.club}>
        <circle cx="12" cy="7.4" r="4.5" />
        <circle cx="6.9" cy="14.6" r="4.5" />
        <circle cx="17.1" cy="14.6" r="4.5" />
        <path d="M10.4 15h3.2l1.4 7.4H9Z" />
      </g>
    )
  }
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d={SUIT_PATH[suit]} fill={SUIT_FILL[suit]} />
    </g>
  )
}

function CardCorner({ suit, rank }: { suit: Suit; rank: string }) {
  return (
    <g>
      <text
        x="12.5"
        y="29"
        fontSize="20"
        fontWeight="500"
        fill={SUIT_FILL[suit]}
        style={{ fontFamily: 'var(--serif)' }}
      >
        {rank}
      </text>
      <SuitShape suit={suit} x={13.2} y={34.5} size={12} />
    </g>
  )
}

/** One crisp playing card, 104 × 148, drawn at (x, y) with a rotation. */
function PlayingCard({
  rank,
  suit,
  x,
  y,
  rotate,
}: {
  rank: string
  suit: Suit
  x: number
  y: number
  rotate: number
}) {
  const court = rank !== 'A'
  return (
    <g transform={`translate(${x} ${y}) rotate(${rotate})`}>
      <rect
        width="104"
        height="148"
        rx="9"
        fill="#f1ebdd"
        stroke="rgba(18,20,14,0.32)"
        strokeWidth="1"
      />
      <rect
        x="4.5"
        y="4.5"
        width="95"
        height="139"
        rx="6"
        fill="none"
        stroke="rgba(18,20,14,0.07)"
        strokeWidth="1"
      />
      <CardCorner suit={suit} rank={rank} />
      <g transform="translate(104 148) rotate(180)">
        <CardCorner suit={suit} rank={rank} />
      </g>
      {court ? (
        <>
          <text
            x="52"
            y="79"
            fontSize="46"
            fontWeight="500"
            textAnchor="middle"
            fill={SUIT_FILL[suit]}
            style={{ fontFamily: 'var(--serif)' }}
          >
            {rank}
          </text>
          <SuitShape suit={suit} x={44.5} y={86} size={15} />
        </>
      ) : (
        <SuitShape suit={suit} x={23} y={45} size={58} />
      )}
    </g>
  )
}

type ChipTone = 'gold' | 'ivory' | 'red' | 'ink'

const CHIP_FILL: Record<ChipTone, string> = {
  gold: '#c7a568',
  ivory: '#e8e0cf',
  red: '#ad514a',
  ink: '#242a22',
}

const CHIP_MARK: Record<ChipTone, string> = {
  gold: 'rgba(18,20,14,0.45)',
  ivory: 'rgba(18,20,14,0.32)',
  red: 'rgba(241,235,221,0.52)',
  ink: 'rgba(199,165,104,0.62)',
}

/** A precisely rendered geometric casino chip. */
function Chip({
  x,
  y,
  r,
  tone,
}: {
  x: number
  y: number
  r: number
  tone: ChipTone
}) {
  const fill = CHIP_FILL[tone]
  const mark = CHIP_MARK[tone]
  const ticks = Array.from({ length: 8 }, (_, i) => {
    const a = ((i * 45 - 90) * Math.PI) / 180
    const cos = Math.cos(a)
    const sin = Math.sin(a)
    return {
      key: i,
      x1: cos * r * 0.72,
      y1: sin * r * 0.72,
      x2: cos * r * 0.95,
      y2: sin * r * 0.95,
    }
  })

  return (
    <g transform={`translate(${x} ${y})`}>
      <circle r={r} fill={fill} stroke="rgba(10,12,8,0.4)" strokeWidth="1" />
      {ticks.map((t) => (
        <line
          key={t.key}
          x1={t.x1}
          y1={t.y1}
          x2={t.x2}
          y2={t.y2}
          stroke={mark}
          strokeWidth={r * 0.12}
        />
      ))}
      <circle
        r={r * 0.66}
        fill="none"
        stroke={mark}
        strokeWidth="1"
        strokeDasharray="3.6 3.6"
        opacity="0.85"
      />
      <circle
        r={r * 0.44}
        fill="none"
        stroke={mark}
        strokeWidth="1.1"
        opacity="0.85"
      />
      <path
        d={`M0 ${-r * 0.2}L${r * 0.2} 0 0 ${r * 0.2} ${-r * 0.2} 0Z`}
        fill={mark}
        opacity="0.85"
      />
    </g>
  )
}

/** Hero illustration: a felt table with a royal fan and stacked chips. */
export function TableArt({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 520 260"
      className={className}
      aria-label="An ace, king and queen fanned on a felt table beside a stack of chips"
      role="img"
    >
      <defs>
        <radialGradient id="vantaFelt" cx="50%" cy="32%" r="74%">
          <stop offset="0%" stopColor="#2f362d" />
          <stop offset="100%" stopColor="#141810" />
        </radialGradient>
        <filter
          id="vantaCardShadow"
          x="-60%"
          y="-60%"
          width="220%"
          height="220%"
        >
          <feDropShadow
            dx="0"
            dy="9"
            stdDeviation="9"
            floodColor="#000000"
            floodOpacity="0.5"
          />
        </filter>
        <filter
          id="vantaChipShadow"
          x="-70%"
          y="-70%"
          width="240%"
          height="240%"
        >
          <feDropShadow
            dx="0"
            dy="5"
            stdDeviation="5"
            floodColor="#000000"
            floodOpacity="0.45"
          />
        </filter>
      </defs>

      <ellipse cx="260" cy="136" rx="176" ry="112" fill="url(#vantaFelt)" />
      <ellipse
        cx="260"
        cy="136"
        rx="176"
        ry="112"
        fill="none"
        stroke="rgba(199,165,104,0.22)"
      />
      <ellipse
        cx="260"
        cy="136"
        rx="165"
        ry="102"
        fill="none"
        stroke="rgba(199,165,104,0.1)"
      />

      <g filter="url(#vantaCardShadow)">
        <PlayingCard rank="K" suit="heart" x={140} y={58} rotate={-14} />
        <PlayingCard rank="Q" suit="club" x={278} y={56} rotate={12} />
      </g>
      <g filter="url(#vantaCardShadow)">
        <PlayingCard rank="A" suit="spade" x={210} y={40} rotate={-2} />
      </g>

      <g filter="url(#vantaChipShadow)">
        <Chip x={182} y={201} r={25} tone="ink" />
        <Chip x={179} y={195} r={25} tone="red" />
        <Chip x={176} y={189} r={25} tone="gold" />
      </g>
      <g filter="url(#vantaChipShadow)">
        <Chip x={400} y={96} r={18} tone="ivory" />
      </g>
    </svg>
  )
}

/* ---------------- small interface glyphs ---------------- */

export function DiamondMark({
  size = 9,
  className,
}: {
  size?: number
  className?: string
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 10 10"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M5 0.8 9.2 5 5 9.2 0.8 5Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.15"
      />
    </svg>
  )
}

export function CoinGlyph({
  size = 16,
  className,
}: {
  size?: number
  className?: string
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      aria-hidden="true"
      className={className}
    >
      <circle cx="10" cy="10" r="8.4" fill="currentColor" opacity="0.14" />
      <circle
        cx="10"
        cy="10"
        r="8.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
        opacity="0.75"
      />
      <circle
        cx="10"
        cy="10"
        r="5.3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
        opacity="0.42"
      />
      <path d="M10 6.5 13.5 10 10 13.5 6.5 10Z" fill="currentColor" opacity="0.9" />
    </svg>
  )
}

export function CreditCoin({
  size = 56,
  className,
}: {
  size?: number
  className?: string
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 56 56"
      aria-hidden="true"
      className={className}
    >
      <defs>
        <linearGradient id="vantaCoin" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#e3ca97" />
          <stop offset="100%" stopColor="#b08f4f" />
        </linearGradient>
      </defs>
      <circle cx="28" cy="28" r="21" fill="url(#vantaCoin)" />
      <circle
        cx="28"
        cy="28"
        r="21"
        fill="none"
        stroke="rgba(10,12,8,0.38)"
      />
      <circle
        cx="28"
        cy="28"
        r="20.4"
        fill="none"
        stroke="rgba(255,255,255,0.26)"
        strokeWidth="1"
      />
      <circle
        cx="28"
        cy="28"
        r="15.6"
        fill="none"
        stroke="rgba(18,20,14,0.32)"
        strokeWidth="1"
        strokeDasharray="3.4 3.4"
      />
      <circle
        cx="28"
        cy="28"
        r="11"
        fill="none"
        stroke="rgba(18,20,14,0.34)"
        strokeWidth="1"
      />
      <path d="M28 19.8 36.2 28 28 36.2 19.8 28Z" fill="rgba(18,20,14,0.42)" />
    </svg>
  )
}

export function BlackjackGlyph({ size = 46 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <g transform="rotate(-10 19 26)">
        <rect
          x="9"
          y="12"
          width="20"
          height="28"
          rx="3"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
        />
      </g>
      <g transform="rotate(7 30 23)">
        <rect
          x="20"
          y="9"
          width="20"
          height="28"
          rx="3"
          fill="currentColor"
          fillOpacity="0.08"
          stroke="currentColor"
          strokeWidth="1.4"
        />
        <path
          d="M30 19.6 34.2 24 30 28.4 25.8 24Z"
          fill="currentColor"
          opacity="0.5"
        />
      </g>
    </svg>
  )
}

export function RouletteGlyph({ size = 46 }: { size?: number }) {
  const spokes = Array.from({ length: 16 }, (_, i) => {
    const a = (i * 22.5 * Math.PI) / 180
    const cos = Math.cos(a)
    const sin = Math.sin(a)
    return { key: i, x1: 24 + cos * 11, y1: 24 + sin * 11, x2: 24 + cos * 17, y2: 24 + sin * 17 }
  })
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <circle
        cx="24"
        cy="24"
        r="17"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        opacity="0.85"
      />
      {spokes.map((s) => (
        <line
          key={s.key}
          x1={s.x1}
          y1={s.y1}
          x2={s.x2}
          y2={s.y2}
          stroke="currentColor"
          strokeWidth="1"
          opacity="0.4"
        />
      ))}
      <circle
        cx="24"
        cy="24"
        r="11"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
        opacity="0.5"
      />
      <circle cx="24" cy="24" r="2.6" fill="currentColor" opacity="0.65" />
      <circle cx="36.6" cy="15.4" r="1.9" fill="currentColor" />
    </svg>
  )
}

export function PokerGlyph({ size = 46 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <circle
        cx="24"
        cy="24"
        r="17"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        opacity="0.5"
      />
      <g transform="translate(13.6 13.2) scale(0.87)">
        <path d={SUIT_PATH.spade} fill="currentColor" opacity="0.85" />
      </g>
    </svg>
  )
}

/* ---------------- ledger status glyphs ---------------- */

export type StatusKind = 'spark' | 'check' | 'chip' | 'coin' | 'flag' | 'info'

export function StatusGlyph({
  kind,
  size = 15,
}: {
  kind: StatusKind
  size?: number
}) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 20 20',
    'aria-hidden': true as const,
  }

  switch (kind) {
    case 'spark':
      return (
        <svg {...common}>
          <path
            d="M10 4.8c.5 3.6 1.7 4.8 5.3 5.3-3.6.5-4.8 1.7-5.3 5.3-.5-3.6-1.7-4.8-5.3-5.3 3.6-.5 4.8-1.7 5.3-5.3Z"
            fill="currentColor"
          />
        </svg>
      )
    case 'check':
      return (
        <svg {...common}>
          <path
            d="M5.2 10.4 8.4 13.6 14.8 7"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )
    case 'chip':
      return (
        <svg {...common}>
          <circle
            cx="10"
            cy="10"
            r="6.6"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.3"
          />
          <circle
            cx="10"
            cy="10"
            r="3.4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
            strokeDasharray="2.2 2.2"
            opacity="0.8"
          />
        </svg>
      )
    case 'coin':
      return (
        <svg {...common}>
          <circle
            cx="10"
            cy="10"
            r="6.6"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.3"
          />
          <path
            d="M10 7.4 12.6 10 10 12.6 7.4 10Z"
            fill="currentColor"
            opacity="0.85"
          />
        </svg>
      )
    case 'flag':
      return (
        <svg {...common}>
          <path
            d="M6.4 3.4v13.2M6.4 4h8.4l-1.9 3.2 1.9 3.2H6.4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )
    default:
      return (
        <svg {...common}>
          <circle
            cx="10"
            cy="10"
            r="6.8"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.2"
          />
          <path
            d="M10 9v4.6"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
          <circle cx="10" cy="6.6" r="0.85" fill="currentColor" />
        </svg>
      )
  }
}
