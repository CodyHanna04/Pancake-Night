# 🥞 Pancake Night

Order management for Phi Mu Delta's weekly Pancake Night: guests place orders
from their phones, the kitchen works them on a live display, and admins get
analytics and a leaderboard.

Built with Next.js (App Router), Firebase Auth + Firestore, deployed on Vercel.

## Pages

| Route | Who | What |
|---|---|---|
| `/` | Admin | Home board — all active orders (Pending → Done), remove when picked up |
| `/kitchen-display` | Admin | Kitchen view — mark orders Cooking / Delayed / Done |
| `/order-submission` | Admin | Ring up orders at the table (no cooldown) |
| `/admin` | Admin | Weekly analytics + guest-ordering settings (day, hours, on/off) |
| `/guest` | Signed-in guest | Place an order (15-min cooldown, only during the ordering window) |
| `/leaderboard` | Signed-in | All-time leaderboard (1 order = 2 pancakes) |
| `/login`, `/signup` | Public | Auth |

## How access control works

Three layers, all keyed off a single source of truth — the `admin` **custom
claim** on the Firebase auth token:

1. **Middleware** (`src/middleware.js`) — verifies the `__session` cookie
   (minted by `/api/sessionLogin`, admins only) before admin pages render.
2. **Client guards** (`RequireAdmin` / `RequireAuth`) — UX-level redirects.
3. **Firestore rules** (`firestore.rules`) — the real enforcement. Order
   writes are admin-only from the client; guest orders go through
   `/api/orders`, which validates the ordering window, enabled flag, and
   15-minute cooldown with the Admin SDK.

## Order lifecycle

`Pending → Cooking (→ Delayed) → Done → completed`

- **Done** (kitchen): food is ready; `completedAt` is stamped (used for
  average-wait analytics).
- **completed** (home board "Remove"): picked up; order leaves the board and
  counts toward the leaderboard (Done orders count too).

Statuses and the pancake menu live in `src/lib/constants.js`.

## Setup

```bash
npm install
cp .env.example .env.local   # then fill it in (see below)
npm run dev
```

### Environment variables

See `.env.example`. Two groups:

- `NEXT_PUBLIC_FIREBASE_*` — public client config (Console → Project settings → General).
- `NEXT_FIREBASE_*` — **secret** Admin SDK credentials (Console → Project
  settings → Service accounts → Generate new private key). Needed for the
  middleware, `/api/sessionLogin`, `/api/orders`, and the admin script.

Add both groups to Vercel for deployments.

### Granting admin

Admin is a custom claim, not a database field:

```bash
npm run set-admin -- someone@example.com          # grant
npm run set-admin -- someone@example.com --revoke # revoke
```

The user must sign out and back in afterward.

### Deploying Firestore rules & indexes

```bash
npm run deploy:rules
npm run deploy:indexes
```

No Firebase CLI needed — the scripts call the Firebase REST APIs with the
Admin SDK credentials from `.env.local`. Rules and indexes are
version-controlled in `firestore.rules` and `firestore.indexes.json` — edit
there, then deploy. (Note: the default service account can deploy rules but
may lack permission to create *new* indexes; create those from the error link
Firestore prints, or in the Console.)
