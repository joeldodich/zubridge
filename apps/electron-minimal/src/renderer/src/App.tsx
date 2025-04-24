import electronLogo from './assets/electron.svg'
import Versions from './components/Versions'
import { useStore } from './hooks/useStore'

function App(): React.JSX.Element {
  const ipcHandle = (): void => window.electron.ipcRenderer.send('ping')
  const counter = useStore((state) => state.counter)

  // BREAKS (increment is not a functio )
  // const increment  = useStore((state) => state.increment)

  //BREAKS (inifinite loop)
  // const { counter } = useStore((state) => ({
  //   counter: state.counter,
  // }));

  // STILL WORKS
  // const state = useStore()
  // const counter = state.counter

  const dispatchIncrement = () => {
    try {
      // increment()
      ipcHandle()
      console.log('Should have incremented the counter')
    } catch (error) {
      console.error('Error incrementing counter:', error)
    }
  }

  return (
    <>
      <img alt="logo" className="logo" src={electronLogo} />
      <div className="creator">Powered by electron-vite</div>
      <div className="text">
        Build an Electron app with <span className="react">React</span>
        &nbsp;and <span className="ts">TypeScript</span>
      </div>
      <div className="actions">
        <div className="action">
          <a href="https://electron-vite.org/" target="_blank" rel="noreferrer">
            Documentation
          </a>
        </div>
        <div className="action">
          <a target="_blank" rel="noreferrer" onClick={ipcHandle}>
            Send IPC
          </a>
        </div>
      </div>
      <section className="zubridge">
        <div className="card">
          <h2 className="text">Zubridge</h2>
          <div className="creator">
            Cross-platform state without boundaries: Zustand-inspired simplicity
          </div>
          <p>
            Current shared store count: <strong>{counter}</strong>
          </p>
          <div className="actions">
            <div className="action">
              <a
                href="https://github.com/goosewobbler/zubridge/blob/main/packages/electron/docs/getting-started.md"
                target="_blank"
                rel="noreferrer"
              >
                Documentation
              </a>
            </div>
            <div className="action">
              <a target="_blank" rel="noreferrer" onClick={dispatchIncrement}>
                + Increment
              </a>
            </div>
          </div>
        </div>
      </section>
      <Versions></Versions>
    </>
  )
}

export default App
