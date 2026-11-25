# Transcendent Switch

Transcendent Switch turns one held blink into one key press for the whole computer. On Windows, the key drives the On-Screen Keyboard in scan mode. Then you can use any app with blinks only.

The app has two modes. Select "Switch" or "Predict" at the top of the window. Switch mode is the default.

- Switch mode sends one key press for each held blink.
- Predict mode reads the app that you use and shows its next actions. Predict mode needs Windows.

The app uses the camera on your computer. No camera frame and no app content leaves the computer.

## How the switch works

- Hold a blink. The ring fills.
- When the ring is full, open your eyes. The app sends one key press.
- Keep your eyes closed for 3 seconds. The switch pauses, and the app sends no key. Do this again to resume.
- A short natural blink sends no key.
- The default key is Space. You can select Enter in "Key to send".

## Install on Windows

1. Open the "Desktop app" workflow run in GitHub Actions.
2. Download the artifact "transcendent-switch-windows".
3. Extract the ZIP file.
4. Open the `.msi` file or the `-setup.exe` file.
5. The app has no signature, so Windows SmartScreen shows a warning. Select "More info".
6. Select "Run anyway".
7. Complete the installer.

## Allow the camera

1. Open Transcendent Switch.
2. The app asks for the camera. Select "Allow".
3. If the camera does not start, open Settings > Privacy & security > Camera.
4. Turn on "Camera access".
5. Turn on "Let desktop apps access your camera".
6. Close and open the app again.

## Calibrate

1. Sit 50 to 70 cm from the camera. Put light on your face.
2. Select "Calibrate".
3. Look at the screen and blink as you normally do (6 seconds).
4. Look down at your keyboard and keep your eyes open (3 seconds).
5. Close your eyes for 1 second, then open them.
6. Make sure that the message tells you to hold a blink. If calibration fails, add light and calibrate again.

The app keeps the calibration on this computer.

## Keep the app in view

The app window stays on top of other windows. Do not minimize the window, and do not hide it behind a full-screen app. Windows can slow down a hidden or minimized window, and then the app can miss a blink.

The app window does not take the keyboard focus. Thus the key goes to the app that you use.

## Turn on the On-Screen Keyboard

1. Open Settings > Accessibility > Keyboard.
2. Turn on "On-Screen Keyboard". You can also press Windows key + R, type `osk`, and press Enter.
3. On the On-Screen Keyboard, select "Options".
4. Select "Scan through keys".
5. Select "Use keyboard key to select".
6. Select "Spacebar" in the list.
7. Set "Scanning speed". Start with a slow speed.
8. Select "OK".

Make sure that "Key to send" in Transcendent Switch is the same key as the On-Screen Keyboard select key.

## Test with Notepad

This test is the Phase 3 gate. Do all the steps with blinks only.

1. Open Notepad with the On-Screen Keyboard. For example, select the Windows key, type "notepad", and select Enter.
2. Write a short note, for example "hello from my eyes".
3. Save the note: select Ctrl, then select S.
4. Type a file name.
5. Select Enter.
6. Make sure that the file is on the disk.

Write down the time, the number of wrong key presses, and each problem.

## Use Predict mode

Predict mode reads the controls of the app that you use. Then it shows the 4 most likely actions, "Something else", and "Stop". A highlight moves through the items.

1. Calibrate in Switch mode.
2. Select "Predict".
3. Open the app that you want to use. Transcendent reads the app that is in front.
4. Hold a blink when the highlight is on the action that you want. Open your eyes when the ring is full. The app runs the action.
5. To see all the actions, select "Something else". The actions are in groups, for example "Buttons" and "Write in a field".
6. To write in a field, select the field. Select a row of the keyboard, then select a letter. Select "✓" when the text is complete.
7. To stop the scan, select "Stop" or keep your eyes closed for 3 seconds. Select "Start again" to continue.

The app reads the window again every 1.5 seconds and after each action. The list changes only when the app changes.

### What Predict mode reads

- The app reads the window with Windows UI Automation. It reads the name, the help text, the ID, and the type of each control.
- The app reads only controls that are on the screen, that are enabled, and that have a name. It reads up to about 400 controls in 300 ms.
- The app also reads the open menus of the same app.
- The app does not read the text in a field. It only checks if the field is empty.
- The ranking puts empty fields first. Then it puts the actions that you selected most often in this app. Then it puts main content before menus and toolbars.

### What Predict mode refuses

- The app does not type passwords. When you select a password field, the app only puts the cursor in the field. Use Switch mode and the On-Screen Keyboard to type the password.
- The app does not send key presses in Predict mode. It writes text with UI Automation only.
- Send, post, pay, buy, order, delete, remove, submit, transfer, and confirm actions open a confirm screen. "Cancel" is the first item. Select "Confirm" to run the action.
- The app does not run an action when the control is gone or its name changed. Look at the new list and select again.

### Log

The app keeps a log of each action on this computer: the time, the app, the action, and the risk. Select "Stop" to see the log buttons. Select "Export CSV" to save the log. Select "Delete log" two times to delete it.

### Known limits

- Windows does not let a normal app read an app that runs as administrator. Then the app shows "Transcendent cannot read" and the window name. Tell the caregiver. The caregiver can open the app without administrator rights, or use Switch mode for that app.
- Some apps do not give names to their controls. The app cannot show these controls.
- The highlight speed is 1.2 seconds. You cannot change it yet.
- Nobody tested Predict mode on Windows yet. Switch mode stays the default until Predict mode passes a test on Windows.

### Phase 4 gate

Do not test Predict mode with a person with a motor impairment yet. First get feedback from the partners. Then get an approved study. Only then do a test with a person with a motor impairment.

## Build

The workflow `.github/workflows/desktop.yml` builds the Windows installers. To build on a Windows computer:

```sh
npm ci
npm run build:desktop
cd desktop
npx --yes @tauri-apps/cli@2.12.4 build
```

The installers are in `desktop/src-tauri/target/release/bundle`.

The workflow also runs `cargo clippy` and `cargo test` on Windows. The UI Automation code compiles only on Windows.

## macOS

macOS: not built yet. Switch Control can use the same key; a person must test it on a Mac.

Predict mode does not read macOS apps. The macOS Accessibility reader is not built, because no Mac is available for a test.
