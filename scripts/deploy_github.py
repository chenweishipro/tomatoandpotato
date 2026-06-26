#!/usr/bin/env python3
"""Deploy GitHub OAuth feature to test (port 7895, basePath /tomato-test)"""
import pexpect
import time
import base64
import sys

PASSWORD = "Cws647378?!"
HOST = "122.51.221.63"

# 1) scp tarball
print("=== scp tarball ===")
c = pexpect.spawn(
    f'scp -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null '
    f'/tmp/tomato-test.tar.gz ubuntu@{HOST}:/tmp/tomato-test.tar.gz',
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
    f'/workspace/tomato/scripts/deploy-test.sh ubuntu@{HOST}:/tmp/tomato-test-deploy.sh',
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

# kill 老 PID 7895
c.sendline(
    'PID=$(echo "Cws647378?!" | sudo -S ss -tlnp 2>/dev/null | grep ":7895" | grep -oP "pid=\\K[0-9]+" | head -1); '
    'if [ -n "$PID" ]; then echo "killing old PID $PID"; echo "Cws647378?!" | sudo -S kill -9 $PID; sleep 2; fi; '
    'echo "Cws647378?!" | sudo -S systemctl stop tomato-test 2>/dev/null; sleep 1; '
    'nohup bash /tmp/tomato-test-deploy.sh > /tmp/test-deploy-github.log 2>&1 & '
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
c.expect("password:", timeout=10)
c.sendline(PASSWORD)
time.sleep(2)
c.expect(r"[\$\#\>]", timeout=10)
c.sendline("cat /tmp/test-deploy-github.log")
time.sleep(2)
c.sendline("echo '---STATUS---'; echo 'Cws647378?!' | sudo -S systemctl is-active tomato-test; echo 'Cws647378?!' | sudo -S ss -tlnp 2>/dev/null | grep 7895; echo '---HEALTH---'; curl -s -o /dev/null -w 'http_code=%{http_code}\\n' http://127.0.0.1:7895/tomato-test/login/")
time.sleep(3)
c.sendline("exit")
c.expect(pexpect.EOF, timeout=10)
print("=== done ===")
