import fs from 'fs';
import path from 'path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

const logoSrc = '/home/pedroamaro/.gemini/antigravity/brain/f2b00ae3-c50d-4c79-b57f-b03e4c57ad41/media__1787178422859.png';
const publicDir = path.resolve(import.meta.dirname, 'public');
if (fs.existsSync(logoSrc)) {
  fs.copyFileSync(logoSrc, path.join(publicDir, 'logo.png'));
  fs.copyFileSync(logoSrc, path.join(publicDir, 'favicon.png'));
}

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
    },
    dedupe: ['react', 'react-dom'],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, 'dist'),
    emptyOutDir: true,
  },
});
