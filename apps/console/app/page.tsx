import Link from 'next/link';

// Trang tạm, sẽ bị các màn hình thật thay chỗ.

const PLANNED_SCREENS = [
  { path: '/chat', label: 'Hỏi – đáp', note: 'Stream câu trả lời, lọc theo phòng ban' },
  { path: '/documents', label: 'Tài liệu', note: 'Upload, phiên bản, hạn hiệu lực' },
  { path: '/escalations', label: 'Phiếu chuyển', note: 'Realtime qua WebSocket' },
  { path: '/curation', label: 'Duyệt tri thức', note: 'Đối chiếu với tài liệu sẵn có' },
  { path: '/dashboard', label: 'Chỉ số', note: 'Tỉ lệ tự trả lời, chi phí, SLA' },
] as const;

const HomePage = () => (
  <main style={{ maxWidth: '48rem', margin: '0 auto', padding: '3rem 1.5rem' }}>
    <h1>Chatbot nội bộ — Console</h1>

    <p>
      <Link href="/login">Đăng nhập</Link> · <Link href="/register">Đăng ký</Link>
    </p>

    <p>Các màn hình dưới đây chưa được triển khai.</p>
    <ul>
      {PLANNED_SCREENS.map((screen) => (
        <li key={screen.path}>
          <code>{screen.path}</code> — {screen.label} <em>({screen.note})</em>
        </li>
      ))}
    </ul>
  </main>
);

export default HomePage;
