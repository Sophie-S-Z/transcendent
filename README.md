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

A held blink comes from the MediaPipe Face Landmarker eye-blink scores. A calibration of about 16 seconds (natural blinks, a look down at the keyboard, and one held blink) sets the threshold above the look-down level and sets the hold time. A 1-minute reading test checks for false selects and raises the hold time if a natural blink came close to it (`src/input/blink.ts`).

## Evaluation

The baseline mode uses the same workspace with fixed category menus and the scanning keyboard only: no ranking, no drafts, and no word suggestions. "Start test session" runs the 10 tasks, the 5 "Call for help" tests, and hold-out tasks. The app records signals, time, errors, and prediction hits for each task, and the results screen exports the log as CSV (`src/eval/`).

`npm run simulate` runs a simulated user that uses only the space bar and always selects the correct item. Its counts are the lowest possible for this design. They are not results from people.

### Demo scenarios

The setup screen has a scenario list. "Evaluation" is the measured set above. Five more packs give the demo its own sample data, tasks, and automatic checks: Needs and care, Work mail and calendar, Study, Health, and Judges’ live demo. A sixth pack, Setup, is a 2-step checklist for the caregiver on the setup screen. The profiles in the packs are illustrative. They are not real people. The log records the scenario with each task (`src/eval/scenarios.ts`).

### Limits

- No person with a motor impairment tested the app. The testers had no motor impairment.
- The sample data and the reply drafts were written with knowledge of the 10 tasks. The hold-out tasks, written by a second person after the code freeze, check this bias.
- The keyboard has no capital letters.

## Chrome extension (Phases 1 and 2)

The extension runs the same loop on real web pages. A page reader lists the visible links, buttons, fields, and headings, and the ranker only ranks that list (`extension/`).

- The extension asks for no site at install. The caregiver turns on each site by name in the side panel.
- Send, post, pay, delete, and submit actions always open a confirm screen with Cancel first. A button whose page name differs from its visible text shows both names.
- The extension refuses every click and every text entry on a page with a card field.
- A held blink selects when the eyes open. A held blink of 3 seconds, or the Escape key, stops the scan.
- Each action goes to a log on the device. The log keeps the newest 5,000 actions. The panel can export or delete it.
- A setting lets the on-device model (Tier 1) rank the page actions with the page title and the visible text. The model can only change the order of the safe actions on the list.

To load it, run `npm run build:extension`. Open `chrome://extensions`, turn on Developer mode, select "Load unpacked", and select `extension/dist`. The demo sites for the Phase 1 gate are in `public/demo-sites` (mail, video, shop). `npm run test:extension` runs the end-to-end test, which includes hostile pages with hidden and fake buttons.

## Windows app (Phases 3 and 4)

A small Tauri app has two modes (`desktop/`):

- **Switch:** one held blink sends one Space key press to the whole system. The Windows On-Screen Keyboard in scan mode then controls any app.
- **Predict:** the app reads the controls of the app in front with Windows UI Automation. The same Tier 0 rules as the extension rank them (`src/core/actions.ts`), and one held blink runs the highlighted control. It never types into a password field.

See `desktop/README.md`. The "Desktop app" GitHub workflow lints and tests the Rust code on Windows and builds the Windows installer. The macOS version is not built.

## Run

```sh
npm install
npm run dev
```

## Check

```sh
npm run check      # lint, type check, unit tests
npm run build
npm run test:extension
npx vite preview --port 4173 & npm run simulate
```

The two browser tests use `playwright-core`. Set `CHROME` to the path of a Chrome or Chromium binary, or run `npx playwright install chromium` once.

## Stack

TypeScript, React, Vite, Tailwind CSS, MediaPipe Face Landmarker, WebLLM, Paper Shaders (the backdrop and the metal mark), Tauri (the Windows switch), Familjen Grotesk and IBM Plex Mono. The face model is in `public/models`. The MediaPipe WebAssembly files are copied from `node_modules` on install.
