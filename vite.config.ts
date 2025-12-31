
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: {
    // نستخدم 'process.env': 'process.env' أو كائن فارغ كحماية إضافية
    'process.env': {
      API_KEY: JSON.stringify(process.env.API_KEY)
    }
  }
});
