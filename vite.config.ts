import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA, type ManifestOptions } from 'vite-plugin-pwa';

const isTest = process.env.VITEST === 'true';

type LocalizedManifestText =
  string | { value: string; lang?: string; dir?: 'ltr' | 'rtl' };

type LocalizedWebAppManifest = Partial<ManifestOptions> & {
  name_localized: Record<'de' | 'en', LocalizedManifestText>;
  short_name_localized: Record<'de' | 'en', LocalizedManifestText>;
  description_localized: Record<'de' | 'en', LocalizedManifestText>;
};

const manifest = {
  name: 'Training Tracker',
  short_name: 'Training',
  description:
    'A private strength and cardio training log. All data stays on this device.',
  lang: 'en',
  dir: 'ltr',
  name_localized: {
    de: 'Training Tracker',
    en: 'Training Tracker',
  },
  short_name_localized: {
    de: 'Training',
    en: 'Training',
  },
  description_localized: {
    de: 'Private Trainingsdokumentation für Kraft und Cardio. Alle Daten bleiben auf diesem Gerät.',
    en: 'A private strength and cardio training log. All data stays on this device.',
  },
  start_url: '/',
  scope: '/',
  display: 'standalone',
  orientation: 'portrait',
  background_color: '#0b0f14',
  theme_color: '#0b0f14',
  categories: ['health', 'fitness', 'productivity'],
  icons: [
    { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    {
      src: '/icons/icon-maskable-512.png',
      sizes: '512x512',
      type: 'image/png',
      purpose: 'maskable',
    },
  ],
} satisfies LocalizedWebAppManifest;

/**
 * Vite configuration.
 *
 * The application is a purely static, client-side SPA: no server functions, no
 * environment variables and no runtime CDN dependencies. Everything the app
 * needs at runtime is bundled and precached by the service worker.
 */
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // The PWA plugin injects a service worker; it is not needed (and slows down)
    // the unit test run.
    ...(isTest
      ? []
      : [
          VitePWA({
            // "prompt" lets the user decide when to reload, so an update can never
            // interrupt a running workout.
            registerType: 'prompt',
            injectRegister: null,
            includeAssets: ['favicon.svg', 'icons/apple-touch-icon-180.png'],
            manifest,
            workbox: {
              // Precache the whole app shell so the app starts offline.
              globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
              // SPA fallback for client-side routes.
              navigateFallback: '/index.html',
              navigateFallbackDenylist: [/^\/_/],
              cleanupOutdatedCaches: true,
              clientsClaim: false,
              skipWaiting: false,
              // No runtime caching rules: the app never talks to the network.
              runtimeCaching: [],
            },
            devOptions: { enabled: false },
          }),
        ]),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    target: 'es2022',
    sourcemap: false,
    // Recharts alone is ~537 kB and sits in its own chunk that is fetched only
    // when the analytics page is opened, so it never affects the initial load.
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          // Charting is only needed on the analytics page.
          recharts: ['recharts'],
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    css: false,
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    restoreMocks: true,
  },
});
