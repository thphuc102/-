import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import GuestWindow from './components/GuestWindow';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);

const renderApp = () => {
  if (window.location.hash === '#guest') {
    root.render(
      <React.StrictMode>
        <GuestWindow />
      </React.StrictMode>
    );
  } else {
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  }
};

window.addEventListener('hashchange', renderApp);
renderApp(); // Initial render