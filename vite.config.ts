import { defineConfig } from 'vite';

export default defineConfig({
  appType: 'mpa',
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        osbb: 'osbb/index.html',
        sklad: 'sklad/index.html',
      },
    },
  },
});
