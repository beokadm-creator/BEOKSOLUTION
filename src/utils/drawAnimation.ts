import { useRef, useState, useCallback, useEffect } from "react";
import confetti from "canvas-confetti";

// ---------------------------------------------------------------------------
// Easing
// ---------------------------------------------------------------------------

export function easeOutQuart(progress: number): number {
  return 1 - Math.pow(1 - progress, 4);
}

// ---------------------------------------------------------------------------
// RouletteWheel
// ---------------------------------------------------------------------------

export class RouletteWheel {
  private currentAngle = 0;
  private targetAngle = 0;
  private spinSpeed = 240;
  private isRunning = false;
  private rafId: number | null = null;
  private onAngleChange: (angle: number) => void;
  private lastTimestamp: number | null = null;

  constructor(onAngleChange: (angle: number) => void) {
    this.onAngleChange = onAngleChange;
  }

  start(): void {
    this.isRunning = true;
    this.lastTimestamp = null;
    this.tick();
  }

  /**
   * Begin deceleration to land on `targetIndex`.
   * Math: easeOutQuart integral over [0,T] = v₀·T·4/5, so T = Δθ·5/(4·v₀).
   */
  stopAt(sliceCount: number, targetIndex: number): void {
    const sliceAngle = 360 / sliceCount;
    const targetSliceCentre = targetIndex * sliceAngle + sliceAngle / 2;
    const targetRemainder = ((360 - targetSliceCentre) % 360 + 360) % 360;
    const currentRemainder = ((this.currentAngle % 360) + 360) % 360;

    let offset = targetRemainder - currentRemainder;
    if (offset < 0) offset += 360;

    this.targetAngle = this.currentAngle + 3 * 360 + offset;
  }

  getAngle(): number {
    return this.currentAngle;
  }

  destroy(): void {
    this.isRunning = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  // -- private -------------------------------------------------------------

  private tick = (): void => {
    if (!this.isRunning) return;

    const now = performance.now();
    if (this.lastTimestamp === null) {
      this.lastTimestamp = now;
    }

    const dt = (now - this.lastTimestamp) / 1000;
    this.lastTimestamp = now;

    if (this.targetAngle > this.currentAngle) {
      const totalDelta = this.targetAngle - this.currentAngle;
      const T = (totalDelta * 5) / (4 * this.spinSpeed);
      this.rafId = requestAnimationFrame(() => this.decelTick(now, T));
      return;
    }

    this.currentAngle += this.spinSpeed * dt;
    this.onAngleChange(this.currentAngle);
    this.rafId = requestAnimationFrame(this.tick);
  };

  private decStartTime: number | null = null;
  private decStartAngle: number | null = null;

  /** Deceleration frame: interpolates angle using easeOutQuart over elapsed time. */
  private decelTick(timestamp: number, duration: number): void {
    if (!this.isRunning) return;

    if (this.decStartTime === null || this.decStartAngle === null) {
      this.decStartTime = timestamp;
      this.decStartAngle = this.currentAngle;
    }

    const elapsed = (timestamp - this.decStartTime) / 1000;
    const progress = Math.min(elapsed / duration, 1);

    const totalDelta = this.targetAngle - this.decStartAngle;
    const easedProgress = easeOutQuart(progress);
    this.currentAngle = this.decStartAngle + totalDelta * easedProgress;
    this.onAngleChange(this.currentAngle);

    if (progress < 1) {
      this.rafId = requestAnimationFrame((t) => this.decelTick(t, duration));
    } else {
      this.currentAngle = this.targetAngle;
      this.onAngleChange(this.currentAngle);
      this.isRunning = false;
      this.decStartTime = null;
      this.decStartAngle = null;
    }
  }
}

// ---------------------------------------------------------------------------
// SoundEngine
// ---------------------------------------------------------------------------

export type SoundType = "drumroll" | "winner" | "tick";

interface SoundDef {
  frequency: number;
  duration: number;
  type: OscillatorType;
  gain: number;
  pitchRamp?: number;
}

const SOUNDS: Record<SoundType, SoundDef> = {
  tick: { frequency: 880, duration: 0.05, type: "sine", gain: 0.04 },
  drumroll: { frequency: 146, duration: 0.32, type: "triangle", gain: 0.06 },
  winner: { frequency: 659, duration: 0.50, type: "sine", gain: 0.08, pitchRamp: 1.35 },
};

export class SoundEngine {
  private audioCtx: AudioContext | null = null;
  private muted = false;

  /** Lazy-init AudioContext. Must be called from a user-gesture handler. */
  private getContext(): AudioContext {
    if (!this.audioCtx) {
      this.audioCtx = new AudioContext();
    }
    if (this.audioCtx.state === "suspended") {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  play(type: SoundType): void {
    if (this.muted) return;

    const ctx = this.getContext();
    const def = SOUNDS[type];
    const now = ctx.currentTime;

    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.type = def.type;
    oscillator.frequency.setValueAtTime(def.frequency, now);

    if (def.pitchRamp) {
      oscillator.frequency.linearRampToValueAtTime(
        def.frequency * def.pitchRamp,
        now + def.duration
      );
    }

    gainNode.gain.setValueAtTime(0.0001, now);
    gainNode.gain.exponentialRampToValueAtTime(def.gain, now + 0.025);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + def.duration);

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.start(now);
    oscillator.stop(now + def.duration + 0.01);
  }

  /** Start a looping drumroll. Returns a stop function. */
  startDrumroll(): () => void {
    if (this.muted) return () => {};

    const ctx = this.getContext();
    const def = SOUNDS.drumroll;
    const loopInterval = def.duration * 1000;
    let active = true;

    const hit = () => {
      if (!active || this.muted) return;

      const now = ctx.currentTime;
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.type = def.type;
      oscillator.frequency.setValueAtTime(def.frequency, now);

      gainNode.gain.setValueAtTime(0.0001, now);
      gainNode.gain.exponentialRampToValueAtTime(def.gain, now + 0.025);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, now + def.duration);

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.start(now);
      oscillator.stop(now + def.duration + 0.01);
    };

    hit();
    const timerId = window.setInterval(hit, loopInterval);

    return () => {
      active = false;
      clearInterval(timerId);
    };
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    return this.muted;
  }

  isMuted(): boolean {
    return this.muted;
  }

  destroy(): void {
    if (this.audioCtx) {
      this.audioCtx.close();
      this.audioCtx = null;
    }
  }
}

// ---------------------------------------------------------------------------
// confettiBurst
// ---------------------------------------------------------------------------

const CONFETTI_COLORS = ["#4f46e5", "#818cf8", "#c7d2fe", "#e0e7ff", "#ffffff"];

export function confettiBurst(durationMs: number = 5000): void {
  const intervalMs = 1100;
  const end = Date.now() + durationMs;

  const frame = () => {
    confetti({
      particleCount: 90,
      spread: 72,
      startVelocity: 58,
      origin: { x: 0.08, y: 0.82 },
      angle: 60,
      colors: CONFETTI_COLORS,
      shapes: ["square", "circle"],
      scalar: 1.1,
      ticks: 220,
    });

    confetti({
      particleCount: 90,
      spread: 72,
      startVelocity: 58,
      origin: { x: 0.92, y: 0.82 },
      angle: 120,
      colors: CONFETTI_COLORS,
      shapes: ["square", "circle"],
      scalar: 1.1,
      ticks: 220,
    });

    confetti({
      particleCount: 140,
      spread: 110,
      startVelocity: 48,
      origin: { x: 0.5, y: 0.3 },
      colors: CONFETTI_COLORS,
      shapes: ["star", "circle"],
      scalar: 1.25,
      ticks: 260,
    });

    if (Date.now() < end) {
      setTimeout(frame, intervalMs);
    }
  };

  frame();
}

// ---------------------------------------------------------------------------
// useDrawSound hook
// ---------------------------------------------------------------------------

export function useDrawSound() {
  const engineRef = useRef<SoundEngine | null>(null);
  const [muted, setMuted] = useState(false);

  const getEngine = useCallback(() => {
    if (!engineRef.current) engineRef.current = new SoundEngine();
    return engineRef.current;
  }, []);

  const toggleMute = useCallback(() => {
    const engine = getEngine();
    const next = engine.toggleMute();
    setMuted(next);
    return next;
  }, [getEngine]);

  useEffect(() => {
    return () => {
      engineRef.current?.destroy();
    };
  }, []);

  return {
    playSound: (type: SoundType) => {
      if (!muted) getEngine().play(type);
    },
    startDrumroll: () => (muted ? () => {} : getEngine().startDrumroll()),
    toggleMute,
    muted,
  };
}
