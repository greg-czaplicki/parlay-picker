import {
  Home,
  Users,
  BarChart2,
  Settings,
  TrendingUp,
  HelpCircle,
  DollarSign,
  Flag,
  Activity,
  Brain,
} from "lucide-react"
import { GolfBall } from "@/components/icons/golf-ball"
import type { SidebarConfig } from "@/types/navigation"

export const sidebarConfig: SidebarConfig = {
  logo: {
    icon: GolfBall,
    title: "Golf Parlay Picker",
    href: "/",
  },
  mainNavigation: [
    {
      items: [
        {
          title: "Dashboard",
          href: "/",
          icon: Home,
        },
        {
          title: "Matchups",
          href: "/matchups",
          icon: Flag,
        },
        {
          title: "In-Tournament",
          href: "/players/in-tournament",
          icon: Users,
        },
        {
          title: "Season Stats",
          href: "/players/season",
          icon: BarChart2,
        },
        {
          title: "Trends",
          href: "/trends",
          icon: Activity,
        },
        {
          title: "Parlays",
          href: "/parlays",
          icon: TrendingUp,
        },
        {
          title: "AI Assistant",
          href: "/ai-assistant",
          icon: Brain,
        },
      ],
    },
  ],
  bottomNavigation: [
    {
      items: [
        {
          title: "Betting",
          icon: DollarSign,
          disabled: true,
        },
        {
          title: "Settings",
          icon: Settings,
          disabled: true,
        },
        {
          title: "Help",
          icon: HelpCircle,
          disabled: true,
        },
      ],
    },
  ],
}