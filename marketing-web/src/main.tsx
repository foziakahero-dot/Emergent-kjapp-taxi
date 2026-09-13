import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import PremiumHome from './PremiumHome';
import './styles.css';
import './responsive-fixes.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      {window.location.pathname === '/' ? <PremiumHome /> : <App />}
    </BrowserRouter>
  </React.StrictMode>,
);
