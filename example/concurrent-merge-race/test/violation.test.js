'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { git, writeFile, commit, cloneFrom, setupRace, cleanup } = require('../lib/fixtures');
const { isAncestor, parentCount } = require('../lib/git');
const naive = require('../violation/merge-naive');

test('violation: a concurrent reset on a shared tree mid-merge collapses history to a single parent', () => {
  const { root, bareDir } = setupRace();
  try {
    // Writer A prepares a feature branch with 3 commits and pushes the ref.
    const featureDir = cloneFrom(bareDir, root, 'feature-writer');
    git(featureDir, ['checkout', '-b', 'feature/widget-api']);
    for (let i = 1; i <= 3; i++) {
      writeFile(featureDir, `widget-${i}.txt`, `widget ${i}\n`);
      commit(featureDir, `Add widget ${i}`);
    }
    git(featureDir, ['push', 'origin', 'feature/widget-api']);
    const featureTip = git(featureDir, ['rev-parse', 'feature/widget-api']);

    // A shared tree: two writers operate in this exact same working directory.
    const sharedTree = cloneFrom(bareDir, root, 'shared-tree');
    git(sharedTree, ['fetch', 'origin', 'feature/widget-api:feature/widget-api']);

    // Writer A starts the merge but has not committed yet.
    naive.startMerge(sharedTree, 'feature/widget-api');
    assert.ok(
      fs.existsSync(path.join(sharedTree, '.git', 'MERGE_HEAD')),
      'merge should be in progress before the race hits'
    );

    // Writer B, using the SAME shared tree, resets it mid-merge.
    git(sharedTree, ['reset', '--hard', 'origin/main']);

    // Writer A's naive script finishes the merge anyway, unaware its state was wiped.
    const mergeSha = naive.finishMerge(sharedTree, 'feature/widget-api');
    naive.pushMain(sharedTree);

    assert.equal(
      parentCount(sharedTree, mergeSha),
      1,
      'the "merge" commit silently collapsed to a single parent'
    );
    assert.equal(
      isAncestor(sharedTree, featureTip, mergeSha),
      false,
      'feature branch history is unreachable from the new main tip - it is effectively lost'
    );
  } finally {
    cleanup(root);
  }
});

test('violation: a stale-tree follow-up commit gets force-pushed over a concurrent merge, reverting it', () => {
  const { root, bareDir } = setupRace();
  try {
    // Writer B clones early and will make a docs-only change later without re-syncing.
    const staleDir = cloneFrom(bareDir, root, 'stale-writer');

    // Writer A merges a 3-file feature into main in its own clone and pushes.
    const featureDir = cloneFrom(bareDir, root, 'feature-writer-2');
    git(featureDir, ['checkout', '-b', 'feature/widget-checkout']);
    for (let i = 1; i <= 3; i++) {
      writeFile(featureDir, `checkout-${i}.txt`, `checkout module ${i}\n`);
      commit(featureDir, `Add checkout module ${i}`);
    }
    git(featureDir, ['checkout', 'main']);
    git(featureDir, ['merge', '--no-ff', 'feature/widget-checkout', '-m', "Merge branch 'feature/widget-checkout'"]);
    git(featureDir, ['push', 'origin', 'HEAD:main']);
    const mergedTip = git(featureDir, ['rev-parse', 'HEAD']);

    // Writer B never pulled. Its naive follow-up commit lands on stale history.
    const result = naive.followupCommit(staleDir, 'DOCS.md', 'small docs update\n', 'docs: small update');
    assert.equal(result.forced, true, 'the naive script had to force-push because it never synced first');

    git(staleDir, ['fetch', 'origin', 'main']);
    const newTip = git(staleDir, ['rev-parse', 'origin/main']);

    assert.equal(
      isAncestor(staleDir, mergedTip, newTip),
      false,
      'the concurrent merge was silently reverted by the force-push'
    );

    const lsTree = git(staleDir, ['ls-tree', '-r', '--name-only', newTip]);
    assert.ok(!lsTree.includes('checkout-1.txt'), 'the checkout module files were reverted off main');
  } finally {
    cleanup(root);
  }
});
