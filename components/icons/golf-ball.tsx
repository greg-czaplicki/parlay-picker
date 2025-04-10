import type { LightbulbIcon as LucideProps } from "lucide-react"

export const GolfBall = (props: LucideProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <circle cx="12" cy="12" r="8" />
    <path d="M9 12a4 4 0 0 0 8 0" />
    <path d="M15 8a4 4 0 0 0-6 0" />
    <path d="M12 10a1 1 0 0 0-1 1" />
  </svg>
)
