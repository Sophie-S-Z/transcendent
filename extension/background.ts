/// <reference types="chrome" />
// The toolbar button opens the side panel. The click also grants activeTab, so the panel reads the tab again.
// Chrome keeps the panel behavior from an older version, so this turns the automatic open off.
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false })
chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ windowId: tab.windowId })
  chrome.runtime.sendMessage({ type: 'action' }).catch(() => {})
})
