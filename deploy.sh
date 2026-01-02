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

# Ensure remote directory exists
echo "📁 creating remote directory..."
ssh root@$SERVER_IP "mkdir -p $REMOTE_DIR"

if [[ "$CONFIRMATION" == "OVERWRITE" ]]; then
    echo "🔐 Copying .env file securely..."
    scp .env root@$SERVER_IP:$REMOTE_DIR/.env
else
    echo "⏭️  Skipping .env update."
fi

# Ask to upload assets
read -p "🖼️  Update fixed assets (QR, Portrait, Style Reference)? Type 'ASSETS' to confirm: " ASSET_CONFIRM
echo
if [[ "$ASSET_CONFIRM" == "ASSETS" ]]; then
    echo "🖼️  Uploading assets..."
    # Copy only specific fixed files to avoid junk
    scp storage/qr_fixed.* root@$SERVER_IP:$REMOTE_DIR/storage/ 2>/dev/null || echo "No qr_fixed found"
    scp storage/portrait_fixed.* root@$SERVER_IP:$REMOTE_DIR/storage/ 2>/dev/null || echo "No portrait_fixed found"
    scp storage/style_reference.* root@$SERVER_IP:$REMOTE_DIR/storage/ 2>/dev/null || echo "No style_reference found"
else
    echo "⏭️  Skipping assets update."
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
