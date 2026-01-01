import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import process from 'node:process';

export default defineConfig(({ mode }) => {
  // تحميل متغيرات البيئة من النظام (Netlify) أو ملفات .env
  // نستخدم '' كبارامتر ثالث لتحميل جميع المتغيرات بغض النظر عن بادئة VITE_
  const env = loadEnv(mode, process.cwd(), '');
  
  // في Netlify، تكون المتغيرات متوفرة في process.env أثناء البناء
  // نفضل القيمة من env (للتطوير المحلي) ثم نعود لـ process.env (للإنتاج)
  const apiKey = env.API_KEY || process.env.API_KEY || '';

  return {
    plugins: [react()],
    define: {
      // حقن المفتاح في الكود الذي يعمل لدى العميل
      'process.env.API_KEY': JSON.stringify(apiKey)
    }
  };
});
