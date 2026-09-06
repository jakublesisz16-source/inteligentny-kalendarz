# Tesseract.js OCR asset manifest - 1.1.0-dev.3 FIX1

Status: `BLOCKED - MISSING OFFICIAL RUNTIME FILES`

The application uses Tesseract.js 7.0.0 with `OEM.LSTM_ONLY`, `pol`, local
`workerPath`, local directory `corePath`, local `langPath`, `workerBlobURL: false`
and `cacheMethod: none`.

## Mandatory runtime

| File | Source | Version | Purpose | Local SHA-256 |
| --- | --- | --- | --- | --- |
| `tesseract.min.js` | npm `tesseract.js` `dist/` | 7.0.0 | lazy browser UMD entry | MISSING |
| `worker.min.js` | npm `tesseract.js` `dist/` | 7.0.0 | browser OCR worker | MISSING |
| `core/tesseract-core-lstm.wasm.js` | npm `tesseract.js-core` root | 7.0.0 | no-SIMD LSTM fallback | MISSING |
| `core/tesseract-core-simd-lstm.wasm.js` | npm `tesseract.js-core` root | 7.0.0 | SIMD LSTM build | MISSING |
| `core/tesseract-core-relaxedsimd-lstm.wasm.js` | npm `tesseract.js-core` root | 7.0.0 | Relaxed SIMD LSTM build | MISSING |
| `lang/pol.traineddata.gz` | Debian `tesseract-ocr-pol` 1:4.1.0-2 | 4.1.0 data | Polish LSTM language data | `f1360bec1a677942c67b475a044642e8ce00ff815003488cbbf2f0b067c1646e` |

All runtime components are Apache-2.0-compatible according to their upstream
package/repository metadata. Existing `LICENSE-APACHE-2.0.txt` is retained.

The three core Git blob identities recorded in `ASSET_MANIFEST.json` are
upstream provenance hints, not substitutes for local SHA-256. Local SHA-256
must be calculated after the exact official package files are copied into the
project. The manifest `status` must not be changed to `complete` until all six
runtime files are present and their committed SHA-256 values are recorded.

## Why the earlier 15-file gate was corrected

The previous dev.3 candidate required both LSTM and legacy core variants plus
separate `.wasm` files. That was broader than the active runtime path. With
`createWorker('pol', 1, ...)` and no `legacyCore`, Tesseract.js 7 sets the core
to LSTM-only and feature-detects between the no-SIMD, SIMD, and Relaxed SIMD
`*.wasm.js` builds. FIX1 therefore treats those three files as mandatory.
