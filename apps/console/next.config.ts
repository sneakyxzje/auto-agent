import type { NextConfig } from 'next';

/**
 * Console chỉ là client của API NestJS — đừng đặt nghiệp vụ vào Route Handler hay
 * Server Action. Khi hệ thống chủ nhúng widget thì tầng Next này không còn, logic
 * nào rò vào đây sẽ phải viết lại.
 */

const API_ORIGIN = process.env.API_ORIGIN ?? 'http://localhost:3001';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Ẩn header `X-Powered-By` để không lộ stack ra ngoài.
  poweredByHeader: false,
  // Cho phép truy cập dev server qua tunnel ngrok khi dùng thử nội bộ.
  allowedDevOrigins: ['*.ngrok-free.app', '*.ngrok.app', '*.ngrok-free.dev'],
  experimental: {
    middlewareClientMaxBodySize: '50mb',
  },
  /**
   * Chạy local thì Next thay vai trò nginx, chuyển tiếp `/api/*` sang cổng 3001.
   * Trình duyệt gọi cùng origin nên không cần CORS, và code phía client giống hệt
   * lúc chạy trong Docker. Ở production nginx lo việc này nên tắt đi.
   *
   * Cần kiểm lại khi làm phần chat: rewrite của Next có thể đệm phản hồi SSE. Nếu
   * đúng vậy thì riêng endpoint chat gọi thẳng localhost:3001 khi chạy local.
   */
  rewrites: async () => {
    if (process.env.NODE_ENV === 'production') return [];

    return [
      {
        source: '/api/:path*',
        destination: `${API_ORIGIN}/api/:path*`,
      },
      {
        source: '/health',
        destination: `${API_ORIGIN}/health`,
      },
    ];
  },
};

export default nextConfig;
