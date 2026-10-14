import { BottomNav } from './components/BottomNav'
import { ToastHost } from './components/ui'
import { Blackjack } from './pages/Blackjack'
import { Credits } from './pages/Credits'
import { History } from './pages/History'
import { Home } from './pages/Home'
import { Faq, HowToPlay, Privacy, Terms } from './pages/Legal'
import { Play } from './pages/Play'
import { Profile } from './pages/Profile'
import { Rewards } from './pages/Rewards'
import { Settings } from './pages/Settings'
import { StatsView } from './pages/Stats'
import { useRoute, useScrollTop } from './router'
import { AppProvider } from './state/AppProvider'

function Screen() {
  const route = useRoute()
  useScrollTop(route.name)

  switch (route.name) {
    case 'play':
      return <Play />
    case 'rewards':
      return <Rewards />
    case 'profile':
      return <Profile />
    case 'blackjack':
      return <Blackjack />
    case 'history':
      return <History />
    case 'stats':
      return <StatsView />
    case 'credits':
      return <Credits />
    case 'settings':
      return <Settings />
    case 'how-to-play':
      return <HowToPlay />
    case 'faq':
      return <Faq />
    case 'privacy':
      return <Privacy />
    case 'terms':
      return <Terms />
    default:
      return <Home />
  }
}

function App() {
  const route = useRoute()

  return (
    <AppProvider>
      <div className="stage">
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <div className="screen" id="main" tabIndex={-1} key={route.name}>
          <Screen />
        </div>
        <BottomNav />
        <ToastHost />
      </div>
    </AppProvider>
  )
}

export default App
