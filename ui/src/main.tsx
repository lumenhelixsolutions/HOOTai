// Self-hosted fonts (local-first: no CDN dependency)
// build-stamp: force new index hash after static rebuilds (stale chunk recovery)
void 'hoot-ui-2026-08-02-beak-static';
import '@fontsource/inter/300.css'
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/inter/700.css'
import '@fontsource/eb-garamond/400.css'
import '@fontsource/eb-garamond/500.css'
import '@fontsource/eb-garamond/600.css'
import '@fontsource/fira-code/400.css'
import '@fontsource/fira-code/500.css'

// Pre-paint theme restore (avoids light/dark flash)
try {
  if (localStorage.getItem('hoot-theme') === 'light') {
    document.documentElement.classList.add('light')
  }
} catch { /* storage unavailable */ }

import { ConfigProvider } from 'antd'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { CoachProvider } from './context/CoachContext'
import { hootTheme } from './lib/antd-theme'

createRoot(document.getElementById('root')!).render(
  <ConfigProvider theme={hootTheme}>
    <BrowserRouter>
      <CoachProvider>
        <App />
      </CoachProvider>
    </BrowserRouter>
  </ConfigProvider>,
)
