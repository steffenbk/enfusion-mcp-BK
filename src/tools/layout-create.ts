import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";
import type { Config } from "../config.js";
import {
  generateLayout,
  getLayoutSubdirectory,
  getLayoutFilename,
  type LayoutType,
  type WidgetDef,
} from "../templates/layout.js";
import { validateFilename } from "../utils/safe-path.js";

export function registerLayoutCreate(server: McpServer, config: Config): void {
  server.registerTool(
    "layout_create",
    {
      description:
        "Create a UI layout (.layout) file for an Arma Reforger mod. Generates a properly structured layout with widgets in valid Enfusion text serialization format. Use for HUD elements, menus, dialogs, and custom UI.",
      inputSchema: {
        name: z
          .string()
          .min(1)
          .describe("Layout name (e.g., 'HealthDisplay', 'ScoreboardMenu')"),
        layoutType: z
          .enum(["hud", "menu", "dialog", "list", "custom"])
          .describe(
            "Layout template type. 'hud' creates a bottom-left HUD element. 'menu' creates a centered menu panel. 'dialog' creates a centered confirmation dialog. 'list' creates a left-side list panel. 'custom' creates a blank full-screen frame."
          ),
        rootWidgetType: z
          .string()
          .optional()
          .describe("Override the root widget class (default: FrameWidgetClass)"),
        anchor: z
          .string()
          .optional()
          .describe(
            "Root anchor as 'left top right bottom' floats 0-1 (e.g., '0 1 0 1' = bottom-left corner). Uses layout type default if omitted."
          ),
        offset: z
          .string()
          .optional()
          .describe(
            "Root offset as 'left top right bottom' in pixels relative to anchor (e.g., '20 -120 220 -20'). Uses layout type default if omitted."
          ),
        widgets: z
          .array(
            z.object({
              type: z
                .string()
                .describe(
                  "Widget class name: TextWidgetClass, ImageWidgetClass, ProgressBarWidgetClass, ButtonWidgetClass, RichTextWidgetClass, FrameWidgetClass, OverlayWidgetClass"
                ),
              name: z
                .string()
                .describe("Widget name for FindAnyWidget() lookups in scripts"),
              anchor: z
                .string()
                .optional()
                .describe("Anchor as 'left top right bottom' floats 0-1"),
              offset: z
                .string()
                .optional()
                .describe("Offset as 'left top right bottom' in pixels"),
              properties: z
                .record(z.string())
                .optional()
                .describe(
                  "Widget properties (e.g., Text, Color, ExactFontSize, Min, Max, Current, Align)"
                ),
            })
          )
          .optional()
          .describe(
            "Additional widgets to add beyond the layout type defaults. Each widget needs at minimum a type and name."
          ),
        description: z
          .string()
          .optional()
          .describe("Description comment for the layout"),
        projectPath: z
          .string()
          .optional()
          .describe("Addon root path. Uses configured default if omitted."),
      },
    },
    async ({ name, layoutType, rootWidgetType, anchor, offset, widgets, description, projectPath }) => {
      const basePath = projectPath || config.projectPath;

      try {
        validateFilename(name);

        const content = generateLayout({
          name,
          layoutType: layoutType as LayoutType,
          rootWidgetType,
          anchor,
          offset,
          widgets: widgets as WidgetDef[] | undefined,
          description,
        });

        if (basePath) {
          const subdir = getLayoutSubdirectory();
          const filename = getLayoutFilename(name);
          const targetDir = resolve(basePath, subdir);
          const targetPath = join(targetDir, filename);

          mkdirSync(targetDir, { recursive: true });

          if (existsSync(targetPath)) {
            return {
              content: [
                {
                  type: "text",
                  text: `File already exists: ${subdir}/${filename}\n\nGenerated content (not written):\n\n\`\`\`\n${content}\n\`\`\``,
                },
              ],
            };
          }

          writeFileSync(targetPath, content, "utf-8");

          return {
            content: [
              {
                type: "text",
                text: `Layout created: ${subdir}/${filename}\n\n\`\`\`\n${content}\n\`\`\``,
              },
            ],
          };
        }

        return {
          content: [
            {
              type: "text",
              text: `Generated layout (no project path configured — not written to disk):\n\n\`\`\`\n${content}\n\`\`\`\n\nSet ENFUSION_PROJECT_PATH to write files automatically.`,
            },
          ],
        };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return {
          content: [{ type: "text", text: `Error creating layout: ${msg}` }],
        };
      }
    }
  );
}
