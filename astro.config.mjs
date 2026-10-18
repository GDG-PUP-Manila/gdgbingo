import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';
import react from '@astrojs/react';
import tailwind from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  output: 'server',
  adapter: vercel(),
  integrations: [react(), {
    name: 'gdgbingo-command-cache',
    hooks: {
      'astro:config:setup': ({ command, updateConfig }) => {
        // Build/check must not replace React's dev runtime beneath a running server.
        updateConfig({ vite: { cacheDir: fileURLToPath(new URL(`./node_modules/.vite/gdgbingo-${command}/`, import.meta.url)) } });
      },
    },
  }],
  vite: { plugins: [tailwind()] },
});
