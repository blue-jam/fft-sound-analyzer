# Frontend

React + TypeScript + Vite フロントエンドです。マイク入力を取得し、Rust/WASM FFT の結果を周波数スペクトルと時間波形として描画します。

## 主要ファイル

- `src/hooks/useSpectrumAnalyzer.ts`: Web Audio API と WASM FFT の連携
- `src/wasm/bridge.ts`: WASM メモリ共有ブリッジ
- `src/components/SpectrumCanvas.tsx`: スペクトル描画（Linear/Log, dBFS, 音階ガイド）
- `src/components/WaveformCanvas.tsx`: 時間領域波形描画

## 開発コマンド

```bash
npm install
npm run lint
npm run dev
npm run build
```
