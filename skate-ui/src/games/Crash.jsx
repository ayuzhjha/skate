import { useState, useRef, useEffect } from 'react';
import { useStore } from '../hooks';
import {
  recordTransaction,
  recordGameOutcome,
  nextProvablyFairFloat,
  playSound,
  triggerHaptic,
  triggerWinVibration,
  showToast
} from '../store';

export default function CrashGame({ stake }) {
  const state = useStore();
  const [running, setRunning] = useState(false);
  const [crashed, setCrashed] = useState(false);
  const [cashedOut, setCashedOut] = useState(false);
  const [currentMult, setCurrentMult] = useState(1.0);
  const [crashPoint, setCrashPoint] = useState(2.0);
  const [subText, setSubText] = useState('Tap Launch Flight to take off');
  const [lastWinAmt, setLastWinAmt] = useState(0);

  const canvasRef = useRef(null);
  const flightImgRef = useRef(null);
  const particlesRef = useRef([]);
  const explosionRef = useRef([]);
  const rafRef = useRef(null);
  const stateRef = useRef({ running: false, cashedOut: false, stake, currentMult: 1.0, crashPoint: 2.0 });

  useEffect(() => {
    const img = new Image();
    img.src = '/flight.png';
    flightImgRef.current = img;
  }, []);

  const drawCanvas = (mult, isCrashed) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);

    // Deep space gradient
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#13161a');
    bg.addColorStop(1, '#1b1f24');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // Altitude lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = 1;
    for (let y = 30; y < h; y += 42) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    const progress = Math.min(1, (mult - 1) / 5.5);
    const startX = 24;
    const startY = h - 25;
    const endX = startX + progress * (w - 70);
    const endY = startY - Math.pow(progress, 1.25) * (h - 65);

    // Rocket / Flight curve
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.quadraticCurveTo(startX + (endX - startX) * 0.45, startY, endX, endY);
    ctx.strokeStyle = isCrashed ? '#e74c3c' : '#2ecc71';
    ctx.lineWidth = 3.5;
    ctx.stroke();

    // Curve neon glow
    ctx.strokeStyle = isCrashed ? 'rgba(231, 76, 60, 0.25)' : 'rgba(46, 204, 113, 0.25)';
    ctx.lineWidth = 9;
    ctx.stroke();

    // Thruster flame particles
    if (stateRef.current.running && !isCrashed) {
      particlesRef.current.push({
        x: endX - 8,
        y: endY + 4,
        vx: -Math.random() * 2 - 1,
        vy: Math.random() * 2 - 0.5,
        radius: Math.random() * 3.5 + 1.5,
        color: ['#f39c12', '#e67e22', '#2ecc71', '#f1c40f'][Math.floor(Math.random() * 4)],
        life: 16
      });
    }

    // Render Thruster Particles
    particlesRef.current = particlesRef.current.filter(p => p.life > 0);
    particlesRef.current.forEach(p => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.life / 16;
      ctx.fill();
      ctx.globalAlpha = 1;
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 1;
    });

    // Explosion Particles on Crash
    if (isCrashed) {
      explosionRef.current.forEach(ep => {
        ctx.beginPath();
        ctx.arc(ep.x, ep.y, ep.radius, 0, Math.PI * 2);
        ctx.fillStyle = ep.color;
        ctx.globalAlpha = Math.max(0, ep.life / 30);
        ctx.fill();
        ctx.globalAlpha = 1;
        ep.x += ep.vx;
        ep.y += ep.vy;
        ep.life -= 1;
      });
    }

    // Tangent angle calculation for flight orientation
    const dx = w - 70;
    const dy = -1.25 * Math.pow(Math.max(0.01, progress), 0.25) * (h - 65);
    const angle = Math.atan2(dy, dx);

    // Draw flight.png or explosion
    if (isCrashed) {
      ctx.font = '28px sans-serif';
      ctx.fillText('💥', endX - 14, endY + 8);
    } else if (flightImgRef.current && flightImgRef.current.complete && flightImgRef.current.naturalWidth > 0) {
      ctx.save();
      ctx.translate(endX, endY);
      ctx.rotate(angle);
      ctx.drawImage(flightImgRef.current, -16, -16, 32, 32);
      ctx.restore();
    } else {
      ctx.font = '24px sans-serif';
      ctx.fillText('🚀', endX - 12, endY - 6);
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.width = 380;
      canvas.height = 200;
      drawCanvas(1.0, false);
    }
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const startFlight = () => {
    if (running) return;
    if (state.credits < stake) {
      showToast('Insufficient virtual credits!', 'danger');
      return;
    }

    const r = nextProvablyFairFloat();
    const cp = Math.max(1.04, +(0.98 / (1.0 - r * 0.94)).toFixed(2));

    setRunning(true);
    setCrashed(false);
    setCashedOut(false);
    setCurrentMult(1.0);
    setCrashPoint(cp);
    setSubText('Tap Bail Out & Cash before wipeout!');
    setLastWinAmt(0);
    particlesRef.current = [];
    explosionRef.current = [];

    stateRef.current = {
      running: true,
      cashedOut: false,
      stake,
      currentMult: 1.0,
      crashPoint: cp,
    };

    recordTransaction('bet', 'Ollie Crash Launch', -stake, `Stake: ${stake} SC`);
    playSound('chip');

    const startTime = performance.now();

    function tick(now) {
      if (!stateRef.current.running) return;
      const elapsedSec = (now - startTime) / 1000;
      const mult = +(1.0 + Math.pow(elapsedSec, 1.45) * 0.65).toFixed(2);
      stateRef.current.currentMult = mult;
      setCurrentMult(mult);

      if (mult >= stateRef.current.crashPoint) {
        // WIPEOUT!
        stateRef.current.running = false;
        setRunning(false);
        setCrashed(true);
        setCurrentMult(stateRef.current.crashPoint);
        setSubText(`WIPED OUT @ ${stateRef.current.crashPoint.toFixed(2)}×!`);

        // Generate explosion particles
        const canvas = canvasRef.current;
        if (canvas) {
          const w = canvas.width, h = canvas.height;
          const progress = Math.min(1, (stateRef.current.crashPoint - 1) / 5.5);
          const endX = 24 + progress * (w - 70);
          const endY = h - 25 - Math.pow(progress, 1.25) * (h - 65);
          explosionRef.current = Array.from({ length: 30 }, () => ({
            x: endX,
            y: endY,
            vx: (Math.random() - 0.5) * 7,
            vy: (Math.random() - 0.5) * 7,
            radius: Math.random() * 4 + 2,
            color: ['#e74c3c', '#f39c12', '#ffffff'][Math.floor(Math.random() * 3)],
            life: 30
          }));
        }

        drawCanvas(stateRef.current.crashPoint, true);

        if (!stateRef.current.cashedOut) {
          playSound('loss');
          triggerHaptic([40, 60]);
          recordGameOutcome('Ollie Crash', stateRef.current.stake, 0, `Wiped out @ ${stateRef.current.crashPoint.toFixed(2)}×`);
        }
        return;
      }

      drawCanvas(mult, false);
      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);
  };

  const cashOut = () => {
    if (!stateRef.current.running || stateRef.current.cashedOut) return;

    stateRef.current.cashedOut = true;
    setCashedOut(true);

    const lockedMult = stateRef.current.currentMult;
    const payout = Math.round(stateRef.current.stake * lockedMult);
    setLastWinAmt(payout);
    setSubText(`Bailed Out @ ${lockedMult.toFixed(2)}×! (+${payout.toLocaleString()} SC)`);

    recordGameOutcome('Ollie Crash', stateRef.current.stake, payout, `Bailed out @ ${lockedMult.toFixed(2)}×`, true);
    playSound('win');
    triggerWinVibration(lockedMult);
    showToast(`🚀 Bailed out @ ${lockedMult.toFixed(2)}×! Won ${payout.toLocaleString()} SC`, 'gold');
  };

  const currentPayout = Math.round(stake * currentMult);
  const isFinished = !running && (crashed || cashedOut);

  return (
    <div className="game-stage active">
      {/* Header status */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <img src="/flight.png" alt="Flight" style={{ width: 18, height: 18, objectFit: 'contain' }} />
          <span style={{ fontSize: 13, fontWeight: 700 }}>Ollie Flight</span>
          <span className={`tag ${crashed ? 'tag-danger' : running ? 'tag-emerald' : 'tag-gold'}`}>
            {crashed ? 'Crashed' : running ? 'In Flight' : 'Ready'}
          </span>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
          Crash Curve: Max 25×
        </div>
      </div>

      {/* Canvas Viewport */}
      <div style={{
        background: 'var(--bg-elevated)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border)',
        overflow: 'hidden',
        position: 'relative',
        marginBottom: 16,
        boxShadow: 'inset 0 0 35px rgba(0,0,0,0.6)'
      }}>
        <canvas ref={canvasRef} style={{ width: '100%', height: 200, display: 'block' }} />

        {/* Live Multiplier Overlay */}
        <div style={{
          position: 'absolute',
          top: 14,
          left: 18,
          pointerEvents: 'none'
        }}>
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 42,
            fontWeight: 900,
            lineHeight: 1,
            color: crashed ? 'var(--red)' : cashedOut ? 'var(--gold)' : '#ffffff',
            textShadow: '0 2px 14px rgba(0,0,0,0.7)'
          }}>
            {currentMult.toFixed(2)}×
          </div>
          <div style={{
            fontSize: 12,
            fontWeight: 700,
            color: crashed ? 'var(--red)' : cashedOut ? 'var(--gold)' : 'var(--text-secondary)',
            marginTop: 4
          }}>
            {subText}
          </div>
        </div>
      </div>

      {/* Action Controls */}
      <div>
        {running ? (
          <button
            className="btn btn-gold btn-lg"
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
            onClick={cashOut}
            disabled={cashedOut}
          >
            {cashedOut ? (
              <>✅ Locked In! (+{lastWinAmt.toLocaleString()} SC)</>
            ) : (
              <>
                <img src="/coin.png" alt="SC" style={{ width: 18, height: 18, objectFit: 'contain' }} />
                <span>Bail Out & Cash {currentPayout.toLocaleString()} SC ({currentMult.toFixed(2)}×)</span>
              </>
            )}
          </button>
        ) : isFinished ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 10 }}>
            <button
              className="btn btn-primary btn-lg"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
              onClick={startFlight}
            >
              <img src="/flight.png" alt="Play Again" style={{ width: 20, height: 20, objectFit: 'contain' }} />
              <span>Play Again ({stake} SC)</span>
            </button>
            <div style={{
              background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '6px 10px'
            }}>
              <span style={{ fontSize: 10, color: 'var(--text-dim)', fontWeight: 600 }}>Last Crash</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 800, color: crashed ? 'var(--red)' : 'var(--gold)' }}>
                {crashPoint.toFixed(2)}×
              </span>
            </div>
          </div>
        ) : (
          <button
            className="btn btn-primary btn-lg"
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
            onClick={startFlight}
          >
            <img src="/flight.png" alt="Launch" style={{ width: 20, height: 20, objectFit: 'contain' }} />
            <span>Launch Flight ({stake} SC)</span>
          </button>
        )}
      </div>
    </div>
  );
}
