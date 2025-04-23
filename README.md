# Digital Detective Guide

A portable knowledge base application for detectives to store and share investigative wisdom, templates, and resources.

## Features

- 100% offline operation
- Portable (runs from USB drive)
- Cross-platform support (Windows and Mac)
- Secure data storage
- Easy knowledge sharing through export/import
- File attachments support
- Rating system
- Search functionality
- Category management

## Installation

1. Download the latest release for your operating system:
   - Windows: `DigitalDetectiveGuide.exe`
   - Mac: `DigitalDetectiveGuide.app`

2. Copy the application to your USB drive or preferred location

3. Run the application:
   - Windows: Double-click `DigitalDetectiveGuide.exe`
   - Mac: Double-click `DigitalDetectiveGuide.app`

## First Launch

On first launch, the application will:
1. Create necessary folders and database
2. Generate a unique device ID
3. Set up default categories

## Usage

### Adding Entries
1. Click "New Entry" button
2. Fill in the entry details:
   - Title
   - Category
   - Description
   - Detective Wisdom
   - Tags
   - Attach files (optional)
3. Click "Save Entry"

### Managing Categories
- View categories in the sidebar
- Add new categories using the "Add Category" button
- Click a category to view its entries

### Searching
- Use the search bar to find entries
- Search across titles, descriptions, wisdom, and tags
- Results update in real-time

### Sharing Knowledge
1. Click "Export" to create a merge package
2. Share the generated ZIP file with other detectives
3. They can import it using the "Import" button

## File Structure

```
DigitalDetectiveGuide/
├── DigitalDetectiveGuide.exe (or .app)
├── notebook.db
├── files/
├── exports/
├── help/
├── config.json
├── main.js
├── index.html
├── style.css
├── renderer.js
└── preload.js
```

## Security

- All data is stored locally
- No internet connection required
- Files are stored with unique identifiers
- Regular backups recommended

## Support

For help and support:
1. Click the "Help" button in the application
2. Refer to the user guide in the `help` folder
3. Contact your department's technical support

## License

This software is provided for official law enforcement use only. Unauthorized distribution or use is prohibited. 