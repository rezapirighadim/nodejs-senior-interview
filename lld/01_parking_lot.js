/**
 * ============================================================================
 * LOW-LEVEL DESIGN: Parking Lot System
 * ============================================================================
 *
 * Problem:
 *   Design a multi-floor parking lot that supports different vehicle types
 *   and spot sizes, with flexible pricing strategies.
 *
 * Key Concepts:
 *   - Enum-like constants for vehicle/spot types
 *   - Strategy pattern for pricing (hourly vs flat rate)
 *   - Single Responsibility: each class owns one concern
 *   - Composition over inheritance for flexible behavior
 *
 * Classes:
 *   VehicleType / SpotSize    -- enum-like frozen objects
 *   Vehicle                   -- motorcycle, car, truck/bus
 *   ParkingSpot               -- individual spot on a floor
 *   ParkingFloor              -- collection of spots
 *   ParkingLot                -- top-level facade
 *   PricingStrategy (base)    -- strategy interface
 *     HourlyPricing           -- per-hour rate
 *     FlatRatePricing         -- fixed fee per visit
 *   ParkingTicket             -- issued on entry, settled on exit
 *
 * Run: node 01_parking_lot.js
 * ============================================================================
 */

// ─── Enum-like Constants ────────────────────────────────────────────────────

/** @enum {string} */
const VehicleType = Object.freeze({
  MOTORCYCLE: "motorcycle",
  CAR: "car",
  TRUCK: "truck",
  BUS: "bus",
});

/** @enum {string} */
const SpotSize = Object.freeze({
  COMPACT: "compact",
  REGULAR: "regular",
  LARGE: "large",
});

/**
 * Maps each vehicle type to the minimum spot size it requires.
 * A vehicle can park in its required size or any larger size.
 * @type {Record<string, string>}
 */
const VEHICLE_SPOT_REQUIREMENT = Object.freeze({
  [VehicleType.MOTORCYCLE]: SpotSize.COMPACT,
  [VehicleType.CAR]: SpotSize.REGULAR,
  [VehicleType.TRUCK]: SpotSize.LARGE,
  [VehicleType.BUS]: SpotSize.LARGE,
});

/** Ordered list of spot sizes from smallest to largest. */
const SPOT_SIZE_ORDER = [SpotSize.COMPACT, SpotSize.REGULAR, SpotSize.LARGE];

// ─── Vehicle ────────────────────────────────────────────────────────────────

class Vehicle {
  /**
   * @param {string} licensePlate
   * @param {string} type - one of VehicleType values
   */
  constructor(licensePlate, type) {
    this.licensePlate = licensePlate;
    this.type = type;
  }

  /** @returns {string} the minimum spot size this vehicle needs */
  get requiredSpotSize() {
    return VEHICLE_SPOT_REQUIREMENT[this.type];
  }

  toString() {
    return `${this.type}[${this.licensePlate}]`;
  }
}

// ─── Parking Spot ───────────────────────────────────────────────────────────

class ParkingSpot {
  /**
   * @param {string} id     - unique spot identifier (e.g. "F1-C01")
   * @param {string} size   - one of SpotSize values
   */
  constructor(id, size) {
    this.id = id;
    this.size = size;
    /** @type {Vehicle | null} */
    this.vehicle = null;
  }

  get isAvailable() {
    return this.vehicle === null;
  }

  /**
   * Returns true if this spot can physically fit the given vehicle.
   * A vehicle can fit if the spot size is >= its required size.
   * @param {Vehicle} vehicle
   * @returns {boolean}
   */
  canFit(vehicle) {
    const requiredIdx = SPOT_SIZE_ORDER.indexOf(vehicle.requiredSpotSize);
    const spotIdx = SPOT_SIZE_ORDER.indexOf(this.size);
    return spotIdx >= requiredIdx;
  }

  /**
   * @param {Vehicle} vehicle
   * @returns {boolean} true if successfully parked
   */
  park(vehicle) {
    if (!this.isAvailable || !this.canFit(vehicle)) return false;
    this.vehicle = vehicle;
    return true;
  }

  /**
   * @returns {Vehicle | null} the vehicle that was parked, or null
   */
  unpark() {
    const v = this.vehicle;
    this.vehicle = null;
    return v;
  }
}

// ─── Parking Floor ──────────────────────────────────────────────────────────

class ParkingFloor {
  /**
   * @param {number} floorNumber
   * @param {{ compact?: number, regular?: number, large?: number }} spotCounts
   */
  constructor(floorNumber, { compact = 0, regular = 0, large = 0 } = {}) {
    this.floorNumber = floorNumber;
    /** @type {ParkingSpot[]} */
    this.spots = [];

    const addSpots = (size, count) => {
      for (let i = 0; i < count; i++) {
        const prefix = size[0].toUpperCase(); // C, R, L
        const id = `F${floorNumber}-${prefix}${String(i + 1).padStart(2, "0")}`;
        this.spots.push(new ParkingSpot(id, size));
      }
    };

    addSpots(SpotSize.COMPACT, compact);
    addSpots(SpotSize.REGULAR, regular);
    addSpots(SpotSize.LARGE, large);
  }

  /**
   * Find the first available spot that can fit the vehicle.
   * Prefers the smallest adequate spot to avoid waste.
   * @param {Vehicle} vehicle
   * @returns {ParkingSpot | null}
   */
  findAvailableSpot(vehicle) {
    return (
      this.spots.find((s) => s.isAvailable && s.canFit(vehicle)) ?? null
    );
  }

  /** @returns {{ compact: number, regular: number, large: number }} */
  getAvailableCounts() {
    const counts = { compact: 0, regular: 0, large: 0 };
    for (const s of this.spots) {
      if (s.isAvailable) counts[s.size]++;
    }
    return counts;
  }
}

// ─── Pricing Strategies ─────────────────────────────────────────────────────

/** @abstract */
class PricingStrategy {
  /**
   * @param {Date} entryTime
   * @param {Date} exitTime
   * @returns {number} fee in currency units
   */
  calculate(entryTime, exitTime) {
    throw new Error("PricingStrategy.calculate() must be overridden");
  }
}

class HourlyPricing extends PricingStrategy {
  /** @param {number} ratePerHour */
  constructor(ratePerHour) {
    super();
    this.ratePerHour = ratePerHour;
  }

  /** @override */
  calculate(entryTime, exitTime) {
    const hours = Math.ceil((exitTime - entryTime) / (1000 * 60 * 60));
    return Math.max(1, hours) * this.ratePerHour; // minimum 1 hour
  }

  toString() {
    return `Hourly @ $${this.ratePerHour}/hr`;
  }
}

class FlatRatePricing extends PricingStrategy {
  /** @param {number} flatFee */
  constructor(flatFee) {
    super();
    this.flatFee = flatFee;
  }

  /** @override */
  calculate(_entryTime, _exitTime) {
    return this.flatFee;
  }

  toString() {
    return `Flat rate @ $${this.flatFee}`;
  }
}

// ─── Parking Ticket ─────────────────────────────────────────────────────────

class ParkingTicket {
  static #nextId = 1;

  /**
   * @param {Vehicle} vehicle
   * @param {ParkingSpot} spot
   */
  constructor(vehicle, spot) {
    this.id = ParkingTicket.#nextId++;
    this.vehicle = vehicle;
    this.spot = spot;
    this.entryTime = new Date();
    /** @type {Date | null} */
    this.exitTime = null;
    /** @type {number | null} */
    this.fee = null;
  }

  get isSettled() {
    return this.exitTime !== null;
  }
}

// ─── Parking Lot (Facade) ───────────────────────────────────────────────────

class ParkingLot {
  /**
   * @param {string} name
   * @param {PricingStrategy} pricingStrategy
   */
  constructor(name, pricingStrategy) {
    this.name = name;
    /** @type {ParkingFloor[]} */
    this.floors = [];
    this.pricingStrategy = pricingStrategy;
    /** @type {Map<string, ParkingTicket>} licensePlate -> ticket */
    this.activeTickets = new Map();
  }

  /** @param {ParkingFloor} floor */
  addFloor(floor) {
    this.floors.push(floor);
  }

  /** @param {PricingStrategy} strategy */
  setPricingStrategy(strategy) {
    this.pricingStrategy = strategy;
  }

  /**
   * Park a vehicle in the first available suitable spot.
   * @param {Vehicle} vehicle
   * @returns {ParkingTicket | null} ticket or null if no spot found
   */
  parkVehicle(vehicle) {
    if (this.activeTickets.has(vehicle.licensePlate)) {
      console.log(`  [WARN] ${vehicle} is already parked.`);
      return null;
    }

    for (const floor of this.floors) {
      const spot = floor.findAvailableSpot(vehicle);
      if (spot) {
        spot.park(vehicle);
        const ticket = new ParkingTicket(vehicle, spot);
        this.activeTickets.set(vehicle.licensePlate, ticket);
        return ticket;
      }
    }

    console.log(`  [WARN] No available spot for ${vehicle}.`);
    return null;
  }

  /**
   * Unpark a vehicle and settle the ticket.
   * @param {string} licensePlate
   * @param {Date} [exitTime] - defaults to now
   * @returns {ParkingTicket | null} the settled ticket, or null
   */
  unparkVehicle(licensePlate, exitTime = new Date()) {
    const ticket = this.activeTickets.get(licensePlate);
    if (!ticket) {
      console.log(`  [WARN] No active ticket for plate "${licensePlate}".`);
      return null;
    }

    ticket.spot.unpark();
    ticket.exitTime = exitTime;
    ticket.fee = this.pricingStrategy.calculate(ticket.entryTime, exitTime);
    this.activeTickets.delete(licensePlate);
    return ticket;
  }

  /** Display available spots per floor. */
  displayAvailability() {
    console.log(`\n=== ${this.name} Availability ===`);
    for (const floor of this.floors) {
      const c = floor.getAvailableCounts();
      console.log(
        `  Floor ${floor.floorNumber}: ` +
          `Compact=${c.compact}, Regular=${c.regular}, Large=${c.large}`
      );
    }
  }

  /** @returns {number} total available spots across all floors */
  get totalAvailable() {
    let total = 0;
    for (const floor of this.floors) {
      const c = floor.getAvailableCounts();
      total += c.compact + c.regular + c.large;
    }
    return total;
  }
}

// ─── Demo ───────────────────────────────────────────────────────────────────

function demo() {
  console.log("╔══════════════════════════════════════════════╗");
  console.log("║       PARKING LOT SYSTEM  —  LLD DEMO       ║");
  console.log("╚══════════════════════════════════════════════╝\n");

  // 1. Create lot with hourly pricing
  const lot = new ParkingLot("Downtown Garage", new HourlyPricing(5));

  lot.addFloor(new ParkingFloor(1, { compact: 3, regular: 4, large: 2 }));
  lot.addFloor(new ParkingFloor(2, { compact: 2, regular: 3, large: 1 }));

  lot.displayAvailability();

  // 2. Park several vehicles
  console.log("\n--- Parking vehicles ---");
  const vehicles = [
    new Vehicle("MOTO-01", VehicleType.MOTORCYCLE),
    new Vehicle("CAR-100", VehicleType.CAR),
    new Vehicle("CAR-200", VehicleType.CAR),
    new Vehicle("TRUCK-1", VehicleType.TRUCK),
    new Vehicle("BUS-001", VehicleType.BUS),
    new Vehicle("MOTO-02", VehicleType.MOTORCYCLE),
  ];

  const tickets = [];
  for (const v of vehicles) {
    const ticket = lot.parkVehicle(v);
    if (ticket) {
      tickets.push(ticket);
      console.log(
        `  Parked ${v} -> spot ${ticket.spot.id} (ticket #${ticket.id})`
      );
    }
  }

  lot.displayAvailability();

  // 3. Try parking a duplicate
  console.log("\n--- Duplicate parking attempt ---");
  lot.parkVehicle(vehicles[0]);

  // 4. Unpark with hourly pricing
  console.log("\n--- Unparking with hourly pricing ---");
  const twoHoursLater = new Date(Date.now() + 2 * 60 * 60 * 1000);
  const settled1 = lot.unparkVehicle("CAR-100", twoHoursLater);
  if (settled1) {
    console.log(
      `  Ticket #${settled1.id} for ${settled1.vehicle}: ` +
        `fee = $${settled1.fee} (${lot.pricingStrategy})`
    );
  }

  // 5. Switch to flat-rate pricing and unpark another
  console.log("\n--- Switching to flat-rate pricing ---");
  lot.setPricingStrategy(new FlatRatePricing(15));

  const settled2 = lot.unparkVehicle("TRUCK-1", twoHoursLater);
  if (settled2) {
    console.log(
      `  Ticket #${settled2.id} for ${settled2.vehicle}: ` +
        `fee = $${settled2.fee} (${lot.pricingStrategy})`
    );
  }

  lot.displayAvailability();

  // 6. Fill up compact spots and show unavailability
  console.log("\n--- Filling up remaining compact spots ---");
  for (let i = 3; i <= 10; i++) {
    const moto = new Vehicle(`MOTO-${String(i).padStart(2, "0")}`, VehicleType.MOTORCYCLE);
    const t = lot.parkVehicle(moto);
    if (t) {
      console.log(`  Parked ${moto} -> spot ${t.spot.id}`);
    }
  }

  lot.displayAvailability();

  console.log("\n--- Done ---");
}

demo();
