# Digital Detective Guide - Web Version

A web-based knowledge management system for detectives, built with Node.js and Express.

## Features

- Asset Type Management
- Asset Creation and Organization
- File Upload Support
- Responsive Web Interface
- SQLite Database for Data Storage

## Prerequisites

- Node.js (v14 or higher)
- npm (v6 or higher)

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd digital-detective-guide
```

2. Install dependencies:
```bash
npm install
```

3. Start the server:
```bash
npm start
```

For development with auto-reload:
```bash
npm run dev
```

## Project Structure

```
digital-detective-guide/
├── public/              # Static files
│   ├── css/            # Stylesheets
│   └── js/             # Client-side JavaScript
├── uploads/            # File upload directory
├── server.js           # Main server file
├── package.json        # Project configuration
└── README.md           # This file
```

## API Endpoints

- `GET /api/asset-types` - Get all asset types
- `POST /api/asset-types` - Create a new asset type
- `GET /api/assets/:typeId` - Get assets by type
- `POST /api/assets` - Create a new asset
- `POST /api/files` - Upload a file

## Development

The application uses:
- Express.js for the server
- SQLite3 for the database
- Multer for file uploads
- Helmet for security headers
- CORS for cross-origin requests

## License

ISC 