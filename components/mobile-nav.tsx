"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { useSidebar } from "@/components/ui/sidebar"
import { sidebarConfig } from "@/config/navigation"

export function MobileNav() {
  const pathname = usePathname()
  const { setOpenMobile } = useSidebar()

  // Get the main navigation items (first 4 for mobile bottom nav)
  const mobileNavItems = sidebarConfig.mainNavigation[0]?.items.slice(0, 4) || []

  const handleNavClick = () => {
    setOpenMobile(false)
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden">
      <nav className="flex h-16 items-center justify-around bg-surface/95 backdrop-blur-xl border-t border-border/20 shadow-2xl">
        {mobileNavItems.map((item) => {
          const isActive = pathname === item.href
          const ItemIcon = item.icon

          return (
            <Link
              key={item.title}
              href={item.href || "#"}
              onClick={handleNavClick}
              className={cn(
                "flex flex-col items-center justify-center gap-1 py-2 px-3 rounded-lg transition-all duration-200",
                "hover:bg-glass/50 active:scale-95",
                isActive
                  ? "text-primary bg-primary/10"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <div className={cn(
                "flex items-center justify-center w-8 h-8 rounded-lg transition-all",
                isActive && "bg-primary/20 shadow-lg shadow-primary/20"
              )}>
                <ItemIcon size={18} />
              </div>
              <span className="text-xs font-medium truncate max-w-[4rem]">
                {item.title}
              </span>
              {isActive && (
                <div className="absolute top-0 left-1/2 h-1 w-8 -translate-x-1/2 rounded-b-full bg-primary" />
              )}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}