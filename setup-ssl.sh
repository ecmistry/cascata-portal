#!/bin/bash
# SSL Certificate Setup Script for cascata.online
# This script sets up Let's Encrypt SSL certificates using certbot

set -e

DOMAIN="cascata.online"
EMAIL="${SSL_EMAIL:-admin@cascata.online}"  # Change this to your email

echo "Setting up SSL certificates for $DOMAIN..."

# Check if certbot is installed
if ! command -v certbot &> /dev/null; then
    echo "Installing certbot..."
    sudo yum install -y certbot python3-certbot-nginx || {
        echo "Failed to install certbot. Trying alternative method..."
        # Alternative: use snap or pip
        sudo yum install -y snapd
        sudo systemctl enable --now snapd.socket
        sudo ln -s /var/lib/snapd/snap /snap
        sudo snap install core; sudo snap refresh core
        sudo snap install --classic certbot
        sudo ln -sf /snap/bin/certbot /usr/bin/certbot
    }
fi

# Check if certificates already exist
if [ -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
    echo "SSL certificates already exist for $DOMAIN"
    echo "To renew: sudo certbot renew"
    exit 0
fi

# Stop the application temporarily (if running)
echo "Note: Make sure port 80 and 443 are accessible for certificate validation"
echo "If you're using a firewall, ensure these ports are open:"
echo "  - Port 80 (HTTP) for ACME challenge"
echo "  - Port 443 (HTTPS) for validation"

# Request certificate (standalone mode - requires stopping the app temporarily)
echo "Requesting SSL certificate from Let's Encrypt..."
echo "This will temporarily use port 80 for validation."
echo ""
read -p "Press Enter to continue (or Ctrl+C to cancel)..."

# For standalone mode (requires stopping the app)
# sudo certbot certonly --standalone -d $DOMAIN -d www.$DOMAIN --email $EMAIL --agree-tos --non-interactive

# Alternative: Use webroot mode if you have a web server running
# sudo certbot certonly --webroot -w /var/www/html -d $DOMAIN -d www.$DOMAIN --email $EMAIL --agree-tos --non-interactive

# For EC2, we'll use standalone mode
sudo certbot certonly --standalone \
    -d $DOMAIN \
    -d www.$DOMAIN \
    --email $EMAIL \
    --agree-tos \
    --non-interactive \
    --preferred-challenges http

if [ $? -eq 0 ]; then
    echo ""
    echo "✓ SSL certificates successfully installed!"
    echo ""
    echo "Certificate location:"
    echo "  Cert: /etc/letsencrypt/live/$DOMAIN/fullchain.pem"
    echo "  Key:  /etc/letsencrypt/live/$DOMAIN/privkey.pem"
    echo ""
    echo "Setting up auto-renewal..."
    # Test renewal
    sudo certbot renew --dry-run
    
    # Add cron job for auto-renewal (if not already present)
    (sudo crontab -l 2>/dev/null | grep -v "certbot renew"; echo "0 0 * * * certbot renew --quiet --deploy-hook 'systemctl reload cascade-portal || true'") | sudo crontab -
    
    echo ""
    echo "✓ SSL setup complete!"
    echo ""
    echo "Next steps:"
    echo "1. Update your .env file with:"
    echo "   SSL_CERT_PATH=/etc/letsencrypt/live/$DOMAIN/fullchain.pem"
    echo "   SSL_KEY_PATH=/etc/letsencrypt/live/$DOMAIN/privkey.pem"
    echo "2. Restart your application"
    echo "3. Ensure port 443 is open in your security group"
else
    echo "✗ Failed to obtain SSL certificate"
    echo "Make sure:"
    echo "  - Port 80 is open and accessible"
    echo "  - DNS is pointing to this server"
    echo "  - The domain $DOMAIN resolves to this server's IP"
    exit 1
fi

