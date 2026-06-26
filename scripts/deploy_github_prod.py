#!/usr/bin/env python3
"""Deploy GitHub OAuth feature to prod (port 7893, basePath /tomato)"""
import pexpect
import time
import sys

PASSWORD = "Cws647378?!"
HOST = "122.51.221.63"

# 1) scp tarball
print("=== scp tarball ===")
c = pexpect.spawn(
    f'scp -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null '
    f'/tmp/tomato-prod.tar.gz ubuntu@{HOST}:/tmp/tomato-prod.tar.gz',
    timeout=300,
)
c.expect("password:", timeout=10)
c.sendline(PASSWORD)
c.expect(pexpect.EOF, timeout=300)
print("scp done")

# 2) scp deploy script
print("=== scp deploy script ===")
c = pexpect.spawn(
    f'scp -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null '
    f'/workspace/tomato/scripts/deploy-prod.sh ubuntu@{HOST}:/tmp/tomato-deploy.sh',
    timeout=15,
)
c.expect("password:", timeout=10)
c.sendline(PASSWORD)
c.expect(pexpect.EOF, timeout=15)
print("scp script done")

# 3) ssh async deploy
print("=== ssh deploy ===")
c = pexpect.spawn(
    f'ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null ubuntu@{HOST}',
    timeout=30,
    encoding="utf-8",
)
c.expect("password:", timeout=10)
c.sendline(PASSWORD)
time.sleep(3)
c.expect(r"[\$\#\>]", timeout=10)

# kill 老 PID 7893
c.sendline(
    'PID=$(echo "Cws647378?!" | sudo -S ss -tlnp 2>/dev/null | grep ":7893" | grep -oP "pid=\\K[0-9]+" | head -1); '
    'if [ -n "$PID" ]; then echo "killing old PID $PID"; echo "Cws647378?!" | sudo -S kill -9 $PID; sleep 2; fi; '
    'echo "Cws647378?!" | sudo -S systemctl stop tomato 2>/dev/null; sleep 1; '
    'nohup bash /tmp/tomato-deploy.sh > /tmp/prod-deploy-github.log 2>&1 & '
    'echo DEPLOY_PID=$!'
)
c.expect("DEPLOY_PID=", timeout=10)
c.logfile_read = sys.stdout
time.sleep(2)
c.close()

# 等 deploy 完成
print("=== waiting 60s for deploy ===")
time.sleep(60)

# 4) ssh 看 log
c = pexpect.spawn(
    f'ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null ubuntu@{HOST}',
    timeout=15,
    encoding="utf-8",
)
c.logfile_read = open('/tmp/check-prod.log', 'w')
c.expect("password:", timeout=10)
c.sendline(PASSWORD)
time.sleep(2)
c.expect(r"[\$\#\>]", timeout=10)
c.sendline("cat /tmp/prod-deploy-github.log; echo '---STATUS---'; echo 'Cws647378?!' | sudo -S systemctl is-active tomato 2>&1; echo 'Cws647378?!' | sudo -S ss -tlnp 2>/dev/null | grep 7893; echo '---HEALTH---'; curl -s -o /dev/null -w 'http_code=%{http_code}\\n' http://127.0.0.1:7893/tomato/login/; echo '---GITHUB API---'; curl -s -o /dev/null -w 'http_code=%{http_code}\\n' http://127.0.0.1:7893/tomato/api/github/qrcode")
time.sleep(4)
c.sendline("exit")
c.expect(pexpect.EOF, timeout=10)
print("=== done ===")
