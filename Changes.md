# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added
- 

### Changed
- 

### Fixed
- 

---

## [0.1.1] - 2025-08-19

### Added
- Complete Chrome extension build system working successfully
- All required icon files (16x16, 32x32, 48x48, 128x128) for Chrome Web Store compliance
- CSS files properly integrated for Gmail and Outlook content scripts
- Production-ready webpack build with code minification and optimization

### Changed
- TypeScript configuration updated to enable proper compilation output
- Manifest V3 service worker configuration corrected for compatibility
- Webpack configuration enhanced to copy all necessary assets

### Fixed
- TypeScript compilation errors with missing properties and dependencies
- Chrome extension loading error due to missing icon32.png file
- Service worker module type compatibility issues
- Content script CSS files not being copied to dist folder

---

## [0.1.0] - 2025-08-19

### Added
- Comprehensive business roadmap for Involex including vision, market analysis, business model, go-to-market strategy, and competitive analysis
- Detailed development setup guide for Chrome extension (prerequisites, initial setup, development commands)
- Structured development plan for the Chrome extension with phases, tasks, and success metrics
- Feature roadmap for Involex detailing core features, release plans, user stories, and future vision
- Technical specifications covering system architecture, Chrome extension requirements, AI/ML capabilities, database schema, and API specifications
- Initial project setup with package.json including project metadata, scripts for development, testing, and building processes
- Initial Chrome extension setup with Manifest V3
- Chrome extension structure with TypeScript + React
- Background service worker with email queue management
- Content scripts for Gmail and Outlook (email monitoring & extraction)
- React-based popup for billing management + statistics dashboard
- Options page for billing rates, AI settings, and preferences
- Shared utilities: types, storage manager, email processor, API client
- CSS styling for popup, options, Gmail, and Outlook views
- Webpack build system for dev + production
- Chrome Storage API integration with caching
- Email metadata extraction & cross-platform normalization

### Changed
- Architecture shifted from web app to Chrome extension for better email integration

### Fixed
- Initial TypeScript configuration issues with Chrome extension APIs