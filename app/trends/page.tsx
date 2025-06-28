import { Suspense } from 'react';
import { TrendsContainer } from '@/components/trends/trends-container';
import { TrendsHeader } from '@/components/trends/trends-header';
import { TrendsSkeleton } from '@/components/trends/trends-skeleton';

export default function TrendsPage() {
  return (
    <div className="min-h-screen bg-dashboard">
      <div className="container mx-auto px-4 py-8">
        <TrendsHeader />
        <Suspense fallback={<TrendsSkeleton />}>
          <TrendsContainer />
        </Suspense>
      </div>
    </div>
  );
}