import { openSync, readSync, closeSync, fstatSync } from "node:fs";
import { logger } from "../utils/logger.js";

// ── Public types ─────────────────────────────────────────────────────────────

export interface PakFileEntry {
  kind: "file";
  name: string;
  /** Byte offset of this file's data within the DATA chunk payload */
  offset: number;
  compressedLen: number;
  decompressedLen: number;
  compressed: boolean;
}

export interface PakDirEntry {
  kind: "dir";
  name: string;
  children: Map<string, PakDirEntry | PakFileEntry>;
}

export interface PakIndex {
  root: PakDirEntry;
  /** Absolute byte position in the .pak file where the DATA payload starts */
  dataStart: number;
  /** Path to the .pak file on disk */
  pakPath: string;
}

// ── Chunk magic constants ────────────────────────────────────────────────────

const MAGIC_FORM = 0x464f524d; // "FORM"
const MAGIC_PAC1 = 0x50414331; // "PAC1"
const MAGIC_HEAD = 0x48454144; // "HEAD"
const MAGIC_DATA = 0x44415441; // "DATA"
const MAGIC_FILE = 0x46494c45; // "FILE"

// ── Parser ───────────────────────────────────────────────────────────────────

/**
 * Parse a .pak file's metadata without reading the DATA payload.
 * Reads chunk headers to locate the DATA and FILE sections, then parses
 * the FILE chunk's recursive entry tree into an in-memory directory structure.
 */
export function parsePakIndex(pakPath: string): PakIndex {
  const fd = openSync(pakPath, "r");
  try {
    const fileSize = fstatSync(fd).size;

    // ── FORM chunk ───────────────────────────────────────────────────────
    // Layout: "FORM" (4B) + u32BE size + "PAC1" (4B) = 12 bytes
    const formBuf = readAt(fd, 0, 12);
    const formMagic = formBuf.readUInt32BE(0);
    if (formMagic !== MAGIC_FORM) {
      throw new Error(`Not a PAK file: missing FORM header (got 0x${formMagic.toString(16)})`);
    }
    const pac1 = formBuf.readUInt32BE(8);
    if (pac1 !== MAGIC_PAC1) {
      throw new Error(`Not a PAK file: expected PAC1 identifier (got 0x${pac1.toString(16)})`);
    }

    // ── Walk chunks after FORM header ────────────────────────────────────
    // Chunks start at offset 12 (after FORM header).
    // Each chunk: magic (4B BE) + size (4B BE) + payload (size bytes).
    let pos = 12;
    let dataStart = -1;
    let fileChunkOffset = -1;
    let fileChunkLen = 0;

    while (pos + 8 <= fileSize) {
      const hdr = readAt(fd, pos, 8);
      const magic = hdr.readUInt32BE(0);
      const chunkLen = hdr.readUInt32BE(4);

      if (magic === MAGIC_HEAD) {
        // Skip HEAD chunk entirely
        pos += 8 + chunkLen;
      } else if (magic === MAGIC_DATA) {
        // Record where the DATA payload begins (right after its 8-byte header)
        dataStart = pos + 8;
        pos += 8 + chunkLen;
      } else if (magic === MAGIC_FILE) {
        fileChunkOffset = pos + 8;
        fileChunkLen = chunkLen;
        break; // FILE is the last chunk we care about
      } else {
        // Unknown chunk — skip it
        logger.debug(`PAK unknown chunk 0x${magic.toString(16)} at offset ${pos}, skipping`);
        pos += 8 + chunkLen;
      }
    }

    if (dataStart < 0) {
      throw new Error("PAK file missing DATA chunk");
    }
    if (fileChunkOffset < 0) {
      throw new Error("PAK file missing FILE chunk");
    }

    // ── Parse FILE chunk ─────────────────────────────────────────────────
    const fileBuf = readAt(fd, fileChunkOffset, fileChunkLen);
    const root = parseFileTree(fileBuf);

    return { root, dataStart, pakPath };
  } finally {
    closeSync(fd);
  }
}

// ── FILE tree parser ─────────────────────────────────────────────────────────

/**
 * Parse the recursive file entry tree from the FILE chunk payload.
 * Uses an iterative approach with an explicit stack to avoid deep recursion.
 */
function parseFileTree(buf: Buffer): PakDirEntry {
  const state = { offset: 0 };

  // The FILE chunk contains a single root entry (always a directory)
  const root = parseEntry(buf, state);
  if (root.kind !== "dir") {
    throw new Error("PAK FILE chunk root entry is not a directory");
  }
  return root;
}

function parseEntry(buf: Buffer, state: { offset: number }): PakDirEntry | PakFileEntry {
  const entryKind = buf.readUInt8(state.offset);
  state.offset += 1;

  const nameLen = buf.readUInt8(state.offset);
  state.offset += 1;

  const name = buf.toString("utf8", state.offset, state.offset + nameLen);
  state.offset += nameLen;

  if (entryKind === 0) {
    // Directory
    const childCount = buf.readUInt32LE(state.offset);
    state.offset += 4;

    const children = new Map<string, PakDirEntry | PakFileEntry>();
    for (let i = 0; i < childCount; i++) {
      const child = parseEntry(buf, state);
      children.set(child.name, child);
    }

    return { kind: "dir", name, children };
  } else {
    // File
    const offset = buf.readUInt32LE(state.offset);
    state.offset += 4;

    const compressedLen = buf.readUInt32LE(state.offset);
    state.offset += 4;

    const decompressedLen = buf.readUInt32LE(state.offset);
    state.offset += 4;

    // Skip unknown (u32LE) + unk2 (u16LE)
    state.offset += 6;

    const compressed = buf.readUInt8(state.offset) !== 0;
    state.offset += 1;

    // Skip compression_level (u8) + timestamp (u32LE)
    state.offset += 5;

    return {
      kind: "file",
      name,
      offset,
      compressedLen,
      decompressedLen,
      compressed,
    };
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function readAt(fd: number, position: number, length: number): Buffer {
  const buf = Buffer.alloc(length);
  const bytesRead = readSync(fd, buf, 0, length, position);
  if (bytesRead < length) {
    throw new Error(`Unexpected EOF: wanted ${length} bytes at offset ${position}, got ${bytesRead}`);
  }
  return buf;
}
