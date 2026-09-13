import React from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { AuthProvider } from './auth';
import App from './App';
import PaymentReturn from './PaymentReturn';
import './styles.css';

const PAYMENT_RETURN_PATHS = new Set([
  '/payment/success',
  '/payment/cancel',
  '/app/payment-methods',
]);

function Root() {
  if (PAYMENT_RETURN_PATHS.has(window.location.pathname)) {
    return <PaymentReturn />;
  }

  return (
    <HashRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </HashRouter>
  );
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
);
