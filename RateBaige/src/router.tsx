/* ------------------------------------------------------------------
   VANTA — hash router.
   Keeps the existing `#/credits` URL working and adds the rest of the
   app. Hash routing means every screen is directly linkable and
   survives a refresh without server rewrites.
   ------------------------------------------------------------------ */

import { useEffect, useState } from 'react'

export type RouteName =
  | 'home'
  | 'play'
  | 'rewards'
  | 'profile'
  | 'blackjack'
  | 'history'
  | 'stats'
  | 'credits'
  | 'settings'
  | 'how-to-play'
  | 'faq'
  | 'privacy'
  | 'terms'

export type Route = {
  name: RouteName
  path: string
}

const ROUTES: { prefix: string; name: RouteName }[] = [
  { prefix: '#/play', name: 'play' },
  { prefix: '#/rewards', name: 'rewards' },
  { prefix: '#/profile', name: 'profile' },
  { prefix: '#/blackjack', name: 'blackjack' },
  { prefix: '#/history', name: 'history' },
  { prefix: '#/stats', name: 'stats' },
  { prefix: '#/credits', name: 'credits' },
  { prefix: '#/settings', name: 'settings' },
  { prefix: '#/how-to-play', name: 'how-to-play' },
  { prefix: '#/faq', name: 'faq' },
  { prefix: '#/privacy', name: 'privacy' },
  { prefix: '#/terms', name: 'terms' },
]

export function parseRoute(hash: string): Route {
  const clean = hash || '#/'
  for (const r of ROUTES) {
    if (clean === r.prefix || clean.startsWith(r.prefix + '/')) {
      return { name: r.name, path: clean }
    }
  }
  return { name: 'home', path: '#/' }
}

export function hrefFor(name: RouteName): string {
  if (name === 'home') return '#/'
  const found = ROUTES.find((r) => r.name === name)
  return found ? found.prefix : '#/'
}

export function useRoute(): Route {
  const [hash, setHash] = useState(() =>
    typeof window === 'undefined' ? '#/' : window.location.hash,
  )
  useEffect(() => {
    const onChange = () => setHash(window.location.hash)
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return parseRoute(hash)
}

export function navigate(name: RouteName): void {
  const href = hrefFor(name)
  if (window.location.hash === href) return
  window.location.hash = href
}

/** Which primary tab owns a given route (for bottom-nav highlighting). */
export function tabFor(route: RouteName): RouteName {
  switch (route) {
    case 'blackjack':
    case 'history':
    case 'stats':
      return 'play'
    case 'credits':
      return 'rewards'
    case 'settings':
    case 'how-to-play':
    case 'faq':
    case 'privacy':
    case 'terms':
      return 'profile'
    default:
      return route
  }
}

/** Scroll to the top whenever the route changes. */
export function useScrollTop(dep: string): void {
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [dep])
}
