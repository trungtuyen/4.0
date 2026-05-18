import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Prevent library conflict with window.fetch (e.g. Mediapipe/TFLite)
(function() {
  const originalFetch = window.fetch;
  if (!originalFetch) return;
  
  try {
    const descriptor = Object.getOwnPropertyDescriptor(window, 'fetch');
    if (descriptor && descriptor.configurable) {
      Object.defineProperty(window, 'fetch', {
        get: () => originalFetch,
        set: () => {
          console.warn('Attempt to overwrite window.fetch blocked.');
        },
        configurable: false
      });
    }
  } catch (e) {
    // Already locked or restricted
  }
})();

// Suppress TensorFlow Lite XNNPACK delegate info log
const originalInfo = console.info;
console.info = (...args) => {
  if (typeof args[0] === 'string' && args[0].includes('Created TensorFlow Lite XNNPACK delegate for CPU')) {
    return;
  }
  originalInfo(...args);
};

const originalLog = console.log;
console.log = (...args) => {
  if (typeof args[0] === 'string' && args[0].includes('Created TensorFlow Lite XNNPACK delegate for CPU')) {
    return;
  }
  originalLog(...args);
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
