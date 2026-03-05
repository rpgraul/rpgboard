import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        converter: resolve(__dirname, 'converter.html'),
        drawing: resolve(__dirname, 'drawing-mode.html'),
        sheet: resolve(__dirname, 'sheet-mode.html'),
        text: resolve(__dirname, 'text-mode.html'),
        upload: resolve(__dirname, 'upload.html'),
        404: resolve(__dirname, '404.html'),
      }
    }
  }
});