import { useCallback } from "react";
import { useSettingsStore } from "@/stores/orderStore";

/**
 * Module-level audio state — shared across every useAudio() instance.
 * This is what lets `stop()` in OrderAlert kill the oscillator started
 * by `playLoop()` in useWebSocket. Without sharing, each hook has its
 * own refs and the stop is a no-op.
 */
let ctx: AudioContext | null = null;
let osc: OscillatorNode | null = null;
let gain: GainNode | null = null;

function ensureCtx(): AudioContext {
  if (!ctx) {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    ctx = new Ctx();
  }
  return ctx;
}

function killOscillator() {
  try { osc?.stop(); } catch { /* already stopped */ }
  try { osc?.disconnect(); } catch { /* ignore */ }
  try { gain?.disconnect(); } catch { /* ignore */ }
  osc = null;
  gain = null;
}

export function useAudio() {
  const volume = useSettingsStore((s) => s.alertVolume);

  const playLoop = useCallback(() => {
    const audioCtx = ensureCtx();
    // Resume if browser suspended it (autoplay policy).
    if (audioCtx.state === "suspended") audioCtx.resume();

    killOscillator();

    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = "sine";
    o.frequency.value = 880;
    g.gain.value = 0;
    o.connect(g).connect(audioCtx.destination);
    o.start();

    const t0 = audioCtx.currentTime;
    const peak = volume * 0.4;
    for (let i = 0; i < 120; i++) {
      const when = t0 + i * 0.9;
      g.gain.setValueAtTime(0, when);
      g.gain.linearRampToValueAtTime(peak, when + 0.05);
      g.gain.linearRampToValueAtTime(0, when + 0.4);
    }

    osc = o;
    gain = g;
  }, [volume]);

  const stop = useCallback(() => {
    killOscillator();
  }, []);

  return { playLoop, stop };
}
