import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: 'public',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'public/index.html'),
        converter: resolve(__dirname, 'public/converter.html'),
        drawing: resolve(__dirname, 'public/drawing-mode.html'),
        sheet: resolve(__dirname, 'public/sheet-mode.html'),
        text: resolve(__dirname, 'public/text-mode.html'),
        upload: resolve(__dirname, 'public/upload.html'),
        audio: resolve(__dirname, 'public/audio-player.html'),
        shell: resolve(__dirname, 'public/shell.html'),
        404: resolve(__dirname, 'public/404.html'),
      }
    }
  }
});
