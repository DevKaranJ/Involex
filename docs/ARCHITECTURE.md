# Chrome Extension Architecture

## System Overview

Involex is designed as a Chrome extension with cloud backend architecture:

```
┌─────────────────────────────────────────────────────────────┐
│                    Chrome Browser                           │
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │   Popup     │  │   Options   │  │    Content Script   │ │
│  │    UI       │  │   Settings  │  │   (Gmail/Outlook)   │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
│           │               │                    │           │
│           └───────────────┼────────────────────┘           │
│                           │                                │
│              ┌─────────────────────────────────┐           │
│              │      Service Worker             │           │
│              │   (Background Processing)       │           │
│              └─────────────────────────────────┘           │
└─────────────────────────┼───────────────────────────────────┘
                          │ Chrome APIs
                          │
          ┌───────────────┴───────────────┐
          │         Cloud Backend         │
          │                               │
          │  ┌─────────────────────────┐  │
          │  │      AI Engine          │  │
          │  │   (Email Analysis)      │  │
          │  └─────────────────────────┘  │
          │              │                │
          │  ┌─────────────────────────┐  │
          │  │    API Gateway          │  │
          │  │  (Authentication)       │  │
          │  └─────────────────────────┘  │
          │              │                │
          │  ┌─────────────────────────┐  │
          │  │     Database            │  │
          │  │   (User Data/Logs)      │  │
          │  └─────────────────────────┘  │
          └───────────────┬───────────────┘
                          │
     ┌────────────────────┼────────────────────┐
     │                   │                    │
┌─────────┐     ┌──────────────┐     ┌─────────────┐
│ Gmail   │     │   Practice   │     │   OpenAI    │
│  API    │     │ Management   │     │     API     │
│         │     │ Systems API  │     │             │
└─────────┘     └──────────────┘     └─────────────┘
```

## Component Details

### Chrome Extension Components

#### Content Scripts
- **Gmail Integration**: Inject UI elements into Gmail interface
- **Outlook Integration**: Monitor Outlook Web App for email activities
- **Email Parser**: Extract email metadata, participants, and content
- **UI Injector**: Add billing buttons and time estimation widgets

#### Service Worker (Background Script)
- **Email Monitor**: Listen for email events and triggers
- **AI Processing**: Coordinate with cloud backend for email analysis
- **Data Sync**: Manage offline storage and cloud synchronization
- **Notifications**: Smart alerts for billing opportunities

#### Popup Interface
- **Quick Actions**: Review pending billable entries
- **Time Adjustment**: Edit AI-suggested time estimates
- **Client Selection**: Assign emails to clients/matters
- **Settings Access**: Quick access to preferences

#### Options Page
- **Account Setup**: Connect practice management platforms
- **Billing Preferences**: Default rates, rounding rules, descriptions
- **AI Settings**: Customize analysis sensitivity and categories
- **Privacy Controls**: Data retention and sharing preferences

### Cloud Backend Components

#### API Gateway (Node.js/Express)
- **Authentication**: OAuth 2.0 and JWT token management
- **Rate Limiting**: Protect against abuse and manage costs
- **Request Routing**: Direct requests to appropriate services
- **Data Validation**: Ensure data integrity and security

#### AI Engine (Node.js)
- **Email Classification**: Determine if email contains billable work
- **Time Estimation**: Predict billable hours based on content analysis
- **Client/Matter Detection**: Identify relevant clients and matters
- **Description Generation**: Create professional billing descriptions

#### Practice Management Integration
- **Cleo API**: Direct integration for automated entry creation
- **Practice Panther API**: Sync billing data and client information
- **My Case API**: Real-time billing entry submission
- **Universal Adapter**: Standardized interface for multiple platforms

## Security Considerations

- End-to-end encryption for sensitive data
- OAuth 2.0 for email access
- JWT tokens for API authentication
- GDPR and HIPAA compliance measures
- Regular security audits
