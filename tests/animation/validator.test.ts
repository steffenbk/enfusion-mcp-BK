import { describe, it, expect } from "vitest";
import { validateGraph } from "../../src/animation/validator.js";
import type { ParsedAgf, ParsedAgr, ParsedAsi } from "../../src/animation/types.js";

function makeAgf(nodes: Array<Record<string, unknown>>): ParsedAgf {
  return {
    sheets: [{
      name: "Main",
      nodes: nodes.map(n => ({
        type: n.type as string,
        name: n.name as string,
        children: (n.children ?? []) as string[],
        properties: (n.properties ?? {}) as Record<string, unknown>,
        editorPos: { x: 0, y: 0 },
        raw: "",
      })),
    }],
  };
}

describe("V01: Integer Duration", () => {
  it("flags transition with integer duration", () => {
    const agf = makeAgf([{
      type: "AnimSrcNodeStateMachine", name: "SM", children: [],
      properties: {
        states: [{ name: "A", startCondition: "1", timeMode: "Normtime", exit: false, child: null }],
        transitions: [{ from: "A", to: "B", condition: "x", duration: "0", postEval: false, blendFn: null, startTime: null }],
      },
    }]);
    const result = validateGraph(agf);
    expect(result.issues.some(i => i.id === "V01")).toBe(true);
    expect(result.errorCount).toBeGreaterThanOrEqual(1);
  });

  it("passes with decimal duration", () => {
    const agf = makeAgf([{
      type: "AnimSrcNodeStateMachine", name: "SM", children: [],
      properties: {
        states: [],
        transitions: [{ from: "A", to: "B", condition: "x", duration: "0.3", postEval: false, blendFn: null, startTime: null }],
      },
    }]);
    const result = validateGraph(agf);
    expect(result.issues.some(i => i.id === "V01")).toBe(false);
  });
});

describe("V02: Missing PostEval", () => {
  it("flags condition using RemainingTimeLess without PostEval", () => {
    const agf = makeAgf([{
      type: "AnimSrcNodeStateMachine", name: "SM", children: [],
      properties: {
        states: [],
        transitions: [{ from: "A", to: "B", condition: "RemainingTimeLess(0.2)", duration: "0.3", postEval: false, blendFn: null, startTime: null }],
      },
    }]);
    const result = validateGraph(agf);
    expect(result.issues.some(i => i.id === "V02")).toBe(true);
  });

  it("passes when PostEval is enabled", () => {
    const agf = makeAgf([{
      type: "AnimSrcNodeStateMachine", name: "SM", children: [],
      properties: {
        states: [],
        transitions: [{ from: "A", to: "B", condition: "RemainingTimeLess(0.2)", duration: "0.3", postEval: true, blendFn: null, startTime: null }],
      },
    }]);
    const result = validateGraph(agf);
    expect(result.issues.some(i => i.id === "V02")).toBe(false);
  });
});

describe("V03: No catch-all state", () => {
  it("flags StateMachine without StartCondition '1' as last state", () => {
    const agf = makeAgf([{
      type: "AnimSrcNodeStateMachine", name: "SM", children: [],
      properties: {
        states: [
          { name: "A", startCondition: "Speed == 0", timeMode: "Normtime", exit: false, child: null },
          { name: "B", startCondition: "Speed > 0", timeMode: "Normtime", exit: false, child: null },
        ],
        transitions: [],
      },
    }]);
    const result = validateGraph(agf);
    expect(result.issues.some(i => i.id === "V03")).toBe(true);
  });
});

describe("V04: Duplicate node names", () => {
  it("flags duplicate names within a sheet", () => {
    const agf = makeAgf([
      { type: "AnimSrcNodeBindPose", name: "Dupe", children: [] },
      { type: "AnimSrcNodeSource", name: "Dupe", children: [] },
    ]);
    const result = validateGraph(agf);
    expect(result.issues.some(i => i.id === "V04")).toBe(true);
  });
});

describe("V05: Orphan nodes", () => {
  it("flags nodes not referenced by any parent", () => {
    const agf = makeAgf([
      { type: "AnimSrcNodeQueue", name: "Root", children: ["Child1"] },
      { type: "AnimSrcNodeBindPose", name: "Child1", children: [] },
      { type: "AnimSrcNodeBindPose", name: "Orphan", children: [] },
    ]);
    const result = validateGraph(agf);
    expect(result.issues.some(i => i.id === "V05" && i.message.includes("Orphan"))).toBe(true);
  });
});

describe("V06: DefaultRunNode mismatch", () => {
  it("flags when DefaultRunNode doesn't match any Queue", () => {
    const agf = makeAgf([{ type: "AnimSrcNodeQueue", name: "Root", children: [] }]);
    const agr: ParsedAgr = {
      variables: [], commands: [], ikChains: [], boneMasks: [],
      globalTags: [], defaultRunNode: "NonExistent", agfReferences: [], astReference: null,
    };
    const result = validateGraph(agf, agr);
    expect(result.issues.some(i => i.id === "V06")).toBe(true);
  });
});

describe("V07: AGF not registered", () => {
  it("flags when AGF path is not in GraphFilesResourceNames", () => {
    const agf = makeAgf([{ type: "AnimSrcNodeQueue", name: "Root", children: [] }]);
    const agr: ParsedAgr = {
      variables: [], commands: [], ikChains: [], boneMasks: [],
      globalTags: [], defaultRunNode: "Root", agfReferences: ["{GUID}other.agf"], astReference: null,
    };
    const result = validateGraph(agf, agr, undefined, "my_graph.agf");
    expect(result.issues.some(i => i.id === "V07")).toBe(true);
  });
});

describe("V08: 2-part Source format", () => {
  it("flags Source with only 2 dot-separated parts", () => {
    const agf = makeAgf([{
      type: "AnimSrcNodeSource", name: "Src", children: [],
      properties: { source: "Group.Anim" },
    }]);
    const result = validateGraph(agf);
    expect(result.issues.some(i => i.id === "V08")).toBe(true);
  });

  it("passes with 3-part format", () => {
    const agf = makeAgf([{
      type: "AnimSrcNodeSource", name: "Src", children: [],
      properties: { source: "Group.Col.Anim" },
    }]);
    const result = validateGraph(agf);
    expect(result.issues.some(i => i.id === "V08")).toBe(false);
  });
});

describe("V09: $Time in ProcTransform", () => {
  it("flags Amount expression containing $Time", () => {
    const agf = makeAgf([{
      type: "AnimSrcNodeProcTransform", name: "PT", children: ["BP"],
      properties: {
        expression: "1",
        boneItems: [{ bone: "root", op: "Rotate", axis: null, amount: "$Time * 2.0" }],
      },
    }]);
    const result = validateGraph(agf);
    expect(result.issues.some(i => i.id === "V09")).toBe(true);
  });
});

describe("V11: BlendN threshold order", () => {
  it("flags thresholds not in ascending order", () => {
    const agf = makeAgf([{
      type: "AnimSrcNodeBlendN", name: "BN", children: [],
      properties: { thresholds: ["10", "5", "20"] },
    }]);
    const result = validateGraph(agf);
    expect(result.issues.some(i => i.id === "V11")).toBe(true);
  });
});

describe("V12: State Time mode mismatch", () => {
  it("flags Notime state with non-StateMachine child", () => {
    const agf = makeAgf([
      {
        type: "AnimSrcNodeStateMachine", name: "SM", children: ["Src"],
        properties: {
          states: [{ name: "S1", startCondition: "1", timeMode: "Notime", exit: false, child: "Src" }],
          transitions: [],
        },
      },
      { type: "AnimSrcNodeSource", name: "Src", children: [] },
    ]);
    const result = validateGraph(agf);
    expect(result.issues.some(i => i.id === "V12")).toBe(true);
  });
});

describe("V13: Unmapped Source animation", () => {
  it("flags Source with no ASI mapping", () => {
    const agf = makeAgf([{
      type: "AnimSrcNodeSource", name: "Src", children: [],
      properties: { source: "Loco.Erc.Walk" },
    }]);
    const asi: ParsedAsi = { mappings: [] };
    const result = validateGraph(agf, undefined, asi);
    expect(result.issues.some(i => i.id === "V13")).toBe(true);
  });
});

describe("empty graph", () => {
  it("returns PASSED with zero issues", () => {
    const result = validateGraph({ sheets: [] });
    expect(result.errorCount).toBe(0);
    expect(result.warningCount).toBe(0);
  });
});
