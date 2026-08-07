import Link from 'next/link';

const HomePage = () => (
  <main style={{ maxWidth: '48rem', margin: '0 auto', padding: '3rem 1.5rem' }}>
    <h1>Auto - Agent</h1>

    <div className='flex gap-3'>
      <Link href='/register'>Đăng ký</Link>
      <Link href='/login'>Đăng nhập</Link>
    </div>
  </main>
);

export default HomePage;
