import { readFileSync } from 'node:fs';
import { defineConfig, type Plugin } from 'vite';

/**
 * A preview build (VITE_PREVIEW=pr-12, set by .github/workflows/preview.yml) gets a store of its own
 * in the browser, put in before the game runs. A normal build is not changed by this.
 */
function previewStorage(): Plugin {
  const name = process.env.VITE_PREVIEW;
  return {
    name: 'preview-storage',
    transformIndexHtml() {
      if (!name) return [];
      const code = readFileSync(new URL('./tools/preview-storage.js', import.meta.url), 'utf8').replace('__PREVIEW__', JSON.stringify(name));
      return [{ tag: 'script', children: code, injectTo: 'head-prepend' }];
    },
  };
}

export default defineConfig({
  // relative base: the build works from any static host path
  base: './',
  plugins: [previewStorage()],
  build: { target: 'es2022', chunkSizeWarningLimit: 900 },
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
} as Parameters<typeof defineConfig>[0]);
