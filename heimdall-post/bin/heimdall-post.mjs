#!/usr/bin/env node
/**
 * Utan argument: MCP-servern över stdio – det AI-klienten startar.
 * setup, status, logout: installationen i terminalen.
 */
const [kommando, ...args] = process.argv.slice(2)
if (!kommando) {
  const { startaServer } = await import('../server.mjs')
  await startaServer()
} else {
  const { cli } = await import('../setup.mjs')
  await cli(kommando, args)
}
