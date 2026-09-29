'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { git, tryGit, mergeHeadExists, parentCount, isAncestor } = require('../lib/git');

const DEFAULT_MAX_RETRIES = 3;

class NoClobberError extends Error {}

function startMerge(treeDir, branchName) {
  git(treeDir, ['checkout', 'main']);
  tryGit(treeDir, ['merge', '--no-ff', '--no-commit', branchName]);
}

/**
 * Rule 3: verify merge ancestry before trusting it.
 *
 * Refuses to commit if MERGE_HEAD is gone (another writer touched this same
 * working tree mid-merge), and refuses to push a "merge" that does not
 * actually carry two parents with the feature branch as an ancestor of the
 * new tip. The caller's job on a thrown NoClobberError is to retry from a
 * fresh clone, not to force anything through.
 */
function finishMerge(treeDir, branchName) {
  if (!mergeHeadExists(treeDir)) {
    throw new NoClobberError(
      `refusing to commit: MERGE_HEAD is gone for '${branchName}'. ` +
        'This working tree was mutated by another writer mid-merge. ' +
        'Retry the merge in a fresh clone instead of committing here.'
    );
  }

  const branchTip = git(treeDir, ['rev-parse', branchName]);
  git(treeDir, ['commit', '-m', `Merge branch '${branchName}'`]);
  const mergeSha = git(treeDir, ['rev-parse', 'HEAD']);

  const parents = parentCount(treeDir, mergeSha);
  if (parents !== 2) {
    throw new NoClobberError(
      `refusing to push ${mergeSha}: expected a 2-parent merge commit, found ${parents}.`
    );
  }

  if (!isAncestor(treeDir, branchTip, mergeSha)) {
    throw new NoClobberError(
      `refusing to push ${mergeSha}: '${branchName}' (${branchTip}) is not an ancestor of the new tip. ` +
        'The branch history did not actually land.'
    );
  }

  return mergeSha;
}

/**
 * Rule 2: push atomically, never force. A rejected push means the remote
 * moved since this tree last synced. Fetch, re-merge the newest tip, and
 * retry - up to maxRetries times - rather than overwriting the remote ref.
 */
function pushMain(treeDir, remote = 'origin', maxRetries = DEFAULT_MAX_RETRIES) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const push = tryGit(treeDir, ['push', remote, 'HEAD:main']);
    if (push.ok) {
      return { forced: false, attempts: attempt + 1 };
    }

    if (attempt === maxRetries) {
      throw new NoClobberError(
        `refusing to force-push after ${attempt + 1} attempt(s); ` +
          `'${remote}/main' keeps moving and could not be safely reconciled.`
      );
    }

    git(treeDir, ['fetch', remote, 'main']);
    git(treeDir, ['merge', `${remote}/main`, '-m', 'Re-sync with remote main before retrying push']);
  }

  // Unreachable, but keeps the function's return type honest.
  throw new NoClobberError('push retry loop exited without a result');
}

/**
 * Rule 4: check diff-stat before any follow-up commit. If this tree's HEAD
 * is behind the remote tip, committing here would sit on stale history and
 * risks reverting whatever landed since this tree last synced. Refuse and
 * tell the caller to sync first instead of committing blind.
 */
function followupCommit(treeDir, filename, content, message, remote = 'origin') {
  git(treeDir, ['fetch', remote, 'main']);
  const localHead = git(treeDir, ['rev-parse', 'HEAD']);
  const remoteTip = git(treeDir, ['rev-parse', `${remote}/main`]);

  if (localHead !== remoteTip) {
    const stat = git(treeDir, ['diff', '--stat', localHead, remoteTip]);
    throw new NoClobberError(
      `refusing to commit from a stale tree: local HEAD (${localHead}) is behind ` +
        `${remote}/main (${remoteTip}).\n${stat}\n` +
        'Sync first (fetch + merge or rebase onto the remote tip) before committing.'
    );
  }

  fs.writeFileSync(path.join(treeDir, filename), content);
  git(treeDir, ['add', filename]);
  git(treeDir, ['commit', '-m', message]);
  return pushMain(treeDir, remote);
}

module.exports = { NoClobberError, startMerge, finishMerge, pushMain, followupCommit };
