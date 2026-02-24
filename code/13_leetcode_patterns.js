/**
 * ============================================================================
 * FILE 13: LeetCode Patterns for Senior Node.js Interviews
 * ============================================================================
 *
 * A comprehensive guide to the most common algorithmic patterns tested in
 * technical interviews. Each pattern includes 2-3 problems with detailed
 * explanations, time/space complexity analysis, and runnable demos.
 *
 * Run: node 13_leetcode_patterns.js
 *
 * Table of Contents:
 *   1.  Two Pointers
 *   2.  Sliding Window
 *   3.  Binary Search
 *   4.  Stack Patterns
 *   5.  Linked List
 *   6.  Tree Patterns
 *   7.  Graph Patterns
 *   8.  Dynamic Programming
 *   9.  Backtracking
 *   10. Merge Intervals
 *   11. Monotonic Stack
 *   12. Pattern Recognition Guide
 * ============================================================================
 */

'use strict';

// ============================================================================
// UTILITY: Simple test runner
// ============================================================================
const results = { passed: 0, failed: 0, total: 0 };

function assert(condition, message) {
  results.total++;
  if (condition) {
    results.passed++;
    console.log(`  PASS: ${message}`);
  } else {
    results.failed++;
    console.log(`  FAIL: ${message}`);
  }
}

function assertDeepEqual(actual, expected, message) {
  const isEqual = JSON.stringify(actual) === JSON.stringify(expected);
  assert(isEqual, `${message} | expected=${JSON.stringify(expected)}, got=${JSON.stringify(actual)}`);
}

function section(title) {
  console.log(`\n${'='.repeat(72)}`);
  console.log(`  ${title}`);
  console.log(`${'='.repeat(72)}`);
}

function subsection(title) {
  console.log(`\n  --- ${title} ---`);
}

// ============================================================================
// 1. TWO POINTERS
// ============================================================================
// When to use: sorted arrays, finding pairs/triplets, comparing from both ends
// Key idea: maintain two (or more) indices moving toward each other or apart

section('1. TWO POINTERS');

// ---------------------------------------------------------------------------
// 1a. Two Sum (Sorted Array) - LeetCode 167
// ---------------------------------------------------------------------------
// Given a SORTED array, find two numbers that add up to target.
// Return their 1-based indices.
//
// Why Two Pointers works: if sum < target, we need a bigger number (move left
// pointer right). If sum > target, we need a smaller number (move right
// pointer left).
//
// Time: O(n)   Space: O(1)

function twoSumSorted(numbers, target) {
  let left = 0;
  let right = numbers.length - 1;

  while (left < right) {
    const sum = numbers[left] + numbers[right];
    if (sum === target) {
      return [left + 1, right + 1]; // 1-indexed
    } else if (sum < target) {
      left++;   // Need larger sum
    } else {
      right--;  // Need smaller sum
    }
  }

  return []; // No solution found
}

subsection('1a. Two Sum (Sorted)');
assertDeepEqual(twoSumSorted([2, 7, 11, 15], 9), [1, 2], 'twoSumSorted([2,7,11,15], 9)');
assertDeepEqual(twoSumSorted([2, 3, 4], 6), [1, 3], 'twoSumSorted([2,3,4], 6)');
assertDeepEqual(twoSumSorted([-1, 0], -1), [1, 2], 'twoSumSorted([-1,0], -1)');

// ---------------------------------------------------------------------------
// 1b. Container With Most Water - LeetCode 11
// ---------------------------------------------------------------------------
// Given n vertical lines at positions 0..n-1 with heights[i], find two lines
// that together with the x-axis form a container with the most water.
//
// Greedy insight: start with widest container (left=0, right=n-1). The only
// way to potentially find a larger area is to move the shorter line inward,
// hoping to find a taller line.
//
// Time: O(n)   Space: O(1)

function maxArea(heights) {
  let left = 0;
  let right = heights.length - 1;
  let maxWater = 0;

  while (left < right) {
    const width = right - left;
    const height = Math.min(heights[left], heights[right]);
    maxWater = Math.max(maxWater, width * height);

    // Move the shorter side inward - the only way to potentially increase area
    if (heights[left] < heights[right]) {
      left++;
    } else {
      right--;
    }
  }

  return maxWater;
}

subsection('1b. Container With Most Water');
assert(maxArea([1, 8, 6, 2, 5, 4, 8, 3, 7]) === 49, 'maxArea standard case = 49');
assert(maxArea([1, 1]) === 1, 'maxArea([1,1]) = 1');
assert(maxArea([4, 3, 2, 1, 4]) === 16, 'maxArea([4,3,2,1,4]) = 16');

// ---------------------------------------------------------------------------
// 1c. 3Sum - LeetCode 15
// ---------------------------------------------------------------------------
// Find all unique triplets in array that sum to zero.
//
// Strategy: sort the array. For each element nums[i], use two pointers on the
// remaining subarray to find pairs that sum to -nums[i]. Skip duplicates at
// each level to avoid duplicate triplets.
//
// Time: O(n^2)   Space: O(1) excluding output (sorting is in-place)

function threeSum(nums) {
  nums.sort((a, b) => a - b);
  const result = [];

  for (let i = 0; i < nums.length - 2; i++) {
    // Skip duplicate values for i
    if (i > 0 && nums[i] === nums[i - 1]) continue;

    // Early termination: if smallest possible triplet > 0, done
    if (nums[i] > 0) break;

    let left = i + 1;
    let right = nums.length - 1;
    const target = -nums[i];

    while (left < right) {
      const sum = nums[left] + nums[right];
      if (sum === target) {
        result.push([nums[i], nums[left], nums[right]]);
        // Skip duplicates
        while (left < right && nums[left] === nums[left + 1]) left++;
        while (left < right && nums[right] === nums[right - 1]) right--;
        left++;
        right--;
      } else if (sum < target) {
        left++;
      } else {
        right--;
      }
    }
  }

  return result;
}

subsection('1c. 3Sum');
assertDeepEqual(
  threeSum([-1, 0, 1, 2, -1, -4]),
  [[-1, -1, 2], [-1, 0, 1]],
  '3Sum standard case'
);
assertDeepEqual(threeSum([0, 0, 0]), [[0, 0, 0]], '3Sum all zeros');
assertDeepEqual(threeSum([0, 1, 1]), [], '3Sum no solution');

// ============================================================================
// 2. SLIDING WINDOW
// ============================================================================
// When to use: contiguous subarray/substring problems, "maximum/minimum of
// size k", "longest/shortest with condition"
// Key idea: expand window by moving right pointer, shrink by moving left

section('2. SLIDING WINDOW');

// ---------------------------------------------------------------------------
// 2a. Maximum Sum Subarray of Size K
// ---------------------------------------------------------------------------
// Given an array and integer k, find the maximum sum of any contiguous
// subarray of size k.
//
// Fixed-size window: maintain running sum, add new element, subtract outgoing.
//
// Time: O(n)   Space: O(1)

function maxSumSubarray(arr, k) {
  if (arr.length < k) return null;

  // Compute initial window sum
  let windowSum = 0;
  for (let i = 0; i < k; i++) {
    windowSum += arr[i];
  }

  let maxSum = windowSum;

  // Slide the window: add right element, remove left element
  for (let i = k; i < arr.length; i++) {
    windowSum += arr[i] - arr[i - k];
    maxSum = Math.max(maxSum, windowSum);
  }

  return maxSum;
}

subsection('2a. Max Sum Subarray of Size K');
assert(maxSumSubarray([2, 1, 5, 1, 3, 2], 3) === 9, 'maxSumSubarray k=3 => 9');
assert(maxSumSubarray([2, 3, 4, 1, 5], 2) === 7, 'maxSumSubarray k=2 => 7');
assert(maxSumSubarray([1], 1) === 1, 'maxSumSubarray single element');

// ---------------------------------------------------------------------------
// 2b. Longest Substring Without Repeating Characters - LeetCode 3
// ---------------------------------------------------------------------------
// Find length of longest substring without repeating characters.
//
// Variable-size window: expand right, when duplicate found, shrink left until
// no duplicate. Use a Set (or Map) for O(1) character lookups.
//
// Time: O(n)   Space: O(min(n, alphabet_size))

function lengthOfLongestSubstring(s) {
  const charSet = new Set();
  let left = 0;
  let maxLen = 0;

  for (let right = 0; right < s.length; right++) {
    // Shrink window while we have a duplicate
    while (charSet.has(s[right])) {
      charSet.delete(s[left]);
      left++;
    }
    charSet.add(s[right]);
    maxLen = Math.max(maxLen, right - left + 1);
  }

  return maxLen;
}

// Optimized version using Map to jump left pointer directly
function lengthOfLongestSubstringOptimized(s) {
  const charIndex = new Map(); // char -> last seen index
  let left = 0;
  let maxLen = 0;

  for (let right = 0; right < s.length; right++) {
    if (charIndex.has(s[right]) && charIndex.get(s[right]) >= left) {
      left = charIndex.get(s[right]) + 1; // Jump past the duplicate
    }
    charIndex.set(s[right], right);
    maxLen = Math.max(maxLen, right - left + 1);
  }

  return maxLen;
}

subsection('2b. Longest Substring Without Repeating Chars');
assert(lengthOfLongestSubstring('abcabcbb') === 3, 'abcabcbb => 3');
assert(lengthOfLongestSubstring('bbbbb') === 1, 'bbbbb => 1');
assert(lengthOfLongestSubstring('pwwkew') === 3, 'pwwkew => 3');
assert(lengthOfLongestSubstringOptimized('abcabcbb') === 3, 'optimized: abcabcbb => 3');

// ---------------------------------------------------------------------------
// 2c. Minimum Window Substring - LeetCode 76
// ---------------------------------------------------------------------------
// Given strings s and t, find the minimum window in s that contains all
// characters of t. This is a classic hard sliding window problem.
//
// Strategy: use a frequency map of t. Expand right to include chars,
// shrink left to find minimum. Track "formed" count for efficiency.
//
// Time: O(|s| + |t|)   Space: O(|s| + |t|)

function minWindow(s, t) {
  if (t.length > s.length) return '';

  // Frequency of each char in t
  const need = new Map();
  for (const ch of t) {
    need.set(ch, (need.get(ch) ?? 0) + 1);
  }

  const required = need.size; // Number of unique chars in t we must satisfy
  let formed = 0;             // How many unique chars currently satisfied
  const windowCounts = new Map();

  let left = 0;
  let minLen = Infinity;
  let minStart = 0;

  for (let right = 0; right < s.length; right++) {
    const ch = s[right];
    windowCounts.set(ch, (windowCounts.get(ch) ?? 0) + 1);

    // Check if this char's frequency is now satisfied
    if (need.has(ch) && windowCounts.get(ch) === need.get(ch)) {
      formed++;
    }

    // Try to shrink the window while all chars are satisfied
    while (formed === required) {
      const windowLen = right - left + 1;
      if (windowLen < minLen) {
        minLen = windowLen;
        minStart = left;
      }

      // Remove left char from window
      const leftChar = s[left];
      windowCounts.set(leftChar, windowCounts.get(leftChar) - 1);
      if (need.has(leftChar) && windowCounts.get(leftChar) < need.get(leftChar)) {
        formed--;
      }
      left++;
    }
  }

  return minLen === Infinity ? '' : s.slice(minStart, minStart + minLen);
}

subsection('2c. Minimum Window Substring');
assert(minWindow('ADOBECODEBANC', 'ABC') === 'BANC', 'minWindow ADOBECODEBANC, ABC => BANC');
assert(minWindow('a', 'a') === 'a', 'minWindow single char match');
assert(minWindow('a', 'aa') === '', 'minWindow impossible');

// ============================================================================
// 3. BINARY SEARCH
// ============================================================================
// When to use: sorted data, monotonic function, "minimum/maximum that satisfies
// condition", search space reduction
// Key idea: eliminate half the search space each iteration

section('3. BINARY SEARCH');

// ---------------------------------------------------------------------------
// 3a. Search in Rotated Sorted Array - LeetCode 33
// ---------------------------------------------------------------------------
// Array was sorted then rotated. Find target in O(log n).
//
// Key insight: at least one half of the array is always sorted. Determine
// which half is sorted, then check if target lies in that sorted half.
//
// Time: O(log n)   Space: O(1)

function searchRotated(nums, target) {
  let left = 0;
  let right = nums.length - 1;

  while (left <= right) {
    const mid = left + Math.floor((right - left) / 2);

    if (nums[mid] === target) return mid;

    // Left half is sorted
    if (nums[left] <= nums[mid]) {
      if (nums[left] <= target && target < nums[mid]) {
        right = mid - 1; // Target in sorted left half
      } else {
        left = mid + 1;  // Target in right half
      }
    }
    // Right half is sorted
    else {
      if (nums[mid] < target && target <= nums[right]) {
        left = mid + 1;  // Target in sorted right half
      } else {
        right = mid - 1; // Target in left half
      }
    }
  }

  return -1; // Not found
}

subsection('3a. Search in Rotated Sorted Array');
assert(searchRotated([4, 5, 6, 7, 0, 1, 2], 0) === 4, 'rotated search finds 0 at index 4');
assert(searchRotated([4, 5, 6, 7, 0, 1, 2], 3) === -1, 'rotated search: 3 not found');
assert(searchRotated([1], 1) === 0, 'rotated search: single element');

// ---------------------------------------------------------------------------
// 3b. Find Peak Element - LeetCode 162
// ---------------------------------------------------------------------------
// A peak element is strictly greater than its neighbors. Find any peak.
// nums[-1] = nums[n] = -Infinity.
//
// Binary search works because if nums[mid] < nums[mid+1], a peak must exist
// on the right side (elements eventually decrease to -Infinity). Similarly
// for the left side.
//
// Time: O(log n)   Space: O(1)

function findPeakElement(nums) {
  let left = 0;
  let right = nums.length - 1;

  while (left < right) {
    const mid = left + Math.floor((right - left) / 2);

    if (nums[mid] < nums[mid + 1]) {
      left = mid + 1;  // Peak is to the right
    } else {
      right = mid;     // Peak is at mid or to the left
    }
  }

  return left; // left === right, that's the peak
}

subsection('3b. Find Peak Element');
assert(findPeakElement([1, 2, 3, 1]) === 2, 'peak at index 2');
assert([1, 5].includes(findPeakElement([1, 2, 1, 3, 5, 6, 4])), 'peak at 1 or 5');
assert(findPeakElement([1]) === 0, 'single element is peak');

// ---------------------------------------------------------------------------
// 3c. Koko Eating Bananas - LeetCode 875 (Binary Search on Answer)
// ---------------------------------------------------------------------------
// Koko has n piles of bananas. Guards return in h hours. She eats at speed k
// bananas/hour (one pile at a time, rounds up). Find minimum k so she finishes
// in h hours.
//
// Binary search on the answer (speed k). Range: [1, max(piles)].
// For each candidate k, check if she can finish in <= h hours.
//
// Time: O(n * log(max(piles)))   Space: O(1)

function minEatingSpeed(piles, h) {
  let left = 1;
  let right = Math.max(...piles);

  // Helper: can Koko finish with speed k in h hours?
  const canFinish = (k) => {
    let hours = 0;
    for (const pile of piles) {
      hours += Math.ceil(pile / k);
    }
    return hours <= h;
  };

  while (left < right) {
    const mid = left + Math.floor((right - left) / 2);
    if (canFinish(mid)) {
      right = mid;     // mid works, try slower
    } else {
      left = mid + 1;  // mid too slow
    }
  }

  return left;
}

subsection('3c. Koko Eating Bananas (Binary Search on Answer)');
assert(minEatingSpeed([3, 6, 7, 11], 8) === 4, 'koko [3,6,7,11] h=8 => 4');
assert(minEatingSpeed([30, 11, 23, 4, 20], 5) === 30, 'koko h=5 => 30');
assert(minEatingSpeed([30, 11, 23, 4, 20], 6) === 23, 'koko h=6 => 23');

// ============================================================================
// 4. STACK PATTERNS
// ============================================================================
// When to use: matching pairs, nested structures, "next greater/smaller",
// maintaining order with constraints

section('4. STACK PATTERNS');

// ---------------------------------------------------------------------------
// 4a. Valid Parentheses - LeetCode 20
// ---------------------------------------------------------------------------
// Given string of (){}[], determine if valid.
//
// Classic stack: push opening brackets, pop and match on closing brackets.
//
// Time: O(n)   Space: O(n)

function isValid(s) {
  const stack = [];
  const pairs = { ')': '(', '}': '{', ']': '[' };

  for (const ch of s) {
    if ('({['.includes(ch)) {
      stack.push(ch);
    } else {
      if (stack.length === 0 || stack.pop() !== pairs[ch]) {
        return false;
      }
    }
  }

  return stack.length === 0;
}

subsection('4a. Valid Parentheses');
assert(isValid('()[]{}') === true, 'valid mixed brackets');
assert(isValid('(]') === false, 'mismatched brackets');
assert(isValid('([)]') === false, 'interleaved brackets');
assert(isValid('{[]}') === true, 'nested brackets');

// ---------------------------------------------------------------------------
// 4b. Daily Temperatures - LeetCode 739
// ---------------------------------------------------------------------------
// Given daily temperatures, for each day find how many days until a warmer
// temperature. Output 0 if no warmer day exists.
//
// Monotonic decreasing stack: stack stores indices of days waiting for a
// warmer day. When we find a warmer day, we pop and compute the distance.
//
// Time: O(n)   Space: O(n)

function dailyTemperatures(temperatures) {
  const n = temperatures.length;
  const result = new Array(n).fill(0);
  const stack = []; // Stack of indices (decreasing temperature order)

  for (let i = 0; i < n; i++) {
    // Pop all days whose temperature is less than current
    while (stack.length > 0 && temperatures[i] > temperatures[stack.at(-1)]) {
      const prevDay = stack.pop();
      result[prevDay] = i - prevDay;
    }
    stack.push(i);
  }

  return result;
}

subsection('4b. Daily Temperatures');
assertDeepEqual(
  dailyTemperatures([73, 74, 75, 71, 69, 72, 76, 73]),
  [1, 1, 4, 2, 1, 1, 0, 0],
  'daily temps standard'
);
assertDeepEqual(dailyTemperatures([30, 40, 50, 60]), [1, 1, 1, 0], 'increasing temps');
assertDeepEqual(dailyTemperatures([30, 20, 10]), [0, 0, 0], 'decreasing temps');

// ---------------------------------------------------------------------------
// 4c. Min Stack - LeetCode 155
// ---------------------------------------------------------------------------
// Design a stack that supports push, pop, top, and getMin in O(1).
//
// Strategy: maintain a parallel stack that tracks the minimum at each level.
// When pushing, push the minimum of (new value, current min) onto the min stack.
//
// Time: O(1) for all operations   Space: O(n)

class MinStack {
  #stack = [];
  #minStack = [];

  push(val) {
    this.#stack.push(val);
    const currentMin = this.#minStack.length === 0
      ? val
      : Math.min(val, this.#minStack.at(-1));
    this.#minStack.push(currentMin);
  }

  pop() {
    this.#stack.pop();
    this.#minStack.pop();
  }

  top() {
    return this.#stack.at(-1);
  }

  getMin() {
    return this.#minStack.at(-1);
  }
}

subsection('4c. Min Stack');
const ms = new MinStack();
ms.push(-2);
ms.push(0);
ms.push(-3);
assert(ms.getMin() === -3, 'min is -3 after pushing -2,0,-3');
ms.pop();
assert(ms.top() === 0, 'top is 0 after popping -3');
assert(ms.getMin() === -2, 'min is -2 after popping -3');

// ============================================================================
// 5. LINKED LIST
// ============================================================================
// When to use: in-place manipulation, fast/slow pointers, dummy head trick

section('5. LINKED LIST');

class ListNode {
  constructor(val, next = null) {
    this.val = val;
    this.next = next;
  }
}

// Helper: array to linked list
function arrayToList(arr) {
  const dummy = new ListNode(0);
  let current = dummy;
  for (const val of arr) {
    current.next = new ListNode(val);
    current = current.next;
  }
  return dummy.next;
}

// Helper: linked list to array
function listToArray(head) {
  const result = [];
  while (head) {
    result.push(head.val);
    head = head.next;
  }
  return result;
}

// ---------------------------------------------------------------------------
// 5a. Reverse Linked List - LeetCode 206
// ---------------------------------------------------------------------------
// Reverse a singly linked list.
//
// Iterative: maintain prev, current, next pointers. At each step, reverse the
// current->next pointer to point to prev.
//
// Time: O(n)   Space: O(1) iterative, O(n) recursive

function reverseList(head) {
  let prev = null;
  let current = head;

  while (current) {
    const next = current.next; // Save next
    current.next = prev;       // Reverse pointer
    prev = current;            // Move prev forward
    current = next;            // Move current forward
  }

  return prev; // New head
}

// Recursive version (for completeness)
function reverseListRecursive(head) {
  if (!head || !head.next) return head;

  const newHead = reverseListRecursive(head.next);
  head.next.next = head; // The node after head should point back to head
  head.next = null;      // Remove old forward pointer
  return newHead;
}

subsection('5a. Reverse Linked List');
assertDeepEqual(listToArray(reverseList(arrayToList([1, 2, 3, 4, 5]))), [5, 4, 3, 2, 1], 'reverse [1,2,3,4,5]');
assertDeepEqual(listToArray(reverseList(arrayToList([1]))), [1], 'reverse single node');
assertDeepEqual(listToArray(reverseListRecursive(arrayToList([1, 2, 3]))), [3, 2, 1], 'reverse recursive');

// ---------------------------------------------------------------------------
// 5b. Detect Cycle (Linked List Cycle) - LeetCode 141
// ---------------------------------------------------------------------------
// Determine if a linked list has a cycle.
//
// Floyd's Tortoise and Hare: slow moves 1 step, fast moves 2 steps.
// If there's a cycle, they MUST meet. If fast reaches null, no cycle.
//
// Time: O(n)   Space: O(1)

function hasCycle(head) {
  let slow = head;
  let fast = head;

  while (fast && fast.next) {
    slow = slow.next;
    fast = fast.next.next;
    if (slow === fast) return true;
  }

  return false;
}

subsection('5b. Detect Cycle');
// Create a cycle for testing
const cycleList = arrayToList([3, 2, 0, -4]);
let cycleTail = cycleList;
while (cycleTail.next) cycleTail = cycleTail.next;
cycleTail.next = cycleList.next; // -4 -> 2 (cycle)
assert(hasCycle(cycleList) === true, 'detects cycle');
assert(hasCycle(arrayToList([1, 2, 3])) === false, 'no cycle in normal list');

// ---------------------------------------------------------------------------
// 5c. Merge Two Sorted Lists - LeetCode 21
// ---------------------------------------------------------------------------
// Merge two sorted linked lists into one sorted list.
//
// Dummy head technique: create a dummy node to simplify edge cases.
// Compare heads of both lists, append smaller one.
//
// Time: O(n + m)   Space: O(1) (reusing existing nodes)

function mergeTwoLists(l1, l2) {
  const dummy = new ListNode(0);
  let current = dummy;

  while (l1 && l2) {
    if (l1.val <= l2.val) {
      current.next = l1;
      l1 = l1.next;
    } else {
      current.next = l2;
      l2 = l2.next;
    }
    current = current.next;
  }

  // Attach remaining nodes
  current.next = l1 ?? l2;

  return dummy.next;
}

subsection('5c. Merge Two Sorted Lists');
assertDeepEqual(
  listToArray(mergeTwoLists(arrayToList([1, 2, 4]), arrayToList([1, 3, 4]))),
  [1, 1, 2, 3, 4, 4],
  'merge [1,2,4] + [1,3,4]'
);
assertDeepEqual(
  listToArray(mergeTwoLists(arrayToList([]), arrayToList([0]))),
  [0],
  'merge empty + [0]'
);

// ============================================================================
// 6. TREE PATTERNS
// ============================================================================
// When to use: hierarchical data, recursive subproblems, DFS/BFS traversal

section('6. TREE PATTERNS');

class TreeNode {
  constructor(val, left = null, right = null) {
    this.val = val;
    this.left = left;
    this.right = right;
  }
}

// Helper: build tree from array (level-order, null for missing nodes)
function buildTree(arr) {
  if (!arr.length || arr[0] === null) return null;

  const root = new TreeNode(arr[0]);
  const queue = [root];
  let i = 1;

  while (i < arr.length) {
    const node = queue.shift();
    if (i < arr.length && arr[i] !== null) {
      node.left = new TreeNode(arr[i]);
      queue.push(node.left);
    }
    i++;
    if (i < arr.length && arr[i] !== null) {
      node.right = new TreeNode(arr[i]);
      queue.push(node.right);
    }
    i++;
  }

  return root;
}

// ---------------------------------------------------------------------------
// 6a. Maximum Depth of Binary Tree - LeetCode 104
// ---------------------------------------------------------------------------
// Time: O(n)   Space: O(h) where h = height

function maxDepth(root) {
  if (!root) return 0;
  return 1 + Math.max(maxDepth(root.left), maxDepth(root.right));
}

// Iterative BFS version
function maxDepthBFS(root) {
  if (!root) return 0;
  let depth = 0;
  const queue = [root];

  while (queue.length > 0) {
    const levelSize = queue.length;
    for (let i = 0; i < levelSize; i++) {
      const node = queue.shift();
      if (node.left) queue.push(node.left);
      if (node.right) queue.push(node.right);
    }
    depth++;
  }

  return depth;
}

subsection('6a. Maximum Depth');
assert(maxDepth(buildTree([3, 9, 20, null, null, 15, 7])) === 3, 'maxDepth = 3');
assert(maxDepthBFS(buildTree([1, null, 2])) === 2, 'maxDepth BFS = 2');

// ---------------------------------------------------------------------------
// 6b. Level Order Traversal - LeetCode 102
// ---------------------------------------------------------------------------
// Return values level by level (BFS).
//
// Time: O(n)   Space: O(n)

function levelOrder(root) {
  if (!root) return [];
  const result = [];
  const queue = [root];

  while (queue.length > 0) {
    const levelSize = queue.length;
    const level = [];

    for (let i = 0; i < levelSize; i++) {
      const node = queue.shift();
      level.push(node.val);
      if (node.left) queue.push(node.left);
      if (node.right) queue.push(node.right);
    }

    result.push(level);
  }

  return result;
}

subsection('6b. Level Order Traversal');
assertDeepEqual(
  levelOrder(buildTree([3, 9, 20, null, null, 15, 7])),
  [[3], [9, 20], [15, 7]],
  'level order traversal'
);

// ---------------------------------------------------------------------------
// 6c. Validate BST - LeetCode 98
// ---------------------------------------------------------------------------
// Check if a binary tree is a valid Binary Search Tree.
//
// Key: every node must be within a valid range (min, max). Pass bounds down
// recursively. Left child must be < parent, right child must be > parent.
//
// Time: O(n)   Space: O(h)

function isValidBST(root, min = -Infinity, max = Infinity) {
  if (!root) return true;
  if (root.val <= min || root.val >= max) return false;
  return isValidBST(root.left, min, root.val) &&
         isValidBST(root.right, root.val, max);
}

subsection('6c. Validate BST');
assert(isValidBST(buildTree([2, 1, 3])) === true, '[2,1,3] is valid BST');
assert(isValidBST(buildTree([5, 1, 4, null, null, 3, 6])) === false, '[5,1,4,null,null,3,6] invalid');

// ---------------------------------------------------------------------------
// 6d. Lowest Common Ancestor - LeetCode 236
// ---------------------------------------------------------------------------
// Find LCA of two nodes p, q in a binary tree.
//
// Recursive: if current node is p or q, return it. Recurse left and right.
// If both sides return non-null, current node is the LCA.
//
// Time: O(n)   Space: O(h)

function lowestCommonAncestor(root, p, q) {
  if (!root || root.val === p || root.val === q) return root;

  const left = lowestCommonAncestor(root.left, p, q);
  const right = lowestCommonAncestor(root.right, p, q);

  if (left && right) return root;  // p and q are on different sides
  return left ?? right;             // Both on same side
}

subsection('6d. Lowest Common Ancestor');
const lcaTree = buildTree([3, 5, 1, 6, 2, 0, 8, null, null, 7, 4]);
const lcaResult = lowestCommonAncestor(lcaTree, 5, 1);
assert(lcaResult.val === 3, 'LCA(5,1) = 3');
const lcaResult2 = lowestCommonAncestor(lcaTree, 5, 4);
assert(lcaResult2.val === 5, 'LCA(5,4) = 5');

// ============================================================================
// 7. GRAPH PATTERNS
// ============================================================================
// When to use: connected components, shortest paths, dependency ordering,
// grid traversal

section('7. GRAPH PATTERNS');

// ---------------------------------------------------------------------------
// 7a. Number of Islands - LeetCode 200
// ---------------------------------------------------------------------------
// Given a 2D grid of '1' (land) and '0' (water), count the number of islands.
//
// BFS approach: for each unvisited '1', BFS to mark all connected land.
// Each BFS = one island.
//
// Time: O(m*n)   Space: O(m*n)

function numIslandsBFS(grid) {
  if (!grid.length) return 0;

  const rows = grid.length;
  const cols = grid[0].length;
  let count = 0;

  const bfs = (r, c) => {
    const queue = [[r, c]];
    grid[r][c] = '0'; // Mark visited

    const directions = [[1, 0], [-1, 0], [0, 1], [0, -1]];

    while (queue.length > 0) {
      const [row, col] = queue.shift();
      for (const [dr, dc] of directions) {
        const nr = row + dr;
        const nc = col + dc;
        if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && grid[nr][nc] === '1') {
          grid[nr][nc] = '0'; // Mark visited before queuing
          queue.push([nr, nc]);
        }
      }
    }
  };

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r][c] === '1') {
        count++;
        bfs(r, c);
      }
    }
  }

  return count;
}

// DFS approach (often simpler to write)
function numIslandsDFS(grid) {
  if (!grid.length) return 0;

  const rows = grid.length;
  const cols = grid[0].length;
  let count = 0;

  const dfs = (r, c) => {
    if (r < 0 || r >= rows || c < 0 || c >= cols || grid[r][c] === '0') return;
    grid[r][c] = '0'; // Mark visited
    dfs(r + 1, c);
    dfs(r - 1, c);
    dfs(r, c + 1);
    dfs(r, c - 1);
  };

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r][c] === '1') {
        count++;
        dfs(r, c);
      }
    }
  }

  return count;
}

subsection('7a. Number of Islands');
assert(numIslandsBFS([
  ['1', '1', '1', '1', '0'],
  ['1', '1', '0', '1', '0'],
  ['1', '1', '0', '0', '0'],
  ['0', '0', '0', '0', '0'],
]) === 1, 'BFS: 1 island');

assert(numIslandsDFS([
  ['1', '1', '0', '0', '0'],
  ['1', '1', '0', '0', '0'],
  ['0', '0', '1', '0', '0'],
  ['0', '0', '0', '1', '1'],
]) === 3, 'DFS: 3 islands');

// ---------------------------------------------------------------------------
// 7b. Course Schedule - LeetCode 207 (Topological Sort)
// ---------------------------------------------------------------------------
// There are numCourses courses with prerequisites. Determine if you can
// finish all courses (i.e., no cycle in prerequisite graph).
//
// Kahn's Algorithm (BFS topological sort):
// 1. Compute in-degree for each node
// 2. Start with all nodes having in-degree 0
// 3. Process queue: for each node, reduce in-degree of neighbors
// 4. If all nodes processed, no cycle exists
//
// Time: O(V + E)   Space: O(V + E)

function canFinish(numCourses, prerequisites) {
  // Build adjacency list and in-degree array
  const adj = Array.from({ length: numCourses }, () => []);
  const inDegree = new Array(numCourses).fill(0);

  for (const [course, prereq] of prerequisites) {
    adj[prereq].push(course);
    inDegree[course]++;
  }

  // Start with all courses that have no prerequisites
  const queue = [];
  for (let i = 0; i < numCourses; i++) {
    if (inDegree[i] === 0) queue.push(i);
  }

  let completed = 0;

  while (queue.length > 0) {
    const course = queue.shift();
    completed++;

    for (const next of adj[course]) {
      inDegree[next]--;
      if (inDegree[next] === 0) {
        queue.push(next);
      }
    }
  }

  return completed === numCourses;
}

// DFS cycle detection (alternative approach)
function canFinishDFS(numCourses, prerequisites) {
  const adj = Array.from({ length: numCourses }, () => []);
  for (const [course, prereq] of prerequisites) {
    adj[prereq].push(course);
  }

  // 0 = unvisited, 1 = in current path (gray), 2 = fully processed (black)
  const state = new Array(numCourses).fill(0);

  const hasCycle = (node) => {
    if (state[node] === 1) return true;  // Back edge = cycle
    if (state[node] === 2) return false; // Already fully processed

    state[node] = 1; // Mark as being processed

    for (const neighbor of adj[node]) {
      if (hasCycle(neighbor)) return true;
    }

    state[node] = 2; // Mark as fully processed
    return false;
  };

  for (let i = 0; i < numCourses; i++) {
    if (hasCycle(i)) return false;
  }

  return true;
}

subsection('7b. Course Schedule (Topological Sort)');
assert(canFinish(2, [[1, 0]]) === true, 'can finish: 0->1');
assert(canFinish(2, [[1, 0], [0, 1]]) === false, 'cannot finish: cycle');
assert(canFinishDFS(4, [[1, 0], [2, 0], [3, 1], [3, 2]]) === true, 'DFS: diamond dependency');

// ============================================================================
// 8. DYNAMIC PROGRAMMING
// ============================================================================
// When to use: overlapping subproblems + optimal substructure
// Approach: define state, recurrence relation, base cases
// Bottom-up (tabulation) vs Top-down (memoization)

section('8. DYNAMIC PROGRAMMING');

// ---------------------------------------------------------------------------
// 8a. Climbing Stairs - LeetCode 70
// ---------------------------------------------------------------------------
// You can climb 1 or 2 steps. How many distinct ways to reach the top?
// This is essentially Fibonacci.
//
// State: dp[i] = number of ways to reach step i
// Recurrence: dp[i] = dp[i-1] + dp[i-2]
// Base: dp[0] = 1, dp[1] = 1
//
// Time: O(n)   Space: O(1) optimized

function climbStairs(n) {
  if (n <= 2) return n;

  let prev2 = 1; // dp[i-2]
  let prev1 = 2; // dp[i-1]

  for (let i = 3; i <= n; i++) {
    const current = prev1 + prev2;
    prev2 = prev1;
    prev1 = current;
  }

  return prev1;
}

subsection('8a. Climbing Stairs');
assert(climbStairs(2) === 2, 'climbStairs(2) = 2');
assert(climbStairs(3) === 3, 'climbStairs(3) = 3');
assert(climbStairs(5) === 8, 'climbStairs(5) = 8');

// ---------------------------------------------------------------------------
// 8b. Coin Change - LeetCode 322
// ---------------------------------------------------------------------------
// Given coins of different denominations and an amount, find the fewest
// coins needed. Return -1 if impossible.
//
// State: dp[amount] = min coins to make that amount
// Recurrence: dp[i] = min(dp[i - coin] + 1) for each coin
// Base: dp[0] = 0
//
// Time: O(amount * coins.length)   Space: O(amount)

function coinChange(coins, amount) {
  const dp = new Array(amount + 1).fill(Infinity);
  dp[0] = 0;

  for (let i = 1; i <= amount; i++) {
    for (const coin of coins) {
      if (coin <= i && dp[i - coin] !== Infinity) {
        dp[i] = Math.min(dp[i], dp[i - coin] + 1);
      }
    }
  }

  return dp[amount] === Infinity ? -1 : dp[amount];
}

subsection('8b. Coin Change');
assert(coinChange([1, 5, 10, 25], 30) === 2, 'coinChange 30 cents = 2 (25+5)');
assert(coinChange([2], 3) === -1, 'coinChange impossible');
assert(coinChange([1], 0) === 0, 'coinChange amount=0');

// ---------------------------------------------------------------------------
// 8c. Longest Increasing Subsequence - LeetCode 300
// ---------------------------------------------------------------------------
// Find length of the longest strictly increasing subsequence.
//
// O(n^2) DP approach:
// State: dp[i] = length of LIS ending at index i
// Recurrence: dp[i] = max(dp[j] + 1) for all j < i where nums[j] < nums[i]
//
// O(n log n) approach with patience sorting (binary search):
// Maintain array of smallest tail elements for each LIS length.

// O(n^2) version
function lengthOfLIS(nums) {
  const n = nums.length;
  const dp = new Array(n).fill(1); // Each element is an LIS of length 1

  for (let i = 1; i < n; i++) {
    for (let j = 0; j < i; j++) {
      if (nums[j] < nums[i]) {
        dp[i] = Math.max(dp[i], dp[j] + 1);
      }
    }
  }

  return Math.max(...dp);
}

// O(n log n) version using binary search
function lengthOfLISOptimized(nums) {
  const tails = []; // tails[i] = smallest tail element for LIS of length i+1

  for (const num of nums) {
    // Binary search for the position to replace
    let left = 0;
    let right = tails.length;

    while (left < right) {
      const mid = left + Math.floor((right - left) / 2);
      if (tails[mid] < num) {
        left = mid + 1;
      } else {
        right = mid;
      }
    }

    if (left === tails.length) {
      tails.push(num); // Extend LIS
    } else {
      tails[left] = num; // Replace with smaller tail
    }
  }

  return tails.length;
}

subsection('8c. Longest Increasing Subsequence');
assert(lengthOfLIS([10, 9, 2, 5, 3, 7, 101, 18]) === 4, 'LIS O(n^2) = 4');
assert(lengthOfLISOptimized([10, 9, 2, 5, 3, 7, 101, 18]) === 4, 'LIS O(n log n) = 4');
assert(lengthOfLISOptimized([0, 1, 0, 3, 2, 3]) === 4, 'LIS [0,1,0,3,2,3] = 4');

// ---------------------------------------------------------------------------
// 8d. 0/1 Knapsack
// ---------------------------------------------------------------------------
// Given items with weights and values, and a capacity W, maximize total value
// without exceeding capacity. Each item can be taken at most once.
//
// State: dp[i][w] = max value using first i items with capacity w
// Recurrence: dp[i][w] = max(dp[i-1][w], dp[i-1][w - weight[i]] + value[i])
// Optimized to 1D: dp[w] = max value with capacity w
//
// Time: O(n * W)   Space: O(W)

function knapsack01(weights, values, capacity) {
  const n = weights.length;
  const dp = new Array(capacity + 1).fill(0);

  for (let i = 0; i < n; i++) {
    // Traverse right to left to avoid using same item twice
    for (let w = capacity; w >= weights[i]; w--) {
      dp[w] = Math.max(dp[w], dp[w - weights[i]] + values[i]);
    }
  }

  return dp[capacity];
}

subsection('8d. 0/1 Knapsack');
assert(knapsack01([1, 3, 4, 5], [1, 4, 5, 7], 7) === 9, 'knapsack capacity=7 => 9');
assert(knapsack01([2, 3, 4, 5], [3, 4, 5, 6], 5) === 7, 'knapsack capacity=5 => 7');

// ============================================================================
// 9. BACKTRACKING
// ============================================================================
// When to use: generate all combinations/permutations/subsets, constraint
// satisfaction, "find all solutions"
// Template: make choice, recurse, undo choice

section('9. BACKTRACKING');

// ---------------------------------------------------------------------------
// 9a. Permutations - LeetCode 46
// ---------------------------------------------------------------------------
// Given an array of distinct integers, return all permutations.
//
// Time: O(n! * n)   Space: O(n) for recursion stack

function permutations(nums) {
  const result = [];

  const backtrack = (current, remaining) => {
    if (remaining.length === 0) {
      result.push([...current]);
      return;
    }

    for (let i = 0; i < remaining.length; i++) {
      current.push(remaining[i]);
      backtrack(
        current,
        [...remaining.slice(0, i), ...remaining.slice(i + 1)]
      );
      current.pop(); // Undo choice
    }
  };

  backtrack([], nums);
  return result;
}

// Swap-based (in-place, more efficient)
function permutationsSwap(nums) {
  const result = [];

  const backtrack = (start) => {
    if (start === nums.length) {
      result.push([...nums]);
      return;
    }

    for (let i = start; i < nums.length; i++) {
      [nums[start], nums[i]] = [nums[i], nums[start]]; // Swap
      backtrack(start + 1);
      [nums[start], nums[i]] = [nums[i], nums[start]]; // Undo swap
    }
  };

  backtrack(0);
  return result;
}

subsection('9a. Permutations');
assert(permutations([1, 2, 3]).length === 6, 'permutations of [1,2,3] = 6');
assert(permutationsSwap([1, 2]).length === 2, 'swap permutations of [1,2] = 2');

// ---------------------------------------------------------------------------
// 9b. Subsets - LeetCode 78
// ---------------------------------------------------------------------------
// Given an array of distinct integers, return all possible subsets.
//
// At each index, we choose to include or exclude the element.
//
// Time: O(2^n * n)   Space: O(n)

function subsets(nums) {
  const result = [];

  const backtrack = (start, current) => {
    result.push([...current]); // Every partial combination is a valid subset

    for (let i = start; i < nums.length; i++) {
      current.push(nums[i]);
      backtrack(i + 1, current);
      current.pop();
    }
  };

  backtrack(0, []);
  return result;
}

// Iterative approach: build up subsets
function subsetsIterative(nums) {
  let result = [[]];

  for (const num of nums) {
    result = [...result, ...result.map(subset => [...subset, num])];
  }

  return result;
}

subsection('9b. Subsets');
assert(subsets([1, 2, 3]).length === 8, 'subsets of [1,2,3] = 8 (2^3)');
assert(subsetsIterative([1, 2]).length === 4, 'iterative subsets of [1,2] = 4');

// ---------------------------------------------------------------------------
// 9c. Combination Sum - LeetCode 39
// ---------------------------------------------------------------------------
// Given array of distinct integers and a target, find all unique combinations
// that sum to target. Same number can be used unlimited times.
//
// Time: O(2^target) roughly   Space: O(target)

function combinationSum(candidates, target) {
  const result = [];

  const backtrack = (start, remaining, current) => {
    if (remaining === 0) {
      result.push([...current]);
      return;
    }
    if (remaining < 0) return;

    for (let i = start; i < candidates.length; i++) {
      current.push(candidates[i]);
      backtrack(i, remaining - candidates[i], current); // i, not i+1 (reuse allowed)
      current.pop();
    }
  };

  backtrack(0, target, []);
  return result;
}

subsection('9c. Combination Sum');
const combResult = combinationSum([2, 3, 6, 7], 7);
assert(combResult.length === 2, 'combinationSum [2,3,6,7] target=7 => 2 combinations');
assertDeepEqual(combResult, [[2, 2, 3], [7]], 'combinations are [[2,2,3],[7]]');

// ============================================================================
// 10. MERGE INTERVALS
// ============================================================================
// When to use: overlapping ranges, scheduling, time-based problems
// Key idea: sort by start time, then merge or insert

section('10. MERGE INTERVALS');

// ---------------------------------------------------------------------------
// 10a. Merge Overlapping Intervals - LeetCode 56
// ---------------------------------------------------------------------------
// Given a collection of intervals, merge all overlapping intervals.
//
// Strategy: sort by start time. If current interval overlaps with the last
// merged interval, extend it. Otherwise, add a new interval.
//
// Time: O(n log n)   Space: O(n)

function mergeIntervals(intervals) {
  if (intervals.length <= 1) return intervals;

  // Sort by start time
  intervals.sort((a, b) => a[0] - b[0]);

  const merged = [intervals[0]];

  for (let i = 1; i < intervals.length; i++) {
    const last = merged.at(-1);
    const current = intervals[i];

    if (current[0] <= last[1]) {
      // Overlapping: extend the end
      last[1] = Math.max(last[1], current[1]);
    } else {
      // Non-overlapping: add new interval
      merged.push(current);
    }
  }

  return merged;
}

subsection('10a. Merge Overlapping Intervals');
assertDeepEqual(
  mergeIntervals([[1, 3], [2, 6], [8, 10], [15, 18]]),
  [[1, 6], [8, 10], [15, 18]],
  'merge [[1,3],[2,6],[8,10],[15,18]]'
);
assertDeepEqual(
  mergeIntervals([[1, 4], [4, 5]]),
  [[1, 5]],
  'merge touching intervals'
);

// ---------------------------------------------------------------------------
// 10b. Insert Interval - LeetCode 57
// ---------------------------------------------------------------------------
// Given sorted non-overlapping intervals and a new interval, insert it and
// merge if necessary.
//
// Three phases:
// 1. Add all intervals that end before new interval starts
// 2. Merge all overlapping intervals with new interval
// 3. Add all remaining intervals
//
// Time: O(n)   Space: O(n)

function insertInterval(intervals, newInterval) {
  const result = [];
  let i = 0;
  const n = intervals.length;

  // Phase 1: intervals completely before newInterval
  while (i < n && intervals[i][1] < newInterval[0]) {
    result.push(intervals[i]);
    i++;
  }

  // Phase 2: overlapping intervals - merge
  while (i < n && intervals[i][0] <= newInterval[1]) {
    newInterval[0] = Math.min(newInterval[0], intervals[i][0]);
    newInterval[1] = Math.max(newInterval[1], intervals[i][1]);
    i++;
  }
  result.push(newInterval);

  // Phase 3: intervals completely after newInterval
  while (i < n) {
    result.push(intervals[i]);
    i++;
  }

  return result;
}

subsection('10b. Insert Interval');
assertDeepEqual(
  insertInterval([[1, 3], [6, 9]], [2, 5]),
  [[1, 5], [6, 9]],
  'insert [2,5] into [[1,3],[6,9]]'
);
assertDeepEqual(
  insertInterval([[1, 2], [3, 5], [6, 7], [8, 10], [12, 16]], [4, 8]),
  [[1, 2], [3, 10], [12, 16]],
  'insert [4,8] with multiple merges'
);

// ============================================================================
// 11. MONOTONIC STACK
// ============================================================================
// When to use: "next greater/smaller element", "largest rectangle",
// "stock span" type problems
// Key idea: maintain stack in increasing or decreasing order

section('11. MONOTONIC STACK');

// ---------------------------------------------------------------------------
// 11a. Next Greater Element - LeetCode 496/503
// ---------------------------------------------------------------------------
// For each element, find the next element that is greater (to the right).
// Return -1 if no such element exists.
//
// Monotonic decreasing stack: when we find an element larger than stack top,
// it's the "next greater" for that top element.
//
// Time: O(n)   Space: O(n)

function nextGreaterElement(nums) {
  const n = nums.length;
  const result = new Array(n).fill(-1);
  const stack = []; // Stack of indices (decreasing value order)

  for (let i = 0; i < n; i++) {
    while (stack.length > 0 && nums[i] > nums[stack.at(-1)]) {
      const idx = stack.pop();
      result[idx] = nums[i];
    }
    stack.push(i);
  }

  return result;
}

// Circular version (LeetCode 503): treat array as circular
function nextGreaterElementCircular(nums) {
  const n = nums.length;
  const result = new Array(n).fill(-1);
  const stack = [];

  // Traverse the array twice to handle circular nature
  for (let i = 0; i < 2 * n; i++) {
    const idx = i % n;
    while (stack.length > 0 && nums[idx] > nums[stack.at(-1)]) {
      result[stack.pop()] = nums[idx];
    }
    if (i < n) stack.push(i); // Only push indices from first pass
  }

  return result;
}

subsection('11a. Next Greater Element');
assertDeepEqual(
  nextGreaterElement([2, 1, 2, 4, 3]),
  [4, 2, 4, -1, -1],
  'next greater [2,1,2,4,3]'
);
assertDeepEqual(
  nextGreaterElementCircular([1, 2, 1]),
  [2, -1, 2],
  'circular next greater [1,2,1]'
);

// ---------------------------------------------------------------------------
// 11b. Largest Rectangle in Histogram - LeetCode 84
// ---------------------------------------------------------------------------
// Given an array of bar heights, find the largest rectangle that can be formed.
//
// For each bar, we need to know: how far left and right it can extend as the
// shortest bar. Use monotonic increasing stack.
//
// When we pop a bar from the stack (because current bar is shorter), we know:
// - The popped bar's height is the limiting height
// - Width extends from the new stack top + 1 to current index - 1
//
// Time: O(n)   Space: O(n)

function largestRectangleArea(heights) {
  const stack = []; // Monotonic increasing stack of indices
  let maxArea = 0;
  const n = heights.length;

  for (let i = 0; i <= n; i++) {
    const currentHeight = i === n ? 0 : heights[i]; // Sentinel to flush stack

    while (stack.length > 0 && currentHeight < heights[stack.at(-1)]) {
      const height = heights[stack.pop()];
      const width = stack.length === 0 ? i : i - stack.at(-1) - 1;
      maxArea = Math.max(maxArea, height * width);
    }

    stack.push(i);
  }

  return maxArea;
}

subsection('11b. Largest Rectangle in Histogram');
assert(largestRectangleArea([2, 1, 5, 6, 2, 3]) === 10, 'largest rect = 10');
assert(largestRectangleArea([2, 4]) === 4, 'largest rect [2,4] = 4');
assert(largestRectangleArea([1, 1, 1, 1]) === 4, 'uniform heights = 4');

// ============================================================================
// 12. PATTERN RECOGNITION GUIDE
// ============================================================================

section('12. PATTERN RECOGNITION GUIDE');

const patternGuide = `
  ============================================================
  "WHEN YOU SEE X, THINK Y" - Pattern Recognition Cheat Sheet
  ============================================================

  ARRAY / STRING PATTERNS
  ---------------------------------------------------------------
  When you see...                  | Think...
  ---------------------------------|-----------------------------
  Sorted array + find pair         | Two Pointers
  Find triplet (3sum)              | Sort + Two Pointers
  Contiguous subarray (max/min)    | Sliding Window
  Subarray sum equals K            | Prefix Sum + HashMap
  "Top K" or "K-th largest"        | Heap (Priority Queue)
  Frequencies / counts             | HashMap / Counter
  String anagram / permutation     | Sliding Window + HashMap

  BINARY SEARCH VARIANTS
  ---------------------------------------------------------------
  Sorted array + search            | Standard Binary Search
  "Minimum that satisfies..."      | Binary Search on Answer
  Rotated sorted array             | Modified Binary Search
  Find boundary / transition       | Binary Search (leftmost/rightmost)
  Unknown size sorted data         | Exponential Search

  LINKED LIST PATTERNS
  ---------------------------------------------------------------
  Detect cycle                     | Fast/Slow Pointers (Floyd's)
  Find middle node                 | Fast/Slow Pointers
  Find k-th from end               | Two Pointers (gap of k)
  Reverse in groups                | Iterative reversal
  Merge sorted lists               | Dummy Head + Comparison

  TREE PATTERNS
  ---------------------------------------------------------------
  Level-by-level processing        | BFS (Queue)
  Path from root to leaf           | DFS (Recursion / Stack)
  Validate BST                     | In-order traversal or min/max bounds
  Lowest common ancestor           | Recursive post-order DFS
  Serialize / deserialize          | BFS level-order or DFS pre-order
  "Diameter" or "longest path"     | DFS returning height

  GRAPH PATTERNS
  ---------------------------------------------------------------
  Connected components             | BFS/DFS or Union-Find
  Shortest path (unweighted)       | BFS
  Shortest path (weighted)         | Dijkstra's (no negatives)
  Shortest path (negative edges)   | Bellman-Ford
  Dependency ordering              | Topological Sort (Kahn's / DFS)
  Cycle detection (directed)       | DFS with 3-color marking
  Cycle detection (undirected)     | Union-Find or DFS with parent
  Minimum spanning tree            | Kruskal's or Prim's
  Grid traversal                   | BFS/DFS with 4-directional moves

  DYNAMIC PROGRAMMING SIGNALS
  ---------------------------------------------------------------
  "How many ways..."               | DP (counting)
  "Minimum cost / Maximum value"   | DP (optimization)
  "Can you reach / Is it possible" | DP (boolean) or Greedy
  Overlapping subproblems          | Memoization / Tabulation
  "Longest/shortest subsequence"   | DP
  String matching / editing        | 2D DP (edit distance, LCS)
  Partition into subsets            | DP (subset sum variant)

  STACK PATTERNS
  ---------------------------------------------------------------
  Matching brackets / parentheses  | Stack
  "Next greater / smaller element" | Monotonic Stack
  Expression evaluation            | Stack (operators + operands)
  Undo operations                  | Stack
  "Largest rectangle / container"  | Monotonic Stack

  BACKTRACKING SIGNALS
  ---------------------------------------------------------------
  "Generate all combinations"      | Backtracking
  "Generate all permutations"      | Backtracking
  "Find all valid configurations"  | Backtracking
  Constraint satisfaction (Sudoku) | Backtracking + Pruning
  "Subsets with condition"         | Backtracking

  INTERVAL PATTERNS
  ---------------------------------------------------------------
  Overlapping intervals            | Sort + Merge
  Insert interval                  | Three-phase scan
  Meeting rooms / schedule         | Sort + Sweep Line or Heap
  "Minimum platforms / rooms"      | Sweep Line (start/end events)

  GREEDY SIGNALS
  ---------------------------------------------------------------
  "Minimum number of..." (simple)  | Greedy (try greedy first)
  Scheduling / activity selection  | Sort + Greedy
  "Jump game" style                | Greedy (track max reach)

  COMPLEXITY TARGETS (for interviews)
  ---------------------------------------------------------------
  If n <= 20                       | O(2^n) or O(n!) ok (backtracking)
  If n <= 100                      | O(n^3) ok (Floyd-Warshall)
  If n <= 10,000                   | O(n^2) ok (DP, two loops)
  If n <= 1,000,000                | O(n log n) needed (sort, binary search)
  If n <= 10,000,000               | O(n) needed (single pass, hashmap)
  If n > 10,000,000                | O(log n) or O(1) needed (math, binary search)
`;

console.log(patternGuide);

// ============================================================================
// FINAL RESULTS
// ============================================================================
section('RESULTS SUMMARY');
console.log(`\n  Total: ${results.total} | Passed: ${results.passed} | Failed: ${results.failed}`);
console.log(`  ${results.failed === 0 ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED'}\n`);
