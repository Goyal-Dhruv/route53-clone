# Route 53 Clone

A functional clone of the **AWS Route 53** console — mocked authentication, full CRUD for **Hosted Zones** and **DNS Records**, search, filters, pagination, modals, and notifications — built to feel like the real Route 53 console rather than a generic CRUD app.

> **Note:** This recreates the Route 53 *experience* and workflows. It does not perform real DNS resolution.

- **Frontend:** Next.js 14 (App Router, TypeScript) + [AWS Cloudscape Design System](https://cloudscape.design/) (the same component library the real AWS console uses, which is what gives it the authentic look and feel)
- **Backend:** FastAPI (Python)
- **Database:** SQLite (via SQLAlchemy)

---

## Features

**Core**
- Mocked auth: login, logout, session persistence (any email + password works)
- Hosted Zones — view, search, create, edit (description), delete, with validation
- DNS Records — view, search, filter by type, create, edit, delete
- Record types: `A`, `AAAA`, `CNAME`, `TXT`, `MX`, `NS`, `PTR`, `SRV`, `CAA` (+ managed `SOA`)
- Route 53 behaviours reproduced faithfully:
  - New zones auto-create default `NS` (4 AWS-style name servers) and `SOA` records
  - Default `NS`/`SOA` records can't be deleted; zones with other records can't be deleted (`HostedZoneNotEmpty`)
  - `CNAME` not permitted at the zone apex; per-type value validation (valid IPv4/IPv6, MX priority, SRV format, etc.)
- Tables, forms, search, type filters, pagination, modals, and Flashbar notifications throughout
- Placeholder "Coming soon" pages: Dashboard (with live stats), Health checks, Traffic policies, Resolver, Profiles

**Bonus (implemented)**
- Export a hosted zone as **JSON** or a **BIND** zone file
- **Dark mode** (persisted)
- **Keyboard shortcuts** — `z` hosted zones, `h` dashboard, `m` toggle theme
- **Bulk delete** records (multi-select, default records auto-skipped)

---

## Setup

**Prerequisites:** Node.js 18+ and Python 3.10+.

### Quick start (both servers)

```bash
./dev.sh
```

Then open <http://localhost:3000>. Sign in with any email + password.

### Manual start

**Backend** (`http://localhost:8000`):

```bash
cd backend
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Interactive API docs are available at <http://localhost:8000/docs>. On first run the DB is created and seeded with a sample `example.com` hosted zone.

**Frontend** (`http://localhost:3000`):

```bash
cd frontend
npm install
echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > .env.local
npm run dev
```

### Tests

```bash
cd backend && python smoke_test.py   # end-to-end API smoke test
```

---

## Architecture overview

```
┌─────────────────────────┐         HTTP / JSON          ┌──────────────────────────┐
│   Next.js frontend       │   (Bearer token in header)   │     FastAPI backend       │
│                          │ ───────────────────────────▶ │                           │
│  • App Router pages      │                              │  • /api/auth              │
│  • Cloudscape components  │ ◀─────────────────────────── │  • /api/zones             │
│  • lib/api.ts fetch layer │         JSON responses       │  • /api/zones/{id}/records│
└─────────────────────────┘                              │           │               │
                                                          │   SQLAlchemy ORM          │
                                                          │           ▼               │
                                                          │      SQLite (route53.db)  │
                                                          └──────────────────────────┘
```

**Backend layout**

| File | Responsibility |
|------|----------------|
| `app/main.py` | FastAPI app, CORS, router wiring, startup (create tables + seed) |
| `app/database.py` | SQLAlchemy engine, session, `get_db` dependency |
| `app/models.py` | ORM models: `User`, `SessionToken`, `HostedZone`, `DnsRecord` |
| `app/schemas.py` | Pydantic request models + domain validation |
| `app/services.py` | Zone/record helpers, default NS+SOA creation, serializers |
| `app/auth.py` | Bearer-token `get_current_user` dependency |
| `app/routers/` | `auth.py`, `zones.py`, `records.py` route handlers |
| `app/seed.py` | Seeds a sample zone on first boot |

**Auth model.** Login accepts any email/password (a `User` is created on first sign-in), issues an opaque session token stored in `sessions`, and the frontend keeps it in `localStorage` and sends it as `Authorization: Bearer <token>`. Logout deletes the token server-side. All zone/record endpoints require a valid token.

**Frontend layout.** `components/Shell.tsx` is the console frame (top nav, side nav, breadcrumbs, notifications, auth guard, dark mode, shortcuts). `lib/api.ts` centralises fetch, token handling, and 401 → redirect. Pages live under `app/` following the App Router.

---

## Database schema

**users**

| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER | PK |
| email | TEXT | unique |
| name | TEXT | derived from email |
| created_at | DATETIME | |

**sessions**

| Column | Type | Notes |
|--------|------|-------|
| token | TEXT | PK (opaque bearer token) |
| user_id | INTEGER | FK → users.id |
| created_at | DATETIME | |

**hosted_zones**

| Column | Type | Notes |
|--------|------|-------|
| id | TEXT | PK, Route 53-style ID (e.g. `Z1A2B3...`) |
| name | TEXT | stored as FQDN with trailing dot, e.g. `example.com.` |
| type | TEXT | `public` \| `private` |
| comment | TEXT | description |
| created_at | DATETIME | |

**dns_records**

| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER | PK |
| zone_id | TEXT | FK → hosted_zones.id (cascade delete) |
| name | TEXT | FQDN, e.g. `www.example.com.` |
| type | TEXT | A, AAAA, CNAME, TXT, MX, NS, PTR, SRV, CAA, SOA |
| ttl | INTEGER | seconds |
| values | TEXT | newline-separated (supports multi-value records) |
| is_default | BOOLEAN | true for zone-created NS/SOA (protected) |
| created_at / updated_at | DATETIME | |

---

## API overview

All `/api/zones*` endpoints require `Authorization: Bearer <token>`.

**Auth**

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/login` | `{email, password}` → `{token, user}` |
| GET | `/api/auth/me` | Current user |
| POST | `/api/auth/logout` | Invalidate session |

**Hosted zones**

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/zones` | List — `?search=&type=&page=&page_size=` |
| POST | `/api/zones` | Create — `{name, type, comment}` (auto-creates NS + SOA) |
| GET | `/api/zones/{id}` | Get one (incl. name servers) |
| PATCH | `/api/zones/{id}` | Update description |
| DELETE | `/api/zones/{id}` | Delete (blocked if non-default records exist) |
| GET | `/api/zones/{id}/export?format=json\|bind` | Export zone |

**DNS records**

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/zones/{id}/records` | List — `?search=&type=&page=&page_size=` |
| POST | `/api/zones/{id}/records` | Create — `{name, type, ttl, values[]}` |
| PUT | `/api/zones/{id}/records/{rid}` | Update |
| DELETE | `/api/zones/{id}/records/{rid}` | Delete (default records protected) |
| POST | `/api/zones/{id}/records/bulk-delete` | `{ids[]}` → bulk delete |

---

## Deployment notes

- **Backend** (Render / Railway / Fly.io): start command `uvicorn app.main:app --host 0.0.0.0 --port $PORT`. SQLite works for a demo; mount a persistent disk so the DB survives restarts.
- **Frontend** (Vercel): set env var `NEXT_PUBLIC_API_URL` to the deployed backend URL, then `npm run build`.
- CORS is currently open (`*`) for demo convenience — restrict `allow_origins` to your frontend origin in production.

## Tech decisions

- **Cloudscape** was chosen deliberately: it's AWS's real open-source console design system, so the tables, forms, modals, breadcrumbs, and Flashbar match Route 53 pixel-for-pixel without hand-rolling CSS.
- Records store values as newline-separated text to keep a single flexible column that supports multi-value record sets across every type.
- Domain names are normalised to FQDNs (trailing dot) on write, matching how Route 53 stores and displays them.
