"use client"

import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { sidebarConfig } from "@/config/navigation"
import type { NavigationItem } from "@/types/navigation"

export function useNavigation() {
  const pathname = usePathname()
  const [breadcrumbs, setBreadcrumbs] = useState<NavigationItem[]>([])

  // Generate breadcrumbs based on current pathname
  useEffect(() => {
    const generateBreadcrumbs = () => {
      const allItems = [
        ...sidebarConfig.mainNavigation.flatMap(group => group.items),
        ...sidebarConfig.bottomNavigation.flatMap(group => group.items)
      ]

      const currentItem = allItems.find(item => item.href === pathname)
      
      if (currentItem) {
        // For now, just return the current item as a single breadcrumb
        // In the future, this could be extended to handle nested routes
        setBreadcrumbs([currentItem])
      } else {
        // Fallback for unknown routes
        setBreadcrumbs([{
          title: "Unknown Page",
          href: pathname,
          icon: sidebarConfig.logo.icon
        }])
      }
    }

    generateBreadcrumbs()
  }, [pathname])

  // Get current active navigation item
  const getCurrentNavItem = () => {
    const allItems = [
      ...sidebarConfig.mainNavigation.flatMap(group => group.items),
      ...sidebarConfig.bottomNavigation.flatMap(group => group.items)
    ]

    return allItems.find(item => item.href === pathname)
  }

  return {
    breadcrumbs,
    currentNavItem: getCurrentNavItem(),
    pathname
  }
}