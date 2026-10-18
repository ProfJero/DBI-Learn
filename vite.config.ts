import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['favicon.ico', 'favicon.png', 'icons/apple-touch-icon.png', 'brand/*.png', 'images/signatures/*.png'],
      manifest: {
        id: '/',
        name: 'DBI Learn — Digital Bridge Initiative',
        short_name: 'DBI Learn',
        description: 'Learn practical digital skills anywhere — even offline. Powered by Digital Bridge Initiative.',
        start_url: '/app',
        scope: '/',
        display: 'standalone',
        display_override: ['window-controls-overlay', 'standalone'],
        orientation: 'any',
        background_color: '#ffffff',
        theme_color: '#03c14b',
        categories: ['education', 'productivity'],
        lang: 'en',
        icons: [
          { src: '/icons/pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        screenshots: [
          { src: '/images/screenshot-home.jpg', sizes: '1365x681', type: 'image/jpeg', form_factor: 'wide', label: 'DBI Learn home' },
          { src: '/images/screenshot-mobile.jpg', sizes: '503x682', type: 'image/jpeg', form_factor: 'narrow', label: 'DBI Learn on mobile' },
        ],
        shortcuts: [
          { name: 'My learning', url: '/app', icons: [{ src: '/icons/pwa-192.png', sizes: '192x192' }] },
          { name: 'Downloads', url: '/app/downloads', icons: [{ src: '/icons/pwa-192.png', sizes: '192x192' }] },
          { name: 'Verify a certificate', url: '/verify', icons: [{ src: '/icons/pwa-192.png', sizes: '192x192' }] },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,woff2,svg,png,ico,webp}'],
        globIgnores: ['**/screenshot-*', '**/hero-learners.webp', '**/logo-full.png', '**/emblem-512.png', '**/*-{cyrillic,cyrillic-ext,greek,greek-ext,vietnamese}-*.woff2'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/google[0-9a-f]+\.html$/],
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            // Course media & avatars from Supabase Storage (public buckets)
            urlPattern: ({ url }) => url.hostname.endsWith('.supabase.co') && url.pathname.startsWith('/storage/v1/object/public/'),
            handler: 'CacheFirst',
            options: { cacheName: 'dbi-media', expiration: { maxEntries: 400, maxAgeSeconds: 60 * 60 * 24 * 60 }, cacheableResponse: { statuses: [0, 200] } },
          },
          {
            urlPattern: ({ request, sameOrigin }) => sameOrigin && request.destination === 'image',
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'dbi-images', expiration: { maxEntries: 200 } },
          },
          {
            urlPattern: ({ url }) => url.hostname === 'img.youtube.com' || url.hostname === 'i.ytimg.com',
            handler: 'CacheFirst',
            options: { cacheName: 'dbi-thumbs', expiration: { maxEntries: 200 }, cacheableResponse: { statuses: [0, 200] } },
          },
        ],
      },
    }),
  ],
  build: {
    target: 'es2020',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          supabase: ['@supabase/supabase-js'],
          markdown: ['react-markdown', 'remark-gfm', 'rehype-highlight'],
          charts: ['recharts'],
          pdf: ['jspdf', 'html-to-image', 'qrcode'],
        },
      },
    },
  },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
} as never);
