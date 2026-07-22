/**
 * EB process router — reads PROC_TYPE env var to decide which process to boot.
 *
 * Elastic Beanstalk always runs the "web:" line from Procfile.
 * Production EB uses PROC_TYPE=web (default) → cluster.js.
 *
 *   PROC_TYPE=web    (default) → backend/src/cluster.js  (N×server.js + MCP sidecar)
 *   PROC_TYPE=worker           → backend/src/worker.js   (BullMQ — local dev only)
 *   PROC_TYPE=mcp              → backend/src/mcp/server.js (MCP server only)
 *
 * FanBox routes are mounted on the main API at /api/v1/fanbox (same as retail, cdp, etc.).
 */
const { spawnSync } = require('child_process');

const PROC_TYPE = process.env.PROC_TYPE ?? 'web';

const scripts = {
  web:    'backend/src/cluster.js',
  worker: 'backend/src/worker.js',
  mcp:    'backend/src/mcp/server.js',
};

const target = scripts[PROC_TYPE];
if (!target) {
  console.error('[start] Unknown PROC_TYPE:', PROC_TYPE, '| valid: web, worker, mcp');
  process.exit(1);
}

console.log('[start] PROC_TYPE=' + PROC_TYPE + ' → ' + target);

const result = spawnSync(process.execPath, [target], {
  stdio: 'inherit',
  env: process.env,
});

process.exit(result.status ?? 0);
