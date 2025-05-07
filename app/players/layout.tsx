import Sidebar from "@/components/sidebar"
import TopNavigation from "@/components/top-navigation"
import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Golf Parlay Picker - Players",
  description: "View and analyze player statistics and performance data",
}

export default function PlayersLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-[#121212] text-white">
      <Sidebar />
      <div className="ml-16 p-4">
        <TopNavigation />
        <div className="mt-6 mb-8">
          <h1 className="text-3xl font-bold">Player Statistics</h1>
        </div>
        {children}
      </div>
    </div>
  )
}