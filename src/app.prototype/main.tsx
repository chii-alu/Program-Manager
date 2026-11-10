import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import MelaManager from './index'

// `?start=<frame>` opens the app on that screen, e.g. ?start=overview
const start = new URLSearchParams(window.location.search).get('start') ?? undefined

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <MelaManager start={start} />
  </React.StrictMode>,
)
