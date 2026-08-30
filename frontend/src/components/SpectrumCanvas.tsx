import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { drawHorizontalAxisLabels, niceCeilStep, type AxisTick } from './axisUtils'

const OPEN_STRING_NOTES = [
  { name: 'E2', freq: 82.41 },
  { name: 'A2', freq: 110.0 },
  { name: 'D3', freq: 146.83 },
  { name: 'G3', freq: 196.0 },
  { name: 'B3', freq: 246.94 },
  { name: 'E4', freq: 329.63 },
]

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const X_AXIS_LABEL_HEIGHT = 28

type FrequencyScale = 'linear' | 'log'
type AmplitudeScale = 'linear' | 'dbfs'

type Props = {
  spectrum: Float32Array
  sampleRate: number
  fftSize: number
  frequencyScale: FrequencyScale
  amplitudeScale: AmplitudeScale
}

function midiToPitchName(midi: number) {
  const noteName = NOTE_NAMES[midi % 12]
  const octave = Math.floor(midi / 12) - 1

  return `${noteName}${octave}`
}

function frequencyToNearestPitch(frequency: number) {
  if (!Number.isFinite(frequency) || frequency <= 0) {
    return null
  }

  const midi = Math.round(69 + 12 * Math.log2(frequency / 440))
  const pitchFrequency = 440 * 2 ** ((midi - 69) / 12)

  return {
    name: midiToPitchName(midi),
    frequency: pitchFrequency,
  }
}

function createSemitoneGuides(minFrequency: number, maxFrequency: number) {
  const frequencies: Array<{ name: string; freq: number }> = []

  for (let midi = 21; midi <= 108; midi += 1) {
    const freq = 440 * 2 ** ((midi - 69) / 12)
    if (freq < minFrequency || freq > maxFrequency) {
      continue
    }
    frequencies.push({ name: midiToPitchName(midi), freq })
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

function xToFrequency(x: number, maxFreq: number, width: number, scale: FrequencyScale) {
  const normalized = Math.min(1, Math.max(0, x / width))

  if (scale === 'log') {
    const minFreq = 20
    const logMin = Math.log10(minFreq)
    const logMax = Math.log10(maxFreq)

    return 10 ** (logMin + normalized * (logMax - logMin))
  }

  return normalized * maxFreq
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

function formatFrequencyTick(frequency: number) {
  if (frequency >= 1000) {
    const value = frequency / 1000
    return `${Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1)} kHz`
  }

  return `${Math.round(frequency)} Hz`
}

function formatCursorFrequency(frequency: number) {
  if (frequency >= 1000) {
    const value = frequency / 1000
    return `${value.toFixed(value >= 10 ? 1 : 2)} kHz`
  }

  if (frequency >= 10) {
    return `${frequency.toFixed(1)} Hz`
  }

  return `${frequency.toFixed(2)} Hz`
}

function createLinearFrequencyTicks(maxFrequency: number, width: number) {
  const targetLabels = Math.min(7, Math.max(3, Math.floor(width / 150) + 1))
  const step = niceCeilStep(maxFrequency, targetLabels - 1)
  const values = new Set<number>([0, maxFrequency])

  for (let frequency = step; frequency < maxFrequency; frequency += step) {
    values.add(frequency)
  }

  return Array.from(values)
    .sort((a, b) => a - b)
    .map((value) => ({ value, label: formatFrequencyTick(value) }))
}

function createLogFrequencyTicks(maxFrequency: number) {
  const values = [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000].filter(
    (value) => value <= maxFrequency,
  )

  if (maxFrequency > 20) {
    values.push(maxFrequency)
  }

  return values.map((value) => ({ value, label: formatFrequencyTick(value) }))
}

function createFrequencyTicks(maxFrequency: number, width: number, scale: FrequencyScale): AxisTick[] {
  if (!Number.isFinite(maxFrequency) || maxFrequency <= 0) {
    return []
  }

  return scale === 'log'
    ? createLogFrequencyTicks(maxFrequency)
    : createLinearFrequencyTicks(maxFrequency, width)
}

export function SpectrumCanvas({ spectrum, sampleRate, fftSize, frequencyScale, amplitudeScale }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null)

  const handlePointerMove = useCallback((event: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }

    const rect = canvas.getBoundingClientRect()
    const x = ((event.clientX - rect.left) / rect.width) * canvas.width
    const y = ((event.clientY - rect.top) / rect.height) * canvas.height
    const plotHeight = canvas.height - X_AXIS_LABEL_HEIGHT

    if (x < 0 || x > canvas.width || y < 0 || y > plotHeight) {
      setCursor(null)
      return
    }

    setCursor({
      x: Math.min(canvas.width, Math.max(0, x)),
      y: Math.min(plotHeight, Math.max(0, y)),
    })
  }, [])

  const handlePointerLeave = useCallback(() => {
    setCursor(null)
  }, [])

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
    const plotHeight = height - X_AXIS_LABEL_HEIGHT
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
      ctx.lineTo(x, plotHeight)
      ctx.stroke()
    })

    ctx.strokeStyle = 'rgba(255, 193, 7, 0.65)'
    ctx.fillStyle = 'rgba(255, 221, 120, 0.95)'
    ctx.font = '12px sans-serif'
    OPEN_STRING_NOTES.forEach((note) => {
      const x = frequencyToX(note.freq, maxFrequency, width, frequencyScale)
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, plotHeight)
      ctx.stroke()
      ctx.fillText(note.name, Math.min(width - 32, x + 4), 14)
    })

    ctx.beginPath()
    ctx.lineWidth = 2
    ctx.strokeStyle = '#7dd3fc'

    for (let i = 0; i < spectrum.length; i += 1) {
      const frequency = (i * sampleRate) / fftSize
      const x = frequencyToX(frequency, maxFrequency, width, frequencyScale)
      const y = amplitudeToY(spectrum[i], plotHeight, amplitudeScale)

      if (i === 0) {
        ctx.moveTo(x, y)
      } else {
        ctx.lineTo(x, y)
      }
    }

    ctx.stroke()

    ctx.fillStyle = '#cbd5e1'
    ctx.font = '11px sans-serif'
    ctx.fillText(`Freq: ${frequencyScale.toUpperCase()}`, 8, plotHeight - 26)
    ctx.fillText(`Amp: ${amplitudeScale === 'dbfs' ? 'dBFS' : 'Linear'}`, 8, plotHeight - 10)

    drawHorizontalAxisLabels(
      ctx,
      createFrequencyTicks(maxFrequency, width, frequencyScale),
      (frequency) => frequencyToX(frequency, maxFrequency, width, frequencyScale),
      width,
      plotHeight + 0.5,
    )

    if (cursor) {
      const cursorFrequency = xToFrequency(cursor.x, maxFrequency, width, frequencyScale)
      const nearestPitch = frequencyToNearestPitch(cursorFrequency)
      const labels = [
        `Cursor: ${formatCursorFrequency(cursorFrequency)}`,
        nearestPitch
          ? `Nearest: ${nearestPitch.name} (${formatCursorFrequency(nearestPitch.frequency)})`
          : 'Nearest: --',
      ]
      const labelPaddingX = 8
      const labelPaddingY = 6
      const labelLineHeight = 16

      ctx.save()
      ctx.strokeStyle = 'rgba(52, 211, 153, 0.9)'
      ctx.lineWidth = 1
      ctx.setLineDash([4, 4])
      ctx.beginPath()
      ctx.moveTo(cursor.x + 0.5, 0)
      ctx.lineTo(cursor.x + 0.5, plotHeight)
      ctx.stroke()

      ctx.setLineDash([])
      ctx.font = '12px sans-serif'
      ctx.textBaseline = 'top'

      const textWidth = Math.max(...labels.map((label) => ctx.measureText(label).width))
      const labelWidth = textWidth + labelPaddingX * 2
      const labelHeight = labels.length * labelLineHeight + labelPaddingY * 2
      const labelX = Math.min(width - labelWidth - 6, Math.max(6, cursor.x + 10))
      const labelY = Math.min(plotHeight - labelHeight - 6, Math.max(6, cursor.y + 10))

      ctx.fillStyle = 'rgba(15, 23, 42, 0.94)'
      ctx.strokeStyle = 'rgba(52, 211, 153, 0.8)'
      ctx.fillRect(labelX, labelY, labelWidth, labelHeight)
      ctx.strokeRect(labelX, labelY, labelWidth, labelHeight)

      ctx.fillStyle = '#ecfdf5'
      labels.forEach((label, index) => {
        ctx.fillText(label, labelX + labelPaddingX, labelY + labelPaddingY + index * labelLineHeight)
      })
      ctx.restore()
    }
  }, [amplitudeScale, cursor, fftSize, frequencyScale, sampleRate, spectrum])

  return (
    <canvas
      ref={canvasRef}
      width={980}
      height={320}
      className="plot-canvas spectrum-canvas"
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      onPointerCancel={handlePointerLeave}
    />
  )
}
