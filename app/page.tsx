import { redirect } from 'next/navigation'

export default function Home() {
  // Redirect from root page to the matchups page
  redirect('/matchups')
}
