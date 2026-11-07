import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app/App'
import { initialLocale, loadLocale } from './i18n'
import './styles/index.css'

// The first screen comes up in the visitor's language: its dictionary (one small file for the
// languages that are not built in) is fetched before the first render.
void loadLocale(initialLocale()).then(() =>
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  ),
)
