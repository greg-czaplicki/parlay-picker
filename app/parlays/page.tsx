import ParlaysClient from './parlays-client';

// Enable dynamic rendering and disable static generation for this page
// This ensures fresh data on each request in production
export const dynamic = 'force-dynamic'
export const revalidate = 0

export default function ParlaysPage() {
  return <ParlaysClient />;
}