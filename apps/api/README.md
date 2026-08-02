# API

To install dependencies:

```bash
pnpm install
```

To run:

```bash
pnpm dev
```

The existing synchronization API remains available at `/api/trpc`.

## Public API

The versioned HTTP API uses bearer-token authentication. Its first endpoint is:

```text
GET /api/v1/spaces/:spaceId/projects
```

The response contains the space's projects in display order. Interactive API
documentation powered by Scalar is served at `/api/docs`, and the raw OpenAPI
document is served at `/api/openapi.json`.

The hosted documentation is available at
[app.will-be-done.app/api/docs](https://app.will-be-done.app/api/docs). For a
self-hosted Docker deployment, open `/api/docs` on the server's base URL.

After changing a public route or schema, update and verify the committed API
contract with:

```bash
pnpm openapi:generate
pnpm openapi:check
```
