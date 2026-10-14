/* ------------------------------------------------------------------
   VANTA — audio & haptic feedback.
   Synthesised with the Web Audio API so no binary assets are needed.
   Every entry point is a no-op when the corresponding toggle is off,
   or on platforms that do not support vibration.
   ------------------------------------------------------------------ */

export type SoundName = 'tap' | 'chip' | 'deal' | 'win' | 'lose' | 'claim' | 'error'

type Tone = {
  freq: number
  dur: number
  type: OscillatorType
  gain: number
  delay?: number
}

const TONES: Record<SoundName, Tone[]> = {
  tap: [{ freq: 660, dur: 0.05, type: 'sine', gain: 0.05 }],
  chip: [{ freq: 300, dur: 0.04, type: 'square', gain: 0.035 }],
  deal: [{ freq: 200, dur: 0.07, type: 'triangle', gain: 0.05 }],
  win: [
    { freq: 523.25, dur: 0.1, type: 'sine', gain: 0.06 },
    { freq: 659.25, dur: 0.1, type: 'sine', gain: 0.06, delay: 0.09 },
    { freq: 783.99, dur: 0.16, type: 'sine', gain: 0.06, delay: 0.18 },
  ],
  lose: [
    { freq: 311.13, dur: 0.14, type: 'sine', gain: 0.05 },
    { freq: 233.08, dur: 0.22, type: 'sine', gain: 0.05, delay: 0.12 },
  ],
  claim: [
    { freq: 587.33, dur: 0.09, type: 'triangle', gain: 0.06 },
    { freq: 880, dur: 0.16, type: 'triangle', gain: 0.06, delay: 0.08 },
  ],
  error: [{ freq: 150, dur: 0.14, type: 'square', gain: 0.05 }],
}

const HAPTICS: Record<SoundName, number | number[]> = {
  tap: 8,
  chip: 6,
  deal: 10,
  win: [12, 40, 18],
  lose: 22,
  claim: [10, 30, 10, 30, 16],
  error: [18, 40, 18],
}

export type Feedback = {
  play(name: SoundName): void
  /** Toggle sound/haptics at runtime; safe to call on every settings change. */
  setEnabled(sound: boolean, haptics: boolean): void
}

export function createFeedback(): Feedback {
  let sound = true
  let haptics = true
  let ctx: AudioContext | null = null

  const audio = (): AudioContext | null => {
    if (typeof window === 'undefined') return null
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext
    if (!Ctor) return null
    if (!ctx) ctx = new Ctor()
    if (ctx.state === 'suspended') void ctx.resume()
    return ctx
  }

  const tone = (t: Tone, base: number) => {
    const ac = audio()
    if (!ac) return
    const start = ac.currentTime + (t.delay ?? 0)
    const osc = ac.createOscillator()
    const gain = ac.createGain()
    osc.type = t.type
    osc.frequency.setValueAtTime(t.freq, start)
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(t.gain, start + 0.008)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + t.dur)
    osc.connect(gain).connect(ac.destination)
    osc.start(start)
    osc.stop(start + t.dur + 0.02)
    void base
  }

  const vibrate = (pattern: number | number[]) => {
    const nav = navigator as Navigator & { vibrate?: (p: number | number[]) => boolean }
    if (typeof nav.vibrate === 'function') {
      try {
        nav.vibrate(pattern)
      } catch {
        /* unsupported */
      }
    }
  }

  return {
    setEnabled(nextSound, nextHaptics) {
      sound = nextSound
      haptics = nextHaptics
    },
    play(name) {
      if (sound) {
        for (const t of TONES[name]) tone(t, t.freq)
      }
      if (haptics) vibrate(HAPTICS[name])
    },
  }
}
