"use client"

import * as React from "react"
import Link from "next/link"
import { ChevronRight, Home } from "lucide-react"
import { cn } from "@/lib/utils"
import { useNavigation } from "@/hooks/use-navigation"
import { SidebarTrigger } from "@/components/ui/sidebar"

interface BreadcrumbNavProps {
  className?: string
}

export function BreadcrumbNav({ className }: BreadcrumbNavProps) {
  const { breadcrumbs, currentNavItem } = useNavigation()

  return (
    <div className={cn(
      "flex items-center gap-2 px-4 py-3 bg-glass/50 backdrop-blur-sm border-b border-border/20",
      className
    )}>
      {/* Sidebar Toggle */}
      <SidebarTrigger className="mr-2" />
      
      {/* Breadcrumb Navigation */}
      <nav className="flex items-center gap-2 text-sm" aria-label="Breadcrumb">
        {/* Home Link */}
        <Link
          href="/"
          className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
        >
          <Home size={16} />
          <span className="sr-only">Home</span>
        </Link>

        {/* Current Page */}
        {currentNavItem && currentNavItem.href !== "/" && (
          <>
            <ChevronRight size={16} className="text-muted-foreground/50" />
            <div className="flex items-center gap-2 text-foreground font-medium">
              <currentNavItem.icon size={16} />
              <span>{currentNavItem.title}</span>
            </div>
          </>
        )}
      </nav>
    </div>
  )
}