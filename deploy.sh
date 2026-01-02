#!/bin/bash

# Configuration
SERVER_IP="1.2.3.4"  # ⚠️ MUST BE REPLACED WITH ACTUAL SERVER IP
REMOTE_DIR="/root/branded-qr-wallpaper-generator"

echo "📦 Zipping files..."
zip -r deploy.zip . \
  -x "node_modules/*" \
  -x ".env" \
  -x ".git/*" \
  -x "*.DS_Store" \
  -x "storage/*"

echo "⚠️  WARNING: This will OVERWRITE the .env file on the server!"
read -p "🔐 To confirm, type 'OVERWRITE': " CONFIRMATION
if [[ "$CONFIRMATION" == "OVERWRITE" ]]; then
    echo "🔐 Copying .env file securely..."
    scp .env root@$SERVER_IP:$REMOTE_DIR/.env
else
    echo "⏭️  Skipping .env update."
fi

echo "🚀 Uploading Project Files..."
scp deploy.zip root@$SERVER_IP:$REMOTE_DIR/

echo "🛠️  Building and Deploying on Server..."
ssh root@$SERVER_IP << 'ENDSSH'
cd /root/branded-qr-wallpaper-generator
unzip -o deploy.zip
rm deploy.zip
docker compose down
docker compose up -d --build
docker image prune -f
ENDSSH

echo "🧹 Cleaning up local zip..."
rm deploy.zip

echo "✅ Done! Bot updated successfully."
echo "📊 Check logs with: ssh root@$SERVER_IP 'docker logs -f branded-qr-wallpaper-bot'"
