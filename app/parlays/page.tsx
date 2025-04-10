import ParlayCard from '@/components/parlay-card';

export default function ParlaysPage() {
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">My Active Parlays</h1>
      {/* We'll add logic here later to manage multiple parlays */}
      <ParlayCard />
    </div>
  );
} 