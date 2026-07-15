import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/WHITE.SCREEN.MOCKUP/',
  plugins: [react()],
  server: { open: true },
});
