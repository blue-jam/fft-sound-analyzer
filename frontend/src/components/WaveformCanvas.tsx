import { useEffect, useRef } from 'react'

type Props = {
  waveform: Float32Array
}

export function WaveformCanvas({ waveform }: Props) {
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

    ctx.clearRect(0, 0, width, height)
    ctx.fillStyle = '#101725'
    ctx.fillRect(0, 0, width, height)

    ctx.strokeStyle = 'rgba(148, 163, 184, 0.4)'
    ctx.beginPath()
    ctx.moveTo(0, height / 2)
    ctx.lineTo(width, height / 2)
    ctx.stroke()

    ctx.beginPath()
    ctx.strokeStyle = '#34d399'
    ctx.lineWidth = 1.5

    for (let i = 0; i < waveform.length; i += 1) {
      const x = (i / Math.max(1, waveform.length - 1)) * width
      const y = height / 2 - waveform[i] * (height / 2 - 6)
      if (i === 0) {
        ctx.moveTo(x, y)
      } else {
        ctx.lineTo(x, y)
      }
    }

    ctx.stroke()
  }, [waveform])

  return <canvas ref={canvasRef} width={980} height={180} className="plot-canvas" />
}
