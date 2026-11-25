/// <reference types="chrome" />
// Chrome cannot show the camera prompt inside the side panel. This tab asks once, so the extension keeps the camera.
import './panel.css'

const status = document.getElementById('status')!
navigator.mediaDevices
  .getUserMedia({ video: true })
  .then((stream) => {
    stream.getTracks().forEach((t) => t.stop())
    status.textContent = 'The camera is on for Transcendent. You can close this tab.'
    chrome.runtime.sendMessage({ type: 'camera-ready' })
  })
  .catch((e: unknown) => {
    status.textContent = `The camera did not start (${e instanceof Error ? e.message : String(e)}). Keys still work.`
  })
