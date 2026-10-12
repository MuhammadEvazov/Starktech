import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// В режиме разработки все запросы /api и /uploads проксируются на ASP.NET бэкенд,
// поэтому CORS для локальной работы не нужен.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const target = env.VITE_BACKEND_URL || 'http://localhost:5076';

  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        '/api': { target, changeOrigin: true },
        '/uploads': { target, changeOrigin: true },
        '/swagger': { target, changeOrigin: true },
        // SignalR-чат: WebSocket тоже идёт через прокси
        '/hubs': { target, changeOrigin: true, ws: true },
      },
    },
  };
});
