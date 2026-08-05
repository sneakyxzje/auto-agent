import { Suspense } from 'react';
import { HomeView } from '@/features/home/home-view';

const HomePage = () => (
  <Suspense>
    <HomeView />
  </Suspense>
);

export default HomePage;
