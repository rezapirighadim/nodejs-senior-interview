# Live Coding Interview Prep -- Large-Scale Finance & CRM (45 Minutes)

This file prepares you for a **45-minute live coding** round at a large-scale finance company or CRM platform. The interviewer wants to see **how you think**, **how you structure code by hand**, and **how you communicate while solving**.

---

## The Golden Framework: How to Spend Your 45 Minutes

```
Minutes 0-5    CLARIFY   Ask questions. Repeat the problem back. Confirm edge cases.
Minutes 5-10   DESIGN    Outline classes/functions on paper. Name your approach.
Minutes 10-35  CODE      Write clean code. Talk while you type. Handle errors.
Minutes 35-42  TEST      Walk through with an example. Find edge cases.
Minutes 42-45  DISCUSS   Time/space complexity. How would this scale?
```

**Rules for the interviewer's eyes:**
- Name things well. `calculateBalance` not `calc` or `doStuff`.
- Small functions. Each function does ONE thing.
- Handle errors early (guard clauses at the top).
- Use TypeScript types -- even if they don't ask, it shows you think about contracts.
- Talk out loud: "I'm choosing a Map here because we need O(1) lookup by account ID..."

---

## Part 1: The Thinking-Out-Loud Script

Before you write a single line, say these things out loud:

```
1. "Let me make sure I understand the problem..."
   → Restate it. Ask: "Should I handle X edge case?"

2. "Let me think about the data model first..."
   → What are the entities? What are the relationships?

3. "My approach will be..."
   → Name the pattern: "I'll use a State Machine / Strategy / Event Sourcing"

4. "Let me start with the interface, then implement..."
   → Write types/interfaces FIRST, then the logic.

5. "Let me trace through this with an example..."
   → Walk through your code with concrete values.

6. "For scale, I would change..."
   → Show you know this is an in-memory demo, not production.
```

---

## Part 2: Finance Domain -- 6 Realistic Problems

These are the exact types of problems finance companies ask. Practice each one in under 30 minutes.

---

### Problem 1: Money Transfer Service (Most Common!)

**Prompt:** "Design a service that transfers money between accounts. Handle insufficient funds, concurrent transfers, and maintain an audit log."

**What they're testing:** Error handling, data integrity, transaction thinking.

**Talk track:** "I'll start with an Account model and a TransferService. I need to make sure a transfer is atomic -- both debit and credit happen or neither does. I'll keep a transaction log for auditability."

```ts
// STEP 1: Define your types first (show the interviewer you think in contracts)

interface Account {
  id: string;
  name: string;
  balance: number;       // stored in cents to avoid floating-point issues
  currency: string;
}

interface Transfer {
  id: string;
  fromAccountId: string;
  toAccountId: string;
  amount: number;        // in cents
  status: 'pending' | 'completed' | 'failed';
  reason?: string;
  createdAt: Date;
}

// STEP 2: Error classes (shows you think about failure modes)

class InsufficientFundsError extends Error {
  constructor(accountId: string, requested: number, available: number) {
    super(
      `Account ${accountId}: requested ${requested} but only ${available} available`
    );
    this.name = 'InsufficientFundsError';
  }
}

class AccountNotFoundError extends Error {
  constructor(accountId: string) {
    super(`Account ${accountId} not found`);
    this.name = 'AccountNotFoundError';
  }
}

// STEP 3: The service

class TransferService {
  private accounts = new Map<string, Account>();
  private transfers: Transfer[] = [];
  private locks = new Set<string>();  // simple lock per account

  addAccount(id: string, name: string, balance: number, currency = 'USD'): Account {
    const account: Account = { id, name, balance, currency };
    this.accounts.set(id, account);
    return account;
  }

  getBalance(accountId: string): number {
    const account = this.accounts.get(accountId);
    if (!account) throw new AccountNotFoundError(accountId);
    return account.balance;
  }

  async transfer(fromId: string, toId: string, amount: number): Promise<Transfer> {
    // --- Validation (guard clauses first) ---
    if (amount <= 0) throw new Error('Transfer amount must be positive');
    if (fromId === toId) throw new Error('Cannot transfer to the same account');

    const from = this.accounts.get(fromId);
    const to = this.accounts.get(toId);
    if (!from) throw new AccountNotFoundError(fromId);
    if (!to) throw new AccountNotFoundError(toId);
    if (from.currency !== to.currency) throw new Error('Currency mismatch');

    // --- Acquire locks (sorted order to prevent deadlock) ---
    const [firstLock, secondLock] = [fromId, toId].sort();
    await this.acquireLock(firstLock);
    await this.acquireLock(secondLock);

    const transfer: Transfer = {
      id: `txn_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      fromAccountId: fromId,
      toAccountId: toId,
      amount,
      status: 'pending',
      createdAt: new Date(),
    };

    try {
      // --- Check funds ---
      if (from.balance < amount) {
        transfer.status = 'failed';
        transfer.reason = 'Insufficient funds';
        throw new InsufficientFundsError(fromId, amount, from.balance);
      }

      // --- Execute (atomic in single-threaded Node.js) ---
      from.balance -= amount;
      to.balance += amount;
      transfer.status = 'completed';

      return transfer;
    } finally {
      // --- Always release locks and log ---
      this.transfers.push(transfer);
      this.releaseLock(firstLock);
      this.releaseLock(secondLock);
    }
  }

  getTransferHistory(accountId: string): Transfer[] {
    return this.transfers.filter(
      (t) => t.fromAccountId === accountId || t.toAccountId === accountId
    );
  }

  private async acquireLock(id: string): Promise<void> {
    // In production: use Redis SETNX or DB row-level locks
    while (this.locks.has(id)) {
      await new Promise((r) => setTimeout(r, 10));
    }
    this.locks.add(id);
  }

  private releaseLock(id: string): void {
    this.locks.delete(id);
  }
}

// STEP 4: Demo / Test walkthrough
const service = new TransferService();
service.addAccount('acc_1', 'Alice', 10000);  // $100.00
service.addAccount('acc_2', 'Bob', 5000);     // $50.00

await service.transfer('acc_1', 'acc_2', 3000); // $30.00 from Alice to Bob

console.log(service.getBalance('acc_1')); // 7000 ($70.00)
console.log(service.getBalance('acc_2')); // 8000 ($80.00)

// STEP 5: Scale discussion
// "In production I'd use:
//  - PostgreSQL transactions with SELECT FOR UPDATE
//  - Amounts in a Decimal/BigInt library (never floats for money)
//  - An event-sourcing approach: store events, derive balance
//  - Idempotency keys to prevent duplicate transfers
//  - A saga pattern if accounts live in different services"
```

**Key phrases to say:**
- "I'm using cents to avoid floating-point precision issues."
- "I sort the lock order to prevent deadlocks."
- "The try/finally ensures we always release locks and log the transfer."

---

### Problem 2: Idempotent Payment Processor

**Prompt:** "Design a payment processor that guarantees each payment is processed exactly once, even if the client retries."

**What they're testing:** Idempotency, distributed systems thinking.

```ts
interface Payment {
  idempotencyKey: string;
  amount: number;
  currency: string;
  merchantId: string;
  customerId: string;
}

interface PaymentResult {
  paymentId: string;
  status: 'succeeded' | 'failed' | 'duplicate';
  idempotencyKey: string;
  processedAt: Date;
}

class PaymentProcessor {
  private processedPayments = new Map<string, PaymentResult>();
  private balances = new Map<string, number>();

  async processPayment(payment: Payment): Promise<PaymentResult> {
    // --- Idempotency check: have we seen this key before? ---
    const existing = this.processedPayments.get(payment.idempotencyKey);
    if (existing) {
      return { ...existing, status: 'duplicate' };
    }

    // --- Validate ---
    if (payment.amount <= 0) {
      return this.recordResult(payment.idempotencyKey, 'failed');
    }

    const customerBalance = this.balances.get(payment.customerId) ?? 0;
    if (customerBalance < payment.amount) {
      return this.recordResult(payment.idempotencyKey, 'failed');
    }

    // --- Process: debit customer, credit merchant ---
    this.balances.set(
      payment.customerId,
      customerBalance - payment.amount
    );
    const merchantBalance = this.balances.get(payment.merchantId) ?? 0;
    this.balances.set(
      payment.merchantId,
      merchantBalance + payment.amount
    );

    return this.recordResult(payment.idempotencyKey, 'succeeded');
  }

  private recordResult(
    idempotencyKey: string,
    status: 'succeeded' | 'failed'
  ): PaymentResult {
    const result: PaymentResult = {
      paymentId: `pay_${Date.now()}`,
      status,
      idempotencyKey,
      processedAt: new Date(),
    };
    this.processedPayments.set(idempotencyKey, result);
    return result;
  }

  setBalance(accountId: string, amount: number): void {
    this.balances.set(accountId, amount);
  }
}

// Test: same key twice returns duplicate, balance only debited once
const processor = new PaymentProcessor();
processor.setBalance('cust_1', 10000);

const payment = {
  idempotencyKey: 'idk_abc123',
  amount: 5000,
  currency: 'USD',
  merchantId: 'merch_1',
  customerId: 'cust_1',
};

const r1 = await processor.processPayment(payment); // succeeded
const r2 = await processor.processPayment(payment); // duplicate (not charged again!)
```

---

### Problem 3: Order Book / Price Matching Engine

**Prompt:** "Build a simple order matching engine for a trading system. Support limit buy and sell orders."

**What they're testing:** Data structures, sorting, domain understanding.

```ts
interface Order {
  id: string;
  side: 'buy' | 'sell';
  price: number;       // in cents
  quantity: number;
  timestamp: number;
  remainingQty: number;
}

interface Trade {
  buyOrderId: string;
  sellOrderId: string;
  price: number;
  quantity: number;
  executedAt: number;
}

class OrderBook {
  private buyOrders: Order[] = [];   // sorted: highest price first (best bid)
  private sellOrders: Order[] = [];  // sorted: lowest price first (best ask)
  private trades: Trade[] = [];

  placeOrder(side: 'buy' | 'sell', price: number, quantity: number): Trade[] {
    const order: Order = {
      id: `ord_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      side,
      price,
      quantity,
      remainingQty: quantity,
      timestamp: Date.now(),
    };

    const newTrades = this.matchOrder(order);

    // If order is not fully filled, add to book
    if (order.remainingQty > 0) {
      if (side === 'buy') {
        this.buyOrders.push(order);
        this.buyOrders.sort((a, b) => b.price - a.price || a.timestamp - b.timestamp);
      } else {
        this.sellOrders.push(order);
        this.sellOrders.sort((a, b) => a.price - b.price || a.timestamp - b.timestamp);
      }
    }

    return newTrades;
  }

  private matchOrder(incoming: Order): Trade[] {
    const matched: Trade[] = [];
    const oppositeBook = incoming.side === 'buy' ? this.sellOrders : this.buyOrders;

    while (incoming.remainingQty > 0 && oppositeBook.length > 0) {
      const best = oppositeBook[0];

      // Check if prices cross
      const pricesCross = incoming.side === 'buy'
        ? incoming.price >= best.price
        : incoming.price <= best.price;

      if (!pricesCross) break;

      // Execute trade at the resting order's price (price-time priority)
      const fillQty = Math.min(incoming.remainingQty, best.remainingQty);
      const trade: Trade = {
        buyOrderId: incoming.side === 'buy' ? incoming.id : best.id,
        sellOrderId: incoming.side === 'sell' ? incoming.id : best.id,
        price: best.price,  // resting order's price
        quantity: fillQty,
        executedAt: Date.now(),
      };

      matched.push(trade);
      this.trades.push(trade);

      incoming.remainingQty -= fillQty;
      best.remainingQty -= fillQty;

      // Remove fully filled resting orders
      if (best.remainingQty === 0) {
        oppositeBook.shift();
      }
    }

    return matched;
  }

  getSpread(): { bid: number | null; ask: number | null } {
    return {
      bid: this.buyOrders[0]?.price ?? null,
      ask: this.sellOrders[0]?.price ?? null,
    };
  }
}

// Demo
const book = new OrderBook();
book.placeOrder('sell', 10500, 10);  // sell 10 @ $105.00
book.placeOrder('sell', 10200, 5);   // sell 5 @ $102.00
book.placeOrder('buy', 10000, 8);    // buy 8 @ $100.00  (no match)
book.placeOrder('buy', 10300, 12);   // buy 12 @ $103.00 (matches sell@102, partial fill)
// Trades: 5 units @ $102.00 (filled the sell@102), 7 remaining as buy@103
```

---

### Problem 4: Event-Sourced Account Ledger

**Prompt:** "Build a ledger that stores all events and derives the account balance from the event history."

**What they're testing:** Event sourcing, immutability, audit trail.

```ts
type LedgerEvent =
  | { type: 'ACCOUNT_OPENED'; accountId: string; timestamp: Date }
  | { type: 'MONEY_DEPOSITED'; accountId: string; amount: number; timestamp: Date }
  | { type: 'MONEY_WITHDRAWN'; accountId: string; amount: number; timestamp: Date }
  | { type: 'TRANSFER_SENT'; accountId: string; toAccountId: string; amount: number; timestamp: Date }
  | { type: 'TRANSFER_RECEIVED'; accountId: string; fromAccountId: string; amount: number; timestamp: Date };

class EventSourcedLedger {
  private events: LedgerEvent[] = [];

  // Append-only: events are immutable facts
  private append(event: LedgerEvent): void {
    this.events.push(Object.freeze(event));
  }

  openAccount(accountId: string): void {
    if (this.isAccountOpen(accountId)) {
      throw new Error(`Account ${accountId} already exists`);
    }
    this.append({ type: 'ACCOUNT_OPENED', accountId, timestamp: new Date() });
  }

  deposit(accountId: string, amount: number): void {
    this.assertAccountExists(accountId);
    if (amount <= 0) throw new Error('Deposit amount must be positive');
    this.append({ type: 'MONEY_DEPOSITED', accountId, amount, timestamp: new Date() });
  }

  withdraw(accountId: string, amount: number): void {
    this.assertAccountExists(accountId);
    if (amount <= 0) throw new Error('Withdrawal amount must be positive');
    const balance = this.getBalance(accountId);
    if (balance < amount) throw new Error('Insufficient funds');
    this.append({ type: 'MONEY_WITHDRAWN', accountId, amount, timestamp: new Date() });
  }

  transfer(fromId: string, toId: string, amount: number): void {
    this.assertAccountExists(fromId);
    this.assertAccountExists(toId);
    if (this.getBalance(fromId) < amount) throw new Error('Insufficient funds');

    this.append({
      type: 'TRANSFER_SENT', accountId: fromId,
      toAccountId: toId, amount, timestamp: new Date(),
    });
    this.append({
      type: 'TRANSFER_RECEIVED', accountId: toId,
      fromAccountId: fromId, amount, timestamp: new Date(),
    });
  }

  // Derive balance by replaying events (the core idea of event sourcing)
  getBalance(accountId: string): number {
    return this.events
      .filter((e) => 'accountId' in e && e.accountId === accountId)
      .reduce((balance, event) => {
        switch (event.type) {
          case 'MONEY_DEPOSITED':
          case 'TRANSFER_RECEIVED':
            return balance + event.amount;
          case 'MONEY_WITHDRAWN':
          case 'TRANSFER_SENT':
            return balance - event.amount;
          default:
            return balance;
        }
      }, 0);
  }

  // Full audit trail
  getHistory(accountId: string): LedgerEvent[] {
    return this.events.filter(
      (e) => 'accountId' in e && e.accountId === accountId
    );
  }

  // Balance at a point in time (powerful for finance!)
  getBalanceAt(accountId: string, asOf: Date): number {
    return this.events
      .filter((e) => 'accountId' in e && e.accountId === accountId && e.timestamp <= asOf)
      .reduce((balance, event) => {
        switch (event.type) {
          case 'MONEY_DEPOSITED':
          case 'TRANSFER_RECEIVED':
            return balance + event.amount;
          case 'MONEY_WITHDRAWN':
          case 'TRANSFER_SENT':
            return balance - event.amount;
          default:
            return balance;
        }
      }, 0);
  }

  private isAccountOpen(accountId: string): boolean {
    return this.events.some(
      (e) => e.type === 'ACCOUNT_OPENED' && e.accountId === accountId
    );
  }

  private assertAccountExists(accountId: string): void {
    if (!this.isAccountOpen(accountId)) {
      throw new Error(`Account ${accountId} does not exist`);
    }
  }
}

// "At scale, I'd add snapshots: every N events, store a materialized balance.
//  Replay only from the last snapshot. This is how real event-sourced systems work."
```

---

### Problem 5: CRM Lead Scoring Pipeline

**Prompt:** "Design a lead scoring system that assigns scores to contacts based on configurable rules, and moves them through a sales pipeline."

**What they're testing:** Strategy pattern, state machine, clean OOP.

```ts
// --- Scoring Rules (Strategy pattern) ---

interface ScoringRule {
  name: string;
  evaluate(lead: Lead): number;  // returns points to add
}

interface Lead {
  id: string;
  email: string;
  company: string;
  title: string;
  actions: LeadAction[];
  score: number;
  stage: PipelineStage;
}

interface LeadAction {
  type: 'page_view' | 'email_open' | 'form_submit' | 'demo_request' | 'pricing_view';
  timestamp: Date;
}

type PipelineStage = 'new' | 'contacted' | 'qualified' | 'proposal' | 'won' | 'lost';

// Concrete rules
class ActionCountRule implements ScoringRule {
  name = 'ActionCountRule';
  constructor(
    private actionType: LeadAction['type'],
    private pointsPerAction: number
  ) {}

  evaluate(lead: Lead): number {
    const count = lead.actions.filter((a) => a.type === this.actionType).length;
    return count * this.pointsPerAction;
  }
}

class TitleRule implements ScoringRule {
  name = 'TitleRule';
  private highValueTitles = ['cto', 'vp', 'director', 'head', 'chief'];

  evaluate(lead: Lead): number {
    const lower = lead.title.toLowerCase();
    return this.highValueTitles.some((t) => lower.includes(t)) ? 25 : 0;
  }
}

class RecencyRule implements ScoringRule {
  name = 'RecencyRule';

  evaluate(lead: Lead): number {
    if (lead.actions.length === 0) return -10;
    const lastAction = lead.actions[lead.actions.length - 1];
    const daysSince = (Date.now() - lastAction.timestamp.getTime()) / 86_400_000;
    if (daysSince < 1) return 20;
    if (daysSince < 7) return 10;
    if (daysSince > 30) return -15;
    return 0;
  }
}

// --- Pipeline State Machine ---

const VALID_TRANSITIONS: Record<PipelineStage, PipelineStage[]> = {
  new:       ['contacted', 'lost'],
  contacted: ['qualified', 'lost'],
  qualified: ['proposal', 'lost'],
  proposal:  ['won', 'lost'],
  won:       [],
  lost:      ['new'],  // can reopen
};

// --- Lead Scoring Engine ---

class LeadScoringEngine {
  private rules: ScoringRule[] = [];
  private leads = new Map<string, Lead>();

  addRule(rule: ScoringRule): void {
    this.rules.push(rule);
  }

  addLead(id: string, email: string, company: string, title: string): Lead {
    const lead: Lead = {
      id, email, company, title,
      actions: [], score: 0, stage: 'new',
    };
    this.leads.set(id, lead);
    return lead;
  }

  recordAction(leadId: string, type: LeadAction['type']): void {
    const lead = this.leads.get(leadId);
    if (!lead) throw new Error(`Lead ${leadId} not found`);
    lead.actions.push({ type, timestamp: new Date() });
    this.recalculateScore(lead);
  }

  moveStage(leadId: string, newStage: PipelineStage): void {
    const lead = this.leads.get(leadId);
    if (!lead) throw new Error(`Lead ${leadId} not found`);

    const allowed = VALID_TRANSITIONS[lead.stage];
    if (!allowed.includes(newStage)) {
      throw new Error(`Cannot move from '${lead.stage}' to '${newStage}'`);
    }
    lead.stage = newStage;
  }

  getHotLeads(minScore: number): Lead[] {
    return [...this.leads.values()]
      .filter((l) => l.score >= minScore && l.stage !== 'lost' && l.stage !== 'won')
      .sort((a, b) => b.score - a.score);
  }

  private recalculateScore(lead: Lead): void {
    lead.score = this.rules.reduce((total, rule) => total + rule.evaluate(lead), 0);
  }
}

// Usage
const engine = new LeadScoringEngine();
engine.addRule(new ActionCountRule('demo_request', 30));
engine.addRule(new ActionCountRule('pricing_view', 15));
engine.addRule(new ActionCountRule('email_open', 5));
engine.addRule(new TitleRule());
engine.addRule(new RecencyRule());

engine.addLead('lead_1', 'cto@bigcorp.com', 'BigCorp', 'CTO');
engine.recordAction('lead_1', 'demo_request');
engine.recordAction('lead_1', 'pricing_view');
// Score: 30 (demo) + 15 (pricing) + 25 (CTO title) + 20 (recent) = 90
```

---

### Problem 6: Rate-Limited API Gateway

**Prompt:** "Build an API rate limiter using the sliding window algorithm. Support per-client limits."

**What they're testing:** Time-based algorithms, clean API design.

```ts
interface RateLimitConfig {
  maxRequests: number;    // e.g. 100
  windowMs: number;       // e.g. 60_000 (1 minute)
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

class SlidingWindowRateLimiter {
  private windows = new Map<string, number[]>(); // clientId -> sorted timestamps

  constructor(private config: RateLimitConfig) {}

  check(clientId: string): RateLimitResult {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    // Get or create timestamp log for this client
    let timestamps = this.windows.get(clientId);
    if (!timestamps) {
      timestamps = [];
      this.windows.set(clientId, timestamps);
    }

    // Evict expired entries
    while (timestamps.length > 0 && timestamps[0] <= windowStart) {
      timestamps.shift();
    }

    if (timestamps.length >= this.config.maxRequests) {
      // Oldest entry in window tells us when a slot opens
      const retryAfterMs = timestamps[0] - windowStart;
      return {
        allowed: false,
        remaining: 0,
        retryAfterMs: Math.ceil(retryAfterMs),
      };
    }

    // Allow and record
    timestamps.push(now);

    return {
      allowed: true,
      remaining: this.config.maxRequests - timestamps.length,
      retryAfterMs: 0,
    };
  }

  // Middleware-style usage (show interviewer you think about integration)
  middleware() {
    return (req: any, res: any, next: any) => {
      const clientId = req.headers['x-api-key'] || req.ip;
      const result = this.check(clientId);

      res.setHeader('X-RateLimit-Remaining', result.remaining);

      if (!result.allowed) {
        res.setHeader('Retry-After', Math.ceil(result.retryAfterMs / 1000));
        return res.status(429).json({ error: 'Too many requests' });
      }

      next();
    };
  }
}
```

---

## Part 3: CRM Domain -- 3 Bonus Problems

---

### Problem 7: Contact Deduplication

**Prompt:** "Write a function that finds and merges duplicate contacts based on email or phone similarity."

```ts
interface Contact {
  id: string;
  email: string;
  phone: string;
  name: string;
  createdAt: Date;
}

interface DuplicateGroup {
  primary: Contact;          // the oldest (source of truth)
  duplicates: Contact[];
  matchedOn: string;
}

function findDuplicates(contacts: Contact[]): DuplicateGroup[] {
  const emailIndex = new Map<string, Contact[]>();
  const phoneIndex = new Map<string, Contact[]>();

  // Build indices
  for (const contact of contacts) {
    const normalizedEmail = contact.email.trim().toLowerCase();
    const normalizedPhone = contact.phone.replace(/[\s\-()]/g, '');

    if (normalizedEmail) {
      const group = emailIndex.get(normalizedEmail) ?? [];
      group.push(contact);
      emailIndex.set(normalizedEmail, group);
    }
    if (normalizedPhone) {
      const group = phoneIndex.get(normalizedPhone) ?? [];
      group.push(contact);
      phoneIndex.set(normalizedPhone, group);
    }
  }

  const seen = new Set<string>();
  const groups: DuplicateGroup[] = [];

  // Find groups with more than one contact
  for (const [key, matchedContacts] of emailIndex) {
    if (matchedContacts.length < 2) continue;

    const sorted = matchedContacts.sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
    );
    const primary = sorted[0];

    if (seen.has(primary.id)) continue;
    sorted.forEach((c) => seen.add(c.id));

    groups.push({
      primary,
      duplicates: sorted.slice(1),
      matchedOn: `email:${key}`,
    });
  }

  for (const [key, matchedContacts] of phoneIndex) {
    if (matchedContacts.length < 2) continue;

    const unseen = matchedContacts.filter((c) => !seen.has(c.id));
    if (unseen.length < 2) continue;

    const sorted = unseen.sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
    );
    sorted.forEach((c) => seen.add(c.id));

    groups.push({
      primary: sorted[0],
      duplicates: sorted.slice(1),
      matchedOn: `phone:${key}`,
    });
  }

  return groups;
}
```

---

### Problem 8: Activity Timeline with Pagination

**Prompt:** "Build a timeline service that stores activities for CRM entities and supports cursor-based pagination."

```ts
interface Activity {
  id: string;
  entityId: string;       // the contact/deal/company this belongs to
  entityType: 'contact' | 'deal' | 'company';
  action: string;         // 'email_sent', 'note_added', 'call_logged', etc.
  data: Record<string, unknown>;
  performedBy: string;
  createdAt: Date;
}

interface PaginatedResult<T> {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
}

class ActivityTimeline {
  private activities: Activity[] = [];

  log(
    entityType: Activity['entityType'],
    entityId: string,
    action: string,
    data: Record<string, unknown>,
    performedBy: string
  ): Activity {
    const activity: Activity = {
      id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      entityId,
      entityType,
      action,
      data,
      performedBy,
      createdAt: new Date(),
    };

    // Insert in sorted order (newest first)
    this.activities.unshift(activity);
    return activity;
  }

  getTimeline(
    entityId: string,
    limit: number = 20,
    cursor?: string
  ): PaginatedResult<Activity> {
    let filtered = this.activities.filter((a) => a.entityId === entityId);

    // cursor is the last activity ID seen
    if (cursor) {
      const cursorIndex = filtered.findIndex((a) => a.id === cursor);
      if (cursorIndex !== -1) {
        filtered = filtered.slice(cursorIndex + 1);
      }
    }

    const items = filtered.slice(0, limit);
    const hasMore = filtered.length > limit;

    return {
      items,
      nextCursor: hasMore ? items[items.length - 1].id : null,
      hasMore,
    };
  }
}

// Demo
const timeline = new ActivityTimeline();
timeline.log('contact', 'c_1', 'email_sent', { subject: 'Hello' }, 'user_1');
timeline.log('contact', 'c_1', 'note_added', { text: 'Interested in demo' }, 'user_2');

const page1 = timeline.getTimeline('c_1', 1);         // first item
const page2 = timeline.getTimeline('c_1', 1, page1.nextCursor!); // second item
```

---

### Problem 9: Workflow / State Machine Engine

**Prompt:** "Build a configurable state machine for CRM deal stages with hooks for side effects."

```ts
type HookFn = (context: { from: string; to: string; entityId: string }) => void | Promise<void>;

interface StateConfig {
  name: string;
  allowedTransitions: string[];
  onEnter?: HookFn;
  onExit?: HookFn;
}

class StateMachine {
  private states = new Map<string, StateConfig>();
  private currentStates = new Map<string, string>(); // entityId -> current state

  addState(config: StateConfig): void {
    this.states.set(config.name, config);
  }

  initialize(entityId: string, initialState: string): void {
    if (!this.states.has(initialState)) {
      throw new Error(`Unknown state: ${initialState}`);
    }
    this.currentStates.set(entityId, initialState);
  }

  async transition(entityId: string, targetState: string): Promise<void> {
    const currentState = this.currentStates.get(entityId);
    if (!currentState) throw new Error(`Entity ${entityId} not initialized`);

    const current = this.states.get(currentState)!;
    if (!current.allowedTransitions.includes(targetState)) {
      throw new Error(
        `Invalid transition: '${currentState}' -> '${targetState}'. ` +
        `Allowed: [${current.allowedTransitions.join(', ')}]`
      );
    }

    const target = this.states.get(targetState);
    if (!target) throw new Error(`Unknown state: ${targetState}`);

    const context = { from: currentState, to: targetState, entityId };

    // Execute hooks
    if (current.onExit) await current.onExit(context);
    this.currentStates.set(entityId, targetState);
    if (target.onEnter) await target.onEnter(context);
  }

  getState(entityId: string): string | undefined {
    return this.currentStates.get(entityId);
  }
}

// Usage: Deal pipeline
const pipeline = new StateMachine();

pipeline.addState({
  name: 'discovery',
  allowedTransitions: ['proposal', 'lost'],
  onExit: (ctx) => console.log(`  [Hook] Leaving discovery for deal ${ctx.entityId}`),
});

pipeline.addState({
  name: 'proposal',
  allowedTransitions: ['negotiation', 'lost'],
  onEnter: (ctx) => console.log(`  [Hook] Sending proposal for deal ${ctx.entityId}`),
});

pipeline.addState({
  name: 'negotiation',
  allowedTransitions: ['closed_won', 'lost'],
});

pipeline.addState({ name: 'closed_won', allowedTransitions: [] });
pipeline.addState({ name: 'lost', allowedTransitions: ['discovery'] });

pipeline.initialize('deal_1', 'discovery');
await pipeline.transition('deal_1', 'proposal');   // triggers onExit + onEnter hooks
await pipeline.transition('deal_1', 'negotiation');
await pipeline.transition('deal_1', 'closed_won');
```

---

## Part 4: Algorithm Problems They Love in Finance

These are the algo problems that show up in finance interviews because they map to real trading/data problems.

### Top-K Frequent Elements (heap / bucket sort)

```ts
function topKFrequent(nums: number[], k: number): number[] {
  const freq = new Map<number, number>();
  for (const n of nums) {
    freq.set(n, (freq.get(n) ?? 0) + 1);
  }

  // Bucket sort: index = frequency, value = numbers with that frequency
  const buckets: number[][] = Array.from({ length: nums.length + 1 }, () => []);
  for (const [num, count] of freq) {
    buckets[count].push(num);
  }

  const result: number[] = [];
  for (let i = buckets.length - 1; i >= 0 && result.length < k; i--) {
    result.push(...buckets[i]);
  }

  return result.slice(0, k);
}

// topKFrequent([1,1,1,2,2,3], 2) -> [1, 2]
```

### LRU Cache (LinkedList + Map)

```ts
class LRUCache<K, V> {
  private cache = new Map<K, V>();

  constructor(private capacity: number) {}

  get(key: K): V | undefined {
    if (!this.cache.has(key)) return undefined;

    // Move to end (most recently used) -- Map preserves insertion order
    const value = this.cache.get(key)!;
    this.cache.delete(key);
    this.cache.set(key, value);
    return value;
  }

  put(key: K, value: V): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.capacity) {
      // Evict least recently used (first key in Map)
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, value);
  }
}
```

### Merge Sorted Streams (finance: merging price feeds)

```ts
function mergeSortedArrays(...arrays: number[][]): number[] {
  const result: number[] = [];
  const pointers = arrays.map(() => 0);

  while (true) {
    let minVal = Infinity;
    let minIdx = -1;

    for (let i = 0; i < arrays.length; i++) {
      if (pointers[i] < arrays[i].length && arrays[i][pointers[i]] < minVal) {
        minVal = arrays[i][pointers[i]];
        minIdx = i;
      }
    }

    if (minIdx === -1) break; // all exhausted
    result.push(minVal);
    pointers[minIdx]++;
  }

  return result;
}

// mergeSortedArrays([1,4,7], [2,5,8], [3,6,9]) -> [1,2,3,4,5,6,7,8,9]
// Real-world: merging price updates from multiple exchanges
```

---

## Part 5: Cheat Sheet -- Patterns to Name-Drop

When the interviewer asks "how would you scale this?" or "what would you do differently in production?", use these:

| Situation | Pattern to mention | One-liner |
|-----------|-------------------|-----------|
| Money calculations | **Integer arithmetic** | "Store in cents/smallest unit, never use floats" |
| Duplicate operations | **Idempotency key** | "Client sends a unique key, server deduplicates" |
| Audit requirements | **Event sourcing** | "Append-only event log, derive state by replaying" |
| State transitions | **State machine** | "Explicit allowed transitions, hooks on enter/exit" |
| Multiple payment strategies | **Strategy pattern** | "Interface for payment, swap Stripe/PayPal at runtime" |
| Loose coupling | **Pub/Sub + Event bus** | "Components emit events, others subscribe" |
| External API flakiness | **Circuit breaker** | "After N failures, stop calling and return fallback" |
| Concurrent writes | **Optimistic locking** | "Version field on the row, retry if stale" |
| Data consistency | **Saga pattern** | "Chain of local transactions with compensating actions" |
| Scaling reads | **CQRS** | "Separate read model (denormalized) from write model" |
| Bulk operations | **Batch + cursor** | "Process in chunks with cursor-based pagination" |
| Real-time updates | **WebSocket + Redis pub/sub** | "Changes broadcast to connected clients via channels" |
| Search | **Inverted index (Elasticsearch)** | "Tokenize and index, query with relevance scoring" |

---

## Part 6: Mock Interview Simulation (Do This the Day Before)

Set a timer for 45 minutes. Pick ONE problem from Part 2. Follow this exactly:

```
TIMER 00:00 - Read the prompt. Don't code yet.
TIMER 02:00 - Say out loud: "My understanding is..." (clarify)
TIMER 04:00 - Say out loud: "My approach is..." (design)
TIMER 05:00 - Start writing types/interfaces
TIMER 08:00 - Start writing the main class
TIMER 25:00 - If not done, simplify. Cut scope. Get something working.
TIMER 30:00 - Write a demo/test at the bottom
TIMER 35:00 - Walk through the code with example values
TIMER 40:00 - Discuss complexity and production changes
TIMER 45:00 - Stop.
```

**Common mistakes to avoid:**
- Spending too long on types/design without writing code
- Writing a perfect solution for 40 minutes then running out of time with no working demo
- Not talking -- silence is your enemy in a live coding interview
- Jumping straight to code without clarifying the problem
- Over-engineering: don't add Redis/DB layers when a Map will show the same logic
- Not handling errors: interviewers specifically watch for this in finance

**What makes you look senior:**
- Naming things well from the start
- Guard clauses at the top of functions
- Explaining WHY, not just WHAT ("I use a Map because we need O(1) lookup")
- Mentioning edge cases before the interviewer asks
- Saying "in production I'd use X, but for this demo a Map is fine"
- Asking clarifying questions about currency, precision, concurrency

---

Good luck. You're ready.
