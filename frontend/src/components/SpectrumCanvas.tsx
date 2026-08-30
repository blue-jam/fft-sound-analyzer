import { useEffect, useRef } from 'react'

const OPEN_STRING_NOTES = [
  { name: 'E2', freq: 82.41 },
  { name: 'A2', freq: 110.0 },
  { name: 'D3', freq: 146.83 },
  { name: 'G3', freq: 196.0 },
  { name: 'B3', freq: 246.94 },
  { name: 'E4', freq: 329.63 },
]

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

type FrequencyScale = 'linear' | 'log'
type AmplitudeScale = 'linear' | 'dbfs'

type Props = {
  spectrum: Float32Array
  sampleRate: number
  fftSize: number
  frequencyScale: FrequencyScale
  amplitudeScale: AmplitudeScale
}

function createSemitoneGuides(minFrequency: number, maxFrequency: number) {
  const frequencies: Array<{ name: string; freq: number }> = []

  for (let midi = 21; midi <= 108; midi += 1) {
    const freq = 440 * 2 ** ((midi - 69) / 12)
    if (freq < minFrequency || freq > maxFrequency) {
      continue
    }
    const noteName = NOTE_NAMES[midi % 12]
    const octave = Math.floor(midi / 12) - 1
    frequencies.push({ name: `${noteName}${octave}`, freq })
  }

  return frequencies
}

function frequencyToX(freq: number, maxFreq: number, width: number, scale: FrequencyScale) {
  if (scale === 'log') {
    const minFreq = 20
    if (freq <= minFreq) {
      return 0
    }

    const logMin = Math.log10(minFreq)
    const logMax = Math.log10(maxFreq)
    const normalized = (Math.log10(freq) - logMin) / (logMax - logMin)
    return Math.min(width, Math.max(0, normalized * width))
  }

  return (freq / maxFreq) * width
}

function amplitudeToY(value: number, height: number, scale: AmplitudeScale) {
  if (scale === 'dbfs') {
    const db = 20 * Math.log10(Math.max(value, 1e-8))
    const clamped = Math.max(-100, Math.min(0, db))
    const normalized = (clamped + 100) / 100
    return height - normalized * height
  }

  return height - Math.min(1, Math.max(0, value)) * height
}

export function SpectrumCanvas({ spectrum, sampleRate, fftSize, frequencyScale, amplitudeScale }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || spectrum.length === 0) {
      return
    }

    const ctx = canvas.getContext('2d')
    if (!ctx) {
      return
    }

    const width = canvas.width
    const height = canvas.height
    const maxFrequency = sampleRate / 2

    ctx.clearRect(0, 0, width, height)
    ctx.fillStyle = '#06121f'
    ctx.fillRect(0, 0, width, height)

    const semitoneGuides = createSemitoneGuides(20, maxFrequency)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)'
    ctx.lineWidth = 1

    semitoneGuides.forEach((note) => {
      const x = frequencyToX(note.freq, maxFrequency, width, frequencyScale)
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, height)
      ctx.stroke()
    })

    ctx.strokeStyle = 'rgba(255, 193, 7, 0.65)'
    ctx.fillStyle = 'rgba(255, 221, 120, 0.95)'
    ctx.font = '12px sans-serif'
    OPEN_STRING_NOTES.forEach((note) => {
      const x = frequencyToX(note.freq, maxFrequency, width, frequencyScale)
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, height)
      ctx.stroke()
      ctx.fillText(note.name, Math.min(width - 32, x + 4), 14)
    })

    ctx.beginPath()
    ctx.lineWidth = 2
    ctx.strokeStyle = '#7dd3fc'

    for (let i = 0; i < spectrum.length; i += 1) {
      const frequency = (i * sampleRate) / fftSize
      const x = frequencyToX(frequency, maxFrequency, width, frequencyScale)
      const y = amplitudeToY(spectrum[i], height, amplitudeScale)

      if (i === 0) {
        ctx.moveTo(x, y)
      } else {
        ctx.lineTo(x, y)
      }
    }

    ctx.stroke()

    ctx.fillStyle = '#cbd5e1'
    ctx.font = '11px sans-serif'
    ctx.fillText(`Freq: ${frequencyScale.toUpperCase()}`, 8, height - 26)
    ctx.fillText(`Amp: ${amplitudeScale === 'dbfs' ? 'dBFS' : 'Linear'}`, 8, height - 10)
  }, [amplitudeScale, fftSize, frequencyScale, sampleRate, spectrum])

  return <canvas ref={canvasRef} width={980} height={320} className="plot-canvas" />
}
