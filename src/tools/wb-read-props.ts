import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { WorkbenchClient } from "../workbench/client.js";
import { formatConnectionStatus } from "../workbench/status.js";

interface ReadPropsResult {
  status: string;
  message: string;
  resource: string;
  path: string;
  className: string;
  varCount: number;
  m_aNames: string[];
  m_aValues: string[];
  m_aDirect: number[];
}

export function registerWbReadProps(server: McpServer, client: WorkbenchClient): void {
  server.registerTool(
    "wb_read_props",
    {
      description:
        "Read resolved property values from a prefab (.et) or config (.conf) through the Workbench engine itself, not by parsing text. Inheritance is already resolved: a value the file does not set is returned as its inherited value, so there is no need to walk parent prefabs, follow .conf references, or extract vanilla data from .pak files by hand. Each value is tagged direct (set in this file) or inherited (from an ancestor). Read-only, works in any Workbench mode.",
      inputSchema: {
        resource: z
          .string()
          .describe(
            "ResourceName of the .et/.conf to read, with or without the {GUID} prefix (e.g. 'Prefabs/Vehicles/Wheeled/M151A2/M151A2.et' or '{GUID}Prefabs/...')."
          ),
        path: z
          .string()
          .optional()
          .describe(
            "Navigation path from the container root, '' (default) for the root container. Segments: " +
              "'@ClassName' finds a component by class name (entity sources only), 'Name' descends via GetObject, " +
              "'Name[i]' indexes an object array via GetObjectArray. Segments join with '/'. " +
              "Examples: '@VehicleWheeledSimulation/Simulation/Engine', '@VehicleWheeledSimulation/Simulation/Axles[0]/Suspension', " +
              "'@SCR_TerrainDragComponent_BK' (whole component)."
          ),
      },
    },
    async ({ resource, path }) => {
      try {
        const result = await client.call<ReadPropsResult>("EMCP_WB_ReadProps", {
          resource,
          path: path ?? "",
        });

        if (result.status !== "ok") {
          return {
            content: [{ type: "text" as const, text: `Error: ${result.message}${formatConnectionStatus(client)}` }],
            isError: true,
          };
        }

        if (result.varCount === 0) {
          return {
            content: [{
              type: "text" as const,
              text: `**${result.className}** at \`${resource}${path ? "#" + path : ""}\` has no readable variables.${formatConnectionStatus(client)}`,
            }],
          };
        }

        const lines = [
          `**${result.className}** — ${result.varCount} propert${result.varCount === 1 ? "y" : "ies"} at \`${resource}${path ? "#" + path : ""}\`\n`,
        ];
        for (let i = 0; i < result.m_aNames.length; i++) {
          const badge = result.m_aDirect[i] === 1 ? "direct" : "inherited";
          lines.push(`- \`${result.m_aNames[i]}\` = ${result.m_aValues[i]}  *(${badge})*`);
        }

        return { content: [{ type: "text" as const, text: lines.join("\n") + formatConnectionStatus(client) }] };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return {
          content: [{ type: "text" as const, text: `Error: ${msg}${formatConnectionStatus(client)}` }],
          isError: true,
        };
      }
    }
  );
}
