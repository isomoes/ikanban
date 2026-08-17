# Project MCP source package

This is a private build-time workspace. Its runtime is shipped from the public
`@isomoes/dsh-ikanban/project-mcp` export.

It loads MCP servers declared by a session workspace's `.mcp.json` before that
agent's first model request. The supported shape matches common project MCP
configuration:

```json
{
  "mcpServers": {
    "example": {
      "command": "npx",
      "args": ["-y", "example-mcp"]
    }
  }
}
```

A server with `command` uses stdio. A server with `url` uses Streamable HTTP
and may set `type` to `http` or `streamable-http`. Optional `env`, `headers`,
`cwd`, and `disabled` fields are supported. Relative server working directories
resolve from the workspace containing `.mcp.json`.

Mount the package as a loose row in an opt-in agent preset, beside that preset's
`skill-filesystem` and `tool-skill` rows. Like the filesystem skill provider, one
standing preset instance serves every agent joined to that preset and resolves
workspace-sensitive data from each event's agent. On `agent/pre-step`, this
plugin reads that agent's exact session cwd and creates MCP clients through the
agent-scoped Cordis context. Tools from one workspace are therefore not visible
in another agent, and each client is disposed with its agent.

The published preset fragment is available as
`@isomoes/dsh-ikanban/project-mcp.preset.yml`. Do not mount this plugin in the
host composition: a repository-controlled stdio command is an explicit trust
decision.
