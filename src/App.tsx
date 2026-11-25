import { useState } from 'react'
import { appendLog, loadLog, SESSION, testerName } from './eval/log'
import { loadSettings, saveSettings, type Settings } from './settings'
import { BlinkLab } from './screens/BlinkLab'
import { Loop } from './screens/Loop'
import { ModelProbe } from './screens/ModelProbe'
import { Results } from './screens/Results'
import { Setup, type Next } from './screens/Setup'
import { Backdrop } from './ui/Liquid'

export default function App() {
  const [settings, setSettings] = useState(loadSettings)
  const [screen, setScreen] = useState<Next | 'setup'>('setup')
  const update = (s: Settings) => {
    setSettings(s)
    saveSettings(s)
  }
  const back = () => setScreen('setup')

  const page = (() => {
    switch (screen) {
      case 'setup':
        return <Setup settings={settings} onChange={update} onNext={setScreen} />
      case 'calibrate':
        return (
          <BlinkLab
            initial={settings.blink}
            onGate={(falseSelects, ms) =>
              appendLog({
                session: SESSION,
                tester: testerName(settings.tester),
                mode: settings.mode,
                task: 'gate-a',
                signals: falseSelects,
                ms,
                errors: falseSelects,
                topHits: 0,
                top5Hits: 0,
                steps: 0,
                completed: falseSelects === 0,
                startedAt: new Date(Date.now() - ms).toISOString(),
                scenario: settings.scenario,
              })
            }
            onDone={(blink) => {
              update({ ...settings, blink })
              back()
            }}
          />
        )
      case 'use':
      case 'session':
        return <Loop settings={settings} session={screen === 'session'} onExit={back} />
      case 'results':
        return <Results records={loadLog()} onClose={back} />
      case 'probe':
        return (
          <>
            <ModelProbe />
            <div className="mx-auto max-w-3xl px-10 pb-10">
              <button onClick={back} className="btn btn-ghost px-10">
                Back
              </button>
            </div>
          </>
        )
    }
  })()

  // The backdrop drifts only on screens without the camera, so blink detection keeps the full frame budget.
  return (
    <>
      <Backdrop live={screen === 'setup' || screen === 'results'} />
      <div key={screen} className="enter">
        {page}
      </div>
    </>
  )
}
