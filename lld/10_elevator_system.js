/**
 * ============================================================================
 * LOW-LEVEL DESIGN: ELEVATOR SYSTEM
 * ============================================================================
 *
 * Problem:
 *   Design a multi-elevator system for a building.  Passengers press up/down
 *   on any floor; an elevator is dispatched.  Inside the elevator, passengers
 *   select destination floors.  The system must schedule stops efficiently.
 *
 * Key Design Patterns:
 *   - State Machine  -- elevator states: IDLE, MOVING_UP, MOVING_DOWN, DOORS_OPEN
 *   - Strategy       -- pluggable dispatch algorithm (nearest elevator, SCAN)
 *   - Observer       -- notify listeners on state changes
 *
 * Dispatch Strategies:
 *   1. NearestElevator  -- assign to the closest idle/compatible elevator
 *   2. SCAN (elevator algorithm) -- service floors in current direction, then
 *      reverse (like a disk arm)
 *
 * Scheduling:
 *   Each elevator maintains a sorted set of pending floor stops.  When the
 *   direction is UP, it processes in ascending order; DOWN in descending.
 *
 * Simulation:
 *   A step-based simulation: each call to `tick()` moves elevators one floor
 *   toward their next stop, opens/closes doors, and picks up waiting
 *   passengers.
 *
 * Run:  node 10_elevator_system.js
 * ============================================================================
 */

'use strict';

// ─── Enums ──────────────────────────────────────────────────────────────────

/** @enum {string} */
const Direction = Object.freeze({
  UP: 'UP',
  DOWN: 'DOWN',
  NONE: 'NONE',
});

/** @enum {string} */
const ElevatorState = Object.freeze({
  IDLE: 'IDLE',
  MOVING_UP: 'MOVING_UP',
  MOVING_DOWN: 'MOVING_DOWN',
  DOORS_OPEN: 'DOORS_OPEN',
  EMERGENCY_STOP: 'EMERGENCY_STOP',
});

// ─── Floor Request ──────────────────────────────────────────────────────────

/**
 * A request made from a hallway button (external).
 */
class FloorRequest {
  /**
   * @param {number}    floor
   * @param {Direction} direction  UP or DOWN
   */
  constructor(floor, direction) {
    this.floor = floor;
    this.direction = direction;
    this.timestamp = Date.now();
  }
}

// ─── Elevator ───────────────────────────────────────────────────────────────

/**
 * A single elevator car with state machine and stop queue.
 */
class Elevator {
  /**
   * @param {number} id
   * @param {number} minFloor
   * @param {number} maxFloor
   * @param {number} [startFloor]
   */
  constructor(id, minFloor, maxFloor, startFloor = minFloor) {
    /** @type {number} */
    this.id = id;
    /** @type {number} */
    this.minFloor = minFloor;
    /** @type {number} */
    this.maxFloor = maxFloor;
    /** @type {number} */
    this.currentFloor = startFloor;
    /** @type {ElevatorState} */
    this.state = ElevatorState.IDLE;
    /** @type {Direction} */
    this.direction = Direction.NONE;

    /**
     * Pending stops.  Stored as a Set for O(1) add/has/delete.
     * @type {Set<number>}
     */
    this.stops = new Set();

    /** @type {number} door open countdown (ticks remaining) */
    this._doorTimer = 0;

    /** @type {Array<(elevator: Elevator, event: string, data?: any) => void>} */
    this._observers = [];

    /** @type {number} total floors traveled (stats) */
    this.floorsTraveled = 0;
    /** @type {number} */
    this.stopsCompleted = 0;
  }

  // ── Observer ──────────────────────────────────────────────────────────

  /**
   * Register a listener.
   * @param {(elevator: Elevator, event: string, data?: any) => void} fn
   */
  onStateChange(fn) {
    this._observers.push(fn);
  }

  /** @param {string} event @param {*} [data] */
  _emit(event, data) {
    for (const fn of this._observers) {
      fn(this, event, data);
    }
  }

  // ── Public API ────────────────────────────────────────────────────────

  /**
   * Add a destination floor (from inside the elevator).
   * @param {number} floor
   */
  addStop(floor) {
    if (floor < this.minFloor || floor > this.maxFloor) return;
    if (floor === this.currentFloor) return;
    this.stops.add(floor);

    // If idle, start moving
    if (this.state === ElevatorState.IDLE) {
      this.direction = floor > this.currentFloor ? Direction.UP : Direction.DOWN;
      this.state =
        this.direction === Direction.UP ? ElevatorState.MOVING_UP : ElevatorState.MOVING_DOWN;
      this._emit('start', { floor });
    }
  }

  /**
   * Emergency stop -- halts all movement and clears the queue.
   */
  emergencyStop() {
    this.state = ElevatorState.EMERGENCY_STOP;
    this.direction = Direction.NONE;
    this.stops.clear();
    this._doorTimer = 0;
    this._emit('emergency_stop', { floor: this.currentFloor });
  }

  /**
   * Reset from emergency stop back to idle.
   */
  resetEmergency() {
    if (this.state !== ElevatorState.EMERGENCY_STOP) return;
    this.state = ElevatorState.IDLE;
    this._emit('emergency_reset', { floor: this.currentFloor });
  }

  /**
   * Advance the elevator by one simulation tick.
   *
   * State transitions:
   *   IDLE          -> (no-op, waiting for stops)
   *   DOORS_OPEN    -> decrement timer, then IDLE or resume moving
   *   MOVING_UP     -> move one floor up; if at stop, DOORS_OPEN
   *   MOVING_DOWN   -> move one floor down; if at stop, DOORS_OPEN
   *   EMERGENCY_STOP -> (no-op)
   */
  tick() {
    switch (this.state) {
      case ElevatorState.IDLE:
      case ElevatorState.EMERGENCY_STOP:
        return;

      case ElevatorState.DOORS_OPEN:
        this._doorTimer--;
        if (this._doorTimer <= 0) {
          this._closeDoors();
        }
        return;

      case ElevatorState.MOVING_UP:
        this.currentFloor++;
        this.floorsTraveled++;
        this._emit('floor_changed', { floor: this.currentFloor });

        if (this.stops.has(this.currentFloor)) {
          this._arriveAtStop();
        } else if (!this._hasStopsInDirection(Direction.UP)) {
          // No more stops ahead -- reverse or idle
          this._reverseOrIdle();
        }
        return;

      case ElevatorState.MOVING_DOWN:
        this.currentFloor--;
        this.floorsTraveled++;
        this._emit('floor_changed', { floor: this.currentFloor });

        if (this.stops.has(this.currentFloor)) {
          this._arriveAtStop();
        } else if (!this._hasStopsInDirection(Direction.DOWN)) {
          this._reverseOrIdle();
        }
        return;
    }
  }

  // ── Internal helpers ──────────────────────────────────────────────────

  _arriveAtStop() {
    this.stops.delete(this.currentFloor);
    this.stopsCompleted++;
    this.state = ElevatorState.DOORS_OPEN;
    this._doorTimer = 2; // doors stay open for 2 ticks
    this._emit('doors_open', { floor: this.currentFloor });
  }

  _closeDoors() {
    this._emit('doors_close', { floor: this.currentFloor });

    if (this.stops.size === 0) {
      this.state = ElevatorState.IDLE;
      this.direction = Direction.NONE;
      this._emit('idle', { floor: this.currentFloor });
      return;
    }

    // Continue in current direction if there are stops; otherwise reverse
    if (this._hasStopsInDirection(this.direction)) {
      this.state =
        this.direction === Direction.UP ? ElevatorState.MOVING_UP : ElevatorState.MOVING_DOWN;
    } else {
      this.direction = this.direction === Direction.UP ? Direction.DOWN : Direction.UP;
      this.state =
        this.direction === Direction.UP ? ElevatorState.MOVING_UP : ElevatorState.MOVING_DOWN;
    }
  }

  _reverseOrIdle() {
    if (this.stops.size === 0) {
      this.state = ElevatorState.IDLE;
      this.direction = Direction.NONE;
      this._emit('idle', { floor: this.currentFloor });
      return;
    }
    // Reverse direction
    this.direction = this.direction === Direction.UP ? Direction.DOWN : Direction.UP;
    this.state =
      this.direction === Direction.UP ? ElevatorState.MOVING_UP : ElevatorState.MOVING_DOWN;
    this._emit('direction_changed', { direction: this.direction });
  }

  /**
   * Check if there are any stops in the given direction from current floor.
   * @param {Direction} dir
   * @returns {boolean}
   */
  _hasStopsInDirection(dir) {
    for (const stop of this.stops) {
      if (dir === Direction.UP && stop > this.currentFloor) return true;
      if (dir === Direction.DOWN && stop < this.currentFloor) return true;
    }
    return false;
  }

  // ── Display ───────────────────────────────────────────────────────────

  toString() {
    const stops = [...this.stops].sort((a, b) => a - b).join(',') || 'none';
    return (
      `Elevator #${this.id}: floor=${this.currentFloor}, ` +
      `state=${this.state}, dir=${this.direction}, stops=[${stops}]`
    );
  }
}

// ─── Dispatch Strategies ────────────────────────────────────────────────────

/**
 * Strategy interface for elevator dispatch.
 * @abstract
 */
class DispatchStrategy {
  /**
   * Select the best elevator for a floor request.
   * @param {Elevator[]}  elevators
   * @param {FloorRequest} request
   * @returns {Elevator | null}
   */
  dispatch(elevators, request) {
    throw new Error('Subclass must implement dispatch()');
  }
}

/**
 * NearestElevatorStrategy -- pick the closest elevator that is:
 *   1. Idle, or
 *   2. Moving toward the request floor in a compatible direction
 *
 * Tie-break: prefer idle elevators.
 */
class NearestElevatorStrategy extends DispatchStrategy {
  dispatch(elevators, request) {
    let best = null;
    let bestScore = Infinity;

    for (const elev of elevators) {
      if (elev.state === ElevatorState.EMERGENCY_STOP) continue;

      const distance = Math.abs(elev.currentFloor - request.floor);
      let score = distance;

      if (elev.state === ElevatorState.IDLE) {
        // Idle elevator -- pure distance, slight preference
        score = distance;
      } else {
        // Moving elevator -- compatible if heading toward the request floor
        // in the same direction
        const headingToward =
          (elev.direction === Direction.UP && elev.currentFloor <= request.floor) ||
          (elev.direction === Direction.DOWN && elev.currentFloor >= request.floor);
        const sameDirection =
          (elev.direction === Direction.UP && request.direction === Direction.UP) ||
          (elev.direction === Direction.DOWN && request.direction === Direction.DOWN);

        if (headingToward && sameDirection) {
          score = distance; // good candidate
        } else {
          score = distance + 1000; // penalize
        }
      }

      if (score < bestScore) {
        bestScore = score;
        best = elev;
      }
    }

    return best;
  }
}

/**
 * SCANStrategy (elevator/disk-arm algorithm):
 *   Prefer an elevator already moving in the correct direction that
 *   will pass through the requested floor.  Otherwise fall back to nearest
 *   idle elevator.
 */
class SCANStrategy extends DispatchStrategy {
  dispatch(elevators, request) {
    // Phase 1: find elevators moving in request direction that will pass the floor
    const candidates = [];

    for (const elev of elevators) {
      if (elev.state === ElevatorState.EMERGENCY_STOP) continue;

      if (elev.state === ElevatorState.IDLE) {
        candidates.push({ elev, score: Math.abs(elev.currentFloor - request.floor) });
        continue;
      }

      const movingUp = elev.direction === Direction.UP;
      const wantUp = request.direction === Direction.UP;

      if (movingUp && wantUp && elev.currentFloor <= request.floor) {
        candidates.push({ elev, score: request.floor - elev.currentFloor });
      } else if (!movingUp && !wantUp && elev.currentFloor >= request.floor) {
        candidates.push({ elev, score: elev.currentFloor - request.floor });
      } else {
        // Penalize -- it will need to reverse
        candidates.push({
          elev,
          score: Math.abs(elev.currentFloor - request.floor) + 500,
        });
      }
    }

    candidates.sort((a, b) => a.score - b.score);
    return candidates.length > 0 ? candidates[0].elev : null;
  }
}

// ─── Elevator Controller (Facade) ──────────────────────────────────────────

/**
 * Manages multiple elevators and dispatches requests.
 */
class ElevatorController {
  /**
   * @param {Object} config
   * @param {number} config.numElevators
   * @param {number} config.minFloor
   * @param {number} config.maxFloor
   * @param {DispatchStrategy} [config.strategy]
   */
  constructor({ numElevators, minFloor, maxFloor, strategy }) {
    this.minFloor = minFloor;
    this.maxFloor = maxFloor;
    /** @type {DispatchStrategy} */
    this.strategy = strategy ?? new NearestElevatorStrategy();
    /** @type {Elevator[]} */
    this.elevators = [];
    /** @type {FloorRequest[]} */
    this._pendingRequests = [];
    /** @type {number} */
    this._tick = 0;

    for (let i = 0; i < numElevators; i++) {
      this.elevators.push(new Elevator(i + 1, minFloor, maxFloor, minFloor));
    }
  }

  /**
   * External request: someone on a floor presses the up/down button.
   * @param {number}    floor
   * @param {Direction} direction
   * @returns {Elevator | null}  the assigned elevator (null if none available)
   */
  requestElevator(floor, direction) {
    const request = new FloorRequest(floor, direction);
    const elevator = this.strategy.dispatch(this.elevators, request);

    if (!elevator) {
      this._pendingRequests.push(request);
      return null;
    }

    elevator.addStop(floor);
    return elevator;
  }

  /**
   * Internal request: a passenger inside an elevator selects a floor.
   * @param {number} elevatorId
   * @param {number} floor
   */
  selectFloor(elevatorId, floor) {
    const elevator = this.elevators.find((e) => e.id === elevatorId);
    if (!elevator) throw new Error(`Elevator #${elevatorId} not found`);
    elevator.addStop(floor);
  }

  /**
   * Advance the simulation by one tick.
   * Moves all elevators, retries pending requests.
   */
  tick() {
    this._tick++;

    for (const elev of this.elevators) {
      elev.tick();
    }

    // Retry pending requests
    const remaining = [];
    for (const req of this._pendingRequests) {
      const elevator = this.strategy.dispatch(this.elevators, req);
      if (elevator) {
        elevator.addStop(req.floor);
      } else {
        remaining.push(req);
      }
    }
    this._pendingRequests = remaining;
  }

  /**
   * Run the simulation for N ticks.
   * @param {number} n
   * @param {boolean} [verbose]
   */
  run(n, verbose = false) {
    for (let i = 0; i < n; i++) {
      this.tick();
      if (verbose) {
        console.log(`  [Tick ${this._tick}]`);
        this.displayStatus('    ');
      }
    }
  }

  /**
   * Emergency stop for a specific elevator.
   * @param {number} elevatorId
   */
  emergencyStop(elevatorId) {
    const elevator = this.elevators.find((e) => e.id === elevatorId);
    if (elevator) elevator.emergencyStop();
  }

  /**
   * Reset emergency for a specific elevator.
   * @param {number} elevatorId
   */
  resetEmergency(elevatorId) {
    const elevator = this.elevators.find((e) => e.id === elevatorId);
    if (elevator) elevator.resetEmergency();
  }

  /** Display the status of all elevators. */
  displayStatus(prefix = '') {
    for (const elev of this.elevators) {
      console.log(prefix + elev.toString());
    }
  }

  /** Get overall stats. */
  stats() {
    return this.elevators.map((e) => ({
      id: e.id,
      currentFloor: e.currentFloor,
      state: e.state,
      pendingStops: e.stops.size,
      floorsTraveled: e.floorsTraveled,
      stopsCompleted: e.stopsCompleted,
    }));
  }

  /**
   * Visual representation of the building and elevator positions.
   * @returns {string}
   */
  visualize() {
    const lines = [];
    lines.push('  ' + this.elevators.map((e) => `  E${e.id} `).join(''));
    lines.push('  ' + this.elevators.map(() => '------').join(''));

    for (let floor = this.maxFloor; floor >= this.minFloor; floor--) {
      const label = String(floor).padStart(2);
      const cells = this.elevators.map((e) => {
        if (e.currentFloor === floor) {
          if (e.state === ElevatorState.DOORS_OPEN) return ' [==] ';
          if (e.state === ElevatorState.EMERGENCY_STOP) return ' [!!] ';
          if (e.direction === Direction.UP) return '  /\\  ';
          if (e.direction === Direction.DOWN) return '  \\/  ';
          return '  --  ';
        }
        if (e.stops.has(floor)) return '  **  ';
        return '  ..  ';
      });
      lines.push(`${label}|${cells.join('')}`);
    }

    lines.push('  ' + this.elevators.map(() => '------').join(''));
    return lines.join('\n');
  }
}

// ============================================================================
// DEMO
// ============================================================================

function demo() {
  console.log('='.repeat(72));
  console.log(' ELEVATOR SYSTEM -- DEMO');
  console.log('='.repeat(72));

  // ── 1. Setup ──────────────────────────────────────────────────────────
  console.log('\n--- 1. Building Setup: 10 floors, 3 elevators ---');

  const controller = new ElevatorController({
    numElevators: 3,
    minFloor: 1,
    maxFloor: 10,
    strategy: new NearestElevatorStrategy(),
  });

  // Attach observer to elevator #1 for event logging
  controller.elevators[0].onStateChange((elev, event, data) => {
    if (['doors_open', 'idle', 'emergency_stop'].includes(event)) {
      console.log(`    >> E${elev.id} event: ${event} at floor ${data?.floor ?? '?'}`);
    }
  });

  controller.displayStatus('  ');
  console.log('\n' + controller.visualize());

  // ── 2. Basic requests ─────────────────────────────────────────────────
  console.log('\n--- 2. Basic Requests ---');

  // Person on floor 5 wants to go up
  console.log('Request: floor 5, UP');
  const assigned1 = controller.requestElevator(5, Direction.UP);
  console.log(`  Assigned to elevator #${assigned1?.id}`);

  // Person on floor 8 wants to go down
  console.log('Request: floor 8, DOWN');
  const assigned2 = controller.requestElevator(8, Direction.DOWN);
  console.log(`  Assigned to elevator #${assigned2?.id}`);

  // Person on floor 3 wants to go up
  console.log('Request: floor 3, UP');
  const assigned3 = controller.requestElevator(3, Direction.UP);
  console.log(`  Assigned to elevator #${assigned3?.id}`);

  console.log('\nInitial state after requests:');
  controller.displayStatus('  ');

  // ── 3. Simulate movement ──────────────────────────────────────────────
  console.log('\n--- 3. Simulate 5 ticks ---');
  controller.run(5, true);

  // ── 4. Passengers select destination floors ───────────────────────────
  console.log('\n--- 4. Passengers Select Floors ---');

  // Elevator 1 arrived at floor 5 -- passenger selects floor 9
  console.log('Passenger in E1 selects floor 9');
  controller.selectFloor(1, 9);

  // Elevator 2 heading to floor 8 -- will pick up, passenger wants floor 2
  console.log('Passenger in E2 selects floor 2');
  controller.selectFloor(2, 2);

  // Elevator 3 arrived at floor 3 -- passenger selects floor 7
  console.log('Passenger in E3 selects floor 7');
  controller.selectFloor(3, 7);

  console.log('\nAfter selections:');
  controller.displayStatus('  ');

  // ── 5. Run more ticks ─────────────────────────────────────────────────
  console.log('\n--- 5. Simulate 10 more ticks ---');
  controller.run(10, true);

  console.log('\n' + controller.visualize());

  // ── 6. Emergency stop ─────────────────────────────────────────────────
  console.log('\n--- 6. Emergency Stop ---');

  // Add a stop for elevator 2
  controller.selectFloor(2, 6);
  controller.run(1);
  console.log('Before emergency:');
  controller.displayStatus('  ');

  controller.emergencyStop(2);
  console.log('\nAfter emergency stop on E2:');
  controller.displayStatus('  ');

  controller.resetEmergency(2);
  console.log('\nAfter reset:');
  controller.displayStatus('  ');

  // ── 7. SCAN strategy ──────────────────────────────────────────────────
  console.log('\n--- 7. SCAN Strategy Demo ---');

  const scanController = new ElevatorController({
    numElevators: 2,
    minFloor: 1,
    maxFloor: 15,
    strategy: new SCANStrategy(),
  });

  // Manually position elevator 1 at floor 7 going up
  scanController.elevators[0].currentFloor = 7;
  scanController.elevators[0].addStop(10);

  // Manually position elevator 2 at floor 12 going down
  scanController.elevators[1].currentFloor = 12;
  scanController.elevators[1].addStop(5);

  console.log('Elevator positions: E1 at floor 7 (->10), E2 at floor 12 (->5)');

  // Request from floor 9 going up -- SCAN should prefer E1 (moving up, will pass floor 9)
  const scanAssigned = scanController.requestElevator(9, Direction.UP);
  console.log(`Request floor 9 UP -> assigned to E${scanAssigned?.id} (should be E1)`);

  // Request from floor 6 going down -- SCAN should prefer E2 (moving down, will pass floor 6)
  const scanAssigned2 = scanController.requestElevator(6, Direction.DOWN);
  console.log(`Request floor 6 DOWN -> assigned to E${scanAssigned2?.id} (should be E2)`);

  console.log('\nRunning 15 ticks...');
  scanController.run(15);

  console.log('\n' + scanController.visualize());

  // ── 8. Stats ──────────────────────────────────────────────────────────
  console.log('\n--- 8. Statistics ---');
  console.log('Main building:');
  console.table(controller.stats());

  console.log('SCAN building:');
  console.table(scanController.stats());

  // ── 9. Multiple requests at once ──────────────────────────────────────
  console.log('\n--- 9. Rush Hour: Many Requests ---');

  const rushController = new ElevatorController({
    numElevators: 3,
    minFloor: 1,
    maxFloor: 10,
  });

  // Morning rush: everyone going up from floor 1
  for (let dest = 3; dest <= 10; dest += 2) {
    rushController.requestElevator(1, Direction.UP);
  }

  // Assign destination floors across elevators
  rushController.selectFloor(1, 4);
  rushController.selectFloor(1, 7);
  rushController.selectFloor(2, 5);
  rushController.selectFloor(2, 9);
  rushController.selectFloor(3, 3);
  rushController.selectFloor(3, 10);

  console.log('Rush hour initial state:');
  controller.displayStatus('  ');

  console.log('\nRunning 20 ticks...');
  rushController.run(20);

  console.log('\nFinal positions:');
  rushController.displayStatus('  ');
  console.log('\n' + rushController.visualize());

  console.log('\n' + '='.repeat(72));
  console.log(' DEMO COMPLETE');
  console.log('='.repeat(72));
}

demo();
