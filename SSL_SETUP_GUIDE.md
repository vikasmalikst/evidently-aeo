# SSL/HTTPS Setup Guide for evidentlyaeo.com

This guide will help you set up SSL/TLS certificate to enable HTTPS and remove the "Not Secure" warning.

## Prerequisites

1. Your domain `evidentlyaeo.com` must be pointing to your VPS IP address (`85.239.244.166`)
2. Ports 80 and 443 must be open in your firewall
3. Nginx must be installed on your server

## Step 1: Install Certbot (Let's Encrypt)

SSH into your VPS and run:

```bash
# Update package list
sudo apt update

# Install Certbot and Nginx plugin
sudo apt install certbot python3-certbot-nginx -y
```

## Step 2: Update Nginx Configuration

1. Copy the nginx config to the server:
   ```bash
   sudo cp /path/to/evidently/nginx/evidently.conf /etc/nginx/sites-available/evidently
   ```

2. Create a temporary HTTP-only config for certificate generation:
   ```bash
   sudo nano /etc/nginx/sites-available/evidently-temp
   ```
   
   Add this content:
   ```nginx
   server {
       listen 80;
       server_name evidentlyaeo.com www.evidentlyaeo.com;
       
       location /.well-known/acme-challenge/ {
           root /var/www/html;
       }
       
       location / {
           return 301 https://$server_name$request_uri;
       }
   }
   ```

3. Enable the site:
   ```bash
   sudo ln -s /etc/nginx/sites-available/evidently-temp /etc/nginx/sites-enabled/
   sudo nginx -t  # Test configuration
   sudo systemctl reload nginx
   ```

## Step 3: Obtain SSL Certificate

Run Certbot to get the certificate:

```bash
sudo certbot --nginx -d evidentlyaeo.com -d www.evidentlyaeo.com
```

Certbot will:
- Ask for your email (for renewal notifications)
- Ask to agree to terms of service
- Automatically configure Nginx with SSL
- Set up automatic renewal

## Step 4: Update Nginx with Full Configuration

After Certbot creates the certificate, update your nginx config:

```bash
sudo cp /path/to/evidently/nginx/evidently.conf /etc/nginx/sites-available/evidently
sudo rm /etc/nginx/sites-enabled/evidently-temp
sudo ln -s /etc/nginx/sites-available/evidently /etc/nginx/sites-enabled/
sudo nginx -t  # Test configuration
sudo systemctl reload nginx
```

## Step 5: Verify SSL Certificate

1. Test your SSL certificate:
   ```bash
   sudo certbot certificates
   ```

2. Visit your site: `https://evidentlyaeo.com`
   - You should see a padlock icon (🔒) instead of "Not Secure"
   - The URL should show `https://` instead of `http://`

## Step 6: Set Up Auto-Renewal

Certbot automatically sets up a renewal cron job, but you can test it:

```bash
sudo certbot renew --dry-run
```

## Troubleshooting

### If HTTPS still doesn't work:

1. **Check firewall:**
   ```bash
   sudo ufw status
   sudo ufw allow 443/tcp
   sudo ufw allow 80/tcp
   ```

2. **Check Nginx status:**
   ```bash
   sudo systemctl status nginx
   sudo nginx -t
   ```

3. **Check certificate:**
   ```bash
   sudo certbot certificates
   ```

4. **Check DNS:**
   ```bash
   dig evidentlyaeo.com
   # Should show your IP: 85.239.244.166
   ```

### If you get "Connection refused" on HTTPS:

- Make sure port 443 is open
- Verify Nginx is listening on port 443: `sudo netstat -tlnp | grep 443`
- Check Nginx error logs: `sudo tail -f /var/log/nginx/error.log`

## Manual Certificate Renewal (if needed)

```bash
sudo certbot renew
sudo systemctl reload nginx
```

## Important Notes

- Certificates expire every 90 days, but auto-renewal handles this
- Keep your email updated in Certbot for renewal notifications
- Don't delete the `/etc/letsencrypt` directory - it contains your certificates
