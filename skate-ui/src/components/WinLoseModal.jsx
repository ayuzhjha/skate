import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, ChevronRight } from 'lucide-react';
import { onOutcomeModal, hideOutcomeModal, playSound, triggerHaptic } from '../store';

export default function WinLoseModal() {
  const [modalData, setModalData] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    return onOutcomeModal((data) => {
      setModalData(data);
    });
  }, []);

  if (!modalData) return null;

  const isWin = modalData.type === 'win';

  const handleClose = () => {
    playSound('chip');
    triggerHaptic(15);
    hideOutcomeModal();
  };

  const handlePlayAgain = () => {
    playSound('chip');
    triggerHaptic(20);
    hideOutcomeModal();
  };

  const handleTurnOffPopup = () => {
    playSound('chip');
    triggerHaptic(20);
    hideOutcomeModal();
    navigate('/settings');
  };

  return (
    <div className="wlm-backdrop" onClick={handleClose}>
      <div 
        className={`wlm-card ${isWin ? 'wlm-win' : 'wlm-lose'}`} 
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Artwork with Embedded Close Button */}
        <div className="wlm-art-wrap">
          <img 
            src={isWin ? '/img/win_art.png' : '/img/lose_art.png'} 
            alt={isWin ? 'You Win' : 'You Lose'} 
            className="wlm-art-img" 
          />
          <button className="wlm-close-btn" onClick={handleClose} aria-label="Close">
            <X size={18} strokeWidth={2.4} />
          </button>
        </div>

        {/* Modal Body & Dynamic Content */}
        <div className="wlm-body">
          {isWin ? (
            <>
              <div className="wlm-payout-pill">
                <div className="wlm-coin-icon">$</div>
                <span className="wlm-payout-text">
                  + {Math.round(modalData.payout || 0).toLocaleString()} SC
                </span>
              </div>
              <p className="wlm-subtext">
                {modalData.subtitle || 'Great play! Keep it up.'}
              </p>
              <button className="wlm-action-btn-primary" onClick={handlePlayAgain}>
                <span>Play Again</span>
                <ChevronRight size={18} strokeWidth={2.5} />
              </button>
              <button className="wlm-action-btn-secondary" onClick={handleTurnOffPopup}>
                Turn Off Popup
              </button>
            </>
          ) : (
            <>
              <h3 className="wlm-heading">
                {modalData.headline || 'Better luck next time!'}
              </h3>
              <p className="wlm-subtext">
                {modalData.subtitle || 'Keep playing to improve your streak.'}
              </p>
              <button className="wlm-action-btn-primary" onClick={handlePlayAgain}>
                <span>Try Again</span>
                <ChevronRight size={18} strokeWidth={2.5} />
              </button>
              <button className="wlm-action-btn-secondary" onClick={handleTurnOffPopup}>
                Turn Off Popup
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
