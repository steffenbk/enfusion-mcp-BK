// Parsed node from AGF
export interface ParsedNode {
  type: string;
  name: string;
  editorPos?: { x: number; y: number };
  children: string[];
  properties: Record<string, unknown>;
  raw: string;
}

export interface ParsedState {
  name: string;
  startCondition: string | null;
  timeMode: string | null;
  exit: boolean;
  child: string | null;
}

export interface ParsedTransition {
  from: string;
  to: string;
  condition: string | null;
  duration: string | null;
  postEval: boolean;
  blendFn: string | null;
  startTime: string | null;
}

export interface ParsedQueueItem {
  child: string | null;
  startExpr: string | null;
  interruptExpr: string | null;
  blendInTime: string | null;
  blendOutTime: string | null;
  enqueueMethod: string | null;
  tagMainPath: string | null;
}

export interface ParsedBoneItem {
  bone: string | null;
  op: string | null;
  axis: string | null;
  amount: string | null;
}

export interface ParsedIkBinding {
  ikTarget: string | null;
  ikChain: string | null;
}

export interface ParsedSwitchItem {
  child: string | null;
  nextProbabilities: string | null;
}

export interface ParsedSheet {
  name: string;
  nodes: ParsedNode[];
}

export interface ParsedAgf {
  sheets: ParsedSheet[];
}

export interface ParsedVariable {
  name: string;
  type: "Float" | "Int" | "Bool";
  min: string | null;
  max: string | null;
  defaultValue: string | null;
}

export interface ParsedCommand {
  name: string;
}

export interface ParsedIkChain {
  name: string;
  joints: string[];
  middleJoint: string | null;
  chainAxis: string | null;
}

export interface ParsedBoneMask {
  name: string;
  bones: string[];
}

export interface ParsedAgr {
  variables: ParsedVariable[];
  commands: ParsedCommand[];
  ikChains: ParsedIkChain[];
  boneMasks: ParsedBoneMask[];
  globalTags: string[];
  defaultRunNode: string | null;
  agfReferences: string[];
  astReference: string | null;
}

export interface ParsedAnimGroup {
  name: string;
  animationNames: string[];
  columnNames: string[];
}

export interface ParsedAst {
  groups: ParsedAnimGroup[];
}

export interface ParsedAsiMapping {
  group: string;
  column: string;
  animation: string;
  anmPath: string | null;
}

export interface ParsedAsi {
  mappings: ParsedAsiMapping[];
}

export interface ParsedAw {
  animGraph: string | null;
  animSetTemplate: string | null;
  animSetInstances: string[];
  previewModels: string[];
  childPreviewModels: Array<{ model: string; bone: string; enabled: boolean }>;
}

export interface ValidationIssue {
  id: string;
  severity: "error" | "warning";
  message: string;
}

export interface ValidationResult {
  issues: ValidationIssue[];
  errorCount: number;
  warningCount: number;
}

export interface Suggestion {
  category: string;
  title: string;
  description: string;
  snippet: string;
}
