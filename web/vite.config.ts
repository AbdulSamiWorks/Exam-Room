import react from '@vitejs/plugin-react';
import { cpSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { defineConfig, type Plugin } from 'vite';

const PDFJS_ASSET_FOLDERS = ['wasm', 'standard_fonts', 'cmaps', 'iccs'];
const UNUSED_PDFJS_FILE = 'quickjs';

function copyPdfjsAssets(): Plugin {
  const pdfjsDirectory = path.dirname(
    createRequire(import.meta.url).resolve('pdfjs-dist/package.json'),
  );
  const targetDirectory = path.join(import.meta.dirname, 'public', 'pdfjs');

  return {
    name: 'copy-pdfjs-assets',
    buildStart() {
      rmSync(targetDirectory, { recursive: true, force: true });
      for (const folder of PDFJS_ASSET_FOLDERS) {
        cpSync(path.join(pdfjsDirectory, folder), path.join(targetDirectory, folder), {
          recursive: true,
          filter: (sourcePath) => !path.basename(sourcePath).startsWith(UNUSED_PDFJS_FILE),
        });
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), copyPdfjsAssets()],
  server: {
    host: true,
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
});
