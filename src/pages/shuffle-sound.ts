// Sound and vibration for the Shuffle reel, off unless the user turns them on: a soft click as
// each card passes the frame and a short chime with a buzz when the reel stops. Synthesised with
// Web Audio, so there are no files to load.

const SOUND_KEY = 'mediashelf:shuffle-sound'

export function readSoundSetting(): boolean {
  try {
    return localStorage.getItem(SOUND_KEY) === '1'
  } catch {
    return false
  }
}

export function writeSoundSetting(on: boolean) {
  try {
    if (on) localStorage.setItem(SOUND_KEY, '1')
    else localStorage.removeItem(SOUND_KEY)
  } catch {
    /* ignore */
  }
}

/** Which card sits under the frame for a reel offset: crossings of these make the clicks. */
export function cardUnderFrame(start: number, x: number, step: number) {
  return step > 0 ? Math.floor((start - x) / step + 0.5) : 0
}

type AudioContextClass = typeof AudioContext

let shared: AudioContext | null = null

/** One context for the page, made on the first roll (a click or a key: browsers allow sound then). */
function context(): AudioContext | null {
  if (shared) return shared
  const Ctor: AudioContextClass | undefined =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: AudioContextClass }).webkitAudioContext
  if (!Ctor) return null
  try {
    shared = new Ctor()
  } catch {
    return null
  }
  return shared
}

function blip(ctx: AudioContext, frequency: number, at: number, length: number, volume: number) {
  const oscillator = ctx.createOscillator()
  const gain = ctx.createGain()
  oscillator.type = 'triangle'
  oscillator.frequency.setValueAtTime(frequency, at)
  gain.gain.setValueAtTime(0.0001, at)
  gain.gain.exponentialRampToValueAtTime(volume, at + 0.004)
  gain.gain.exponentialRampToValueAtTime(0.0001, at + length)
  oscillator.connect(gain).connect(ctx.destination)
  oscillator.start(at)
  oscillator.stop(at + length + 0.02)
}

export interface ReelSound {
  /** A card passed the frame. */
  tick(): void
  /** The reel stopped on the winner. */
  land(): void
}

export function createReelSound(): ReelSound | null {
  const ctx = context()
  if (!ctx) return null
  void ctx.resume().catch(() => undefined)
  let last = 0
  return {
    tick() {
      const now = ctx.currentTime
      // Very fast passes blur into a buzz: keep at least 28 ms between clicks.
      if (now - last < 0.028) return
      last = now
      blip(ctx, 1500 + Math.random() * 300, now, 0.03, 0.05)
    },
    land() {
      const now = ctx.currentTime
      blip(ctx, 880, now, 0.5, 0.08)
      blip(ctx, 1320, now + 0.07, 0.6, 0.06)
      navigator.vibrate?.([14, 50, 24])
    },
  }
}
