# **Communiqué**

A full-stack web platform for creating, sharing, and managing email message templates for political advocacy and outreach.

*Let the collective voice rise.*

## Tech Stack

- **Frontend**: SvelteKit + TypeScript + Tailwind CSS
- **Backend**: SvelteKit API routes
- **Database**: CockroachDB + Prisma ORM
- **Authentication**: Lucia (basic setup)

## Development Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Set Environment Variables
Create a `.env` file in the root directory with your CockroachDB connection string:
```bash
DATABASE_URL="your_cockroachdb_connection_string"
```

### 3. Generate Prisma Client
```bash
npm run db:generate
```

### 4. Push Database Schema
```bash
npm run db:push
```

### 5. Seed Database (Optional)
Populate the database with sample templates:
```bash
npm run db:seed
```

### 6. Start Development Server
```bash
npm run dev
```

The app will be available at `http://localhost:5173`

## Database Commands

- `npm run db:generate` - Generate Prisma client
- `npm run db:push` - Push schema changes to database
- `npm run db:migrate` - Run database migrations
- `npm run db:studio` - Open Prisma Studio (database GUI)
- `npm run db:seed` - Seed database with sample templates

## API Endpoints

- `GET /api/templates` - Fetch all templates
- `POST /api/templates` - Create new template
- `GET /api/templates/[id]` - Get specific template
- `PUT /api/templates/[id]` - Update template
- `DELETE /api/templates/[id]` - Delete template

## Current Features

- ✅ Template browsing and filtering by channel type
- ✅ Template creation with multi-step wizard
- ✅ Full CRUD operations via REST API
- ✅ Database persistence with CockroachDB
- ✅ Responsive design with mobile support
- ✅ Real-time template preview
- ✅ Basic authentication system (Lucia)

## Next Steps

- [ ] User authentication integration with templates
- [ ] Email sending functionality
- [ ] Campaign analytics and metrics
- [ ] Template sharing and collaboration
- [ ] Enhanced filtering and search
- [ ] Template categorization and tagging
- [ ] Bulk operations

## 📚 Documentation

See **[docs/](./docs/)** for complete documentation.

## Building for Production

To create a production build:

```bash
npm run build
```

Preview the production build:

```bash
npm run preview
```
