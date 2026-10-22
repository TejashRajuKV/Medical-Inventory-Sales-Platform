# Medical Inventory Sales Platform

A full-stack pharmacy inventory and billing application built with React, Vite, Express, and SQLite. It tracks medicines and batches, prevents expired stock from being sold, records invoices, manages suppliers and purchase orders, and provides operational reports.

> This project uses deterministic, rule-based inventory/reorder calculations. No new AI service or API key is required for the workflows documented here.

## Features

- **Inventory:** medicine records, supplier associations, batch/expiry tracking, stock thresholds, and expired-stock visibility.
- **Billing:** authenticated sales, FEFO (first-expiry-first-out) batch deduction, transaction-based stock updates, invoice totals, and GST calculation.
- **Purchase orders:** supplier-linked orders, receipt validation, batch creation, and prevention of receiving expired or mismatched stock.
- **Returns and refunds:** return requests tied to original sale lines, quantity caps that account for pending/approved returns, owner review, and explicit stock-restock approval.
- **Stock adjustments:** whole-unit adjustments, mandatory reasons, prevention of negative inventory, and a record of the user making each adjustment.
- **Access control:** JWT authentication, owner-only administration/audit history, and owner/manager-only reorder approvals.
- **Audit history:** records selected inventory, sale, supplier, user, reorder, and return actions.
- **Reports:** period-based revenue/refund/cost summary and authenticated sales/inventory CSV exports.
- **Operational views:** sales history, alerts, low-stock/expiry visibility, and deterministic reorder suggestions.

## Technology

- Frontend: React 18, React Router, Vite
- Backend: Node.js (ES modules), Express 4
- Database: SQLite via better-sqlite3
- Authentication: JWT and bcryptjs
- Tests: Node.js built-in test runner (node:test)

## Repository layout

~~~text
backend/
  src/
    db/            schema, connection, setup and startup migrations
    middleware/    authentication and role checks
    routes/        medicines, sales, purchase orders, returns, reports, etc.
    services/      audit logging and alert service
  test/             backend workflow regression tests
frontend/
  src/
    api/            authenticated API client
    components/     shared navigation/layout
    pages/          dashboard, billing, medicines, suppliers, reports, etc.
~~~

## Requirements

- Node.js 20 or newer recommended
- npm
- A terminal for running the backend and frontend in separate processes

## Local setup

### 1. Configure the backend

~~~bash
cd backend
npm install
~~~

Create .env in the backend directory:

~~~dotenv
PORT=4000
JWT_SECRET=replace-with-a-long-random-secret
JWT_EXPIRES_IN=8h
OWNER_EMAIL=owner@pharma.com
OWNER_INITIAL_PASSWORD=replace-with-a-unique-password-at-least-12-characters
# Optional: choose a custom SQLite file path
# DATABASE_PATH=./src/db/pharma.db
~~~

Use a unique secret and password; do not commit .env or production credentials. The setup script no longer uses a hard-coded default owner password.

Initialize the database and sample catalogue:

~~~bash
npm run setup
~~~

The setup command creates the owner using OWNER_EMAIL and OWNER_INITIAL_PASSWORD, then adds sample suppliers, medicines, and batches. It will stop if a new owner must be created but a sufficiently long initial password is not configured.

Start the API:

~~~bash
npm run dev
~~~

The API listens on http://localhost:4000 by default. The database is stored at backend/src/db/pharma.db unless DATABASE_PATH is set.

### 2. Start the frontend

In a second terminal:

~~~bash
cd frontend
npm install
npm run dev
~~~

Open http://localhost:3000. Vite proxies /api requests to http://localhost:4000.

For a production frontend bundle, run npm run build from frontend.

## API overview

All routes below are prefixed with /api. Except login, endpoints require Authorization: Bearer <token>.

| Area | Routes | Notes |
|---|---|---|
| Authentication | POST /auth/login | Returns a JWT and user profile |
| Medicines | GET/POST /medicines, GET/PUT/DELETE /medicines/:id | Validates price, GST, threshold and supplier |
| Sales | GET/POST /sales, GET /sales/:id | Expired stock is excluded from sellable inventory |
| Purchase orders | GET/POST /purchase-orders, POST /purchase-orders/:id/receive | Validates each received batch |
| Returns | GET/POST /returns, POST /returns/:id/review | Owner reviews; restock is a separate explicit decision |
| Stock adjustments | GET/POST /stock-adjustments | Reason required; stock cannot become negative |
| Suppliers | GET/POST /suppliers, PUT/DELETE /suppliers/:id | Deletion is blocked when referenced by inventory/order history |
| Reorders | GET /reorders, POST /reorders, POST /reorders/:id/approve, POST /reorders/:id/reject | Approval/rejection restricted to owner or manager |
| Reports | GET /reports/summary?days=30, GET /reports/sales.csv, GET /reports/inventory.csv | CSV routes require a valid JWT |
| Audit history | GET /audit-logs?limit=50 | Owner-only |

## Returns and stock handling

1. Create a return request with the original sale_id, a reason, and sale line IDs/quantities.
2. The server verifies the requested quantity does not exceed the sold quantity minus pending/approved returns.
3. An owner approves or rejects the request.
4. Refund approval does not automatically make returned medicine sellable. Stock is added back only when the owner explicitly sets restock: true, and expired original batches are rejected.
5. Stock adjustments require a non-zero whole-number change and a reason. Every successful adjustment is logged.

**Operational note:** This is inventory software, not a payment processor. The refund endpoint records an approved refund amount; it does not send money to a payment gateway.

## Reports and profit calculation

The summary endpoint returns invoice count, gross revenue excluding GST, approved refunds (recorded including tax), net revenue excluding GST, captured cost of goods sold, estimated gross profit, sellable units, and expired units. Approved restocked returns reduce the estimated cost of goods. The estimate excludes operating expenses and other accounting adjustments. Historical rows created before cost snapshots were introduced may have a zero captured unit cost; treat those periods as incomplete until reconciled.

CSV exports include sales invoice summaries and medicine stock/price snapshots. They are authenticated API downloads; use the Reports page while signed in.

## Automated tests

Test cases are included under backend/test/inventory-workflows.test.js. They cover authentication, invalid medicine prices/GST, expired-stock billing protection, stock adjustments, purchase-order receipt validation, return quantity limits, role permissions, and report exports.

**The tests have been written but have not been run**, as requested. To run them yourself:

~~~bash
cd backend
npm test
~~~

The tests create a temporary SQLite database and do not use the development database. The test command requires backend dependencies to be installed first.

## Security and deployment notes

- Keep JWT_SECRET private and use a strong random value in every deployed environment.
- Set a unique OWNER_INITIAL_PASSWORD before first-time setup.
- Use HTTPS and restrict CORS to the frontend origin before public deployment; the current development server uses permissive CORS.
- Back up the SQLite database before upgrades or manual changes.
- Review permissions and test against a copy of production data before deploying. Automated tests are not a substitute for runtime verification.
- Database migrations are idempotent and run when the backend app loads; keep a backup before the first upgrade.

## Current limitations

- Purchase orders are currently received as batch lists; detailed purchase-order line/quantity commitments and supplier payment tracking are not yet implemented.
- Refunds are recorded in the platform but are not paid out automatically.
- CSV exports are simple operational exports rather than formal accounting statements.
