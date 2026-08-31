import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  // 주의: 예전에는 여기서 GEMINI_API_KEY를 프론트 번들에 define으로 주입했다.
  // 모든 Gemini 호출은 서버(/api/analyze)에서만 하므로 불필요하고,
  // 프론트 코드가 한 줄이라도 참조하면 공개 번들에 키가 박히므로 제거했다.
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
    },
    build: {
      chunkSizeWarningLimit: 1500,
    }
  };
});
