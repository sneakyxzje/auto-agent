import { streamSse } from '@chatbot/chat-core';

/**
 * Điểm vào của bundle nhúng. Hệ thống chủ dùng như sau:
 *
 *   <script src="/chatbot-widget.js"></script>
 *   <script>
 *     ChatbotWidget.mount({
 *       target: document.getElementById('chatbot'),
 *       apiUrl: '/api/v1',
 *       accessToken: '<JWT do hệ thống chủ ký>',
 *     });
 *   </script>
 */

export type MountOptions = {
  target: HTMLElement;
  apiUrl: string;
  accessToken: string;
};

export const mount = (options: MountOptions): void => {
  const { target, apiUrl } = options;

  if (!(target instanceof HTMLElement)) {
    throw new TypeError('ChatbotWidget.mount: `target` phải là một HTMLElement');
  }

  target.textContent = `Chatbot widget chưa được triển khai (API: ${apiUrl})`;
};

export { streamSse };
