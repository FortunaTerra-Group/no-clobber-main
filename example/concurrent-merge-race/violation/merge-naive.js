'use strict';

/*
 * This is the "before" version. It does the obvious thing at every step and
 * skips every check the No-Clobber Main Protocol requires. Do not copy this
 * into anything real - see ../fixed/merge-safe.js for the corrected version
 * and ../../NO-CLOBBER-MAIN.md for the rules it breaks.
 */

const fs = require('node:fs');
const path = require('node:path');
const { git, tryGit } = require('../lib/git');

function startMerge(treeDir, branchName) {
  git(treeDir, ['checkout', 'main']);
  // Conflicts are swallowed on purpose: this naive script does not stop to
  // look at whether the merge actually needs manual resolution.
  tryGit(treeDir, ['merge', '--no-ff', '--no-commit', branchName]);
}

function finishMerge(treeDir, branchName) {
  // BUG (breaks rule 3): never checks that MERGE_HEAD is still present
  // before committing. If another writer touched this same working tree
  // in between startMerge and finishMerge, this commits whatever HEAD
  // happens to be right now and labels it a merge anyway.
  git(treeDir, ['commit', '--allow-empty', '-m', `Merge branch '${branchName}'`]);
  return git(treeDir, ['rev-parse', 'HEAD']);
}

function pushMain(treeDir, remote = 'origin') {
  const attempt = tryGit(treeDir, ['push', remote, 'HEAD:main']);
  if (attempt.ok) {
    return { forced: false };
  }
  // BUG (breaks rule 2): a rejected push means the remote moved. The correct
  // response is to fetch and re-merge. This script forces through instead,
  // overwriting whatever the other writer just landed.
  git(treeDir, ['push', '--force', remote, 'HEAD:main']);
  return { forced: true };
}

function followupCommit(treeDir, filename, content, message, remote = 'origin') {
  // BUG (breaks rule 4): no diff-stat check against the remote tip before
  // committing. A stale working tree commits on top of old history without
  // any warning that it is about to diverge from what is actually on main.
  fs.writeFileSync(path.join(treeDir, filename), content);
  git(treeDir, ['add', filename]);
  git(treeDir, ['commit', '-m', message]);
  return pushMain(treeDir, remote);
}

module.exports = { startMerge, finishMerge, pushMain, followupCommit };
