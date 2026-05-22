# Schedule & Route Management API

Base URL: `/api/v1`

Auth: Bearer token (admin / dispatch manager for writes; drivers & team leads for read).

## Stores

### POST /stores
```json
{
  "storeName": "Walmart Downtown",
  "city": "Austin",
  "state": "TX",
  "address": "123 Main St"
}
```
Response: `storeId` auto-generated (e.g. `WALMARTDOW-0001`).

### GET /stores?city=Austin&state=TX&search=walmart&page=1&limit=50

---

## Schedules

### POST /schedules
```json
{
  "date": "2026-06-01",
  "city": "Austin",
  "state": "TX",
  "storeId": "<mongoId>"
}
```
Or inline store:
```json
{
  "date": "2026-06-01",
  "city": "Austin",
  "state": "TX",
  "store": { "storeName": "New Store", "city": "Austin", "state": "TX" }
}
```

Schedule statuses: `draft` | `pending` (published, awaiting driver acceptance) | `active` (all routes accepted) | `completed` | `cancelled`

### GET /schedules?date=2026-06-01&city=Austin&state=TX&storeId=<mongoId>&status=pending

Query params: `date`, `city` (case-insensitive), `state`, `storeId`, `status`, `page`, `limit`.

List items include embedded `store` and accurate `routeCount` (routes are not embedded in list).

### GET /schedules/:id — includes `routes[]`

### PUT /schedules/:id

### DELETE /schedules/:id — deletes all routes on schedule

---

## Availability

### GET /availability/teams?date=2026-06-01&arrivalTime=10:00&departureTime=14:00

### GET /availability/drivers/:teamId?date=2026-06-01&arrivalTime=10:00&departureTime=14:00

Optional: `excludeRouteId` when editing a route.

---

## Routes

### POST /routes
```json
{
  "scheduleId": "...",
  "teamId": "...",
  "driverId": "...",
  "arrivalTime": "10:00",
  "departureTime": "14:00",
  "notes": "optional"
}
```
When `driverId` is set, route stays **`pending`** until the driver accepts. Notification is a **route offer** (accept/decline in app).

Route statuses: `pending` (no driver, or offer sent) → `active` (driver accepted) → `in_progress` / `completed` / `cancelled`. Legacy `assigned` is treated like pending for offers.

### GET /routes — List routes (manager/dispatch)

Query: `date` (required, YYYY-MM-DD), optional `city`, `state`, `storeId`, `status`, `page`, `limit`.

Returns routes with team/driver enrichment and nested `schedule` (city, state, store).

### GET /routes/offers/pending — Driver only
Lists routes where `driverId` = current user and status is `pending` (or legacy `assigned`).

### POST /routes/:id/accept — Driver only
Driver accepts offer → status **`active`**.

### POST /routes/:id/decline — Driver only
Driver declines → `driverId` cleared, status stays **`pending`**.

### GET /routes/:id

### PUT /routes/:id
Managers cannot set status to `active` (driver must accept). Assigning/changing `driverId` sets status to **`pending`** and sends an offer notification.

### DELETE /routes/:id

---

## Notifications

### GET /notifications — current user's in-app notifications

---

## Overlap rules

Driver unavailable if another route on the **same date** has overlapping times (`pending`, `assigned`, `in_progress`).

Team unavailable if **all** drivers on the team are unavailable.

Adjacent times allowed (e.g. 10:00–14:00 then 14:00–18:00).
