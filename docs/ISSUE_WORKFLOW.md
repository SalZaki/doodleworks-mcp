# Issue workflow

All planned development on `doodleworks-mcp` is tracked through GitHub Issues. This document describes the hierarchy, the templates, the labels, and the conventions for parent linking.

## Hierarchy

```
Epic            — large body of work, usually a milestone or major capability area
 └─ Feature     — discrete user-/system-visible capability inside an Epic
     └─ User Story — one user-facing increment of a Feature, sized to a single PR
         └─ Sub-task   — atomic engineering work item inside a Story
```

Rules:

- Every non-Epic issue has exactly one parent at the level above.
- Stories and Sub-tasks should each be small enough to PR in one sitting.
- If a Sub-task is consistently taking more than a day, it was a Story in disguise — split it.
- If a Story keeps spawning new Stories instead of Sub-tasks, the parent was a Feature in disguise — promote it.

## Choosing a template

| When to file | Template |
|---|---|
| Adding a milestone-sized initiative spanning multiple Features | `Epic` (`.github/ISSUE_TEMPLATE/epic.yml`) |
| Adding a new MCP tool, resource, prompt, or major subsystem (engine, viewer, cache) | `Feature` (`feature.yml`) |
| Capturing a single end-user-visible increment of a Feature | `User Story` (`user-story.yml`) |
| Capturing one self-contained engineering task inside a Story | `Sub-task` (`sub-task.yml`) |
| Reporting a defect in shipped behaviour | `Bug report` (`bug_report.md`) |
| Suggesting a discrete improvement outside the planned roadmap | `Feature request` (`feature_request.md`) |

The four hierarchy templates are YAML forms with field validation. Bug report and feature request are the lighter markdown templates and remain for ad-hoc reports.

## Parent linking

Use **two complementary mechanisms** so the relationship is visible both in the GitHub UI and in plain markdown reads:

### 1. GitHub native sub-issues (UI-level, recommended)

When you create a child issue, attach it to its parent via the **Sub-issues** panel on the parent issue. This produces the proper parent-child UI navigation, a progress bar, and inherited filtering.

From the command line:

```bash
# Find the parent's GraphQL node ID
parent_id=$(gh api graphql -F query='
  query($owner:String!,$repo:String!,$number:Int!){
    repository(owner:$owner,name:$repo){
      issue(number:$number){ id }
    }
  }' -F owner=SalZaki -F repo=doodleworks-mcp -F number=<PARENT_NUMBER> --jq .data.repository.issue.id)

# Find the child's node ID the same way
child_id=$(gh api graphql -F query='...' --jq .data.repository.issue.id)

# Attach
gh api graphql -F query='
  mutation($parent:ID!,$child:ID!){
    addSubIssue(input:{issueId:$parent, subIssueId:$child}){
      issue{ number }
    }
  }' -F parent=$parent_id -F child=$child_id
```

### 2. Textual reference in the body

In the child's body, include a line of the form:

```
Parent Epic: #12
Parent Feature: #14
Parent Story: #17
```

This survives in markdown views (logs, exports, third-party dashboards) where the sub-issue API is invisible, and lets GitHub's issue cross-reference render the chain in the timeline.

## Title and naming convention

Match the existing house style:

| Type | Title format | Example |
|---|---|---|
| Epic | `[Epic] <Short Title>` | `[Epic] Personal-tier viewer — flip, regenerate, download` |
| Feature | `[Feature] <Short Title>` | `[Feature] regenerate_illustration in-place cache update` |
| User Story | `[User Story] As a <role>, I want <capability>` | `[User Story] As a host user, I want to download a single PNG from the viewer` |
| Sub-task | `[Task] <verb-led short description>` | `[Task] Wire get_illustration to the in-process LRU cache` |

Numbering (`[Epic 1]`, `[Feature 1.1]`, `[Story 1.1.1]`) is **optional** — useful when the roadmap is well-defined and you want stable references. Skip the numbers when issues are filed ad-hoc.

## Labels

Labels are applied automatically by the templates where the type is fixed. Apply additional labels on creation:

| Group | Labels | Notes |
|---|---|---|
| **Type** | `type:epic`, `type:feature`, `type:story`, `type:subtask` | Applied by the template — do not change after creation |
| **Priority** | `priority:critical`, `priority:high`, `priority:medium`, `priority:low` | Reflects business / engineering urgency |
| **Status** | `status:backlog`, `status:ready`, `status:in-progress`, `status:blocked`, `status:in-review` | Optional — GitHub Projects is the primary status surface |
| **Area** | `area:tool`, `area:resource`, `area:prompt`, `area:viewer`, `area:engine`, `area:cache`, `area:provider`, `area:server`, `area:tinku`, `area:docs`, `area:testing`, `area:ci` | Apply one or more per issue |
| **Milestone** | Use GitHub milestones | Track milestone-scoped work via the repo's Milestones, referenced from the Epic's `Roadmap reference` field |

Standard GitHub labels (`bug`, `documentation`, `enhancement`, `good first issue`, `help wanted`, `question`) remain available for ad-hoc reports.

## Acceptance criteria and Definition of Done

These are **separate**:

- **Acceptance criteria** — what the user / consumer can observe when the work is done. Phrased so a tester can verify them. Lives on Features and User Stories. Avoid words like "robust", "seamless", "intuitive" — they aren't testable.
- **Definition of Done** — engineering completeness gate: `pnpm test` passes, `pnpm run build` clean, README updated, etc. Templated with sensible defaults; tighten or relax per issue.

Both are checklists so progress is visible at a glance.

## Lifecycle

1. **File** — pick template, fill required fields, attach to parent (sub-issue + textual reference).
2. **Triage** — apply priority, area, milestone labels.
3. **Pick up** — move to `status:in-progress` (or assign in a Project). Work on a `<type>/<short-description>` branch, where `<type>` is a Conventional Commit type (`feat`, `fix`, `docs`, `chore`, …) — see [Branching in CONTRIBUTING.md](../CONTRIBUTING.md#branching).
4. **PR** — open with a title that clearly describes the change. Reference the issue in the PR body (`Closes #N`).
5. **Merge** — issue auto-closes via `Closes #N`. Children should already be closed; the Epic stays open until every Goal checkbox is ticked.

## Quality bar

- **No filler.** Avoid "seamlessly", "robust", "leverage", "ensure", "intuitive". They're untestable.
- **No fabricated requirements.** If the roadmap doesn't specify a detail, mark it **TBD** rather than inventing it.
- **Self-contained.** Anyone should be able to pick up any issue cold and have everything they need: links to source files / patterns to mirror, acceptance criteria, definition of done.
- **One PR per Story.** Sub-tasks are checklists or, when meaningful in their own right, separate issues that close in the same PR.

## Where the roadmap lives

There is no separate planning directory — the roadmap is tracked through **GitHub Milestones** and the Epic issues themselves. Reference the relevant milestone (or a `README.md` section) from each Epic's `Roadmap reference` field, and let the Epic's Goals checklist be the living record of progress.
