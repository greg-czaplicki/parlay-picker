// Greg
// Custom hook for fetching users with React Query
// Usage:
// const { data, isLoading, isError, error } = useUsersQuery({ role: 'admin' })

import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-keys'

interface User {
  id: string
  name: string
  email: string
  // Add other user fields as needed
}

interface UsersQueryFilters {
  [key: string]: unknown
}

// Replace this with your actual data fetching logic (e.g., Supabase, fetch, etc.)
async function fetchUsers(filters?: UsersQueryFilters): Promise<User[]> {
  // Example: fetch from /api/users?role=admin
  // const params = new URLSearchParams(filters as Record<string, string>).toString()
  // const res = await fetch(`/api/users?${params}`)
  // return res.json()
  return [] // TODO: implement actual fetch
}

export function useUsersQuery(filters?: UsersQueryFilters) {
  return useQuery<User[], Error>({
    queryKey: queryKeys.users.list(filters),
    queryFn: () => fetchUsers(filters),
  })
} 