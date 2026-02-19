import { loadIndex } from "./loader.js";
import type { ClassInfo, MethodInfo, WikiPage, GroupInfo } from "./types.js";

export interface MethodSearchResult {
  className: string;
  classSource: "enfusion" | "arma";
  classGroup: string;
  method: MethodInfo;
}

export interface SearchResult {
  type: "class" | "method";
  score: number;
  classInfo?: ClassInfo;
  methodResult?: MethodSearchResult;
}

export class SearchEngine {
  private classByName: Map<string, ClassInfo> = new Map();
  private classNames: string[] = [];
  private methodIndex: Map<string, MethodSearchResult[]> = new Map();
  private wikiPages: WikiPage[] = [];
  private groups: GroupInfo[] = [];
  private loaded = false;

  constructor(private dataDir: string) {
    this.load();
  }

  private load(): void {
    const data = loadIndex(this.dataDir);
    this.wikiPages = data.wikiPages;
    this.groups = data.groups;

    const allClasses = [...data.enfusionClasses, ...data.armaClasses];

    for (const cls of allClasses) {
      const key = cls.name.toLowerCase();
      this.classByName.set(key, cls);
      this.classNames.push(cls.name);

      // Index methods
      for (const method of [...cls.methods, ...cls.protectedMethods]) {
        const methodKey = method.name.toLowerCase();
        let entries = this.methodIndex.get(methodKey);
        if (!entries) {
          entries = [];
          this.methodIndex.set(methodKey, entries);
        }
        entries.push({
          className: cls.name,
          classSource: cls.source,
          classGroup: cls.group,
          method,
        });
      }
    }

    this.loaded = true;
  }

  getClass(name: string): ClassInfo | undefined {
    return this.classByName.get(name.toLowerCase());
  }

  searchClasses(
    query: string,
    source: "enfusion" | "arma" | "all" = "all",
    limit = 10
  ): ClassInfo[] {
    const q = query.toLowerCase();
    const results: Array<{ cls: ClassInfo; score: number }> = [];

    for (const cls of this.classByName.values()) {
      if (source !== "all" && cls.source !== source) continue;

      const nameLower = cls.name.toLowerCase();
      let score = 0;

      // Exact match
      if (nameLower === q) {
        score = 100;
      }
      // Prefix match
      else if (nameLower.startsWith(q)) {
        score = 80;
      }
      // Substring in name
      else if (nameLower.includes(q)) {
        score = 60;
      }
      // Match in brief description
      else if (cls.brief.toLowerCase().includes(q)) {
        score = 30;
      }
      // Match in full description
      else if (cls.description.toLowerCase().includes(q)) {
        score = 20;
      }

      if (score > 0) {
        results.push({ cls, score });
      }
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit).map((r) => r.cls);
  }

  searchMethods(
    query: string,
    source: "enfusion" | "arma" | "all" = "all",
    limit = 10
  ): MethodSearchResult[] {
    const q = query.toLowerCase();
    const results: Array<{ result: MethodSearchResult; score: number }> = [];

    for (const [methodName, entries] of this.methodIndex) {
      let score = 0;
      if (methodName === q) {
        score = 100;
      } else if (methodName.startsWith(q)) {
        score = 80;
      } else if (methodName.includes(q)) {
        score = 60;
      }

      if (score > 0) {
        for (const entry of entries) {
          if (source !== "all" && entry.classSource !== source) continue;
          results.push({ result: entry, score });
        }
      }
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit).map((r) => r.result);
  }

  searchAny(
    query: string,
    source: "enfusion" | "arma" | "all" = "all",
    limit = 10
  ): SearchResult[] {
    const classResults = this.searchClasses(query, source, limit).map(
      (cls) =>
        ({
          type: "class" as const,
          score: cls.name.toLowerCase() === query.toLowerCase() ? 100 : 50,
          classInfo: cls,
        }) satisfies SearchResult
    );

    const methodResults = this.searchMethods(query, source, limit).map(
      (mr) =>
        ({
          type: "method" as const,
          score:
            mr.method.name.toLowerCase() === query.toLowerCase() ? 90 : 40,
          methodResult: mr,
        }) satisfies SearchResult
    );

    const combined = [...classResults, ...methodResults];
    combined.sort((a, b) => b.score - a.score);
    return combined.slice(0, limit);
  }

  searchWiki(query: string, limit = 5): WikiPage[] {
    const tokens = query.toLowerCase().split(/\s+/);
    const results: Array<{ page: WikiPage; score: number }> = [];

    for (const page of this.wikiPages) {
      const titleLower = page.title.toLowerCase();
      const contentLower = page.content.toLowerCase();
      let score = 0;

      for (const token of tokens) {
        if (titleLower.includes(token)) score += 10;
        if (contentLower.includes(token)) score += 1;
      }

      if (score > 0) {
        results.push({ page, score });
      }
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit).map((r) => r.page);
  }

  getGroups(): GroupInfo[] {
    return this.groups;
  }

  getGroup(name: string): GroupInfo | undefined {
    return this.groups.find((g) => g.name.toLowerCase() === name.toLowerCase());
  }

  /** Get all class names (for resource listing) */
  getAllClassNames(): string[] {
    return this.classNames;
  }

  /**
   * Get the full inheritance tree for a class.
   * Walks up through parents[] and down through children[].
   */
  getClassTree(name: string): { ancestors: string[]; descendants: string[] } {
    const ancestors: string[] = [];
    const descendants: string[] = [];

    // Walk up to ancestors
    const visited = new Set<string>();
    const walkUp = (className: string) => {
      const cls = this.getClass(className);
      if (!cls) return;
      for (const parent of cls.parents) {
        if (visited.has(parent.toLowerCase())) continue;
        visited.add(parent.toLowerCase());
        ancestors.push(parent);
        walkUp(parent);
      }
    };
    walkUp(name);

    // Walk down to descendants
    visited.clear();
    const walkDown = (className: string) => {
      const cls = this.getClass(className);
      if (!cls) return;
      for (const child of cls.children) {
        if (visited.has(child.toLowerCase())) continue;
        visited.add(child.toLowerCase());
        descendants.push(child);
        walkDown(child);
      }
    };
    walkDown(name);

    return { ancestors, descendants };
  }

  /**
   * Get the ordered inheritance chain from root to the given class.
   * Returns [root, ..., parent, className].
   */
  getInheritanceChain(name: string): string[] {
    const chain: string[] = [name];
    const visited = new Set<string>([name.toLowerCase()]);
    let current = name;

    while (true) {
      const cls = this.getClass(current);
      if (!cls || cls.parents.length === 0) break;
      const parent = cls.parents[0];
      if (visited.has(parent.toLowerCase())) break; // cycle protection
      visited.add(parent.toLowerCase());
      chain.unshift(parent);
      current = parent;
    }

    return chain;
  }

  /**
   * Get all classes that inherit from ScriptComponent (directly or indirectly).
   * Useful for finding available components to attach to entities.
   */
  getComponents(): ClassInfo[] {
    const tree = this.getClassTree("ScriptComponent");
    const results: ClassInfo[] = [];
    for (const name of tree.descendants) {
      const cls = this.getClass(name);
      if (cls) results.push(cls);
    }
    return results;
  }

  /**
   * Check if a class name exists in the index (case-insensitive).
   */
  hasClass(name: string): boolean {
    return this.classByName.has(name.toLowerCase());
  }

  isLoaded(): boolean {
    return this.loaded;
  }

  getStats(): { totalClasses: number; totalMethods: number; totalWikiPages: number } {
    return {
      totalClasses: this.classByName.size,
      totalMethods: this.methodIndex.size,
      totalWikiPages: this.wikiPages.length,
    };
  }
}
