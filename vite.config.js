import { defineConfig } from 'vite';
// base './' -> funktioniert unter https://<user>.github.io/<repo>/ ohne festen Pfad
export default defineConfig({ base: './', build: { target: 'es2020', chunkSizeWarningLimit: 900 } });
