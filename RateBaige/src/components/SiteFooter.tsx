export function SiteFooter() {
  return (
    <footer className="footer">
      <div className="shell footer__inner">
        <p className="footer__note">
          VANTA is a single-player simulation played with virtual credits.
          Virtual credits have no monetary value and cannot be redeemed for
          cash, goods or prizes.
        </p>
        <nav className="footer__links" aria-label="Legal">
          <a href="#/how-to-play">Responsible play</a>
          <a href="#/terms">Terms</a>
          <a href="#/privacy">Privacy</a>
        </nav>
      </div>
    </footer>
  )
}
