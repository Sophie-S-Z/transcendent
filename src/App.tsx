import { useState } from 'react'
import { loadLog, saveLog, SESSION, testerName } from './eval/log'
import { loadSettings, saveSettings, type Settings } from './settings'
import { BlinkLab } from './screens/BlinkLab'
import { Loop } from './screens/Loop'
import { ModelProbe } from './screens/ModelProbe'
import { Results } from './screens/Results'
import { Setup, type Next } from './screens/Setup'

export default function App() {
  const [settings, setSettings] = useState(loadSettings)
  const [screen, setScreen] = useState<Next | 'setup'>('setup')
  const update = (s: Settings) => {
    setSettings(s)
    saveSettings(s)
  }
  const back = () => setScreen('setup')

  switch (screen) {
    case 'setup':
      return <Setup settings={settings} onChange={update} onNext={setScreen} />
    case 'calibrate':
      return (
        <BlinkLab
          initial={settings.blink}
          onGate={(falseSelects, ms) =>
            saveLog([
              ...loadLog(),
              {
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
              },
            ])
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
          <button onClick={back} className="m-8 min-h-24 rounded-2xl border-2 border-ink px-8 text-2xl">
            Back
          </button>
        </>
      )
  }
}
