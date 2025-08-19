# Changelog

All notable changes to this project will be documented in this file.

---

## [Unreleased]

### Added
- (TBD)

---

## [0.1.0] - 2025-08-19

### Added
- Initial Chrome extension setup with Manifest V3  
- Documentation suite: `README.md`, `ARCHITECTURE.md`, `DEVELOPMENT_PLAN.md`, `FEATURE_ROADMAP.md`, `BUSINESS_ROADMAP.md`, `TECHNICAL_SPECIFICATIONS.md`  
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
- Architecture shifted from web app → Chrome extension for better email integration  

### Fixed
- TypeScript configuration issues with Chrome extension APIs  
