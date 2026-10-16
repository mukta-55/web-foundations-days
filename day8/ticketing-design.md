# TicketHub Design Document

TicketHub is a website that sells tickets for concerts and events. This document follows the six-step framework: requirements, estimates, API, data model, architecture, and trade-offs. It also explains how the design prevents two people from buying the same seat.

## 0. Context, goals and non-goals

**Context.** TicketHub has 2 million registered users. On a normal day, 50,000 of them visit. When a popular concert goes on sale, 200,000 people try to buy 20,000 seats in the first 10 minutes. The design has two hard problems: handling that sudden load, and never selling one seat twice.

**Goals**

- Sell each seat to at most one person, even at peak load.
- Stay available for browsing during a big sale.
- Serve people in the order they arrive during a big sale.

**Non-goals**

- Building our own payment system. We use an external payment provider and never store card numbers.
- Refunds, ticket resale, and seat recommendations.
- Protection against bots or one person using many accounts.
- Running in more than one region.

**Business rules assumed.** A hold lasts 5 minutes. A user can hold at most 6 seats at once.

---

## 1. Requirements

### Functional requirements (what the system must do)

1. Users can register and log in.
2. Users can browse events and see event details.
3. Users can see every seat of an event and whether it is available.
4. Users can hold seats for 5 minutes, and release a hold early.
5. Users can pay for held seats and receive tickets.
6. Users can view their own tickets.
7. For a high-demand sale, users join a waiting room and are admitted in order.

### Non-functional requirements (how well it must do it)

- **Correctness:** a seat is never sold to two people. This matters more than speed.
- **Fairness:** during a big sale, users enter the purchase flow in the order they joined the waiting room.
- **Speed (targets):** browsing pages respond in under 300 ms. A seat hold responds in under 1 second.
- **Availability (target):** 99.9%. Browsing and the seat map stay up during a big sale.
- **Durability:** a paid order is never lost.

---

## 2. Estimates

Assumptions: a day is rounded to 100,000 seconds, as in the course notes. Peak is 5 times the average, as in the course notes. A user makes 5 requests during a sale (event page, seat map, queue check, hold, pay). These assumptions are not measured and should be checked with a load test.

### Normal day

| Item                          | Calculation                                  | Result                    |
| ----------------------------- | -------------------------------------------- | ------------------------- |
| Page views                    | 50,000 visitors × 10 pages = 500,000 per day | 500,000 / day             |
| Average page views per second | 500,000 ÷ 100,000                            | 5 / s                     |
| Peak page views per second    | 5 × 5                                        | 25 / s                    |
| Ticket sales per second       | 5,000 ÷ 100,000                              | 0.05 / s (one every 20 s) |
| Reads per sale                | 5 ÷ 0.05                                     | 100 reads for every write |

### Big sale (200,000 people, 20,000 seats, 10 minutes = 600 seconds)

| Item                          | Calculation       | Result          |
| ----------------------------- | ----------------- | --------------- |
| Users arriving per second     | 200,000 ÷ 600     | about 333 / s   |
| Requests per second (average) | 200,000 × 5 ÷ 600 | about 1,667 / s |
| Requests per second (peak)    | 1,667 × 5         | about 8,300 / s |
| Maximum sales per second      | 20,000 ÷ 600      | about 33 / s    |
| Users who will not get a seat | 200,000 − 20,000  | 180,000 (90%)   |

### Comparison

|                               | Normal day | Big sale | Increase        |
| ----------------------------- | ---------- | -------- | --------------- |
| Requests per second (average) | 5          | 1,667    | about 333 times |
| Sales per second              | 0.05       | up to 33 | about 660 times |

### What the numbers tell us

- The big sale is hundreds of times busier than a normal day, so we design for the sale.
- The sale is read-heavy. Most requests ask for the seat map or the queue position, not for a purchase.
- 90% of users will be told no. The "sold out" answer must be cheap to give.
- Real purchases are only about 33 per second at most. The hard part is that many people want the same rows at the same moment, not the total number of writes.

---

## 3. API

All endpoints except 1 to 3 need a login token in the header `Authorization: Bearer <token>`. Seat ids are numbers from the `seats` table.

| #   | Method and path                  | Purpose                               | Success        | Errors                                                                    |
| --- | -------------------------------- | ------------------------------------- | -------------- | ------------------------------------------------------------------------- |
| 1   | `POST /users`                    | Create an account                     | 201 Created    | 400 invalid data, 409 email already used                                  |
| 2   | `POST /sessions`                 | Log in, returns a token               | 200 OK         | 401 wrong email or password                                               |
| 3   | `GET /events`                    | List events (paged)                   | 200 OK         | none expected                                                             |
| 4   | `GET /events/{eventId}`          | Event details                         | 200 OK         | 404 event not found                                                       |
| 5   | `GET /events/{eventId}/seats`    | Seat map with status of every seat    | 200 OK         | 404 event not found                                                       |
| 6   | `POST /events/{eventId}/queue`   | Join the waiting room                 | 202 Accepted   | 401 not logged in, 404 event not found                                    |
| 7   | `GET /events/{eventId}/queue/me` | My position and whether I am admitted | 200 OK         | 404 not in the queue                                                      |
| 8   | `POST /events/{eventId}/holds`   | Hold seats for 5 minutes              | 201 Created    | 401, 403 not admitted, 409 a seat is not available, 400 more than 6 seats |
| 9   | `DELETE /events/{eventId}/holds` | Release my holds                      | 204 No Content | 401                                                                       |
| 10  | `POST /orders`                   | Pay for held seats                    | 201 Created    | 401, 402 payment declined, 409 hold missing or expired                    |
| 11  | `GET /users/me/tickets`          | List my tickets                       | 200 OK         | 401                                                                       |

**Example: hold seats**

Request: `POST /events/7/holds`

```json
{ "seatIds": [101, 102] }
```

Response: `201 Created`

```json
{ "seatIds": [101, 102], "holdExpiresAt": "2026-10-20T18:05:00Z" }
```

If seat 102 is already taken, the response is `409 Conflict` and seat 101 is not held either.

**Example: pay**

Request: `POST /orders`

```json
{ "eventId": 7, "seatIds": [101, 102], "paymentToken": "tok_abc123" }
```

Response: `201 Created`

```json
{
  "orderId": 5521,
  "tickets": [
    { "ticketId": 9001, "seatId": 101 },
    { "ticketId": 9002, "seatId": 102 }
  ]
}
```

The seat map (endpoint 5) shows a seat as `available` when its hold has expired, even if the database row still says `held`.

---

## 4. Data model

The database is PostgreSQL. Money is stored as whole cents to avoid rounding errors.

```sql
CREATE TABLE users (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE events (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name          TEXT NOT NULL,
  venue         TEXT NOT NULL,
  starts_at     TIMESTAMPTZ NOT NULL,
  sale_opens_at TIMESTAMPTZ NOT NULL,
  high_demand   BOOLEAN NOT NULL DEFAULT false   -- true = use the waiting room
);

CREATE TABLE seats (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_id        BIGINT NOT NULL REFERENCES events(id),
  section         TEXT NOT NULL,
  row_label       TEXT NOT NULL,
  seat_number     INT  NOT NULL,
  price_cents     INT  NOT NULL CHECK (price_cents >= 0),
  status          TEXT NOT NULL DEFAULT 'available'
                  CHECK (status IN ('available', 'held', 'sold')),
  held_by         BIGINT REFERENCES users(id),
  hold_expires_at TIMESTAMPTZ,
  UNIQUE (event_id, section, row_label, seat_number),
  CHECK (status <> 'held' OR (held_by IS NOT NULL AND hold_expires_at IS NOT NULL))
);

CREATE TABLE orders (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id     BIGINT NOT NULL REFERENCES users(id),
  event_id    BIGINT NOT NULL REFERENCES events(id),
  total_cents INT  NOT NULL CHECK (total_cents >= 0),
  payment_ref TEXT NOT NULL,                  -- id from the payment provider
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE tickets (
  id        BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id  BIGINT NOT NULL REFERENCES orders(id),
  seat_id   BIGINT NOT NULL UNIQUE REFERENCES seats(id)   -- one ticket per seat, ever
);

CREATE INDEX idx_seats_event_status ON seats (event_id, status);
CREATE INDEX idx_orders_user        ON orders (user_id);
CREATE INDEX idx_tickets_order      ON tickets (order_id);
```

### Relationships

- One **user** has many **orders** (`orders.user_id`).
- One **event** has many **seats** (`seats.event_id`) and many **orders** (`orders.event_id`).
- One **order** has many **tickets** (`tickets.order_id`).
- One **seat** has at most one **ticket** (`tickets.seat_id` is `UNIQUE`).
- A held seat points to the user holding it (`seats.held_by`).

Seats and holds live in the same table. This lets one row answer "is this seat free?" and lets one update change it safely.

---

## 5. Architecture

```
  Browser
     |
     v
  [ CDN ]  <-- static files: HTML, CSS, JS, images
     |
     v
  [ Load balancer ]
     |
     v
  [ App server 1 ] [ App server 2 ] ... [ App server N ]   (stateless)
     |        |                 \
     |        |                  \--> [ Payment provider ] (external)
     |        v
     |   [ Redis ]  <-- seat map cache, event cache, waiting room
     |
     +--> writes: holds and orders --> [ PostgreSQL primary ]
     |                                        |
     +--> reads: browsing  <---- copies ---- [ Read replicas ]
```

Each component exists to solve one named problem.

| Component                   | Problem it solves                                                                                    | Notes                                                                                                                                                                                                                                                    |
| --------------------------- | ---------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **CDN**                     | Every visitor downloads the same files and images.                                                   | Serves static files from locations near users, so app servers do not handle them.                                                                                                                                                                        |
| **Load balancer**           | One server cannot handle about 8,300 requests per second, and it would be a single point of failure. | Spreads requests across servers and stops sending requests to a server that fails.                                                                                                                                                                       |
| **Stateless app servers**   | We need to add servers when traffic grows.                                                           | A server keeps no user data in its own memory. Login tokens, queue state and holds live in Redis or the database, so any server can handle any request.                                                                                                  |
| **Redis cache**             | The seat map is requested thousands of times per second and changes slowly.                          | The seat map is cached for about 2 seconds. Event details are cached longer. The cache is only for display; it never decides who gets a seat.                                                                                                            |
| **Waiting room (in Redis)** | 200,000 people arrive at once, and 90% cannot get a seat.                                            | Users join a Redis sorted set ordered by arrival time. The server admits users at a fixed rate (start with 50 per second, tune with a load test). This keeps hold attempts small and keeps the order fair. Only events with `high_demand = true` use it. |
| **PostgreSQL primary**      | Seat status and orders must be correct.                                                              | The only place where seats change and orders are written. Transactions and constraints live here.                                                                                                                                                        |
| **Read replicas**           | Browsing reads compete with writes, and a single database is a single point of failure.              | Serve event browsing. One replica can take over if the primary fails. Holds and purchases never use replicas, because replicas lag slightly.                                                                                                             |
| **Payment provider**        | We must not handle card numbers.                                                                     | The browser sends card data to the provider and receives a token. Our server sends the token with the charge request.                                                                                                                                    |

### How the design survives the big sale

1. The CDN absorbs file and image requests.
2. The waiting room accepts 200,000 users cheaply. It only stores a position, not a database row.
3. The seat map is served from Redis, so about 1,600 requests per second do not reach the database.
4. Only admitted users reach the hold step, so the database sees about 50 hold attempts per second instead of 333.
5. Each hold and purchase is a short database transaction, so locks are held for milliseconds.
6. When seats run out, the server marks the event sold out in Redis. Remaining users get an immediate "sold out" answer without touching the database.

---

## 6. How the design prevents two people from buying the same seat

The database is the only judge. The cache and the waiting room reduce load, but neither decides who owns a seat. There are three layers.

### Layer 1: hold with an atomic conditional update

The server runs this inside one transaction:

```sql
BEGIN;
UPDATE seats
SET    status = 'held', held_by = $user_id, hold_expires_at = now() + interval '5 minutes'
WHERE  event_id = $event_id
  AND  id = ANY($seat_ids)
  AND  (status = 'available' OR (status = 'held' AND hold_expires_at < now()));
-- If the number of updated rows is less than the number of requested seats: ROLLBACK and return 409.
-- Otherwise: COMMIT and return 201.
```

The check ("is it free?") and the change ("take it") happen in one statement, so nothing can slip in between them.

**Example.** Alice and Bob click the same seat at the same moment. PostgreSQL locks the row for the first update, say Alice's. Bob's update waits. When Alice commits, Bob's update re-checks the `WHERE` condition. The seat is now `held` with a future expiry, so the condition fails and zero rows are updated. The server sees that the count does not match, rolls back, and returns 409 to Bob.

**All or nothing.** If a user asks for 3 seats and one is taken, the transaction rolls back and none of the 3 are held.

### Layer 2: purchase re-checks the hold

```sql
BEGIN;
UPDATE seats
SET    status = 'sold', held_by = NULL, hold_expires_at = NULL
WHERE  event_id = $event_id
  AND  id = ANY($seat_ids)
  AND  status = 'held' AND held_by = $user_id AND hold_expires_at > now();
-- If the updated row count does not match: ROLLBACK and return 409.
INSERT INTO orders (user_id, event_id, total_cents, payment_ref) VALUES (...) RETURNING id;
INSERT INTO tickets (order_id, seat_id) VALUES (...);
COMMIT;
```

Only the user who holds the seat, with a hold that has not expired, can buy it. The order and tickets are created in the same transaction, so a ticket never exists without its order.

The payment is charged before this transaction. The database transaction is never kept open while waiting for the payment provider.

### Layer 3: unique constraint as the last defence

`tickets.seat_id` is `UNIQUE`. If a bug in the code ever tried to create two tickets for one seat, the database would reject the second insert and the transaction would fail. Correctness does not depend on the application code being perfect.

---

## 7. Bottlenecks and trade-offs

### What breaks first

1. **Seat map reads** (about 8,300 requests per second at peak). Fixed by the Redis cache.
2. **Many hold attempts on the same rows.** Row locks make these wait in line. The waiting room limits how many attempts arrive at once.
3. **A slow payment provider.** Fixed by not keeping database transactions open during payment.
4. **Redis going down.** The waiting room and seat map cache would stop working. Seat correctness is not affected, because it depends only on PostgreSQL.

### Trade-off 1: a cached seat map can be out of date

- **Chosen:** cache the seat map for about 2 seconds.
- **Gain:** the database does not serve thousands of seat map reads per second.
- **Cost:** a user may click a seat that looks free but was just taken, and then receives 409. This is acceptable because the hold step checks the database. The user sees a clear message and picks another seat.

### Trade-off 2: waiting room instead of letting everyone in

- **Chosen:** admit users in order at a fixed rate.
- **Gain:** the database and app servers stay inside a load they can handle, and the order is fair.
- **Cost:** most users wait, and 180,000 of 200,000 end with no ticket. The queue does not create this limit, because there are only 20,000 seats. It only makes the wait visible and the order fair.

### Trade-off 3: 5-minute holds

- **Chosen:** hold seats for 5 minutes.
- **Gain:** buyers have time to enter payment details without losing the seat.
- **Cost:** a user who never pays blocks seats for 5 minutes. A shorter hold frees seats faster but increases failed payments. The 5 minutes is a business rule that can be tuned.

### Trade-off 4: one primary database for writes

- **Chosen:** a single PostgreSQL primary with read replicas.
- **Gain:** simple, and transactions and constraints give strong correctness.
- **Cost:** all writes go through one machine. At up to 33 sales per second and about 50 holds per second, one primary should be enough (to be confirmed by a load test). If TicketHub grew far beyond this, we would split events across several databases.

---

## 8. Alternatives considered

| Alternative                                                             | Why it was not chosen                                                                                                         |
| ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Lock seats with a Redis lock instead of the database                    | It creates a second source of truth. If Redis loses data, two people could get the same seat. The database gives a guarantee. |
| Check if the seat is free with `SELECT`, then `UPDATE` in a second step | Two users can pass the check at the same moment (a race condition). The conditional `UPDATE` avoids this.                     |
| Charge payment first, assign the seat afterwards                        | A user could pay for a seat that someone else already took.                                                                   |
| Put all seat requests through a message queue, one at a time            | It adds more components. Row locks in the database already make requests for the same seat wait in line.                      |

---

## 9. Risks and open questions

- **Hold expires during payment.** If the hold expires after the card is charged, the purchase transaction fails. Mitigation: only start payment if at least 60 seconds of the hold remain, and refund automatically if the transaction still fails. The 60 seconds is a starting value.
- **Deadlock.** Two users who hold overlapping seats in different orders can block each other. PostgreSQL detects this and cancels one transaction. The server then returns 409, or retries once. The limit of 6 seats per hold keeps this rare.
- **Estimates are assumptions.** The 5 requests per user, the 5 times peak, and the 50 users per second admit rate are not measured. A load test should confirm them before a real launch.
- **Bots and many accounts** are not handled in this design.
