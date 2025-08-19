# Chrome Extension Development Setup Guide

## Prerequisites

- Node.js (v18 or higher)
- npm (v8 or higher)
- Git
- Google Chrome (latest version)
- Chrome Developer Mode enabled
- PostgreSQL (for backend database)

## Initial Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/DevKaranJ/Involex.git
   cd Involex
   ```

2. **Install all dependencies**
   ```bash
   npm run install:all
   ```

3. **Set up environment variables**
   - Copy `.env.example` to `.env` in both extension and backend directories
   - Fill in the required API keys and configuration

4. **Build the extension**
   ```bash
   npm run build:extension
   ```

5. **Load extension in Chrome**
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked" and select the `extension/dist` folder

6. **Start backend development server**
   ```bash
   npm run dev:backend
   ```

## Chrome Extension Development

### Extension Structure
```
extension/
├── manifest.json          # Extension configuration
├── src/
│   ├── background/        # Service worker scripts
│   ├── content/           # Content scripts for email platforms
│   ├── popup/             # Extension popup interface
│   ├── options/           # Settings and configuration pages
│   ├── shared/            # Shared utilities and types
│   └── assets/            # Icons, images, and static files
├── dist/                  # Built extension files
└── tests/                 # Extension-specific tests
```

### Development Commands
- `npm run dev:extension` - Build extension in watch mode
- `npm run build:extension` - Build production extension
- `npm run test:extension` - Run extension tests
- `npm run lint:extension` - Lint extension code

### Chrome APIs Used
- **chrome.identity**: OAuth 2.0 authentication
- **chrome.storage**: Local data persistence
- **chrome.runtime**: Message passing and background processing
- **chrome.tabs**: Tab management and content script injection
- **chrome.notifications**: User notifications

## Branch Strategy

- `main`: Production-ready code
- `dev`: Default development branch
- `feature/*`: Feature development
- `hotfix/*`: Critical bug fixes

## Commit Convention

Follow conventional commits:
- `feat:` new features
- `fix:` bug fixes
- `docs:` documentation changes
- `style:` formatting changes
- `refactor:` code refactoring
- `test:` adding tests
- `chore:` maintenance tasks

