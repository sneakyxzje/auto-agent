import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

/**
 * Build library mode: một file JS duy nhất để hệ thống chủ nhúng bằng thẻ script.
 * Next.js không tạo được bundle kiểu này nên widget phải là app riêng — phần dùng
 * chung với console nằm ở @chatbot/chat-core.
 */
export default defineConfig({
  build: {
    lib: {
      entry: fileURLToPath(new URL('src/index.ts', import.meta.url)),
      name: 'ChatbotWidget',
      formats: ['iife'],
      fileName: () => 'chatbot-widget.js',
    },
    outDir: 'dist',
    emptyOutDir: true,
  },
});
