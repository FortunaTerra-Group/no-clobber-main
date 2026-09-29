# Run 2: fixed suite, RED then GREEN

The fixed suite is only worth trusting if it actually fails when the
checks it is supposed to exercise are missing. This is a real record of
that: the ancestry check in `finishMerge` and the diff-stat check in
`followupCommit` were commented out in `fixed/merge-safe.js`, the suite
was run and confirmed to fail, then the file was restored from a backup
and the suite was run again to confirm it passes.

## RED: checks disabled

Command:

```
node --test test/fixed.test.js
```

(run against a version of `fixed/merge-safe.js` with the `MERGE_HEAD`
check, the two-parent/ancestor check, and the diff-stat check commented
out - see the git history of this repo for the exact diff)

```
TAP version 13
...
# Subtest: fixed: refuses to finish a merge whose MERGE_HEAD was wiped by a concurrent writer, then succeeds from a fresh clone
not ok 1 - fixed: refuses to finish a merge whose MERGE_HEAD was wiped by a concurrent writer, then succeeds from a fresh clone
  ---
  duration_ms: 107.986321
  location: 'test/fixed.test.js:10:1'
  failureType: 'testCodeFailure'
  error: 'Missing expected exception: the fixed script refuses instead of committing over the wiped merge state'
  code: 'ERR_ASSERTION'
  name: 'AssertionError'
  expected:
  operator: 'throws'
  ...
# Subtest: fixed: refuses a stale follow-up commit instead of force-pushing over a concurrent merge
not ok 2 - fixed: refuses a stale follow-up commit instead of force-pushing over a concurrent merge
  ---
  duration_ms: 144.893736
  location: 'test/fixed.test.js:59:1'
  failureType: 'testCodeFailure'
  error: 'Missing expected exception: the fixed script refuses instead of committing on top of stale history'
  code: 'ERR_ASSERTION'
  name: 'AssertionError'
  expected:
  operator: 'throws'
  ...
1..2
# tests 2
# suites 0
# pass 0
# fail 2
# cancelled 0
# skipped 0
# todo 0
# duration_ms 298.146863
```

Both tests fail with `Missing expected exception` - exactly what should
happen when the code no longer refuses the unsafe operation. This confirms
the tests are actually exercising the checks, not passing regardless of
what the implementation does.

## GREEN: checks restored

`fixed/merge-safe.js` was restored to its committed version (the ancestry
check, the two-parent check, and the diff-stat check back in place).

Command:

```
node --test test/fixed.test.js
```

```
TAP version 13
# Cloning into '/tmp/no-clobber-main-P5UJD0/seed'...
# warning: You appear to have cloned an empty repository.
# done.
# To /tmp/no-clobber-main-P5UJD0/origin.git
#  * [new branch]      HEAD -> main
# Cloning into '/tmp/no-clobber-main-P5UJD0/feature-writer'...
# done.
# Switched to a new branch 'feature/widget-api'
# To /tmp/no-clobber-main-P5UJD0/origin.git
#  * [new branch]      feature/widget-api -> feature/widget-api
# Cloning into '/tmp/no-clobber-main-P5UJD0/shared-tree'...
# done.
# From /tmp/no-clobber-main-P5UJD0/origin
#  * [new branch]      feature/widget-api -> feature/widget-api
# Already on 'main'
# Automatic merge went well; stopped before committing as requested
# Cloning into '/tmp/no-clobber-main-P5UJD0/retry-tree'...
# done.
# From /tmp/no-clobber-main-P5UJD0/origin
#  * [new branch]      feature/widget-api -> feature/widget-api
# Already on 'main'
# Automatic merge went well; stopped before committing as requested
# To /tmp/no-clobber-main-P5UJD0/origin.git
#    4e383ca..57b65ad  HEAD -> main
# Cloning into '/tmp/no-clobber-main-CGqZ3p/seed'...
# warning: You appear to have cloned an empty repository.
# done.
# To /tmp/no-clobber-main-CGqZ3p/origin.git
#  * [new branch]      HEAD -> main
# Cloning into '/tmp/no-clobber-main-CGqZ3p/stale-writer'...
# done.
# Cloning into '/tmp/no-clobber-main-CGqZ3p/feature-writer-2'...
# done.
# Switched to a new branch 'feature/widget-checkout'
# Switched to branch 'main'
# To /tmp/no-clobber-main-CGqZ3p/origin.git
#    4e383ca..0fd4132  HEAD -> main
# From /tmp/no-clobber-main-CGqZ3p/origin
#  * branch            main       -> FETCH_HEAD
#    4e383ca..0fd4132  main       -> origin/main
# From /tmp/no-clobber-main-CGqZ3p/origin
#  * branch            main       -> FETCH_HEAD
# From /tmp/no-clobber-main-CGqZ3p/origin
#  * branch            main       -> FETCH_HEAD
# To /tmp/no-clobber-main-CGqZ3p/origin.git
#    0fd4132..c6bc9e8  HEAD -> main
# Subtest: fixed: refuses to finish a merge whose MERGE_HEAD was wiped by a concurrent writer, then succeeds from a fresh clone
ok 1 - fixed: refuses to finish a merge whose MERGE_HEAD was wiped by a concurrent writer, then succeeds from a fresh clone
  ---
  duration_ms: 137.993262
  ...
# Subtest: fixed: refuses a stale follow-up commit instead of force-pushing over a concurrent merge
ok 2 - fixed: refuses a stale follow-up commit instead of force-pushing over a concurrent merge
  ---
  duration_ms: 135.34782
  ...
1..2
# tests 2
# suites 0
# pass 2
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 321.808285
```

## Full suite, both variants together

```
$ npm test

> concurrent-merge-race@1.0.0 test
> node --test test/

...
1..4
# tests 4
# suites 0
# pass 4
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 318.439208
```

All four tests pass together: the violation suite proves the naive script
corrupts history under both races, and the fixed suite proves the same
races get caught and handled by re-syncing rather than corrupting.
