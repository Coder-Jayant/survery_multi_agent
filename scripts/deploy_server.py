"""
deploy_server.py — one-shot SSH deployment for Survey Agent
Usage: python scripts/deploy_server.py
"""
import sys, time

try:
    import paramiko
except ImportError:
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "paramiko", "-q"])
    import paramiko

HOST = "49.50.117.67"
PORT = 2232
USER = "root"
PASS = "Xtts@123"
REPO = "https://github.com/Coder-Jayant/survery_multi_agent.git"
APP_DIR = "/opt/survey_agent"

def run(client, cmd, desc=""):
    print(f"\n▶ {desc or cmd[:60]}")
    stdin, stdout, stderr = client.exec_command(cmd, timeout=300)
    out = stdout.read().decode().strip()
    err = stderr.read().decode().strip()
    if out: print(out)
    if err: print(f"  [stderr] {err[:300]}")
    return out

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
print(f"Connecting to {HOST}:{PORT}...")
try:
    client.connect(HOST, port=PORT, username=USER, password=PASS,
                   timeout=15, look_for_keys=False, allow_agent=False)
except paramiko.AuthenticationException:
    # Try keyboard-interactive
    transport = paramiko.Transport((HOST, PORT))
    transport.connect()
    transport.auth_interactive(USER, lambda t, i, p: [PASS] * len(p))
    client._transport = transport
print("✓ Connected")

# ── 1. Check resources ──────────────────────────────────────────────────────
print("\n=== SERVER RESOURCES ===")
run(client, "free -h", "RAM")
run(client, "df -h /", "Disk")
run(client, "nproc && lscpu | grep 'Model name'", "CPU")
run(client, "python3 --version || python --version", "Python version")

# ── 2. Install system deps ──────────────────────────────────────────────────
print("\n=== INSTALLING DEPS ===")
run(client, "apt-get update -qq && apt-get install -y -qq git python3-pip python3-venv", "apt install")

# ── 3. Clone / pull repo ───────────────────────────────────────────────────
run(client, f"[ -d {APP_DIR} ] && git -C {APP_DIR} pull || git clone {REPO} {APP_DIR}", "Clone/pull repo")

# ── 4. Python venv + pip install ───────────────────────────────────────────
run(client, f"cd {APP_DIR} && python3 -m venv .venv && .venv/bin/pip install -q --upgrade pip", "Create venv")
run(client, f"cd {APP_DIR} && .venv/bin/pip install -q -r requirements.txt", "pip install")

# ── 5. Write systemd service ───────────────────────────────────────────────
service = f"""[Unit]
Description=Survey Agent API
After=network.target

[Service]
User=root
WorkingDirectory={APP_DIR}
ExecStart={APP_DIR}/.venv/bin/uvicorn api.main:app --host 0.0.0.0 --port 8001 --timeout-keep-alive 75
Restart=always
RestartSec=5
Environment=PYTHONUNBUFFERED=1

[Install]
WantedBy=multi-user.target
"""
sftp = client.open_sftp()
with sftp.open("/etc/systemd/system/survey-agent.service", "w") as f:
    f.write(service)
sftp.close()
print("✓ systemd service written")

# ── 6. Start service ──────────────────────────────────────────────────────
run(client, "systemctl daemon-reload && systemctl enable survey-agent && systemctl restart survey-agent", "Start service")
time.sleep(3)
run(client, "systemctl status survey-agent --no-pager -l", "Service status")
run(client, "curl -s http://localhost:8001/health", "Health check")

print("\n✅ Deployment complete! App running on http://49.50.117.67:8001")
client.close()
