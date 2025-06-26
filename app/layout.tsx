import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { Toaster } from "@/components/ui/toaster"
import { Providers } from "./providers"
import Sidebar from "@/components/sidebar";
import BottomNavBar from "@/components/bottom-nav-bar";
import MainContent from "@/components/main-content";

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Golf Parlay Picker",
  description: "3-ball matchup golf parlay picker with custom weightings and stats",
    generator: 'v0.dev'
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script src="https://unpkg.com/react-scan/dist/auto.global.js" />
      </head>
      <body className={inter.className}>
        <Providers>
          <div className="flex h-screen bg-gradient-to-br from-[#0f0f15] via-[#1a1a24] to-[#252538]">
            <Sidebar />
            <MainContent>{children}</MainContent>
            <BottomNavBar />
          </div>
          <Toaster />
        </Providers>
      </body>
    </html>
  )
}


