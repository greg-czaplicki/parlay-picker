# Golf Parlay Picker - TODO List

## Ideas
- SG trends since we store data after each week
- SG trends in tournament
- Keep all tourneys and figure out trends (made/missed cut, top 25, top 10 etc)
- Figure out Under/Overvalue naming and purpose when FD is highlighted but not DG and vice versa

## Fixes
- 3ball is getting all matchups sometimes. Refresh fixes the issue
- Fix 2-ball matchups to sync correctly when new data is available
- Ensure all components handle loading/error states consistently

## Features
- Add starting times and sort by those to improve odds layout
- Connect recommended picks odds gap filter with the dynamic slider in matchups table
- Add ability to filter recommended picks by bookmaker
- Implement bet tracking history for parlays
- Add user authentication for personalized parlays 
- Implement mobile-optimized views for all components

## Technical Debt
- Refactor RecommendedPicks and matchups-table to share common code
- Implement proper TypeScript types for all components
- Add unit tests for critical components
- Create storybook stories for UI components

## Completed
- ✅ Fix player table duplicate key issue
- ✅ Fix tournament filtering in player view
- ✅ Add support for Opposite Field tournaments
- ✅ Create RecommendedPicks component for odds gap visualization
