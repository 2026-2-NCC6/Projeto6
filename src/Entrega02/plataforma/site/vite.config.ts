import { copyFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'copiar-staticwebapp',
      closeBundle() {
        copyFileSync('staticwebapp.config.json', 'dist/staticwebapp.config.json');
      },
    },
  ],
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
});
