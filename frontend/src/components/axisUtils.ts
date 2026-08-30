export type AxisTick = {
  value: number
  label: string
}

type HorizontalAxisOptions = {
  color?: string
  font?: string
  minLabelGap?: number
  tickColor?: string
  tickLength?: number
}

const AXIS_EDGE_PADDING = 6

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

export function niceCeilStep(range: number, targetIntervals: number) {
  if (!Number.isFinite(range) || range <= 0) {
    return 1
  }

  const roughStep = range / Math.max(1, targetIntervals)
  const magnitude = 10 ** Math.floor(Math.log10(roughStep))

  for (const multiplier of [1, 2, 5, 10]) {
    const step = multiplier * magnitude
    if (roughStep <= step) {
      return step
    }
  }

  return 10 * magnitude
}

export function drawHorizontalAxisLabels(
  ctx: CanvasRenderingContext2D,
  ticks: AxisTick[],
  valueToX: (value: number) => number,
  width: number,
  axisY: number,
  options: HorizontalAxisOptions = {},
) {
  const {
    color = '#cbd5e1',
    font = '11px sans-serif',
    minLabelGap = 12,
    tickColor = 'rgba(203, 213, 225, 0.5)',
    tickLength = 5,
  } = options

  ctx.save()
  ctx.strokeStyle = tickColor
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(0, axisY)
  ctx.lineTo(width, axisY)
  ticks.forEach((tick) => {
    const x = valueToX(tick.value)
    if (!Number.isFinite(x) || x < 0 || x > width) {
      return
    }
    ctx.moveTo(x, axisY)
    ctx.lineTo(x, axisY + tickLength)
  })
  ctx.stroke()

  ctx.fillStyle = color
  ctx.font = font
  ctx.textBaseline = 'top'

  let lastRight = -Infinity
  ticks
    .map((tick) => ({ ...tick, x: valueToX(tick.value) }))
    .filter((tick) => Number.isFinite(tick.x) && tick.x >= 0 && tick.x <= width)
    .sort((a, b) => a.x - b.x)
    .forEach((tick) => {
      const textWidth = ctx.measureText(tick.label).width
      const labelLeft = clamp(
        tick.x - textWidth / 2,
        AXIS_EDGE_PADDING,
        width - textWidth - AXIS_EDGE_PADDING,
      )
      const labelRight = labelLeft + textWidth

      if (labelLeft < lastRight + minLabelGap) {
        return
      }

      ctx.fillText(tick.label, labelLeft, axisY + tickLength + 3)
      lastRight = labelRight
    })

  ctx.restore()
}
