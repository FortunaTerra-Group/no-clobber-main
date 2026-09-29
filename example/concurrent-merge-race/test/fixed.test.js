'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { git, writeFile, commit, cloneFrom, setupRace, cleanup } = require('../lib/fixtures');
const { isAncestor, parentCount } = require('../lib/git');
const safe = require('../fixed/merge-safe');

test('fixed: refuses to finish a merge whose MERGE_HEAD was wiped by a concurrent writer, then succeeds from a fresh clone', () => {
  const { root, bareDir } = setupRace();
  try {
    const featureDir = cloneFrom(bareDir, root, 'feature-writer');
    git(featureDir, ['checkout', '-b', 'feature/widget-api']);
    for (let i = 1; i <= 3; i++) {
      writeFile(featureDir, `widget-${i}.txt`, `widget ${i}\n`);
      commit(featureDir, `Add widget ${i}`);
    }
    git(featureDir, ['push', 'origin', 'feature/widget-api']);
    const featureTip = git(featureDir, ['rev-parse', 'feature/widget-api']);

    const sharedTree = cloneFrom(bareDir, root, 'shared-tree');
    git(sharedTree, ['fetch', 'origin', 'feature/widget-api:feature/widget-api']);

    safe.startMerge(sharedTree, 'feature/widget-api');

    // Same race as the violation test: a concurrent writer resets this tree mid-merge.
    git(sharedTree, ['reset', '--hard', 'origin/main']);

    assert.throws(
      () => safe.finishMerge(sharedTree, 'feature/widget-api'),
      /MERGE_HEAD is gone/,
      'the fixed script refuses instead of committing over the wiped merge state'
    );

    // Remote main is untouched by the failed attempt.
    const originTip = git(sharedTree, ['rev-parse', 'origin/main']);
    const seedTip = git(sharedTree, ['rev-parse', 'HEAD']);
    assert.equal(originTip, seedTip, 'origin/main was not corrupted by the refused attempt');

    // Correct remedy: retry in a fresh, dedicated clone instead of the shared tree.
    const retryTree = cloneFrom(bareDir, root, 'retry-tree');
    git(retryTree, ['fetch', 'origin', 'feature/widget-api:feature/widget-api']);
    safe.startMerge(retryTree, 'feature/widget-api');
    const mergeSha = safe.finishMerge(retryTree, 'feature/widget-api');
    safe.pushMain(retryTree);

    assert.equal(parentCount(retryTree, mergeSha), 2, 'the retried merge is a real 2-parent merge commit');
    assert.equal(
      isAncestor(retryTree, featureTip, mergeSha),
      true,
      'the feature branch is a real ancestor of the new main tip'
    );
  } finally {
    cleanup(root);
  }
});

test('fixed: refuses a stale follow-up commit instead of force-pushing over a concurrent merge', () => {
  const { root, bareDir } = setupRace();
  try {
    const staleDir = cloneFrom(bareDir, root, 'stale-writer');

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

    assert.throws(
      () => safe.followupCommit(staleDir, 'DOCS.md', 'small docs update\n', 'docs: small update'),
      /refusing to commit from a stale tree/,
      'the fixed script refuses instead of committing on top of stale history'
    );

    // Remote main still carries the concurrent merge untouched.
    git(staleDir, ['fetch', 'origin', 'main']);
    const tipAfterRefusal = git(staleDir, ['rev-parse', 'origin/main']);
    assert.equal(tipAfterRefusal, mergedTip, 'origin/main was not reverted by the refused attempt');

    // Correct remedy: sync first, then the commit succeeds and pushes without forcing.
    git(staleDir, ['merge', 'origin/main', '-m', 'Sync with origin/main']);
    const result = safe.followupCommit(staleDir, 'DOCS.md', 'small docs update\n', 'docs: small update');
    assert.equal(result.forced, false, 'no force-push was needed once the tree was synced');

    const lsTree = git(staleDir, ['ls-tree', '-r', '--name-only', 'HEAD']);
    assert.ok(lsTree.includes('checkout-1.txt'), 'the concurrent merge survives the follow-up commit');
    assert.ok(lsTree.includes('DOCS.md'), 'the follow-up commit itself landed');
  } finally {
    cleanup(root);
  }
});
