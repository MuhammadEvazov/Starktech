import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// Глобальные стили — до App, чтобы файлы страниц шли в бандле после них и могли их уточнять
import './styles/base.css';
import './styles/shop.css';
import './styles/site/foundation.css';
import App from './App.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
