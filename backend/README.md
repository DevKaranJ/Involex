# Involex Backend API

AI-powered legal billing backend for the Involex Chrome extension.

## Features

- **AI Email Analysis**: OpenAI-powered email content analysis for legal billing
- **User Authentication**: JWT-based authentication system
- **Billing Management**: Create, manage, and track billing entries
- **Practice Management Integration**: Connect with Cleo, Practice Panther, My Case
- **Real-time Processing**: WebSocket support for real-time analysis updates
- **Security**: Rate limiting, CORS protection, input validation

## Tech Stack

- **Framework**: Express.js with TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **AI**: OpenAI GPT-4 API
- **Authentication**: JWT tokens with bcrypt
- **Logging**: Winston logger
- **Security**: Helmet, CORS, rate limiting

## Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL database
- OpenAI API key

### Installation

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your configurations

# Set up database
npx prisma migrate dev
npx prisma generate

# Start development server
npm run dev
```

### Environment Variables

```env
# Server
PORT=3001
NODE_ENV=development

# Database
DATABASE_URL="postgresql://username:password@localhost:5432/involex_db"

# JWT
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=24h

# OpenAI
OPENAI_API_KEY=your-openai-api-key
OPENAI_MODEL=gpt-4
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register user
- `POST /api/auth/login` - User login
- `POST /api/auth/refresh` - Refresh JWT token

### Email Analysis
- `POST /api/analysis/email` - Analyze single email
- `POST /api/analysis/batch` - Analyze multiple emails
- `GET /api/analysis/history` - Get analysis history

### Billing
- `POST /api/billing/entries` - Create billing entry
- `GET /api/billing/entries` - Get billing entries
- `PUT /api/billing/entries/:id` - Update billing entry
- `DELETE /api/billing/entries/:id` - Delete billing entry

### Health Check
- `GET /health` - Service health status

## Development Commands

```bash
# Development with hot reload
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run tests
npm test

# Database operations
npm run migrate    # Run migrations
npm run generate   # Generate Prisma client
npm run studio     # Open Prisma Studio
```

## Project Structure

```
backend/
├── src/
│   ├── controllers/     # Request handlers
│   ├── middleware/      # Express middleware
│   ├── routes/         # API routes
│   ├── services/       # Business logic
│   ├── utils/          # Utilities
│   └── server.ts       # Main server file
├── prisma/
│   └── schema.prisma   # Database schema
├── logs/               # Application logs
└── dist/               # Compiled JavaScript
```

## Security Features

- **Rate Limiting**: 100 requests per minute per IP
- **CORS**: Configured for Chrome extension origins
- **Input Validation**: Zod schema validation
- **JWT Authentication**: Secure token-based auth
- **Password Hashing**: bcrypt with salt rounds
- **Request Logging**: Comprehensive audit trail

## Integration with Chrome Extension

The backend is designed to work seamlessly with the Involex Chrome extension:

1. **Email Analysis**: Extension sends email data for AI analysis
2. **Real-time Updates**: WebSocket connections for instant feedback
3. **Billing Sync**: Automatic billing entry creation from analyzed emails
4. **Practice Management**: Sync billing data with law firm software

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

MIT License - see LICENSE file for details
