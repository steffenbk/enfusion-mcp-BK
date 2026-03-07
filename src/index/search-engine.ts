import { loadIndex } from "./loader.js";
import type { ClassInfo, MethodInfo, EnumInfo, PropertyInfo, WikiPage, GroupInfo } from "./types.js";

export interface MethodSearchResult {
  className: string;
  classSource: "enfusion" | "arma";
  classGroup: string;
  method: MethodInfo;
}

export interface EnumSearchResult {
  className: string;
  classSource: "enfusion" | "arma";
  classGroup: string;
  enumInfo: EnumInfo;
}

export interface PropertySearchResult {
  className: string;
  classSource: "enfusion" | "arma";
  classGroup: string;
  property: PropertyInfo;
}

export interface SearchResult {
  type: "class" | "method" | "enum" | "property";
  score: number;
  classInfo?: ClassInfo;
  methodResult?: MethodSearchResult;
  enumResult?: EnumSearchResult;
  propertyResult?: PropertySearchResult;
}

export interface ComponentSearchResult {
  component: ClassInfo;
  categories: string[];
  eventHandlers: string[];
  score: number;
}

export class SearchEngine {
  private classByName: Map<string, ClassInfo> = new Map();
  private classNames: string[] = [];
  private methodIndex: Map<string, MethodSearchResult[]> = new Map();
  private enumIndex: Map<string, EnumSearchResult[]> = new Map();
  private propertyIndex: Map<string, PropertySearchResult[]> = new Map();
  private wikiPages: WikiPage[] = [];
  private wikiPageByTitle: Map<string, WikiPage> = new Map();
  private groups: GroupInfo[] = [];
  private componentIndex: ClassInfo[] = [];
  private loaded = false;

  constructor(private dataDir: string) {
    this.load();
  }

  private load(): void {
    const data = loadIndex(this.dataDir);
    this.wikiPages = data.wikiPages;
    for (const page of this.wikiPages) {
      this.wikiPageByTitle.set(page.title.toLowerCase(), page);
    }
    this.groups = data.groups;

    const allClasses = [...data.enfusionClasses, ...data.armaClasses];

    for (const cls of allClasses) {
      const key = cls.name.toLowerCase();
      this.classByName.set(key, cls);
      this.classNames.push(cls.name);

      // Index methods (public + protected + static)
      const allMethods = [
        ...(cls.methods || []),
        ...(cls.protectedMethods || []),
        ...(cls.staticMethods || []),
      ];
      for (const method of allMethods) {
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

      // Index enums
      for (const enumInfo of cls.enums || []) {
        const enumKey = enumInfo.name.toLowerCase();
        let entries = this.enumIndex.get(enumKey);
        if (!entries) {
          entries = [];
          this.enumIndex.set(enumKey, entries);
        }
        entries.push({
          className: cls.name,
          classSource: cls.source,
          classGroup: cls.group,
          enumInfo,
        });

        // Also index by enum value names for searching
        for (const val of enumInfo.values) {
          const valKey = val.name.toLowerCase();
          let valEntries = this.enumIndex.get(valKey);
          if (!valEntries) {
            valEntries = [];
            this.enumIndex.set(valKey, valEntries);
          }
          // Only add if not already referencing same enum
          if (!valEntries.some((e) => e.enumInfo.name === enumInfo.name && e.className === cls.name)) {
            valEntries.push({
              className: cls.name,
              classSource: cls.source,
              classGroup: cls.group,
              enumInfo,
            });
          }
        }
      }

      // Index properties (public + protected)
      for (const prop of [...(cls.properties || []), ...(cls.protectedProperties || [])]) {
        const propKey = prop.name.toLowerCase();
        let entries = this.propertyIndex.get(propKey);
        if (!entries) {
          entries = [];
          this.propertyIndex.set(propKey, entries);
        }
        entries.push({
          className: cls.name,
          classSource: cls.source,
          classGroup: cls.group,
          property: prop,
        });
      }
    }

    // Detect enum-like classes (0 methods, 4+ properties) and index as synthetic enums
    for (const cls of allClasses) {
      const methodCount =
        (cls.methods?.length || 0) +
        (cls.protectedMethods?.length || 0) +
        (cls.staticMethods?.length || 0);
      const allProps = [...(cls.properties || []), ...(cls.protectedProperties || [])];
      if (methodCount > 0 || allProps.length < 4) continue;

      // Build a synthetic EnumInfo from properties
      const syntheticEnum: EnumInfo = {
        name: cls.name,
        description: `[Enum-like class] ${cls.brief || "Static constant values"}`,
        values: allProps.map((p) => ({
          name: p.name,
          value: "",
          description: p.type,
        })),
      };

      const enumEntry: EnumSearchResult = {
        className: cls.name,
        classSource: cls.source,
        classGroup: cls.group,
        enumInfo: syntheticEnum,
      };

      // Index by class name
      const classKey = cls.name.toLowerCase();
      let entries = this.enumIndex.get(classKey);
      if (!entries) {
        entries = [];
        this.enumIndex.set(classKey, entries);
      }
      entries.push(enumEntry);

      // Index by each property/value name
      for (const prop of allProps) {
        const valKey = prop.name.toLowerCase();
        let valEntries = this.enumIndex.get(valKey);
        if (!valEntries) {
          valEntries = [];
          this.enumIndex.set(valKey, valEntries);
        }
        if (!valEntries.some((e) => e.enumInfo.name === syntheticEnum.name && e.className === cls.name)) {
          valEntries.push(enumEntry);
        }
      }
    }

    // Build component index: collect all ScriptComponent descendants
    // Use multiple strategies since scraped inheritance chains are often broken
    const componentNames = new Set<string>();

    // Strategy 1: Walk descendants from known component base classes
    for (const baseName of ["ScriptComponent", "GenericComponent", "GameComponent", "ScriptGameComponent"]) {
      if (this.classByName.has(baseName.toLowerCase())) {
        const tree = this.getClassTree(baseName);
        for (const name of tree.descendants) {
          componentNames.add(name.toLowerCase());
        }
      }
    }

    // Strategy 2: Name-based heuristic — classes ending in "Component" but not "ComponentClass"
    for (const cls of allClasses) {
      if (cls.name.endsWith("Component") && !cls.name.endsWith("ComponentClass")) {
        componentNames.add(cls.name.toLowerCase());
      }
    }

    for (const key of componentNames) {
      const cls = this.classByName.get(key);
      if (cls) this.componentIndex.push(cls);
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

  searchEnums(
    query: string,
    source: "enfusion" | "arma" | "all" = "all",
    limit = 10
  ): EnumSearchResult[] {
    const q = query.toLowerCase();
    const results: Array<{ result: EnumSearchResult; score: number }> = [];
    const seen = new Set<string>();

    for (const [enumKey, entries] of this.enumIndex) {
      let score = 0;
      if (enumKey === q) {
        score = 100;
      } else if (enumKey.startsWith(q)) {
        score = 80;
      } else if (enumKey.includes(q)) {
        score = 60;
      }

      if (score > 0) {
        for (const entry of entries) {
          if (source !== "all" && entry.classSource !== source) continue;
          // Deduplicate by className+enumName
          const dedup = `${entry.className}::${entry.enumInfo.name}`;
          if (seen.has(dedup)) continue;
          seen.add(dedup);
          results.push({ result: entry, score });
        }
      }
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit).map((r) => r.result);
  }

  searchProperties(
    query: string,
    source: "enfusion" | "arma" | "all" = "all",
    limit = 10
  ): PropertySearchResult[] {
    const q = query.toLowerCase();
    const results: Array<{ result: PropertySearchResult; score: number }> = [];

    for (const [propName, entries] of this.propertyIndex) {
      let score = 0;
      if (propName === q) {
        score = 100;
      } else if (propName.startsWith(q)) {
        score = 80;
      } else if (propName.includes(q)) {
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
    const q = query.toLowerCase();
    const combined: SearchResult[] = [];

    // Classes — score directly to preserve granularity
    for (const cls of this.classByName.values()) {
      if (source !== "all" && cls.source !== source) continue;
      const score = this.nameScore(cls.name.toLowerCase(), q);
      if (score > 0) combined.push({ type: "class", score, classInfo: cls });
    }

    // Methods
    for (const [methodName, entries] of this.methodIndex) {
      const score = this.nameScore(methodName, q);
      if (score <= 0) continue;
      for (const entry of entries) {
        if (source !== "all" && entry.classSource !== source) continue;
        combined.push({ type: "method", score, methodResult: entry });
      }
    }

    // Enums
    const seenEnums = new Set<string>();
    for (const [enumKey, entries] of this.enumIndex) {
      const score = this.nameScore(enumKey, q);
      if (score <= 0) continue;
      for (const entry of entries) {
        if (source !== "all" && entry.classSource !== source) continue;
        const dedup = `${entry.className}::${entry.enumInfo.name}`;
        if (seenEnums.has(dedup)) continue;
        seenEnums.add(dedup);
        combined.push({ type: "enum", score, enumResult: entry });
      }
    }

    // Properties
    for (const [propName, entries] of this.propertyIndex) {
      const score = this.nameScore(propName, q);
      if (score <= 0) continue;
      for (const entry of entries) {
        if (source !== "all" && entry.classSource !== source) continue;
        combined.push({ type: "property", score, propertyResult: entry });
      }
    }

    combined.sort((a, b) => b.score - a.score);
    return combined.slice(0, limit);
  }

  private nameScore(nameLower: string, queryLower: string): number {
    if (nameLower === queryLower) return 100;
    if (nameLower.startsWith(queryLower)) return 80;
    if (nameLower.includes(queryLower)) return 60;
    return 0;
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

  /** Look up a wiki page by exact title (case-insensitive). */
  getWikiPage(title: string): WikiPage | undefined {
    return this.wikiPageByTitle.get(title.toLowerCase());
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
   * Get all inherited members by walking the inheritance chain.
   * Returns methods, properties, and enums from all ancestor classes.
   */
  getInheritedMembers(name: string): {
    methods: MethodSearchResult[];
    properties: PropertySearchResult[];
    enums: EnumSearchResult[];
  } {
    const methods: MethodSearchResult[] = [];
    const properties: PropertySearchResult[] = [];
    const enums: EnumSearchResult[] = [];

    const chain = this.getInheritanceChain(name);
    // Skip the class itself — only include ancestors
    for (const ancestorName of chain.slice(0, -1)) {
      const cls = this.getClass(ancestorName);
      if (!cls) continue;

      for (const method of [...(cls.methods || []), ...(cls.protectedMethods || []), ...(cls.staticMethods || [])]) {
        methods.push({
          className: cls.name,
          classSource: cls.source,
          classGroup: cls.group,
          method,
        });
      }

      for (const prop of [...(cls.properties || []), ...(cls.protectedProperties || [])]) {
        properties.push({
          className: cls.name,
          classSource: cls.source,
          classGroup: cls.group,
          property: prop,
        });
      }

      for (const enumInfo of cls.enums || []) {
        enums.push({
          className: cls.name,
          classSource: cls.source,
          classGroup: cls.group,
          enumInfo,
        });
      }
    }

    return { methods, properties, enums };
  }

  /**
   * Get inherited members from only the N nearest parent classes.
   * Returns members ordered from immediate parent outward.
   */
  getInheritedMembersLimited(
    name: string,
    maxParents = 3
  ): {
    methods: MethodSearchResult[];
    properties: PropertySearchResult[];
    enums: EnumSearchResult[];
    parentClassNames: string[];
  } {
    const methods: MethodSearchResult[] = [];
    const properties: PropertySearchResult[] = [];
    const enums: EnumSearchResult[] = [];
    const parentClassNames: string[] = [];

    const chain = this.getInheritanceChain(name);
    // chain is [root, ..., parent, className]
    // Take the nearest N ancestors (excluding the class itself), then reverse so immediate parent is first
    const ancestors = chain.slice(0, -1);
    const nearest = ancestors.slice(-maxParents).reverse();

    for (const ancestorName of nearest) {
      const cls = this.getClass(ancestorName);
      if (!cls) continue;

      parentClassNames.push(cls.name);

      for (const method of [
        ...(cls.methods || []),
        ...(cls.protectedMethods || []),
        ...(cls.staticMethods || []),
      ]) {
        methods.push({
          className: cls.name,
          classSource: cls.source,
          classGroup: cls.group,
          method,
        });
      }

      for (const prop of [
        ...(cls.properties || []),
        ...(cls.protectedProperties || []),
      ]) {
        properties.push({
          className: cls.name,
          classSource: cls.source,
          classGroup: cls.group,
          property: prop,
        });
      }

      for (const enumInfo of cls.enums || []) {
        enums.push({
          className: cls.name,
          classSource: cls.source,
          classGroup: cls.group,
          enumInfo,
        });
      }
    }

    return { methods, properties, enums, parentClassNames };
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
   * Infer categories for a component based on class name and group keywords.
   */
  private inferComponentCategories(cls: ClassInfo): string[] {
    const categories: string[] = [];
    const nameLower = cls.name.toLowerCase();
    const groupLower = (cls.group || "").toLowerCase();
    const combined = nameLower + " " + groupLower;

    if (combined.includes("character")) categories.push("character");
    if (combined.includes("vehicle")) categories.push("vehicle");
    if (combined.includes("weapon")) categories.push("weapon");
    if (combined.includes("damage") || combined.includes("hitzone")) categories.push("damage");
    if (combined.includes("inventory") || combined.includes("storage")) categories.push("inventory");
    if (combined.includes("aigroup") || combined.includes("aibehavior") || combined.includes("aicomponent") || /\bai[A-Z_]/.test(cls.name) || /\bai\b/.test(groupLower)) categories.push("ai");
    if (combined.includes("widget") || combined.includes("layout") || combined.includes("hud") || combined.includes("menu")) categories.push("ui");
    if (combined.includes("editor") || combined.includes("workbench")) categories.push("editor");
    if (combined.includes("camera")) categories.push("camera");
    if (combined.includes("sound") || combined.includes("audio")) categories.push("sound");

    if (categories.length === 0) categories.push("general");
    return categories;
  }

  /**
   * Extract event handler method names from a component class.
   * Looks for methods starting with "EOn" or "On" (Enfusion event naming conventions).
   */
  private getEventHandlers(cls: ClassInfo): string[] {
    const handlers: string[] = [];
    const allMethods = [
      ...(cls.methods || []),
      ...(cls.protectedMethods || []),
    ];

    for (const method of allMethods) {
      if (/^(EOn|On)[A-Z]/.test(method.name)) {
        handlers.push(method.name);
      }
    }

    return handlers;
  }

  /**
   * Search for ScriptComponent descendants with optional filtering.
   * Supports filtering by name/keyword, entity category, and event handlers.
   */
  searchComponents(options: {
    query?: string;
    category?: string;
    event?: string;
    source?: "enfusion" | "arma" | "all";
    limit?: number;
  } = {}): ComponentSearchResult[] {
    const { query, category = "any", event, source = "all", limit = 20 } = options;
    const q = query?.toLowerCase();
    const eventLower = event?.toLowerCase();
    const results: ComponentSearchResult[] = [];

    for (const cls of this.componentIndex) {
      // Source filter
      if (source !== "all" && cls.source !== source) continue;

      // Category filter
      const categories = this.inferComponentCategories(cls);
      if (category !== "any" && !categories.includes(category)) continue;

      // Event filter
      const eventHandlers = this.getEventHandlers(cls);
      if (eventLower) {
        const hasMatch = eventHandlers.some((h) => h.toLowerCase().includes(eventLower));
        if (!hasMatch) continue;
      }

      // Query scoring (same pattern as searchClasses)
      let score = 0;
      if (q) {
        const nameLower = cls.name.toLowerCase();
        if (nameLower === q) {
          score = 100;
        } else if (nameLower.startsWith(q)) {
          score = 80;
        } else if (nameLower.includes(q)) {
          score = 60;
        } else if (cls.brief.toLowerCase().includes(q)) {
          score = 30;
        } else if (cls.description.toLowerCase().includes(q)) {
          score = 20;
        } else {
          // Query didn't match anything on this component
          continue;
        }
      } else {
        // No query — give a base score so category/event-only filters work
        score = 10;
      }

      results.push({ component: cls, categories, eventHandlers, score });
    }

    results.sort((a, b) => b.score - a.score || a.component.name.localeCompare(b.component.name));
    return results.slice(0, limit);
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

  getStats(): {
    totalClasses: number;
    totalMethods: number;
    totalEnums: number;
    totalProperties: number;
    totalWikiPages: number;
    totalComponents: number;
  } {
    return {
      totalClasses: this.classByName.size,
      totalMethods: this.methodIndex.size,
      totalEnums: this.enumIndex.size,
      totalProperties: this.propertyIndex.size,
      totalWikiPages: this.wikiPages.length,
      totalComponents: this.componentIndex.length,
    };
  }
}
