import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { Toaster } from "@/components/ui/toaster"
import { Providers } from "./providers"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { BreadcrumbNav } from "@/components/breadcrumb-nav"
import { MobileNav } from "@/components/mobile-nav"

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
          <SidebarProvider defaultOpen={true}>
            <div className="flex min-h-screen bg-gradient-to-br from-[#0f0f15] via-[#1a1a24] to-[#252538]">
              <AppSidebar />
              <SidebarInset className="flex flex-1 flex-col">
                <BreadcrumbNav />
                <main className="flex-1 overflow-auto p-4 pb-20 md:pb-4">
                  {children}
                </main>
              </SidebarInset>
              <MobileNav />
            </div>
            <Toaster />
          </SidebarProvider>
        </Providers>
      </body>
    </html>
  )
}


