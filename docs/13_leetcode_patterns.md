# 13 - LeetCode Patterns

## Table of Contents

- [Pattern Recognition Quick Reference](#pattern-recognition-quick-reference)
- [Two Pointers](#two-pointers)
- [Sliding Window](#sliding-window)
- [Binary Search](#binary-search)
- [Stack Patterns](#stack-patterns)
- [Linked List Techniques](#linked-list-techniques)
- [Tree Patterns](#tree-patterns)
- [Graph Algorithms](#graph-algorithms)
- [Dynamic Programming](#dynamic-programming)
- [Backtracking](#backtracking)
- [Merge Intervals](#merge-intervals)
- [Monotonic Stack](#monotonic-stack)
- [Interview Tips](#interview-tips)
- [Quick Reference / Cheat Sheet](#quick-reference--cheat-sheet)

---

## Pattern Recognition Quick Reference

| Signal / Clue | Pattern to Consider |
|---|---|
| Sorted array, search for value | Binary Search |
| Two values that sum to target | Two Pointers (sorted) or Hash Map |
| Contiguous subarray / substring | Sliding Window |
| Longest/shortest substring with condition | Sliding Window |
| Valid parentheses / nested structure | Stack |
| Next greater/smaller element | Monotonic Stack |
| Linked list cycle, middle, merge | Fast/Slow Pointers |
| Tree traversal, subtree properties | DFS (recursive) |
| Level-by-level tree processing | BFS (queue) |
| Shortest path (unweighted) | BFS |
| Shortest path (weighted) | Dijkstra |
| Connected components | DFS/BFS or Union-Find |
| Topological ordering | Topological Sort (Kahn's or DFS) |
| Generate all combinations/permutations | Backtracking |
| Optimal substructure + overlapping subproblems | Dynamic Programming |
| Merge/insert overlapping ranges | Merge Intervals |
| Minimum/maximum with constraints | Binary Search on Answer or DP |
| String matching / prefix | Trie |
| Top K elements | Heap |

---

## Two Pointers

### When to Use

- Sorted array: find pair with given sum
- Remove duplicates in place
- Palindrome checking
- Container with most water

### Template

```javascript
// Opposite direction (converging)
function twoSum(arr, target) {
  let left = 0, right = arr.length - 1;

  while (left < right) {
    const sum = arr[left] + arr[right];
    if (sum === target) return [left, right];
    if (sum < target) left++;
    else right--;
  }
  return [-1, -1];
}
// Time: O(n)  |  Space: O(1)
```

```javascript
// Same direction (fast/slow)
function removeDuplicates(nums) {
  if (nums.length === 0) return 0;
  let slow = 0;

  for (let fast = 1; fast < nums.length; fast++) {
    if (nums[fast] !== nums[slow]) {
      slow++;
      nums[slow] = nums[fast];
    }
  }
  return slow + 1; // length of unique portion
}
// Time: O(n)  |  Space: O(1)
```

### Example Problems

| Problem | Approach | Complexity |
|---|---|---|
| Two Sum II (sorted) | Converging pointers | O(n) |
| 3Sum | Sort + for-loop + two pointers | O(n^2) |
| Container With Most Water | Converging, move shorter side | O(n) |
| Remove Duplicates from Sorted Array | Fast/slow pointers | O(n) |
| Valid Palindrome | Converging, skip non-alphanumeric | O(n) |

---

## Sliding Window

### When to Use

- Maximum/minimum sum subarray of size k (fixed window)
- Longest substring without repeating characters (variable window)
- Smallest subarray with sum >= target (variable window)
- String contains anagram of another (fixed window)

### Fixed Window Template

```javascript
function maxSumSubarray(arr, k) {
  let windowSum = 0;

  // Build first window
  for (let i = 0; i < k; i++) {
    windowSum += arr[i];
  }

  let maxSum = windowSum;

  // Slide window
  for (let i = k; i < arr.length; i++) {
    windowSum += arr[i] - arr[i - k];  // add right, remove left
    maxSum = Math.max(maxSum, windowSum);
  }

  return maxSum;
}
// Time: O(n)  |  Space: O(1)
```

### Variable Window Template

```javascript
function longestSubstringWithoutRepeating(s) {
  const seen = new Map();  // char -> last index
  let left = 0;
  let maxLen = 0;

  for (let right = 0; right < s.length; right++) {
    const ch = s[right];

    if (seen.has(ch) && seen.get(ch) >= left) {
      left = seen.get(ch) + 1;  // shrink window
    }

    seen.set(ch, right);
    maxLen = Math.max(maxLen, right - left + 1);
  }

  return maxLen;
}
// Time: O(n)  |  Space: O(min(n, alphabet))
```

### Minimum Window Substring

```javascript
function minWindow(s, t) {
  const need = new Map();
  for (const ch of t) need.set(ch, (need.get(ch) || 0) + 1);

  let have = 0;
  const required = need.size;
  let left = 0;
  let minLen = Infinity;
  let minStart = 0;
  const window = new Map();

  for (let right = 0; right < s.length; right++) {
    const ch = s[right];
    window.set(ch, (window.get(ch) || 0) + 1);

    if (need.has(ch) && window.get(ch) === need.get(ch)) {
      have++;
    }

    // Shrink window while valid
    while (have === required) {
      if (right - left + 1 < minLen) {
        minLen = right - left + 1;
        minStart = left;
      }

      const leftCh = s[left];
      window.set(leftCh, window.get(leftCh) - 1);
      if (need.has(leftCh) && window.get(leftCh) < need.get(leftCh)) {
        have--;
      }
      left++;
    }
  }

  return minLen === Infinity ? '' : s.substring(minStart, minStart + minLen);
}
// Time: O(n + m)  |  Space: O(n + m)
```

### Example Problems

| Problem | Window Type | Complexity |
|---|---|---|
| Maximum Sum Subarray of Size K | Fixed | O(n) |
| Longest Substring Without Repeating Characters | Variable | O(n) |
| Minimum Window Substring | Variable (shrink) | O(n + m) |
| Find All Anagrams in a String | Fixed (length of p) | O(n) |
| Minimum Size Subarray Sum | Variable (shrink) | O(n) |

---

## Binary Search

### When to Use

- Sorted array: find element, first/last occurrence, insertion point
- Search space can be halved: "binary search on answer"
- Rotated sorted array
- Matrix search (sorted rows/columns)

### Standard Template

```javascript
function binarySearch(arr, target) {
  let lo = 0, hi = arr.length - 1;

  while (lo <= hi) {
    const mid = lo + Math.floor((hi - lo) / 2);
    if (arr[mid] === target) return mid;
    if (arr[mid] < target) lo = mid + 1;
    else hi = mid - 1;
  }
  return -1;
}
// Time: O(log n)  |  Space: O(1)
```

### Binary Search on Answer

```javascript
// Find minimum eating speed to eat all bananas in h hours
function minEatingSpeed(piles, h) {
  let lo = 1;
  let hi = Math.max(...piles);

  while (lo < hi) {
    const mid = lo + Math.floor((hi - lo) / 2);
    const hoursNeeded = piles.reduce((sum, p) => sum + Math.ceil(p / mid), 0);

    if (hoursNeeded <= h) {
      hi = mid;      // mid speed is enough, try slower
    } else {
      lo = mid + 1;  // too slow, need faster
    }
  }
  return lo;
}
// Time: O(n * log(max))  |  Space: O(1)
```

### Search in Rotated Sorted Array

```javascript
function searchRotated(nums, target) {
  let lo = 0, hi = nums.length - 1;

  while (lo <= hi) {
    const mid = lo + Math.floor((hi - lo) / 2);
    if (nums[mid] === target) return mid;

    // Left half is sorted
    if (nums[lo] <= nums[mid]) {
      if (nums[lo] <= target && target < nums[mid]) {
        hi = mid - 1;
      } else {
        lo = mid + 1;
      }
    }
    // Right half is sorted
    else {
      if (nums[mid] < target && target <= nums[hi]) {
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
  }
  return -1;
}
// Time: O(log n)  |  Space: O(1)
```

### Example Problems

| Problem | Variant | Complexity |
|---|---|---|
| Binary Search | Standard | O(log n) |
| Search in Rotated Sorted Array | Modified comparison | O(log n) |
| Find First and Last Position | Lower/Upper bound | O(log n) |
| Koko Eating Bananas | Binary search on answer | O(n log max) |
| Search a 2D Matrix | Treat as 1D sorted | O(log(m*n)) |

---

## Stack Patterns

### When to Use

- Matching parentheses / brackets
- Evaluate expressions (postfix, infix)
- Next greater / smaller element
- Undo operations
- DFS (iterative)

### Valid Parentheses

```javascript
function isValid(s) {
  const stack = [];
  const pairs = { ')': '(', ']': '[', '}': '{' };

  for (const ch of s) {
    if (ch in pairs) {
      if (stack.pop() !== pairs[ch]) return false;
    } else {
      stack.push(ch);
    }
  }
  return stack.length === 0;
}
// Time: O(n)  |  Space: O(n)
```

### Evaluate Reverse Polish Notation

```javascript
function evalRPN(tokens) {
  const stack = [];
  const ops = {
    '+': (a, b) => a + b,
    '-': (a, b) => a - b,
    '*': (a, b) => a * b,
    '/': (a, b) => Math.trunc(a / b),
  };

  for (const token of tokens) {
    if (token in ops) {
      const b = stack.pop();
      const a = stack.pop();
      stack.push(ops[token](a, b));
    } else {
      stack.push(Number(token));
    }
  }
  return stack[0];
}
// Time: O(n)  |  Space: O(n)
```

### Example Problems

| Problem | Key Idea | Complexity |
|---|---|---|
| Valid Parentheses | Push open, pop on close | O(n) |
| Evaluate Reverse Polish Notation | Stack for operands | O(n) |
| Daily Temperatures | Monotonic stack (next warmer) | O(n) |
| Min Stack | Two stacks (values + mins) | O(1) per op |
| Decode String | Stack for counts and strings | O(n) |

---

## Linked List Techniques

### When to Use

- Fast/slow pointer: cycle detection, find middle
- Dummy head: simplify edge cases for insert/delete
- Reverse: in-place reversal of a portion

### Reverse a Linked List

```javascript
function reverseList(head) {
  let prev = null;
  let curr = head;

  while (curr) {
    const next = curr.next;
    curr.next = prev;
    prev = curr;
    curr = next;
  }
  return prev;
}
// Time: O(n)  |  Space: O(1)
```

### Detect Cycle (Floyd's)

```javascript
function hasCycle(head) {
  let slow = head, fast = head;

  while (fast && fast.next) {
    slow = slow.next;
    fast = fast.next.next;
    if (slow === fast) return true;
  }
  return false;
}
// Time: O(n)  |  Space: O(1)
```

### Merge Two Sorted Lists

```javascript
function mergeTwoLists(l1, l2) {
  const dummy = { val: 0, next: null };
  let curr = dummy;

  while (l1 && l2) {
    if (l1.val <= l2.val) {
      curr.next = l1;
      l1 = l1.next;
    } else {
      curr.next = l2;
      l2 = l2.next;
    }
    curr = curr.next;
  }
  curr.next = l1 || l2;
  return dummy.next;
}
// Time: O(n + m)  |  Space: O(1)
```

### Example Problems

| Problem | Technique | Complexity |
|---|---|---|
| Reverse Linked List | prev/curr/next pointers | O(n) |
| Linked List Cycle | Fast/slow pointers | O(n) |
| Merge Two Sorted Lists | Dummy head + comparison | O(n + m) |
| Remove Nth Node From End | Two pointers (gap of n) | O(n) |
| Reorder List | Find mid + reverse second half + merge | O(n) |

---

## Tree Patterns

### When to Use

- DFS (recursive): check properties, calculate heights, path sums
- BFS (queue): level-order, find depth, rightmost at each level
- Divide and conquer: split into left/right subtree problems

### DFS Template (Recursive)

```javascript
// Max depth
function maxDepth(root) {
  if (!root) return 0;
  return 1 + Math.max(maxDepth(root.left), maxDepth(root.right));
}
// Time: O(n)  |  Space: O(h)

// Invert binary tree
function invertTree(root) {
  if (!root) return null;
  [root.left, root.right] = [invertTree(root.right), invertTree(root.left)];
  return root;
}

// Check if balanced
function isBalanced(root) {
  function height(node) {
    if (!node) return 0;
    const left = height(node.left);
    if (left === -1) return -1;
    const right = height(node.right);
    if (right === -1) return -1;
    if (Math.abs(left - right) > 1) return -1;
    return 1 + Math.max(left, right);
  }
  return height(root) !== -1;
}
```

### BFS Template (Level Order)

```javascript
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
// Time: O(n)  |  Space: O(n)
```

### Validate BST

```javascript
function isValidBST(root, min = -Infinity, max = Infinity) {
  if (!root) return true;
  if (root.val <= min || root.val >= max) return false;
  return (
    isValidBST(root.left, min, root.val) &&
    isValidBST(root.right, root.val, max)
  );
}
// Time: O(n)  |  Space: O(h)
```

### Example Problems

| Problem | Pattern | Complexity |
|---|---|---|
| Maximum Depth of Binary Tree | DFS (post-order) | O(n) |
| Invert Binary Tree | DFS (post-order swap) | O(n) |
| Binary Tree Level Order Traversal | BFS | O(n) |
| Validate BST | DFS with min/max bounds | O(n) |
| Lowest Common Ancestor | DFS (find divergence) | O(n) |

---

## Graph Algorithms

### When to Use

- Shortest path (unweighted): BFS
- Shortest path (weighted, positive): Dijkstra
- Connected components: DFS/BFS or Union-Find
- Course schedule / dependency order: Topological Sort
- Detect cycle: DFS coloring (directed) or Union-Find (undirected)

### BFS Shortest Path

```javascript
function shortestPath(graph, start, end) {
  const visited = new Set([start]);
  const queue = [[start, 0]]; // [node, distance]

  while (queue.length > 0) {
    const [node, dist] = queue.shift();
    if (node === end) return dist;

    for (const neighbor of graph[node] || []) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push([neighbor, dist + 1]);
      }
    }
  }
  return -1; // unreachable
}
// Time: O(V + E)  |  Space: O(V)
```

### Topological Sort (Kahn's Algorithm - BFS)

```javascript
function topologicalSort(numCourses, prerequisites) {
  const graph = Array.from({ length: numCourses }, () => []);
  const inDegree = new Array(numCourses).fill(0);

  for (const [course, prereq] of prerequisites) {
    graph[prereq].push(course);
    inDegree[course]++;
  }

  const queue = [];
  for (let i = 0; i < numCourses; i++) {
    if (inDegree[i] === 0) queue.push(i);
  }

  const order = [];
  while (queue.length > 0) {
    const node = queue.shift();
    order.push(node);

    for (const neighbor of graph[node]) {
      inDegree[neighbor]--;
      if (inDegree[neighbor] === 0) queue.push(neighbor);
    }
  }

  return order.length === numCourses ? order : []; // empty = cycle
}
// Time: O(V + E)  |  Space: O(V + E)
```

### Number of Islands (Grid BFS/DFS)

```javascript
function numIslands(grid) {
  const rows = grid.length, cols = grid[0].length;
  let count = 0;

  function dfs(r, c) {
    if (r < 0 || r >= rows || c < 0 || c >= cols || grid[r][c] === '0') return;
    grid[r][c] = '0'; // mark visited
    dfs(r + 1, c);
    dfs(r - 1, c);
    dfs(r, c + 1);
    dfs(r, c - 1);
  }

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
// Time: O(m * n)  |  Space: O(m * n) worst case stack
```

### Example Problems

| Problem | Algorithm | Complexity |
|---|---|---|
| Number of Islands | DFS/BFS on grid | O(m * n) |
| Course Schedule | Topological Sort | O(V + E) |
| Clone Graph | BFS/DFS + HashMap | O(V + E) |
| Word Ladder | BFS (shortest transformation) | O(n * m * 26) |
| Network Delay Time | Dijkstra | O(E log V) |

---

## Dynamic Programming

### When to Use

- "How many ways..." / "Minimum cost..." / "Maximum profit..."
- Overlapping subproblems (same inputs computed repeatedly)
- Optimal substructure (optimal solution from optimal sub-solutions)

### 1D DP Template

```javascript
// Climbing Stairs
function climbStairs(n) {
  if (n <= 2) return n;
  let prev2 = 1, prev1 = 2;
  for (let i = 3; i <= n; i++) {
    const curr = prev1 + prev2;
    prev2 = prev1;
    prev1 = curr;
  }
  return prev1;
}
// Time: O(n)  |  Space: O(1)
```

### 2D DP Template

```javascript
// Unique Paths (grid m x n, move right or down)
function uniquePaths(m, n) {
  const dp = Array.from({ length: m }, () => new Array(n).fill(1));

  for (let i = 1; i < m; i++) {
    for (let j = 1; j < n; j++) {
      dp[i][j] = dp[i - 1][j] + dp[i][j - 1];
    }
  }
  return dp[m - 1][n - 1];
}
// Time: O(m * n)  |  Space: O(m * n)
```

### Knapsack Pattern (0/1)

```javascript
// Given items with weight and value, maximize value within capacity W
function knapsack(weights, values, W) {
  const n = weights.length;
  const dp = Array.from({ length: n + 1 }, () => new Array(W + 1).fill(0));

  for (let i = 1; i <= n; i++) {
    for (let w = 0; w <= W; w++) {
      dp[i][w] = dp[i - 1][w]; // skip item
      if (weights[i - 1] <= w) {
        dp[i][w] = Math.max(dp[i][w], dp[i - 1][w - weights[i - 1]] + values[i - 1]);
      }
    }
  }
  return dp[n][W];
}
// Time: O(n * W)  |  Space: O(n * W)
```

### Longest Common Subsequence

```javascript
function longestCommonSubsequence(text1, text2) {
  const m = text1.length, n = text2.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (text1[i - 1] === text2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }
  return dp[m][n];
}
// Time: O(m * n)  |  Space: O(m * n)
```

### Example Problems

| Problem | DP Type | Complexity |
|---|---|---|
| Climbing Stairs | 1D (Fibonacci-like) | O(n) |
| Coin Change | 1D (unbounded knapsack) | O(n * amount) |
| Longest Increasing Subsequence | 1D | O(n^2) or O(n log n) |
| Unique Paths | 2D grid | O(m * n) |
| Longest Common Subsequence | 2D (two strings) | O(m * n) |
| 0/1 Knapsack | 2D (items vs capacity) | O(n * W) |

---

## Backtracking

### When to Use

- Generate all permutations / combinations / subsets
- Solve constraint satisfaction (Sudoku, N-Queens)
- Path finding with constraints

### Template

```javascript
function backtrack(result, current, choices, startIndex) {
  if (isComplete(current)) {
    result.push([...current]); // found a solution
    return;
  }

  for (let i = startIndex; i < choices.length; i++) {
    // Make choice
    current.push(choices[i]);

    // Recurse
    backtrack(result, current, choices, i + 1); // i+1 for combinations, i for reuse

    // Undo choice (backtrack)
    current.pop();
  }
}
```

### Subsets

```javascript
function subsets(nums) {
  const result = [];

  function backtrack(start, current) {
    result.push([...current]);

    for (let i = start; i < nums.length; i++) {
      current.push(nums[i]);
      backtrack(i + 1, current);
      current.pop();
    }
  }

  backtrack(0, []);
  return result;
}
// Time: O(n * 2^n)  |  Space: O(n)
```

### Permutations

```javascript
function permute(nums) {
  const result = [];

  function backtrack(current, remaining) {
    if (remaining.length === 0) {
      result.push([...current]);
      return;
    }

    for (let i = 0; i < remaining.length; i++) {
      current.push(remaining[i]);
      backtrack(current, [...remaining.slice(0, i), ...remaining.slice(i + 1)]);
      current.pop();
    }
  }

  backtrack([], nums);
  return result;
}
// Time: O(n * n!)  |  Space: O(n)
```

### Combination Sum

```javascript
function combinationSum(candidates, target) {
  const result = [];

  function backtrack(start, current, remaining) {
    if (remaining === 0) {
      result.push([...current]);
      return;
    }
    if (remaining < 0) return;

    for (let i = start; i < candidates.length; i++) {
      current.push(candidates[i]);
      backtrack(i, current, remaining - candidates[i]); // i (not i+1) allows reuse
      current.pop();
    }
  }

  backtrack(0, [], target);
  return result;
}
// Time: O(n^(T/M))  |  Space: O(T/M)  where T=target, M=min candidate
```

### Example Problems

| Problem | Key Detail | Complexity |
|---|---|---|
| Subsets | Include/exclude each element | O(n * 2^n) |
| Permutations | Try all positions | O(n * n!) |
| Combination Sum | Allow reuse (i, not i+1) | O(n^(T/M)) |
| N-Queens | Place queen per row, check constraints | O(n!) |
| Word Search | DFS on grid with backtrack | O(m * n * 4^L) |

---

## Merge Intervals

### When to Use

- Overlapping intervals: merge, insert, count
- Meeting rooms: can attend all? minimum rooms needed?
- Interval intersection

### Merge Overlapping Intervals

```javascript
function merge(intervals) {
  intervals.sort((a, b) => a[0] - b[0]);
  const merged = [intervals[0]];

  for (let i = 1; i < intervals.length; i++) {
    const last = merged[merged.length - 1];
    const curr = intervals[i];

    if (curr[0] <= last[1]) {
      // Overlapping — extend
      last[1] = Math.max(last[1], curr[1]);
    } else {
      // No overlap
      merged.push(curr);
    }
  }
  return merged;
}
// Time: O(n log n)  |  Space: O(n)
```

### Insert Interval

```javascript
function insert(intervals, newInterval) {
  const result = [];
  let i = 0;

  // Add all intervals before newInterval
  while (i < intervals.length && intervals[i][1] < newInterval[0]) {
    result.push(intervals[i]);
    i++;
  }

  // Merge overlapping intervals
  while (i < intervals.length && intervals[i][0] <= newInterval[1]) {
    newInterval[0] = Math.min(newInterval[0], intervals[i][0]);
    newInterval[1] = Math.max(newInterval[1], intervals[i][1]);
    i++;
  }
  result.push(newInterval);

  // Add remaining intervals
  while (i < intervals.length) {
    result.push(intervals[i]);
    i++;
  }

  return result;
}
// Time: O(n)  |  Space: O(n)
```

### Meeting Rooms II (Minimum Rooms)

```javascript
function minMeetingRooms(intervals) {
  const starts = intervals.map((i) => i[0]).sort((a, b) => a - b);
  const ends = intervals.map((i) => i[1]).sort((a, b) => a - b);

  let rooms = 0, maxRooms = 0;
  let s = 0, e = 0;

  while (s < starts.length) {
    if (starts[s] < ends[e]) {
      rooms++;
      s++;
    } else {
      rooms--;
      e++;
    }
    maxRooms = Math.max(maxRooms, rooms);
  }
  return maxRooms;
}
// Time: O(n log n)  |  Space: O(n)
```

### Example Problems

| Problem | Approach | Complexity |
|---|---|---|
| Merge Intervals | Sort + linear scan | O(n log n) |
| Insert Interval | Three-phase scan | O(n) |
| Meeting Rooms | Sort, check overlap | O(n log n) |
| Meeting Rooms II | Two-pointer on sorted start/end | O(n log n) |
| Non-overlapping Intervals | Sort by end, greedy remove | O(n log n) |

---

## Monotonic Stack

### When to Use

- **Next Greater Element** (to the right)
- **Next Smaller Element**
- **Largest Rectangle in Histogram**
- **Daily Temperatures** (days until warmer)

The stack maintains a monotonically increasing or decreasing order.

### Next Greater Element

```javascript
function nextGreaterElement(nums) {
  const result = new Array(nums.length).fill(-1);
  const stack = []; // stores indices

  for (let i = 0; i < nums.length; i++) {
    // Pop elements smaller than current — current is their next greater
    while (stack.length > 0 && nums[stack[stack.length - 1]] < nums[i]) {
      const idx = stack.pop();
      result[idx] = nums[i];
    }
    stack.push(i);
  }
  return result;
}
// Time: O(n)  |  Space: O(n)
// Input:  [2, 1, 2, 4, 3]
// Output: [4, 2, 4, -1, -1]
```

### Daily Temperatures

```javascript
function dailyTemperatures(temperatures) {
  const result = new Array(temperatures.length).fill(0);
  const stack = []; // indices of days waiting for a warmer day

  for (let i = 0; i < temperatures.length; i++) {
    while (stack.length > 0 && temperatures[i] > temperatures[stack[stack.length - 1]]) {
      const prevDay = stack.pop();
      result[prevDay] = i - prevDay;
    }
    stack.push(i);
  }
  return result;
}
// Time: O(n)  |  Space: O(n)
```

### Largest Rectangle in Histogram

```javascript
function largestRectangleArea(heights) {
  const stack = []; // indices
  let maxArea = 0;
  heights.push(0); // sentinel to flush remaining

  for (let i = 0; i < heights.length; i++) {
    while (stack.length > 0 && heights[i] < heights[stack[stack.length - 1]]) {
      const h = heights[stack.pop()];
      const w = stack.length === 0 ? i : i - stack[stack.length - 1] - 1;
      maxArea = Math.max(maxArea, h * w);
    }
    stack.push(i);
  }
  heights.pop(); // remove sentinel
  return maxArea;
}
// Time: O(n)  |  Space: O(n)
```

### Example Problems

| Problem | Stack Type | Complexity |
|---|---|---|
| Next Greater Element | Decreasing stack | O(n) |
| Daily Temperatures | Decreasing stack (indices) | O(n) |
| Largest Rectangle in Histogram | Increasing stack | O(n) |
| Trapping Rain Water | Decreasing stack (or two pointers) | O(n) |
| Stock Span Problem | Decreasing stack | O(n) |

---

## Interview Tips

1. **Pattern recognition is the key skill.** Before coding, identify which pattern fits. Look at the clues in the problem statement (sorted? subarray? tree? shortest path?).

2. **Start with brute force.** State the naive solution and its complexity, then optimize using the identified pattern.

3. **Talk through your approach** before coding. "I see this is a sliding window problem because we need the longest contiguous substring with a condition."

4. **Always state time and space complexity** for both brute force and optimized solutions.

5. **Edge cases to always consider:** empty input, single element, all duplicates, negative numbers, very large input.

6. **Practice these patterns in order of frequency:** Two Pointers, Sliding Window, Binary Search, BFS/DFS, DP, Backtracking.

---

## Quick Reference / Cheat Sheet

```
Pattern Decision Tree:

Is it a sorted array?
  Yes -> Binary Search or Two Pointers
  No ->
    Is it about subarrays/substrings?
      Yes -> Sliding Window
      No ->
        Is it a tree?
          Yes -> DFS (recursive) or BFS (level-order)
          No ->
            Is it a graph?
              Yes ->
                Shortest path? -> BFS (unweighted) or Dijkstra (weighted)
                Ordering? -> Topological Sort
                Components? -> DFS/BFS or Union-Find
              No ->
                Is it "how many ways" / "min cost"?
                  Yes -> Dynamic Programming
                  No ->
                    Is it "all combinations/permutations"?
                      Yes -> Backtracking
                      No ->
                        Is it about intervals?
                          Yes -> Sort + Merge Intervals
                          No ->
                            Is it "next greater/smaller"?
                              Yes -> Monotonic Stack

Sliding Window Key:
  Fixed size k:  build window of k, then slide (add right, remove left)
  Variable:      expand right, shrink left while constraint holds

Binary Search Key:
  lo = 0, hi = n-1, while (lo <= hi)     -> find exact value
  lo = 0, hi = n,   while (lo < hi)      -> find boundary (lower/upper bound)

Backtracking Key:
  Subsets:      backtrack(i+1), include/exclude
  Permutations: try all unused elements
  Combinations: backtrack(i) if reuse allowed, (i+1) if not
```
