import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './app/App';
import { startSession } from './features/session';
import './shared/styles/global.css';

startSession();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
