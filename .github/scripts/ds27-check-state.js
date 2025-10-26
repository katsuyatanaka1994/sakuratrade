// actions/core may not be available when invoked via actions/github-script.
// Fallback to console so this module is self-contained.
let core;
try {
  core = require('@actions/core');
} catch (_) {
  core = {
    info: (...a) => console.log(...a),
    warning: (...a) => console.warn(...a),
    setOutput: () => {},
  };
}

const REQUIRED_DEFAULTS = [
  'docs-index-validate',
  'nfr-xref',
];

const RETRIABLE_STATUSES = new Set([403, 429, 502, 503]);
const DEFAULT_ATTEMPTS = 4;

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

  const REQUIRED = requiredChecks
    .map((s) => (s || '').toLowerCase().trim())
    .filter(Boolean);

  core.info(`DS-27: evaluating ${REQUIRED.length} checks for ${owner}/${repo}@${sha.substring(0, 7)}`);

  const runs = await withRetry(() => github.paginate(github.rest.checks.listForRef, {
    owner,
    repo,
    ref: sha,
    per_page: 100,
  }), DEFAULT_ATTEMPTS);

  core.info(`DS-27: retrieved ${runs.length} check runs (any status)`);

  const latestByName = new Map();

  const classifyPriority = (run) => {
    if (!run) return Number.POSITIVE_INFINITY;
    if (run.status !== 'completed') {
      return 1; // pending or in progress should block success
    }

    const conclusion = (run.conclusion || '').toLowerCase();
    if (['failure', 'timed_out', 'cancelled', 'action_required'].includes(conclusion)) {
      return 0; // any failure-like conclusion is highest priority
    }

    if (conclusion === 'success') {
      return 2; // success is lowest priority (best outcome)
    }

    return 1; // neutral / skipped / other keep the label
  };

  const resolveSuiteId = (run) => run?.check_suite?.id || run?.check_suite?.url || run?.id;

  for (const run of runs) {
    if (!run?.name) continue;

    const normalizedName = (run.name || '').trim().toLowerCase();
    const workflowName = normalizedName.split(' / ')[0] || normalizedName;
    if (!REQUIRED.includes(workflowName)) continue;

    const priority = classifyPriority(run);
    const suiteId = resolveSuiteId(run);
    const current = latestByName.get(workflowName);

    if (!current) {
      latestByName.set(workflowName, { run, priority, suiteId });
      continue;
    }

    if (current.suiteId !== suiteId) {
      if (isCandidateNewer(current.run, run)) {
        latestByName.set(workflowName, { run, priority, suiteId });
      }
      continue;
    }

    if (priority < current.priority || (priority === current.priority && isCandidateNewer(current.run, run))) {
      latestByName.set(workflowName, { run, priority, suiteId });
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

  for (const name of REQUIRED) {
    const entry = latestByName.get(name);
    if (!entry) {
      core.info(`DS-27: run missing for ${name}`);
      result.missing.push(name);
      result.details[name] = { status: 'missing' };
      result.allSuccess = false;
      continue;
    }

    const { run, priority } = entry;
    const status = run.status;
    const conclusion = run.conclusion;
    result.details[name] = {
      status,
      conclusion,
      id: run.id,
      html_url: run.html_url,
      completed_at: run.completed_at,
    };

    if (priority === 2 && (conclusion || '').toLowerCase() === 'success') {
      result.success.push(name);
      continue;
    }

    if (priority === 1) {
      core.info(`DS-27: run pending for ${name} (status=${status})`);
      result.pending.push(name);
      result.allSuccess = false;
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

async function withRetry(fn, attempts = DEFAULT_ATTEMPTS) {
  let delay = 500;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      const status = error?.status;
      const retriable = RETRIABLE_STATUSES.has(status);
      if (!retriable || attempt === attempts - 1) {
        throw error;
      }
      core.warning(`DS-27: retryable checks API failure (status=${status || 'unknown'}); retrying in ${delay}ms`);
      await sleep(delay);
      delay *= 2;
    }
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
