import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import PaymentReturn from './PaymentReturn';
import PremiumHome from './PremiumHome';
import './styles.css';
import './responsive-fixes.css';

const PAYMENT_RETURN_PATHS = new Set([
  '/payment/success',
  '/payment/cancel',
  '/app/payment-methods',
]);

function Root() {
  const path = window.location.pathname;
  if (PAYMENT_RETURN_PATHS.has(path)) return <PaymentReturn />;
  if (path === '/') return <PremiumHome />;
  return <App />;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Root />
    </BrowserRouter>
  </React.StrictMode>,
);
