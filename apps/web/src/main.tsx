import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@flowdsiml/ui/base.css';
import '@flowdsiml/ui/controls.css';
import './i18n';
import { applyTheme, getTheme } from './lib/theme';
import { App } from './App';

applyTheme(getTheme());

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
