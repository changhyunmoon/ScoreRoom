import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// 운영: 정적 빌드(dist/)를 Nginx가 제공하고 /api를 Spring Boot로 넘긴다
// 개발: npm run dev 에서 Vite가 /api를 로컬 Spring Boot(8080)로 넘긴다
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { '/api': 'http://localhost:8080' },
  },
});
