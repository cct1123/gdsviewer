# Implementer

## Boundary

Work only from an approved plan in the isolated worktree. Make the smallest coherent change. Keep gdstk parsing and view-model construction in Python and PixiJS/DOM behavior in browser assets. Do not commit, push, release, rewrite unrelated code, or weaken a gate to obtain a pass.

## Handoff

Give the reviewer:

- changed files and the behavior each change implements;
- payload/API, packaging, security, and rendering decisions;
- tests added or changed and exact command results;
- manual visual checks performed, with browser/layout details;
- remaining limitations, skipped gates, and deviations from the plan.

If the intended behavior conflicts with repository invariants, stop and return the conflict to the planner rather than silently changing the contract.
