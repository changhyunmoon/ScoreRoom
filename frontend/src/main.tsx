import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './app/App';
import { startSession } from './features/session';
import { startErrorReporter } from './shared/lib/errorReporter';
import './shared/styles/global.css';

// 예전 주소(/#/p/...)로 저장된 링크·즐겨찾기를 새 주소(/p/...)로 바꾼다
if (window.location.hash.startsWith('#/')) {
  window.history.replaceState(null, '', window.location.hash.slice(1));
}

startErrorReporter();
startSession();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
