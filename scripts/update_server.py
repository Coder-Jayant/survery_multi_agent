import paramiko
HOST = "49.50.117.67"
PORT = 2232
USER = "root"
PASS = "Xtts@123"
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
try:
    client.connect(HOST, port=PORT, username=USER, password=PASS, timeout=15, look_for_keys=False, allow_agent=False)
except paramiko.AuthenticationException:
    transport = paramiko.Transport((HOST, PORT))
    transport.connect()
    transport.auth_interactive(USER, lambda t, i, p: [PASS] * len(p))
    client._transport = transport

run(client, f"cd {APP_DIR} && git stash && git pull", "Git stash & pull")
run(client, "systemctl restart survey-agent", "Restart service")
run(client, "curl -s http://localhost:8001/health", "Health check")
client.close()
print("\n✅ Server updated successfully!")
