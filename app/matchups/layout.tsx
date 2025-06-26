import Sidebar from "@/components/sidebar"
import TopNavigation from "@/components/top-navigation"
import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Golf Parlay Picker - Matchups",
  description: "Analyze and pick golf matchups for parlays",
}

export default function MatchupsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen text-white">
      <Sidebar />
      <div className="ml-16 p-4">
        <TopNavigation />
        {children}
      </div>
    </div>
  )
}