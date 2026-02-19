export type ScriptType =
  | "modded"
  | "component"
  | "gamemode"
  | "action"
  | "entity"
  | "manager"
  | "basic";

export interface ScriptOptions {
  /** Full class name including prefix (e.g., "TAG_MyComponent") */
  className: string;
  /** Script template type */
  scriptType: ScriptType;
  /** Parent class to extend (uses default per type if omitted) */
  parentClass?: string;
  /** Method names to generate stubs for */
  methods?: string[];
  /** Description added as a comment at the top */
  description?: string;
}

const DEFAULT_PARENTS: Record<ScriptType, string> = {
  modded: "", // must be provided
  component: "ScriptComponent",
  gamemode: "SCR_BaseGameMode",
  action: "ScriptedUserAction",
  entity: "GenericEntity",
  manager: "", // static class, no parent
  basic: "", // no parent
};

const COMPONENT_METHODS = [
  {
    signature: "override void EOnInit(IEntity owner)",
    body: "    // Called when the component is initialized",
  },
  {
    signature: "override void OnPostInit(IEntity owner)",
    body: "    // Called after all components are initialized",
  },
  {
    signature: "override void OnDelete(IEntity owner)",
    body: "    // Called when the entity is deleted",
  },
];

const GAMEMODE_METHODS = [
  {
    signature: "override void OnGameStart()",
    body: "    super.OnGameStart();\n    // Called when the game mode starts",
  },
  {
    signature: "override void OnPlayerConnected(int playerId)",
    body: "    super.OnPlayerConnected(playerId);\n    // Called when a player connects",
  },
  {
    signature: "override void OnPlayerDisconnected(int playerId, KickCauseGroup cause, int timeout)",
    body: "    super.OnPlayerDisconnected(playerId, cause, timeout);\n    // Called when a player disconnects",
  },
  {
    signature: "override void OnPlayerSpawned(int playerId, IEntity controlledEntity)",
    body: "    super.OnPlayerSpawned(playerId, controlledEntity);\n    // Called when a player spawns",
  },
];

const ACTION_METHODS = [
  {
    signature: "override void PerformAction(IEntity pOwnerEntity, IEntity pUserEntity)",
    body: "    // Called when the action is performed by the user",
  },
  {
    signature: "override bool CanBePerformedScript(IEntity user)",
    body: "    // Return true if the action can be performed\n    return true;",
  },
  {
    signature: "override bool CanBeShownScript(IEntity user)",
    body: "    // Return true if the action should be visible\n    return true;",
  },
  {
    signature: "override bool HasLocalEffectOnlyScript()",
    body: "    // Return true if the action only has local effects (no replication)\n    return false;",
  },
];

const ENTITY_METHODS = [
  {
    signature: "override void EOnInit(IEntity owner)",
    body: "    // Called when the entity is initialized\n    SetEventMask(EntityEvent.FRAME);",
  },
  {
    signature: "override void EOnFrame(IEntity owner, float timeSlice)",
    body: "    // Called every frame (requires EntityEvent.FRAME flag)",
  },
];

/**
 * Generate an Enforce Script (.c) file from a template.
 */
export function generateScript(opts: ScriptOptions): string {
  const parent = opts.parentClass || DEFAULT_PARENTS[opts.scriptType];
  const lines: string[] = [];

  // Header comment
  if (opts.description) {
    lines.push(`// ${opts.description}`);
    lines.push("");
  }

  switch (opts.scriptType) {
    case "modded":
      lines.push(...generateModded(opts.className, parent, opts.methods));
      break;
    case "component":
      lines.push(...generateComponent(opts.className, parent, opts.methods));
      break;
    case "gamemode":
      lines.push(...generateGamemode(opts.className, parent, opts.methods));
      break;
    case "action":
      lines.push(...generateAction(opts.className, parent, opts.methods));
      break;
    case "entity":
      lines.push(...generateEntity(opts.className, parent, opts.methods));
      break;
    case "manager":
      lines.push(...generateManager(opts.className, opts.methods));
      break;
    case "basic":
      lines.push(...generateBasic(opts.className, parent, opts.methods));
      break;
  }

  lines.push(""); // trailing newline
  return lines.join("\n");
}

function generateModded(className: string, parent: string, methods?: string[]): string[] {
  if (!parent) {
    throw new Error("Modded scripts require a parentClass to mod");
  }

  const lines: string[] = [];
  lines.push(`modded class ${parent}`);
  lines.push("{");

  if (methods && methods.length > 0) {
    for (const method of methods) {
      lines.push(`  override ${method}`);
      lines.push("  {");
      lines.push(`    super.${extractMethodName(method)}();`);
      lines.push("  }");
      lines.push("");
    }
  } else {
    lines.push("  // Add your overrides here");
    lines.push("");
  }

  lines.push("}");
  return lines;
}

function generateComponent(className: string, parent: string, methods?: string[]): string[] {
  const lines: string[] = [];
  lines.push("[ComponentEditorProps(category: \"GameScripted\", description: \"\")]");
  lines.push(`class ${className} : ${parent}`);
  lines.push("{");
  lines.push("  // Member variables");
  lines.push("");

  const methodList = methods?.length
    ? methods.map((m) => ({ signature: `override ${m}`, body: `    // TODO: implement ${extractMethodName(m)}` }))
    : COMPONENT_METHODS;

  for (const m of methodList) {
    lines.push(`  ${m.signature}`);
    lines.push("  {");
    lines.push(m.body);
    lines.push("  }");
    lines.push("");
  }

  lines.push("}");
  return lines;
}

function generateGamemode(className: string, parent: string, methods?: string[]): string[] {
  const lines: string[] = [];
  lines.push(`class ${className} : ${parent}`);
  lines.push("{");
  lines.push("  // Member variables");
  lines.push("");

  const methodList = methods?.length
    ? methods.map((m) => ({ signature: `override ${m}`, body: `    super.${extractMethodName(m)}();\n    // TODO: implement` }))
    : GAMEMODE_METHODS;

  for (const m of methodList) {
    lines.push(`  ${m.signature}`);
    lines.push("  {");
    lines.push(m.body);
    lines.push("  }");
    lines.push("");
  }

  lines.push("}");
  return lines;
}

function generateAction(className: string, parent: string, methods?: string[]): string[] {
  const lines: string[] = [];
  lines.push(`class ${className} : ${parent}`);
  lines.push("{");

  const methodList = methods?.length
    ? methods.map((m) => ({ signature: `override ${m}`, body: `    // TODO: implement ${extractMethodName(m)}` }))
    : ACTION_METHODS;

  for (const m of methodList) {
    lines.push(`  ${m.signature}`);
    lines.push("  {");
    lines.push(m.body);
    lines.push("  }");
    lines.push("");
  }

  lines.push("}");
  return lines;
}

function generateEntity(className: string, parent: string, methods?: string[]): string[] {
  const lines: string[] = [];
  lines.push(`class ${className} : ${parent}`);
  lines.push("{");
  lines.push("  // Member variables");
  lines.push("");

  const methodList = methods?.length
    ? methods.map((m) => ({ signature: `override ${m}`, body: `    // TODO: implement ${extractMethodName(m)}` }))
    : ENTITY_METHODS;

  for (const m of methodList) {
    lines.push(`  ${m.signature}`);
    lines.push("  {");
    lines.push(m.body);
    lines.push("  }");
    lines.push("");
  }

  lines.push("}");
  return lines;
}

function generateManager(className: string, methods?: string[]): string[] {
  const lines: string[] = [];
  lines.push(`class ${className}`);
  lines.push("{");
  lines.push(`  private static ref ${className} s_Instance;`);
  lines.push("");
  lines.push(`  static ${className} GetInstance()`);
  lines.push("  {");
  lines.push("    if (!s_Instance)");
  lines.push(`      s_Instance = new ${className}();`);
  lines.push("    return s_Instance;");
  lines.push("  }");
  lines.push("");

  if (methods && methods.length > 0) {
    for (const method of methods) {
      lines.push(`  ${method}`);
      lines.push("  {");
      lines.push("    // TODO: implement");
      lines.push("  }");
      lines.push("");
    }
  }

  lines.push("}");
  return lines;
}

function generateBasic(className: string, parent: string, methods?: string[]): string[] {
  const lines: string[] = [];
  if (parent) {
    lines.push(`class ${className} : ${parent}`);
  } else {
    lines.push(`class ${className}`);
  }
  lines.push("{");

  if (methods && methods.length > 0) {
    for (const method of methods) {
      const keyword = parent ? "override " : "";
      lines.push(`  ${keyword}${method}`);
      lines.push("  {");
      lines.push("    // TODO: implement");
      lines.push("  }");
      lines.push("");
    }
  } else {
    lines.push("  // TODO: implement");
    lines.push("");
  }

  lines.push("}");
  return lines;
}

/** Extract the method name from a signature like "void OnInit(int x)" → "OnInit" */
function extractMethodName(sig: string): string {
  const match = sig.match(/(\w+)\s*\(/);
  return match ? match[1] : sig;
}

/**
 * Get the correct module subfolder for a script type.
 * Scripts must be in the right folder or they're silently ignored.
 */
export function getScriptModuleFolder(scriptType: ScriptType): string {
  // All standard mod scripts go in Scripts/Game/
  // WorkbenchGame/ is only for editor plugins
  // GameLib/ is for engine extensions (rare)
  return "Scripts/Game";
}

/**
 * Derive a filename from the class name.
 */
export function getScriptFilename(className: string): string {
  return `${className}.c`;
}
