Inteligentny Kalendarz - local receipt OCR assets
Target engine: Tesseract.js 7.0.0, Apache-2.0
Language: Polish only (pol)
OCR mode: OEM.LSTM_ONLY (1)

FIX1 mandatory runtime inventory:
- tesseract.min.js
- worker.min.js
- core/tesseract-core-lstm.wasm.js
- core/tesseract-core-simd-lstm.wasm.js
- core/tesseract-core-relaxedsimd-lstm.wasm.js
- lang/pol.traineddata.gz

Why only these core files:
Tesseract.js 7.0.0 chooses one of the three LSTM-only *.wasm.js browser
builds when createWorker is called with OEM.LSTM_ONLY and legacyCore is false.
The non-LSTM builds are not selected by this application. Separate *.wasm
files are not referenced by the corePath directory selection used here.

All files must be served from this application origin and precached by the
Service Worker before FIX1 can pass the offline gate. No OCR asset may be
loaded from a CDN at runtime.
