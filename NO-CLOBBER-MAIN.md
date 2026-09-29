# No-Clobber Main Protocol

A rule for merging into a `main` branch that more than one writer (human or
AI agent) is pushing to at the same time. The goal is simple: a merge to a
contested main must never silently drop another writer's commits or revert
files it did not touch.

"Looked right" is not the bar. A file tree can look correct and the tests
can pass while the actual git history underneath it has already been
corrupted. The rules below exist to check the thing that visual inspection
and green tests do not check: ancestry.

## The four rules

**1. Land via a dedicated, freshly synced working tree.**
Never resolve or commit a merge inside a working tree that another writer
is actively driving. Merge-in-progress state (`MERGE_HEAD`, the index, the
in-flight commit message) lives in that tree's shared `.git` directory. If
a second writer runs a `checkout` or `reset` in the same tree while a merge
is in progress, the first writer's merge state is gone with no error and no
warning. Give every merge attempt its own clone or worktree, synced to the
current remote tip right before you start.

**2. Push atomically. Never force.**
Push with `git push origin HEAD:main`, not a force-push and not a local ref
overwrite. An atomic push rejects when the remote has moved since you last
synced. That rejection is the correct signal to re-fetch, re-merge the new
tip, and retry. Forcing through instead means overwriting whatever the
remote received in the meantime, which is exactly the failure this rule
exists to prevent.

**3. Verify merge ancestry before you trust it.**
After a merge commit is made, check two things before you push it: the
commit has two parents, and the branch you just merged is an ancestor of
the new tip. A "merge" commit with one parent means the merge never
actually happened, no matter what the commit message says or how clean the
working tree looks.

**4. Check diff-stat before any follow-up commit.**
Before committing anything on top of a branch that recently received a
merge, diff your local HEAD against the remote tip. An unexpectedly large
diff, unrelated files, or a pile of deletions you did not make means your
working tree predates a merge it has not picked up yet. Stop and sync
first. Do not commit from a stale tree and push over what just landed.

## Why this exists

**Scenario 1: the orphaned merge.**
Two processes shared one working tree against a repo called `widget-api`.
Writer A started a merge of a long-running feature branch, thirty-plus
commits deep, and paused before committing. Writer B, working in the exact
same tree, ran a `reset --hard` to get back to a known state for an
unrelated check. That reset silently cleared writer A's `MERGE_HEAD`.
Writer A's script did not check for that. It committed anyway, using
`--allow-empty` so the commit would go through no matter what was staged,
and pushed. The resulting commit had one parent. It carried a message that
said "Merge branch," a clean working tree, and passing tests, because
nothing in it was actually wrong on its own. What was wrong was invisible:
the feature branch's entire commit history was no longer reachable from
`main`. It still existed as dangling commits until garbage collection took
it, but `main` no longer told anyone it had ever been there.

**Scenario 2: the reverted release.**
A second writer cloned `widget-api` early in the day and made no further
changes to that clone for a while. Later, a feature branch merged cleanly
into `main` through a proper, isolated flow and landed three new files.
The second writer, still sitting on their stale clone, made what looked
like a trivial docs edit and tried to push. The push was rejected, because
the remote had moved. The script's recovery from that rejection was to
force-push. That overwrote `main` with the stale writer's branch, which
did not contain the feature merge at all. The three new files vanished
from `main`, along with the merge commit that had added them. The docs
edit landed. Nothing in the diff of that one commit looked suspicious;
the damage was in what the force-push discarded, not in what it added.

Both of these passed visual inspection. Both had green tests going in.
Neither would have happened if the process checked parent count and
ancestry before trusting a merge, or checked diff-stat and used a real
retry instead of forcing a rejected push.

## Applying it

The rules are enforcement-agnostic. You can run them as manual checklist
items, as a pre-push git hook, or as a small library your merge tooling
calls before every push to a shared branch. The `example/` directory in
this repo has both a version that skips all four rules and a version that
implements them, with tests against real local git repos that reproduce
both scenarios above.
