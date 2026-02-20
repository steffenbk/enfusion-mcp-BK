/**
 * Workbench NET API wire protocol encoder/decoder.
 *
 * Protocol format (per request):
 *   [int32LE protocolVersion=1]
 *   [pascalString clientId]
 *   [pascalString contentType="JsonRPC"]
 *   [pascalString payload (JSON)]
 *
 * Pascal string = 4-byte LE length prefix + UTF-8 content.
 * Each call uses a fresh TCP connection.
 */

const PROTOCOL_VERSION = 1;
const CONTENT_TYPE = "JsonRPC";

/** Encode a 32-bit signed integer as 4-byte little-endian Buffer. */
export function encodeInt32LE(value: number): Buffer {
  const buf = Buffer.alloc(4);
  buf.writeInt32LE(value, 0);
  return buf;
}

/** Decode a 32-bit signed integer from a Buffer at the given offset. */
export function decodeInt32LE(
  buf: Buffer,
  offset: number
): { value: number; bytesRead: number } {
  if (buf.length < offset + 4) {
    throw new Error(
      `Buffer too short to read int32 at offset ${offset} (length ${buf.length})`
    );
  }
  return { value: buf.readInt32LE(offset), bytesRead: 4 };
}

/** Encode a string as a Pascal-style string: [int32LE length][UTF-8 bytes]. */
export function encodePascalString(s: string): Buffer {
  const strBuf = Buffer.from(s, "utf-8");
  const lenBuf = encodeInt32LE(strBuf.length);
  return Buffer.concat([lenBuf, strBuf]);
}

/** Decode a Pascal-style string from a Buffer at the given offset. */
export function decodePascalString(
  buf: Buffer,
  offset: number
): { value: string; bytesRead: number } {
  const { value: length } = decodeInt32LE(buf, offset);
  if (length < 0) {
    throw new Error(`Invalid string length: ${length}`);
  }
  const strStart = offset + 4;
  if (buf.length < strStart + length) {
    throw new Error(
      `Buffer too short to read string of length ${length} at offset ${strStart} (buffer length ${buf.length})`
    );
  }
  const value = buf.toString("utf-8", strStart, strStart + length);
  return { value, bytesRead: 4 + length };
}

/**
 * Encode a full Workbench NET API request.
 *
 * @param clientId  Identifier for this client (e.g. "ClaudeMCP")
 * @param apiFunc   The NetApiHandler class name or built-in function
 * @param params    Additional JSON parameters merged into the payload
 * @returns Complete request buffer ready to send over TCP
 */
export function encodeRequest(
  clientId: string,
  apiFunc: string,
  params: Record<string, unknown> = {}
): Buffer {
  const payload = JSON.stringify({ ...params, APIFunc: apiFunc });
  return Buffer.concat([
    encodeInt32LE(PROTOCOL_VERSION),
    encodePascalString(clientId),
    encodePascalString(CONTENT_TYPE),
    encodePascalString(payload),
  ]);
}

/**
 * Decode a Workbench NET API response.
 *
 * Response wire format:
 *   [pascalString status]   — "Ok" on success, error message otherwise
 *   [pascalString payload]  — JSON data (only present when status is "Ok")
 *
 * @param buf  Raw response bytes from the TCP socket
 * @returns Parsed JSON object from the payload
 * @throws Error if status is not "Ok" or payload JSON is invalid
 */
export function decodeResponse<T = Record<string, unknown>>(buf: Buffer): T {
  const { value: status, bytesRead } = decodePascalString(buf, 0);

  // Status != "Ok" means an error — throw regardless of trailing data
  if (status !== "Ok") {
    throw new Error(`Workbench error: ${status}`);
  }

  // Parse the JSON payload from the second Pascal string (if present)
  if (buf.length > bytesRead) {
    const { value: payload } = decodePascalString(buf, bytesRead);
    if (payload.length > 0) {
      try {
        return JSON.parse(payload) as T;
      } catch {
        throw new Error(
          `Failed to parse response JSON: ${payload.slice(0, 200)}`
        );
      }
    }
  }

  // "Ok" with no/empty payload — return empty object
  return {} as T;
}
