#!/bin/bash
# Fix 413 Request Entity Too Large on VPS
# Run this script on the VPS (not local)

echo "=== Fixing Nginx upload limit ==="

# Find the nginx config for blackscity
NGINX_CONF=$(grep -rl "blackscity" /etc/nginx/sites-available/ 2>/dev/null | head -1)

if [ -z "$NGINX_CONF" ]; then
  NGINX_CONF=$(grep -rl "blackscity" /etc/nginx/conf.d/ 2>/dev/null | head -1)
fi

if [ -z "$NGINX_CONF" ]; then
  echo "Could not find blackscity nginx config. Checking all configs..."
  ls -la /etc/nginx/sites-available/ /etc/nginx/conf.d/ 2>/dev/null
  echo ""
  echo "Manual fix: Add this line inside the 'server' or 'http' block:"
  echo "  client_max_body_size 50M;"
  exit 1
fi

echo "Found config: $NGINX_CONF"
echo ""

# Check if already set
if grep -q "client_max_body_size" "$NGINX_CONF"; then
  echo "client_max_body_size already exists:"
  grep "client_max_body_size" "$NGINX_CONF"
  echo ""
  echo "Updating to 50M..."
  sudo sed -i 's/client_max_body_size.*/client_max_body_size 50M;/' "$NGINX_CONF"
else
  echo "Adding client_max_body_size 50M..."
  sudo sed -i '/server_name/a\    client_max_body_size 50M;' "$NGINX_CONF"
fi

echo ""
echo "Testing nginx config..."
sudo nginx -t

if [ $? -eq 0 ]; then
  echo "Reloading nginx..."
  sudo systemctl reload nginx
  echo "✅ Done! Upload limit set to 50MB"
else
  echo "❌ Nginx config error! Please check manually."
fi
