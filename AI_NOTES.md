# AI Notes

## Tools Used

- Claude Code (Opus 4.8)
- Web search and GitHub for verifying current documentation for TanStack Start, Cloudflare Workers, Browser Rendering, and Anthropic APIs.

## Useful Prompts

The most useful instructions were to design the architecture before implementation and to make each pipeline stage fail independently with a recorded reason instead of crashing the entire job.

## Where AI Helped

- Initial setup of Cloudflare Workers, D1, R2, and Browser Rendering
- Building the extraction pipeline and consistent error-handling patterns
- Migrating the HTTP layer after changing the framework
- Generating repetitive infrastructure and utility code

## Where AI Needed Correction

- The initial version was generated as a Hono + React SPA instead of the required TanStack Start application
- The first implementation marked too many results as partial
- Some user-facing messages about incomplete results were misleading
- Brand color extraction initially handled only inline CSS and was later extended to external stylesheets