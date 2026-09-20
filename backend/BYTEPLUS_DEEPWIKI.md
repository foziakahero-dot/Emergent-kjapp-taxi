# BytePlus ModelArk + DeepWiki MCP test

This experiment is isolated on the branch `feature/byteplus-deepwiki-mcp-test`.

## Backend secret

Set the real key only in the Emergent backend environment:

```env
BYTEPLUS_API_KEY=...
```

Optional overrides are documented in `backend/.env.byteplus.example`.

## KJAPP endpoint

`POST /api/admin/dev/deepwiki/repo-structure`

The endpoint is protected by KJAPP's existing `require_superadmin` guard and proxies
the BytePlus streaming response without exposing the API key to a browser/mobile app.

Example request after authenticating as superadmin:

```json
{
  "repository": "expressjs/express",
  "instruction": "check the repo structure"
}
```

The server sends the equivalent ModelArk payload with:

- model: `dola-seed-2-1-turbo-260628`
- `stream: true`
- MCP server label: `deepwiki`
- MCP URL: `https://mcp.deepwiki.com/mcp`
- `require_approval: never`
- header `ark-beta-mcp: true`

The response is streamed back as SSE.
