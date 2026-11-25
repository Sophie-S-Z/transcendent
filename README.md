# Transcendent

Transcendent lets a person finish computer tasks with one signal. The signal is a held blink or a press of any key or switch. The app predicts the next full action, and the user confirms it with one signal.

All processing occurs in the browser. No camera frame and no workspace content leaves the device. There is no server and no account.

Live app: https://sophie-s-z.github.io/transcendent/

## How it works

1. A built-in workspace (mail, messages, calendar, notes) with sample data lists every valid action for its state (`src/core/workspace.ts`).
2. A predictor ranks that list. Tier 0 uses rules and action counts (`src/core/predict.ts`). Tier 1 asks a small open model in the browser through WebLLM and falls back to Tier 0 after 1.5 seconds (`src/core/tier1.ts`). The app drops every predicted ID that is not in the list.
3. The screen shows the top 4 actions and "Something else". "Call for help" is on the home screen and in "Something else", so it is 2 signals away. A highlight moves through the items, and one signal selects the highlighted item (`src/screens/Loop.tsx`).
4. Send and delete actions need a second select on a confirm screen. Other actions show an Undo bar for 5 seconds.
5. Free text uses three complete drafts, then next-word suggestions, then a row-column scanning keyboard with the most frequent letters first (`src/text/entry.ts`).

A held blink comes from the MediaPipe Face Landmarker eye-blink scores. A 30-second calibration sets the threshold and the hold time (`src/input/blink.ts`).

## Evaluation

The baseline mode uses the same workspace with fixed category menus and the scanning keyboard only: no ranking, no drafts, and no word suggestions. "Start test session" runs the 10 tasks, the 5 "Call for help" tests, and hold-out tasks. The app records signals, time, errors, and prediction hits for each task, and the results screen exports the log as CSV (`src/eval/`).

`npm run simulate` runs a simulated user that uses only the space bar and always selects the correct item. Its counts are the lowest possible for this design. They are not results from people.

### Limits

- No person with a motor impairment tested the app. The testers had no motor impairment.
- The sample data and the reply drafts were written with knowledge of the 10 tasks. The hold-out tasks, written by a second person after the code freeze, check this bias.
- The keyboard has no capital letters.

## Run

```sh
npm install
npm run dev
```

## Check

```sh
npm run check      # lint, type check, unit tests
npm run build
npx vite preview --port 4173 & npm run simulate
```

## Stack

TypeScript, React, Vite, Tailwind CSS, MediaPipe Face Landmarker, WebLLM. The face model is in `public/models`. The MediaPipe WebAssembly files are copied from `node_modules` on install.
