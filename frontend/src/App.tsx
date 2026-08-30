import { useMemo, useState } from 'react'
import { SpectrumCanvas } from './components/SpectrumCanvas'
import { WaveformCanvas } from './components/WaveformCanvas'
import { useSpectrumAnalyzer } from './hooks/useSpectrumAnalyzer'
import type { WindowMode } from './wasm/bridge'
import './App.css'

const FFT_SIZES = [512, 1024, 2048, 4096, 8192]
const WAVEFORM_UPDATE_MIN_HZ = 0.5
const WAVEFORM_UPDATE_MAX_HZ = 60
const WAVEFORM_X_RANGE_MIN_MS = 1
const WAVEFORM_X_RANGE_MAX_MS = 5000
const WAVEFORM_X_RANGE_SLIDER_MAX = 1000
const WAVEFORM_Y_RANGE_MIN = 0.01
const WAVEFORM_Y_RANGE_MAX = 1
const WAVEFORM_Y_RANGE_SLIDER_MAX = 1000

type FrequencyScale = 'linear' | 'log'
type AmplitudeScale = 'linear' | 'dbfs'

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function xRangeMsToSliderValue(value: number) {
  const minLog = Math.log10(WAVEFORM_X_RANGE_MIN_MS)
  const maxLog = Math.log10(WAVEFORM_X_RANGE_MAX_MS)
  const normalized = (Math.log10(value) - minLog) / (maxLog - minLog)

  return Math.round(clampNumber(normalized, 0, 1) * WAVEFORM_X_RANGE_SLIDER_MAX)
}

function sliderValueToXRangeMs(value: number) {
  const minLog = Math.log10(WAVEFORM_X_RANGE_MIN_MS)
  const maxLog = Math.log10(WAVEFORM_X_RANGE_MAX_MS)
  const normalized = clampNumber(value / WAVEFORM_X_RANGE_SLIDER_MAX, 0, 1)

  return Math.round(10 ** (minLog + normalized * (maxLog - minLog)))
}

function yRangeToSliderValue(value: number) {
  const minLog = Math.log10(WAVEFORM_Y_RANGE_MIN)
  const maxLog = Math.log10(WAVEFORM_Y_RANGE_MAX)
  const normalized = (Math.log10(value) - minLog) / (maxLog - minLog)

  return Math.round(clampNumber(normalized, 0, 1) * WAVEFORM_Y_RANGE_SLIDER_MAX)
}

function sliderValueToYRange(value: number) {
  const minLog = Math.log10(WAVEFORM_Y_RANGE_MIN)
  const maxLog = Math.log10(WAVEFORM_Y_RANGE_MAX)
  const normalized = clampNumber(value / WAVEFORM_Y_RANGE_SLIDER_MAX, 0, 1)

  return Number((10 ** (minLog + normalized * (maxLog - minLog))).toFixed(3))
}

function formatDurationMs(value: number) {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(2)} s`
  }

  return `${value.toFixed(value < 10 ? 1 : 0)} ms`
}

function App() {
  const [fftSize, setFftSize] = useState(2048)
  const [frequencyScale, setFrequencyScale] = useState<FrequencyScale>('log')
  const [amplitudeScale, setAmplitudeScale] = useState<AmplitudeScale>('dbfs')
  const [waveformUpdateHz, setWaveformUpdateHz] = useState(2)
  const [windowMode, setWindowMode] = useState<WindowMode>('hann')
  const [waveformAmplitudeRange, setWaveformAmplitudeRange] = useState(1)
  const [waveformXRangeMs, setWaveformXRangeMs] = useState(50)

  const waveformIntervalMs = 1000 / waveformUpdateHz

  const { isRunning, sampleRate, spectrum, waveform, start, stop, error } = useSpectrumAnalyzer(
    fftSize,
    waveformIntervalMs,
    windowMode,
    WAVEFORM_X_RANGE_MAX_MS,
  )

  const statusText = useMemo(() => {
    if (error) {
      return `Error: ${error}`
    }
    return isRunning ? 'Listening...' : 'Stopped'
  }, [error, isRunning])

  const waveformLength = waveform.length
  const waveformView = useMemo(() => {
    const bufferLength = Math.max(1, waveformLength)
    const requestedSampleCount =
      sampleRate > 0 ? Math.round((sampleRate * waveformXRangeMs) / 1000) : 1
    const sampleCount = Math.max(1, Math.min(bufferLength, requestedSampleCount))
    const durationMs = sampleRate > 0 ? (sampleCount / sampleRate) * 1000 : 0

    return {
      durationMs,
      sampleCount,
    }
  }, [sampleRate, waveformLength, waveformXRangeMs])

  const waveformXRangeSliderValue = useMemo(
    () => xRangeMsToSliderValue(waveformXRangeMs),
    [waveformXRangeMs],
  )
  const waveformYRangeSliderValue = useMemo(
    () => yRangeToSliderValue(waveformAmplitudeRange),
    [waveformAmplitudeRange],
  )

  return (
    <main className="app-shell">
      <header>
        <h1>Realtime Guitar Spectrum Analyzer</h1>
        <p>Web Audio + Rust/WASM FFT (Cooley-Tukey Radix-2 DIT)</p>
      </header>

      <section className="controls">
        <label>
          FFT Samples
          <select value={fftSize} onChange={(event) => setFftSize(Number(event.target.value))}>
            {FFT_SIZES.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>

        <label>
          Frequency Axis
          <select
            value={frequencyScale}
            onChange={(event) => setFrequencyScale(event.target.value as FrequencyScale)}
          >
            <option value="linear">Linear</option>
            <option value="log">Log</option>
          </select>
        </label>

        <label>
          Amplitude Axis
          <select
            value={amplitudeScale}
            onChange={(event) => setAmplitudeScale(event.target.value as AmplitudeScale)}
          >
            <option value="linear">Linear</option>
            <option value="dbfs">dBFS</option>
          </select>
        </label>

        <label>
          Window
          <select
            value={windowMode}
            onChange={(event) => setWindowMode(event.target.value as WindowMode)}
          >
            <option value="hann">Hann</option>
            <option value="hamming">Hamming</option>
          </select>
        </label>

        <label>
          Waveform Rate (Hz)
          <div className="range-with-number">
            <input
              type="range"
              min={WAVEFORM_UPDATE_MIN_HZ}
              max={WAVEFORM_UPDATE_MAX_HZ}
              step="0.5"
              value={waveformUpdateHz}
              onChange={(event) => setWaveformUpdateHz(Number(event.target.value))}
            />
            <input
              type="number"
              min={WAVEFORM_UPDATE_MIN_HZ}
              max={WAVEFORM_UPDATE_MAX_HZ}
              step="0.5"
              value={waveformUpdateHz}
              onChange={(event) => {
                const value = Number(event.target.value)
                if (!Number.isNaN(value)) {
                  setWaveformUpdateHz(
                    clampNumber(value, WAVEFORM_UPDATE_MIN_HZ, WAVEFORM_UPDATE_MAX_HZ),
                  )
                }
              }}
            />
          </div>
        </label>

        <div className="button-row">
          <button type="button" onClick={start} disabled={isRunning}>
            Start Mic
          </button>
          <button type="button" onClick={stop} disabled={!isRunning}>
            Stop
          </button>
        </div>
      </section>

      <section className="status-row">
        <strong>Status:</strong> <span>{statusText}</span>
        <span>Sample Rate: {Math.round(sampleRate)} Hz</span>
      </section>

      <section className="plot-block">
        <h2>Frequency Spectrum</h2>
        <SpectrumCanvas
          spectrum={spectrum}
          sampleRate={sampleRate}
          fftSize={fftSize}
          frequencyScale={frequencyScale}
          amplitudeScale={amplitudeScale}
        />
      </section>

      <section className="plot-block">
        <div className="plot-heading">
          <h2>Time Domain Waveform</h2>
          <span>
            X Range: {formatDurationMs(waveformView.durationMs)} / Update:{' '}
            {waveformUpdateHz.toFixed(1)} Hz / Y Range:{' '}
            +/-{waveformAmplitudeRange.toFixed(2)}
          </span>
        </div>
        <div className="waveform-range-controls">
          <label>
            X Range (ms)
            <div className="range-with-number">
              <input
                type="range"
                min="0"
                max={WAVEFORM_X_RANGE_SLIDER_MAX}
                step="1"
                value={waveformXRangeSliderValue}
                onChange={(event) => {
                  setWaveformXRangeMs(sliderValueToXRangeMs(Number(event.target.value)))
                }}
              />
              <input
                type="number"
                min={WAVEFORM_X_RANGE_MIN_MS}
                max={WAVEFORM_X_RANGE_MAX_MS}
                step="1"
                value={waveformXRangeMs}
                onChange={(event) => {
                  const value = Number(event.target.value)
                  if (!Number.isNaN(value)) {
                    setWaveformXRangeMs(
                      clampNumber(value, WAVEFORM_X_RANGE_MIN_MS, WAVEFORM_X_RANGE_MAX_MS),
                    )
                  }
                }}
              />
            </div>
          </label>
          <label>
            Y Range
            <div className="range-with-number">
              <input
                type="range"
                min="0"
                max={WAVEFORM_Y_RANGE_SLIDER_MAX}
                step="1"
                value={waveformYRangeSliderValue}
                onChange={(event) => {
                  setWaveformAmplitudeRange(sliderValueToYRange(Number(event.target.value)))
                }}
              />
              <input
                type="number"
                min={WAVEFORM_Y_RANGE_MIN}
                max={WAVEFORM_Y_RANGE_MAX}
                step="0.01"
                value={waveformAmplitudeRange}
                onChange={(event) => {
                  const value = Number(event.target.value)
                  if (!Number.isNaN(value)) {
                    setWaveformAmplitudeRange(
                      clampNumber(value, WAVEFORM_Y_RANGE_MIN, WAVEFORM_Y_RANGE_MAX),
                    )
                  }
                }}
              />
            </div>
          </label>
        </div>
        <WaveformCanvas
          waveform={waveform}
          amplitudeRange={waveformAmplitudeRange}
          viewSampleCount={waveformView.sampleCount}
          viewDurationMs={waveformView.durationMs}
        />
      </section>
    </main>
  )
}

export default App
