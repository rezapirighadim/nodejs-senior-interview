/**
 * ============================================================================
 * LOW-LEVEL DESIGN: URL Shortener
 * ============================================================================
 *
 * Problem:
 *   Design a URL shortening service that converts long URLs to short codes,
 *   supports custom aliases, expiration (TTL), and click analytics.
 *
 * Key Concepts:
 *   - Base62 encoding for compact, URL-safe short codes
 *   - Repository pattern for URL storage
 *   - TTL management with lazy expiration checking
 *   - Analytics tracking (click count, last accessed, referrer)
 *
 * Classes:
 *   Base62Encoder    -- converts numeric IDs to base62 strings
 *   UrlEntry         -- stores original URL, short code, TTL, analytics
 *   ClickEvent       -- individual click record
 *   UrlRepository    -- in-memory storage with lookup by code/original
 *   UrlShortener     -- facade: shorten, resolve, analytics, cleanup
 *
 * Run: node 03_url_shortener.js
 * ============================================================================
 */

// ─── Base62 Encoder ─────────────────────────────────────────────────────────

const BASE62_CHARS = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

class Base62Encoder {
  /**
   * Encode a non-negative integer to a base62 string.
   * @param {number} num
   * @returns {string}
   */
  static encode(num) {
    if (num === 0) return BASE62_CHARS[0];
    let result = "";
    let n = num;
    while (n > 0) {
      result = BASE62_CHARS[n % 62] + result;
      n = Math.floor(n / 62);
    }
    return result;
  }

  /**
   * Decode a base62 string back to a number.
   * @param {string} str
   * @returns {number}
   */
  static decode(str) {
    let num = 0;
    for (const ch of str) {
      num = num * 62 + BASE62_CHARS.indexOf(ch);
    }
    return num;
  }
}

// ─── Click Event ────────────────────────────────────────────────────────────

class ClickEvent {
  /**
   * @param {string} [clientIp="unknown"]
   * @param {string} [referrer="direct"]
   */
  constructor(clientIp = "unknown", referrer = "direct") {
    this.timestamp = new Date();
    this.clientIp = clientIp;
    this.referrer = referrer;
  }
}

// ─── URL Entry ──────────────────────────────────────────────────────────────

class UrlEntry {
  /**
   * @param {string} originalUrl
   * @param {string} shortCode
   * @param {object} [options]
   * @param {number | null} [options.ttlSeconds] - time-to-live in seconds, null = never expires
   * @param {string} [options.createdBy]
   */
  constructor(originalUrl, shortCode, { ttlSeconds = null, createdBy = "anonymous" } = {}) {
    this.originalUrl = originalUrl;
    this.shortCode = shortCode;
    this.createdAt = new Date();
    this.createdBy = createdBy;

    /** @type {Date | null} */
    this.expiresAt = ttlSeconds
      ? new Date(this.createdAt.getTime() + ttlSeconds * 1000)
      : null;

    /** @type {ClickEvent[]} */
    this.clicks = [];
  }

  /** @returns {boolean} */
  get isExpired() {
    if (!this.expiresAt) return false;
    return new Date() > this.expiresAt;
  }

  /** @returns {number} */
  get clickCount() {
    return this.clicks.length;
  }

  /** @returns {Date | null} */
  get lastAccessed() {
    if (this.clicks.length === 0) return null;
    return this.clicks.at(-1).timestamp;
  }

  /**
   * Record a click.
   * @param {string} [clientIp]
   * @param {string} [referrer]
   */
  recordClick(clientIp, referrer) {
    this.clicks.push(new ClickEvent(clientIp, referrer));
  }

  /** @returns {object} analytics summary */
  getAnalytics() {
    const uniqueIps = new Set(this.clicks.map((c) => c.clientIp)).size;
    const referrerCounts = {};
    for (const c of this.clicks) {
      referrerCounts[c.referrer] = (referrerCounts[c.referrer] ?? 0) + 1;
    }

    return {
      shortCode: this.shortCode,
      originalUrl: this.originalUrl,
      totalClicks: this.clickCount,
      uniqueVisitors: uniqueIps,
      lastAccessed: this.lastAccessed,
      referrers: referrerCounts,
      createdAt: this.createdAt,
      expiresAt: this.expiresAt,
    };
  }
}

// ─── URL Repository ─────────────────────────────────────────────────────────

class UrlRepository {
  constructor() {
    /** @type {Map<string, UrlEntry>} shortCode -> UrlEntry */
    this.byCode = new Map();
    /** @type {Map<string, UrlEntry>} originalUrl -> UrlEntry */
    this.byOriginal = new Map();
  }

  /** @param {UrlEntry} entry */
  save(entry) {
    this.byCode.set(entry.shortCode, entry);
    this.byOriginal.set(entry.originalUrl, entry);
  }

  /** @param {string} code @returns {UrlEntry | undefined} */
  findByCode(code) {
    return this.byCode.get(code);
  }

  /** @param {string} url @returns {UrlEntry | undefined} */
  findByOriginalUrl(url) {
    return this.byOriginal.get(url);
  }

  /** @param {string} code @returns {boolean} */
  codeExists(code) {
    return this.byCode.has(code);
  }

  /** @param {string} code */
  delete(code) {
    const entry = this.byCode.get(code);
    if (entry) {
      this.byOriginal.delete(entry.originalUrl);
      this.byCode.delete(code);
    }
  }

  /** @returns {UrlEntry[]} all entries */
  getAll() {
    return [...this.byCode.values()];
  }
}

// ─── URL Shortener (Facade) ─────────────────────────────────────────────────

class UrlShortener {
  /**
   * @param {string} baseUrl - e.g. "https://short.ly"
   * @param {number} [minCodeLength=6]
   */
  constructor(baseUrl, minCodeLength = 6) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.minCodeLength = minCodeLength;
    this.repo = new UrlRepository();
    this.nextId = 100000; // start high so codes are always >= 3 chars
  }

  /**
   * Shorten a URL.
   * @param {string} originalUrl
   * @param {object} [options]
   * @param {string | null} [options.customAlias] - desired short code
   * @param {number | null} [options.ttlSeconds]
   * @param {string} [options.createdBy]
   * @returns {{ shortUrl: string, shortCode: string, entry: UrlEntry }}
   */
  shorten(originalUrl, { customAlias = null, ttlSeconds = null, createdBy = "anonymous" } = {}) {
    // Validate URL
    try {
      new URL(originalUrl);
    } catch {
      throw new Error(`Invalid URL: ${originalUrl}`);
    }

    // Check for existing non-expired mapping (only when no custom alias)
    if (!customAlias) {
      const existing = this.repo.findByOriginalUrl(originalUrl);
      if (existing && !existing.isExpired) {
        return {
          shortUrl: `${this.baseUrl}/${existing.shortCode}`,
          shortCode: existing.shortCode,
          entry: existing,
        };
      }
    }

    // Determine short code
    let code;
    if (customAlias) {
      if (this.repo.codeExists(customAlias)) {
        throw new Error(`Alias "${customAlias}" is already taken.`);
      }
      if (!/^[a-zA-Z0-9_-]+$/.test(customAlias)) {
        throw new Error(`Alias "${customAlias}" contains invalid characters.`);
      }
      code = customAlias;
    } else {
      code = this.#generateCode();
    }

    const entry = new UrlEntry(originalUrl, code, { ttlSeconds, createdBy });
    this.repo.save(entry);

    return {
      shortUrl: `${this.baseUrl}/${code}`,
      shortCode: code,
      entry,
    };
  }

  /**
   * Resolve a short code to the original URL. Records a click.
   * @param {string} code
   * @param {string} [clientIp]
   * @param {string} [referrer]
   * @returns {string | null} original URL or null if not found / expired
   */
  resolve(code, clientIp, referrer) {
    const entry = this.repo.findByCode(code);
    if (!entry) return null;

    if (entry.isExpired) {
      this.repo.delete(code);
      return null;
    }

    entry.recordClick(clientIp, referrer);
    return entry.originalUrl;
  }

  /**
   * Get analytics for a short code.
   * @param {string} code
   * @returns {object | null}
   */
  getAnalytics(code) {
    const entry = this.repo.findByCode(code);
    if (!entry) return null;
    return entry.getAnalytics();
  }

  /**
   * Delete a short URL.
   * @param {string} code
   * @returns {boolean}
   */
  delete(code) {
    if (!this.repo.codeExists(code)) return false;
    this.repo.delete(code);
    return true;
  }

  /**
   * Clean up all expired entries.
   * @returns {number} number of entries removed
   */
  cleanupExpired() {
    let count = 0;
    for (const entry of this.repo.getAll()) {
      if (entry.isExpired) {
        this.repo.delete(entry.shortCode);
        count++;
      }
    }
    return count;
  }

  /**
   * Generate a unique base62 code from an auto-incrementing ID.
   * @returns {string}
   */
  #generateCode() {
    let code;
    do {
      code = Base62Encoder.encode(this.nextId++);
      // Pad to minimum length if needed
      while (code.length < this.minCodeLength) code = "0" + code;
    } while (this.repo.codeExists(code));
    return code;
  }
}

// ─── Demo ───────────────────────────────────────────────────────────────────

function demo() {
  console.log("╔══════════════════════════════════════════════╗");
  console.log("║       URL SHORTENER  —  LLD DEMO            ║");
  console.log("╚══════════════════════════════════════════════╝\n");

  const shortener = new UrlShortener("https://short.ly");

  // 1. Shorten URLs
  console.log("--- Shorten URLs ---");
  const r1 = shortener.shorten("https://example.com/very/long/article/about/javascript");
  console.log(`  ${r1.shortUrl}  ->  ${r1.entry.originalUrl}`);

  const r2 = shortener.shorten("https://github.com/nodejs/node/issues/12345");
  console.log(`  ${r2.shortUrl}  ->  ${r2.entry.originalUrl}`);

  // 2. Custom alias
  console.log("\n--- Custom alias ---");
  const r3 = shortener.shorten("https://docs.google.com/very-long-doc-id", {
    customAlias: "my-doc",
    createdBy: "alice",
  });
  console.log(`  ${r3.shortUrl}  ->  ${r3.entry.originalUrl}`);

  // 3. Duplicate alias rejection
  console.log("\n--- Duplicate alias attempt ---");
  try {
    shortener.shorten("https://other.com", { customAlias: "my-doc" });
  } catch (e) {
    console.log(`  [Expected] ${e.message}`);
  }

  // 4. Resolve with click tracking
  console.log("\n--- Resolve & click tracking ---");
  const ips = ["192.168.1.1", "10.0.0.5", "192.168.1.1", "172.16.0.1"];
  const referrers = ["google.com", "direct", "twitter.com", "google.com"];
  for (let i = 0; i < ips.length; i++) {
    const url = shortener.resolve(r1.shortCode, ips[i], referrers[i]);
    console.log(`  Click ${i + 1} from ${ips[i]} (${referrers[i]}) -> ${url ? "OK" : "NOT FOUND"}`);
  }

  // 5. Analytics
  console.log("\n--- Analytics ---");
  const analytics = shortener.getAnalytics(r1.shortCode);
  console.log(`  Short code: ${analytics.shortCode}`);
  console.log(`  Total clicks: ${analytics.totalClicks}`);
  console.log(`  Unique visitors: ${analytics.uniqueVisitors}`);
  console.log(`  Referrers:`, analytics.referrers);
  console.log(`  Last accessed: ${analytics.lastAccessed}`);

  // 6. TTL / expiration
  console.log("\n--- TTL / Expiration ---");
  const r4 = shortener.shorten("https://temp-promo.example.com/sale", {
    ttlSeconds: 1, // expires in 1 second
    customAlias: "promo",
  });
  console.log(`  Created "${r4.shortCode}" with 1s TTL, expires: ${r4.entry.expiresAt}`);

  // Resolve immediately (should work)
  const immediate = shortener.resolve("promo");
  console.log(`  Resolve immediately: ${immediate ? "OK" : "EXPIRED"}`);

  // Simulate waiting by directly adjusting expiresAt for demo purposes
  r4.entry.expiresAt = new Date(Date.now() - 1000); // force expired
  const afterExpiry = shortener.resolve("promo");
  console.log(`  Resolve after expiry:  ${afterExpiry ? "OK" : "EXPIRED (cleaned up)"}`);

  // 7. Cleanup
  console.log("\n--- Cleanup expired ---");
  // Add another expired entry
  const r5 = shortener.shorten("https://old-campaign.com", { ttlSeconds: 1, customAlias: "old" });
  r5.entry.expiresAt = new Date(Date.now() - 5000);
  const cleaned = shortener.cleanupExpired();
  console.log(`  Cleaned up ${cleaned} expired entries.`);

  // 8. Base62 encoding verification
  console.log("\n--- Base62 Encoding ---");
  const testValues = [0, 1, 61, 62, 1000, 100000, 999999999];
  for (const v of testValues) {
    const encoded = Base62Encoder.encode(v);
    const decoded = Base62Encoder.decode(encoded);
    console.log(`  ${v} -> "${encoded}" -> ${decoded} ${v === decoded ? "(OK)" : "(MISMATCH!)"}`);
  }

  // 9. Idempotent shorten (same URL returns same code)
  console.log("\n--- Idempotent shorten ---");
  const r6 = shortener.shorten("https://github.com/nodejs/node/issues/12345");
  console.log(`  Same URL re-shortened: ${r6.shortCode} === ${r2.shortCode}? ${r6.shortCode === r2.shortCode}`);

  // 10. Delete
  console.log("\n--- Delete ---");
  const deleted = shortener.delete(r2.shortCode);
  console.log(`  Deleted "${r2.shortCode}": ${deleted}`);
  const gone = shortener.resolve(r2.shortCode);
  console.log(`  Resolve after delete: ${gone ?? "null (correctly removed)"}`);

  console.log("\n--- Done ---");
}

demo();
