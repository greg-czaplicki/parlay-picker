import type { Metadata } from "next"
import Dashboard from "@/components/dashboard"

export const metadata: Metadata = {
  title: "Golf Parlay Picker Dashboard",
  description: "Analyze and pick 3-ball matchups for golf parlays",
}

export default function Home() {
  return (
    <main className="min-h-screen bg-[#121212]">
      <Dashboard />
    </main>
  )
}
