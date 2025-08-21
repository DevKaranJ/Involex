# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added
- Phase 3.1 Cloud API Setup: Complete Node.js/Express backend foundation
- RESTful API structure with authentication, email analysis, and billing endpoints
- PostgreSQL database schema with Prisma ORM for user management and billing data
- JWT-based authentication system with bcrypt password hashing
- Comprehensive security middleware: rate limiting, CORS, helmet protection
- Winston logging system with file rotation and structured logging
- Mock AI email analysis endpoint ready for OpenAI integration
- Backend monorepo structure integrated within existing Involex project
- Development and production build configurations for backend API

### Changed
- Development plan updated to mark Phase 2 (Core Email Integration) as complete
- Phase 3.1 (Cloud API Setup) marked as complete with full backend infrastructure
- Gmail and Outlook integrations synchronized with identical 66 methods each
- Both email platforms now have complete feature parity including auto-analysis, widget management, and background processing

### Fixed
- Outlook integration missing critical methods: setupReadWidgetListeners, extractRecipients, parseRelativeTime, autoAnalyzeEmail
- Widget event listener setup incomplete in Outlook content script
- Rate limiter configuration compatibility issues with rate-limiter-flexible package
- Missing helper methods for email analysis, export functionality, and user settings management
- Prisma schema relation conflicts in ApiKey model

---

## [0.2.1] - 2025-08-21

### Added
- **Phase 3.1 Complete**: Node.js/Express backend API foundation with comprehensive infrastructure
- RESTful API endpoints: /health, /api/auth/*, /api/analysis/*, /api/billing/*
- PostgreSQL database schema with User, EmailAnalysis, BillingEntry, UserSettings models
- JWT authentication with refresh token support and secure password hashing
- Security middleware: rate limiting (100 req/min), CORS for Chrome extension origins
- Winston logging with file rotation and structured JSON output
- Mock AI email analysis response ready for OpenAI integration
- Backend monorepo structure within existing Involex project
- TypeScript configuration for backend API with strict type checking
- Development and production build scripts for backend services

### Changed
- Updated development plan to reflect completed Phase 3.1 (Cloud API Setup)
- Backend package.json with corrected dependency versions and comprehensive scripts

### Fixed
- Rate limiter configuration incompatibility with rate-limiter-flexible v2.4.2
- Prisma schema relation conflicts causing build failures
- TypeScript compilation errors in backend middleware and route handlers

---

## [0.2.0] - 2025-08-19

### Added
- **Phase 2 Complete**: Gmail and Outlook Web App integration with complete feature parity
- Enhanced content scripts for both platforms with 66 private methods each
- Advanced DOM observers for real-time email detection and monitoring
- Legal email classification with keyword analysis and domain pattern matching
- Widget injection system with deduplication and cleanup management
- Auto-analysis functionality for legal emails with background processing
- Professional UI with Involex branding and billing time tracking
- Export functionality, context menus, and keyboard shortcuts (Alt+A, Alt+B, Alt+I)
- Navigation handlers and email event listeners for send/reply/forward detection

### Changed
- Synchronized Gmail and Outlook integrations to have identical capabilities
- Both email platforms now support the same comprehensive feature list
- Updated development plan to reflect completed Phase 2 (Core Email Integration)

### Fixed
- Widget duplication issues and memory leaks from orphaned elements
- Cross-platform DOM selector compatibility and event listener setup
- Missing helper methods and incomplete widget functionality in Outlook

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