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

export function useSpectrumAnalyzer(fftSize: number, waveformIntervalMs: number, windowMode: WindowMode) {
  const [state, setState] = useState<AnalyzerState>({
    isRunning: false,
    sampleRate: 48_000,
    spectrum: new Float32Array(fftSize / 2),
    waveform: new Float32Array(fftSize),
    error: null,
  })

  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const bridgeRef = useRef<WasmFftBridge | null>(null)
  const frameRef = useRef<number | null>(null)
  const waveformTimerRef = useRef(0)

  const stop = useCallback(() => {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current)
      frameRef.current = null
    }

    sourceRef.current?.disconnect()
    analyserRef.current?.disconnect()
    audioContextRef.current?.close().catch(() => undefined)
    streamRef.current?.getTracks().forEach((track) => track.stop())
    bridgeRef.current?.destroy()

    sourceRef.current = null
    analyserRef.current = null
    audioContextRef.current = null
    streamRef.current = null
    bridgeRef.current = null

    setState((current) => ({ ...current, isRunning: false }))
  }, [])

  const drawFrame = useCallback(() => {
    const analyser = analyserRef.current
    const bridge = bridgeRef.current
    const audioContext = audioContextRef.current
    if (!analyser || !bridge || !audioContext) {
      return
    }

    const timeData = new Float32Array(fftSize)
    analyser.getFloatTimeDomainData(timeData)

    const spectrumView = bridge.process(timeData, windowMode)
    const now = performance.now()
    const shouldUpdateWaveform = now - waveformTimerRef.current >= waveformIntervalMs

    if (shouldUpdateWaveform) {
      waveformTimerRef.current = now
    }

    setState((current) => ({
      ...current,
      sampleRate: audioContext.sampleRate,
      spectrum: new Float32Array(spectrumView),
      waveform: shouldUpdateWaveform ? timeData : current.waveform,
      error: null,
    }))

    frameRef.current = requestAnimationFrame(drawFrame)
  }, [fftSize, waveformIntervalMs, windowMode])

  const start = useCallback(async () => {
    if (state.isRunning) {
      return
    }

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
      const analyser = audioContext.createAnalyser()
      analyser.fftSize = fftSize
      analyser.smoothingTimeConstant = 0.2

      const bridge = await WasmFftBridge.create(fftSize)

      source.connect(analyser)

      streamRef.current = stream
      sourceRef.current = source
      analyserRef.current = analyser
      audioContextRef.current = audioContext
      bridgeRef.current = bridge
      waveformTimerRef.current = 0

      setState((current) => ({
        ...current,
        isRunning: true,
        sampleRate: audioContext.sampleRate,
        spectrum: new Float32Array(fftSize / 2),
        waveform: new Float32Array(fftSize),
        error: null,
      }))

      frameRef.current = requestAnimationFrame(drawFrame)
    } catch (error) {
      setState((current) => ({
        ...current,
        error: error instanceof Error ? error.message : 'Failed to start audio analyzer',
      }))
      stop()
    }
  }, [drawFrame, fftSize, state.isRunning, stop])

  useEffect(() => {
    if (!state.isRunning) {
      return
    }

    const analyser = analyserRef.current
    const bridge = bridgeRef.current
    if (!analyser || !bridge) {
      return
    }

    analyser.fftSize = fftSize
    bridge.resize(fftSize)

    setState((current) => ({
      ...current,
      spectrum: new Float32Array(fftSize / 2),
      waveform: new Float32Array(fftSize),
    }))
  }, [fftSize, state.isRunning])

  useEffect(() => stop, [stop])

  return {
    ...state,
    start,
    stop,
  }
}
