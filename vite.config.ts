/**
 * Vite configuration for the explainer.
 *
 * base "./" makes every asset path relative, so the built site works from any folder or host,
 * including a static file server or an artifact link. Data files are imported from src/data, which
 * lets Vite split the large recordings into their own chunks that load only with the screen that uses them.
 */
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  base: './',
  plugins: [vue()],
  build: {
    target: 'es2022',
    cssCodeSplit: true,
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 400,
  },
});
