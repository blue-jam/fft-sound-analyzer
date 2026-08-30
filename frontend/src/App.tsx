import { useMemo, useState } from 'react'
import { SpectrumCanvas } from './components/SpectrumCanvas'
import { WaveformCanvas } from './components/WaveformCanvas'
import { useSpectrumAnalyzer } from './hooks/useSpectrumAnalyzer'
import type { WindowMode } from './wasm/bridge'
import './App.css'

const FFT_SIZES = [512, 1024, 2048, 4096, 8192]
const WAVEFORM_INTERVALS = [100, 250, 500, 1000, 2000]

type FrequencyScale = 'linear' | 'log'
type AmplitudeScale = 'linear' | 'dbfs'

function App() {
  const [fftSize, setFftSize] = useState(2048)
  const [frequencyScale, setFrequencyScale] = useState<FrequencyScale>('log')
  const [amplitudeScale, setAmplitudeScale] = useState<AmplitudeScale>('dbfs')
  const [waveformIntervalMs, setWaveformIntervalMs] = useState(500)
  const [windowMode, setWindowMode] = useState<WindowMode>('hann')

  const { isRunning, sampleRate, spectrum, waveform, start, stop, error } = useSpectrumAnalyzer(
    fftSize,
    waveformIntervalMs,
    windowMode,
  )

  const statusText = useMemo(() => {
    if (error) {
      return `Error: ${error}`
    }
    return isRunning ? 'Listening...' : 'Stopped'
  }, [error, isRunning])

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
          Waveform Update (ms)
          <select
            value={waveformIntervalMs}
            onChange={(event) => setWaveformIntervalMs(Number(event.target.value))}
          >
            {WAVEFORM_INTERVALS.map((value) => (
              <option key={value} value={value}>
                {value} ms
              </option>
            ))}
          </select>
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
        <h2>Time Domain Waveform</h2>
        <WaveformCanvas waveform={waveform} />
      </section>
    </main>
  )
}

export default App
