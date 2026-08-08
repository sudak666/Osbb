import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [tailwindcss()],
  base: '/Osbb/',
  appType: 'mpa',
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        osbb: 'osbb/index.html',
        sklad: 'sklad/index.html',
        promin: 'promin/index.html',
      },
    },
  },
});
