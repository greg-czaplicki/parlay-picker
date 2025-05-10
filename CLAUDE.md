# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

- Always reply **Greg** so I know we are using our rules.
- Formulate a plan and a list of TODOs prior to making any code changes.
- Write concise, technical TypeScript using functional and declarative programming patterns.
- Avoid class components; prefer functional components with typed props.
- Use iteration and modularization to reduce duplication.
- Use descriptive variable names (e.g., `isLoading`, `hasError`).

## Commands

### Development

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm run start

# Lint code
npm run lint

# Run tests
npm test

# Run specific test file
npm test -- tests/api/matchups/2ball/route.test.ts
```

### PGA Stats Scraper (in pga-stats-scraper directory)

```bash
# Install dependencies
npm install

# Build scraper
npm run build

# Run scraper (headless)
npm start

# Run with browser UI for debugging
npm run debug:full

# Test single category
npm run test:single

# Debug single category with visual feedback
npm run debug:single
```

## Architecture

### Project Structure

- **app/**: Next.js App Router structure
  - **actions/**: Server actions
  - **api/**: API routes using route.ts pattern
  - **matchups/**: Core matchup viewing pages
  - **parlays/**: Parlay building and viewing

- **components/**: UI components
  - **ui/**: Shadcn UI components
  - **tables/**: Data display tables
  - Core feature components (dashboard, parlay-builder, etc.)

- **context/**: React contexts (ParlayContext)
- **hooks/**: Custom React hooks
- **lib/**: Utility functions and Supabase client setup
- **tests/**: Jest test files

### Data Flow

1. Data fetched from Supabase using createServerClient() for server components
2. API routes sync tournament data and matchup odds from external sources
3. Client components use React Query to fetch and cache data
4. ParlayContext manages state for parlay selections and calculations

### Supabase Integration

- MCP tool is available to view, edit and updates tables.
- Uses both browser and server clients depending on component type
- Database includes tables for:
  - Tournaments and events
  - Player profiles and statistics
  - Matchup data with odds from multiple bookmakers
  - Parlay information

## Testing

- Jest configured for Node environment
- Tests focus on API routes and data processing functions
- Mock Supabase responses for predictable test outcomes

## Environment Variables

Requires the following in `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_public_anon_key
SUPABASE_URL=same_as_public_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

## Database Schema Expectations

The app expects several tables in Supabase, including:
- tournaments
- players
- player_season_stats
- matchups
- parlay_selections

## UI/UX Styles
- Use Shadcn UI, Radix UI, and Tailwind CSS for component styling.
- Implement responsive design using Tailwind’s mobile-first approach.

## Performance
- Minimize use of `use client`, `useEffect`, and `useState`.
- Favor React Server Components (RSC) for data and rendering logic.
- Wrap client components in `<Suspense />` with a fallback.
- Load non-critical components dynamically.
- Use Next.js `<Image />` with width/height specified and lazy loading.

## Code Style

- File order: exported component → subcomponents → helpers → static content → types.
- Use lowercase with dashes for directories (e.g., `components/auth-wizard`).
- Use named exports for components.
- Use interfaces over types.
- Avoid enums; use `as const` assertions or const objects.
- All code must be in TypeScript.
- Use arrow functions for components/handlers.
- Keep conditionals concise (avoid unnecessary braces).
- Use declarative JSX structure.