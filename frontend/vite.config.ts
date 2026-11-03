import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// 정적 빌드만 한다 (dist/). 배포 서버에서는 Nginx가 이 파일들을 제공하고 /api를 Spring Boot로 넘긴다
export default defineConfig({
  plugins: [react()],
});
