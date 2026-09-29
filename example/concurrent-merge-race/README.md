# concurrent-merge-race

A runnable demo of the No-Clobber Main Protocol. It uses real local git
repos as fixtures, not mocks, because this is a git-safety tool and real
git behavior is the whole point.

## Layout

- `lib/git.js` - thin wrapper around git, one function per call, always an
  argv array, never a shell string.
- `lib/fixtures.js` - builds a bare "origin" repo plus clones for each test.
- `violation/merge-naive.js` - a merge/push helper that skips every check
  the protocol requires.
- `fixed/merge-safe.js` - the same helper, with ancestry and diff-stat
  checks added.
- `test/violation.test.js` - reproduces both incidents from
  `../../NO-CLOBBER-MAIN.md` against the naive helper and asserts the
  corruption actually happens.
- `test/fixed.test.js` - runs the same races against the fixed helper and
  asserts it refuses instead of corrupting history, then shows the correct
  remedy (retry from a fresh clone; sync before committing) succeeding.

## Run it

```
npm test
```

Runs both suites with Node's built-in test runner (`node --test`). No
build step, no network access beyond local file-path git remotes.

To run one suite at a time:

```
node --test test/violation.test.js
node --test test/fixed.test.js
```

## What the tests actually check

Both suites spin up a bare repo as a stand-in for a shared `main`, then
drive real `git` commands against real clones and working trees. Nothing
is mocked or stubbed. The assertions check parent count
(`git rev-list --parents`), ancestry (`git merge-base --is-ancestor`), and
tree contents (`git ls-tree`) on the actual resulting commits, not on
anything the scripts report about themselves.

See `../../RUN-1-violation.md` and `../../RUN-2-fixed.md` for captured
output from real runs, including a RED run of the fixed suite with its
checks temporarily disabled.
