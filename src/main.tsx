import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Toaster } from './components/Toaster';
import { captureFromQuery } from './lib/pending';
import { registerServiceWorker } from './lib/pwa';
import { startSync } from './lib/sync';
import './styles.css';

captureFromQuery();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
    <Toaster />
  </StrictMode>,
);

registerServiceWorker();
startSync();
