/**
 * Web Audio API synthesized completion chime
 * Plays a pleasant ascending two-tone 'ting-ting' chime without requiring any external audio files.
 */
export function playCompletionChime() {
  if (typeof window === 'undefined') return

  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext
    if (!AudioContextClass) return

    const ctx = new AudioContextClass()
    if (ctx.state === 'suspended' && ctx.resume) {
      ctx.resume()
    }

    const now = ctx.currentTime
    const notes = [
      { freq: 880, start: 0, duration: 0.22 },     // A5
      { freq: 1318.5, start: 0.12, duration: 0.35 } // E6
    ]

    notes.forEach(({ freq, start, duration }) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()

      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, now + start)

      gain.gain.setValueAtTime(0.0001, now + start)
      gain.gain.exponentialRampToValueAtTime(0.18, now + start + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + start + duration)

      osc.connect(gain)
      gain.connect(ctx.destination)

      osc.start(now + start)
      osc.stop(now + start + duration + 0.02)
    })

    setTimeout(() => {
      try {
        ctx.close()
      } catch (e) {
        // ignore close errors
      }
    }, 1000)
  } catch (err) {
    // Graceful fallback if browser audio policy prevents autoplay
    console.debug('Audio chime muted or blocked:', err)
  }
}
