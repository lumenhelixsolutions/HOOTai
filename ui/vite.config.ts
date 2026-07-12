import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { bundleDocs } from './scripts/bundle-docs.mjs'

function docsBundlePlugin(): Plugin {
  return {
    name: 'hoot-docs-bundle',
    buildStart() {
      bundleDocs()
    },
    configureServer() {
      bundleDocs()
    },
  }
}

export default defineConfig({
  plugins: [docsBundlePlugin(), react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:7777',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    chunkSizeWarningLimit: 600,
    modulePreload: {
      resolveDependencies: (_filename, deps) => deps.filter((dep) => !dep.includes('coach-') && !dep.includes('recharts-')),
    },
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('recharts') || id.includes('d3-')) return 'recharts';
            if (id.includes('@assistant-ui')) return 'coach';
            if (id.includes('react-router') || id.includes('react-dom') || id.includes('/react/')) return 'vendor';
          }
        },
      },
    },
  },
})