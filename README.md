# ShelfTrack

A comprehensive inventory schedule management system for tracking when shelves need to be checked.

## Purpose
ShelfTrack helps warehouse and retail staff efficiently manage inventory schedules, providing clear visual indicators for shelves that need attention. It solves the problem of tracking when inventory was last performed on specific shelves and when the next inventory check is due.

## Key Features
- **Inventory Dashboard** - At-a-glance view of overdue, upcoming, and current shelf statuses
- **Smart Date Tracking** - Automatically identifies shelves needing immediate attention
- **Shelf Grouping** - Link related shelves to synchronize their inventory dates
- **Mobile Optimized** - Full functionality on tablets and smartphones
- **Quick Completion** - Mark inventory as complete with a single tap
- **Visual Status Indicators** - Color-coded system for inventory status

## Technical Features
- Built with modern JavaScript, Tailwind CSS, and DataTables
- Implements data caching for performance optimization
- Request batching and debouncing for efficiency
- Configurable logging system
- Fully accessible interface following WCAG guidelines
- Optimized for mobile with touch-friendly controls

## Getting Started
1. Clone the repository
2. Open `index.html` in your browser
3. Start adding shelves with their inventory dates
4. Group related shelves for easier management

## Shelf Format
Shelf numbers follow the format: `XXX-XX.XXX` (e.g., ABC-12.345)
- First part: 3 letters/numbers
- Second part: 2 digits
- Third part: 3 digits

## Data Storage
All data is stored locally in the browser using localStorage. No server connection required.

## Browser Support
Works in all modern browsers (Chrome, Firefox, Safari, Edge).

---

*© 2023 ShelfTrack Pro*
