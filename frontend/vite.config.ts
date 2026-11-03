import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// 개발 서버: /api 요청을 로컬 Spring Boot(8080)로 넘겨 운영과 같은 단일 출처로 동작한다
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:8080', changeOrigin: false },
    },
  },
});
