import { useState, useRef, useEffect } from 'react';
import { useStore } from '../hooks';
import {
  PLINKO_MULTIPLIERS,
  recordTransaction,
  recordGameOutcome,
  nextProvablyFairFloat,
  playSound,
  triggerWinVibration,
  showToast
} from '../store';

export default function PlinkoGame({ stake }) {
  const state = useStore();
  const [risk, setRisk] = useState('high'); // 'low' | 'high'
  const [isDropping, setIsDropping] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const [highlightBucket, setHighlightBucket] = useState(null);

  const canvasRef = useRef(null);
  const ballImgRef = useRef(null);
  const animRef = useRef(null);
  const ripplesRef = useRef([]);

  const multipliers = PLINKO_MULTIPLIERS[risk];

  useEffect(() => {
    const img = new Image();
    img.src = '/ball.png';
    ballImgRef.current = img;
  }, []);

  const drawBoard = (ball = null, activePeg = null) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);

    // Board background with subtle vignette
    const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
    bgGrad.addColorStop(0, 'rgba(26, 29, 33, 0.9)');
    bgGrad.addColorStop(1, 'rgba(18, 20, 24, 0.95)');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    const startY = 32;
    const rowSpacing = 26;
    const pinSpacing = 32;

    // Draw Expanding Ripples from Peg Hits
    ripplesRef.current = ripplesRef.current.filter(r => r.life > 0);
    ripplesRef.current.forEach(r => {
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(46, 204, 113, ${r.life / 20})`;
      ctx.lineWidth = 2;
      ctx.stroke();
      r.radius += 1.2;
      r.life -= 1;
    });

    // Draw Pins
    for (let row = 0; row < 8; row++) {
      const pinCount = row + 3;
      const rowWidth = (pinCount - 1) * pinSpacing;
      const startX = (w - rowWidth) / 2;
      const y = startY + row * rowSpacing;

      for (let p = 0; p < pinCount; p++) {
        const x = startX + p * pinSpacing;
        const isHit = activePeg && Math.hypot(activePeg.x - x, activePeg.y - y) < 8;

        ctx.beginPath();
        ctx.arc(x, y, isHit ? 5.5 : 3.5, 0, Math.PI * 2);
        ctx.fillStyle = isHit ? '#2ecc71' : '#9ca3af';
        if (isHit) {
          ctx.shadowColor = '#2ecc71';
          ctx.shadowBlur = 12;
        } else {
          ctx.shadowColor = 'rgba(255, 255, 255, 0.2)';
          ctx.shadowBlur = 3;
        }
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    }

    // Draw Ball
    if (ball) {
      // Glow behind ball
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, 14, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(46, 204, 113, 0.25)';
      ctx.fill();

      // Ball image
      if (ballImgRef.current && ballImgRef.current.complete && ballImgRef.current.naturalWidth > 0) {
        ctx.save();
        ctx.translate(ball.x, ball.y);
        ctx.rotate(ball.rot || 0);
        ctx.drawImage(ballImgRef.current, -10, -10, 20, 20);
        ctx.restore();
      } else {
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, 8, 0, Math.PI * 2);
        ctx.fillStyle = '#2ecc71';
        ctx.fill();
      }
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.width = 380;
      canvas.height = 250;
      drawBoard();
    }
  }, [risk]);

  const dropBall = () => {
    if (isDropping) return;
    if (state.credits < stake) {
      showToast('Insufficient virtual credits!', 'danger');
      return;
    }

    setIsDropping(true);
    setHighlightBucket(null);

    recordTransaction('bet', `Plinko Drop (${risk.toUpperCase()})`, -stake, `Stake: ${stake} SC`);
    playSound('chip');

    const w = 380;
    const pinSpacing = 32;
    const startY = 32;
    const rowSpacing = 26;

    // Compute seeded path pegs
    let bucketIdx = 0;
    const keyPegs = [{ x: w / 2, y: 12 }];

    for (let r = 0; r < 8; r++) {
      const pinCount = r + 3;
      const rowWidth = (pinCount - 1) * pinSpacing;
      const startX = (w - rowWidth) / 2;
      const goRight = nextProvablyFairFloat() >= 0.5 ? 1 : 0;
      bucketIdx += goRight;

      const pinX = startX + (bucketIdx + 1) * pinSpacing - (pinSpacing / 2);
      const pinY = startY + r * rowSpacing;
      keyPegs.push({ x: pinX, y: pinY });
    }

    // Landing target bucket
    const bucketStartX = (w - (multipliers.length - 1) * pinSpacing) / 2;
    const finalX = bucketStartX + bucketIdx * pinSpacing;
    const finalY = startY + 8 * rowSpacing + 10;
    keyPegs.push({ x: finalX, y: finalY });

    // Build smooth curved animation segments between key pegs
    let curSegment = 0;
    let t = 0;
    let rot = 0;

    function anim() {
      if (curSegment < keyPegs.length - 1) {
        const p0 = keyPegs[curSegment];
        const p1 = keyPegs[curSegment + 1];

        // Lateral parabolic bounce trajectory
        t += 0.085;
        rot += 0.2;

        if (t >= 1) {
          t = 0;
          curSegment += 1;
          playSound('card');

          // Trigger ripple at pin
          ripplesRef.current.push({ x: p1.x, y: p1.y, radius: 4, life: 18 });
        }

        // Interpolate position with slight gravity arc
        const curX = p0.x + (p1.x - p0.x) * t;
        const curY = p0.y + (p1.y - p0.y) * t + Math.sin(t * Math.PI) * 5;

        drawBoard({ x: curX, y: curY, rot }, p1);
        animRef.current = requestAnimationFrame(anim);
      } else {
        // Drop complete
        setIsDropping(false);
        setHighlightBucket(bucketIdx);
        drawBoard(null);

        const mult = multipliers[bucketIdx];
        const payout = Math.round(stake * mult);
        recordGameOutcome('Skate Plinko', stake, payout, `Hit ${mult}× (${risk} risk)`);

        setLastResult({ bucketIdx, mult, payout });
        if (mult >= 2.0) {
          playSound('win');
          triggerWinVibration(mult);
          showToast(`🟣 Plinko ${mult}× Hit! Won ${payout.toLocaleString()} SC`, 'gold');
        }
      }
    }

    animRef.current = requestAnimationFrame(anim);
  };

  useEffect(() => {
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, []);

  return (
    <div className="game-stage active">
      {/* Risk Toggle & Info */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <img src="/ball.png" alt="Plinko" style={{ width: 18, height: 18, objectFit: 'contain' }} />
          <span style={{ fontSize: 13, fontWeight: 700 }}>Risk:</span>
          <button
            className={`btn btn-sm ${risk === 'low' ? 'btn-primary' : 'btn-surface'}`}
            onClick={() => !isDropping && setRisk('low')}
            disabled={isDropping}
          >
            Low
          </button>
          <button
            className={`btn btn-sm ${risk === 'high' ? 'btn-gold' : 'btn-surface'}`}
            onClick={() => !isDropping && setRisk('high')}
            disabled={isDropping}
          >
            High
          </button>
        </div>
        <span className="tag tag-emerald">8 Rows</span>
      </div>

      {/* Canvas */}
      <div style={{
        background: 'var(--bg-elevated)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '10px 0 14px 0',
        marginBottom: 14,
        boxShadow: 'inset 0 0 30px rgba(0,0,0,0.5)'
      }}>
        <canvas ref={canvasRef} style={{ width: '100%', maxWidth: 380, height: 250 }} />

        {/* Multipliers Bucket Row */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${multipliers.length}, 1fr)`,
          gap: 4,
          width: '94%',
          marginTop: -6
        }}>
          {multipliers.map((m, idx) => {
            const isTarget = highlightBucket === idx;
            const isHigh = m >= 4;
            const isMid = m >= 1.2;
            return (
              <div
                key={idx}
                style={{
                  padding: '7px 2px',
                  borderRadius: 6,
                  textAlign: 'center',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10,
                  fontWeight: 800,
                  background: isTarget
                    ? 'var(--emerald)'
                    : isHigh
                    ? 'rgba(212, 168, 67, 0.22)'
                    : isMid
                    ? 'rgba(46, 204, 113, 0.16)'
                    : 'var(--bg-card)',
                  color: isTarget ? '#000000' : isHigh ? 'var(--gold)' : isMid ? 'var(--emerald)' : 'var(--text-secondary)',
                  border: isTarget
                    ? '1.5px solid #ffffff'
                    : isHigh
                    ? '1px solid rgba(212, 168, 67, 0.4)'
                    : '1px solid var(--border)',
                  transform: isTarget ? 'scale(1.15) translateY(-3px)' : 'none',
                  boxShadow: isTarget ? '0 0 12px var(--emerald)' : 'none',
                  transition: 'transform 0.15s ease, background 0.15s ease'
                }}
              >
                {m}×
              </div>
            );
          })}
        </div>
      </div>

      {/* Outcome readout */}
      {lastResult && (
        <div className="card" style={{
          textAlign: 'center', marginBottom: 12, padding: 10,
          background: lastResult.payout >= stake ? 'rgba(46, 204, 113, 0.08)' : 'rgba(231, 76, 60, 0.08)',
          borderColor: lastResult.payout >= stake ? 'var(--emerald)' : 'var(--red)'
        }}>
          <span style={{ fontSize: 13, fontWeight: 700 }}>
            Landed in <b>{lastResult.mult}×</b> →{' '}
            <span style={{
              fontFamily: 'var(--font-mono)', fontWeight: 800,
              color: lastResult.payout >= stake ? 'var(--emerald)' : 'var(--red)'
            }}>
              {lastResult.payout.toLocaleString()} SC
            </span>
          </span>
        </div>
      )}

      {/* Drop Button */}
      <button
        className="btn btn-primary btn-lg"
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
        onClick={dropBall}
        disabled={isDropping}
      >
        <img src="/ball.png" alt="Ball" style={{ width: 20, height: 20, objectFit: 'contain' }} />
        {isDropping ? 'Dropping Ball...' : 'Drop Provably Fair Ball'}
      </button>
    </div>
  );
}
