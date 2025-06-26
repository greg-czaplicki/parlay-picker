"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, Users, BarChart2, TrendingUp, Flag } from "lucide-react"
import { cn } from "@/lib/utils"

const navigation = [
  { href: "/", icon: <Home size={24} />, text: "Dashboard" },
  { href: "/matchups", icon: <Flag size={24} />, text: "Matchups" },
  { href: "/players/in-tournament", icon: <Users size={24} />, text: "Players" },
  { href: "/parlays", icon: <TrendingUp size={24} />, text: "Parlays" },
]

export default function BottomNavBar() {
  const pathname = usePathname()

  return (
    <div className="md:hidden fixed bottom-0 left-0 z-50 w-full h-16 bg-background/80 backdrop-blur-xl border-t border-border/20">
      <nav className="grid h-full max-w-lg grid-cols-4 mx-auto">
        {navigation.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "inline-flex flex-col items-center justify-center px-5 hover:bg-muted/50 transition-colors duration-200",
              pathname === item.href ? "text-primary" : "text-muted-foreground"
            )}
          >
            {item.icon}
            <span className="text-xs font-medium sr-only">{item.text}</span>
          </Link>
        ))}
      </nav>
    </div>
  )
}