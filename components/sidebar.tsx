"use client"

import type React from "react"
import Link from "next/link"

import { Home, Users, BarChart2, Settings, TrendingUp, HelpCircle, DollarSign, Flag } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { GolfBall } from "./icons/golf-ball"

const SidebarIcon = ({ icon, text = "tooltip" }: { icon: React.ReactNode; text?: string }) => (
  <TooltipProvider>
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="sidebar-icon group">{icon}</div>
      </TooltipTrigger>
      <TooltipContent side="right" className="z-50">
        {text}
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
)

export default function Sidebar() {
  return (
    <div className="fixed top-0 left-0 h-screen w-16 m-0 flex flex-col items-center bg-[#121212] text-white shadow-lg z-10">
      <div className="sidebar-icon mt-4 mb-6">
        <GolfBall size={24} />
      </div>
      <hr className="sidebar-hr" />
      <Link href="/">
        <SidebarIcon icon={<Home size={24} />} text="Dashboard" />
      </Link>
      <SidebarIcon icon={<Flag size={24} />} text="Tournaments" />
      <SidebarIcon icon={<Users size={24} />} text="Players" />
      <SidebarIcon icon={<BarChart2 size={24} />} text="Stats" />
      <Link href="/parlays">
        <SidebarIcon icon={<TrendingUp size={24} />} text="Parlays" />
      </Link>
      <SidebarIcon icon={<DollarSign size={24} />} text="Betting" />
      <hr className="sidebar-hr mt-auto" />
      <SidebarIcon icon={<Settings size={24} />} text="Settings" />
      <SidebarIcon icon={<HelpCircle size={24} />} text="Help" />
    </div>
  )
}
