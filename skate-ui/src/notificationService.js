import { getState, showToast } from './store';

export const ENGAGING_NOTIFICATIONS = [
  {
    title: '⚡ +500 SC Daily Vault Unlocked!',
    body: 'Your free bonus chips are ready to claim. Keep your 7-day winning streak alive! 💎'
  },
  {
    title: '🔥 The Royale Blackjack Table is Hot!',
    body: 'Dealers are busting left and right today. Double down and multiply your bankroll! 🃏'
  },
  {
    title: '💥 18.5× Multiplier Just Dropped on Crash!',
    body: 'Players are cashing out huge wins right now. Can you time your jump? 🚀'
  },
  {
    title: '👑 VIP Mystery Box Primed in Your Locker!',
    body: 'Unopened free spin rewards waiting in SKATE Casino. Tap to reveal your loot! 🎁'
  },
  {
    title: '💧 Complimentary SC Top-Up Available!',
    body: 'Your complimentary faucet has just replenished. Claim your free chips now! ⚡'
  },
  {
    title: '🎲 Lucky Roll Hour is LIVE!',
    body: 'Neon Dice payouts are on fire right now. Roll for the jackpot! 🎲'
  }
];

let _bgTimeout = null;

export function sendLocalNotification(title, message, delaySeconds = 0) {
  const s = getState();
  if (s.settings && s.settings.notifications === false) return false;

  // 1. Android Native Notification Bridge
  try {
    if (window.AndroidNotifications && window.AndroidNotifications.sendNotification) {
      window.AndroidNotifications.sendNotification(title, message, delaySeconds);
      return true;
    }
  } catch {}

  // 2. Web Notifications API Fallback
  try {
    if (typeof Notification !== 'undefined') {
      if (Notification.permission === 'granted') {
        if (delaySeconds <= 0) {
          new Notification(title, {
            body: message,
            icon: '/icon.png',
            badge: '/icon.png',
            vibrate: [150, 75, 200]
          });
        } else {
          setTimeout(() => {
            new Notification(title, {
              body: message,
              icon: '/icon.png',
              badge: '/icon.png',
              vibrate: [150, 75, 200]
            });
          }, delaySeconds * 1000);
        }
        return true;
      } else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then(permission => {
          if (permission === 'granted') {
            new Notification(title, {
              body: message,
              icon: '/icon.png',
              badge: '/icon.png'
            });
          }
        });
      }
    }
  } catch {}

  return false;
}

export function triggerRandomEngagementNotification(delaySeconds = 0) {
  const idx = Math.floor(Math.random() * ENGAGING_NOTIFICATIONS.length);
  const notif = ENGAGING_NOTIFICATIONS[idx];
  sendLocalNotification(notif.title, notif.body, delaySeconds);
  return notif;
}

export function initBackgroundNotifications() {
  // Listen for visibility changes (when user leaves app or puts phone to sleep)
  document.addEventListener('visibilitychange', () => {
    const s = getState();
    if (s.settings && s.settings.notifications === false) return;

    if (document.hidden) {
      // Schedule engaging notification 12 minutes after user leaves
      if (_bgTimeout) clearTimeout(_bgTimeout);
      _bgTimeout = setTimeout(() => {
        triggerRandomEngagementNotification(0);
      }, 12 * 60 * 1000);

      // On Android native, also schedule via the native handler
      try {
        if (window.AndroidNotifications && window.AndroidNotifications.sendNotification) {
          const idx = Math.floor(Math.random() * ENGAGING_NOTIFICATIONS.length);
          const notif = ENGAGING_NOTIFICATIONS[idx];
          window.AndroidNotifications.sendNotification(notif.title, notif.body, 15 * 60);
        }
      } catch {}
    } else {
      if (_bgTimeout) {
        clearTimeout(_bgTimeout);
        _bgTimeout = null;
      }
    }
  });
}
