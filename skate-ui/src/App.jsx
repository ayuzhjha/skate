import { useState, useEffect } from 'react';
import { Routes, Route, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { Home as HomeIcon, Gamepad2, Gift, User, Settings as SettingsIcon, Volume2, VolumeX } from 'lucide-react';
import { useStore } from './hooks';
import { onToast, isDailyClaimAvailable, getState, saveState } from './store';
import HomePage from './pages/Home';
import PlayPage from './pages/Play';
import RewardsPage from './pages/Rewards';
import ProfilePage from './pages/Profile';
import SettingsPage from './pages/Settings';
import HistoryPage from './pages/History';
import WinLoseModal from './components/WinLoseModal';
import { initBackgroundNotifications } from './notificationService';

function ToastContainer() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    return onToast(({ msg, type }) => {
      const id = Date.now() + Math.random();
      setToasts(prev => [...prev, { id, msg, type }]);
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, 3000);
    });
  }, []);

  return (
    <div className="toast-container">
      {toasts.map(t => (
        <div key={t.id} className={`toast toast-${t.type === 'gold' ? 'gold' : t.type === 'danger' || t.type === 'red' ? 'red' : t.type === 'blue' || t.type === 'info' ? 'blue' : ''}`}>
          {t.msg}
        </div>
      ))}
    </div>
  );
}

export default function App() {
  const state = useStore();
  const navigate = useNavigate();
  const location = useLocation();

  const claimableCount = state.missions.filter(m => m.progress >= m.target && !m.claimed).length + (isDailyClaimAvailable() ? 1 : 0);

  const toggleSound = () => {
    const s = getState();
    s.settings.sound = !s.settings.sound;
    saveState();
  };

  useEffect(() => {
    const el = document.querySelector('.main-content');
    if (el) {
      el.scrollTo({ top: 0, behavior: 'instant' });
    }
  }, [location.pathname]);

  useEffect(() => {
    initBackgroundNotifications();
  }, []);

  return (
    <div className="app-shell">
      <ToastContainer />
      <WinLoseModal />

      {/* Header */}
      <header className="header">
        <div className="header-brand" onClick={() => navigate('/')}>
          <img src="/icon.png" alt="SKATE" className="header-logo" />
          <span className="header-title">SKATE</span>
        </div>
        <div className="header-right">
          <div className="balance-chip" onClick={() => navigate('/rewards')}>
            <div className="balance-coin-icon">$</div>
            <span className="balance-amount">{state.credits.toLocaleString()}</span>
            <span className="balance-plus-btn">+</span>
          </div>
          <button
            className={`header-icon-btn ${state.settings.sound ? 'active' : ''}`}
            onClick={toggleSound}
          >
            {state.settings.sound ? <Volume2 size={18} /> : <VolumeX size={18} />}
          </button>
        </div>
      </header>

      {/* Main Content with Route Keyed Animated Transition */}
      <main className="main-content">
        <div key={location.pathname} className="page-transition">
          <Routes location={location}>
            <Route path="/" element={<HomePage />} />
            <Route path="/play" element={<PlayPage />} />
            <Route path="/play/:gameId" element={<PlayPage />} />
            <Route path="/rewards" element={<RewardsPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </div>
      </main>

      {/* Floating Bottom Nav */}
      <nav className="bottom-nav">
        <NavLink to="/" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} end>
          <div className="nav-icon-wrap">
            <HomeIcon size={22} />
          </div>
          <span>Home</span>
          <div className="nav-active-glow" />
        </NavLink>
        <NavLink to="/play" className={({ isActive }) => `nav-item ${location.pathname.startsWith('/play') ? 'active' : ''}`}>
          <div className="nav-icon-wrap">
            <Gamepad2 size={22} />
          </div>
          <span>Play</span>
          <div className="nav-active-glow" />
        </NavLink>
        <NavLink to="/rewards" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <div className="nav-icon-wrap">
            <Gift size={22} />
            {claimableCount > 0 && <span className="nav-badge">{claimableCount}</span>}
          </div>
          <span>Rewards</span>
          <div className="nav-active-glow" />
        </NavLink>
        <NavLink to="/profile" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <div className="nav-icon-wrap">
            <User size={22} />
          </div>
          <span>Profile</span>
          <div className="nav-active-glow" />
        </NavLink>
        <NavLink to="/settings" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <div className="nav-icon-wrap">
            <SettingsIcon size={22} />
          </div>
          <span>Settings</span>
          <div className="nav-active-glow" />
        </NavLink>
      </nav>
    </div>
  );
}
