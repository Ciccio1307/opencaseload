import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // `server-only` throws outside a React Server bundle; it is a no-op here.
      'server-only': fileURLToPath(new URL('./src/test/empty.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Need the Docker database: run with `npm run test:integration`.
    exclude: ['src/test/integration/**', 'node_modules/**'],
    // Fixed, non-UTC zones so the tests prove the code ignores the runtime zone.
    env: {
      TZ: 'America/New_York',
      NEXT_PUBLIC_TIMEZONE: 'Europe/Rome',
      NEXT_PUBLIC_LOCALE: 'en-GB',
      SESSION_SECRET: 'test-session-secret-at-least-32-characters',
      SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
    },
  },
});
