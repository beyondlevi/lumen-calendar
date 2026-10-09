import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App';
import {captureConfigFromUrl} from './config/lumenConfig';
import {locale} from './i18n/strings';
import {CalendarProvider} from './state/CalendarProvider';
import './styles.css';

// `?demo=1` works everywhere; the other parameters are a development fallback
// kept only in a regular browser (no window.lumen). All are removed from the address.
captureConfigFromUrl(window.lumen?.config == null);
document.documentElement.lang = locale;

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root mount element');

createRoot(root).render(
  <StrictMode>
    <CalendarProvider>
      <App />
    </CalendarProvider>
  </StrictMode>,
);
