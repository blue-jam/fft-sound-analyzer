import init, { FftEngine, memory } from './pkg/fft_sound_analyzer_wasm'

export type WindowMode = 'hann' | 'hamming'

let wasmInitPromise: Promise<void> | null = null

async function ensureWasmReady(): Promise<void> {
  if (!wasmInitPromise) {
    wasmInitPromise = init()
  }
  await wasmInitPromise
}

export class WasmFftBridge {
  private engine: FftEngine
  private size: number
  private inputView: Float32Array
  private spectrumView: Float32Array
  private memoryRef: ArrayBuffer

  private constructor(engine: FftEngine, size: number) {
    this.engine = engine
    this.size = size
    this.memoryRef = memory.buffer
    this.inputView = new Float32Array(this.memoryRef, this.engine.input_ptr(), this.size)
    this.spectrumView = new Float32Array(this.memoryRef, this.engine.spectrum_ptr(), this.size / 2)
  }

  static async create(size: number): Promise<WasmFftBridge> {
    await ensureWasmReady()
    return new WasmFftBridge(new FftEngine(size), size)
  }

  get fftSize(): number {
    return this.size
  }

  resize(size: number): void {
    if (size === this.size) {
      return
    }
    this.engine.resize(size)
    this.size = size
    this.refreshViews(true)
  }

  process(samples: Float32Array, mode: WindowMode): Float32Array {
    this.refreshViews(false)

    const writeLength = Math.min(samples.length, this.size)
    this.inputView.set(samples.subarray(0, writeLength), 0)
    if (writeLength < this.size) {
      this.inputView.fill(0, writeLength, this.size)
    }

    this.engine.process(writeLength, mode === 'hamming' ? 1 : 0)
    return this.spectrumView
  }

  destroy(): void {
    this.engine.free()
  }

  private refreshViews(force: boolean): void {
    const currentMemory = memory.buffer
    if (force || this.memoryRef !== currentMemory) {
      this.memoryRef = currentMemory
      this.inputView = new Float32Array(this.memoryRef, this.engine.input_ptr(), this.size)
      this.spectrumView = new Float32Array(this.memoryRef, this.engine.spectrum_ptr(), this.size / 2)
    }
  }
}
