import './platform';
import './styles/globals.css';

import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { OfflineBanner } from './components/OfflineBanner';

const root = document.getElementById('root');
if (!root) throw new Error('#root element missing');

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <ErrorBoundary>
      <OfflineBanner />
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
