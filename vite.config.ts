import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Actions expone GITHUB_REPOSITORY=usuario/repositorio.
// Para repositorios usuario.github.io, el sitio se publica en la raíz.
const repository = process.env.GITHUB_REPOSITORY || '';
const [owner, repo] = repository.split('/');
const base = process.env.VITE_BASE_PATH ||
  (repo && repo.toLowerCase() !== `${owner}.github.io`.toLowerCase() ? `/${repo}/` : '/');

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['apple-touch-icon.png', 'favicon.svg'],
      manifest: {
        id: base,
        name: 'Tareas — mi día',
        short_name: 'Tareas',
        description: 'Una forma simple y tranquila de organizar cada día.',
        start_url: base,
        scope: base,
        display: 'standalone',
        background_color: '#f8f7f4',
        theme_color: '#f8f7f4',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        cleanupOutdatedCaches: true,
        navigateFallback: 'index.html'
      },
      devOptions: { enabled: false }
    })
  ]
});
