import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  // ── Production build optimizations ──
  esbuild: {
    // Strip console.log and console.warn in production builds
    drop: process.env.NODE_ENV === 'production' ? ['console', 'debugger'] : [],
  },
  build: {
    // Target modern browsers for smaller output
    target: 'es2020',
    // Increase chunk size warning threshold
    chunkSizeWarningLimit: 600,
    // Enable CSS code splitting
    cssCodeSplit: true,
    // Minify with esbuild (fastest)
    minify: 'esbuild',
    rollupOptions: {
      output: {
        // Vendor chunk splitting for better caching
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-motion': ['framer-motion'],
          'vendor-icons': ['lucide-react'],
          'vendor-charts': ['recharts'],
          'vendor-supabase': ['@supabase/supabase-js'],
          'vendor-particles': ['react-tsparticles', 'tsparticles-slim', 'tsparticles-engine'],
          'vendor-ocr': ['pdfjs-dist', 'tesseract.js'],
        },
      },
    },
    // Enable source map for debugging (optional, disable in prod for smaller bundles)
    sourcemap: false,
  },
  // ── Optimized dependency pre-bundling ──
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      'framer-motion',
      'lucide-react',
      'axios',
    ],
  },
})
