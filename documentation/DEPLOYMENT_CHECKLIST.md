# Deployment Checklist

Use this checklist to ensure you don't miss any steps during deployment.

## Pre-Deployment

- [ ] All code is committed and pushed to repository
- [ ] All environment variables are documented
- [ ] API keys and secrets are ready
- [ ] Domain name DNS is configured (if using custom domain)
- [ ] Supabase project is set up and migrations are run
- [ ] SSH access to VPS is working

## Server Initial Setup

- [ ] System packages updated (`sudo apt update && sudo apt upgrade`)
- [ ] Node.js 20.x installed and verified
- [ ] PM2 installed globally (`npm install -g pm2`)
- [ ] Nginx installed and running
- [ ] Certbot installed (for SSL)
- [ ] Firewall configured (UFW)

## Repository Setup

- [ ] Repository cloned to server
- [ ] Latest code pulled from main branch
- [ ] `.gitignore` verified (`.env` files excluded)

## Backend Configuration

- [ ] Backend `.env` file created with all variables
- [ ] JWT_SECRET generated securely (`openssl rand -base64 32`)
- [ ] All Supabase credentials added
- [ ] All API keys added (OpenAI, etc.)
- [ ] Backend dependencies installed (`npm install`)
- [ ] Backend built successfully (`npm run build`)
- [ ] Backend `.env` file permissions set (`chmod 600 .env`)

## Frontend Configuration

- [ ] Frontend `.env` file created
- [ ] Supabase URL and anon key added
- [ ] Backend API URL configured
- [ ] Frontend dependencies installed (`npm install`)
- [ ] Frontend built successfully (`npm run build`)
- [ ] Built files verified in `dist/` directory

## PM2 Configuration

- [ ] `ecosystem.config.js` created in backend directory
- [ ] Logs directory created (`mkdir -p ~/logs`)
- [ ] PM2 process started (`pm2 start ecosystem.config.js`)
- [ ] PM2 status verified (`pm2 status`)
- [ ] PM2 save executed (`pm2 save`)
- [ ] PM2 startup configured (`pm2 startup`)

## Nginx Configuration

- [ ] Nginx config file created at `/etc/nginx/sites-available/evidently`
- [ ] Symlink created to sites-enabled
- [ ] Default site removed (if exists)
- [ ] Nginx config tested (`sudo nginx -t`)
- [ ] Nginx restarted (`sudo systemctl restart nginx`)
- [ ] Nginx status verified (`sudo systemctl status nginx`)

## SSL Certificate

- [ ] SSL certificate obtained (`sudo certbot --nginx`)
- [ ] Certificate auto-renewal tested (`sudo certbot renew --dry-run`)
- [ ] HTTPS redirect working
- [ ] SSL grade checked (optional: https://www.ssllabs.com/ssltest/)

## Testing

- [ ] Backend health check accessible (`curl http://localhost:3000/health`)
- [ ] Frontend loads at domain root
- [ ] API endpoints responding via Nginx proxy
- [ ] Authentication flow works (login/register)
- [ ] Database connections working
- [ ] All main features functional

## Monitoring Setup

- [ ] PM2 logs accessible (`pm2 logs`)
- [ ] Nginx logs accessible (`sudo tail -f /var/log/nginx/error.log`)
- [ ] System monitoring tools installed (optional: `htop`, `ncdu`)

## Security Hardening

- [ ] Firewall enabled and configured
- [ ] SSH key authentication enabled (instead of password)
- [ ] Environment files secured (chmod 600)
- [ ] API keys not exposed in frontend
- [ ] SSL certificate installed and working
- [ ] Security headers configured in Nginx

## Documentation

- [ ] All credentials stored securely (password manager)
- [ ] Deployment process documented
- [ ] Environment variables documented
- [ ] Rollback procedure documented (optional)

## Post-Deployment

- [ ] Application accessible via domain
- [ ] All functionality tested
- [ ] Performance verified
- [ ] Error monitoring setup (optional)
- [ ] Backup strategy in place
- [ ] Update procedure documented

## Optional Enhancements

- [ ] Set up automated backups
- [ ] Configure log rotation
- [ ] Set up monitoring alerts
- [ ] Configure CDN (if needed)
- [ ] Set up CI/CD pipeline
- [ ] Configure staging environment

---

## Quick Health Checks

Run these commands to verify everything is working:

```bash
# Check backend is running
pm2 status

# Check backend health
curl http://localhost:3000/health

# Check Nginx status
sudo systemctl status nginx

# Check SSL certificate
sudo certbot certificates

# Check disk space
df -h

# Check memory
free -h

# View recent errors
pm2 logs --lines 50
sudo tail -n 50 /var/log/nginx/error.log
```

---

**Note:** Update this checklist as you complete each step and save it for future deployments!



