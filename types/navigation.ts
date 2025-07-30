export interface NavigationItem {
  title: string
  href?: string
  icon: React.ComponentType<{ size?: number; className?: string }>
  isActive?: boolean
  badge?: string | number
  disabled?: boolean
  onClick?: () => void
}

export interface NavigationGroup {
  title?: string
  items: NavigationItem[]
}

export interface SidebarConfig {
  mainNavigation: NavigationGroup[]
  bottomNavigation: NavigationGroup[]
  logo: {
    icon: React.ComponentType<{ size?: number; className?: string }>
    title: string
    href?: string
  }
}