import { useCallback, useEffect, useRef, useState } from 'react'
import type { WindowMode } from '../wasm/bridge'
import { WasmFftBridge } from '../wasm/bridge'

type AnalyzerState = {
  isRunning: boolean
  sampleRate: number
  spectrum: Float32Array
  waveform: Float32Array
  error: string | null
}

const DEFAULT_SAMPLE_RATE = 48_000
const AUDIO_BUFFER_SIZE = 2048

function createWaveformHistory(sampleRate: number, durationMs: number) {
  return new Float32Array(Math.max(1, Math.ceil((sampleRate * durationMs) / 1000)))
}

export function useSpectrumAnalyzer(
  fftSize: number,
  waveformIntervalMs: number,
  windowMode: WindowMode,
  waveformHistoryMs: number,
) {
  const [state, setState] = useState<AnalyzerState>({
    isRunning: false,
    sampleRate: DEFAULT_SAMPLE_RATE,
    spectrum: new Float32Array(fftSize / 2),
    waveform: createWaveformHistory(DEFAULT_SAMPLE_RATE, waveformHistoryMs),
    error: null,
  })

  const audioContextRef = useRef<AudioContext | null>(null)
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)
  const silentGainRef = useRef<GainNode | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const bridgeRef = useRef<WasmFftBridge | null>(null)
  const frameRef = useRef<number | null>(null)
  const waveformTimerRef = useRef(0)
  const waveformHistoryRef = useRef(createWaveformHistory(DEFAULT_SAMPLE_RATE, waveformHistoryMs))
  const waveformWriteIndexRef = useRef(0)
  const waveformSamplesWrittenRef = useRef(0)
  const isStartingRef = useRef(false)
  const isRunningRef = useRef(false)
  const fftSizeRef = useRef(fftSize)
  const waveformIntervalRef = useRef(waveformIntervalMs)
  const waveformHistoryMsRef = useRef(waveformHistoryMs)
  const windowModeRef = useRef(windowMode)

  useEffect(() => {
    fftSizeRef.current = fftSize
  }, [fftSize])

  useEffect(() => {
    waveformIntervalRef.current = waveformIntervalMs
  }, [waveformIntervalMs])

  useEffect(() => {
    waveformHistoryMsRef.current = waveformHistoryMs
  }, [waveformHistoryMs])

  useEffect(() => {
    windowModeRef.current = windowMode
  }, [windowMode])

  const appendWaveformSamples = useCallback((samples: Float32Array) => {
    const history = waveformHistoryRef.current
    if (history.length === 0) {
      return
    }

    let writeIndex = waveformWriteIndexRef.current
    for (let i = 0; i < samples.length; i += 1) {
      history[writeIndex] = samples[i]
      writeIndex = (writeIndex + 1) % history.length
    }

    waveformWriteIndexRef.current = writeIndex
    waveformSamplesWrittenRef.current += samples.length
  }, [])

  const copyLatestSamples = useCallback((sampleCount: number) => {
    const history = waveformHistoryRef.current
    const latestSamples = new Float32Array(sampleCount)
    const availableSamples = Math.min(waveformSamplesWrittenRef.current, history.length, sampleCount)

    if (availableSamples === 0) {
      return latestSamples
    }

    const startIndex =
      (waveformWriteIndexRef.current - availableSamples + history.length) % history.length
    const outputOffset = sampleCount - availableSamples

    for (let i = 0; i < availableSamples; i += 1) {
      latestSamples[outputOffset + i] = history[(startIndex + i) % history.length]
    }

    return latestSamples
  }, [])

  const snapshotWaveformHistory = useCallback(() => {
    return copyLatestSamples(waveformHistoryRef.current.length)
  }, [copyLatestSamples])

  const resetWaveformHistory = useCallback((sampleRate: number) => {
    waveformHistoryRef.current = createWaveformHistory(sampleRate, waveformHistoryMsRef.current)
    waveformWriteIndexRef.current = 0
    waveformSamplesWrittenRef.current = 0
  }, [])

  const stop = useCallback(() => {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current)
      frameRef.current = null
    }

    sourceRef.current?.disconnect()
    processorRef.current?.disconnect()
    silentGainRef.current?.disconnect()
    audioContextRef.current?.close().catch(() => undefined)
    streamRef.current?.getTracks().forEach((track) => track.stop())
    bridgeRef.current?.destroy()

    sourceRef.current = null
    processorRef.current = null
    silentGainRef.current = null
    audioContextRef.current = null
    streamRef.current = null
    bridgeRef.current = null
    isRunningRef.current = false

    setState((current) => ({ ...current, isRunning: false }))
  }, [])

  const drawFrame = useCallback(function renderFrame() {
    const bridge = bridgeRef.current
    const audioContext = audioContextRef.current
    if (!bridge || !audioContext) {
      return
    }

    const spectrumView = bridge.process(copyLatestSamples(fftSizeRef.current), windowModeRef.current)
    const now = performance.now()
    const shouldUpdateWaveform = now - waveformTimerRef.current >= waveformIntervalRef.current

    if (shouldUpdateWaveform) {
      waveformTimerRef.current = now
    }

    setState((current) => ({
      ...current,
      sampleRate: audioContext.sampleRate,
      spectrum: spectrumView,
      waveform: shouldUpdateWaveform ? snapshotWaveformHistory() : current.waveform,
      error: null,
    }))

    frameRef.current = requestAnimationFrame(renderFrame)
  }, [copyLatestSamples, snapshotWaveformHistory])

  const start = useCallback(async () => {
    if (isRunningRef.current) {
      return
    }
    if (isStartingRef.current) {
      return
    }
    isStartingRef.current = true

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      })

      const audioContext = new AudioContext()
      const source = audioContext.createMediaStreamSource(stream)
      const processor = audioContext.createScriptProcessor(AUDIO_BUFFER_SIZE, 1, 1)
      const silentGain = audioContext.createGain()
      silentGain.gain.value = 0
      processor.onaudioprocess = (event) => {
        appendWaveformSamples(event.inputBuffer.getChannelData(0))
        event.outputBuffer.getChannelData(0).fill(0)
      }

      const bridge = await WasmFftBridge.create(fftSize)

      source.connect(processor)
      processor.connect(silentGain)
      silentGain.connect(audioContext.destination)

      streamRef.current = stream
      sourceRef.current = source
      processorRef.current = processor
      silentGainRef.current = silentGain
      audioContextRef.current = audioContext
      bridgeRef.current = bridge
      resetWaveformHistory(audioContext.sampleRate)
      waveformTimerRef.current = 0
      isRunningRef.current = true

      setState((current) => ({
        ...current,
        isRunning: true,
        sampleRate: audioContext.sampleRate,
        spectrum: new Float32Array(fftSize / 2),
        waveform: snapshotWaveformHistory(),
        error: null,
      }))

      frameRef.current = requestAnimationFrame(drawFrame)
    } catch (error) {
      setState((current) => ({
        ...current,
        error: error instanceof Error ? error.message : 'Failed to start audio analyzer',
      }))
      stop()
    } finally {
      isStartingRef.current = false
    }
  }, [appendWaveformSamples, drawFrame, fftSize, resetWaveformHistory, snapshotWaveformHistory, stop])

  useEffect(() => {
    if (!state.isRunning) {
      return
    }

    const bridge = bridgeRef.current
    if (!bridge) {
      return
    }

    bridge.resize(fftSize)

    setState((current) => ({
      ...current,
      spectrum: new Float32Array(fftSize / 2),
    }))
  }, [fftSize, state.isRunning])

  useEffect(() => {
    const sampleRate = audioContextRef.current?.sampleRate ?? state.sampleRate
    resetWaveformHistory(sampleRate)

    setState((current) => ({
      ...current,
      waveform: snapshotWaveformHistory(),
    }))
  }, [resetWaveformHistory, snapshotWaveformHistory, state.sampleRate, waveformHistoryMs])

  useEffect(() => stop, [stop])

  return {
    ...state,
    start,
    stop,
  }
}
