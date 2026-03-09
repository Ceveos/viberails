import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://viberails.sh',
  output: 'static',
  vite: {
    plugins: [tailwindcss()],
  },
});
