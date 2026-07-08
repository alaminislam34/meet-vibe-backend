# Meet Vibe Backend - Instruction Manual & Developer Rules

Welcome to the **Meet Vibe Backend** project. This backend is structured using a **Domain-Driven (Modular) Architecture** in Express + TypeScript, designed for high security, scalability, and strict rule enforcement.

---

## 📋 Client Credentials Checklist
To fully deploy or run this backend in staging/production, the client must provide the following credentials. Copy these keys into your local `.env` file:

| Module | Env Variable | Description / Purpose |
| :--- | :--- | :--- |
| **Core Server** | `PORT` | Local server port (default `5000`) |
| | `NODE_ENV` | Environment context (`development`, `production`, `test`) |
| | `FRONTEND_URL` | Origin url of frontend Client (for CORS & Cookie security) |
| **Database** | `DATABASE_URL` | PostgreSQL connection string (credentials, host, port, DB name) |
| **Authentication** | `JWT_SECRET` | Secret key used to sign and verify JSON Web Tokens (min 8 chars) |
| | `JWT_EXPIRES_IN` | Session duration (default `7d`) |
| **Google OAuth** | `GOOGLE_CLIENT_ID` | Client ID from Google Cloud Console Developer Credentials |
| | `GOOGLE_CLIENT_SECRET` | Client Secret from Google Cloud Console Developer Credentials |
| | `GOOGLE_CALLBACK_URL` | Redirect callback endpoint on the backend |
| **Apple OAuth** | `APPLE_CLIENT_ID` | Apple Services ID (e.g. `com.meetvibe.service`) |
| | `APPLE_TEAM_ID` | 10-character Team ID from Apple Developer account |
| | `APPLE_KEY_ID` | 10-character Private Key ID from Apple Developer account |
| | `APPLE_PRIVATE_KEY` | Apple `.p8` private key file string contents |
| | `APPLE_CALLBACK_URL` | Apple redirect callback endpoint on the backend |
| **Identity Verification** | `AWS_ACCESS_KEY_ID` | IAM User access key with permissions for Amazon Rekognition |
| | `AWS_SECRET_ACCESS_KEY` | IAM User secret access key |
| | `AWS_REGION` | AWS region hosting S3 bucket and Rekognition (e.g. `us-east-1`) |
| | `AWS_S3_BUCKET_NAME` | S3 bucket name where Gov IDs and Face photos are uploaded |
| **Subscriptions & Payments**| `STRIPE_API_KEY` | Stripe secret api key (e.g. `sk_test_...` or `sk_live_...`) |
| | `STRIPE_WEBHOOK_SECRET` | Webhook signing secret from Stripe Dashboard |
| **Mailer Notification** | `SMTP_HOST` | SMTP server host (e.g. Mailtrap, Sendgrid, SES) |
| | `SMTP_PORT` | SMTP port (e.g., `2525`, `587`, or `465`) |
| | `SMTP_USER` | SMTP username credential |
| | `SMTP_PASS` | SMTP password credential |
| | `SMTP_FROM` | Verified sender address (e.g. `noreply@meetvibe.com`) |

---

## 🏗️ Folder Structure
The codebase follows a clean **feature-based modular structure** under `src/modules`:

```
meet-vibe-backend/
├── prisma/
│   └── schema/             # Merged Prisma schema (base, user, subscription, event, participation, connection, chat)
├── src/
│   ├── config/             # DB instances, validated environment config
│   ├── constants/          # Application enums and HTTP status codes
│   ├── middlewares/        # Authentication guards, global error handlers, rate limiters, Zod validators
│   ├── modules/            # Feature domains (encapsulating routes, controllers, and validation)
│   │   ├── auth/           # Login, register, Google/Apple OAuth redirects, logout, password resets
│   │   ├── user/           # User profile fetches, updates, and Gov ID / Face photo upload
│   │   ├── subscription/   # Purchase subscription plan, check active status
│   │   ├── event/          # 5-step draft event wizard, get events, delete
│   │   ├── participation/  # Join event, submit payment trans ID, owner approval/rejection
│   │   ├── connection/     # Connect with other participants, approve/reject requests
│   │   └── chat/           # Group chat, private messages, Socket.io real-time handlers
│   ├── routes/             # Aggregated routes (/api/v1 prefix mapping)
│   ├── utils/              # Cookie handling, custom app errors, JWT utilities, Multer uploader
│   ├── app.ts              # Express configuration
│   └── server.ts           # HTTP & Socket.io server entry point
├── views/                  # EJS template engine callback views
├── package.json
└── tsconfig.json
```

---

## 🔒 Security & Domain Enforcement Rules
The backend implements the following security protocols:

### 1. Authentication & Verification Flow
*   **HttpOnly Session Cookies:** Access JWTs are signed by the server and saved in a client cookie named `meet_vibe_token` with `httpOnly: true`, `secure: true` (in production), and `sameSite` limits. This mitigates XSS-based token theft.
*   **OAuth Redirects:** The frontend redirects authentication calls to `/auth/google` or `/auth/apple`. The backend interacts with the OAuth servers, creates/updates the User record, signs the JWT, sets the cookie, and uses `views/oauth-callback.ejs` to securely report success or error back to the frontend.
*   **Identity Check:** The user verification route `/user/verify-identity` accepts a multi-part file upload containing a `govId` and a `face` photo. The controller is pre-configured to check these files and update `is18Plus: true` and `isHuman: true`.

### 2. Subscription Constraints
*   Only users with an active subscription (verified via `Subscription.status === 'ACTIVE'` and `endDate > now`) can create or edit event drafts, or publish events. This constraint is verified by the `checkActiveSubscription` middleware inside the `event` controller.

### 3. 5-Step Event Creation Wizard
*   Events are saved with `status: 'DRAFT'` and a `creationStep` pointer (1 to 4) through the `POST /event/draft` endpoint.
*   The event remains in draft mode until step 5. The owner triggers `POST /event/publish/:id`. The server verifies that step 4 was completed, updates the status to `PUBLISHED`, and automatically initializes the corresponding group chat room (`ChatGroup`).

### 4. Manual Premium Payments & Event Registration
*   **Free Events:** When a user joins a free event (price = `0.0`), their status becomes `APPROVED` automatically.
*   **Premium Events:** When a user joins a premium event (price > `0.0`), their status is set to `PENDING_PAYMENT`.
*   **Payment Submission:** The user pays via bank transfer offline, and submits the transaction reference via `POST /participation/pay` with their `transactionId`. Their status updates to `PENDING_APPROVAL`.
*   **Host Validation:** The event host/creator views pending requests and calls `POST /participation/review` with `"APPROVED"` or `"REJECTED"` to admit or deny the participant.

### 5. Chat & Connections Social Rules
*   **Connection Prerequisite:** A user can only send a connection request to another user if they share at least one published event (either both are approved participants, or one is the host and the other is an approved participant).
*   **1-on-1 Chat Restriction:** Users can only send private direct messages to each other if they have an accepted connection in the database (`Connection.status === 'ACCEPTED'`).
*   **Group Chat Restriction:** Users can only join, view, or post in an event group chat if they are either the event host or an approved participant (`Participant.status === 'APPROVED'`).
*   **Double Layer Validation:** These permissions are checked both on standard HTTP REST API endpoints and during real-time WebSocket connection/event exchanges in the `Socket.io` handler (`chat.socket.ts`).

---

## ⚡ Developer Setup & commands

### 1. Install dependencies
```bash
pnpm install
```

### 2. Database Migration & client Generation
Ensure database URL is configured in `.env`, then run:
```bash
# Push schema structure directly (development testing)
npx prisma db push

# Generate Prisma Client classes
pnpm prisma generate
```

### 3. Start Development Server (hot reloading)
```bash
pnpm run dev
```

### 4. Build for Production
```bash
pnpm run build
```
