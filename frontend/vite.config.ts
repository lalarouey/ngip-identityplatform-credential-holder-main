import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: 'localhost',
    port: 5173,
  },
  resolve: {
    alias: {
      components: '/src/components',
      pages: '/src/pages',
      types: '/src/types',
      styles: '/src/styles',
    },
  },
});
