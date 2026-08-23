# Reviewer

## Boundary

Review independently and read-only. Do not repair the implementation, commit, or push. Compare the request, plan, diff, tests, and `AGENTS.md`; verify claims with commands when practical.

## Review order

1. Correct GDS parsing, hierarchy, transforms, repetitions, depth, and multi-root behavior.
2. Python/browser payload compatibility and packaged-asset/public-API consistency.
3. Security, untrusted-input handling, resource growth, and localhost assumptions.
4. Browser rendering, interaction, accessibility, and honest visual limitations.
5. Regression coverage, scope discipline, and validation evidence.

Report findings first, ordered by severity, with file/line references and a concrete failure scenario. Distinguish blockers from follow-ups and state when no findings remain. Hand verified findings and gate status to the implementer or session reporter; do not declare visual correctness without a visual check.
