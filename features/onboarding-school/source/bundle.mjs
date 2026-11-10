import { build } from 'vite'
import react from '@vitejs/plugin-react'

await build({
  configFile: false,
  base: './',
  plugins: [react()],
  define: { 'process.env.NODE_ENV': JSON.stringify('production'), 'import.meta.env.BASE_URL': JSON.stringify('./webview/') },
  build: {
    outDir: process.argv[2],
    emptyOutDir: false,
    lib: { entry: 'entry.jsx', name: 'SchoolQuestions', formats: ['iife'], fileName: () => 'questions.js' },
    rollupOptions: { output: { assetFileNames: 'questions[extname]' } }
  }
})
