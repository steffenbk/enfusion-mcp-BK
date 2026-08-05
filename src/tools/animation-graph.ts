import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { dirname, join, extname } from "node:path";
import type { Config } from "../config.js";
import { validateProjectPath } from "../utils/safe-path.js";
import { PakVirtualFS } from "../pak/vfs.js";
import {
  parseAgrToStruct, parseAgfToStruct, parseAstToStruct,
  parseAsiToStruct, parseAwToStruct,
} from "../animation/parser.js";
import {
  formatAgrSummary, formatAgfTree, formatAstSummary,
  formatAsiSummary, formatAwSummary, formatValidationReport,
} from "../animation/formatter.js";
import { generateSuggestions, formatSuggestions } from "../animation/suggestions.js";
import { generateGuide } from "../animation/guides.js";

// ── Shared interface ──────────────────────────────────────────────────────────

interface VehicleConfig {
  vehicleName: string;
  vehicleType: string;
  wheelCount: number;
  hasTurret: boolean;
  hasSuspensionIK: boolean;
  hasShockAbsorbers: boolean;
  hasSteeringLinkage: boolean;
  seatTypes: string[];
  dialList: string[];
}

// ── Author helpers (from animation-graph-author.ts) ───────────────────────────

function generateAgrAuthor(cfg: VehicleConfig): string {
  const lines: string[] = [];

  lines.push("AnimSrcGraph {");
  lines.push(
    ` AnimSetTemplate "{PLACEHOLDER_GUID}${cfg.vehicleType}/${cfg.vehicleName}/workspaces/${cfg.vehicleName}.ast"`
  );
  lines.push(` ControlTemplate AnimSrcGCT "{PLACEHOLDER_GUID_2}" {`);

  // Variables
  lines.push(`  Variables {`);

  // Standard vehicle variables — order follows LAV25 pattern
  lines.push(`   AnimSrcGCTVarFloat VehicleSteering {`);
  lines.push(`    MinValue -1`);
  lines.push(`    MaxValue 1`);
  lines.push(`   }`);

  lines.push(`   AnimSrcGCTVarFloat VehicleThrottle {`);
  lines.push(`    MaxValue 1`);
  lines.push(`   }`);

  lines.push(`   AnimSrcGCTVarFloat VehicleClutch {`);
  lines.push(`    MaxValue 1`);
  lines.push(`   }`);

  lines.push(`   AnimSrcGCTVarFloat VehicleBrake {`);
  lines.push(`    MaxValue 1`);
  lines.push(`   }`);

  lines.push(`   AnimSrcGCTVarFloat VehicleAccelerationLR {`);
  lines.push(`    MinValue -1`);
  lines.push(`    MaxValue 1`);
  lines.push(`   }`);

  lines.push(`   AnimSrcGCTVarFloat VehicleAccelerationFB {`);
  lines.push(`    MinValue -1`);
  lines.push(`    MaxValue 1`);
  lines.push(`   }`);

  lines.push(`   AnimSrcGCTVarFloat LookX {`);
  lines.push(`    MinValue -180`);
  lines.push(`    MaxValue 180`);
  lines.push(`   }`);

  lines.push(`   AnimSrcGCTVarFloat LookY {`);
  lines.push(`    MinValue -180`);
  lines.push(`    MaxValue 180`);
  lines.push(`   }`);

  lines.push(`   AnimSrcGCTVarInt SeatPositionType {`);
  lines.push(`    MaxValue 10`);
  lines.push(`   }`);

  lines.push(`   AnimSrcGCTVarFloat AimY {`);
  lines.push(`    MinValue -100`);
  lines.push(`    MaxValue 100`);
  lines.push(`   }`);

  lines.push(`   AnimSrcGCTVarBool Horn {`);
  lines.push(`   }`);

  lines.push(`   AnimSrcGCTVarFloat VehicleHandBrake {`);
  lines.push(`    MaxValue 2`);
  lines.push(`   }`);

  lines.push(`   AnimSrcGCTVarBool IsDriver {`);
  lines.push(`   }`);

  lines.push(`   AnimSrcGCTVarFloat SpineAccelerationFB {`);
  lines.push(`    MinValue -1`);
  lines.push(`    MaxValue 1`);
  lines.push(`   }`);

  lines.push(`   AnimSrcGCTVarFloat Vehicle_Wobble {`);
  lines.push(`    MaxValue 1`);
  lines.push(`   }`);

  lines.push(`   AnimSrcGCTVarFloat SpineAccelerationLR {`);
  lines.push(`    MinValue -1`);
  lines.push(`    MaxValue 1`);
  lines.push(`   }`);

  lines.push(`   AnimSrcGCTVarFloat AimX {`);
  lines.push(`    MinValue -100`);
  lines.push(`    MaxValue 100`);
  lines.push(`   }`);

  // Suspension variables (always included, count matches wheelCount)
  for (let i = 0; i < cfg.wheelCount; i++) {
    lines.push(`   AnimSrcGCTVarFloat suspension_${i} {`);
    lines.push(`    MinValue -1`);
    lines.push(`    MaxValue 1`);
    lines.push(`   }`);
  }

  lines.push(`   AnimSrcGCTVarFloat Suspension_dumping {`);
  lines.push(`    MinValue -1`);
  lines.push(`    MaxValue 1`);
  lines.push(`   }`);

  lines.push(`   AnimSrcGCTVarFloat Suspension_shake {`);
  lines.push(`    MaxValue 1`);
  lines.push(`   }`);

  lines.push(`   AnimSrcGCTVarFloat YawAngle {`);
  lines.push(`    MinValue -360`);
  lines.push(`    MaxValue 360`);
  lines.push(`   }`);

  // Wheel rotation variables
  for (let i = 0; i < cfg.wheelCount; i++) {
    lines.push(`   AnimSrcGCTVarFloat wheel_${i} {`);
    lines.push(`    MinValue -360`);
    lines.push(`    MaxValue 360`);
    lines.push(`   }`);
  }

  lines.push(`   AnimSrcGCTVarFloat steering {`);
  lines.push(`    MinValue -50`);
  lines.push(`    MaxValue 50`);
  lines.push(`   }`);

  lines.push(`   AnimSrcGCTVarFloat Gearbox_RPM {`);
  lines.push(`    MinValue -10000`);
  lines.push(`    MaxValue 10000`);
  lines.push(`   }`);

  lines.push(`   AnimSrcGCTVarFloat Engine_RPM {`);
  lines.push(`    MaxValue 10000`);
  lines.push(`   }`);

  lines.push(`   AnimSrcGCTVarFloat WaterLevel {`);
  lines.push(`    MaxValue 100`);
  lines.push(`   }`);

  lines.push(`   AnimSrcGCTVarFloat IsSwimming {`);
  lines.push(`    MaxValue 1`);
  lines.push(`   }`);

  lines.push(`   AnimSrcGCTVarFloat IsInVehicle {`);
  lines.push(`    MaxValue 1`);
  lines.push(`   }`);

  lines.push(`   AnimSrcGCTVarFloat SPEED {`);
  lines.push(`    MinValue 0`);
  lines.push(`    MaxValue 250`);
  lines.push(`   }`);

  lines.push(`   AnimSrcGCTVarFloat Speed_dumping {`);
  lines.push(`    MaxValue 250`);
  lines.push(`   }`);

  lines.push(`   AnimSrcGCTVarFloat POWER_IO {`);
  lines.push(`    DefaultValue 1`);
  lines.push(`    MaxValue 1`);
  lines.push(`   }`);

  lines.push(`   AnimSrcGCTVarFloat LocalTime {`);
  lines.push(`    DefaultValue 100000000`);
  lines.push(`    MaxValue 100000000`);
  lines.push(`   }`);

  lines.push(`   AnimSrcGCTVarBool TurnOut {`);
  lines.push(`   }`);

  lines.push(`   AnimSrcGCTVarFloat Yaw {`);
  lines.push(`    MinValue -180`);
  lines.push(`    MaxValue 180`);
  lines.push(`   }`);

  lines.push(`   AnimSrcGCTVarFloat Pitch {`);
  lines.push(`    MinValue -50`);
  lines.push(`    MaxValue 80`);
  lines.push(`   }`);

  lines.push(`   AnimSrcGCTVarInt VehicleDoorState {`);
  lines.push(`    MaxValue 298754968`);
  lines.push(`   }`);

  lines.push(`   AnimSrcGCTVarInt VehicleDoorType {`);
  lines.push(`    MaxValue 298754968`);
  lines.push(`   }`);

  if (cfg.hasTurret) {
    lines.push(`   AnimSrcGCTVarFloat TurretRot_Antennas {`);
    lines.push(`    DefaultValue 0`);
    lines.push(`    MinValue -1`);
    lines.push(`    MaxValue 1`);
    lines.push(`   }`);
  }

  if (cfg.seatTypes.includes("gunner")) {
    lines.push(`   AnimSrcGCTVarFloat Gunner_sights_cover {`);
    lines.push(`    DefaultValue -0.71`);
    lines.push(`    MinValue -0.71`);
    lines.push(`    MaxValue 1.4`);
    lines.push(`   }`);
  }

  lines.push(`  }`);

  // Commands
  lines.push(`  Commands {`);
  lines.push(`   AnimSrcGCTCmd CMD_Vehicle_SwitchSeat {`);
  lines.push(`   }`);
  lines.push(`   AnimSrcGCTCmd CMD_Unconscious {`);
  lines.push(`   }`);
  lines.push(`   AnimSrcGCTCmd CMD_Unconscious_Exit {`);
  lines.push(`   }`);
  lines.push(`   AnimSrcGCTCmd CMD_Death {`);
  lines.push(`   }`);
  lines.push(`   AnimSrcGCTCmd CMD_OpenDoor {`);
  lines.push(`   }`);
  lines.push(`   AnimSrcGCTCmd CMD_Wheeled_Action {`);
  lines.push(`   }`);
  lines.push(`   AnimSrcGCTCmd CMD_Lights {`);
  lines.push(`   }`);
  lines.push(`   AnimSrcGCTCmd CMD_Vehicle_GetIn {`);
  lines.push(`   }`);
  lines.push(`   AnimSrcGCTCmd CMD_Vehicle_GetOut {`);
  lines.push(`   }`);
  lines.push(`   AnimSrcGCTCmd CMD_Vehicle_GearSwitch {`);
  lines.push(`   }`);
  lines.push(`   AnimSrcGCTCmd CMD_Vehicle_Engine_StartStop {`);
  lines.push(`   }`);
  lines.push(`   AnimSrcGCTCmd CMD_HandBrake {`);
  lines.push(`   }`);
  lines.push(`   AnimSrcGCTCmd CMD_Vehicle_OpenDoor {`);
  lines.push(`   }`);
  lines.push(`   AnimSrcGCTCmd CMD_Vehicle_CloseDoor {`);
  lines.push(`   }`);
  lines.push(`   AnimSrcGCTCmd CMD_Vehicle_FinishActionQueue {`);
  lines.push(`   }`);
  lines.push(`  }`);

  // IK Chains
  lines.push(`  IkChains {`);

  // Standard character limb chains
  lines.push(`   AnimSrcGCTIkChain LeftLeg {`);
  lines.push(`    Joints {`);
  lines.push(`     "leftleg"`);
  lines.push(`     "leftlegtwist"`);
  lines.push(`     "leftknee"`);
  lines.push(`     "leftkneetwist"`);
  lines.push(`     "leftfoot"`);
  lines.push(`    }`);
  lines.push(`    MiddleJoint "leftknee"`);
  lines.push(`    ChainAxis "+y"`);
  lines.push(`   }`);

  lines.push(`   AnimSrcGCTIkChain RightLeg {`);
  lines.push(`    Joints {`);
  lines.push(`     "rightleg"`);
  lines.push(`     "rightlegtwist"`);
  lines.push(`     "rightknee"`);
  lines.push(`     "rightkneetwist"`);
  lines.push(`     "rightfoot"`);
  lines.push(`    }`);
  lines.push(`    MiddleJoint "rightknee"`);
  lines.push(`    ChainAxis "-y"`);
  lines.push(`   }`);

  lines.push(`   AnimSrcGCTIkChain LeftArm {`);
  lines.push(`    Joints {`);
  lines.push(`     "leftarm"`);
  lines.push(`     "leftarmtwist"`);
  lines.push(`     "leftforearm"`);
  lines.push(`     "leftforearmtwist"`);
  lines.push(`     "lefthand"`);
  lines.push(`    }`);
  lines.push(`    MiddleJoint "leftforearm"`);
  lines.push(`    ChainAxis "+y"`);
  lines.push(`   }`);

  lines.push(`   AnimSrcGCTIkChain RightArm {`);
  lines.push(`    Joints {`);
  lines.push(`     "rightarm"`);
  lines.push(`     "rightarmtwist"`);
  lines.push(`     "rightforearm"`);
  lines.push(`     "rightforearmtwist"`);
  lines.push(`     "righthand"`);
  lines.push(`    }`);
  lines.push(`    MiddleJoint "rightforearm"`);
  lines.push(`    ChainAxis "-y"`);
  lines.push(`   }`);

  // Suspension IK chains
  if (cfg.hasSuspensionIK) {
    for (let i = 0; i < cfg.wheelCount; i++) {
      lines.push(`   AnimSrcGCTIkChain suspension${i} {`);
      lines.push(`    Joints {`);
      lines.push(`     "v_suspension${i}"`);
      lines.push(`    }`);
      lines.push(`   }`);
    }
  }

  // Shock absorber chains — rear wheels (indices >= wheelCount/2)
  if (cfg.hasShockAbsorbers) {
    const rearStart = Math.floor(cfg.wheelCount / 2);
    for (let i = rearStart; i < cfg.wheelCount; i++) {
      lines.push(`   AnimSrcGCTIkChain shock_absorber${i} {`);
      lines.push(`    Joints {`);
      lines.push(`     "v_shock_absorber${i}"`);
      lines.push(`    }`);
      lines.push(`   }`);
      lines.push(`   AnimSrcGCTIkChain shock_absorber_ikTarget${i} {`);
      lines.push(`    Joints {`);
      lines.push(`     "v_shock_absorber_ikTarget${i}"`);
      lines.push(`    }`);
      lines.push(`   }`);
    }
  }

  // Steering linkage chains — front wheels (first half)
  if (cfg.hasSteeringLinkage) {
    const frontCount = Math.floor(cfg.wheelCount / 2);
    for (let i = 0; i < frontCount; i++) {
      lines.push(`   AnimSrcGCTIkChain steering_axis_suspension${i} {`);
      lines.push(`    Joints {`);
      lines.push(`     "v_steering_axis_suspension${i}"`);
      lines.push(`    }`);
      lines.push(`   }`);
      lines.push(`   AnimSrcGCTIkChain steering_axis_body${i} {`);
      lines.push(`    Joints {`);
      lines.push(`     "v_steering_axis_body${i}"`);
      lines.push(`    }`);
      lines.push(`   }`);
    }
  }

  lines.push(`  }`);

  // Bone Masks
  lines.push(`  BoneMasks {`);

  // Chassis mask — wheel bones + suspension bones
  lines.push(`   AnimSrcGCTBoneMask Chassis {`);
  lines.push(`    Bones {`);

  // Generate wheel bones: L01, R01, L02, R02, etc. (pairs per axle)
  const axleCount = cfg.wheelCount / 2;
  for (let axle = 1; axle <= axleCount; axle++) {
    const axleStr = String(axle).padStart(2, "0");
    lines.push(`     "v_wheel_L${axleStr}"`);
    lines.push(`     "v_wheel_R${axleStr}"`);
  }

  // Suspension bones if IK enabled
  if (cfg.hasSuspensionIK) {
    for (let i = 0; i < cfg.wheelCount; i++) {
      lines.push(`     "v_suspension${i}"`);
    }
  }

  lines.push(`    }`);
  lines.push(`   }`);

  // Body mask — empty, user fills in
  lines.push(`   AnimSrcGCTBoneMask Body {`);
  lines.push(`    Bones {`);
  lines.push(`    }`);
  lines.push(`   }`);

  // Turret masks
  if (cfg.hasTurret) {
    lines.push(`   AnimSrcGCTBoneMask Turret {`);
    lines.push(`    Bones {`);
    lines.push(`    }`);
    lines.push(`   }`);
    lines.push(`   AnimSrcGCTBoneMask Turret_Pose {`);
    lines.push(`    Bones {`);
    lines.push(`     "v_root"`);
    lines.push(`     "v_turret_slot"`);
    lines.push(`     "v_turret_01"`);
    lines.push(`    }`);
    lines.push(`   }`);
  }

  lines.push(`  }`);

  // Global Tags
  lines.push(`  GlobalTags {`);
  lines.push(`   "VEHICLE"`);
  lines.push(`   "WHEELED"`);
  lines.push(`   "${cfg.vehicleName.toUpperCase()}"`);
  lines.push(`  }`);

  lines.push(` }`);
  lines.push(` Debug AnimSrcGD "{PLACEHOLDER_GUID_3}" {`);
  lines.push(` }`);
  lines.push(` GraphFilesResourceNames {`);
  lines.push(` }`);
  lines.push(` DefaultRunNode "MasterControl"`);
  lines.push(`}`);

  return lines.join("\n");
}

function generateAstAuthor(cfg: VehicleConfig): string {
  const seatGroupMap: Record<string, string> = {
    driver: "Driver",
    gunner: "Gunner",
    commander: "Commander",
    passenger: "Passenger",
  };

  const animsByGroup: Record<string, string[]> = {
    Driver: ["Idle", "Drive", "GetIn", "GetOut", "Death"],
    Gunner: ["Idle", "Aim", "GetIn", "GetOut", "Death"],
    Commander: ["Idle", "GetIn", "GetOut", "Death"],
    Passenger: ["Idle", "GetIn", "GetOut", "Death"],
  };

  const lines: string[] = [];
  lines.push("AnimSetTemplateSource {");
  lines.push(" Groups {");

  for (const seatType of cfg.seatTypes) {
    const groupName = seatGroupMap[seatType] ?? seatType;
    const anims = animsByGroup[groupName] ?? ["Idle", "GetIn", "GetOut", "Death"];

    lines.push(`  AnimSetTemplateSource_AnimationGroup "{PLACEHOLDER_GUID}" {`);
    lines.push(`   Name "${groupName}"`);
    lines.push(`   Animations {`);
    for (const anim of anims) {
      lines.push(`    "${anim}"`);
    }
    lines.push(`   }`);
    lines.push(`   Columns {`);
    lines.push(`    "Default"`);
    lines.push(`   }`);
    lines.push(`  }`);
  }

  lines.push(" }");
  lines.push("}");

  return lines.join("\n");
}

// ── Inspect helper (from animation-graph-inspect.ts) ─────────────────────────

function readFileForTool(
  filePath: string,
  source: "mod" | "game",
  projectPath: string | undefined,
  config: Config,
): string | null {
  try {
    if (source === "mod") {
      const basePath = projectPath || config.projectPath;
      if (!basePath) return null;
      const fullPath = validateProjectPath(basePath, filePath);
      if (!existsSync(fullPath)) return null;
      return readFileSync(fullPath, "utf-8");
    } else {
      const dataPath = join(config.gamePath, "addons", "data");
      const loosePath = validateProjectPath(dataPath, filePath);
      if (existsSync(loosePath)) {
        return readFileSync(loosePath, "utf-8");
      }
      const pakVfs = PakVirtualFS.get(config.gamePath);
      if (pakVfs && pakVfs.exists(filePath)) {
        return pakVfs.readFile(filePath).toString("utf-8");
      }
      return null;
    }
  } catch {
    return null;
  }
}

// ── Instruction generators (from animation-graph-setup.ts) ───────────────────

function generateAgfInstructions(cfg: VehicleConfig): string {
  const parts: string[] = [];

  parts.push(`## AGF Node Graph — Workbench UI Instructions`);
  parts.push(``);
  parts.push(`These nodes must be added via the Animation Editor UI in Workbench.`);
  parts.push(`Do NOT edit the .agf file directly — Workbench re-serializes it on open.`);
  parts.push(``);
  parts.push(`### 1. Start from a Base Game Workspace (Recommended)`);
  parts.push(`The fastest way to build the AGF is to duplicate an existing vehicle workspace:`);
  parts.push(`- In Workbench Asset Browser, find a similar base game .aw file`);
  parts.push(`  (e.g. Assets/Vehicles/Wheeled/S105/workspace/S105.aw for a 4-wheel vehicle)`);
  parts.push(`  (e.g. Assets/Vehicles/Wheeled/LAV25/workspaces/LAV25.aw for an 8-wheel vehicle)`);
  parts.push(`- Double-click the .aw file to open it in the Animation Editor`);
  parts.push(`- In the Animation Editor: Edit menu -> Duplicate Project`);
  parts.push(`- Choose your mod output folder — Workbench copies ALL files (AGR, AGF, AST, ASI, AW)`);
  parts.push(`  with new GUIDs assigned automatically`);
  parts.push(`- Rename the files to match your vehicle name`);
  parts.push(`- Edit the duplicated AGR (variables, IK chains, bone masks) to match your vehicle`);
  parts.push(`- Edit the node graph in the Animation Editor using the steps below`);
  parts.push(``);
  parts.push(`Alternative: If building from scratch without a base to duplicate:`);
  parts.push(`- Open the generated ${cfg.vehicleName}.agr in the Animation Editor`);
  parts.push(`- Go to Edit -> New Graph File, save as ${cfg.vehicleName}.agf in the same folder`);
  parts.push(`- The AGF will appear in GraphFilesResourceNames automatically`);
  parts.push(``);
  parts.push(`### 2. Create the Master Sheet`);
  parts.push(`- In the Animation Editor, you should see a default sheet`);
  parts.push(`- Rename it to "Master" (right-click the sheet tab)`);
  parts.push(``);
  parts.push(`### 3. Add the Master Queue Node`);
  parts.push(`- Right-click canvas -> Add Node -> Queue`);
  parts.push(`- Name it: MasterControl`);
  parts.push(`- This is your DefaultRunNode (must match AGR setting)`);
  parts.push(`- Set BlendInTime: 0, BlendOutTime: 0`);
  parts.push(``);
  parts.push(`### 4. Add Sleep Optimization Node`);
  parts.push(`- Right-click -> Add Node -> Sleep`);
  parts.push(`- Name it: MasterSleep`);
  parts.push(`- AwakeExpr: IsInVehicle`);
  parts.push(`- Timeout: 2`);
  parts.push(`- Connect MasterQueue.Child -> MasterSleep`);
  parts.push(``);
  parts.push(`### 5. Chassis Branch — Wheel Rotation`);
  parts.push(`Add one AnimSrcNodeProcTransform per wheel:`);

  const axleCount = Math.floor(cfg.wheelCount / 2);
  let wheelIndex = 0;
  for (let axle = 1; axle <= axleCount; axle++) {
    const axleStr = String(axle).padStart(2, "0");
    const leftIdx = wheelIndex;
    const rightIdx = wheelIndex + 1;
    parts.push(`- Right-click -> Add Node -> Procedural (AnimSrcNodeProcTransform)`);
    parts.push(`  Name: WheelLeft${axle}Rot`);
    parts.push(`  Bone: v_wheel_L${axleStr}`);
    parts.push(`  Op: Rotate, Space: Local`);
    parts.push(`  Amount: wheel_${leftIdx}`);
    parts.push(`- Right-click -> Add Node -> Procedural (AnimSrcNodeProcTransform)`);
    parts.push(`  Name: WheelRight${axle}Rot`);
    parts.push(`  Bone: v_wheel_R${axleStr}`);
    parts.push(`  Op: Rotate, Space: Local`);
    parts.push(`  Amount: wheel_${rightIdx}`);
    wheelIndex += 2;
  }
  parts.push(`Note: If wheels spin backwards, negate the amount expression (e.g. -wheel_0).`);

  if (cfg.hasSuspensionIK) {
    parts.push(``);
    parts.push(`### 6. Suspension IK`);
    parts.push(`For each wheel add a paired IK2Target + IK2 node:`);
    for (let i = 0; i < cfg.wheelCount; i++) {
      parts.push(`- Add Node -> IK2Target, name: SuspensionTarget${i}`);
      parts.push(`  Variable driving target position: suspension_${i}`);
      parts.push(`- Add Node -> IK2, name: SuspensionIK${i}`);
      parts.push(`  IK2.Child -> (source pose node)`);
      parts.push(`  IK2.Chains -> IkChain: suspension${i}`);
      parts.push(`  Set solver: TwoBoneSolver`);
    }
    parts.push(`Bone names in IK chains must use v_suspension${0}..${cfg.wheelCount - 1} (v_ prefix mandatory).`);
  }

  if (cfg.hasSteeringLinkage) {
    parts.push(``);
    parts.push(`### 7. Steering Linkage`);
    parts.push(`- Add Node -> Procedural`);
    parts.push(`  Bone: v_steering_axis_body0, v_steering_axis_body1`);
    parts.push(`  Op: Rotate, Space: Local`);
    parts.push(`  Amount: steering`);
  }

  if (cfg.dialList.length > 0) {
    parts.push(``);
    parts.push(`### 8. Dials / Gauges`);
    for (const dial of cfg.dialList) {
      parts.push(`- Add Node -> Pose`);
      parts.push(`  Source: "GroupName.Column.AnimName" (replace with your animation names)`);
      parts.push(`  Expression: clamp(${dial} / maxValue, 0, 1)`);
      parts.push(`  0 = first frame (min position), 1 = last frame (max position)`);
    }
    parts.push(`All dial positions should be baked into a single animation as keyframes.`);
  }

  if (cfg.hasTurret) {
    parts.push(``);
    parts.push(`### 9. Turret Rotation`);
    parts.push(`- Add Node -> Procedural`);
    parts.push(`  Bone: v_turret_01`);
    parts.push(`  Op: Rotate, Space: Model`);
    parts.push(`  Amount: YawAngle (horizontal rotation)`);
    parts.push(`- Add a second Procedural node for gun elevation:`);
    parts.push(`  Bone: (gun bone, e.g. v_gun_01)`);
    parts.push(`  Op: Rotate, Space: Local`);
    parts.push(`  Amount: AimY`);
  }

  parts.push(``);
  const seatSectionNum = cfg.hasTurret ? 10 : cfg.dialList.length > 0 ? 9 : cfg.hasSteeringLinkage ? 8 : cfg.hasSuspensionIK ? 7 : 6;
  parts.push(`### ${seatSectionNum}. Character Seat State Machine`);
  parts.push(`- Add Node -> State Machine, name: SeatStateMachine`);
  for (let i = 0; i < cfg.seatTypes.length; i++) {
    const seat = cfg.seatTypes[i];
    const stateName = seat.charAt(0).toUpperCase() + seat.slice(1);
    parts.push(`- Add Node -> State, name: ${stateName}State`);
    parts.push(`  Transition condition: SeatPositionType == ${i}`);
    parts.push(`  Each state wraps a Queue for action commands (GetIn, GetOut, Death, etc.)`);
  }
  parts.push(`- Add IK2Target + IK2 nodes for hand placement on steering wheel / controls:`);
  parts.push(`  LHandIKTarget -> LeftArm chain`);
  parts.push(`  RHandIKTarget -> RightArm chain`);
  parts.push(`  LeftLeg IK target -> LeftLeg chain`);
  parts.push(`  RightLeg IK target -> RightLeg chain`);

  parts.push(``);
  parts.push(`### ${seatSectionNum + 1}. Connect the Graph`);
  parts.push(`- MasterSleep.Child -> [top of chassis branch]`);
  parts.push(`- All chassis nodes feed upward to MasterControl`);
  parts.push(`- Seat state machine runs in parallel via a Blend node if needed`);
  parts.push(`- DefaultRunNode in AGR must exactly match "MasterControl"`);

  return parts.join("\n");
}

function generatePrefabInstructions(cfg: VehicleConfig): string {
  const wheelVars = Array.from({ length: cfg.wheelCount }, (_, i) => `wheel_${i}`).join(", ");
  const suspVars = Array.from({ length: cfg.wheelCount }, (_, i) => `suspension_${i}`).join(", ");

  const parts: string[] = [];
  parts.push(`## Prefab Component Setup`);
  parts.push(``);
  parts.push(`Add to your vehicle prefab in World Editor / Prefab Editor:`);
  parts.push(``);
  parts.push(`1. Add component: VehicleAnimationComponent`);
  parts.push(`   - AnimGraph: {GUID}path/to/${cfg.vehicleName}.agr  (set after Workbench registration)`);
  parts.push(`   - AnimInstance: {GUID}path/to/${cfg.vehicleName}.asi  (create .asi after .ast is ready)`);
  parts.push(`   - AlwaysActive: 1  (set to 1 if vehicle should animate without an occupant)`);
  parts.push(``);
  parts.push(`2. The .asi file must reference your .ast and map each animation group to .anm files:`);
  parts.push(`   - Create via Animation Editor -> New Instance`);
  parts.push(`   - Map each group (${cfg.seatTypes.map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(", ")}) and column (Default) to .anm files`);
  parts.push(``);
  parts.push(`3. VehicleAnimationComponent automatically feeds these variables from physics:`);
  parts.push(`   ${wheelVars},`);
  parts.push(`   ${suspVars}, steering, Engine_RPM, SPEED,`);
  parts.push(`   VehicleAccelerationFB/LR, YawAngle, Yaw, Pitch, IsDriver, SeatPositionType, etc.`);
  parts.push(`   You do NOT need script for standard vehicle variables.`);

  return parts.join("\n");
}

function generateChecklist(cfg: VehicleConfig): string {
  const parts: string[] = [];
  parts.push(`## Verification Checklist`);
  parts.push(``);
  parts.push(`Before verifying, confirm your starting point:`);
  parts.push(`- [ ] Used Duplicate Project from a base game .aw, OR generated AGR/AST from this tool`);
  parts.push(`- [ ] All files are registered in Workbench (have real GUIDs, not PLACEHOLDER_GUID)`);
  parts.push(``);
  parts.push(`After setup, verify in Workbench:`);
  parts.push(``);
  parts.push(`1. AGR opens without errors in Animation Editor`);
  parts.push(`   [ ] Variables list shows all expected variables`);
  parts.push(`   [ ] IK chains list shows all expected chains`);
  parts.push(`   [ ] DefaultRunNode = "MasterControl"`);
  parts.push(``);
  parts.push(`2. AGF node graph loads`);
  parts.push(`   [ ] MasterControl Queue node is present`);
  parts.push(`   [ ] No "missing node" warnings in editor`);
  parts.push(``);
  parts.push(`3. In-game verification (Workbench Play mode):`);
  parts.push(`   [ ] Open Animation Editor -> Live Debug tab`);
  parts.push(`   [ ] Add vehicle to scene, enter play mode`);
  parts.push(`   [ ] Check variable values update as vehicle moves:`);
  parts.push(`     - wheel_0..${cfg.wheelCount - 1} update while driving`);
  if (cfg.hasSuspensionIK) {
    parts.push(`     - suspension_0..${cfg.wheelCount - 1} change over terrain`);
  }
  parts.push(`     - steering changes on turn`);
  parts.push(`   [ ] Visual check: wheels rotate in correct direction`);
  if (cfg.hasSuspensionIK) {
    parts.push(`   [ ] Visual check: suspension bones move with terrain`);
  }
  if (cfg.hasTurret) {
    parts.push(`   [ ] Turret rotates with YawAngle variable`);
  }
  if (cfg.dialList.length > 0) {
    parts.push(`   [ ] Dial bones move with variable changes`);
  }
  parts.push(``);
  parts.push(`4. Seat animations:`);
  parts.push(`   [ ] GetIn/GetOut animations play on entry/exit`);
  parts.push(`   [ ] Driver idle/drive animations blend correctly`);
  if (cfg.seatTypes.includes("gunner")) {
    parts.push(`   [ ] Gunner animations work in turret seat`);
  }
  parts.push(``);
  parts.push(`Common issues:`);
  parts.push(`- Wheels spin backwards: negate the wheel_N expression (Amount: -wheel_0)`);
  if (cfg.hasSuspensionIK) {
    parts.push(`- Suspension not moving: check IK chain bone names match v_suspension${0}..${cfg.wheelCount - 1} exactly`);
  }
  parts.push(`- Graph not running: verify DefaultRunNode name matches MasterControl Queue node name`);
  parts.push(`- Variables stuck at 0: ensure VehicleAnimationComponent (not AnimationControllerComponent) is used`);

  return parts.join("\n");
}

// ── Merged tool registration ──────────────────────────────────────────────────

export function registerAnimationGraph(server: McpServer, config: Config): void {
  server.registerTool(
    "animation_graph",
    {
      description:
        "Unified animation graph tool for Arma Reforger vehicles. " +
        "action=author: Generate and write .agr and .ast scaffold files for a new vehicle. " +
        "action=inspect: Read and summarize an animation graph file (.agr, .agf, .ast, .asi, or .aw); use sub-action='validate' for pitfall checks. " +
        "action=setup: Full guided workflow wizard — generates scaffold, AGF node graph instructions, prefab setup, and verification checklist. " +
        "Trigger: 'create animation graph for new vehicle', 'generate AGR', 'inspect animation graph', " +
        "'set up vehicle animation', 'suggest improvements to animation graph', 'guide for animation'.",
      inputSchema: {
        action: z.enum(["author", "inspect", "setup"])
          .describe("Action to perform: author (generate .agr/.ast files), inspect (read/summarize/validate animation files), setup (full guided workflow wizard)."),

        // ── author params ──
        vehicleName: z.string().optional().describe("(author/setup) Vehicle name (e.g. 'MyTruck'). Used in file names and GlobalTags."),
        vehicleType: z.enum(["wheeled", "tracked", "helicopter", "boat"]).default("wheeled").describe("(author/setup) Vehicle type."),
        wheelCount: z.number().int().min(2).max(8).refine(n => n % 2 === 0, "Must be even (2/4/6/8)").default(4).describe("(author/setup) Number of wheels (2/4/6/8). Must be even."),
        hasTurret: z.boolean().default(false).describe("(author/setup) Add turret variables and bone mask."),
        hasSuspensionIK: z.boolean().default(true).describe("(author/setup) Add suspension IK chains."),
        hasShockAbsorbers: z.boolean().default(false).describe("(author/setup) Add shock absorber IK chains."),
        hasSteeringLinkage: z.boolean().default(false).describe("(author/setup) Add steering axis IK chains."),
        seatTypes: z.array(z.enum(["driver", "gunner", "commander", "passenger"])).default(["driver"]).describe("(author/setup) Seat types for the vehicle."),
        dialList: z.array(z.string()).default([]).describe("(author/setup) Variable names to use as dials (e.g. ['Engine_RPM', 'SPEED'])."),
        outputPath: z.string().optional().describe("(author/setup) Destination folder within mod project (e.g. 'Assets/Vehicles/MyTruck/workspaces'). Defaults to 'Assets/Vehicles/<vehicleName>/workspaces'."),
        projectPath: z.string().optional().describe("(author/inspect/setup) Mod project root. Uses default if omitted."),

        // ── inspect params ──
        path: z.string().optional().describe(
          "(inspect) File path to .agr, .agf, .ast, .asi, or .aw. Relative to mod project (source=mod) or game data root (source=game). " +
          "Example: 'Assets/Vehicles/MyTruck/workspaces/MyTruck.agr'"
        ),
        inspectAction: z.enum(["inspect", "validate"]).default("inspect")
          .describe("(inspect) Sub-action: inspect (default) returns structured summary; validate runs pitfall checks (requires .agf)"),
        source: z.enum(["mod", "game"]).default("mod")
          .describe("(inspect/setup) Read from the mod project directory (mod) or base game data (game)."),
        agrPath: z.string().optional()
          .describe("(inspect/setup) AGR file path for cross-reference during validate or suggest. Same source/projectPath resolution."),
        asiPath: z.string().optional()
          .describe("(inspect) ASI file path for cross-reference during validate."),

        // ── setup params ──
        step: z
          .enum(["all", "agr", "agf_instructions", "prefab_setup", "checklist"])
          .default("all")
          .describe("(setup) Which section to return (setup action only). 'all' returns everything."),
        agfPath: z.string().optional()
          .describe("(setup) AGF file path for suggest sub-action. Relative to mod project or game data."),
        preset: z.enum(["character", "weapon", "prop", "custom"]).optional()
          .describe("(setup) Guide preset (guide sub-action only). Available: character, weapon, prop, custom."),
        setupSubAction: z.enum(["setup", "suggest", "guide"]).default("setup")
          .describe("(setup) Sub-action: setup generates vehicle scaffold; suggest analyzes existing graph; guide provides best-practice guidance."),
      },
    },
    async (opts) => {
      // outputPath is optional in the schema but interpolated straight into the
      // written path — omitting it used to produce a directory literally named
      // "undefined" and still report success. Resolve it once, here, so every
      // write path (author and setup) gets the same sane default.
      if (!opts.outputPath && opts.vehicleName) {
        opts.outputPath = `Assets/Vehicles/${opts.vehicleName}/workspaces`;
      }

      // ── author handler ──────────────────────────────────────────────────────
      if (opts.action === "author") {
        const basePath = opts.projectPath || config.projectPath;
        if (!basePath) {
          return { content: [{ type: "text", text: "No project path configured." }], isError: true };
        }

        if (!opts.vehicleName) {
          return { content: [{ type: "text", text: "author action requires vehicleName." }], isError: true };
        }

        const cfg: VehicleConfig = {
          vehicleName: opts.vehicleName,
          vehicleType: opts.vehicleType,
          wheelCount: opts.wheelCount,
          hasTurret: opts.hasTurret,
          hasSuspensionIK: opts.hasSuspensionIK,
          hasShockAbsorbers: opts.hasShockAbsorbers,
          hasSteeringLinkage: opts.hasSteeringLinkage,
          seatTypes: opts.seatTypes,
          dialList: opts.dialList,
        };

        try {
          const agrContent = generateAgrAuthor(cfg);
          const astContent = generateAstAuthor(cfg);

          const agrPath = validateProjectPath(basePath, `${opts.outputPath}/${opts.vehicleName}.agr`);
          const astPath = validateProjectPath(basePath, `${opts.outputPath}/${opts.vehicleName}.ast`);

          mkdirSync(dirname(agrPath), { recursive: true });
          writeFileSync(agrPath, agrContent, "utf-8");
          writeFileSync(astPath, astContent, "utf-8");

          return {
            content: [
              {
                type: "text",
                text: [
                  `Generated animation graph files for ${opts.vehicleName}:`,
                  `  AGR: ${opts.outputPath}/${opts.vehicleName}.agr`,
                  `  AST: ${opts.outputPath}/${opts.vehicleName}.ast`,
                  ``,
                  `Next steps:`,
                  `1. Open Workbench and register both files (right-click -> Add to project)`,
                  `2. Open the AGR in Animation Editor to verify variables and IK chains`,
                  `3. Create a new .agf file and build the node graph (use action=setup for guided instructions)`,
                  `4. Create a .asi file mapping AST animation groups to .anm files`,
                  `5. Add VehicleAnimationComponent to your vehicle prefab, set AnimGraph + AnimInstance`,
                ].join("\n"),
              },
            ],
          };
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          return { content: [{ type: "text", text: `Error generating animation graph files: ${msg}` }], isError: true };
        }
      }

      // ── inspect handler ─────────────────────────────────────────────────────
      if (opts.action === "inspect") {
        const filePath = opts.path;
        const subAction = opts.inspectAction;
        const source = opts.source;
        const projectPath = opts.projectPath;
        const agrPath = opts.agrPath;
        const asiPath = opts.asiPath;

        if (!filePath) {
          return { content: [{ type: "text", text: "path is required for inspect action." }], isError: true };
        }

        const ext = extname(filePath).toLowerCase();
        if (![".agr", ".agf", ".ast", ".asi", ".aw"].includes(ext)) {
          return {
            content: [
              {
                type: "text",
                text: `Unsupported file type: ${ext}. Supported: .agr, .agf, .ast, .asi, .aw`,
              },
            ],
          };
        }

        // Read main file
        let content: string;
        try {
          if (source === "mod") {
            const basePath = projectPath || config.projectPath;
            if (!basePath) {
              return {
                content: [
                  {
                    type: "text",
                    text: "No project path configured. Set ENFUSION_PROJECT_PATH or provide projectPath.",
                  },
                ],
                isError: true,
              };
            }
            const fullPath = validateProjectPath(basePath, filePath);
            if (!existsSync(fullPath)) {
              return {
                content: [{ type: "text", text: `File not found: ${filePath}` }],
                isError: true,
              };
            }
            content = readFileSync(fullPath, "utf-8");
          } else {
            const dataPath = join(config.gamePath, "addons", "data");
            const loosePath = validateProjectPath(dataPath, filePath);
            if (existsSync(loosePath)) {
              content = readFileSync(loosePath, "utf-8");
            } else {
              const pakVfs = PakVirtualFS.get(config.gamePath);
              if (pakVfs && pakVfs.exists(filePath)) {
                const buf = pakVfs.readFile(filePath);
                content = buf.toString("utf-8");
              } else {
                return {
                  content: [
                    {
                      type: "text",
                      text: `File not found in game data: ${filePath}`,
                    },
                  ],
                  isError: true,
                };
              }
            }
          }
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          return {
            content: [
              { type: "text", text: `Error reading file: ${msg}` },
            ],
            isError: true,
          };
        }

        // Handle validate sub-action
        if (subAction === "validate") {
          if (ext !== ".agf") {
            return {
              content: [{ type: "text", text: "Validate action requires an .agf file as the primary path." }],
              isError: true,
            };
          }

          // Dynamic import to avoid circular deps — validator is implemented in Task 7
          const { validateGraph } = await import("../animation/validator.js");
          const agf = parseAgfToStruct(content);

          let agr;
          if (agrPath) {
            const agrContent = readFileForTool(agrPath, source, projectPath, config);
            if (agrContent) agr = parseAgrToStruct(agrContent);
          }

          let asi;
          if (asiPath) {
            const asiContent = readFileForTool(asiPath, source, projectPath, config);
            if (asiContent) asi = parseAsiToStruct(asiContent);
          }

          const result = validateGraph(agf, agr, asi, filePath);
          const report = formatValidationReport(result.issues, result.errorCount, result.warningCount);
          return { content: [{ type: "text", text: report }] };
        }

        // Handle inspect sub-action
        let summary: string;
        if (ext === ".agr") summary = formatAgrSummary(parseAgrToStruct(content));
        else if (ext === ".agf") summary = formatAgfTree(parseAgfToStruct(content));
        else if (ext === ".ast") summary = formatAstSummary(parseAstToStruct(content));
        else if (ext === ".asi") summary = formatAsiSummary(parseAsiToStruct(content));
        else summary = formatAwSummary(parseAwToStruct(content));

        return { content: [{ type: "text", text: summary }] };
      }

      // ── setup handler ───────────────────────────────────────────────────────
      if (opts.action === "setup") {
        const setupSubAction = opts.setupSubAction;

        // Handle guide sub-action
        if (setupSubAction === "guide") {
          const presetName = opts.preset ?? "custom";
          return { content: [{ type: "text", text: generateGuide(presetName) }] };
        }

        // Handle suggest sub-action
        if (setupSubAction === "suggest") {
          if (!opts.agfPath) {
            return { content: [{ type: "text", text: "agfPath is required for suggest sub-action." }], isError: true };
          }
          const agfContent = readFileForTool(opts.agfPath, opts.source, opts.projectPath, config);
          if (!agfContent) {
            return { content: [{ type: "text", text: `Could not read AGF file: ${opts.agfPath}` }], isError: true };
          }
          const agf = parseAgfToStruct(agfContent);
          let agr;
          if (opts.agrPath) {
            const agrContent = readFileForTool(opts.agrPath, opts.source, opts.projectPath, config);
            if (agrContent) agr = parseAgrToStruct(agrContent);
          }
          const suggestions = generateSuggestions(agf, agr);
          return { content: [{ type: "text", text: formatSuggestions(suggestions) }] };
        }

        // Handle setup sub-action
        if (!opts.vehicleName) {
          return { content: [{ type: "text", text: "vehicleName is required for setup action." }], isError: true };
        }

        const cfg: VehicleConfig = {
          vehicleName: opts.vehicleName,
          vehicleType: opts.vehicleType,
          wheelCount: opts.wheelCount,
          hasTurret: opts.hasTurret,
          hasSuspensionIK: opts.hasSuspensionIK,
          hasShockAbsorbers: opts.hasShockAbsorbers,
          hasSteeringLinkage: opts.hasSteeringLinkage,
          seatTypes: opts.seatTypes,
          dialList: opts.dialList,
        };

        const parts: string[] = [];

        if (opts.step === "all" || opts.step === "agr") {
          const basePath = opts.projectPath || config.projectPath;
          if (basePath) {
            try {
              const agrContent = generateAgrAuthor(cfg);
              const astContent = generateAstAuthor(cfg);
              const agrFilePath = validateProjectPath(
                basePath,
                `${opts.outputPath}/${opts.vehicleName}.agr`
              );
              const astFilePath = validateProjectPath(
                basePath,
                `${opts.outputPath}/${opts.vehicleName}.ast`
              );
              mkdirSync(dirname(agrFilePath), { recursive: true });
              writeFileSync(agrFilePath, agrContent, "utf-8");
              writeFileSync(astFilePath, astContent, "utf-8");
              parts.push(
                `## Step 1: AGR + AST Files Generated\n- ${opts.outputPath}/${opts.vehicleName}.agr\n- ${opts.outputPath}/${opts.vehicleName}.ast\nRegister both files in Workbench to assign GUIDs.`
              );
            } catch (e) {
              const msg = e instanceof Error ? e.message : String(e);
              parts.push(`## Step 1: AGR + AST — Error\n${msg}`);
            }
          } else {
            parts.push(
              `## Step 1: AGR + AST — Skipped\nNo project path configured. Set ENFUSION_PROJECT_PATH or provide projectPath.`
            );
          }
        }

        if (opts.step === "all" || opts.step === "agf_instructions") {
          parts.push(generateAgfInstructions(cfg));
        }

        if (opts.step === "all" || opts.step === "prefab_setup") {
          parts.push(generatePrefabInstructions(cfg));
        }

        if (opts.step === "all" || opts.step === "checklist") {
          parts.push(generateChecklist(cfg));
        }

        return {
          content: [{ type: "text", text: parts.join("\n\n---\n\n") }],
        };
      }

      // Unreachable — action enum exhausted — but satisfies TypeScript
      return { content: [{ type: "text", text: "Unknown action." }], isError: true };
    }
  );
}
