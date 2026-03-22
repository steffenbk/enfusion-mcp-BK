import type { ParsedAgf, ParsedAgr, ParsedAsi, ValidationResult, ValidationIssue } from "./types.js";

const POST_EVAL_FUNCTIONS = [
  "RemainingTimeLess", "IsEvent", "IsTag", "GetLowerTime",
  "LowerNTimePassed", "GetRemainingTime", "GetEventTime", "GetLowerRTime",
];

export function validateGraph(
  agf: ParsedAgf,
  agr?: ParsedAgr,
  asi?: ParsedAsi,
  agfPath?: string,
): ValidationResult {
  const issues: ValidationIssue[] = [];

  for (const sheet of agf.sheets) {
    // V04: Duplicate node names
    const namesSeen = new Set<string>();
    for (const node of sheet.nodes) {
      if (namesSeen.has(node.name)) {
        issues.push({ id: "V04", severity: "error", message: `Duplicate node name "${node.name}" in sheet "${sheet.name}"` });
      }
      namesSeen.add(node.name);
    }

    // V05: Orphan nodes
    const allChildRefs = new Set<string>();
    for (const node of sheet.nodes) {
      for (const child of node.children) allChildRefs.add(child);
    }
    for (const node of sheet.nodes) {
      const isRootLike = node.type === "AnimSrcNodeQueue"
        || node.type === "AnimSrcNodeFunctionBegin"
        || sheet.nodes.indexOf(node) === 0;
      if (!allChildRefs.has(node.name) && !isRootLike) {
        issues.push({ id: "V05", severity: "warning", message: `Orphan node "${node.name}" is not referenced by any parent node` });
      }
    }

    for (const node of sheet.nodes) {
      // StateMachine checks
      if (node.type === "AnimSrcNodeStateMachine") {
        const states = (node.properties.states ?? []) as Array<Record<string, unknown>>;
        const transitions = (node.properties.transitions ?? []) as Array<Record<string, unknown>>;

        // V03: No catch-all state
        if (states.length > 0) {
          const lastState = states[states.length - 1];
          if (lastState.startCondition !== "1") {
            issues.push({ id: "V03", severity: "warning", message: `StateMachine "${node.name}": no catch-all state (StartCondition "1")` });
          }
        }

        for (const t of transitions) {
          // V01: Integer Duration
          const dur = t.duration as string | null;
          if (dur !== null && dur !== undefined && /^\d+$/.test(dur)) {
            issues.push({ id: "V01", severity: "error", message: `Transition "${t.from} -> ${t.to}": Duration is integer (${dur}) -- must be decimal (${dur}.0)` });
          }

          // V02: Missing PostEval
          const cond = (t.condition as string) ?? "";
          if (!t.postEval && POST_EVAL_FUNCTIONS.some(fn => cond.includes(fn))) {
            const fn = POST_EVAL_FUNCTIONS.find(fn => cond.includes(fn));
            issues.push({ id: "V02", severity: "warning", message: `Transition "${t.from} -> ${t.to}": condition uses ${fn}() but PostEval is not enabled` });
          }
        }

        // V12: State Time mode mismatch
        for (const state of states) {
          const childName = state.child as string | null;
          if (childName && state.timeMode) {
            const childNode = sheet.nodes.find(n => n.name === childName);
            if (childNode) {
              const childIsSM = childNode.type === "AnimSrcNodeStateMachine";
              if (state.timeMode === "Notime" && !childIsSM) {
                issues.push({ id: "V12", severity: "warning", message: `State "${state.name}" in "${node.name}": Notime but child "${childName}" is not a StateMachine` });
              }
              if (state.timeMode !== "Notime" && childIsSM) {
                issues.push({ id: "V12", severity: "warning", message: `State "${state.name}" in "${node.name}": nested StateMachine "${childName}" should use Notime on parent state` });
              }
            }
          }
        }
      }

      // V08: 2-part Source format
      if (node.type === "AnimSrcNodeSource") {
        const src = node.properties.source as string | undefined;
        if (src) {
          const parts = src.split(".");
          if (parts.length === 2) {
            issues.push({ id: "V08", severity: "error", message: `Source "${node.name}": uses 2-part format "${src}" -- needs 3-part "Group.Column.Anim"` });
          }
        }
      }

      // V09: $Time in ProcTransform
      if (node.type === "AnimSrcNodeProcTransform") {
        const boneItems = (node.properties.boneItems ?? []) as Array<Record<string, unknown>>;
        for (const bi of boneItems) {
          const amount = (bi.amount as string) ?? "";
          if (amount.includes("$Time")) {
            issues.push({ id: "V09", severity: "error", message: `ProcTransform "${node.name}": Amount uses $Time -- should be GetUpperRTime()` });
          }
        }
      }

      // V11: BlendN threshold order
      if (node.type === "AnimSrcNodeBlendN") {
        const thresholds = (node.properties.thresholds ?? []) as string[];
        const nums = thresholds.map(Number);
        for (let i = 1; i < nums.length; i++) {
          if (nums[i] < nums[i - 1]) {
            issues.push({ id: "V11", severity: "error", message: `BlendN "${node.name}": thresholds not in ascending order` });
            break;
          }
        }
      }
    }
  }

  // Cross-reference checks (require AGR)
  if (agr) {
    // V06: DefaultRunNode mismatch
    if (agr.defaultRunNode) {
      const allQueueNames = agf.sheets.flatMap(s => s.nodes.filter(n => n.type === "AnimSrcNodeQueue").map(n => n.name));
      if (!allQueueNames.includes(agr.defaultRunNode)) {
        issues.push({ id: "V06", severity: "error", message: `DefaultRunNode "${agr.defaultRunNode}" does not match any Queue node in the AGF` });
      }
    }

    // V07: AGF not registered in AGR
    if (agfPath) {
      const registered = agr.agfReferences.some(ref => ref.includes(agfPath));
      if (!registered) {
        issues.push({ id: "V07", severity: "error", message: `AGF "${agfPath}" is not listed in AGR GraphFilesResourceNames` });
      }
    }

    // V10: IK chain mismatch
    const agrChainNames = new Set(agr.ikChains.map(c => c.name));
    for (const sheet of agf.sheets) {
      for (const node of sheet.nodes) {
        if (node.type === "AnimSrcNodeIK2") {
          const chains = (node.properties.chains ?? []) as Array<Record<string, unknown>>;
          for (const chain of chains) {
            const chainName = chain.ikChain as string;
            if (chainName && !agrChainNames.has(chainName)) {
              issues.push({ id: "V10", severity: "warning", message: `IK2 "${node.name}": references chain "${chainName}" not defined in AGR` });
            }
          }
        }
      }
    }
  }

  // V13: Unmapped Source animation (requires ASI)
  if (asi) {
    for (const sheet of agf.sheets) {
      for (const node of sheet.nodes) {
        if (node.type === "AnimSrcNodeSource") {
          const src = node.properties.source as string | undefined;
          if (src && src.split(".").length === 3) {
            const [group, column, anim] = src.split(".");
            const mapping = asi.mappings.find(
              m => m.group === group && m.column === column && m.animation === anim
            );
            if (!mapping || mapping.anmPath === null) {
              issues.push({ id: "V13", severity: "warning", message: `Source "${node.name}": animation "${src}" has no mapping in ASI` });
            }
          }
        }
      }
    }
  }

  const errorCount = issues.filter(i => i.severity === "error").length;
  const warningCount = issues.filter(i => i.severity === "warning").length;

  return { issues, errorCount, warningCount };
}
