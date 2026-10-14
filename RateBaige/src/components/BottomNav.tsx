/* ------------------------------------------------------------------
   VANTA — persistent bottom navigation (mobile shell).
   Four destinations; a route maps onto one of them so game, history,
   settings and legal screens keep a sensible active tab.
   ------------------------------------------------------------------ */

import { Icon } from './Icon'
import type { IconName } from '../lib/types'
import { tabFor, useRoute, type RouteName } from '../router'
import { useApp } from '../state/AppContext'

const ITEMS: { name: RouteName; label: string; icon: IconName }[] = [
  { name: 'home', label: 'Home', icon: 'home' },
  { name: 'play', label: 'Play', icon: 'cards' },
  { name: 'rewards', label: 'Rewards', icon: 'gift' },
  { name: 'profile', label: 'Profile', icon: 'user' },
]

export function BottomNav() {
  const route = useRoute()
  const active = tabFor(route.name)
  const { state, refill, claimFreeRefill, feedback, notify } = useApp()

  const onRewards = () => {
    feedback.play('tap')
    if (refill.eligible) {
      claimFreeRefill()
      notify({
        title: 'Free top-up',
        body: 'A little credit to keep playing',
        tone: 'gold',
        icon: 'gift',
        amount: refill.amount,
      })
      feedback.play('claim')
    }
  }

  return (
    <nav className="tabbar" aria-label="Primary">
      <div className="tabbar__inner">
        {ITEMS.map((item) => {
          const isActive = item.name === active
          const showDot = item.name === 'rewards' && refill.eligible && state.balance < 100
          return (
            <a
              key={item.name}
              href={item.name === 'home' ? '#/' : `#/${item.name}`}
              className={`tabbar__item${isActive ? ' is-active' : ''}`}
              aria-current={isActive ? 'page' : undefined}
              onClick={item.name === 'rewards' ? onRewards : () => feedback.play('tap')}
            >
              <span className="tabbar__icon" aria-hidden="true">
                <Icon name={item.icon} size={21} />
                {showDot && <span className="tabbar__dot" />}
              </span>
              <span className="tabbar__label">{item.label}</span>
            </a>
          )
        })}
      </div>
    </nav>
  )
}
