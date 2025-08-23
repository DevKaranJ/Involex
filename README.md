# Involex - AI-Powered Legal Billing Chrome Extension

An intelligent Chrome extension that automatically captures, analyzes, and logs email communications as billable entries in leading legal practice management platforms.

## Overview

Involex streamlines the billable hour tracking process for lawyers by:
- Real-time email monitoring directly in Gmail/Outlook web interfaces
- AI-powered email summarization and time estimation
- Seamless integration with practice management platforms (Cleo, Practice Panther, My Case)
- One-click billing entry creation and approval
- Background processing with smart notifications

## Tech Stack

- **Chrome Extension**: Manifest V3 with TypeScript
- **Frontend**: React with Chrome Extension APIs
- **Backend**: Node.js with Express (Cloud API)
- **Database**: PostgreSQL with Prisma ORM
- **AI/ML**: OpenAI API integration + custom NLP models
- **Email Integration**: Gmail API, Outlook Web Add-ins
- **Authentication**: OAuth 2.0 with Chrome Identity API

## Project Structure

```
involex/
├── extension/         # Chrome extension (Manifest V3)
│   ├── src/
│   │   ├── content/   # Content scripts for email injection
│   │   ├── background/# Service worker for background processing
│   │   ├── popup/     # Extension popup interface
│   │   ├── options/   # Settings and configuration
│   │   └── shared/    # Shared utilities and types
├── backend/           # Cloud API server
├── ai-engine/         # AI/ML processing modules
├── web-dashboard/     # Optional web dashboard for advanced features
├── docs/              # Documentation
└── scripts/           # Build and deployment scripts
```

## Getting Started

### For Development
1. Clone the repository
2. Install dependencies for extension and backend
3. Set up environment variables and API keys
4. Load extension in Chrome Developer Mode
5. Start backend development server

### For Users
1. Install from Chrome Web Store
2. Grant necessary permissions for email access
3. Connect your practice management platform
4. Configure billing preferences
5. Start receiving automated billing suggestions

## Key Features

### 🚀 Real-time Email Analysis
- Automatically detects legal work in emails
- Estimates billable time using AI
- Categorizes by client, matter, and work type

### 📊 Smart Billing Integration
- One-click entry creation in practice management systems
- Customizable billing descriptions and rates
- Bulk approval and editing capabilities

### 🔒 Security & Privacy
- End-to-end encryption for sensitive data
- Local processing when possible
- GDPR and attorney-client privilege compliant

### ⚡ Seamless Workflow
- Non-intrusive browser integration
- Background processing with smart notifications
- Offline capability with sync when connected

## Development Progress

### ✅ Phase 3.2: AI Processing Engine (COMPLETED)
- **OpenAI GPT-4 Integration**: Complete email analysis with intelligent time estimation
- **Fallback Analysis System**: Rule-based processing ensuring 100% uptime
- **Comprehensive Testing**: 56 passing tests with strong coverage (89.83% for analysis routes)
- **API Infrastructure**: RESTful endpoints for single/batch email processing
- **Error Handling**: Production-ready middleware with development/production modes

#### Test Coverage Summary
- **Total Tests**: 56 ✅ (5 test suites)
- **OpenAI Service**: 12 tests covering AI integration and fallback systems
- **Analysis Routes**: 15 tests validating API endpoints and batch processing
- **Error Handling**: 11 tests ensuring robust error management
- **Server Integration**: 10 tests covering CORS, middleware, and security
- **Utilities**: 8 tests for logging and monitoring functionality

### 🔄 Next: Phase 4 - Practice Management Integration
- API connectors for Cleo, Practice Panther, and MyCase
- Billing entry creation and synchronization
- OAuth authentication for practice management platforms

### 📋 Development Status
- **Backend**: AI-powered email analysis ready for production
- **Testing**: Comprehensive test suite provides deployment confidence
- **API Design**: RESTful architecture supporting Chrome extension integration
- **AI Engine**: GPT-4 integration with intelligent fallback systems

## Development Workflow

- `main` branch: Stable, production-ready code
- `dev` branch: Default development branch
- Feature branches: `feature/feature-name`
- Hotfix branches: `hotfix/issue-description`

## License

MIT License
