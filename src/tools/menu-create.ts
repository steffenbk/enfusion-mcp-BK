import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { resolve, join } from "node:path";
import type { Config } from "../config.js";
import { generateLayoutTree } from "../templates/layout.js";
import {
  generateMenuScript,
  generateMenuPresetBlock,
  buildMenuLayoutTree,
  MENU_BASE_CLASSES,
  DEFAULT_HINTS,
  IDENTIFIER_RE,
  type MenuHint,
  type MenuBaseClass,
} from "../templates/menu.js";
import { validateFilename, validateEnforceIdentifier } from "../utils/safe-path.js";

const SCRIPT_SUBDIR = "scripts/Game/UI";
const LAYOUT_SUBDIR = "UI/layouts/Menus";
const CONF_RELPATH = "Configs/System/chimeraMenus.conf";

/**
 * The layout's real resource GUID lives in its generated .meta file, which only
 * Workbench can mint — so the preset block ships a placeholder the user must replace.
 * Making this loud is the point: a wrong ref here is one of the ways a menu silently
 * never opens.
 */
const GUID_PLACEHOLDER = "REPLACE_WITH_LAYOUT_GUID";

export function registerMenuCreate(server: McpServer, config: Config): void {
  server.registerTool(
    "menu_create",
    {
      description:
        "Scaffold a complete custom Arma Reforger menu: the Enforce class (.c) with the modded ChimeraMenuPreset enum entry and every input-context/debounce guard pre-wired, a root .layout with a footer hint bar whose buttons carry SCR_InputButtonComponent, and the MenuPreset block for chimeraMenus.conf. " +
        "Encodes the non-obvious requirements that otherwise fail silently: input contexts must be re-activated every frame or only mouse clicks work; MenuUp/MenuDown are not in MenuContext; action listeners do not fire in this menu family so actions are polled; one physical press arrives twice (hint invoker + poll) and needs a time-based debounce; hint actions must be tap not hold. " +
        "Use action='list' to see base classes and defaults. Prefer this over script_create + layout_create when building a menu.",
      inputSchema: {
        action: z
          .enum(["list", "create"])
          .optional()
          .describe("'list' shows base classes and hint defaults; 'create' (default) writes the files."),
        className: z
          .string()
          .optional()
          .describe("Enforce class name, e.g. 'TAG_ShopMenu'. Required for 'create'."),
        presetName: z
          .string()
          .optional()
          .describe("MenuPreset / ChimeraMenuPreset enum constant. Defaults to className. Must match across all three artefacts."),
        layoutName: z
          .string()
          .optional()
          .describe("Layout filename without extension. Defaults to className."),
        title: z
          .string()
          .optional()
          .describe("Title text drawn at the top of the generated layout. Defaults to className."),
        baseClass: z
          .enum(["ChimeraMenuBase", "MenuRootBase"])
          .optional()
          .describe(
            "Menu base class (default 'ChimeraMenuBase'). 'MenuRootBase' adds menu-root events, dynamic footer and chat handling. SCR_SuperMenuBase is deliberately not offered — without an SCR_SuperMenuComponent in the layout root it errors on every open while doing nothing."
          ),
        actionContext: z
          .string()
          .optional()
          .describe("ActionContext for the MenuPreset (default 'MenuContext')."),
        hints: z
          .array(
            z.object({
              widget: z.string().describe("Widget name, e.g. 'HintBack'."),
              label: z.string().describe("Visible label, e.g. 'Back'."),
              action: z.string().describe("Input action — MUST be a tap action (MenuBack, MenuSelect, MenuRefresh, MenuFavourite). A hold action crashes the hint's hold animation."),
              handler: z.string().describe("Generated handler method name, e.g. 'OnBack'."),
            })
          )
          .optional()
          .describe("Footer hint buttons. Defaults to a single Back hint bound to MenuBack. A hint whose action is 'MenuBack' gets a Close() body; others get a stub."),
        projectPath: z
          .string()
          .optional()
          .describe("Addon root path. Uses configured default if omitted."),
      },
    },
    async ({ action, className, presetName, layoutName, title, baseClass, actionContext, hints, projectPath }) => {
      try {
        if ((action ?? "create") === "list") {
          return {
            content: [{
              type: "text",
              text: [
                `Menu base classes:`,
                ...MENU_BASE_CLASSES.map((b) =>
                  b === "ChimeraMenuBase"
                    ? `- ChimeraMenuBase — plain custom menu (default).`
                    : `- MenuRootBase — adds menu-root events, dynamic footer, chat handling; all null-guarded.`
                ),
                ``,
                `Not offered: SCR_SuperMenuBase. Its only job is forwarding lifecycle to an`,
                `SCR_SuperMenuComponent in the layout root; without one it prints`,
                `"No SCR_SuperMenuComponent in layout root" on every open and does nothing else.`,
                ``,
                `Default hints: ${DEFAULT_HINTS.map((h) => `${h.widget} ("${h.label}" -> ${h.action} -> ${h.handler}())`).join(", ")}`,
                ``,
                `Tap-only actions safe for hints: MenuBack, MenuSelect, MenuRefresh, MenuFavourite.`,
                `Output: ${SCRIPT_SUBDIR}/<className>.c, ${LAYOUT_SUBDIR}/<layoutName>.layout,`,
                `and a MenuPreset block for ${CONF_RELPATH}.`,
              ].join("\n"),
            }],
          };
        }

        if (!className) {
          return {
            content: [{ type: "text", text: "Error: 'className' is required for create." }],
            isError: true,
          };
        }
        validateFilename(className);
        validateEnforceIdentifier(className);

        const preset = presetName ?? className;
        validateEnforceIdentifier(preset);

        const layout = layoutName ?? className;
        validateFilename(layout);

        const ctx = actionContext ?? "MenuContext";
        const base: MenuBaseClass = baseClass ?? "ChimeraMenuBase";
        const hintList: MenuHint[] = hints && hints.length > 0 ? hints : DEFAULT_HINTS;

        // Every hint field below is interpolated into generated Enforce source, so each one
        // is validated before it can reach a file in the user's project.
        const seenWidgets = new Set<string>();
        const seenActions = new Set<string>();
        for (const h of hintList) {
          // Duplicate widget names would make the script's second lookup resolve to the
          // first button, silently binding two handlers to one control.
          if (seenWidgets.has(h.widget)) {
            return {
              content: [{ type: "text", text: `Error: duplicate hint widget name '${h.widget}'. Each hint needs a unique widget name.` }],
              isError: true,
            };
          }
          seenWidgets.add(h.widget);

          // Two hints on one action means the first handler always wins and the second is
          // permanently dead — silently, since both still wire up and both still compile.
          if (seenActions.has(h.action)) {
            return {
              content: [{
                type: "text",
                text: `Error: two hints share the action '${h.action}'. Only the first would ever fire — give each hint a distinct action.`,
              }],
              isError: true,
            };
          }
          seenActions.add(h.action);

          for (const [field, value] of [["widget", h.widget], ["action", h.action], ["handler", h.handler]] as const) {
            if (!IDENTIFIER_RE.test(value)) {
              return {
                content: [{
                  type: "text",
                  text: `Error: hint ${field} '${value}' is not a bare identifier. It is emitted directly into generated script, so it must match [A-Za-z_][A-Za-z0-9_]*.`,
                }],
                isError: true,
              };
            }
          }
          validateEnforceIdentifier(h.handler);
        }

        const layoutRef = `{${GUID_PLACEHOLDER}}${LAYOUT_SUBDIR}/${layout}.layout`;

        const scriptContent = generateMenuScript({
          className,
          presetName: preset,
          layoutName: layout,
          baseClass: base,
          actionContext: ctx,
          hints: hintList,
        });

        const layoutContent = generateLayoutTree(
          buildMenuLayoutTree({ layoutName: layout, title: title ?? className, hints: hintList })
        );

        const presetBlock = generateMenuPresetBlock({
          presetName: preset,
          layoutRef,
          className,
          actionContext: ctx,
        });

        const basePath = projectPath || config.projectPath;

        if (!basePath) {
          return {
            content: [{
              type: "text",
              text: [
                `Generated menu scaffold (no project path configured — nothing written).`,
                ``,
                `**${SCRIPT_SUBDIR}/${className}.c**`,
                "```c",
                scriptContent,
                "```",
                ``,
                `**${LAYOUT_SUBDIR}/${layout}.layout**`,
                "```",
                layoutContent,
                "```",
                ``,
                ...presetInstructions(presetBlock, basePath),
                ``,
                `Set ENFUSION_PROJECT_PATH to write files automatically.`,
              ].join("\n"),
            }],
          };
        }

        const scriptDir = resolve(basePath, SCRIPT_SUBDIR);
        const layoutDir = resolve(basePath, LAYOUT_SUBDIR);
        const scriptPath = join(scriptDir, `${className}.c`);
        const layoutPath = join(layoutDir, `${layout}.layout`);

        const existing: string[] = [];
        if (existsSync(scriptPath)) existing.push(`${SCRIPT_SUBDIR}/${className}.c`);
        if (existsSync(layoutPath)) existing.push(`${LAYOUT_SUBDIR}/${layout}.layout`);
        if (existing.length > 0) {
          return {
            content: [{
              type: "text",
              text:
                `File(s) already exist — nothing written:\n${existing.map((e) => `  ${e}`).join("\n")}\n\n` +
                `Generated content:\n\n**${className}.c**\n\`\`\`c\n${scriptContent}\n\`\`\`\n\n` +
                `**${layout}.layout**\n\`\`\`\n${layoutContent}\n\`\`\``,
            }],
          };
        }

        mkdirSync(scriptDir, { recursive: true });
        mkdirSync(layoutDir, { recursive: true });

        const written: string[] = [];
        try {
          writeFileSync(scriptPath, scriptContent, "utf-8");
          written.push(scriptPath);
          writeFileSync(layoutPath, layoutContent, "utf-8");
          written.push(layoutPath);
        } catch (writeErr) {
          // Roll back so a half-written menu never ships.
          for (const p of written) {
            try {
              if (existsSync(p)) writeFileSync(p, "", "utf-8");
            } catch {
              /* best effort */
            }
          }
          throw writeErr;
        }

        return {
          content: [{
            type: "text",
            text: [
              `Menu scaffold created:`,
              `  ${SCRIPT_SUBDIR}/${className}.c`,
              `  ${LAYOUT_SUBDIR}/${layout}.layout`,
              ``,
              "```c",
              scriptContent,
              "```",
              ``,
              ...presetInstructions(presetBlock, basePath),
              ``,
              `Follow-up:`,
              `[ ] Open the layout in Workbench once so its .meta is generated, then copy its resource`,
              `    name (right-click the layout > Copy Resource Name) over the ${GUID_PLACEHOLDER}`,
              `    placeholder in the MenuPreset block. A wrong ref here means the menu never opens.`,
              `[ ] Fill the "Content" frame in the layout with the menu's actual widgets.`,
              `[ ] Open it from script: GetGame().GetMenuManager().OpenMenu(ChimeraMenuPreset.${preset});`,
            ].join("\n"),
          }],
        };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return { content: [{ type: "text", text: `Error: ${msg}` }], isError: true };
      }
    }
  );
}

/**
 * chimeraMenus.conf is a FULL override of the vanilla file — hundreds of presets.
 * Writing a stub containing only the new entry would delete every vanilla menu, so the
 * tool never creates or edits it; it tells the user exactly where to paste instead.
 */
function presetInstructions(presetBlock: string, basePath: string | undefined): string[] {
  const confPath = basePath ? join(basePath, CONF_RELPATH) : null;
  const hasOverride = confPath ? existsSync(confPath) : false;

  const lines = [`**MenuPreset block for ${CONF_RELPATH}**`, "```", presetBlock, "```", ``];

  if (hasOverride) {
    let presetCount = 0;
    try {
      presetCount = (readFileSync(confPath!, "utf-8").match(/^\s*MenuPreset\s/gm) ?? []).length;
    } catch {
      /* count is cosmetic */
    }
    lines.push(
      `You already override ${CONF_RELPATH}${presetCount > 0 ? ` (${presetCount} presets)` : ""}.`,
      `Paste the block above inside its \`MenuPresets { ... }\` block, alongside the existing entries.`,
      `Not written automatically: this file is edited by hand elsewhere and a scripted insert could`,
      `corrupt an override that every menu in the game depends on.`
    );
  } else {
    lines.push(
      `You do NOT yet override ${CONF_RELPATH}.`,
      `Copy the VANILLA file from the extracted game data to that path first, then paste the block`,
      `above into its \`MenuPresets { ... }\` block. Do not create a file containing only this entry —`,
      `the override replaces the vanilla file wholesale, so a stub would remove every other menu.`
    );
  }

  return lines;
}
