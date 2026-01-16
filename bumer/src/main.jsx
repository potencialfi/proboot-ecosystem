import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

const rootElement = document.getElementById('root');

if (!rootElement) {
  console.error("CRITICAL ERROR: Element with id 'root' not found in index.html");
} else {
  try {
    ReactDOM.createRoot(rootElement).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  } catch (error) {
    console.error("RENDER ERROR:", error);
    rootElement.innerHTML = `<div style="padding: 20px; color: red; font-family: sans-serif;">
      <h1>Ошибка запуска приложения</h1>
      <p>Проверьте консоль разработчика (F12) для деталей.</p>
      <pre>${error.message}</pre>
    </div>`;
  }
}