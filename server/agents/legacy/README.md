# Legacy Agents Modules

This directory stores historical implementations preserved for reference and rollback.

Rules:

1. Files under `server/agents/legacy/**` are not part of production runtime.
2. Active runtime modules must not import from `legacy`.
3. Any future migration should copy required logic into active modules and keep legacy read-only.
