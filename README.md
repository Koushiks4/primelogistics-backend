# Prime Logistics — Backend API

Fastify REST API powering the Prime Logistics admin portal and landing page.

## Tech Stack

- **Runtime:** Node.js (ES2022)
- **Framework:** Fastify 5
- **Language:** TypeScript 5
- **Database:** Supabase (PostgreSQL)
- **Cache:** Upstash Redis
- **Validation:** Zod
- **PDF:** PDFKit
- **Testing:** Vitest

## Prerequisites

- Node.js >= 18
- A [Supabase](https://supabase.com) project
- An [Upstash Redis](https://upstash.com) database
- (Optional) [Resend](https://resend.com) account for email notifications
- (Optional) [Twilio](https://twilio.com) account for WhatsApp notifications

## Setup

### 1. Install dependencies

```bash
cd backend
npm install
```

### 2. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | No | Server port (default: `3001`) |
| `HOST` | No | Server host (default: `0.0.0.0`) |
| `LOG_LEVEL` | No | Pino log level (default: `info`) |
| `SUPABASE_URL` | **Yes** | Your Supabase project URL |
| `SUPABASE_ANON_KEY` | No | Supabase anon/public key (unused by backend, but available) |
| `SUPABASE_SERVICE_ROLE_KEY` | **Yes** | Supabase service role key — grants full database access |
| `UPSTASH_REDIS_REST_URL` | **Yes** | Upstash Redis REST URL |
| `UPSTASH_REDIS_REST_TOKEN` | **Yes** | Upstash Redis REST token |
| `CORS_ORIGINS` | No | Comma-separated allowed origins (default: `http://localhost:3000`) |
| `RESEND_API_KEY` | No | Resend API key for email notifications |
| `NOTIFICATION_FROM_EMAIL` | No | Sender email address (default: `noreply@primelogisticservice.com`) |
| `ADMIN_NOTIFICATION_EMAIL` | No | Email that receives new lead notifications |
| `TWILIO_ACCOUNT_SID` | No | Twilio account SID for WhatsApp |
| `TWILIO_AUTH_TOKEN` | No | Twilio auth token |
| `TWILIO_WHATSAPP_FROM` | No | Twilio WhatsApp sender number (e.g., `whatsapp:+14155238886`) |
| `TRACKING_BASE_URL` | No | Base URL for tracking links sent in notifications |

**Note:** Notification env vars are optional. If not set, notifications will be logged as failed but won't block order/lead/invoice operations.

### 3. Set up the database

Run the SQL migration in your Supabase project:

1. Go to your Supabase dashboard → **SQL Editor**
2. Open `supabase/migrations/001_initial_schema.sql`
3. Paste the contents and click **Run**

This creates all tables, enums, indexes, triggers, and functions.

**What gets created:**

| Table | Purpose |
|-------|---------|
| `profiles` | User profiles linked to Supabase Auth |
| `orders` | Shipment orders with sender/receiver details |
| `order_status_history` | Audit trail of status changes |
| `leads` | Leads from manual entry and landing page forms |
| `invoices` | Standalone invoices |
| `invoice_items` | Invoice line items |
| `awb_counter` | Sequential AWB number generator |
| `invoice_counter` | Sequential invoice number generator |
| `notification_logs` | Email/WhatsApp notification audit log |

### 4. Create the first admin user

In the Supabase dashboard → **Authentication** → **Users** → **Add user**:

- Enter an email and password
- The `handle_new_user` trigger automatically creates a profile with `role: staff`

Then promote to admin via **SQL Editor**:

```sql
UPDATE profiles SET role = 'admin' WHERE email = 'your-admin@example.com';
```

## Running

### Development

```bash
npm run dev
```

Starts the server with hot-reload on `http://localhost:3001`. Changes to any `.ts` file restart automatically.

### Production

```bash
npm run build
npm start
```

Compiles TypeScript to `dist/` and runs the compiled JavaScript.

### Verify it's working

```bash
curl http://localhost:3001/api/health
# {"status":"ok"}
```

## Testing

```bash
# Run all tests once
npm test

# Watch mode (re-runs on file changes)
npm run test:watch
```

Tests use Vitest with mocked Supabase and Redis clients — no external services required.

## API Reference

### Public Endpoints (no auth, rate limited)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/health` | Health check |
| `GET` | `/api/track/:awbNumber` | Track shipment by company AWB or partner AWB |
| `POST` | `/api/auth/login` | Login with email/password |
| `POST` | `/api/auth/refresh` | Refresh access token |
| `POST` | `/api/forms/contact-us` | Submit contact form (creates lead) |
| `POST` | `/api/forms/shipment-enquiry` | Submit shipment enquiry (creates lead) |
| `POST` | `/api/forms/franchise-request` | Submit franchise request (creates lead) |

### Admin + Staff Endpoints (auth required)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/admin/orders` | List orders (filterable by status, type, date, search) |
| `GET` | `/api/admin/orders/:id` | Get order with status history |
| `POST` | `/api/admin/orders` | Create order (auto-generates AWB or accepts manual) |
| `PUT` | `/api/admin/orders/:id` | Update order details |
| `POST` | `/api/admin/orders/:id/status` | Add status update (location, remarks) |
| `DELETE` | `/api/admin/orders/:id` | Soft delete order |
| `GET` | `/api/admin/leads` | List leads (filterable by source, status, date) |
| `GET` | `/api/admin/leads/:id` | Get lead details |
| `POST` | `/api/admin/leads` | Create lead manually |
| `PUT` | `/api/admin/leads/:id` | Update lead (status, notes, assignment) |
| `DELETE` | `/api/admin/leads/:id` | Delete lead |
| `GET` | `/api/admin/dashboard/stats` | Dashboard metrics (revenue hidden from staff) |

### Admin-Only Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/admin/invoices` | List invoices |
| `GET` | `/api/admin/invoices/:id` | Get invoice with line items |
| `POST` | `/api/admin/invoices` | Create invoice |
| `PUT` | `/api/admin/invoices/:id` | Update invoice |
| `POST` | `/api/admin/invoices/:id/items` | Add line item |
| `GET` | `/api/admin/invoices/:id/pdf` | Download invoice PDF |
| `DELETE` | `/api/admin/invoices/:id` | Delete invoice |
| `GET` | `/api/admin/users` | List all users |
| `POST` | `/api/admin/users` | Invite new user |
| `PUT` | `/api/admin/users/:id` | Update user role or active status |

### Authentication

All `/api/admin/*` endpoints require a Bearer token in the Authorization header:

```
Authorization: Bearer <supabase_access_token>
```

Get a token by calling `POST /api/auth/login`:

```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@example.com", "password": "your-password"}'
```

Response:

```json
{
  "access_token": "eyJ...",
  "refresh_token": "abc...",
  "expires_at": 1718236800,
  "user": {
    "id": "uuid",
    "email": "admin@example.com",
    "full_name": "Admin",
    "role": "admin"
  }
}
```

### Example: Create an Order

```bash
curl -X POST http://localhost:3001/api/admin/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "shipment_type": "domestic",
    "sender_name": "John Doe",
    "sender_phone": "+919999999999",
    "sender_address": "123 MG Road, Bangalore",
    "receiver_name": "Jane Smith",
    "receiver_phone": "+918888888888",
    "receiver_email": "jane@example.com",
    "receiver_address": "456 Marine Drive, Mumbai",
    "origin_city": "Bangalore",
    "destination_city": "Mumbai",
    "weight": 2.5,
    "partner_name": "Delhivery",
    "partner_awb_number": "DLV-12345"
  }'
```

## Project Structure

```
backend/
├── src/
│   ├── server.ts                     # Entry point
│   ├── app.ts                        # Fastify app builder
│   ├── types.ts                      # Shared types and enums
│   ├── plugins/
│   │   ├── supabase.ts               # Supabase client
│   │   ├── redis.ts                  # Upstash Redis client
│   │   ├── cors.ts                   # CORS configuration
│   │   ├── auth.ts                   # JWT auth + role-based access
│   │   └── rate-limit.ts             # Redis rate limiting
│   └── modules/
│       ├── auth/                     # Login, token refresh
│       ├── orders/                   # Order CRUD + AWB + status
│       ├── leads/                    # Lead management
│       ├── forms/                    # Public form submissions
│       ├── tracking/                 # Public shipment tracking
│       ├── invoices/                 # Invoice CRUD + PDF
│       ├── users/                    # User management (admin)
│       ├── dashboard/                # Aggregated stats
│       └── notifications/            # Email + WhatsApp adapters
├── tests/                            # Vitest test files
├── supabase/migrations/              # SQL migration files
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

## Deployment (Render)

1. Create a new **Web Service** on [Render](https://render.com)
2. Connect your repository
3. Configure:
   - **Build Command:** `cd backend && npm install && npm run build`
   - **Start Command:** `cd backend && npm start`
   - **Environment:** Node
4. Add all environment variables from the table above
5. Deploy
