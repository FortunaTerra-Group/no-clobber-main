# Run 1: violation suite

Command:

```
cd example/concurrent-merge-race
node --test test/violation.test.js
```

Real output from an actual run against real local git repos (git's own
progress and hint lines included, unedited):

```
TAP version 13
# Cloning into '/tmp/no-clobber-main-pmWb88/seed'...
# warning: You appear to have cloned an empty repository.
# done.
# To /tmp/no-clobber-main-pmWb88/origin.git
#  * [new branch]      HEAD -> main
# Cloning into '/tmp/no-clobber-main-pmWb88/feature-writer'...
# done.
# Switched to a new branch 'feature/widget-api'
# To /tmp/no-clobber-main-pmWb88/origin.git
#  * [new branch]      feature/widget-api -> feature/widget-api
# Cloning into '/tmp/no-clobber-main-pmWb88/shared-tree'...
# done.
# From /tmp/no-clobber-main-pmWb88/origin
#  * [new branch]      feature/widget-api -> feature/widget-api
# Already on 'main'
# Automatic merge went well; stopped before committing as requested
# To /tmp/no-clobber-main-pmWb88/origin.git
#    204c3fb..aaaa8d1  HEAD -> main
# Cloning into '/tmp/no-clobber-main-ZHijy1/seed'...
# warning: You appear to have cloned an empty repository.
# done.
# To /tmp/no-clobber-main-ZHijy1/origin.git
#  * [new branch]      HEAD -> main
# Cloning into '/tmp/no-clobber-main-ZHijy1/stale-writer'...
# done.
# Cloning into '/tmp/no-clobber-main-ZHijy1/feature-writer-2'...
# done.
# Switched to a new branch 'feature/widget-checkout'
# Switched to branch 'main'
# To /tmp/no-clobber-main-ZHijy1/origin.git
#    204c3fb..c3bd745  HEAD -> main
# To /tmp/no-clobber-main-ZHijy1/origin.git
#  ! [rejected]        HEAD -> main (fetch first)
# error: failed to push some refs to '/tmp/no-clobber-main-ZHijy1/origin.git'
# hint: Updates were rejected because the remote contains work that you do
# hint: not have locally. This is usually caused by another repository pushing
# hint: to the same ref. You may want to first integrate the remote changes
# hint: (e.g., 'git pull ...') before pushing again.
# hint: See the 'Note about fast-forwards' in 'git push --help' for details.
# To /tmp/no-clobber-main-ZHijy1/origin.git
#  + c3bd745...a2eb729 HEAD -> main (forced update)
# From /tmp/no-clobber-main-ZHijy1/origin
#  * branch            main       -> FETCH_HEAD
# fatal: Not a valid commit name c3bd745642aa1cf521974a6ab68c57528aea91f0
# Subtest: violation: a concurrent reset on a shared tree mid-merge collapses history to a single parent
ok 1 - violation: a concurrent reset on a shared tree mid-merge collapses history to a single parent
  ---
  duration_ms: 115.408836
  ...
# Subtest: violation: a stale-tree follow-up commit gets force-pushed over a concurrent merge, reverting it
ok 2 - violation: a stale-tree follow-up commit gets force-pushed over a concurrent merge, reverting it
  ---
  duration_ms: 115.458156
  ...
1..2
# tests 2
# suites 0
# pass 2
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 277.596038
```

## Reading this output

- `Automatic merge went well; stopped before committing as requested` is
  the naive script's `startMerge` step pausing with `--no-commit`, right
  before the concurrent `reset --hard` wipes `MERGE_HEAD` out from under it.
  The test then asserts the resulting commit has one parent and that the
  feature branch is not an ancestor of the new tip - both true.
- `! [rejected] HEAD -> main (fetch first)` followed by
  `+ ... (forced update)` is the naive script's push helper hitting a
  normal, correct git rejection (the remote moved) and then forcing past
  it anyway. That force-push is the entire bug in scenario 2.
- The `fatal: Not a valid commit name ...` line is git failing an
  `is-ancestor` check on a commit the local clone never fetched; the test
  catches that failure and treats it as "not an ancestor," which is the
  correct interpretation here.

Both tests pass because they assert that the naive script produces the
broken outcome - this is the RED case for the pattern the fixed script
closes, not a passing safety guarantee.
