import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@synaploom/ui/styles.css';
import '#src/application.css';
import { App } from '#src/app/App';
import { AppProviders } from '#src/app/providers/AppProviders';

const root = document.getElementById('root');
if (!root) throw new Error('Synaploom root element is missing.');

createRoot(root).render(
  <StrictMode>
    <AppProviders>
      <App />
    </AppProviders>
  </StrictMode>,
);
