/**
 * Coxa MCP Server — POS Integration
 *
 * Exposes POS-focused tools so AI agents (Cursor, Claude Desktop, etc.)
 * can interact with the Coxa backend directly via the Model Context Protocol.
 *
 * Transports:
 *   stdio  — default, for Cursor IDE / Claude Desktop integration
 *   http   — optional SSE transport, set MCP_TRANSPORT=http and MCP_PORT=3100
 *
 * Usage:
 *   node backend/src/mcp/server.js           # stdio
 *   MCP_TRANSPORT=http node backend/src/mcp/server.js  # HTTP/SSE on :3100
 *
 * See backend/src/mcp/README.md for Cursor .cursor/mcp.json configuration.
 */

import dotenv from "dotenv";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { tools } from "./tools/pos.js";

dotenv.config({ path: new URL("../../../.env", import.meta.url) });

const server = new McpServer({
  name: "coxa-pos",
  version: "0.2.0",
  description: "Coxa Fan OS — POS integration tools for retail, ticketing, and fan lookup",
});

/**
 * Register every tool from tools/pos.js.
 * The MCP SDK's tool() method accepts a Zod schema for validation.
 * We convert the JSON Schema inputSchema to a Zod shape dynamically.
 */
function jsonSchemaToZod(schema) {
  if (!schema?.properties) return {};
  const shape = {};
  for (const [key, def] of Object.entries(schema.properties)) {
    const required = schema.required?.includes(key) ?? false;
    let field;

    if (def.type === "string") {
      field = def.enum
        ? z.enum(def.enum).describe(def.description ?? key)
        : z.string().describe(def.description ?? key);
    } else if (def.type === "number") {
      field = z.number().describe(def.description ?? key);
    } else if (def.type === "boolean") {
      field = z.boolean().describe(def.description ?? key);
    } else if (def.type === "array") {
      field = z.array(z.any()).describe(def.description ?? key);
    } else {
      field = z.any().describe(def.description ?? key);
    }

    shape[key] = required ? field : field.optional();
  }
  return shape;
}

for (const tool of tools) {
  const zodShape = jsonSchemaToZod(tool.inputSchema);
  server.tool(tool.name, tool.description, zodShape, async (args) => {
    try {
      const result = await tool.handler(args);
      return {
        content: [{ type: "text", text: result }],
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: JSON.stringify({ error: err.message }) }],
        isError: true,
      };
    }
  });
}

/* ── Transport selection ─────────────────────────── */
const transport = process.env.MCP_TRANSPORT ?? "stdio";

if (transport === "http") {
  // Lazy import to keep stdio startup clean
  const { StreamableHTTPServerTransport } = await import(
    "@modelcontextprotocol/sdk/server/streamableHttp.js"
  );
  const express = (await import("express")).default;
  const app = express();
  const port = Number(process.env.MCP_PORT ?? 3100);

  app.use(express.json());

  app.all("/mcp", async (req, res) => {
    const t = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => crypto.randomUUID(),
    });
    await server.connect(t);
    await t.handleRequest(req, res, req.body);
  });

  app.listen(port, () => {
    process.stderr.write(
      `[coxa-mcp] HTTP transport on http://localhost:${port}/mcp\n`,
    );
  });
} else {
  // Default: stdio (Cursor IDE, Claude Desktop)
  const stdioTransport = new StdioServerTransport();
  await server.connect(stdioTransport);
  process.stderr.write("[coxa-mcp] stdio transport ready\n");
}
