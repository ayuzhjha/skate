/* ------------------------------------------------------------------
   VANTA — Help & legal.
   Four reading screens built on one shared layout: How to Play, FAQ,
   Privacy Policy and Terms of Service. All copy is deliberately plain.
   ------------------------------------------------------------------ */

import { useState, type ReactNode } from 'react'
import { Icon } from '../components/Icon'
import { SiteFooter } from '../components/SiteFooter'
import { TopNav } from '../components/TopNav'
import { Panel } from '../components/ui'
import type { RouteName } from '../router'

function LegalLayout({
  active,
  eyebrow,
  title,
  intro,
  children,
  updated,
}: {
  active: RouteName
  eyebrow: string
  title: string
  intro: string
  children: ReactNode
  updated?: string
}) {
  return (
    <>
      <TopNav active={active} />
      <main className="page">
        <div className="shell">
          <div className="grid-12 page__grid">
            <div className="g-1-8">
              <p className="eyebrow">{eyebrow}</p>
              <h1 className="title-lg page__headline">{title}</h1>
            </div>
            <p className="hero__note g-9-12">{intro}</p>

            <Panel className="prose-panel g-span-12" as="article">
              <div className="prose">{children}</div>
              <p className="prose__updated">
                {updated ? `Last updated ${updated}. ` : ''}
                VANTA is a single-player simulation. Virtual credits have no
                monetary value and cannot be redeemed for cash, goods or prizes.
              </p>
            </Panel>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  )
}

/* ---------------- How to Play ---------------- */

const PAYOUTS = [
  { name: 'Blackjack', detail: 'Two-card 21, unsplit', pays: '3 : 2' },
  { name: 'Win', detail: 'Higher total than the dealer', pays: '1 : 1' },
  { name: 'Push', detail: 'Equal totals, or both blackjack', pays: 'Stake returned' },
  { name: 'Loss', detail: 'Lower total, or bust', pays: 'Stake lost' },
  { name: 'Double down', detail: 'One more card, double the stake', pays: '1 : 1 on doubled stake' },
  { name: 'Split', detail: 'Two hands from a pair', pays: 'Per hand' },
]

export function HowToPlay() {
  return (
    <LegalLayout
      active="how-to-play"
      eyebrow="How to Play"
      title="Blackjack, plainly explained."
      intro="A short guide to the rules, the controls and how stakes and payouts work. No money changes hands — only virtual credits."
    >
      <h2>Goal</h2>
      <p>
        Get closer to 21 than the dealer without going over. Going over 21 is a
        <em> bust</em>, and a busted hand always loses.
      </p>

      <h2>Card values</h2>
      <ul>
        <li>Number cards are worth their face value.</li>
        <li>Jack, Queen and King are worth 10.</li>
        <li>
          An Ace is worth 11, or 1 when 11 would bust the hand. A hand containing
          an Ace counted as 11 is called a <em>soft</em> hand.
        </li>
      </ul>

      <h2>The deal</h2>
      <p>
        Each round you place a virtual stake between 10 and 500 VC. You receive
        two cards face up; the dealer receives one face up and one face down. If
        your first two cards total 21 that is a <em>natural blackjack</em> and the
        round ends immediately — unless the dealer also has one, which is a push.
      </p>

      <h2>Your actions</h2>
      <ul>
        <li>
          <b>Hit</b> — take another card. You may take as many as you like until
          you stand, reach 21, or bust.
        </li>
        <li>
          <b>Stand</b> — keep your total and end your turn.
        </li>
        <li>
          <b>Double down</b> — on your first two cards only. Your stake doubles
          and you receive exactly one more card.
        </li>
        <li>
          <b>Split</b> — when your first two cards are a pair, split them into two
          hands, each with its own stake. You can split up to four hands. Split
          Aces receive one card each and cannot be hit again.
        </li>
      </ul>

      <h2>The dealer</h2>
      <p>
        After you finish, the dealer reveals the hole card and draws until
        reaching 17 or more. The dealer <b>stands on all 17s</b>, including soft
        17. If the dealer busts, every hand still in play wins.
      </p>

      <h2>Payouts</h2>
      <div className="pay-table">
        <div className="pay-table__head">
          <span>Result</span>
          <span>When</span>
          <span>Pays</span>
        </div>
        {PAYOUTS.map((p) => (
          <div className="pay-table__row" key={p.name}>
            <span className="pay-table__name">{p.name}</span>
            <span className="pay-table__detail">{p.detail}</span>
            <span className="pay-table__pays num">{p.pays}</span>
          </div>
        ))}
      </div>

      <h2>The shoe</h2>
      <p>
        VANTA plays from a six-deck shoe that is reshuffled once roughly
        three-quarters of the cards have been dealt. There is no insurance bet.
      </p>

      <h2>Credits</h2>
      <p>
        Every stake and payout is in virtual credits. Credits are granted free —
        through your starting balance, daily rewards, streaks, missions and
        achievements. They are never sold and can never be exchanged for money.
      </p>
    </LegalLayout>
  )
}

/* ---------------- FAQ ---------------- */

const FAQS: { q: string; a: string }[] = [
  {
    q: 'Is this real gambling?',
    a: 'No. VANTA is a single-player simulation played entirely with free virtual credits. There is no real-money betting, no deposits, no withdrawals and no prizes of monetary value.',
  },
  {
    q: 'Can I win real money?',
    a: 'No. Virtual credits have no monetary value and cannot be redeemed, cashed out or exchanged for anything. The only thing you build up is your in-app progress.',
  },
  {
    q: 'How do I earn more credits?',
    a: 'Every new guest starts with 2,500 VC. You can claim a daily reward, build a login streak for larger amounts, complete daily missions, unlock achievements, and take a free top-up whenever your balance falls below 100 VC.',
  },
  {
    q: 'What happens if my balance runs out?',
    a: 'A free top-up becomes available automatically when your balance drops below 100 VC. There is a short cooldown between top-ups, so the game stays a game.',
  },
  {
    q: 'Where is my progress stored?',
    a: 'In your browser, on this device only. This prototype has no accounts and no server, so progress does not follow you between devices or browsers. Clearing site data will reset it.',
  },
  {
    q: 'What blackjack rules does the dealer follow?',
    a: 'Six decks, dealer stands on all 17s, blackjack pays 3:2, double down on any first two cards, and split pairs up to four hands. Split Aces get one card each. There is no insurance.',
  },
  {
    q: 'Can I turn off sound or animation?',
    a: 'Yes. Settings has independent controls for sound, haptics, motion (including a reduced-motion mode) and theme, plus notification preferences.',
  },
  {
    q: 'How do I clear my progress?',
    a: 'Profile → Settings → Reset guest progress. You will be asked to confirm, and the action is permanent on this device.',
  },
]

export function Faq() {
  const [open, setOpen] = useState<number | null>(0)
  return (
    <LegalLayout
      active="faq"
      eyebrow="FAQ"
      title="Questions, answered."
      intro="The short version: this is a simulation, credits are free, and nothing can be cashed out."
    >
      <ul className="faq">
        {FAQS.map((item, i) => {
          const isOpen = open === i
          return (
            <li className={`faq__item${isOpen ? ' is-open' : ''}`} key={item.q}>
              <button
                type="button"
                className="faq__q"
                aria-expanded={isOpen}
                onClick={() => setOpen(isOpen ? null : i)}
              >
                <span>{item.q}</span>
                <Icon name="chevron" size={16} />
              </button>
              {isOpen && <p className="faq__a">{item.a}</p>}
            </li>
          )
        })}
      </ul>
    </LegalLayout>
  )
}

/* ---------------- Privacy ---------------- */

export function Privacy() {
  return (
    <LegalLayout
      active="privacy"
      eyebrow="Privacy Policy"
      title="Your data stays on your device."
      intro="This prototype is deliberately simple: there are no accounts, no servers and no tracking."
      updated="14 October 2026"
    >
      <h2>What we store</h2>
      <p>
        VANTA keeps a single record of your game state in your browser's local
        storage: your display name and avatar choice, your virtual credit balance,
        your transaction history, your round history, your rewards and your
        preferences. Nothing else is collected.
      </p>

      <h2>Where it lives</h2>
      <p>
        That record never leaves your device. It is not transmitted to us or to
        any third party, because this prototype has no backend. Clearing your
        browser's site data — or using the reset option in Settings — erases it
        permanently.
      </p>

      <h2>What we don't do</h2>
      <ul>
        <li>No accounts, passwords or email addresses.</li>
        <li>No analytics, advertising or third-party tracking scripts.</li>
        <li>No payment information, because there are no payments.</li>
        <li>No sharing or selling of data, because none is collected.</li>
      </ul>

      <h2>Local storage is not secure storage</h2>
      <p>
        We want to be precise: browser local storage is convenient, but it is not
        tamper-proof or encrypted. Anyone with access to your device can read or
        edit it. It is fine for a simulation with no monetary value; it would not
        be appropriate for anything of real worth. A production version would
        keep balances and outcomes on a trusted server.
      </p>

      <h2>Children</h2>
      <p>
        VANTA is an entertainment simulation with no real-money gambling. It is
        not directed at children and involves no purchases of any kind.
      </p>

      <h2>Contact</h2>
      <p>
        This is a prototype build, so there is no support address yet. When a real
        service launches, a contact route and a data-deletion path will be
        published here.
      </p>
    </LegalLayout>
  )
}

/* ---------------- Terms ---------------- */

export function Terms() {
  return (
    <LegalLayout
      active="terms"
      eyebrow="Terms of Service"
      title="The rules of play."
      intro="By using VANTA you accept the following terms. They are intentionally short."
      updated="14 October 2026"
    >
      <h2>1. What VANTA is</h2>
      <p>
        VANTA is a single-player, casino-style <b>simulation</b> played with free
        virtual credits. It is provided for entertainment and demonstration
        purposes.
      </p>

      <h2>2. Virtual credits</h2>
      <ul>
        <li>Credits are granted free of charge.</li>
        <li>Credits have no monetary value whatsoever.</li>
        <li>
          Credits cannot be deposited, withdrawn, transferred, redeemed or
          exchanged for cash, goods, prizes or anything else of value.
        </li>
        <li>
          Credits are not property and confer no legal or ownership interest. We
          may adjust balances as part of normal operation.
        </li>
      </ul>

      <h2>3. No real-money gambling</h2>
      <p>
        There is no real-money betting on this service. No payment method is
        supported, no deposits are accepted and no winnings are payable. Nothing
        in the app should be understood as an offer of a game of chance for money
        or money's worth.
      </p>

      <h2>4. Fair use</h2>
      <p>
        Do not attempt to disrupt the service, reverse-engineer it for
        commercial gain, or present virtual credits as if they held monetary
        value. Because this is a local prototype, any locally stored progress may
        be reset or lost at any time.
      </p>

      <h2>5. Availability</h2>
      <p>
        The service is offered "as is" without warranties of any kind. Features
        may change or be removed, and progress may reset, without notice.
      </p>

      <h2>6. No liability</h2>
      <p>
        To the fullest extent permitted by law, we accept no liability for any
        loss arising from use of this simulation, which by its nature carries no
        monetary stake.
      </p>

      <h2>7. Responsible play</h2>
      <p>
        Even without money at stake, play is meant to be a pastime. Take breaks,
        and if gaming stops being fun, step away.
      </p>
    </LegalLayout>
  )
}
