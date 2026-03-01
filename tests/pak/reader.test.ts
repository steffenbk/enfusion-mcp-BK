import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { writeFileSync, unlinkSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { deflateSync } from "node:zlib";
import { parsePakIndex } from "../../src/pak/reader.js";

/**
 * Build a minimal synthetic .pak file in memory.
 *
 * Layout:
 *   FORM header (12 bytes)
 *   HEAD chunk  (8 + 0x1c bytes)
 *   DATA chunk  (8 + data payload bytes)
 *   FILE chunk  (8 + file tree bytes)
 */
function buildTestPak(files: Array<{ path: string; content: string; compress: boolean }>): Buffer {
  // ── Build DATA payload and FILE tree simultaneously ────────────────────
  const dataChunks: Buffer[] = [];
  let dataOffset = 0;

  interface TreeFile {
    name: string;
    offset: number;
    compressedLen: number;
    decompressedLen: number;
    compressed: boolean;
  }
  interface TreeDir {
    name: string;
    children: Map<string, TreeDir | TreeFile>;
  }

  const root: TreeDir = { name: "", children: new Map() };

  for (const file of files) {
    const raw = Buffer.from(file.content, "utf-8");
    let stored: Buffer;
    if (file.compress) {
      stored = deflateSync(raw);
    } else {
      stored = raw;
    }

    // Insert into tree
    const parts = file.path.split("/");
    const fileName = parts.pop()!;
    let dir = root;
    for (const part of parts) {
      let child = dir.children.get(part);
      if (!child || !("children" in child)) {
        child = { name: part, children: new Map() };
        dir.children.set(part, child);
      }
      dir = child as TreeDir;
    }

    dir.children.set(fileName, {
      name: fileName,
      offset: dataOffset,
      compressedLen: stored.length,
      decompressedLen: raw.length,
      compressed: file.compress,
    });

    dataChunks.push(stored);
    dataOffset += stored.length;
  }

  // ── Serialize FILE tree ────────────────────────────────────────────────
  function serializeEntry(entry: TreeDir | TreeFile): Buffer {
    const nameBuf = Buffer.from(entry.name, "utf-8");
    const parts: Buffer[] = [];

    const header = Buffer.alloc(2);
    if ("children" in entry) {
      // Directory
      header.writeUInt8(0, 0); // kind = folder
      header.writeUInt8(nameBuf.length, 1);
      parts.push(header, nameBuf);

      const countBuf = Buffer.alloc(4);
      countBuf.writeUInt32LE(entry.children.size, 0);
      parts.push(countBuf);

      for (const child of entry.children.values()) {
        parts.push(serializeEntry(child));
      }
    } else {
      // File
      header.writeUInt8(1, 0); // kind = file
      header.writeUInt8(nameBuf.length, 1);
      parts.push(header, nameBuf);

      const meta = Buffer.alloc(20); // 4+4+4+4+2+1+1 = 20 bytes
      meta.writeUInt32LE(entry.offset, 0);
      meta.writeUInt32LE(entry.compressedLen, 4);
      meta.writeUInt32LE(entry.decompressedLen, 8);
      meta.writeUInt32LE(0, 12); // unknown
      meta.writeUInt16LE(0, 16); // unk2
      meta.writeUInt8(entry.compressed ? 1 : 0, 18);
      meta.writeUInt8(entry.compressed ? 6 : 0, 19); // compression_level
      parts.push(meta);

      const tsBuf = Buffer.alloc(4);
      tsBuf.writeUInt32LE(0, 0); // timestamp
      parts.push(tsBuf);
    }

    return Buffer.concat(parts);
  }

  const fileTreeBuf = serializeEntry(root);
  const dataPayload = Buffer.concat(dataChunks);

  // ── HEAD chunk (minimal: 0x1c bytes of zeros) ──────────────────────────
  const headLen = 0x1c;
  const headPayload = Buffer.alloc(headLen);

  // ── Assemble chunks ────────────────────────────────────────────────────
  const totalPayload =
    4 + // "PAC1"
    8 + headLen +
    8 + dataPayload.length +
    8 + fileTreeBuf.length;

  const buf = Buffer.alloc(8 + totalPayload);
  let pos = 0;

  // FORM header
  buf.write("FORM", pos, 4, "ascii"); pos += 4;
  buf.writeUInt32BE(totalPayload, pos); pos += 4;
  buf.write("PAC1", pos, 4, "ascii"); pos += 4;

  // HEAD chunk
  buf.write("HEAD", pos, 4, "ascii"); pos += 4;
  buf.writeUInt32BE(headLen, pos); pos += 4;
  headPayload.copy(buf, pos); pos += headLen;

  // DATA chunk
  buf.write("DATA", pos, 4, "ascii"); pos += 4;
  buf.writeUInt32BE(dataPayload.length, pos); pos += 4;
  dataPayload.copy(buf, pos); pos += dataPayload.length;

  // FILE chunk
  buf.write("FILE", pos, 4, "ascii"); pos += 4;
  buf.writeUInt32BE(fileTreeBuf.length, pos); pos += 4;
  fileTreeBuf.copy(buf, pos);

  return buf;
}

// ── Tests ────────────────────────────────────────────────────────────────────

const TEST_DIR = join(tmpdir(), "enfusion-mcp-pak-test-" + process.pid);

beforeAll(() => {
  mkdirSync(TEST_DIR, { recursive: true });
});

afterAll(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
});

describe("parsePakIndex", () => {
  it("parses a pak with uncompressed files", () => {
    const pakBuf = buildTestPak([
      { path: "Scripts/hello.c", content: "void main() {}", compress: false },
      { path: "Prefabs/box.et", content: 'GenericEntity { ID "box" }', compress: false },
    ]);
    const pakPath = join(TEST_DIR, "test_uncompressed.pak");
    writeFileSync(pakPath, pakBuf);

    const index = parsePakIndex(pakPath);

    expect(index.root.kind).toBe("dir");
    expect(index.root.children.size).toBe(2); // Scripts, Prefabs

    const scripts = index.root.children.get("Scripts");
    expect(scripts).toBeDefined();
    expect(scripts!.kind).toBe("dir");

    const hello = (scripts as any).children.get("hello.c");
    expect(hello).toBeDefined();
    expect(hello.kind).toBe("file");
    expect(hello.compressed).toBe(false);
    expect(hello.decompressedLen).toBe(Buffer.from("void main() {}").length);
  });

  it("parses a pak with compressed files", () => {
    const content = "This is a test file with some content that should compress well. ".repeat(10);
    const pakBuf = buildTestPak([
      { path: "data/test.txt", content, compress: true },
    ]);
    const pakPath = join(TEST_DIR, "test_compressed.pak");
    writeFileSync(pakPath, pakBuf);

    const index = parsePakIndex(pakPath);

    const data = index.root.children.get("data");
    expect(data).toBeDefined();
    expect(data!.kind).toBe("dir");

    const testFile = (data as any).children.get("test.txt");
    expect(testFile).toBeDefined();
    expect(testFile.kind).toBe("file");
    expect(testFile.compressed).toBe(true);
    expect(testFile.decompressedLen).toBe(Buffer.from(content).length);
    expect(testFile.compressedLen).toBeLessThan(testFile.decompressedLen);
  });

  it("parses nested directory structures", () => {
    const pakBuf = buildTestPak([
      { path: "a/b/c/deep.c", content: "deep", compress: false },
      { path: "a/b/sibling.c", content: "sibling", compress: false },
      { path: "a/top.c", content: "top", compress: false },
    ]);
    const pakPath = join(TEST_DIR, "test_nested.pak");
    writeFileSync(pakPath, pakBuf);

    const index = parsePakIndex(pakPath);

    const a = index.root.children.get("a") as any;
    expect(a.kind).toBe("dir");
    expect(a.children.size).toBe(2); // b, top.c

    const b = a.children.get("b") as any;
    expect(b.kind).toBe("dir");
    expect(b.children.size).toBe(2); // c, sibling.c

    const c = b.children.get("c") as any;
    expect(c.kind).toBe("dir");
    expect(c.children.get("deep.c")).toBeDefined();
  });

  it("throws on invalid magic", () => {
    const bad = Buffer.alloc(12);
    bad.write("NOPE", 0, 4, "ascii");
    const pakPath = join(TEST_DIR, "bad_magic.pak");
    writeFileSync(pakPath, bad);

    expect(() => parsePakIndex(pakPath)).toThrow("Not a PAK file");
  });

  it("throws on truncated file", () => {
    const pakPath = join(TEST_DIR, "truncated.pak");
    writeFileSync(pakPath, Buffer.alloc(4));

    expect(() => parsePakIndex(pakPath)).toThrow();
  });
});
