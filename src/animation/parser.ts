export function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function extractBlocks(
  text: string,
  typeName: string
): Array<{ name: string; body: string }> {
  const results: Array<{ name: string; body: string }> = [];
  const openRe = new RegExp(
    `^[ \\t]*${escapeRegExp(typeName)}[ \\t]+"?([^"\\s{][^{]*?)"?[ \\t]*\\{[ \\t]*$`,
    "gm"
  );
  let match: RegExpExecArray | null;
  while ((match = openRe.exec(text)) !== null) {
    const name = match[1].trim().replace(/^"|"$/g, "");
    const openBrace = text.indexOf("{", match.index + match[0].indexOf("{"));
    let depth = 1;
    let i = openBrace + 1;
    while (i < text.length && depth > 0) {
      if (text[i] === "{") depth++;
      else if (text[i] === "}") depth--;
      i++;
    }
    const body = text.slice(openBrace + 1, i - 1);
    results.push({ name, body });
  }
  return results;
}

export function extractProp(body: string, propName: string): string | null {
  const re = new RegExp(
    `^[ \\t]*${escapeRegExp(propName)}[ \\t]+"?([^"\\n\\r]+?)"?[ \\t]*$`,
    "m"
  );
  const m = body.match(re);
  if (!m) return null;
  return m[1].trim().replace(/^"|"$/g, "");
}

export function extractStringArray(body: string, propName: string): string[] {
  const startRe = new RegExp(
    `^[ \\t]*${escapeRegExp(propName)}[ \\t]*\\{`,
    "m"
  );
  const startMatch = body.match(startRe);
  if (!startMatch || startMatch.index === undefined) return [];
  const openPos = body.indexOf("{", startMatch.index + startMatch[0].lastIndexOf("{") - 1);
  let depth = 1;
  let i = openPos + 1;
  while (i < body.length && depth > 0) {
    if (body[i] === "{") depth++;
    else if (body[i] === "}") depth--;
    i++;
  }
  const inner = body.slice(openPos + 1, i - 1);
  const items: string[] = [];
  const itemRe = /"([^"\n\r]*)"/g;
  let m: RegExpExecArray | null;
  while ((m = itemRe.exec(inner)) !== null) {
    items.push(m[1]);
  }
  return items;
}
