import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { WorkbenchClient } from "../workbench/client.js";

export function registerWbValidate(server: McpServer, client: WorkbenchClient): void {
  server.registerTool(
    "wb_validate",
    {
      description:
        "Validate a material or texture resource using the Workbench's built-in validators. Returns validation errors and warnings.",
      inputSchema: {
        action: z
          .enum(["material", "texture"])
          .describe("Validator to run: material or texture"),
        path: z
          .string()
          .describe("Resource path to validate (e.g., 'Materials/MyMat.emat', 'Textures/MyTex.edds')"),
      },
    },
    async ({ action, path }) => {
      try {
        const handlerName = action === "material" ? "MaterialValidator" : "TextureValidator";
        const result = await client.call<Record<string, unknown>>(handlerName, { path });

        const valid = result.valid ?? result.success ?? true;
        const errors = Array.isArray(result.errors) ? result.errors : [];
        const warnings = Array.isArray(result.warnings) ? result.warnings : [];

        const lines: string[] = [];
        const label = action === "material" ? "Material" : "Texture";

        if (valid && errors.length === 0) {
          lines.push(`**${label} Validation Passed**\n`);
          lines.push(`- **Path:** ${path}`);
          lines.push(`- **Status:** Valid`);
        } else {
          lines.push(`**${label} Validation Failed**\n`);
          lines.push(`- **Path:** ${path}`);
          lines.push(`- **Status:** Invalid`);
        }

        if (errors.length > 0) {
          lines.push(`\n### Errors (${errors.length})`);
          for (const err of errors) {
            if (typeof err === "string") {
              lines.push(`- ${err}`);
            } else {
              const e = err as Record<string, unknown>;
              lines.push(`- ${e.message || JSON.stringify(e)}`);
            }
          }
        }

        if (warnings.length > 0) {
          lines.push(`\n### Warnings (${warnings.length})`);
          for (const warn of warnings) {
            if (typeof warn === "string") {
              lines.push(`- ${warn}`);
            } else {
              const w = warn as Record<string, unknown>;
              lines.push(`- ${w.message || JSON.stringify(w)}`);
            }
          }
        }

        // Include any extra info from the response
        if (result.info) {
          lines.push(`\n### Info`);
          lines.push(typeof result.info === "string" ? result.info : JSON.stringify(result.info, null, 2));
        }

        return { content: [{ type: "text" as const, text: lines.join("\n") }] };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return {
          content: [
            {
              type: "text" as const,
              text: `Error validating ${action} "${path}": ${msg}`,
            },
          ],
        };
      }
    }
  );
}
