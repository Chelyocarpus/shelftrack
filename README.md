# ShelfTrack

A comprehensive inventory schedule management system for tracking when shelves need to be checked.

## Purpose
ShelfTrack helps warehouse and retail staff efficiently manage inventory schedules, providing clear visual indicators for shelves that need attention. It solves the problem of tracking when inventory was last performed on specific shelves and when the next inventory check is due.

## Key Features
- **Inventory Dashboard** - At-a-glance view of overdue, upcoming, and current shelf statuses
- **Smart Date Tracking** - Automatically identifies shelves needing immediate attention
- **Shelf Grouping** - Link related shelves to synchronize their inventory dates
- **Cloud Sync & Backup** - Optionally sync and back up your data to a private GitHub Gist.
- **Mobile Optimized** - Full functionality on tablets and smartphones
- **Quick Completion** - Mark inventory as complete with a single tap
- **Visual Status Indicators** - Color-coded system for inventory status

## Technical Features
- Built with modern JavaScript, Tailwind CSS, and DataTables
- Cloud storage via GitHub Gists (configurable with Personal Access Token and Gist ID)
- Custom date sorting for robust inventory scheduling in DataTables
- Implements data caching for performance optimization
- Request batching and debouncing for efficiency
- Configurable logging system
- Fully accessible interface following WCAG guidelines
- Optimized for mobile with touch-friendly controls

## Getting Started
1. Clone the repository.
2. Open `index.html` in your browser.
3. Start adding shelves with their inventory dates.
4. Group related shelves for easier management.
5. Optionally, configure cloud sync for data backup and synchronization (see Configuration section below).

## Shelf Format
Shelves can be named using any format that works for your inventory system. There are no restrictions on shelf names.

## Data Storage
Data is stored locally in the browser using localStorage by default. Optional cloud synchronization and backup to a private GitHub Gist is available for data persistence across devices and browsers. This feature requires configuration.

## Configuration

### Cloud Sync (GitHub Gist)
ShelfTrack can use a private GitHub Gist to store your shelf and group data. This allows you to:
- Back up your data.
- Synchronize your data across different browsers or devices.

To configure Cloud Sync:
1.  Click on the **cloud icon** usually located in the top-right corner of the application.
2.  You will need a **GitHub Personal Access Token (PAT)**.
    *   Create a new PAT by clicking the "Create token" link in the configuration dialog or by navigating to [GitHub Tokens](https://github.com/settings/tokens/new).
    *   The token requires the `gist` scope only.
    *   Copy the generated token.
3.  In the ShelfTrack configuration dialog:
    *   Paste your GitHub PAT into the "GitHub Personal Access Token" field.
    *   **Gist ID (Optional)**:
        *   If you have an existing Gist you want to use, paste its ID here.
        *   If you leave this blank, ShelfTrack will create a new private Gist for you when you save the configuration.
    *   Enable the "Enable Gist Database" checkbox.
    *   Configure auto-sync and auto-backup preferences as needed.
4.  Save the configuration.

Once configured, you can manually trigger a sync using the smaller sync icon below the main cloud icon, or by right-clicking the main cloud icon.

## Browser Support
Works in all modern browsers (Chrome, Firefox, Safari, Edge).
