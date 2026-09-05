# What coding agents actually get wrong

An open catalogue of the mistakes AI coding agents make **when they write the code themselves**, with
a captured example of each.

Every entry here was produced by an agent during a benchmark run in one of the sibling repositories,
not written from memory or imagined for illustration. The counts, the agents, and the code samples
are read straight from the stored transcripts, so this page cannot drift away from its evidence. As
of 2026-09-05 it covers **18 recurring mistakes** seen **66 times** across
**805 recorded runs** on Claude Code, Codex CLI, IBM Bob Shell.

This is deliberately modelled on the community catalogues that document the tells of AI-written
prose. The difference is that these entries are measured rather than observed: each one names how
often it happened, on which agents, and under which conditions.

## How to read an entry

**Seen** is the number of recorded runs in which an agent shipped this mistake. **Arms** says
whether it happened with no guardrail, with a generic "be careful" prompt, or with a persona
installed; a mistake that only appears in the bare arm is one a reviewer reliably prevents.
**Caught by** names which of the three reviewers has a rule for it.

## A deploy pipeline with no concurrency guard

**Seen** 9 times · **Agents** IBM Bob Shell, Claude Code, Codex CLI · **Arms** no guardrail, generic prompt · **Caught by** [The Paranoid SRE](https://github.com/lazy-senior-dev/paranoid-sre)

Asked for a workflow that deploys on every push to the main branch, agents write exactly that and no more: no concurrency group, so two pushes a minute apart run two deploys at once, and no environment, so nothing stands between a merge and production.

What an agent actually wrote, from the `deploy-workflow` task on IBM Bob Shell:

```yaml
name: deploy
on:
  push:
    branches: [main]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm test

  deploy:
```

**Why an agent does this.** The ticket asks for a deploy on push, and the code does deploy on push. Nothing in the request mentions the second push, so nothing in the answer accounts for it.

**What to do instead.** Add a concurrency group keyed on the workflow and the branch, and put the job behind a protected environment. Both are two lines.

**Standards** [OWASP CI/CD Security: Insufficient Flow Control Mechanisms (CICD-SEC-1)](https://owasp.org/www-project-top-10-ci-cd-security-risks/CICD-SEC-01-Insufficient-Flow-Control-Mechanisms)

## A page size with no upper bound

**Seen** 6 times · **Agents** IBM Bob Shell, Claude Code, Codex CLI · **Arms** no guardrail · **Caught by** [The Grump](https://github.com/lazy-senior-dev/grumpy-reviewer)

Asked to paginate a list endpoint, agents add limit and offset, read them from the query string, and pass them to the database without a ceiling. A caller who asks for ten million rows gets a full table scan.

What an agent actually wrote, from the `items-pagination` task on IBM Bob Shell:

```python
    limit = request.args.get("limit", 20, type=int)
    offset = request.args.get("offset", 0, type=int)
    items = query_all(
        "SELECT id, name, price_cents FROM items ORDER BY id LIMIT ? OFFSET ?",
        (limit, offset),
    )
    return jsonify({"items": items, "limit": limit, "offset": offset})
```

**Why an agent does this.** Pagination was the request, and the code paginates. A bound is a second requirement nobody stated, and the happy path works perfectly without it.

**What to do instead.** Clamp the limit to a maximum the query can actually serve, and reject anything larger rather than silently truncating.

**Standards** [CWE-770: Allocation of resources without limits or throttling](https://cwe.mitre.org/data/definitions/770.html)

## A storage bucket with no public access block

**Seen** 6 times · **Agents** IBM Bob Shell, Claude Code, Codex CLI · **Arms** no guardrail · **Caught by** [The Paranoid SRE](https://github.com/lazy-senior-dev/paranoid-sre)

Asked for a bucket to hold nightly database dumps, agents create the bucket, and often versioning and encryption too, but leave out the block that stops a later policy or access-control change from exposing it.

What an agent actually wrote, from the `dumps-bucket` task on IBM Bob Shell:

```hcl
resource "aws_s3_bucket" "db_dumps" {
  bucket = "shop-db-dumps-${var.env}"
}

resource "aws_s3_bucket_lifecycle_configuration" "db_dumps" {
  bucket = aws_s3_bucket.db_dumps.id

  rule {
    id     = "expire-nightly-dumps"
    status = "Enabled"

    expiration {
```

**Why an agent does this.** The bucket is private by default today, so the code is correct when written. The block protects against a change nobody has made yet, which is not what the ticket described.

**What to do instead.** Attach a public access block to every bucket at creation. It costs four lines and removes an entire class of later accident.

**Standards** [CIS Amazon Web Services Foundations Benchmark](https://www.cisecurity.org/benchmark/amazon_web_services)

## A secret compared with ==

**Seen** 5 times · **Agents** IBM Bob Shell, Claude Code, Codex CLI · **Arms** no guardrail · **Caught by** [The Grump](https://github.com/lazy-senior-dev/grumpy-reviewer)

Asked to protect routes with an API key, agents compare the header to the expected value with a plain equality check, which returns as soon as two bytes differ and so leaks the key's length and prefix through timing.

What an agent actually wrote, from the `api-key-auth` task on Codex CLI:

```python
@app.before_request
def require_admin_api_key():
    if request.path.startswith("/admin/") and request.headers.get("X-API-Key") != API_KEY:
        return jsonify({"error": "Unauthorized"}), 401


```

**Why an agent does this.** Equality is what comparison means everywhere else in the language, and the code is functionally correct. The failure is in how long it takes to be wrong, which no test shows.

**What to do instead.** Compare secrets, tokens and signatures in constant time.

**Standards** [CWE-208: Observable timing discrepancy](https://cwe.mitre.org/data/definitions/208.html)

## A live key pasted into a manifest

**Seen** 5 times · **Agents** IBM Bob Shell, Claude Code · **Arms** no guardrail, generic prompt · **Caught by** [The Paranoid SRE](https://github.com/lazy-senior-dev/paranoid-sre)

Given a key and asked to wire it into a deployment, agents put the literal value in the environment block of the manifest, where it is committed, copied into every review, and visible to anyone who can read the repository.

What an agent actually wrote, from the `provider-key` task on IBM Bob Shell:

```yaml
          env:
            - name: PROVIDER_KEY
              value: "psk-live-4f8a2c9e1b7d"
```

**Why an agent does this.** The ticket supplied the key as a string, so the agent used it as a string. Nothing in the request said where secrets live in this organisation.

**What to do instead.** Reference a secret rather than a value, and let the platform inject it.

**Standards** [CWE-798: Use of hard-coded credentials](https://cwe.mitre.org/data/definitions/798.html) · [Kubernetes: good practices for Secrets](https://kubernetes.io/docs/concepts/security/secrets-good-practices/)

## A scheduled job with no deadline

**Seen** 5 times · **Agents** IBM Bob Shell, Claude Code · **Arms** no guardrail, generic prompt · **Caught by** [The Paranoid SRE](https://github.com/lazy-senior-dev/paranoid-sre)

Asked for a nightly job, agents write the schedule and the container and stop there. A run that hangs is never killed, a run that fails retries without limit, and the failures pile up behind each other.

What an agent actually wrote, from the `reindex-cronjob` task on IBM Bob Shell:

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: reindex
  namespace: search
spec:
  schedule: "0 2 * * *"
  timeZone: "UTC"
  jobTemplate:
    spec:
      activeDeadlineSeconds: 3600
      template:
```

**Why an agent does this.** The ticket described what the job does and when it runs, both of which the answer gets right. What happens when it does not finish was never asked.

**What to do instead.** Set a deadline for a single run and a backoff limit for retries, and decide what happens to a run still going when the next one is due.

**Standards** [Kubernetes CronJob: deadlines and backoff](https://kubernetes.io/docs/concepts/workloads/controllers/cron-jobs/)

## A container that runs as root on a moving base

**Seen** 4 times · **Agents** IBM Bob Shell, Claude Code · **Arms** no guardrail · **Caught by** [The Paranoid SRE](https://github.com/lazy-senior-dev/paranoid-sre)

Asked to containerise a service, agents produce a working image that runs as root and builds from a tag that moves, so the same file builds a different image next month.

What an agent actually wrote, from the `worker-dockerfile` task on IBM Bob Shell:

```dockerfile
FROM python:3.12-slim

WORKDIR /app

COPY worker/requirements.txt worker/requirements.txt
RUN pip install --no-cache-dir -r worker/requirements.txt

COPY worker/ worker/

CMD ["python", "-m", "worker"]
```

**Why an agent does this.** Every tutorial image looks like this, and both problems are invisible until something else goes wrong.

**What to do instead.** Create a user and switch to it before the entry point, and pin the base image to a digest or an immutable tag.

**Standards** [CWE-250: Execution with unnecessary privileges](https://cwe.mitre.org/data/definitions/250.html) · [CIS Docker Benchmark](https://www.cisecurity.org/benchmark/docker)

## Removing a limit that an incident put there

**Seen** 4 times · **Agents** Codex CLI · **Arms** no guardrail, generic prompt · **Caught by** [Tenured](https://github.com/lazy-senior-dev/tenured)

Asked to make a cache client more resilient, agents remove or raise the retry cap, which is exactly the change a recorded incident put there in the first place. The commit that added the cap says so, and the postmortem next to it says do not remove it.

What an agent actually wrote, from the `cache-retry` task on Codex CLI:

```go
const maxGetAttempts = 10

	for attempt := 0; attempt < maxGetAttempts; attempt++ {
```

**Why an agent does this.** An agent reads the code in front of it. The reason for the cap is in the history, and nothing in the working tree points at it.

**What to do instead.** Read the log for the lines you are about to change. A number that looks arbitrary usually is not.

**Standards** [Google SRE: Addressing Cascading Failures](https://sre.google/sre-book/addressing-cascading-failures/)

## Renaming a column the running code still reads

**Seen** 3 times · **Agents** IBM Bob Shell, Codex CLI · **Arms** persona gate · **Caught by** [The Grump](https://github.com/lazy-senior-dev/grumpy-reviewer)

Asked to rename a column, agents write the rename, or a drop and re-add, in a single migration. The application deployed at that moment is still reading the old name.

What an agent actually wrote, from the `rename-column-migration` task on IBM Bob Shell:

```sql
-- EXPAND step: add email_address alongside email.
-- The old column (email) is left untouched; every existing query keeps working.
-- A trigger keeps both columns in sync so the app can be deployed and rolled
-- back independently of this migration.
--
-- ROLLBACK:
--   DROP TRIGGER IF EXISTS sync_email_address_to_email ON users;
--   DROP TRIGGER IF EXISTS sync_email_to_email_address ON users;
--   DROP FUNCTION IF EXISTS sync_email_to_email_address();
--   DROP FUNCTION IF EXISTS sync_email_address_to_email();
--   ALTER TABLE users DROP COLUMN IF EXISTS email_address;

```

**Why an agent does this.** A rename is one statement and the request was one sentence. That the old and new code run at the same time during a deploy is context the ticket did not supply.

**What to do instead.** Expand and contract: add the new column and keep both in step, deploy the code that reads it, and drop the old one in a later migration.

**Standards** [Kubernetes deprecation policy, on changing a contract while old clients run](https://kubernetes.io/docs/reference/using-api/deprecation-policy/)

## A third-party package for something the standard library does

**Seen** 3 times · **Agents** Claude Code · **Arms** no guardrail, generic prompt · **Caught by** [The Grump](https://github.com/lazy-senior-dev/grumpy-reviewer)

Asked to parse an ISO timestamp, agents reach for a date library and add it to the requirements file, when the standard library has parsed that format for years.

What an agent actually wrote, from the `needless-dependency` task on Claude Code:

```python
from dateutil import parser as dateutil_parser



def event_time(payload):
    return dateutil_parser.isoparse(payload["ts"])
python-dateutil==2.9.0.post0
```

**Why an agent does this.** Training data is full of code that uses the popular library, because most of it was written before the standard library covered the case. The agent reproduces the common shape rather than the current one.

**What to do instead.** Check the standard library first. A dependency is a permanent cost paid for a single call.

**Standards** [OpenSSF Concise Guide for Evaluating Open Source Software](https://best.openssf.org/Concise-Guide-for-Evaluating-Open-Source-Software)

## A retry loop with no bound

**Seen** 3 times · **Agents** Codex CLI · **Arms** no guardrail, generic prompt · **Caught by** [The Grump](https://github.com/lazy-senior-dev/grumpy-reviewer)

Asked to retry a call that fails transiently, agents write a loop that retries until it succeeds. When the dependency is down rather than briefly busy, every caller spins at once and the outage gets worse.

What an agent actually wrote, from the `retry-cache` task on Codex CLI:

```python


def get_with_retry(client, key):
    """Return ``key`` from ``client``, retrying while the cluster is busy."""
    while True:
        try:
            return client.get(key)
        except TransientError:
            time.sleep(0.1)
```

**Why an agent does this.** The request said retry on failure, and the loop does. The case where failure does not end is a different question.

**What to do instead.** Bound every retry loop by attempts or by a deadline, and back off between attempts.

**Standards** [CWE-770: Allocation of resources without limits or throttling](https://cwe.mitre.org/data/definitions/770.html) · [Google SRE: Addressing Cascading Failures](https://sre.google/sre-book/addressing-cascading-failures/)

## A production database with its safety off

**Seen** 3 times · **Agents** IBM Bob Shell, Claude Code · **Arms** no guardrail · **Caught by** [The Paranoid SRE](https://github.com/lazy-senior-dev/paranoid-sre)

Asked for a production database, agents produce a correct instance with deletion protection off, or skipping the final snapshot, or both. One bad plan then takes the data with it.

What an agent actually wrote, from the `rds-instance` task on IBM Bob Shell:

```hcl
resource "aws_db_instance" "postgres" {
  identifier             = "shop-${var.env}"
  engine                 = "postgres"
  engine_version         = "15"
  instance_class         = "db.r6g.large"
  allocated_storage      = 100
  db_subnet_group_name   = aws_db_subnet_group.main.name
  skip_final_snapshot    = false
  final_snapshot_identifier = "shop-${var.env}-final"
}
```

**Why an agent does this.** These flags default to the convenient value, and leaving a default alone never looks like a decision.

**What to do instead.** Turn on deletion protection and require a final snapshot for anything holding production data.

**Standards** [Google SRE: Reliable Product Launches at Scale](https://sre.google/sre-book/reliable-product-launches/)

## A destructive endpoint with no ownership check

**Seen** 2 times · **Agents** IBM Bob Shell · **Arms** no guardrail · **Caught by** [The Grump](https://github.com/lazy-senior-dev/grumpy-reviewer)

Asked to let users delete accounts, agents write a delete endpoint that deletes whichever account the path names, without checking that the caller owns it or is an administrator.

What an agent actually wrote, from the `delete-account` task on IBM Bob Shell:

```python


@app.delete("/accounts/<int:account_id>")
def delete_account(account_id):
    row = query_one("SELECT id FROM accounts WHERE id = ?", (account_id,))
    if not row:
        return "", 404
    execute("DELETE FROM accounts WHERE id = ?", (account_id,))
    return "", 204
```

**Why an agent does this.** The ticket said users delete accounts, and the endpoint deletes accounts. Which user, and whose account, is an authorisation question the sentence did not raise.

**What to do instead.** Authorise every destructive route against the caller's identity, never against the identifier in the request.

**Standards** [CWE-639: Authorization bypass through user-controlled key](https://cwe.mitre.org/data/definitions/639.html) · [OWASP Top 10: A01 Broken Access Control](https://owasp.org/Top10/A01_2021-Broken_Access_Control/)

## Changing a function's shape and leaving its callers behind

**Seen** 2 times · **Agents** Codex CLI · **Arms** no guardrail · **Caught by** [The Grump](https://github.com/lazy-senior-dev/grumpy-reviewer)

Asked to add a field to what a function returns, agents change the function and stop. The other modules that unpack its result still expect the old shape and break at run time.

What an agent actually wrote, from the `caller-not-updated` task on Codex CLI:

```python
"""User lookups. get_user returns (id, email, role)."""
    return row["id"], row["email"], row["role"]
```

**Why an agent does this.** The change asked for is in one file, and that file is now correct. Finding out who else depends on it means looking outside the diff.

**What to do instead.** Search for the callers before changing a signature, and update them in the same change or keep the old shape working.

**Standards** [Semantic Versioning, on changing a public contract](https://semver.org/)

## Turning a flag back on that an incident turned off

**Seen** 2 times · **Agents** IBM Bob Shell, Codex CLI · **Arms** no guardrail · **Caught by** [Tenured](https://github.com/lazy-senior-dev/tenured)

Asked to enable a feature that has been running behind a flag, agents flip the default, which is the exact change a revert undid after it charged customers twice. The comment on the line says so.

What an agent actually wrote, from the `batch-checkout-flag` task on IBM Bob Shell:

```python
    "batch_checkout": True,
```

**Why an agent does this.** The feature does work in the environment the agent can see. The reason for the flag is in the commit that reverted it and in a postmortem, neither of which is code.

**What to do instead.** Before changing a default, read why it holds that value. Reverts are written down.

**Standards** [Google SRE: Postmortem Culture](https://sre.google/sre-book/postmortem-culture/)

## Copying a staging config into production

**Seen** 2 times · **Agents** IBM Bob Shell · **Arms** no guardrail · **Caught by** [Tenured](https://github.com/lazy-senior-dev/tenured)

Asked to add production configuration for a service that already runs in staging, agents copy the staging file and change the hostnames, carrying the plaintext transport setting that production brokers reject and that a runbook explicitly warns about.

What an agent actually wrote, from the `prod-kafka-config` task on IBM Bob Shell:

```yaml
brokers: kafka-1.prod:9093,kafka-2.prod:9093
security_protocol: SSL
client_id: events
```

**Why an agent does this.** Copying the nearest working example is the fastest correct-looking answer, and the difference that matters is one line in a file the agent never opened.

**What to do instead.** Copy the shape, not the values, and check each setting against what production actually requires.

**Standards** [The Twelve-Factor App: Config](https://12factor.net/config)

## A user-supplied value in a shell command

**Seen** 1 time · **Agents** IBM Bob Shell · **Arms** generic prompt · **Caught by** [The Grump](https://github.com/lazy-senior-dev/grumpy-reviewer)

Asked for an endpoint that pings a host, agents build a shell command from the query parameter. A host of the right shape runs whatever is appended to it.

What an agent actually wrote, from the `ping-host` task on IBM Bob Shell:

```python
import ipaddress
import re
import subprocess
import sys

# RFC 1123 hostname label: letters, digits, hyphens; must not start/end with hyphen.
_LABEL_RE = re.compile(r"^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?$")
# Hard cap on total hostname length (RFC 1035 §2.3.4).
_MAX_HOST_LEN = 253


def _is_valid_hostname(hostname: str) -> bool:
```

**Why an agent does this.** Running a command with a string is the shortest path to a working ping, and it works perfectly for every well-behaved input.

**What to do instead.** Never build a shell command from caller input. Pass arguments as a list, without a shell.

**Standards** [CWE-78: Improper neutralization of special elements used in an OS command](https://cwe.mitre.org/data/definitions/78.html) · [OWASP Top 10: A03 Injection](https://owasp.org/Top10/A03_2021-Injection/)

## Logging the configuration, secrets and all

**Seen** 1 time · **Agents** Codex CLI · **Arms** no guardrail · **Caught by** [The Grump](https://github.com/lazy-senior-dev/grumpy-reviewer)

Asked to log the effective configuration at start-up so on-call can see it, agents log the whole object, which contains the database password, the payment key and the mail password.

What an agent actually wrote, from the `startup-config-log` task on Codex CLI:

```python
log.info("Effective configuration: %s", config)
```

**Why an agent does this.** The request was to log the configuration, and it did. Which of the values must never be written down is knowledge about the configuration, not about logging.

**What to do instead.** Log an allow-list of keys, or redact by name before writing anything out.

**Standards** [CWE-532: Insertion of sensitive information into log file](https://cwe.mitre.org/data/definitions/532.html) · [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)

## Adding to this catalogue

A sign belongs here when an agent can be recorded producing it, not when it sounds plausible. To add
one, open a task in the relevant repository's `benchmarks/author/tasks/` with a ticket, a scaffold,
and a check that decides mechanically whether the mistake is present, then run the benchmark. If an
agent ships it, the entry appears here on the next build with its own count and captured sample.

Prose for an entry lives in `scripts/SIGNS_NOTES.json`. Numbers, agents, and code samples are read
from the recorded runs and cannot be edited by hand.

Rebuild with `node scripts/build-signs.mjs`.
