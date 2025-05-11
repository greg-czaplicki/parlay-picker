"use client"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useState } from "react"
import { ThemeProvider } from "@/components/theme-provider"
import { ReactQueryDevtools } from "@tanstack/react-query-devtools"

export function Providers({ children }: { children: React.ReactNode }) {
  // Greg: Set React Query global defaults for best practices in dashboard apps
  // - staleTime: 5 minutes (data considered fresh for 5 min)
  // - gcTime: 30 minutes (unused data stays in cache for 30 min; was 'cacheTime' in v4)
  // - retry: 2 (retry failed queries twice)
  // - refetchOnWindowFocus: true (auto-refetch on window focus; override in hooks for static data)
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000, // 5 minutes
        gcTime: 30 * 60 * 1000, // 30 minutes (was 'cacheTime' in v4)
        retry: 2,
        refetchOnWindowFocus: true,
      },
    },
  }))

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider
        attribute="class"
        defaultTheme="dark"
        enableSystem
        disableTransitionOnChange
      >
        {children}
      </ThemeProvider>
      {process.env.NODE_ENV === "development" && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  )
}