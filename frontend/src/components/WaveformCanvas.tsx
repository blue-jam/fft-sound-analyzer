import { useEffect, useRef } from 'react'
import { drawHorizontalAxisLabels, niceCeilStep, type AxisTick } from './axisUtils'

type Props = {
  waveform: Float32Array
  amplitudeRange: number
  viewSampleCount: number
  viewDurationMs: number
}

const X_AXIS_LABEL_HEIGHT = 26

function formatTimeTick(valueMs: number) {
  if (Math.abs(valueMs) < 0.0001) {
    return '0ms'
  }

  const sign = valueMs < 0 ? '-' : ''
  const absoluteMs = Math.abs(valueMs)

  if (absoluteMs >= 1000) {
    const value = absoluteMs / 1000
    const decimals = value < 10 && !Number.isInteger(value) ? 1 : 0
    return `${sign}${value.toFixed(decimals)}s`
  }

  const decimals = absoluteMs < 10 && !Number.isInteger(absoluteMs) ? 1 : 0
  return `${sign}${absoluteMs.toFixed(decimals)}ms`
}

function createTimeTicks(durationMs: number, width: number): AxisTick[] {
  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    return [{ value: 0, label: formatTimeTick(0) }]
  }

  const targetLabels = Math.min(7, Math.max(3, Math.floor(width / 140) + 1))
  const step = niceCeilStep(durationMs, targetLabels - 1)
  const values = new Set<number>([-durationMs, 0])
  const firstTick = Math.ceil(-durationMs / step) * step

  for (let value = firstTick; value <= 0; value += step) {
    values.add(Number(value.toFixed(6)))
  }

  return Array.from(values)
    .sort((a, b) => a - b)
    .map((value) => ({ value, label: formatTimeTick(value) }))
}

export function WaveformCanvas({ waveform, amplitudeRange, viewSampleCount, viewDurationMs }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || waveform.length === 0) {
      return
    }

    const ctx = canvas.getContext('2d')
    if (!ctx) {
      return
    }

    const width = canvas.width
    const height = canvas.height
    const plotHeight = height - X_AXIS_LABEL_HEIGHT
    const centerY = plotHeight / 2

    ctx.clearRect(0, 0, width, height)
    ctx.fillStyle = '#101725'
    ctx.fillRect(0, 0, width, height)

    ctx.strokeStyle = 'rgba(148, 163, 184, 0.4)'
    ctx.beginPath()
    ctx.moveTo(0, centerY)
    ctx.lineTo(width, centerY)
    ctx.stroke()

    ctx.beginPath()
    ctx.strokeStyle = '#34d399'
    ctx.lineWidth = 1.5

    const visibleAmplitude = Math.max(0.01, amplitudeRange)
    const sampleCount = Math.min(Math.max(1, viewSampleCount), waveform.length)
    const sampleOffset = Math.max(0, waveform.length - sampleCount)

    for (let i = 0; i < sampleCount; i += 1) {
      const x = (i / Math.max(1, sampleCount - 1)) * width
      const sample = waveform[sampleOffset + i]
      const clampedSample = Math.min(visibleAmplitude, Math.max(-visibleAmplitude, sample))
      const y = centerY - (clampedSample / visibleAmplitude) * (centerY - 6)
      if (i === 0) {
        ctx.moveTo(x, y)
      } else {
        ctx.lineTo(x, y)
      }
    }

    ctx.stroke()

    drawHorizontalAxisLabels(
      ctx,
      createTimeTicks(viewDurationMs, width),
      (timeMs) => ((timeMs + viewDurationMs) / Math.max(1, viewDurationMs)) * width,
      width,
      plotHeight + 0.5,
      { color: '#cbd5e1', tickColor: 'rgba(148, 163, 184, 0.55)' },
    )
  }, [amplitudeRange, viewDurationMs, viewSampleCount, waveform])

  return <canvas ref={canvasRef} width={980} height={180} className="plot-canvas" />
}
