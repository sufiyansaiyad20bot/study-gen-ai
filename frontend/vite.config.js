import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// SPA routes that must always serve index.html (React Router is client-side).
// GET requests to these paths are NOT forwarded to the backend, otherwise a
// fresh tab load of e.g. /documents would hit the API instead of the SPA.
const SPA_ROUTES = ['/', '/login', '/register', '/dashboard', '/documents', '/chat', '/quiz', '/revision']

function spaBypass(req) {
  if (req.method === 'GET' && SPA_ROUTES.includes(req.url.split('?')[0])) {
    return '/index.html'
  }
  return undefined
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // Proxy API calls to the FastAPI backend during development
    proxy: {
      '/auth': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        bypass: spaBypass,
      },
      '/documents': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        bypass: spaBypass,
      },
      '/chat': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        bypass: spaBypass,
      },
      '/quiz': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        bypass: spaBypass,
      },
      '/revision': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        bypass: spaBypass,
      },
    },
  },
})