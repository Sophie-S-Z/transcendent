# Transcendent

Transcendent lets a person finish computer tasks with one signal. The signal is a held blink or a press of any key or switch. The app predicts the next full action, and the user confirms it with one signal.

All processing occurs in the browser. No camera frame and no workspace content leaves the device.

## Run

```sh
npm install
npm run dev
```

## Check

```sh
npm run check   # lint, type check, unit tests
npm run build
```

## Stack

TypeScript, React, Vite, Tailwind CSS, MediaPipe Face Landmarker. The face model is in `public/models`. The MediaPipe WebAssembly files are copied from `node_modules` on install.
