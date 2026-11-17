import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig(({ mode }) => ({
  base: mode === 'production' ? './' : '/',
  server: {
    port: parseInt(process.env.VITE_PORT || process.env.PORT || '3000', 10),
    host: '0.0.0.0',
    strictPort: true,
    allowedHosts: true,
    hmr: false,
    cors: true,
  },
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  css: {
    lightningcss: {
      targets: {
        chrome: 100 << 16,
      },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'chrome106',
    cssTarget: 'chrome100',
    cssMinify: 'lightningcss',
    minify: 'esbuild',
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('node_modules')) {
            if (id.includes('lucide-react')) return 'vendor-icons';
            if (id.includes('qrcode.react')) return 'vendor-qr';
            return 'vendor-react';
          }
        },
      },
    },
  },
}));
