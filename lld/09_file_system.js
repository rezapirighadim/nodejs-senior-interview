/**
 * ============================================================================
 * LOW-LEVEL DESIGN: IN-MEMORY FILE SYSTEM
 * ============================================================================
 *
 * Problem:
 *   Design an in-memory file system supporting files, directories, CRUD
 *   operations, path-based navigation, move/copy, glob search, metadata,
 *   and simple permissions.
 *
 * Key Design Patterns:
 *   - Composite  -- File and Directory share the FSNode interface; a Directory
 *                   contains children that are also FSNodes.
 *   - Iterator   -- tree traversal for find/glob, ls -R
 *
 * Data Structures:
 *   - Tree of FSNode objects with Map<name, FSNode> children in directories
 *   - Path resolution walks the tree from root
 *
 * Complexity:
 *   - resolve(path)   O(depth)
 *   - ls              O(children)
 *   - find (glob)     O(N)  where N = total nodes
 *   - move/copy       O(subtree size)
 *
 * Run:  node 09_file_system.js
 * ============================================================================
 */

'use strict';

// ─── Permissions ────────────────────────────────────────────────────────────

/** @enum {number} */
const Permission = Object.freeze({
  NONE: 0,
  READ: 4,
  WRITE: 2,
  EXECUTE: 1,
});

class Permissions {
  /**
   * @param {number} owner  octal digit 0-7  (e.g. 7 = rwx)
   * @param {number} group
   * @param {number} other
   */
  constructor(owner = 7, group = 5, other = 5) {
    this.owner = owner;
    this.group = group;
    this.other = other;
  }

  /**
   * Check a specific permission bit for a role.
   * @param {'owner' | 'group' | 'other'} role
   * @param {number} bit  Permission.READ | WRITE | EXECUTE
   * @returns {boolean}
   */
  has(role, bit) {
    return (this[role] & bit) !== 0;
  }

  toString() {
    const fmt = (n) =>
      (n & 4 ? 'r' : '-') + (n & 2 ? 'w' : '-') + (n & 1 ? 'x' : '-');
    return fmt(this.owner) + fmt(this.group) + fmt(this.other);
  }
}

// ─── FSNode (Base class -- Composite) ───────────────────────────────────────

/**
 * Base class for file-system entries.
 * @abstract
 */
class FSNode {
  /**
   * @param {string} name
   * @param {'file' | 'directory'} type
   * @param {Permissions} [permissions]
   */
  constructor(name, type, permissions) {
    if (name.includes('/')) throw new Error(`Invalid name: "${name}" -- must not contain "/"`);
    /** @type {string} */
    this.name = name;
    /** @type {'file' | 'directory'} */
    this.type = type;
    /** @type {Permissions} */
    this.permissions = permissions ?? new Permissions();
    /** @type {Date} */
    this.createdAt = new Date();
    /** @type {Date} */
    this.modifiedAt = new Date();
    /** @type {Directory | null} */
    this.parent = null;
  }

  /** @returns {boolean} */
  isFile() {
    return this.type === 'file';
  }

  /** @returns {boolean} */
  isDirectory() {
    return this.type === 'directory';
  }

  /** Get absolute path of this node. */
  get path() {
    const parts = [];
    /** @type {FSNode | null} */
    let node = this;
    while (node) {
      parts.unshift(node.name);
      node = node.parent;
    }
    // Root is named '' so join gives '/...'
    const p = parts.join('/');
    return p.startsWith('/') ? p : '/' + p;
  }

  /** @returns {number} */
  get size() {
    return 0;
  }

  /** Deep-clone this node (and subtree for directories). */
  clone() {
    throw new Error('Subclass must implement clone()');
  }

  _touch() {
    this.modifiedAt = new Date();
  }
}

// ─── File ───────────────────────────────────────────────────────────────────

class File extends FSNode {
  /**
   * @param {string} name
   * @param {string} [content]
   * @param {Permissions} [permissions]
   */
  constructor(name, content = '', permissions) {
    super(name, 'file', permissions);
    /** @type {string} */
    this.content = content;
  }

  /** @returns {number} size in bytes (characters) */
  get size() {
    return this.content.length;
  }

  /**
   * @param {string} data
   */
  write(data) {
    this.content = data;
    this._touch();
  }

  /**
   * @param {string} data
   */
  append(data) {
    this.content += data;
    this._touch();
  }

  /** @returns {string} */
  read() {
    return this.content;
  }

  clone() {
    const copy = new File(this.name, this.content, new Permissions(
      this.permissions.owner, this.permissions.group, this.permissions.other
    ));
    copy.createdAt = new Date();
    return copy;
  }
}

// ─── Directory ──────────────────────────────────────────────────────────────

class Directory extends FSNode {
  /**
   * @param {string} name
   * @param {Permissions} [permissions]
   */
  constructor(name, permissions) {
    super(name, 'directory', permissions);
    /** @type {Map<string, FSNode>} */
    this.children = new Map();
  }

  /** Total size of all descendants. */
  get size() {
    let total = 0;
    for (const child of this.children.values()) {
      total += child.size;
    }
    return total;
  }

  /**
   * @param {FSNode} node
   * @returns {FSNode}
   */
  addChild(node) {
    if (this.children.has(node.name)) {
      throw new Error(`"${node.name}" already exists in ${this.path}`);
    }
    node.parent = this;
    this.children.set(node.name, node);
    this._touch();
    return node;
  }

  /**
   * @param {string} name
   * @returns {boolean}
   */
  removeChild(name) {
    const child = this.children.get(name);
    if (!child) return false;
    child.parent = null;
    this.children.delete(name);
    this._touch();
    return true;
  }

  /**
   * @param {string} name
   * @returns {FSNode | undefined}
   */
  getChild(name) {
    return this.children.get(name);
  }

  /** List child names. */
  list() {
    return [...this.children.keys()];
  }

  /** Deep clone this directory and its entire subtree. */
  clone() {
    const copy = new Directory(this.name, new Permissions(
      this.permissions.owner, this.permissions.group, this.permissions.other
    ));
    for (const [name, child] of this.children) {
      const childCopy = child.clone();
      childCopy.parent = copy;
      copy.children.set(name, childCopy);
    }
    copy.createdAt = new Date();
    return copy;
  }

  /**
   * Iterate all descendants (depth-first).
   * @returns {Generator<FSNode>}
   */
  *[Symbol.iterator]() {
    for (const child of this.children.values()) {
      yield child;
      if (child.isDirectory()) {
        yield* /** @type {Directory} */ (child);
      }
    }
  }
}

// ─── FileSystem (Facade) ───────────────────────────────────────────────────

class FileSystem {
  constructor() {
    /** @type {Directory} */
    this.root = new Directory('');
  }

  // ── Path resolution ───────────────────────────────────────────────────

  /**
   * Resolve a path string to its FSNode.
   * @param {string} pathStr  absolute path starting with /
   * @returns {FSNode}
   * @throws {Error} if path does not exist
   */
  resolve(pathStr) {
    const parts = this._parsePath(pathStr);
    /** @type {FSNode} */
    let current = this.root;
    for (const part of parts) {
      if (!current.isDirectory()) {
        throw new Error(`"${current.path}" is not a directory`);
      }
      const child = /** @type {Directory} */ (current).getChild(part);
      if (!child) {
        throw new Error(`Path not found: ${pathStr}`);
      }
      current = child;
    }
    return current;
  }

  /**
   * Resolve the parent directory and the target name from a path.
   * @param {string} pathStr
   * @returns {{ parent: Directory, name: string }}
   */
  _resolveParent(pathStr) {
    const parts = this._parsePath(pathStr);
    if (parts.length === 0) throw new Error('Cannot operate on root');
    const name = parts.pop();
    const parentPath = '/' + parts.join('/');
    const parent = this.resolve(parentPath);
    if (!parent.isDirectory()) {
      throw new Error(`"${parentPath}" is not a directory`);
    }
    return { parent: /** @type {Directory} */ (parent), name };
  }

  /**
   * Split a path into segments, ignoring empty parts.
   * @param {string} pathStr
   * @returns {string[]}
   */
  _parsePath(pathStr) {
    if (!pathStr.startsWith('/')) throw new Error('Path must be absolute (start with /)');
    return pathStr.split('/').filter(Boolean);
  }

  // ── Create ────────────────────────────────────────────────────────────

  /**
   * Create a file at the given path.
   * @param {string} pathStr
   * @param {string} [content]
   * @returns {File}
   */
  createFile(pathStr, content = '') {
    const { parent, name } = this._resolveParent(pathStr);
    const file = new File(name, content);
    parent.addChild(file);
    return file;
  }

  /**
   * Create a directory at the given path.
   * @param {string} pathStr
   * @param {Object} [opts]
   * @param {boolean} [opts.recursive]  create intermediate dirs (like mkdir -p)
   * @returns {Directory}
   */
  mkdir(pathStr, opts = {}) {
    const parts = this._parsePath(pathStr);
    /** @type {Directory} */
    let current = this.root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const existing = current.getChild(part);

      if (existing) {
        if (!existing.isDirectory()) {
          throw new Error(`"${existing.path}" exists and is not a directory`);
        }
        current = /** @type {Directory} */ (existing);
      } else {
        if (!opts.recursive && i < parts.length - 1) {
          throw new Error(`Parent directory does not exist: /${parts.slice(0, i + 1).join('/')}`);
        }
        const dir = new Directory(part);
        current.addChild(dir);
        current = dir;
      }
    }

    return current;
  }

  // ── Read ──────────────────────────────────────────────────────────────

  /**
   * Read file content.
   * @param {string} pathStr
   * @returns {string}
   */
  readFile(pathStr) {
    const node = this.resolve(pathStr);
    if (!node.isFile()) throw new Error(`"${pathStr}" is not a file`);
    return /** @type {File} */ (node).read();
  }

  /**
   * Write content to a file (creates if not exists, overwrites if exists).
   * @param {string} pathStr
   * @param {string} content
   * @returns {File}
   */
  writeFile(pathStr, content) {
    try {
      const node = this.resolve(pathStr);
      if (!node.isFile()) throw new Error(`"${pathStr}" is not a file`);
      /** @type {File} */ (node).write(content);
      return /** @type {File} */ (node);
    } catch {
      return this.createFile(pathStr, content);
    }
  }

  // ── List ──────────────────────────────────────────────────────────────

  /**
   * List contents of a directory.
   * @param {string} pathStr
   * @param {Object} [opts]
   * @param {boolean} [opts.long]      include metadata
   * @param {boolean} [opts.recursive]
   * @returns {string[] | Object[]}
   */
  ls(pathStr, opts = {}) {
    const node = this.resolve(pathStr);
    if (!node.isDirectory()) throw new Error(`"${pathStr}" is not a directory`);
    const dir = /** @type {Directory} */ (node);

    if (!opts.long && !opts.recursive) {
      return dir.list();
    }

    const results = [];

    const collect = (/** @type {Directory} */ d, prefix = '') => {
      for (const [name, child] of d.children) {
        const entry = {
          name: prefix + name,
          type: child.type,
          size: child.size,
          permissions: child.permissions.toString(),
          modified: child.modifiedAt.toISOString(),
        };
        results.push(entry);

        if (opts.recursive && child.isDirectory()) {
          collect(/** @type {Directory} */ (child), prefix + name + '/');
        }
      }
    };

    collect(dir);
    return results;
  }

  // ── Delete ────────────────────────────────────────────────────────────

  /**
   * Remove a file or empty directory.
   * @param {string} pathStr
   * @param {Object} [opts]
   * @param {boolean} [opts.recursive]  allow deleting non-empty directories
   */
  rm(pathStr, opts = {}) {
    const { parent, name } = this._resolveParent(pathStr);
    const node = parent.getChild(name);
    if (!node) throw new Error(`Path not found: ${pathStr}`);

    if (node.isDirectory()) {
      const dir = /** @type {Directory} */ (node);
      if (dir.children.size > 0 && !opts.recursive) {
        throw new Error(`Directory "${pathStr}" is not empty. Use { recursive: true }`);
      }
    }

    parent.removeChild(name);
  }

  // ── Move & Copy ───────────────────────────────────────────────────────

  /**
   * Move (rename) a file or directory.
   * @param {string} srcPath
   * @param {string} destPath
   */
  mv(srcPath, destPath) {
    const { parent: srcParent, name: srcName } = this._resolveParent(srcPath);
    const srcNode = srcParent.getChild(srcName);
    if (!srcNode) throw new Error(`Source not found: ${srcPath}`);

    const { parent: destParent, name: destName } = this._resolveParent(destPath);

    // If destination is an existing directory, move inside it
    const existing = destParent.getChild(destName);
    if (existing && existing.isDirectory()) {
      srcParent.removeChild(srcName);
      srcNode.parent = null;
      /** @type {Directory} */ (existing).addChild(srcNode);
      return;
    }

    srcParent.removeChild(srcName);
    srcNode.name = destName;
    destParent.addChild(srcNode);
  }

  /**
   * Copy a file or directory (deep copy).
   * @param {string} srcPath
   * @param {string} destPath
   * @returns {FSNode}
   */
  cp(srcPath, destPath) {
    const srcNode = this.resolve(srcPath);
    const copy = srcNode.clone();

    const { parent: destParent, name: destName } = this._resolveParent(destPath);
    copy.name = destName;
    destParent.addChild(copy);
    return copy;
  }

  // ── Find / Glob ───────────────────────────────────────────────────────

  /**
   * Find files/directories matching a glob-like name pattern.
   * Supports:  * (any chars), ? (single char)
   *
   * @param {string} pattern   name pattern (not a full path)
   * @param {string} [startPath]  directory to search from (default: /)
   * @returns {string[]}  array of matching absolute paths
   */
  find(pattern, startPath = '/') {
    const regex = new RegExp(
      '^' +
        pattern
          .replace(/[.+^${}()|[\]\\]/g, '\\$&')
          .replace(/\*/g, '.*')
          .replace(/\?/g, '.') +
        '$'
    );

    const startNode = this.resolve(startPath);
    if (!startNode.isDirectory()) throw new Error(`"${startPath}" is not a directory`);

    const results = [];
    for (const node of /** @type {Directory} */ (startNode)) {
      if (regex.test(node.name)) {
        results.push(node.path);
      }
    }
    return results;
  }

  // ── Stat ──────────────────────────────────────────────────────────────

  /**
   * Get metadata for a path.
   * @param {string} pathStr
   */
  stat(pathStr) {
    const node = this.resolve(pathStr);
    return {
      name: node.name,
      type: node.type,
      size: node.size,
      permissions: node.permissions.toString(),
      created: node.createdAt.toISOString(),
      modified: node.modifiedAt.toISOString(),
      path: node.path,
    };
  }

  // ── Chmod ─────────────────────────────────────────────────────────────

  /**
   * Change permissions.
   * @param {string} pathStr
   * @param {number} owner
   * @param {number} group
   * @param {number} other
   */
  chmod(pathStr, owner, group, other) {
    const node = this.resolve(pathStr);
    node.permissions = new Permissions(owner, group, other);
    node._touch();
  }

  // ── Pretty-print tree ────────────────────────────────────────────────

  /**
   * Print a tree visualization of the file system.
   * @param {string} [startPath]
   * @param {string} [prefix]
   * @returns {string}
   */
  tree(startPath = '/', prefix = '') {
    const node = this.resolve(startPath);
    const lines = [];

    if (prefix === '') {
      lines.push(startPath);
    }

    if (!node.isDirectory()) return lines.join('\n');
    const dir = /** @type {Directory} */ (node);
    const entries = [...dir.children.values()];

    entries.forEach((child, i) => {
      const isLast = i === entries.length - 1;
      const connector = isLast ? '`-- ' : '|-- ';
      const childPrefix = isLast ? '    ' : '|   ';
      const label = child.isDirectory() ? child.name + '/' : child.name;
      lines.push(prefix + connector + label);

      if (child.isDirectory()) {
        lines.push(this.tree(child.path, prefix + childPrefix));
      }
    });

    return lines.filter(Boolean).join('\n');
  }
}

// ============================================================================
// DEMO
// ============================================================================

function demo() {
  console.log('='.repeat(72));
  console.log(' IN-MEMORY FILE SYSTEM -- DEMO');
  console.log('='.repeat(72));

  const fs = new FileSystem();

  // ── 1. Create directory structure ─────────────────────────────────────
  console.log('\n--- 1. Create Directory Structure ---');

  fs.mkdir('/home', { recursive: true });
  fs.mkdir('/home/alice/documents', { recursive: true });
  fs.mkdir('/home/alice/pictures', { recursive: true });
  fs.mkdir('/home/bob', { recursive: true });
  fs.mkdir('/etc/config', { recursive: true });
  fs.mkdir('/tmp', { recursive: true });

  console.log(fs.tree());

  // ── 2. Create and read files ──────────────────────────────────────────
  console.log('\n--- 2. Create and Read Files ---');

  fs.createFile('/home/alice/documents/readme.txt', 'Hello, this is Alice\'s readme.');
  fs.createFile('/home/alice/documents/notes.md', '# Meeting Notes\n- Discuss LLD\n- Review PR');
  fs.createFile('/home/alice/pictures/photo.jpg', '<binary-data-placeholder>');
  fs.createFile('/home/bob/todo.txt', 'Buy groceries\nFinish project');
  fs.createFile('/etc/config/app.json', '{"port": 3000, "debug": true}');

  console.log('Read /home/alice/documents/readme.txt:');
  console.log('  ' + fs.readFile('/home/alice/documents/readme.txt'));

  console.log('\nRead /etc/config/app.json:');
  console.log('  ' + fs.readFile('/etc/config/app.json'));

  // ── 3. Write / Overwrite ──────────────────────────────────────────────
  console.log('\n--- 3. Write / Overwrite ---');

  fs.writeFile('/home/bob/todo.txt', 'Buy groceries\nFinish project\nCall dentist');
  console.log('Updated /home/bob/todo.txt:');
  console.log('  ' + fs.readFile('/home/bob/todo.txt'));

  // ── 4. List directory ─────────────────────────────────────────────────
  console.log('\n--- 4. List Directory ---');

  console.log('ls /home/alice:');
  console.log('  ' + fs.ls('/home/alice').join(', '));

  console.log('\nls -l /home/alice/documents:');
  const longList = fs.ls('/home/alice/documents', { long: true });
  for (const entry of longList) {
    console.log(`  ${entry.permissions}  ${String(entry.size).padStart(5)}  ${entry.name}`);
  }

  // ── 5. File metadata (stat) ───────────────────────────────────────────
  console.log('\n--- 5. File Metadata ---');

  const stat = fs.stat('/home/alice/documents/notes.md');
  console.log(stat);

  // ── 6. Copy ───────────────────────────────────────────────────────────
  console.log('\n--- 6. Copy ---');

  fs.cp('/home/alice/documents/readme.txt', '/tmp/readme_backup.txt');
  console.log('Copied readme.txt to /tmp/readme_backup.txt');
  console.log('  Content: ' + fs.readFile('/tmp/readme_backup.txt'));

  // Copy directory
  fs.cp('/home/alice/documents', '/home/bob/documents_copy');
  console.log('\nCopied /home/alice/documents -> /home/bob/documents_copy');
  console.log('ls /home/bob/documents_copy:', fs.ls('/home/bob/documents_copy').join(', '));

  // ── 7. Move / Rename ──────────────────────────────────────────────────
  console.log('\n--- 7. Move / Rename ---');

  fs.mv('/tmp/readme_backup.txt', '/tmp/readme_old.txt');
  console.log('Renamed /tmp/readme_backup.txt -> /tmp/readme_old.txt');
  console.log('ls /tmp:', fs.ls('/tmp').join(', '));

  // ── 8. Find / Glob ───────────────────────────────────────────────────
  console.log('\n--- 8. Find (Glob) ---');

  console.log('Find *.txt from /:');
  for (const p of fs.find('*.txt')) {
    console.log('  ' + p);
  }

  console.log('\nFind *.md from /home:');
  for (const p of fs.find('*.md', '/home')) {
    console.log('  ' + p);
  }

  console.log('\nFind note? from /:');
  for (const p of fs.find('note?.*')) {
    console.log('  ' + p);
  }

  // ── 9. Permissions ───────────────────────────────────────────────────
  console.log('\n--- 9. Permissions ---');

  console.log('Before chmod:', fs.stat('/etc/config/app.json').permissions);
  fs.chmod('/etc/config/app.json', 6, 4, 0); // rw-r-----
  console.log('After chmod: ', fs.stat('/etc/config/app.json').permissions);

  const perms = new Permissions(6, 4, 0);
  console.log('Owner can read?   ', perms.has('owner', Permission.READ));
  console.log('Owner can execute?', perms.has('owner', Permission.EXECUTE));
  console.log('Other can read?   ', perms.has('other', Permission.READ));

  // ── 10. Delete ────────────────────────────────────────────────────────
  console.log('\n--- 10. Delete ---');

  fs.rm('/tmp/readme_old.txt');
  console.log('Deleted /tmp/readme_old.txt, ls /tmp:', fs.ls('/tmp').join(', ') || '(empty)');

  try {
    fs.rm('/home/alice/documents');
  } catch (e) {
    console.log('Cannot delete non-empty dir: ' + e.message);
  }

  fs.rm('/home/alice/pictures', { recursive: true });
  console.log('Deleted /home/alice/pictures recursively');

  // ── 11. Recursive listing ─────────────────────────────────────────────
  console.log('\n--- 11. Recursive Listing ---');

  const everything = fs.ls('/', { long: true, recursive: true });
  for (const entry of everything) {
    const icon = entry.type === 'directory' ? 'd' : '-';
    console.log(
      `  ${icon}${entry.permissions}  ${String(entry.size).padStart(5)}  ${entry.name}`
    );
  }

  // ── 12. Final tree ───────────────────────────────────────────────────
  console.log('\n--- 12. Final Tree ---');
  console.log(fs.tree());

  console.log('\n' + '='.repeat(72));
  console.log(' DEMO COMPLETE');
  console.log('='.repeat(72));
}

demo();
