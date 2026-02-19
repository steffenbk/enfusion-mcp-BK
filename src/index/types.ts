/** A single parameter on a method */
export interface ParamInfo {
  name: string;
  type: string;
  defaultValue: string;
}

/** A single method/function on a class */
export interface MethodInfo {
  name: string;
  returnType: string;
  signature: string;
  params: ParamInfo[];
  description: string;
}

/** A single Enfusion script API class/interface */
export interface ClassInfo {
  /** Class name exactly as in the API (e.g., "IEntity", "SCR_BaseGameMode") */
  name: string;
  /** Source: "enfusion" (engine) or "arma" (game-level) */
  source: "enfusion" | "arma";
  /** Brief one-line description */
  brief: string;
  /** Full description (from detailed docs section) */
  description: string;
  /** Parent class names (direct inheritance only) */
  parents: string[];
  /** Known child class names (direct descendants only) */
  children: string[];
  /** Group/module (e.g., "Entities", "Components") */
  group: string;
  /** Source file path if available */
  sourceFile: string;
  /** Public member functions */
  methods: MethodInfo[];
  /** Protected member functions */
  protectedMethods: MethodInfo[];
  /** URL to original documentation page */
  docsUrl: string;
}

/** A group/module (e.g., "Entities", "Components", "Replication") */
export interface GroupInfo {
  name: string;
  description: string;
  classes: string[];
}

/** Inheritance hierarchy node */
export interface HierarchyNode {
  name: string;
  children: string[];
}

/** A tutorial/guide page from Doxygen docs */
export interface WikiPage {
  title: string;
  source: "enfusion" | "arma";
  content: string;
  filename: string;
}
