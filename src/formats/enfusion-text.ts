/**
 * Parser and serializer for Enfusion text serialization format.
 * Used by .gproj, .et, .ct, .conf, .layer files.
 *
 * Grammar:
 *   Document     = Node
 *   Node         = TypeName [GUID] [":" QuotedString] "{" Content* "}"
 *   Content      = Property | BareValue | Node
 *   Property     = Key (QuotedString | Number | Node)
 *   BareValue    = QuotedString (standalone value inside a block, e.g. dependency GUIDs)
 *   QuotedString = '"' chars '"'
 */

/** A single property: key-value pair */
export interface EnfusionProperty {
  key: string;
  value: string | EnfusionNode;
  /**
   * Force the string value to be emitted quoted, overriding the bare-identifier
   * heuristic. Used for fields that are always strings (e.g. a widget Name) whose
   * value could otherwise be mistaken for a bare enum/identifier.
   */
  quoted?: boolean;
}

/** A node in the Enfusion text tree */
export interface EnfusionNode {
  /** Type name (e.g., "GameProject", "GenericEntity", "MeshObject") */
  type: string;
  /** Quoted GUID that follows the type name (e.g., component instance ID) */
  id?: string;
  /**
   * Class qualifier between type/key and the GUID.
   * E.g., in `Attributes SCR_ItemAttributeCollection "{GUID}" { ... }`,
   * type="Attributes", className="SCR_ItemAttributeCollection", id="{GUID}".
   */
  className?: string;
  /** Parent reference after ":" (e.g., "{GUID}path/to/parent.et") */
  inheritance?: string;
  /** Key-value properties */
  properties: EnfusionProperty[];
  /** Standalone quoted values (e.g., dependency GUIDs in Dependencies block) */
  values: string[];
  /** Child nodes (blocks nested inside this node) */
  children: EnfusionNode[];
  /**
   * Optional raw string to emit verbatim inside the braces instead of serializing
   * properties/values/children. Used when injecting ancestor components with their
   * original content preserved exactly.
   */
  rawContent?: string;
}

// ---------------------------------------------------------------------------
// Tokenizer
// ---------------------------------------------------------------------------

enum TokenType {
  String,     // "quoted string"
  Identifier, // bare word (alphanumeric + _ + .)
  OpenBrace,  // {
  CloseBrace, // }
  Colon,      // :
}

interface Token {
  type: TokenType;
  value: string;
  pos: number;
}

/**
 * A bare token that is purely a number — the elements of a numeric tuple such as
 * `coords 0 0 0` or `Color 1 0.5 0.25 1`. Deliberately strict: a property KEY is
 * always an identifier starting with a letter, so it can never match this, which
 * is what lets the tuple scan stop at the next key.
 */
const NUMERIC_TOKEN = /^-?\d+(\.\d+)?$/;

/** A bare `{HEXGUID}` string — the shape used in dependency/value lists. */
const GUID_VALUE = /^\{[0-9A-Fa-f]+\}$/;

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const len = input.length;

  while (i < len) {
    const ch = input[i];

    // Skip whitespace
    if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r") {
      i++;
      continue;
    }

    // Skip single-line comments (// ...)
    if (ch === "/" && i + 1 < len && input[i + 1] === "/") {
      while (i < len && input[i] !== "\n") i++;
      continue;
    }

    // Quoted string
    if (ch === '"') {
      const start = i;
      i++; // skip opening quote
      let str = "";
      while (i < len && input[i] !== '"') {
        if (input[i] === "\\" && i + 1 < len) {
          const esc = input[i + 1];
          switch (esc) {
            case "n": str += "\n"; break;
            case "t": str += "\t"; break;
            case "r": str += "\r"; break;
            case "\\": str += "\\"; break;
            case '"': str += '"'; break;
            default: str += esc; break;
          }
          i += 2;
        } else {
          str += input[i];
          i++;
        }
      }
      if (i < len) i++; // skip closing quote
      tokens.push({ type: TokenType.String, value: str, pos: start });
      continue;
    }

    if (ch === "{") {
      tokens.push({ type: TokenType.OpenBrace, value: "{", pos: i });
      i++;
      continue;
    }

    if (ch === "}") {
      tokens.push({ type: TokenType.CloseBrace, value: "}", pos: i });
      i++;
      continue;
    }

    if (ch === ":") {
      tokens.push({ type: TokenType.Colon, value: ":", pos: i });
      i++;
      continue;
    }

    // Identifier (bare word): letters, digits, underscore, dot, dash
    if (/[a-zA-Z0-9_.\-]/.test(ch)) {
      const start = i;
      while (i < len && /[a-zA-Z0-9_.\-]/.test(input[i])) i++;
      tokens.push({ type: TokenType.Identifier, value: input.substring(start, i), pos: start });
      continue;
    }

    // Unknown character — skip
    i++;
  }

  return tokens;
}

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

class Parser {
  private tokens: Token[];
  private pos: number;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
    this.pos = 0;
  }

  private peek(): Token | undefined {
    return this.tokens[this.pos];
  }

  private advance(): Token {
    return this.tokens[this.pos++];
  }

  private expect(type: TokenType): Token {
    const tok = this.advance();
    if (!tok || tok.type !== type) {
      const got = tok ? `${TokenType[tok.type]}("${tok.value}") at pos ${tok.pos}` : "EOF";
      throw new Error(`Expected ${TokenType[type]} but got ${got}`);
    }
    return tok;
  }

  /**
   * Parse the root node. An Enfusion document is a single top-level node.
   */
  parseDocument(): EnfusionNode {
    const node = this.parseNode();
    return node;
  }

  /**
   * Parse a node:
   *   TypeName [GUID_STRING] [":" InheritanceString] "{" content* "}"
   */
  private parseNode(): EnfusionNode {
    // Type name — can be Identifier or String (some types are quoted)
    const typeTok = this.advance();
    if (!typeTok || (typeTok.type !== TokenType.Identifier && typeTok.type !== TokenType.String)) {
      const got = typeTok ? `${TokenType[typeTok.type]}("${typeTok.value}")` : "EOF";
      throw new Error(`Expected type name but got ${got}`);
    }

    const node: EnfusionNode = {
      type: typeTok.value,
      properties: [],
      values: [],
      children: [],
    };

    // Optional bare-word after type name (e.g., "GameProjectConfig PC" or class qualifier)
    let next = this.peek();
    if (next && next.type === TokenType.Identifier) {
      const saved = this.pos;
      const bareId = this.advance();
      const afterBare = this.peek();
      if (afterBare && (afterBare.type === TokenType.OpenBrace || afterBare.type === TokenType.Colon)) {
        // BareWord followed by { or : — it's a simple bare-word ID (e.g., "PC")
        node.id = bareId.value;
      } else if (afterBare && afterBare.type === TokenType.String) {
        // BareWord followed by "String" — could be className + GUID or just bare ID before colon
        const saved2 = this.pos;
        const strTok = this.advance();
        const afterStr = this.peek();
        if (afterStr && (afterStr.type === TokenType.OpenBrace || afterStr.type === TokenType.Colon)) {
          // Type BareWord "GUID" { — bare word is class qualifier, string is ID
          node.className = bareId.value;
          node.id = strTok.value;
        } else {
          // BareWord "String" not followed by { or : — bare word is just an ID
          this.pos = saved2;
          node.id = bareId.value;
        }
      } else {
        this.pos = saved;
      }
    }

    // Optional quoted GUID string after type name (when no bare-word was consumed)
    next = this.peek();
    if (next && next.type === TokenType.String && node.id === undefined) {
      const saved = this.pos;
      const strTok = this.advance();
      const afterStr = this.peek();
      if (afterStr && (afterStr.type === TokenType.OpenBrace || afterStr.type === TokenType.Colon)) {
        node.id = strTok.value;
      } else {
        this.pos = saved;
      }
    }

    // Optional inheritance: ":" QuotedString
    next = this.peek();
    if (next && next.type === TokenType.Colon) {
      this.advance(); // consume ":"
      const inhTok = this.expect(TokenType.String);
      node.inheritance = inhTok.value;
    }

    // Opening brace
    this.expect(TokenType.OpenBrace);

    // Parse contents until closing brace
    while (true) {
      next = this.peek();
      if (!next) {
        throw new Error("Unexpected EOF, expected '}'");
      }
      if (next.type === TokenType.CloseBrace) {
        this.advance();
        break;
      }

      // What kind of content?
      if (next.type === TokenType.Identifier) {
        // Could be:
        // 1. Property: Key "value"  or  Key Number
        // 2. Property: Key SubNode  (Key TypeName "{" ... "}")
        // 3. Child node: TypeName ["guid"] [":" "parent"] "{" ... "}"

        // Look ahead to determine which case
        const saved = this.pos;
        const identTok = this.advance();
        const after = this.peek();

        if (!after || after.type === TokenType.CloseBrace) {
          // Bare identifier at end of block — treat as a value
          node.values.push(identTok.value);
        } else if (after.type === TokenType.String) {
          // Could be: Key "value" (property)
          // Or: TypeName "guid" { ... } (child node with ID)
          const saved2 = this.pos;
          const strTok = this.advance();
          const afterStr = this.peek();

          if (afterStr && afterStr.type === TokenType.OpenBrace) {
            // TypeName "guid" { ... } — child node with ID
            this.pos = saved; // restore to before identifier
            const child = this.parseNode();
            node.children.push(child);
          } else if (afterStr && afterStr.type === TokenType.Colon) {
            // TypeName "guid" : "parent" { ... } — child node with ID + inheritance
            this.pos = saved;
            const child = this.parseNode();
            node.children.push(child);
          } else {
            // Key "value" — simple property
            node.properties.push({ key: identTok.value, value: strTok.value });
          }
        } else if (after.type === TokenType.Identifier) {
          // Could be: Key SubNode  (e.g., "Configurations" "GameProjectConfig PC { ... }")
          // Or property with bare value: Key BareValue
          // Look further: if after the second identifier we see "{", it's a child node
          const saved2 = this.pos;
          const ident2 = this.advance();
          const afterIdent2 = this.peek();

          if (afterIdent2 && afterIdent2.type === TokenType.OpenBrace) {
            // Key TypeName { ... } — this is a property whose value is a child node
            // OR it's two identifiers before a brace (TypeName SubType { })
            // In Enfusion: "GameProjectConfig PC { ... }" means type=GameProjectConfig, but "PC" is like an ID
            // Let's treat it as: identTok is the key, and ident2 + { } is the value node
            this.pos = saved2; // back to ident2
            // But actually, in Enfusion:
            //   Configurations {
            //     GameProjectConfig PC { ... }
            //   }
            // "GameProjectConfig" is the type, "PC" is essentially an ID
            // So we restore to identTok and parse a child node
            this.pos = saved;
            const child = this.parseNode();
            node.children.push(child);
          } else if (afterIdent2 && afterIdent2.type === TokenType.String) {
            // Three tokens: Ident1 Ident2 "string" — could be node: Type SubId "guid" { }
            const saved3 = this.pos;
            const strTok = this.advance();
            const afterStr = this.peek();
            if (afterStr && afterStr.type === TokenType.OpenBrace) {
              // TypeName SubType "guid" { ... }
              this.pos = saved;
              const child = this.parseNode();
              node.children.push(child);
            } else {
              // Ident Ident "string" without brace, e.g.
              //   ChannelFrequency 48000
              //   "Transmitting Range" 2000
              // The first two tokens are a complete key/value pair; the string
              // belongs to the NEXT property and must be re-read.
              //
              // Rewinding to saved2 (which sits *before* ident2) replayed the value
              // token, so `48000` was consumed twice and emitted a bogus
              // `"48000" "Transmitting Range"` property, corrupting every following
              // pair in the block. saved3 is the position just before the string,
              // which is what this branch actually wants.
              this.pos = saved3;
              node.properties.push({ key: identTok.value, value: ident2.value });
            }
          } else {
            // Key BareValue — simple property with unquoted value.
            //
            // Numeric tuples are written as a run of bare numbers after the key
            // (`coords 0 0 0`, `Color 1 0.5 0.25 1`, `Anchor 0 0 1 1`). Taking only
            // the first token silently dropped the rest — `coords 0 0 0` parsed as
            // `coords 0`, losing Y and Z, and no real vanilla .et could round-trip.
            // Greedily consume the whole numeric run: the next key is an identifier
            // that does not look numeric, so it terminates the run naturally.
            let value = ident2.value;
            if (NUMERIC_TOKEN.test(value)) {
              let lookahead = this.peek();
              while (
                lookahead &&
                lookahead.type === TokenType.Identifier &&
                NUMERIC_TOKEN.test(lookahead.value)
              ) {
                value += ` ${this.advance().value}`;
                lookahead = this.peek();
              }
            }
            node.properties.push({ key: identTok.value, value });
          }
        } else if (after.type === TokenType.OpenBrace) {
          // TypeName { ... } — child node with no ID
          this.pos = saved;
          const child = this.parseNode();
          node.children.push(child);
        } else if (after.type === TokenType.Colon) {
          // TypeName : "parent" { ... } — child node with inheritance
          this.pos = saved;
          const child = this.parseNode();
          node.children.push(child);
        } else {
          // Bare identifier followed by something unexpected
          node.values.push(identTok.value);
        }
      } else if (next.type === TokenType.String) {
        // Standalone quoted string (e.g., dependency GUIDs)
        const strTok = this.advance();

        // Check if this string is followed by "{" — meaning it's a type name
        const after = this.peek();
        if (after && after.type === TokenType.OpenBrace) {
          // Quoted type name node (rare but possible)
          if (this.pos > 0) this.pos--;
          const child = this.parseNode();
          node.children.push(child);
        } else if (after && after.type === TokenType.Identifier) {
          // "Quoted Key" bareValue — a multi-word property key. The game writes many
          // of these: `"Transmitting Range" 2000`, `"Blend Mode" Additive`,
          // `"Exact Font Size" 21`. Previously both tokens were pushed as loose
          // values, so the property was lost and the file could not round-trip.
          // Unambiguous: a standalone value list never has a bare word after it.
          let value = this.advance().value;
          if (NUMERIC_TOKEN.test(value)) {
            let lookahead = this.peek();
            while (
              lookahead &&
              lookahead.type === TokenType.Identifier &&
              NUMERIC_TOKEN.test(lookahead.value)
            ) {
              value += ` ${this.advance().value}`;
              lookahead = this.peek();
            }
          }
          node.properties.push({ key: strTok.value, value, quoted: !NUMERIC_TOKEN.test(value) });
        } else if (
          after &&
          after.type === TokenType.String &&
          /\s/.test(strTok.value) &&
          !GUID_VALUE.test(strTok.value)
        ) {
          // "Quoted Key" "quoted value" — e.g. `"Mask Mode" "Include Below"`.
          // Genuinely ambiguous with a list of quoted values, so it is resolved
          // narrowly: only a multi-word, non-GUID string is treated as a key. That
          // keeps `Dependencies { "{GUID}" "{GUID}" }` parsing as a value list.
          node.properties.push({ key: strTok.value, value: this.advance().value, quoted: true });
        } else {
          node.values.push(strTok.value);
        }
      } else {
        // Skip unexpected tokens
        this.advance();
      }
    }

    return node;
  }

}

// ---------------------------------------------------------------------------
// Serializer
// ---------------------------------------------------------------------------

/** Escape backslashes and double quotes in string values for serialization. */
function escapeString(str: string): string {
  return str
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/\t/g, "\\t")
    .replace(/\r/g, "\\r");
}

/**
 * Format a property key. Plain identifiers are emitted bare; keys containing
 * spaces or other non-identifier characters (e.g. UI widget properties like
 * "Blend Mode", "Font Size", "Horizontal Alignment") must be quoted.
 */
function formatKey(key: string): string {
  return /^[A-Za-z_][A-Za-z0-9_.]*$/.test(key) ? key : `"${escapeString(key)}"`;
}

function serializeNode(node: EnfusionNode, indent: number): string {
  const pad = " ".repeat(indent);
  const innerPad = " ".repeat(indent + 1);
  const parts: string[] = [];

  // Type name
  let header = node.type;

  // Class qualifier (e.g., "SCR_ItemAttributeCollection" in "Attributes SCR_ItemAttributeCollection "{GUID}" {")
  if (node.className !== undefined) {
    header += ` ${node.className}`;
  }

  // Node ID — bare word (e.g., "PC") or quoted GUID
  if (node.id !== undefined) {
    if (/^[A-Za-z0-9_]+$/.test(node.id) && !/^[0-9A-Fa-f]{16}$/.test(node.id)) {
      header += ` ${node.id}`;
    } else {
      header += ` "${escapeString(node.id)}"`;
    }
  }

  // Inheritance
  if (node.inheritance !== undefined) {
    header += ` : "${escapeString(node.inheritance)}"`;
  }

  // If raw content is provided, re-indent it to match the target depth and emit
  if (node.rawContent !== undefined) {
    const lines = node.rawContent.split("\n");
    // Find minimum indentation of non-empty lines
    let minIndent = Infinity;
    for (const line of lines) {
      if (line.trim().length === 0) continue;
      const leading = line.match(/^[ \t]*/)?.[0].length ?? 0;
      if (leading < minIndent) minIndent = leading;
    }
    if (minIndent === Infinity) minIndent = 0;

    // Re-indent each line to innerPad level
    const reindented = lines
      .map((line) => {
        if (line.trim().length === 0) return "";
        return innerPad + line.slice(minIndent);
      })
      .filter((line, idx, arr) => {
        // Remove leading/trailing blank lines
        if (idx === 0 && line === "") return false;
        if (idx === arr.length - 1 && line === "") return false;
        return true;
      })
      .join("\n");

    return `${pad}${header} {\n${reindented}\n${pad}}`;
  }

  parts.push(`${pad}${header} {`);

  // Properties
  for (const prop of node.properties) {
    if (typeof prop.value === "string") {
      // Emit bare (unquoted) values for numbers, numeric tuples (vectors/colors/anchors),
      // booleans, and bare identifiers (enums like Manual, Runtime, None) — unless the
      // property is explicitly flagged to always quote.
      if (
        !prop.quoted && (
        /^-?\d+(\.\d+)?$/.test(prop.value) ||
        /^-?\d+(\.\d+)?( -?\d+(\.\d+)?)+$/.test(prop.value) ||
        prop.value === "true" || prop.value === "false" ||
        /^[A-Za-z_][A-Za-z0-9_]*$/.test(prop.value)
      )) {
        parts.push(`${innerPad}${formatKey(prop.key)} ${prop.value}`);
      } else {
        parts.push(`${innerPad}${formatKey(prop.key)} "${escapeString(prop.value)}"`);
      }
    } else {
      // Value is a child node
      parts.push(serializeNode(prop.value, indent + 1));
    }
  }

  // Standalone values (e.g., dependency GUIDs)
  for (const val of node.values) {
    parts.push(`${innerPad}"${escapeString(val)}"`);
  }

  // Child nodes
  for (const child of node.children) {
    parts.push(serializeNode(child, indent + 1));
  }

  parts.push(`${pad}}`);
  return parts.join("\n");
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parse Enfusion text serialization format into a node tree.
 */
export function parse(input: string): EnfusionNode {
  const tokens = tokenize(input);
  if (tokens.length === 0) {
    throw new Error("Empty input");
  }
  const parser = new Parser(tokens);
  return parser.parseDocument();
}

/**
 * Serialize an EnfusionNode tree back to Enfusion text format.
 */
export function serialize(node: EnfusionNode): string {
  return serializeNode(node, 0);
}

/**
 * Create a new empty EnfusionNode.
 */
export function createNode(
  type: string,
  opts?: {
    id?: string;
    inheritance?: string;
    properties?: EnfusionProperty[];
    values?: string[];
    children?: EnfusionNode[];
  }
): EnfusionNode {
  return {
    type,
    id: opts?.id,
    inheritance: opts?.inheritance,
    properties: opts?.properties ?? [],
    values: opts?.values ?? [],
    children: opts?.children ?? [],
  };
}

/**
 * Helper: set or update a property on a node.
 */
export function setProperty(node: EnfusionNode, key: string, value: string | EnfusionNode): void {
  const existing = node.properties.find((p) => p.key === key);
  if (existing) {
    existing.value = value;
  } else {
    node.properties.push({ key, value });
  }
}

/**
 * Helper: get a property value from a node.
 */
export function getProperty(node: EnfusionNode, key: string): string | EnfusionNode | undefined {
  const prop = node.properties.find((p) => p.key === key);
  return prop?.value;
}
