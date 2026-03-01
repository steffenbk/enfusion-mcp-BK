import { openSync, readSync, closeSync, readdirSync, existsSync } from "node:fs";
import { join, extname } from "node:path";
import { inflateSync } from "node:zlib";
import { parsePakIndex, type PakIndex, type PakDirEntry, type PakFileEntry } from "./reader.js";
import { logger } from "../utils/logger.js";

// ── Public types ─────────────────────────────────────────────────────────────

export interface VfsEntry {
  name: string;
  isDirectory: boolean;
  /** Decompressed size for files, 0 for directories */
  size: number;
}

interface FileRef {
  pakPath: string;
  dataStart: number;
  entry: PakFileEntry;
}

// ── PakVirtualFS ─────────────────────────────────────────────────────────────

/**
 * Virtual filesystem that merges all .pak files in the game's addons/ directory
 * into a single unified file tree. Supports directory listing, file existence
 * checks, and on-demand file reading with automatic zlib decompression.
 *
 * Instantiated lazily as a singleton and cached for the session lifetime.
 */
export class PakVirtualFS {
  private static instance: PakVirtualFS | null = null;
  private static instanceGamePath: string | null = null;

  /** Flat lookup: normalized virtual path → file reference */
  private fileIndex = new Map<string, FileRef>();
  /** Merged directory tree for browsing */
  private root: PakDirEntry = { kind: "dir", name: "", children: new Map() };

  /**
   * Get or create the singleton VFS for the given game path.
   * Returns null if no .pak files are found.
   */
  static get(gamePath: string): PakVirtualFS | null {
    if (PakVirtualFS.instance && PakVirtualFS.instanceGamePath === gamePath) {
      return PakVirtualFS.instance;
    }

    const addonsPath = join(gamePath, "addons");
    if (!existsSync(addonsPath)) return null;

    let pakFiles: string[];
    try {
      pakFiles = readdirSync(addonsPath)
        .filter((f) => extname(f).toLowerCase() === ".pak")
        .map((f) => join(addonsPath, f));
    } catch {
      return null;
    }

    if (pakFiles.length === 0) return null;

    const vfs = new PakVirtualFS(pakFiles);
    PakVirtualFS.instance = vfs;
    PakVirtualFS.instanceGamePath = gamePath;
    return vfs;
  }

  private constructor(pakFiles: string[]) {
    const start = Date.now();
    let totalFiles = 0;

    for (const pakPath of pakFiles) {
      try {
        const index = parsePakIndex(pakPath);
        const count = this.mergeTree(this.root, index.root, index, "");
        totalFiles += count;
      } catch (e) {
        logger.warn(`Failed to parse pak file ${pakPath}: ${e}`);
        // Continue with other paks — graceful degradation
      }
    }

    const elapsed = Date.now() - start;
    logger.info(
      `PAK VFS initialized: ${pakFiles.length} pak files, ${totalFiles} entries, ` +
      `${this.fileIndex.size} files indexed in ${elapsed}ms`
    );
  }

  // ── Public API ───────────────────────────────────────────────────────────

  /**
   * List entries in a virtual directory.
   * Path uses forward slashes, no leading slash (e.g., "Prefabs/Weapons").
   * Empty string = root.
   */
  listDir(virtualPath: string): VfsEntry[] {
    const dir = this.resolveDir(virtualPath);
    if (!dir) return [];

    const entries: VfsEntry[] = [];
    for (const [name, child] of dir.children) {
      if (child.kind === "dir") {
        entries.push({ name, isDirectory: true, size: 0 });
      } else {
        entries.push({ name, isDirectory: false, size: child.decompressedLen });
      }
    }
    return entries;
  }

  /** Check if a path exists (file or directory). */
  exists(virtualPath: string): boolean {
    const norm = normalizePath(virtualPath);
    if (norm === "") return true; // root always exists
    return this.fileIndex.has(norm) || this.resolveDir(norm) !== null;
  }

  /**
   * Read a file's raw bytes from the pak archive.
   * Opens the .pak, seeks to the correct offset, reads, decompresses if needed.
   */
  readFile(virtualPath: string): Buffer {
    const norm = normalizePath(virtualPath);
    const ref = this.fileIndex.get(norm);
    if (!ref) {
      throw new Error(`File not found in pak: ${virtualPath}`);
    }

    const { pakPath, dataStart, entry } = ref;
    const readLen = entry.compressed ? entry.compressedLen : entry.decompressedLen;

    const fd = openSync(pakPath, "r");
    try {
      const buf = Buffer.alloc(readLen);
      const position = dataStart + entry.offset;
      const bytesRead = readSync(fd, buf, 0, readLen, position);
      if (bytesRead < readLen) {
        throw new Error(
          `Truncated read from pak: expected ${readLen} bytes, got ${bytesRead}`
        );
      }

      if (entry.compressed) {
        return inflateSync(buf);
      }
      return buf;
    } finally {
      closeSync(fd);
    }
  }

  /** Read a file as UTF-8 text. */
  readTextFile(virtualPath: string): string {
    return this.readFile(virtualPath).toString("utf-8");
  }

  /** Get all file paths in the VFS (for building the asset search index). */
  allFilePaths(): string[] {
    return Array.from(this.fileIndex.keys());
  }

  /** Get the number of indexed files. */
  get fileCount(): number {
    return this.fileIndex.size;
  }

  // ── Internals ────────────────────────────────────────────────────────────

  /**
   * Merge a parsed pak tree into the unified directory tree.
   * Returns the number of file entries added.
   */
  private mergeTree(
    target: PakDirEntry,
    source: PakDirEntry,
    index: PakIndex,
    pathPrefix: string
  ): number {
    let count = 0;

    for (const [name, child] of source.children) {
      const childPath = pathPrefix ? `${pathPrefix}/${name}` : name;

      if (child.kind === "dir") {
        // Merge directories: create in target if missing, then recurse
        let targetChild = target.children.get(name);
        if (!targetChild || targetChild.kind !== "dir") {
          targetChild = { kind: "dir", name, children: new Map() };
          target.children.set(name, targetChild);
        }
        count += this.mergeTree(targetChild, child, index, childPath);
      } else {
        // File: add to target and flat index (first pak wins)
        const norm = normalizePath(childPath);
        if (!this.fileIndex.has(norm)) {
          target.children.set(name, child);
          this.fileIndex.set(norm, {
            pakPath: index.pakPath,
            dataStart: index.dataStart,
            entry: child,
          });
          count++;
        }
      }
    }

    return count;
  }

  /** Resolve a virtual path to a directory entry, or null if not found. */
  private resolveDir(virtualPath: string): PakDirEntry | null {
    const norm = normalizePath(virtualPath);
    if (norm === "") return this.root;

    const parts = norm.split("/");
    let current: PakDirEntry = this.root;

    for (const part of parts) {
      const child = current.children.get(part);
      if (!child || child.kind !== "dir") return null;
      current = child;
    }

    return current;
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Normalize a virtual path: trim slashes, convert backslashes, lowercase. */
function normalizePath(p: string): string {
  return p
    .replace(/\\/g, "/")
    .replace(/^\/+|\/+$/g, "")
    .replace(/\/+/g, "/");
}
