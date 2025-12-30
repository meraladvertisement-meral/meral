
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: {
    // هذا السطر يحل مشكلة الشاشة الزرقاء الناتجة عن "process is not defined"
    'process.env': process.env
  },
  build: {
    outDir: 'dist',
    sourcemap: false
  }
});
