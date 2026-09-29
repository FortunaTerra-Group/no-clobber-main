'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const TEST_ENV = {
  ...process.env,
  GIT_AUTHOR_NAME: 'Test Writer',
  GIT_AUTHOR_EMAIL: 'writer@example.test',
  GIT_COMMITTER_NAME: 'Test Writer',
  GIT_COMMITTER_EMAIL: 'writer@example.test',
};

function git(cwd, args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', env: TEST_ENV }).trim();
}

function mkTmpDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function writeFile(repoDir, filename, content) {
  const target = path.join(repoDir, filename);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
}

function commit(repoDir, message) {
  git(repoDir, ['add', '-A']);
  git(repoDir, ['commit', '-m', message]);
  return git(repoDir, ['rev-parse', 'HEAD']);
}

function cloneFrom(bareDir, root, name) {
  const dir = path.join(root, name);
  git(root, ['clone', bareDir, dir]);
  return dir;
}

/**
 * Builds a fresh bare "origin" repo with one seed commit on main, standing in
 * for a shared repo that multiple writers push to concurrently.
 */
function setupRace() {
  const root = mkTmpDir('no-clobber-main-');
  const bareDir = path.join(root, 'origin.git');
  git(root, ['init', '--bare', '--initial-branch=main', bareDir]);

  const seedDir = cloneFrom(bareDir, root, 'seed');
  writeFile(seedDir, 'README.md', '# widget-api\n\nShared repo, multiple writers push to main.\n');
  commit(seedDir, 'Initial commit');
  git(seedDir, ['push', 'origin', 'HEAD:main']);

  return { root, bareDir, seedDir };
}

function cleanup(root) {
  fs.rmSync(root, { recursive: true, force: true });
}

module.exports = { git, mkTmpDir, writeFile, commit, cloneFrom, setupRace, cleanup };
