'use strict';

const { execFileSync } = require('node:child_process');

/**
 * Every git invocation in this example goes through this one function, and
 * every call site passes a fixed argv array. Nothing here is ever built by
 * concatenating a path or branch name into a shell string. A branch or file
 * name containing spaces, quotes, or shell metacharacters is passed through
 * untouched instead of being interpreted.
 */
function git(cwd, args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

function tryGit(cwd, args) {
  try {
    return { ok: true, output: git(cwd, args) };
  } catch (err) {
    return { ok: false, error: err };
  }
}

function mergeHeadExists(cwd) {
  const result = tryGit(cwd, ['rev-parse', '-q', '--verify', 'MERGE_HEAD']);
  return result.ok;
}

function parentCount(cwd, sha) {
  const line = git(cwd, ['rev-list', '--parents', '-n', '1', sha]);
  const parts = line.split(' ').filter(Boolean);
  return parts.length - 1;
}

function isAncestor(cwd, ancestorSha, tipSha) {
  const result = tryGit(cwd, ['merge-base', '--is-ancestor', ancestorSha, tipSha]);
  return result.ok;
}

module.exports = { git, tryGit, mergeHeadExists, parentCount, isAncestor };
