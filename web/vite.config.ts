import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: {
    // Listen on the local network too, so the app can be tested on real phones on the same Wi-Fi.
    host: true,
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
});
