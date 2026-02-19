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
}

/** A node in the Enfusion text tree */
export interface EnfusionNode {
  /** Type name (e.g., "GameProject", "GenericEntity", "MeshObject") */
  type: string;
  /** Quoted GUID that follows the type name (e.g., component instance ID) */
  id?: string;
  /** Parent reference after ":" (e.g., "{GUID}path/to/parent.et") */
  inheritance?: string;
  /** Key-value properties */
  properties: EnfusionProperty[];
  /** Standalone quoted values (e.g., dependency GUIDs in Dependencies block) */
  values: string[];
  /** Child nodes (blocks nested inside this node) */
  children: EnfusionNode[];
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
          str += input[i + 1];
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

    // Optional bare-word ID after type name (e.g., "GameProjectConfig PC")
    let next = this.peek();
    if (next && next.type === TokenType.Identifier) {
      const saved = this.pos;
      const bareId = this.advance();
      const afterBare = this.peek();
      if (afterBare && (afterBare.type === TokenType.OpenBrace || afterBare.type === TokenType.Colon || afterBare.type === TokenType.String)) {
        node.id = bareId.value;
      } else {
        this.pos = saved;
      }
    }

    // Optional quoted GUID string after type name (before ":" or "{")
    next = this.peek();
    if (next && next.type === TokenType.String) {
      const saved = this.pos;
      const strTok = this.advance();
      const afterStr = this.peek();
      if (afterStr && (afterStr.type === TokenType.OpenBrace || afterStr.type === TokenType.Colon)) {
        // This quoted string is the node ID (e.g., component GUID)
        node.id = strTok.value;
      } else {
        // Not followed by { or :, restore position
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
              // Ident Ident "string" without brace — unusual
              // Treat first ident as key, rest as value
              this.pos = saved2;
              node.properties.push({ key: identTok.value, value: ident2.value });
            }
          } else {
            // Key BareValue — simple property with unquoted value
            node.properties.push({ key: identTok.value, value: ident2.value });
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
          this.pos--;
          const child = this.parseNode();
          node.children.push(child);
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

  /**
   * Parse a node where the type name is composed of multiple identifiers.
   * In Enfusion, "GameProjectConfig PC" has type "GameProjectConfig" and
   * a secondary identifier "PC" that acts as the node's ID.
   */
  parseNodeMultiIdent(firstIdent: string): EnfusionNode {
    // Already consumed firstIdent. peek at next.
    const next = this.peek();
    if (next && next.type === TokenType.Identifier) {
      const secondIdent = this.advance();
      // Use combined as type, or firstIdent as type and secondIdent as id
      const node: EnfusionNode = {
        type: firstIdent,
        id: secondIdent.value,
        properties: [],
        values: [],
        children: [],
      };

      // Check for ":" inheritance
      const after = this.peek();
      if (after && after.type === TokenType.Colon) {
        this.advance();
        const inhTok = this.expect(TokenType.String);
        node.inheritance = inhTok.value;
      }

      // Opening brace
      this.expect(TokenType.OpenBrace);
      // ... would need to parse contents
      // This is getting complex — let's handle it in parseNode instead
      return node;
    }
    throw new Error("Expected identifier after type name");
  }
}

// ---------------------------------------------------------------------------
// Serializer
// ---------------------------------------------------------------------------

/** Escape backslashes and double quotes in string values for serialization. */
function escapeString(str: string): string {
  return str.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function serializeNode(node: EnfusionNode, indent: number): string {
  const pad = " ".repeat(indent);
  const innerPad = " ".repeat(indent + 1);
  const parts: string[] = [];

  // Type name
  let header = node.type;

  // Secondary identifier (bare word after type — e.g., "PC" in "GameProjectConfig PC")
  // We store this in node.id only when it's a bare word, not a GUID string
  // For component GUIDs, we quote them
  if (node.id !== undefined) {
    // If the id looks like a GUID or contains special chars, quote it
    if (/^[A-Za-z0-9_]+$/.test(node.id) && !/^[0-9A-F]{16}$/.test(node.id)) {
      header += ` ${node.id}`;
    } else {
      header += ` "${escapeString(node.id)}"`;
    }
  }

  // Inheritance
  if (node.inheritance !== undefined) {
    header += ` : "${escapeString(node.inheritance)}"`;
  }

  parts.push(`${pad}${header} {`);

  // Properties
  for (const prop of node.properties) {
    if (typeof prop.value === "string") {
      // If value looks like a bare number or boolean, don't quote it
      if (/^-?\d+(\.\d+)?$/.test(prop.value) || prop.value === "true" || prop.value === "false") {
        parts.push(`${innerPad}${prop.key} ${prop.value}`);
      } else {
        parts.push(`${innerPad}${prop.key} "${escapeString(prop.value)}"`);
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
