"""
Rewrites git history to strip Co-authored-by: Cursor trailers.
Run from repo root with: python clean_history.py
"""
import subprocess, os, sys

REPO = os.path.dirname(os.path.abspath(__file__))

def run(cmd, **kw):
    r = subprocess.run(cmd, capture_output=True, text=True, cwd=REPO, **kw)
    if r.returncode != 0:
        print(f"ERR: {' '.join(cmd)}\n{r.stderr}")
        sys.exit(1)
    return r.stdout.strip()

def clean_msg(msg):
    lines = msg.splitlines()
    cleaned = [l for l in lines if "Co-authored-by: Cursor" not in l]
    # Remove trailing blank lines
    while cleaned and cleaned[-1].strip() == "":
        cleaned.pop()
    return "\n".join(cleaned)

# ── get all commits in topo order (oldest first) ──────────────────────────────
log = run(["git", "log", "--format=%H", "--reverse"])
commits = [c for c in log.splitlines() if c]
print(f"Rewriting {len(commits)} commit(s)...")

env = {
    **os.environ,
    "GIT_AUTHOR_NAME": "Jayant Verma",
    "GIT_AUTHOR_EMAIL": "jayantmailac@gmail.com",
    "GIT_COMMITTER_NAME": "Jayant Verma",
    "GIT_COMMITTER_EMAIL": "jayantmailac@gmail.com",
}

old_to_new: dict[str, str] = {}

for sha in commits:
    # get tree
    tree = run(["git", "cat-file", "-p", sha])
    tree_sha = ""
    parent_shas = []
    for line in tree.splitlines():
        if line.startswith("tree "):
            tree_sha = line.split()[1]
        elif line.startswith("parent "):
            parent_shas.append(line.split()[1])
        elif line == "":
            break

    # get message
    msg = run(["git", "log", "--format=%B", "-n1", sha])
    new_msg = clean_msg(msg)

    # build commit-tree args
    args = ["git", "commit-tree", tree_sha]
    for p in parent_shas:
        mapped = old_to_new.get(p, p)
        args += ["-p", mapped]
    args += ["-m", new_msg]

    r = subprocess.run(args, capture_output=True, text=True, cwd=REPO, env=env)
    if r.returncode != 0:
        print(f"ERR running commit-tree: {r.stderr}")
        sys.exit(1)
    new_sha = r.stdout.strip()
    old_to_new[sha] = new_sha
    print(f"  {sha[:8]} → {new_sha[:8]}  msg: {new_msg[:60]!r}")

# ── update main branch ─────────────────────────────────────────────────────────
latest_old = commits[-1]
latest_new = old_to_new[latest_old]
run(["git", "update-ref", "refs/heads/main", latest_new])
run(["git", "checkout", "main"])
run(["git", "reset", "--hard", "HEAD"])
print(f"\nDone. main → {latest_new[:12]}")
print(run(["git", "log", "--oneline", "-5"]))
