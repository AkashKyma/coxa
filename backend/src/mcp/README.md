# Coxa MCP Server — POS Integration

The Coxa MCP server exposes **9 POS tools** so AI agents (Cursor, Claude Desktop, custom scripts) can interact with the Coxa Fan OS backend directly via the [Model Context Protocol](https://modelcontextprotocol.io).

---

## Available Tools

| Tool | Description |
|---|---|
| `pos_login` | Authenticate a POS operator → returns Bearer token |
| `pos_list_locations` | List retail/POS locations |
| `pos_get_catalog` | Get product catalog for a location |
| `pos_create_sale` | Complete a sale (deducts stock, returns saleId) |
| `pos_get_sale_qr_codes` | Get per-unit QR tokens for a completed sale |
| `pos_search_fan` | Find a fan by email or name |
| `pos_list_events` | List upcoming match events |
| `pos_issue_tickets` | Issue tickets at the box office |
| `pos_validate_qr` | Validate an entry QR at the gate |

---

## Prerequisites

1. The Coxa backend must be running (`npm run dev:backend` or production URL).
2. You need a valid POS operator account (created via Club Dashboard → Users).

---

## Setup: Cursor IDE (stdio transport)

Add the following to your project's `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "coxa-pos": {
      "command": "node",
      "args": ["backend/src/mcp/server.js"],
      "cwd": "${workspaceFolder}",
      "env": {
        "MCP_API_URL": "http://localhost:5000",
        "MCP_TENANT_ID": "coxa-club-001"
      }
    }
  }
}
```

Restart Cursor after saving. The tools will appear in the Agent tools panel.

**For a production backend**, replace `MCP_API_URL`:

```json
{
  "mcpServers": {
    "coxa-pos": {
      "command": "node",
      "args": ["backend/src/mcp/server.js"],
      "cwd": "${workspaceFolder}",
      "env": {
        "MCP_API_URL": "https://api.yourclub.com",
        "MCP_TENANT_ID": "coxa-club-001"
      }
    }
  }
}
```

---

## Setup: Claude Desktop (stdio transport)

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "coxa-pos": {
      "command": "node",
      "args": ["/absolute/path/to/coxa/backend/src/mcp/server.js"],
      "env": {
        "MCP_API_URL": "http://localhost:5000",
        "MCP_TENANT_ID": "coxa-club-001"
      }
    }
  }
}
```

---

## Setup: HTTP/SSE Transport (remote agents)

Start the MCP server in HTTP mode — exposes a `/mcp` endpoint instead of using stdin/stdout:

```bash
MCP_TRANSPORT=http MCP_PORT=3100 node backend/src/mcp/server.js
```

Connect any MCP-compatible client to `http://localhost:3100/mcp`.

**Production**: run this as a separate process alongside the API, or as its own EB/container deployment.

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `MCP_API_URL` | `http://localhost:5000` | Base URL of the Coxa backend |
| `MCP_TENANT_ID` | `coxa-club-001` | Tenant ID sent as `x-tenant-id` header |
| `MCP_TRANSPORT` | `stdio` | Transport mode: `stdio` or `http` |
| `MCP_PORT` | `3100` | HTTP port (only used when `MCP_TRANSPORT=http`) |

---

## Example Cursor Agent Session

```
User: List all locations and show the catalog for the first one

Agent uses: pos_login → pos_list_locations → pos_get_catalog(locationId)

User: Create a sale for 2x product SKU-001 at location LOC-123

Agent uses: pos_create_sale({ locationId: "LOC-123", lines: [{ skuId: "SKU-001", qty: 2 }] })

User: Validate this QR code at gate A: abc123def456

Agent uses: pos_validate_qr({ qrToken: "abc123def456", gateId: "gate-a", markUsed: true })
```

---

## Adding New Tools

1. Add a new tool object to `backend/src/mcp/tools/pos.js` following the existing pattern.
2. Each tool needs: `name`, `description`, `inputSchema` (JSON Schema), and an async `handler`.
3. The server auto-registers all tools exported from `tools/pos.js` — no changes to `server.js` needed.

---

## npm Script

```bash
# From repo root
npm run mcp

# Or directly from backend folder
cd backend
npm run start:mcp
```
