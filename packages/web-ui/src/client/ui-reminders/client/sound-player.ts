/** Lifecycle-owned, asset-free Web Audio reminder chimes. */

export type ReminderSound = 'attention' | 'completion'

/** Small synthesized player; unsupported/autoplay-blocked browsers fail silently. */
export class ReminderSoundPlayer {
  private context: AudioContext | undefined
  private disposed = false

  /**
   * Unlock Web Audio on the first pointer/keyboard gesture. The returned
   * disposer belongs in the plugin fiber even after the listeners self-remove.
   */
  installUnlock(): () => void {
    if (typeof window === 'undefined') return () => {}
    const remove = (): void => {
      window.removeEventListener('pointerdown', unlock, true)
      window.removeEventListener('keydown', unlock, true)
    }
    const unlock = (): void => {
      const context = this.ensureContext()
      if (context === undefined) return
      void context.resume().then(() => {
        if (context.state === 'running') remove()
      }).catch(() => undefined)
    }
    window.addEventListener('pointerdown', unlock, true)
    window.addEventListener('keydown', unlock, true)
    return remove
  }

  /** Play the distinct attention or completion motif. */
  play(kind: ReminderSound): void {
    const context = this.ensureContext()
    if (context === undefined) return
    void context.resume().then(() => {
      if (!this.disposed) this.schedule(context, kind)
    }).catch(() => undefined)
  }

  /** Stop future playback and release the browser audio device. */
  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    const context = this.context
    this.context = undefined
    if (context !== undefined) void context.close().catch(() => undefined)
  }

  private ensureContext(): AudioContext | undefined {
    if (this.disposed || typeof AudioContext === 'undefined') return undefined
    if (this.context !== undefined) return this.context
    try {
      this.context = new AudioContext()
      return this.context
    } catch {
      return undefined
    }
  }

  private schedule(context: AudioContext, kind: ReminderSound): void {
    const notes = kind === 'completion'
      ? [{ frequency: 523.25, at: 0 }, { frequency: 659.25, at: 0.11 }, { frequency: 783.99, at: 0.22 }]
      : [{ frequency: 740, at: 0 }, { frequency: 554.37, at: 0.16 }]
    const duration = kind === 'completion' ? 0.24 : 0.28
    const start = context.currentTime + 0.01

    for (const note of notes) {
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      const noteStart = start + note.at
      oscillator.type = kind === 'completion' ? 'sine' : 'triangle'
      oscillator.frequency.setValueAtTime(note.frequency, noteStart)
      gain.gain.setValueAtTime(0.0001, noteStart)
      // Keep enough headroom for overlapping notes while remaining clearly
      // audible over normal conversation/system audio.
      gain.gain.exponentialRampToValueAtTime(kind === 'completion' ? 0.36 : 0.30, noteStart + 0.015)
      gain.gain.exponentialRampToValueAtTime(0.0001, noteStart + duration)
      oscillator.connect(gain)
      gain.connect(context.destination)
      oscillator.addEventListener('ended', () => {
        oscillator.disconnect()
        gain.disconnect()
      }, { once: true })
      oscillator.start(noteStart)
      oscillator.stop(noteStart + duration + 0.01)
    }
  }
}
