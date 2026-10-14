/* ------------------------------------------------------------------
   VANTA — top bar.
   The original desktop navigation, now data-driven: it reads the live
   balance and profile from the store and links to real routes.
   ------------------------------------------------------------------ */

import { CoinGlyph, DiamondMark } from './art'
import { Avatar } from './ui'
import { useApp } from '../state/AppContext'
import { useRoute, type RouteName } from '../router'

type Link = {
  label: string
  href: string
  match: RouteName[]
}

const LINKS: Link[] = [
  { label: 'Games', href: '#/play', match: ['play', 'blackjack'] },
  { label: 'History', href: '#/history', match: ['history', 'stats'] },
  { label: 'Credits', href: '#/credits', match: ['credits', 'rewards'] },
  {
    label: 'Profile',
    href: '#/profile',
    match: ['profile', 'settings', 'how-to-play', 'faq', 'privacy', 'terms'],
  },
]

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2)
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || 'V'
}

export function TopNav({ active }: { active?: RouteName }) {
  const route = useRoute()
  const current = active ?? route.name
  const { state, level } = useApp()
  const { balance, player } = state

  return (
    <header className="nav">
      <div className="shell nav__inner">
        <a className="brand" href="#/" aria-label="VANTA home">
          <DiamondMark size={9} className="brand__mark" />
          <span className="brand__name">VANTA</span>
        </a>

        <nav className="nav__links" aria-label="Primary">
          {LINKS.map((link) => {
            const isActive = link.match.includes(current)
            return (
              <a
                key={link.label}
                className={isActive ? 'nav__link is-active' : 'nav__link'}
                href={link.href}
                aria-current={isActive ? 'page' : undefined}
              >
                {link.label}
              </a>
            )
          })}
        </nav>

        <div className="nav__right">
          <span className="balance-chip" title="Virtual credits">
            <CoinGlyph size={15} className="coin-lead" />
            <span className="balance-chip__value num">
              {balance.toLocaleString('en-US')}
            </span>
            <span className="balance-chip__unit">VC</span>
          </span>
          <a
            className="nav__profile"
            href="#/profile"
            aria-label={`Signed in as ${player.name}, level ${level.level}`}
          >
            <span className="nav__level num">Lv {level.level}</span>
            <Avatar id={player.avatar} initials={initials(player.name)} size={32} />
          </a>
        </div>
      </div>
    </header>
  )
}
