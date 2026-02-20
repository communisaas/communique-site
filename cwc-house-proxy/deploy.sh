#!/bin/bash
# CWC House Proxy Deployment Script
# Run from local machine: ./cwc-house-proxy/deploy.sh
#
# Prerequisites:
# 1. SSH access to GCP instance (ssh-add your key first)
# 2. AUTH_TOKEN generated: openssl rand -hex 32
#
# This script:
# 1. Installs Node.js 20 on the VM
# 2. Deploys the proxy application
# 3. Creates a systemd service
# 4. Starts the proxy

set -euo pipefail

PROJECT="communique-3f47b"
ZONE="us-central1-f"
INSTANCE="instance-20251115-181405"
PROXY_DIR="/opt/cwc-proxy"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}=== CWC House Proxy Deployment ===${NC}"

# Check for auth token
if [ -z "${AUTH_TOKEN:-}" ]; then
  echo "Generating new auth token..."
  AUTH_TOKEN=$(openssl rand -hex 32)
  echo -e "${GREEN}AUTH_TOKEN: ${AUTH_TOKEN}${NC}"
  echo ""
  echo "Save this token! You'll need it for Cloudflare secrets."
  echo "Press Enter to continue..."
  read -r
fi

SSH_CMD="gcloud compute ssh ${INSTANCE} --project=${PROJECT} --zone=${ZONE}"

echo -e "\n${YELLOW}Step 1: Install Node.js 20 LTS${NC}"
${SSH_CMD} --command="
  if command -v node &>/dev/null; then
    echo 'Node.js already installed:' && node --version
  else
    echo 'Installing Node.js 20...'
    sudo apt-get update -qq
    sudo apt-get install -y -qq ca-certificates curl gnupg
    sudo mkdir -p /etc/apt/keyrings
    curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | sudo gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg
    echo 'deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_20.x nodistro main' | sudo tee /etc/apt/sources.list.d/nodesource.list
    sudo apt-get update -qq
    sudo apt-get install -y -qq nodejs
    echo 'Installed:' && node --version
  fi
"

echo -e "\n${YELLOW}Step 2: Create proxy directory${NC}"
${SSH_CMD} --command="
  sudo mkdir -p ${PROXY_DIR}
  sudo chown \$(whoami) ${PROXY_DIR}
"

echo -e "\n${YELLOW}Step 3: Deploy proxy files${NC}"
gcloud compute scp \
  cwc-house-proxy/package.json cwc-house-proxy/server.js \
  ${INSTANCE}:${PROXY_DIR}/ \
  --project=${PROJECT} --zone=${ZONE}

echo -e "\n${YELLOW}Step 4: Install dependencies${NC}"
${SSH_CMD} --command="cd ${PROXY_DIR} && npm install --production 2>&1 | tail -3"

echo -e "\n${YELLOW}Step 5: Create .env file${NC}"
${SSH_CMD} --command="
  cat > ${PROXY_DIR}/.env <<EOF
AUTH_TOKEN=${AUTH_TOKEN}
HOUSE_CWC_ENDPOINT=https://cwc.house.gov/
PORT=80
EOF
  echo '.env created'
"

echo -e "\n${YELLOW}Step 6: Create systemd service${NC}"
${SSH_CMD} --command="
  sudo tee /etc/systemd/system/cwc-proxy.service > /dev/null <<'EOF'
[Unit]
Description=CWC House Proxy
After=network.target

[Service]
Type=simple
User=nobody
Group=nogroup
WorkingDirectory=/opt/cwc-proxy
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=cwc-proxy
EnvironmentFile=/opt/cwc-proxy/.env
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
ReadOnlyPaths=/opt/cwc-proxy
PrivateTmp=true
MemoryMax=256M
CPUQuota=80%

[Install]
WantedBy=multi-user.target
EOF
  sudo systemctl daemon-reload
  sudo systemctl enable cwc-proxy
  sudo systemctl restart cwc-proxy
  echo 'Service created and started'
"

echo -e "\n${YELLOW}Step 7: Verify${NC}"
sleep 2
${SSH_CMD} --command="
  sudo systemctl status cwc-proxy --no-pager -l | head -15
  echo ''
  echo 'Testing health endpoint...'
  curl -s http://localhost:8080/health || echo 'Health check failed (may need a moment to start)'
"

echo -e "\n${GREEN}=== Deployment Complete ===${NC}"
echo ""
echo "Next steps:"
echo "  1. Test from local: curl http://35.209.173.125:8080/health"
echo "  2. Set Cloudflare secrets:"
echo "     npx wrangler pages secret put GCP_PROXY_URL --project-name communique-site"
echo "     (enter: http://35.209.173.125:8080)"
echo "     npx wrangler pages secret put GCP_PROXY_AUTH_TOKEN --project-name communique-site"
echo "     (enter: ${AUTH_TOKEN})"
