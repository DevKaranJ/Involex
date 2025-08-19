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

## Development Workflow

- `main` branch: Stable, production-ready code
- `dev` branch: Default development branch
- Feature branches: `feature/feature-name`
- Hotfix branches: `hotfix/issue-description`

## License

MIT License
