'use client'


import { cn } from '@/lib/utils'

export default function MainContent({ children }: { children: React.ReactNode }) {
  return (
    <main
      className={cn(
        'flex-1 overflow-y-auto',
        'pb-16 md:pb-0'
      )}
    >
      <div className="min-h-full p-6 lg:p-8">{children}</div>
    </main>
  )
}
