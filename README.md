# fft-sound-analyzer

ブラウザ上で動作する、ギター向けリアルタイム音声スペクトラムアナライザーです。Web Audio API で取得したマイク入力を Rust + WASM の自前 FFT (Radix-2 DIT) で解析し、周波数スペクトルと時間領域波形を描画します。

## ディレクトリ構成

```text
.
├── crates/
│   └── fft-wasm/                  # Rust/WASM FFT クレート
├── frontend/                      # React + TypeScript + Vite フロントエンド
├── .github/workflows/deploy.yml   # GitHub Pages デプロイ
├── .nvmrc
└── .npmrc
```

## セットアップ

### 前提

- Node.js: `.nvmrc` の `lts/krypton`
- Rust (stable)
- `wasm-pack`

### インストール

```bash
cd fft-sound-analyzer
npm install --prefix frontend
cargo install wasm-pack --locked
```

## 開発

1. WASM を開発モードでビルド

```bash
npm run build:wasm:dev
```

2. フロントエンド起動

```bash
npm --prefix frontend run dev
```

## 本番ビルド

```bash
npm run build
```

`npm run build` は以下を順に実行します。

1. `wasm-pack build crates/fft-wasm --target web --release`
2. `npm --prefix frontend run build`

## 実装ポイント

- Rust 側で Cooley-Tukey Radix-2 DIT FFT を自前実装（外部 FFT クレート不使用）
- Hann/Hamming 窓関数を自前実装
- WASM 側に入力バッファとスペクトラムバッファを保持し、React 側はポインタベースで再利用
- UI 機能:
  - 周波数軸: Linear / Log 切替
  - 振幅軸: Linear / dBFS 切替
  - ギター標準チューニング音名ガイド + 半音階ガイドライン
  - FFT サンプル数可変 (512 / 1024 / 2048 / 4096 / 8192)
  - 時間波形更新頻度の変更 (0.5-60Hz, デフォルト 2Hz)
  - 時間波形の X Range を対数スライダー / 直接入力で変更 (1-5000ms)
