import { defineConfig } from 'vite';

export default defineConfig({
  // Relative base so the build works at bonewitz.net/<anything>/
  base: './',
  build: {
    target: 'esnext', // top-level await in main.js
  },
});
