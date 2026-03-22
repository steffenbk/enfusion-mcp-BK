import type {
  ParsedAgr, ParsedVariable, ParsedCommand, ParsedIkChain, ParsedBoneMask,
  ParsedAgf, ParsedSheet, ParsedNode,
  ParsedQueueItem, ParsedState, ParsedTransition, ParsedBoneItem,
  ParsedAst, ParsedAsi, ParsedAsiMapping, ParsedAnimGroup, ParsedAw,
} from "./types.js";

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

export function parseAgrToStruct(content: string): ParsedAgr {
  const varTypes: Array<{ typeName: string; label: "Float" | "Int" | "Bool" }> = [
    { typeName: "AnimSrcGCTVarFloat", label: "Float" },
    { typeName: "AnimSrcGCTVarInt", label: "Int" },
    { typeName: "AnimSrcGCTVarBool", label: "Bool" },
  ];

  const variables: ParsedVariable[] = [];
  for (const { typeName, label } of varTypes) {
    for (const { name, body } of extractBlocks(content, typeName)) {
      variables.push({
        name,
        type: label,
        min: extractProp(body, "MinValue") ?? extractProp(body, "Min"),
        max: extractProp(body, "MaxValue") ?? extractProp(body, "Max"),
        defaultValue: extractProp(body, "DefaultValue") ?? extractProp(body, "Default"),
      });
    }
  }

  const commands: ParsedCommand[] = extractBlocks(content, "AnimSrcGCTCmd").map(b => ({ name: b.name }));

  const ikChains: ParsedIkChain[] = extractBlocks(content, "AnimSrcGCTIkChain").map(({ name, body }) => ({
    name,
    joints: extractStringArray(body, "Joints"),
    middleJoint: extractProp(body, "MiddleJoint"),
    chainAxis: extractProp(body, "ChainAxis"),
  }));

  const boneMasks: ParsedBoneMask[] = extractBlocks(content, "AnimSrcGCTBoneMask").map(({ name, body }) => ({
    name,
    bones: extractStringArray(body, "BoneNames"),
  }));

  const globalTags = extractStringArray(content, "GlobalTags");
  const defaultRunNode = extractProp(content, "DefaultRunNode");
  const agfReferences = extractStringArray(content, "GraphFilesResourceNames");
  const astReference = extractProp(content, "AnimSetTemplate");

  return { variables, commands, ikChains, boneMasks, globalTags, defaultRunNode, agfReferences, astReference };
}

// --- AGF Parser ---

function findAllNodes(text: string): Array<{ type: string; name: string; body: string }> {
  const results: Array<{ type: string; name: string; body: string }> = [];
  const openRe = /^[ \t]*(AnimSrcNode\w+)[ \t]+"?([^"\s{][^{]*?)"?[ \t]*\{[ \t]*$/gm;
  let match: RegExpExecArray | null;
  while ((match = openRe.exec(text)) !== null) {
    const type = match[1];
    const name = match[2].trim().replace(/^"|"$/g, "");
    const openBrace = text.indexOf("{", match.index + match[0].indexOf("{"));
    let depth = 1;
    let i = openBrace + 1;
    while (i < text.length && depth > 0) {
      if (text[i] === "{") depth++;
      else if (text[i] === "}") depth--;
      i++;
    }
    const body = text.slice(openBrace + 1, i - 1);
    results.push({ type, name, body });
  }
  return results;
}

function parseQueueItems(body: string): ParsedQueueItem[] {
  // Queue items have no name — use a regex that matches the nameless block pattern
  const items: ParsedQueueItem[] = [];
  const re = /^[ \t]*AnimSrcNodeQueueItem[ \t]*\{[ \t]*$/gm;
  let match: RegExpExecArray | null;
  while ((match = re.exec(body)) !== null) {
    const openBrace = body.indexOf("{", match.index);
    let depth = 1;
    let i = openBrace + 1;
    while (i < body.length && depth > 0) {
      if (body[i] === "{") depth++;
      else if (body[i] === "}") depth--;
      i++;
    }
    const itemBody = body.slice(openBrace + 1, i - 1);
    items.push({
      child: extractProp(itemBody, "Child"),
      startExpr: extractProp(itemBody, "StartExpr"),
      interruptExpr: extractProp(itemBody, "InterruptExpr"),
      blendInTime: extractProp(itemBody, "BlendInTime"),
      blendOutTime: extractProp(itemBody, "BlendOutTime"),
      enqueueMethod: extractProp(itemBody, "EnqueueMethod"),
      tagMainPath: extractProp(itemBody, "TagMainPath"),
    });
  }
  return items;
}

function parseStates(body: string): ParsedState[] {
  return extractBlocks(body, "AnimSrcNodeState").map(({ name, body: stateBody }) => ({
    name,
    startCondition: extractProp(stateBody, "StartCondition"),
    timeMode: extractProp(stateBody, "Time"),
    exit: extractProp(stateBody, "Exit") === "1",
    child: extractProp(stateBody, "Child"),
  }));
}

function parseTransitions(body: string): ParsedTransition[] {
  const results: ParsedTransition[] = [];
  const re = /^[ \t]*AnimSrcNodeTransition[ \t]*\{[ \t]*$/gm;
  let match: RegExpExecArray | null;
  while ((match = re.exec(body)) !== null) {
    const openBrace = body.indexOf("{", match.index);
    let depth = 1;
    let i = openBrace + 1;
    while (i < body.length && depth > 0) {
      if (body[i] === "{") depth++;
      else if (body[i] === "}") depth--;
      i++;
    }
    const tBody = body.slice(openBrace + 1, i - 1);
    results.push({
      from: extractProp(tBody, "From") ?? "",
      to: extractProp(tBody, "To") ?? "",
      condition: extractProp(tBody, "Condition"),
      duration: extractProp(tBody, "Duration"),
      postEval: extractProp(tBody, "PostEval") === "1",
      blendFn: extractProp(tBody, "BlendFn"),
      startTime: extractProp(tBody, "StartTime"),
    });
  }
  return results;
}

function parseBoneItems(body: string): ParsedBoneItem[] {
  // Bone items use GUID-style names like "{A1B2}" that extractBlocks can't match
  const results: ParsedBoneItem[] = [];
  const re = /^[ \t]*AnimSrcNodeProcTrBoneItem[ \t]+.*\{[ \t]*$/gm;
  let match: RegExpExecArray | null;
  while ((match = re.exec(body)) !== null) {
    const openBrace = body.indexOf("{", match.index + match[0].lastIndexOf("{"));
    let depth = 1;
    let i = openBrace + 1;
    while (i < body.length && depth > 0) {
      if (body[i] === "{") depth++;
      else if (body[i] === "}") depth--;
      i++;
    }
    const bBody = body.slice(openBrace + 1, i - 1);
    results.push({
      bone: extractProp(bBody, "Bone"),
      op: extractProp(bBody, "Op"),
      axis: extractProp(bBody, "Axis"),
      amount: extractProp(bBody, "Amount"),
    });
  }
  return results;
}

function extractEditorPos(body: string): { x: number; y: number } | undefined {
  const m = body.match(/^[ \t]*EditorPos[ \t]+(-?\d+(?:\.\d+)?)[ \t]+(-?\d+(?:\.\d+)?)/m);
  if (!m) return undefined;
  return { x: parseFloat(m[1]), y: parseFloat(m[2]) };
}

function parseNodeProperties(type: string, body: string): { properties: Record<string, unknown>; children: string[] } {
  const children: string[] = [];
  const properties: Record<string, unknown> = {};

  // Generic child extraction for all node types
  const child = extractProp(body, "Child");
  if (child) children.push(child);

  switch (type) {
    case "AnimSrcNodeQueue": {
      const queueItems = parseQueueItems(body);
      properties.queueItems = queueItems;
      for (const item of queueItems) {
        if (item.child) children.push(item.child);
      }
      break;
    }
    case "AnimSrcNodeStateMachine": {
      const states = parseStates(body);
      const transitions = parseTransitions(body);
      properties.states = states;
      properties.transitions = transitions;
      for (const s of states) {
        if (s.child) children.push(s.child);
      }
      break;
    }
    case "AnimSrcNodeSource": {
      properties.source = extractProp(body, "Source");
      break;
    }
    case "AnimSrcNodeProcTransform": {
      properties.expression = extractProp(body, "Expression");
      const boneItems = parseBoneItems(body);
      properties.boneItems = boneItems;
      break;
    }
    case "AnimSrcNodeBlend": {
      const child0 = extractProp(body, "Child0");
      const child1 = extractProp(body, "Child1");
      if (child0) children.push(child0);
      if (child1) children.push(child1);
      properties.blendWeight = extractProp(body, "BlendWeight");
      const opt = extractProp(body, "Optimization");
      properties.optimization = opt === "1";
      break;
    }
    case "AnimSrcNodeBlendN": {
      properties.blendWeight = extractProp(body, "BlendWeight");
      properties.isCyclic = extractProp(body, "IsCyclic") === "1";
      const thresholds = extractProp(body, "Thresholds");
      if (thresholds) properties.thresholds = thresholds;
      // BlendN children are Child0..ChildN
      for (let ci = 0; ci < 32; ci++) {
        const c = extractProp(body, `Child${ci}`);
        if (c) children.push(c);
        else break;
      }
      break;
    }
    case "AnimSrcNodeBlendT":
    case "AnimSrcNodeBlendTAdd":
    case "AnimSrcNodeBlendTW": {
      const c0 = extractProp(body, "Child0");
      const c1 = extractProp(body, "Child1");
      if (c0) children.push(c0);
      if (c1) children.push(c1);
      properties.triggerOn = extractProp(body, "TriggerOn");
      properties.triggerOff = extractProp(body, "TriggerOff");
      properties.blendTime = extractProp(body, "BlendTime");
      properties.postEval = extractProp(body, "PostEval") === "1";
      break;
    }
    case "AnimSrcNodeIK2":
    case "AnimSrcNodeIK2Target":
    case "AnimSrcNodeIK2Plane":
    case "AnimSrcNodeIKLock":
    case "AnimSrcNodeIKRotation": {
      properties.weight = extractProp(body, "Weight");
      properties.solver = extractProp(body, "Solver");
      const chains = extractBlocks(body, "AnimSrcNodeIK2Chain").map(({ body: cBody }) => ({
        ikTarget: extractProp(cBody, "IkTarget"),
        ikChain: extractProp(cBody, "IkChain"),
      }));
      if (chains.length > 0) properties.chains = chains;
      break;
    }
    case "AnimSrcNodeSwitch": {
      properties.firstProbabilities = extractProp(body, "FirstProbabilities");
      const switchItems = extractBlocks(body, "AnimSrcNodeSwitchItem").map(({ body: sBody }) => ({
        child: extractProp(sBody, "Child"),
        nextProbabilities: extractProp(sBody, "NextProbabilities"),
      }));
      properties.switchItems = switchItems;
      for (const si of switchItems) {
        if (si.child) children.push(si.child);
      }
      break;
    }
    case "AnimSrcNodeFilter": {
      properties.boneMask = extractProp(body, "BoneMask");
      properties.condition = extractProp(body, "Condition");
      break;
    }
    case "AnimSrcNodeBufferSave": {
      properties.buffer = extractProp(body, "Buffer");
      break;
    }
    case "AnimSrcNodeBufferUse": {
      properties.buffer = extractProp(body, "Buffer");
      break;
    }
    case "AnimSrcNodeFunctionBegin":
    case "AnimSrcNodeFunctionEnd": {
      properties.method = extractProp(body, "Method");
      break;
    }
    case "AnimSrcNodeFunctionCall": {
      properties.method = extractProp(body, "Method");
      for (let ci = 0; ci < 8; ci++) {
        const c = extractProp(body, `Child${ci}`);
        if (c) children.push(c);
      }
      break;
    }
    case "AnimSrcNodeGroupSelect": {
      properties.group = extractProp(body, "Group");
      properties.column = extractProp(body, "Column");
      break;
    }
    default:
      // Generic: no specific property extraction beyond Child (already done above)
      break;
  }

  return { properties, children };
}

export function parseAgfToStruct(content: string): ParsedAgf {
  const sheets: ParsedSheet[] = [];

  for (const { name: sheetName, body: sheetBody } of extractBlocks(content, "AnimSrcGraphSheet")) {
    const nodes: ParsedNode[] = [];
    for (const { type, name, body } of findAllNodes(sheetBody)) {
      const editorPos = extractEditorPos(body);
      const { properties, children } = parseNodeProperties(type, body);
      nodes.push({ type, name, editorPos, children, properties, raw: body });
    }
    sheets.push({ name: sheetName, nodes });
  }

  return { sheets };
}

// --- AST Parser ---

export function parseAstToStruct(content: string): ParsedAst {
  const groups: ParsedAnimGroup[] = extractBlocks(content, "AnimSetTemplateSource_AnimationGroup")
    .map(({ name, body }) => ({
      name,
      animationNames: extractStringArray(body, "AnimationNames"),
      columnNames: extractStringArray(body, "ColumnNames"),
    }));
  return { groups };
}

// --- ASI Parser ---

export function parseAsiToStruct(content: string): ParsedAsi {
  const mappings: ParsedAsiMapping[] = [];
  const groups = extractBlocks(content, "AnimSetInstanceSource_AnimationGroup");

  for (const { name: groupName, body: groupBody } of groups) {
    const animNames = extractStringArray(groupBody, "AnimationNames");
    const columns = extractBlocks(groupBody, "AnimSetInstanceColumn");

    for (const { name: colName, body: colBody } of columns) {
      const animPaths = extractStringArray(colBody, "Animations");

      for (let i = 0; i < animNames.length; i++) {
        const rawPath = i < animPaths.length ? animPaths[i] : "";
        const anmPath = rawPath === "" ? null : rawPath.replace(/^\{[^}]*\}/, "");
        mappings.push({
          group: groupName,
          column: colName,
          animation: animNames[i],
          anmPath,
        });
      }
    }
  }

  return { mappings };
}

// --- AW Parser ---

export function parseAwToStruct(content: string): ParsedAw {
  const animGraph = extractProp(content, "AnimGraph");
  const animSetTemplate = extractProp(content, "AnimSetTemplate");
  const animSetInstances = extractStringArray(content, "AnimSetInstances");

  const previewModels: string[] = [];
  for (const { body } of extractBlocks(content, "AnimSrcWorkspacePreviewModel")) {
    const model = extractProp(body, "Model");
    if (model) previewModels.push(model);
  }

  const childPreviewModels: Array<{ model: string; bone: string; enabled: boolean }> = [];
  for (const { body } of extractBlocks(content, "AnimSrcWorkspaceChildPreviewModel")) {
    childPreviewModels.push({
      model: extractProp(body, "Model") ?? "(unknown)",
      bone: extractProp(body, "Bone") ?? "(no bone)",
      enabled: extractProp(body, "Enabled") !== "0",
    });
  }

  return { animGraph, animSetTemplate, animSetInstances, previewModels, childPreviewModels };
}
