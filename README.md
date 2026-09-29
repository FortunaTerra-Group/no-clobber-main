# no-clobber-main

The No-Clobber Main Protocol: a rule for merging into a `main` branch that
multiple writers (human or AI agent) push to concurrently, without
silently dropping another writer's commits or reverting files it did not
touch.

Read the rule: [`NO-CLOBBER-MAIN.md`](NO-CLOBBER-MAIN.md).

## Why

Running several coding agents against the same repo at once means several
writers can land on `main` in the same few minutes. Merges done in a
shared working tree, or pushed with a force-through on rejection, can pass
every visual check and every test while quietly losing history underneath
them. This protocol is the fix: verify ancestry before trusting a merge,
never force a push, and check diff-stat before any follow-up commit.

## Examples

[`example/concurrent-merge-race/`](example/concurrent-merge-race/) is a
runnable demo built against real local git repos:

- `violation/` reproduces the failure modes with a naive merge script that
  skips every check.
- `fixed/` implements the same operations with the protocol's checks in
  place, and shows them catching the exact same race.

```
cd example/concurrent-merge-race
npm test
```

Captured output from real runs: [`RUN-1-violation.md`](RUN-1-violation.md)
(the naive script corrupting history under a race) and
[`RUN-2-fixed.md`](RUN-2-fixed.md) (the same race caught, plus a RED run
with the checks disabled to confirm the tests actually exercise them).
