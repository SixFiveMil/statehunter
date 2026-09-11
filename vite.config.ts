import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import * as esbuild from 'esbuild';

export default defineConfig({
  base: '',
  plugins: [
    react(),
    {
      name: 'build-extension-scripts',
      async closeBundle() {
        // 1. Bundle main_probe.ts (IIFE for MAIN world)
        await esbuild.build({
          entryPoints: [resolve(__dirname, 'src/content/main_probe.ts')],
          bundle: true,
          outfile: resolve(__dirname, 'dist/main_probe.js'),
          format: 'iife',
          target: 'chrome110',
          sourcemap: true
        });

        // 2. Bundle isolated_bridge.ts (IIFE for ISOLATED world)
        await esbuild.build({
          entryPoints: [resolve(__dirname, 'src/content/isolated_bridge.ts')],
          bundle: true,
          outfile: resolve(__dirname, 'dist/isolated_bridge.js'),
          format: 'iife',
          target: 'chrome110',
          sourcemap: true
        });

        // 3. Bundle service_worker.ts (ESM for Background)
        await esbuild.build({
          entryPoints: [resolve(__dirname, 'src/background/service_worker.ts')],
          bundle: true,
          outfile: resolve(__dirname, 'dist/background.js'),
          format: 'esm',
          target: 'chrome110',
          sourcemap: true
        });

        console.log('Successfully bundled extension background and content scripts!');
      }
    }
  ],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      input: {
        devtools: resolve(__dirname, 'devtools.html'),
        panel: resolve(__dirname, 'panel.html')
      }
    }
  }
});
