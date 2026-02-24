/**
 * ============================================================================
 * LOW-LEVEL DESIGN: Library Management System
 * ============================================================================
 *
 * Problem:
 *   Design a library system that manages books, members, borrowing/returning,
 *   fines for late returns, search, and reservations.
 *
 * Key Concepts:
 *   - Repository pattern for data access (BookRepository, MemberRepository)
 *   - State pattern for book copy status (Available, Borrowed, Reserved)
 *   - Observer pattern for notifications (reservation available, due reminders)
 *   - Enum-like constants for membership types
 *
 * Classes:
 *   BookStatus / MembershipType  -- enum-like frozen objects
 *   Book                         -- ISBN, title, author metadata
 *   BookCopy                     -- individual physical copy with state
 *   Member                       -- library member with borrowing history
 *   BorrowRecord                 -- tracks borrow/return dates and fines
 *   Reservation                  -- queued hold on a book
 *   EventBus                     -- simple observer/pub-sub for notifications
 *   BookRepository               -- CRUD + search for books
 *   Library                      -- facade orchestrating all operations
 *
 * Run: node 02_library_management.js
 * ============================================================================
 */

// ─── Enum-like Constants ────────────────────────────────────────────────────

/** @enum {string} */
const BookStatus = Object.freeze({
  AVAILABLE: "available",
  BORROWED: "borrowed",
  RESERVED: "reserved",
});

/** @enum {string} */
const MembershipType = Object.freeze({
  STANDARD: "standard",
  PREMIUM: "premium",
});

/** Maximum books a member can borrow at once. */
const BORROW_LIMITS = Object.freeze({
  [MembershipType.STANDARD]: 3,
  [MembershipType.PREMIUM]: 7,
});

/** Loan period in days. */
const LOAN_DAYS = Object.freeze({
  [MembershipType.STANDARD]: 14,
  [MembershipType.PREMIUM]: 30,
});

/** Fine per overdue day. */
const FINE_PER_DAY = 0.5;

// ─── Helpers ────────────────────────────────────────────────────────────────

/** @param {number} days @returns {Date} */
const daysFromNow = (days) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
};

/** @param {Date} a @param {Date} b @returns {number} whole days difference */
const daysBetween = (a, b) =>
  Math.floor((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));

// ─── Event Bus (Observer) ───────────────────────────────────────────────────

class EventBus {
  constructor() {
    /** @type {Map<string, Array<function>>} */
    this.listeners = new Map();
  }

  /**
   * @param {string} event
   * @param {function} handler
   */
  on(event, handler) {
    if (!this.listeners.has(event)) this.listeners.set(event, []);
    this.listeners.get(event).push(handler);
  }

  /**
   * @param {string} event
   * @param {*} data
   */
  emit(event, data) {
    const handlers = this.listeners.get(event) ?? [];
    for (const h of handlers) h(data);
  }
}

// ─── Book & BookCopy ────────────────────────────────────────────────────────

class Book {
  /**
   * @param {string} isbn
   * @param {string} title
   * @param {string} author
   */
  constructor(isbn, title, author) {
    this.isbn = isbn;
    this.title = title;
    this.author = author;
    /** @type {BookCopy[]} */
    this.copies = [];
  }

  /**
   * Add physical copies.
   * @param {number} count
   * @returns {BookCopy[]} newly created copies
   */
  addCopies(count) {
    const newCopies = [];
    for (let i = 0; i < count; i++) {
      const copy = new BookCopy(this, `${this.isbn}-C${this.copies.length + 1}`);
      this.copies.push(copy);
      newCopies.push(copy);
    }
    return newCopies;
  }

  /** @returns {BookCopy | undefined} */
  findAvailableCopy() {
    return this.copies.find((c) => c.status === BookStatus.AVAILABLE);
  }

  /** @returns {number} */
  get availableCount() {
    return this.copies.filter((c) => c.status === BookStatus.AVAILABLE).length;
  }

  toString() {
    return `"${this.title}" by ${this.author} [${this.isbn}]`;
  }
}

class BookCopy {
  /**
   * @param {Book} book
   * @param {string} copyId
   */
  constructor(book, copyId) {
    this.book = book;
    this.copyId = copyId;
    /** @type {string} */
    this.status = BookStatus.AVAILABLE;
  }

  toString() {
    return `Copy(${this.copyId}, ${this.status})`;
  }
}

// ─── Member ─────────────────────────────────────────────────────────────────

class Member {
  static #nextId = 1;

  /**
   * @param {string} name
   * @param {string} membershipType - one of MembershipType values
   */
  constructor(name, membershipType = MembershipType.STANDARD) {
    this.id = `M${String(Member.#nextId++).padStart(4, "0")}`;
    this.name = name;
    this.membershipType = membershipType;
    /** @type {BorrowRecord[]} */
    this.activeBorrows = [];
    /** @type {BorrowRecord[]} */
    this.history = [];
    this.totalFinesPaid = 0;
  }

  get borrowLimit() {
    return BORROW_LIMITS[this.membershipType];
  }

  get loanDays() {
    return LOAN_DAYS[this.membershipType];
  }

  get canBorrow() {
    return this.activeBorrows.length < this.borrowLimit;
  }

  toString() {
    return `${this.name}(${this.id}, ${this.membershipType})`;
  }
}

// ─── Borrow Record ──────────────────────────────────────────────────────────

class BorrowRecord {
  /**
   * @param {Member} member
   * @param {BookCopy} copy
   * @param {Date} dueDate
   */
  constructor(member, copy, dueDate) {
    this.member = member;
    this.copy = copy;
    this.borrowDate = new Date();
    this.dueDate = dueDate;
    /** @type {Date | null} */
    this.returnDate = null;
    this.fine = 0;
  }

  get isReturned() {
    return this.returnDate !== null;
  }
}

// ─── Reservation ────────────────────────────────────────────────────────────

class Reservation {
  /**
   * @param {Member} member
   * @param {Book} book
   */
  constructor(member, book) {
    this.member = member;
    this.book = book;
    this.createdAt = new Date();
    this.fulfilled = false;
  }
}

// ─── Book Repository ────────────────────────────────────────────────────────

class BookRepository {
  constructor() {
    /** @type {Map<string, Book>} isbn -> Book */
    this.books = new Map();
  }

  /** @param {Book} book */
  add(book) {
    this.books.set(book.isbn, book);
  }

  /** @param {string} isbn @returns {Book | undefined} */
  findByIsbn(isbn) {
    return this.books.get(isbn);
  }

  /** @param {string} query @returns {Book[]} */
  searchByTitle(query) {
    const q = query.toLowerCase();
    return [...this.books.values()].filter((b) =>
      b.title.toLowerCase().includes(q)
    );
  }

  /** @param {string} query @returns {Book[]} */
  searchByAuthor(query) {
    const q = query.toLowerCase();
    return [...this.books.values()].filter((b) =>
      b.author.toLowerCase().includes(q)
    );
  }

  /** General search across title, author, isbn. */
  search(query) {
    const q = query.toLowerCase();
    return [...this.books.values()].filter(
      (b) =>
        b.title.toLowerCase().includes(q) ||
        b.author.toLowerCase().includes(q) ||
        b.isbn.toLowerCase().includes(q)
    );
  }
}

// ─── Library (Facade) ───────────────────────────────────────────────────────

class Library {
  /** @param {string} name */
  constructor(name) {
    this.name = name;
    this.bookRepo = new BookRepository();
    /** @type {Map<string, Member>} memberId -> Member */
    this.members = new Map();
    /** @type {Map<string, Reservation[]>} isbn -> queue of reservations */
    this.reservations = new Map();
    this.eventBus = new EventBus();
  }

  // ── Book management ──

  /**
   * @param {string} isbn
   * @param {string} title
   * @param {string} author
   * @param {number} copies
   * @returns {Book}
   */
  addBook(isbn, title, author, copies = 1) {
    let book = this.bookRepo.findByIsbn(isbn);
    if (!book) {
      book = new Book(isbn, title, author);
      this.bookRepo.add(book);
    }
    book.addCopies(copies);
    return book;
  }

  // ── Member management ──

  /**
   * @param {string} name
   * @param {string} membershipType
   * @returns {Member}
   */
  registerMember(name, membershipType = MembershipType.STANDARD) {
    const member = new Member(name, membershipType);
    this.members.set(member.id, member);
    return member;
  }

  // ── Borrowing ──

  /**
   * Borrow a book by ISBN.
   * @param {string} memberId
   * @param {string} isbn
   * @returns {BorrowRecord | null}
   */
  borrowBook(memberId, isbn) {
    const member = this.members.get(memberId);
    if (!member) {
      console.log(`  [ERR] Member ${memberId} not found.`);
      return null;
    }
    if (!member.canBorrow) {
      console.log(`  [ERR] ${member} has reached borrow limit (${member.borrowLimit}).`);
      return null;
    }

    const book = this.bookRepo.findByIsbn(isbn);
    if (!book) {
      console.log(`  [ERR] Book ISBN ${isbn} not found.`);
      return null;
    }

    const copy = book.findAvailableCopy();
    if (!copy) {
      console.log(`  [INFO] No copies of ${book} available. Consider reserving.`);
      return null;
    }

    copy.status = BookStatus.BORROWED;
    const dueDate = daysFromNow(member.loanDays);
    const record = new BorrowRecord(member, copy, dueDate);
    member.activeBorrows.push(record);

    this.eventBus.emit("book:borrowed", { member, book, dueDate });
    return record;
  }

  /**
   * Return a borrowed book.
   * @param {string} memberId
   * @param {string} copyId
   * @param {Date} [returnDate] - defaults to now, overridable for testing
   * @returns {BorrowRecord | null}
   */
  returnBook(memberId, copyId, returnDate = new Date()) {
    const member = this.members.get(memberId);
    if (!member) {
      console.log(`  [ERR] Member ${memberId} not found.`);
      return null;
    }

    const idx = member.activeBorrows.findIndex((r) => r.copy.copyId === copyId);
    if (idx === -1) {
      console.log(`  [ERR] No active borrow of copy ${copyId} by ${member}.`);
      return null;
    }

    const record = member.activeBorrows.splice(idx, 1)[0];
    record.returnDate = returnDate;
    record.copy.status = BookStatus.AVAILABLE;

    // Fine calculation
    const overdueDays = daysBetween(record.dueDate, returnDate);
    if (overdueDays > 0) {
      record.fine = overdueDays * FINE_PER_DAY;
      member.totalFinesPaid += record.fine;
      this.eventBus.emit("fine:charged", {
        member,
        fine: record.fine,
        overdueDays,
      });
    }

    member.history.push(record);

    // Check reservation queue
    this.#fulfillNextReservation(record.copy.book);

    this.eventBus.emit("book:returned", { member, book: record.copy.book });
    return record;
  }

  // ── Reservations ──

  /**
   * Reserve a book that is currently unavailable.
   * @param {string} memberId
   * @param {string} isbn
   * @returns {Reservation | null}
   */
  reserveBook(memberId, isbn) {
    const member = this.members.get(memberId);
    const book = this.bookRepo.findByIsbn(isbn);
    if (!member || !book) return null;

    if (book.availableCount > 0) {
      console.log(`  [INFO] Copies available, borrow directly instead.`);
      return null;
    }

    const reservation = new Reservation(member, book);
    if (!this.reservations.has(isbn)) this.reservations.set(isbn, []);
    this.reservations.get(isbn).push(reservation);

    this.eventBus.emit("book:reserved", { member, book });
    return reservation;
  }

  /**
   * When a copy becomes available, fulfill the next reservation in queue.
   * @param {Book} book
   */
  #fulfillNextReservation(book) {
    const queue = this.reservations.get(book.isbn);
    if (!queue || queue.length === 0) return;

    const next = queue.shift();
    next.fulfilled = true;

    // Mark a copy as reserved for this member
    const copy = book.findAvailableCopy();
    if (copy) {
      copy.status = BookStatus.RESERVED;
      this.eventBus.emit("reservation:ready", {
        member: next.member,
        book,
      });
    }
  }

  // ── Search ──

  /** @param {string} query @returns {Book[]} */
  search(query) {
    return this.bookRepo.search(query);
  }

  /** Display a summary of the catalog. */
  displayCatalog() {
    console.log(`\n=== ${this.name} Catalog ===`);
    for (const book of this.bookRepo.books.values()) {
      console.log(
        `  ${book} — ${book.availableCount}/${book.copies.length} available`
      );
    }
  }
}

// ─── Demo ───────────────────────────────────────────────────────────────────

function demo() {
  console.log("╔══════════════════════════════════════════════╗");
  console.log("║   LIBRARY MANAGEMENT SYSTEM  —  LLD DEMO    ║");
  console.log("╚══════════════════════════════════════════════╝\n");

  const lib = new Library("City Central Library");

  // Subscribe to events
  lib.eventBus.on("book:borrowed", ({ member, book, dueDate }) => {
    console.log(
      `  [EVENT] ${member.name} borrowed ${book.title}. Due: ${dueDate.toDateString()}`
    );
  });
  lib.eventBus.on("book:returned", ({ member, book }) => {
    console.log(`  [EVENT] ${member.name} returned ${book.title}.`);
  });
  lib.eventBus.on("fine:charged", ({ member, fine, overdueDays }) => {
    console.log(
      `  [EVENT] Fine $${fine.toFixed(2)} charged to ${member.name} (${overdueDays} days overdue).`
    );
  });
  lib.eventBus.on("reservation:ready", ({ member, book }) => {
    console.log(
      `  [EVENT] Notification to ${member.name}: "${book.title}" is now available for pickup!`
    );
  });
  lib.eventBus.on("book:reserved", ({ member, book }) => {
    console.log(`  [EVENT] ${member.name} reserved "${book.title}".`);
  });

  // 1. Add books
  console.log("--- Adding books ---");
  lib.addBook("978-0-13-468599-1", "The Pragmatic Programmer", "David Thomas", 2);
  lib.addBook("978-0-201-63361-0", "Design Patterns", "Gang of Four", 1);
  lib.addBook("978-0-596-51774-8", "JavaScript: The Good Parts", "Douglas Crockford", 3);
  lib.displayCatalog();

  // 2. Register members
  console.log("\n--- Registering members ---");
  const alice = lib.registerMember("Alice", MembershipType.PREMIUM);
  const bob = lib.registerMember("Bob", MembershipType.STANDARD);
  console.log(`  ${alice}`);
  console.log(`  ${bob}`);

  // 3. Borrow books
  console.log("\n--- Borrowing ---");
  const borrow1 = lib.borrowBook(alice.id, "978-0-13-468599-1");
  const borrow2 = lib.borrowBook(bob.id, "978-0-13-468599-1");
  const borrow3 = lib.borrowBook(bob.id, "978-0-201-63361-0");

  lib.displayCatalog();

  // 4. Try to borrow an unavailable book => reserve instead
  console.log("\n--- Reserve unavailable book ---");
  lib.borrowBook(alice.id, "978-0-201-63361-0"); // no copies left
  const reservation = lib.reserveBook(alice.id, "978-0-201-63361-0");

  // 5. Return with fine (simulate overdue)
  console.log("\n--- Returning overdue book ---");
  if (borrow3) {
    const overdueReturn = daysFromNow(20); // Standard gets 14 days, so 6 days late
    const record = lib.returnBook(bob.id, borrow3.copy.copyId, overdueReturn);
    if (record) {
      console.log(`  Fine: $${record.fine.toFixed(2)}`);
    }
  }

  // 6. Search
  console.log("\n--- Search ---");
  const results = lib.search("javascript");
  console.log(`  Search "javascript": ${results.length} result(s)`);
  for (const b of results) console.log(`    -> ${b}`);

  const byAuthor = lib.bookRepo.searchByAuthor("david");
  console.log(`  Search author "david": ${byAuthor.length} result(s)`);
  for (const b of byAuthor) console.log(`    -> ${b}`);

  // 7. Return a reserved book and see notification
  console.log("\n--- Return triggers reservation fulfillment ---");
  if (borrow2) {
    lib.returnBook(alice.id, borrow1.copy.copyId);
  }

  lib.displayCatalog();
  console.log("\n--- Done ---");
}

demo();
