### Type of change

- [ ] Feature (new MCP tool, prompt, resource, or viewer capability)
- [ ] Bug fix
- [ ] Documentation
- [ ] Enhancement / refactor
- [ ] Build / CI / tooling
- [ ] Other (describe below)

### What's in this PR

A clear and concise description of the change and why it's needed.

### Related issues

<!-- Link the issue(s) this PR closes. Follow the hierarchy Epic → Feature → User Story → Sub-task; see docs/ISSUE_WORKFLOW.md -->

Closes #

### How it was tested

<!-- The commands you ran and what you observed. -->

- [ ] `pnpm test` (typecheck + node test runner)
- [ ] `pnpm run build` (tsc + server typecheck + viewer bundle)
- [ ] `pnpm run check:tinku` (if the Tinku spec/character was touched)
- [ ] Manually verified in an MCP host — note the host and image provider (OpenAI / Gemini)

### Checklist

- [ ] Linked the relevant issue(s) above (`Closes #N`)
- [ ] Added/updated unit tests covering the change
- [ ] `pnpm test` passes
- [ ] `pnpm run build` is clean — no new TypeScript errors/warnings, viewer bundle rebuilt
- [ ] Updated the README / `docs/` where user-visible behaviour changed
- [ ] No API keys, secrets, or raw image bytes committed to source or fixtures
