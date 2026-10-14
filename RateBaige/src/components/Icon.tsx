/* ------------------------------------------------------------------
   VANTA — interface icon set.
   Thin, geometric, monochrome (currentColor). One 24×24 grid so
   optical weight stays consistent across the app.
   ------------------------------------------------------------------ */

import type { IconName } from '../lib/types'

type Props = {
  name: IconName
  size?: number
  className?: string
  strokeWidth?: number
}

export function Icon({ name, size = 20, className, strokeWidth = 1.6 }: Props) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
    className,
  }

  switch (name) {
    case 'spark':
      return (
        <svg {...common}>
          <path d="M12 3.5c.7 4.6 2.2 6.1 6.8 6.8-4.6.7-6.1 2.2-6.8 6.8-.7-4.6-2.2-6.1-6.8-6.8 4.6-.7 6.1-2.2 6.8-6.8Z" />
        </svg>
      )
    case 'check':
      return (
        <svg {...common}>
          <path d="M5 12.5 9.5 17 19 6.5" />
        </svg>
      )
    case 'chip':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8" />
          <circle cx="12" cy="12" r="4" strokeDasharray="2.6 2.6" />
        </svg>
      )
    case 'coin':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8" />
          <path d="M12 8.4 15.6 12 12 15.6 8.4 12Z" />
        </svg>
      )
    case 'flag':
      return (
        <svg {...common}>
          <path d="M7 4v16M7 4.6h9.4l-2.1 3.5 2.1 3.5H7" />
        </svg>
      )
    case 'info':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8.2" />
          <path d="M12 11v5" />
          <circle cx="12" cy="8" r="0.9" fill="currentColor" stroke="none" />
        </svg>
      )
    case 'trophy':
      return (
        <svg {...common}>
          <path d="M7 4h10v4a5 5 0 0 1-10 0V4Z" />
          <path d="M7 5H4.6v1.6A3.4 3.4 0 0 0 8 10M17 5h2.4v1.6A3.4 3.4 0 0 1 16 10" />
          <path d="M12 13v4M9 20h6M10 20l.6-3h2.8l.6 3" />
        </svg>
      )
    case 'up':
      return (
        <svg {...common}>
          <path d="M12 19V5M6 11l6-6 6 6" />
        </svg>
      )
    case 'down':
      return (
        <svg {...common}>
          <path d="M12 5v14M6 13l6 6 6-6" />
        </svg>
      )
    case 'gift':
      return (
        <svg {...common}>
          <path d="M4 11h16v9H4zM4 8h16v3H4zM12 8v12" />
          <path d="M12 8S10.6 4 8.6 4a2 2 0 0 0 0 4M12 8s1.4-4 3.4-4a2 2 0 0 1 0 4" />
        </svg>
      )
    case 'flame':
      return (
        <svg {...common}>
          <path d="M12 3s5 4.4 5 9a5 5 0 0 1-10 0c0-1.7.7-3 1.6-4.2.5 1 1.4 1.7 2 1.7 0-2.4 1.4-4.5 1.4-6.5Z" />
        </svg>
      )
    case 'target':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="7.5" />
          <circle cx="12" cy="12" r="3.4" />
          <circle cx="12" cy="12" r="0.9" fill="currentColor" stroke="none" />
        </svg>
      )
    case 'home':
      return (
        <svg {...common}>
          <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z" />
        </svg>
      )
    case 'cards':
      return (
        <svg {...common}>
          <g transform="rotate(-9 10 13)">
            <rect x="5.5" y="6" width="10" height="14.5" rx="1.8" />
          </g>
          <g transform="rotate(7 15 12)">
            <rect x="10" y="4.5" width="10" height="14.5" rx="1.8" fill="currentColor" fillOpacity="0.1" />
            <path d="M15 9.5 17.2 12 15 14.5 12.8 12Z" fill="currentColor" opacity="0.55" stroke="none" />
          </g>
        </svg>
      )
    case 'play':
      return (
        <svg {...common}>
          <path d="M8 5.5v13l11-6.5z" />
        </svg>
      )
    case 'stats':
      return (
        <svg {...common}>
          <path d="M5 20V12M12 20V5M19 20v-6" />
        </svg>
      )
    case 'user':
      return (
        <svg {...common}>
          <circle cx="12" cy="8.5" r="3.6" />
          <path d="M5 20a7 7 0 0 1 14 0" />
        </svg>
      )
    case 'settings':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3.1" />
          <path d="M12 3.5v2.2M12 18.3v2.2M20.5 12h-2.2M5.7 12H3.5M18 6l-1.6 1.6M7.6 16.4 6 18M18 18l-1.6-1.6M7.6 7.6 6 6" />
        </svg>
      )
    case 'bell':
      return (
        <svg {...common}>
          <path d="M6.5 17V11a5.5 5.5 0 0 1 11 0v6l1.3 1.8H5.2z" />
          <path d="M10 20.4a2 2 0 0 0 4 0" />
        </svg>
      )
    case 'sound':
      return (
        <svg {...common}>
          <path d="M4.5 10v4h3l4 3.2V6.8L7.5 10z" />
          <path d="M15 9.5a3.6 3.6 0 0 1 0 5M17.4 7.4a7 7 0 0 1 0 9.2" />
        </svg>
      )
    case 'haptic':
      return (
        <svg {...common}>
          <rect x="8" y="4" width="8" height="16" rx="2" />
          <path d="M4.6 9.5v5M2.8 11v2M19.4 9.5v5M21.2 11v2" />
        </svg>
      )
    case 'moon':
      return (
        <svg {...common}>
          <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />
        </svg>
      )
    case 'chevron':
      return (
        <svg {...common}>
          <path d="M9.5 6 16 12l-6.5 6" />
        </svg>
      )
    case 'close':
      return (
        <svg {...common}>
          <path d="M6 6l12 12M18 6 6 18" />
        </svg>
      )
    case 'trash':
      return (
        <svg {...common}>
          <path d="M4.5 7h15M9.5 7V4.8h5V7M7 7l.9 13h8.2L17 7M10.5 10.5v6M13.5 10.5v6" />
        </svg>
      )
    case 'lock':
      return (
        <svg {...common}>
          <rect x="5" y="10.5" width="14" height="9.5" rx="2" />
          <path d="M8.2 10.5V8a3.8 3.8 0 0 1 7.6 0v2.5" />
        </svg>
      )
    case 'shield':
      return (
        <svg {...common}>
          <path d="M12 3.5 19 6v6c0 4.2-3 7-7 8.5C8 19 5 16.2 5 12V6z" />
          <path d="M9.2 12.2 11.3 14.3 15 10.6" />
        </svg>
      )
    case 'book':
      return (
        <svg {...common}>
          <path d="M5 4.5h6.2A2.8 2.8 0 0 1 14 7.3V20a2.5 2.5 0 0 0-2.5-2.3H5z" />
          <path d="M19 4.5h-3.2A2.8 2.8 0 0 0 13 7.3V20a2.5 2.5 0 0 1 2.5-2.3H19z" />
        </svg>
      )
    case 'question':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8.2" />
          <path d="M9.6 9.6a2.5 2.5 0 0 1 4.8.9c0 1.7-2.4 2-2.4 3.6" />
          <circle cx="12" cy="17.2" r="0.9" fill="currentColor" stroke="none" />
        </svg>
      )
    case 'arrow-right':
      return (
        <svg {...common}>
          <path d="M5 12h13M12.5 6l6 6-6 6" />
        </svg>
      )
    case 'refresh':
      return (
        <svg {...common}>
          <path d="M19 12a7 7 0 1 1-2.1-5M19 4.5V9h-4.5" />
        </svg>
      )
    case 'plus':
      return (
        <svg {...common}>
          <path d="M12 5.5v13M5.5 12h13" />
        </svg>
      )
    case 'minus':
      return (
        <svg {...common}>
          <path d="M5.5 12h13" />
        </svg>
      )
    case 'history':
      return (
        <svg {...common}>
          <path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3M4.5 5v4h4" />
          <path d="M12 8.5V12l2.6 2" />
        </svg>
      )
    case 'wallet':
      return (
        <svg {...common}>
          <rect x="4" y="6.5" width="16" height="11.5" rx="2" />
          <path d="M4 10h16" />
          <circle cx="16.4" cy="14" r="1" fill="currentColor" stroke="none" />
        </svg>
      )
    default:
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8" />
        </svg>
      )
  }
}
