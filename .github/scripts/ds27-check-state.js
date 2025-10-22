const core = require('@actions/core');

const REQUIRED_DEFAULTS = [
  'docs-index-validate',
  'nfr-xref',
  'security-permissions-lint',
];

/**
 * Compare check runs by their most recent timestamp.
 * @param {object} current
 * @param {object} candidate
 * @returns {boolean}
 */
function isCandidateNewer(current, candidate) {
  if (!current) return true;
  const currentTime = timestampForSort(current);
  const candidateTime = timestampForSort(candidate);
  return candidateTime > currentTime;
}

function timestampForSort(run) {
  return Date.parse(run.completed_at || run.started_at || run.created_at || 0) || 0;
}

/**
 * Evaluate required check runs for a given ref.
 * @param {object} opts
 * @param {import('@actions/github').GitHub} opts.github
 * @param {string} opts.owner
 * @param {string} opts.repo
 * @param {string} opts.sha
 * @param {string[]} [opts.requiredChecks]
 */
async function evaluateChecks({ github, owner, repo, sha, requiredChecks = REQUIRED_DEFAULTS }) {
  if (!github) throw new Error('github client is required');
  if (!owner || !repo) throw new Error('owner and repo are required');
  if (!sha) throw new Error('sha is required');

  core.info(`DS-27: evaluating ${requiredChecks.length} checks for ${owner}/${repo}@${sha.substring(0, 7)}`);

  const runs = await github.paginate(github.rest.checks.listForRef, {
    owner,
    repo,
    ref: sha,
    per_page: 100,
  });

  core.info(`DS-27: retrieved ${runs.length} check runs (any status)`);

  const latestByName = new Map();

  for (const run of runs) {
    const name = run.name;
    if (!requiredChecks.includes(name)) continue;
    const current = latestByName.get(name);
    if (isCandidateNewer(current, run)) {
      latestByName.set(name, run);
    }
  }

  const result = {
    allSuccess: true,
    missing: [],
    pending: [],
    notSuccess: [],
    success: [],
    details: {},
  };

  for (const name of requiredChecks) {
    const run = latestByName.get(name);
    if (!run) {
      core.info(`DS-27: run missing for ${name}`);
      result.missing.push(name);
      result.details[name] = { status: 'missing' };
      result.allSuccess = false;
      continue;
    }

    const status = run.status;
    const conclusion = run.conclusion;
    result.details[name] = {
      status,
      conclusion,
      id: run.id,
      html_url: run.html_url,
      completed_at: run.completed_at,
    };

    if (status !== 'completed') {
      core.info(`DS-27: run pending for ${name} (status=${status})`);
      result.pending.push(name);
      result.allSuccess = false;
      continue;
    }

    if (conclusion === 'success') {
      result.success.push(name);
      continue;
    }

    core.info(`DS-27: run concluded ${conclusion || 'unknown'} for ${name}`);
    result.notSuccess.push(name);
    result.allSuccess = false;
  }

  core.info(`DS-27: summary => success=${result.success.length}, pending=${result.pending.length}, missing=${result.missing.length}, notSuccess=${result.notSuccess.length}`);

  return result;
}

module.exports = {
  evaluateChecks,
  REQUIRED_CHECKS: REQUIRED_DEFAULTS,
};
