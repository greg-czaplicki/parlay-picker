"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar"
import { sidebarConfig } from "@/config/navigation"
import type { NavigationItem } from "@/types/navigation"

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {}

function SidebarLogo() {
  const { state } = useSidebar()
  const LogoIcon = sidebarConfig.logo.icon
  
  return (
    <div className="flex h-12 items-center gap-3 px-2">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary-dark shadow-lg shadow-primary/20 transition-all duration-300 group-data-[collapsible=icon]:mx-auto">
        <LogoIcon size={20} className="text-white drop-shadow-sm" />
      </div>
      {state === "expanded" && (
        <div className="flex flex-col overflow-hidden">
          <span className="truncate text-sm font-semibold text-foreground">
            {sidebarConfig.logo.title}
          </span>
        </div>
      )}
    </div>
  )
}

function SidebarNavItem({ item, isCollapsed }: { item: NavigationItem; isCollapsed: boolean }) {
  const pathname = usePathname()
  const isActive = item.href ? pathname === item.href : false
  const ItemIcon = item.icon

  const buttonClasses = cn(
    "group relative h-12 justify-start gap-3 rounded-xl transition-all duration-300",
    "hover:scale-[1.02] hover:shadow-lg hover:shadow-primary/10",
    "focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:outline-none",
    isActive
      ? "bg-gradient-to-br from-primary/20 to-primary/10 text-primary shadow-lg shadow-primary/10 border border-primary/20"
      : "bg-glass hover:bg-glass-hover text-muted-foreground hover:text-primary",
    "before:absolute before:inset-0 before:rounded-xl before:bg-gradient-to-br before:from-white/5 before:to-transparent before:opacity-0 hover:before:opacity-100",
    "backdrop-blur-sm",
    item.disabled && "opacity-50 cursor-not-allowed hover:scale-100"
  )

  const content = (
    <div className="flex h-full w-full items-center">
      <div className="relative z-10 flex items-center gap-3 transition-transform group-hover:scale-105">
        <ItemIcon size={20} className="shrink-0" />
        <span className="truncate text-sm font-medium">{item.title}</span>
      </div>
      {isActive && (
        <div className="absolute -right-1 top-1/2 h-6 w-1 -translate-y-1/2 rounded-l-full bg-primary animate-pulse" />
      )}
      {item.badge && (
        <div className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-primary/20 text-xs font-medium text-primary">
          {item.badge}
        </div>
      )}
    </div>
  )

  if (item.href && !item.disabled) {
    return (
      <SidebarMenuItem>
        <SidebarMenuButton
          asChild
          isActive={isActive}
          tooltip={isCollapsed ? item.title : undefined}
          className={buttonClasses}
        >
          <Link href={item.href} onClick={item.onClick}>
            {content}
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    )
  }

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={isActive}
        tooltip={isCollapsed ? item.title : undefined}
        className={buttonClasses}
        disabled={item.disabled}
        onClick={item.onClick}
      >
        {content}
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}

export function AppSidebar({ className, ...props }: AppSidebarProps) {
  const { state } = useSidebar()
  const isCollapsed = state === "collapsed"

  return (
    <Sidebar
      collapsible="icon"
      className={cn(
        "group/sidebar",
        // Glass sidebar styling
        "[&>[data-sidebar=sidebar]]:bg-surface/90 [&>[data-sidebar=sidebar]]:backdrop-blur-xl",
        "[&>[data-sidebar=sidebar]]:border-r [&>[data-sidebar=sidebar]]:border-border/20",
        "[&>[data-sidebar=sidebar]]:shadow-2xl",
        // Ensure proper z-index
        "[&>[data-sidebar=sidebar]]:z-50",
        className
      )}
      {...props}
    >
      {/* Header with Logo */}
      <SidebarHeader className="border-b border-border/20 bg-glass/50 backdrop-blur-sm">
        <SidebarLogo />
      </SidebarHeader>

      {/* Main Content */}
      <SidebarContent className="gap-0 px-2">
        {/* Main Navigation */}
        {sidebarConfig.mainNavigation.map((group, index) => (
          <SidebarGroup key={index} className="py-4">
            {group.title && !isCollapsed && (
              <div className="px-2 py-2">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {group.title}
                </h2>
              </div>
            )}
            <SidebarGroupContent>
              <SidebarMenu className="space-y-2">
                {group.items.map((item) => (
                  <SidebarNavItem
                    key={item.title}
                    item={item}
                    isCollapsed={isCollapsed}
                  />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      {/* Footer with Bottom Navigation */}
      <SidebarFooter className="border-t border-border/20 bg-glass/50 backdrop-blur-sm">
        {sidebarConfig.bottomNavigation.map((group, groupIndex) => (
          <SidebarGroup key={groupIndex} className="py-2">
            {/* Separator */}
            {!isCollapsed && (
              <div className="px-2 py-2">
                <SidebarSeparator className="bg-gradient-to-r from-transparent via-border to-transparent" />
              </div>
            )}
            <SidebarGroupContent>
              <SidebarMenu className="space-y-2">
                {group.items.map((item) => (
                  <SidebarNavItem
                    key={item.title}
                    item={item}
                    isCollapsed={isCollapsed}
                  />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarFooter>
    </Sidebar>
  )
}