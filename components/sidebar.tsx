"use client"

import type React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, Users, BarChart2, Settings, TrendingUp, HelpCircle, DollarSign, Flag, Activity } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { GolfBall } from "./icons/golf-ball"
import { cn } from "@/lib/utils"

interface SidebarIconProps {
  icon: React.ReactNode
  text?: string
  href?: string
  isActive?: boolean
  onClick?: () => void
}

const SidebarIcon = ({ icon, text = "tooltip", href, isActive, onClick }: SidebarIconProps) => {
  const iconElement = (
    <div 
      className={cn(
        "group relative flex h-12 w-12 cursor-pointer items-center justify-center rounded-xl",
        "transition-all duration-300 ease-in-out",
        "hover:scale-110 hover:shadow-lg hover:shadow-primary/20",
        isActive 
          ? "bg-gradient-to-br from-primary/20 to-primary/10 text-primary shadow-lg shadow-primary/10 border border-primary/20" 
          : "bg-glass hover:bg-glass-hover text-muted-foreground hover:text-primary",
        "before:absolute before:inset-0 before:rounded-xl before:bg-gradient-to-br before:from-white/5 before:to-transparent before:opacity-0 hover:before:opacity-100",
        "backdrop-blur-sm"
      )}
      onClick={onClick}
    >
      <div className="relative z-10 transition-transform group-hover:scale-110">
        {icon}
      </div>
      {isActive && (
        <div className="absolute -right-1 top-1/2 h-6 w-1 -translate-y-1/2 rounded-l-full bg-primary animate-pulse-glow" />
      )}
    </div>
  )

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {href ? (
            <Link href={href} className="block">
              {iconElement}
            </Link>
          ) : (
            iconElement
          )}
        </TooltipTrigger>
        <TooltipContent 
          side="right" 
          className="bg-surface border-border/50 text-foreground shadow-xl backdrop-blur-sm"
          sideOffset={12}
        >
          <span className="font-medium">{text}</span>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

export default function Sidebar() {
  const pathname = usePathname()

  const navigation = [
    { href: "/", icon: <Home size={20} />, text: "Dashboard" },
    { href: "/matchups", icon: <Flag size={20} />, text: "Matchups" },
    { href: "/players/in-tournament", icon: <Users size={20} />, text: "In-Tournament" },
    { href: "/players/season", icon: <BarChart2 size={20} />, text: "Season Stats" },
    { href: "/trends", icon: <Activity size={20} />, text: "Trends" },
    { href: "/parlays", icon: <TrendingUp size={20} />, text: "Parlays" },
  ]

  const bottomNavigation = [
    { icon: <DollarSign size={20} />, text: "Betting" },
    { icon: <Settings size={20} />, text: "Settings" },
    { icon: <HelpCircle size={20} />, text: "Help" },
  ]

  return (
    <div className="hidden md:flex fixed top-0 left-0 z-50 h-screen w-16 flex-col items-center bg-surface/80 backdrop-blur-xl border-r border-border/20 shadow-2xl">
      {/* Logo */}
      <div className="mt-6 mb-8 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary-dark shadow-lg shadow-primary/20">
        <GolfBall size={24} className="text-white drop-shadow-sm" />
      </div>

      {/* Main Navigation */}
      <nav className="flex flex-col items-center space-y-4">
        {navigation.map((item) => (
          <SidebarIcon
            key={item.href}
            icon={item.icon}
            text={item.text}
            href={item.href}
            isActive={pathname === item.href}
          />
        ))}
      </nav>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Bottom Navigation */}
      <nav className="mb-6 flex flex-col items-center space-y-4">
        <div className="h-px w-8 bg-gradient-to-r from-transparent via-border to-transparent" />
        {bottomNavigation.map((item, index) => (
          <SidebarIcon
            key={index}
            icon={item.icon}
            text={item.text}
          />
        ))}
      </nav>
    </div>
  )
}
