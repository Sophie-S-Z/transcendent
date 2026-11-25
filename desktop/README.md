# Transcendent Switch

Transcendent Switch turns one held blink into one key press for the whole computer. On Windows, the key drives the On-Screen Keyboard in scan mode. Then you can use any app with blinks only.

The app uses the camera on your computer. No camera frame leaves the computer.

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

## Build

The workflow `.github/workflows/desktop.yml` builds the Windows installers. To build on a Windows computer:

```sh
npm ci
npm run build:desktop
cd desktop
npx --yes @tauri-apps/cli@2.12.4 build
```

The installers are in `desktop/src-tauri/target/release/bundle`.

## macOS

macOS: not built yet. Switch Control can use the same key; a person must test it on a Mac.
