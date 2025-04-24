import electronLogo from './assets/electron.svg'
import Versions from './components/Versions'
import { useStore } from './hooks/useStore'

function App(): React.JSX.Element {
  const ipcHandle = (): void => window.electron.ipcRenderer.send('ping')
  const counter = useStore((state) => state.counter)

  // const { counter } = useStore((state) => ({
  //   counter: state.counter,
  // }));

  // const state = useStore()
  // const counter = state.counter

  return (
    <>
      <img alt="logo" className="logo" src={electronLogo} />
      <div className="creator">Powered by electron-vite</div>
      <div className="text">
        Build an Electron app with <span className="react">React</span>
        &nbsp;and <span className="ts">TypeScript</span>
      </div>
      <p className="tip">
        Please try pressing <code>F12</code> to open the devTool
      </p>
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
              <a target="_blank" rel="noreferrer" onClick={ipcHandle}>
                -
              </a>
            </div>
            <div className="action">
              <a href="https://electron-vite.org/" target="_blank" rel="noreferrer">
                +
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
