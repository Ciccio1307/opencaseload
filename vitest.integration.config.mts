/**
 * Integration tests against a real Postgres + PostgREST (docker-compose.test.yml):
 *
 *   docker compose -f docker-compose.test.yml up -d --wait
 *   npm run test:integration
 *   docker compose -f docker-compose.test.yml down
 */
import { SignJWT } from 'jose';
import { defineConfig } from 'vitest/config';
import base from './vitest.config.mjs';

// Must match PGRST_JWT_SECRET in docker-compose.test.yml.
const JWT_SECRET = new TextEncoder().encode('opencaseload-integration-test-jwt-secret-0000');
const apiKey = (role: string) =>
  new SignJWT({ role }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1d').sign(JWT_SECRET);

// Spread, not mergeConfig: mergeConfig would concatenate `include` and run
// the unit tests too.
export default defineConfig({
  ...base,
  test: {
    ...base.test,
    include: ['src/test/integration/**/*.int.test.ts'],
    exclude: ['node_modules/**'],
    setupFiles: ['src/test/integration/setup.ts'],
    fileParallelism: false,
    env: {
      ...base.test?.env,
      SUPABASE_URL: process.env.TEST_SUPABASE_URL ?? 'http://127.0.0.1:54321',
      SUPABASE_SERVICE_ROLE_KEY: await apiKey('service_role'),
      TEST_ANON_KEY: await apiKey('anon'),
      APP_INITIAL_PASSWORD: 'first-run-password',
    },
  },
});
