# Deployment Guide for Evidently/AnswerIntel

This guide will help you deploy the Evidently full-stack application to your VPS server.

## 📋 Prerequisites

Before deploying, ensure you have:

1. **VPS Server Access** ✅ (You already have SSH access)
2. **Domain Name** (if you want to use a custom domain, e.g., `coachez.ai`)
3. **Supabase Project** (Database is already hosted on Supabase)
4. **API Keys**:
   - OpenAI API Key
   - Optional: Cerebras API Key
   - Optional: DataForSEO credentials
   - Optional: Oxylabs credentials
   - SERP API key (if used)
   - JWT Secret (generate a secure random string)

## 🚀 Step-by-Step Deployment Process

### Step 1: Server Setup & Initial Configuration

Once you're SSH'd into the server (`ssh dev@coachez.ai`), run these commands:

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install essential tools
sudo apt install -y curl wget git build-essential

# Install Node.js (version 18 or higher)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify installation
node --version  # Should show v20.x or higher
npm --version

# Install PM2 globally (process manager for Node.js)
sudo npm install -g pm2

# Install Nginx (web server/reverse proxy)
sudo apt install -y nginx

# Install Certbot (for SSL certificates)
sudo apt install -y certbot python3-certbot-nginx
```

### Step 2: Clone Your Repository

```bash
# Navigate to your home directory or create a project directory
cd ~
mkdir -p projects
cd projects

# Clone your repository (replace with your actual git URL)
git clone <your-repository-url> evidently
cd evidently

# If you need to pull the latest code
git pull origin main  # or your branch name
```

### Step 3: Backend Setup

```bash
# Navigate to backend directory
cd backend

# Install dependencies
npm install

# Create .env file for backend
nano .env
```

Add the following environment variables to the backend `.env` file:

```env
# Server Configuration
NODE_ENV=production
PORT=3000
FRONTEND_URL=https://coachez.ai
SITE_URL=https://coachez.ai

# Supabase Configuration
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# JWT Configuration
JWT_SECRET=your_secure_random_jwt_secret_here
JWT_EXPIRES_IN=7d

# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key
MODEL=gpt-4o-mini

# Optional: Cerebras Configuration
CEREBRAS_API_KEY=your_cerebras_api_key
CEREBRAS_MODEL=qwen-3-235b-a22b-instruct-2507

# Optional: DataForSEO Configuration
DATAFORSEO_USERNAME=your_dataforseo_username
DATAFORSEO_PASSWORD=your_dataforseo_password

# Optional: Oxylabs Configuration
OXYLABS_USERNAME=your_oxylabs_username
OXYLABS_PASSWORD=your_oxylabs_password

# Optional: SERP API Configuration
SERPAPI_KEY=your_serpapi_key
```

**Important:** Generate a secure JWT_SECRET:
```bash
# Generate a secure random string for JWT_SECRET
openssl rand -base64 32
```

Save and exit nano: `Ctrl+X`, then `Y`, then `Enter`

```bash
# Build the backend TypeScript code
npm run build

# Test that the build works
npm start
# Press Ctrl+C after verifying it starts correctly
```

### Step 4: Frontend Setup

Open a new terminal or SSH session, then:

```bash
cd ~/projects/evidently

# Install frontend dependencies
npm install

# Create .env file for frontend
nano .env
```

Add frontend environment variables:

```env
# Supabase Configuration (Public keys are safe for frontend)
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# Backend API URL
VITE_API_URL=https://coachez.ai/api
# or if using subdomain: VITE_API_URL=https://api.coachez.ai
```

Save and exit.

```bash
# Build the frontend for production
npm run build

# The built files will be in the `dist` directory
ls -la dist/
```

### Step 5: Configure PM2 for Backend

Create a PM2 ecosystem file:

```bash
cd ~/projects/evidently/backend
nano ecosystem.config.js
```

Add this configuration (file will be created in the next step).

### Step 6: Configure Nginx

```bash
# Create Nginx configuration
sudo nano /etc/nginx/sites-available/evidently
```

Add this configuration (file will be created in the next step).

```bash
# Enable the site
sudo ln -s /etc/nginx/sites-available/evidently /etc/nginx/sites-enabled/

# Remove default site if it exists
sudo rm /etc/nginx/sites-enabled/default

# Test Nginx configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
```

### Step 7: Start Backend with PM2

```bash
cd ~/projects/evidently/backend

# Start the backend with PM2
pm2 start ecosystem.config.js

# Save PM2 configuration so it restarts on server reboot
pm2 save
pm2 startup
# Follow the instructions it prints
```

### Step 8: Setup SSL Certificate (Let's Encrypt)

```bash
# Get SSL certificate for your domain
sudo certbot --nginx -d coachez.ai -d www.coachez.ai

# Follow the prompts and enter your email when asked
# Certbot will automatically configure Nginx

# Test automatic renewal
sudo certbot renew --dry-run
```

### Step 9: Configure Firewall

```bash
# Allow SSH, HTTP, and HTTPS
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
sudo ufw status
```

## 🔧 Post-Deployment Configuration

### Set up PM2 Monitoring

```bash
# View logs
pm2 logs

# Monitor processes
pm2 monit

# List all processes
pm2 list

# Restart a process
pm2 restart evidently-backend

# Stop a process
pm2 stop evidently-backend
```

### Environment Variables Management

Keep your `.env` files secure:
- Never commit them to git
- Use `chmod 600 .env` to restrict access
- Consider using environment variable management tools for production

### Database Migrations

If you have new migrations to run:

```bash
# Connect to Supabase dashboard and run migrations there
# Or use Supabase CLI if installed
```

## 📊 Monitoring & Maintenance

### View Application Logs

```bash
# Backend logs via PM2
pm2 logs evidently-backend

# Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# System logs
sudo journalctl -u nginx -f
```

### Update Application

When you need to update:

```bash
cd ~/projects/evidently

# Pull latest code
git pull origin main  # or your branch

# Backend updates
cd backend
npm install
npm run build
pm2 restart evidently-backend

# Frontend updates
cd ..
npm install
npm run build
# Nginx will serve the new files automatically
```

### Backup Strategy

- Database: Supabase handles backups automatically
- Code: Version controlled in Git
- Environment files: Store securely (password manager, encrypted storage)

## 🐛 Troubleshooting

### Backend won't start
- Check logs: `pm2 logs evidently-backend`
- Verify environment variables are set correctly
- Check port 3000 isn't already in use: `sudo netstat -tulpn | grep 3000`

### Frontend shows blank page
- Check browser console for errors
- Verify VITE_API_URL points to correct backend URL
- Check Nginx error logs: `sudo tail -f /var/log/nginx/error.log`

### 502 Bad Gateway
- Backend might not be running: `pm2 list`
- Check backend logs: `pm2 logs`
- Verify backend is listening on port 3000

### SSL Certificate Issues
- Check certificate: `sudo certbot certificates`
- Renew manually: `sudo certbot renew`
- Verify Nginx config: `sudo nginx -t`

## 🔐 Security Checklist

- [ ] Firewall configured (UFW)
- [ ] SSL certificate installed (HTTPS)
- [ ] Environment variables secured (`.env` files with restricted permissions)
- [ ] JWT_SECRET is a strong random string
- [ ] Supabase service role key kept secret
- [ ] API keys secured and not exposed in frontend
- [ ] Regular system updates scheduled
- [ ] PM2 process monitoring enabled
- [ ] Logs configured and monitored

## 📝 Quick Reference Commands

```bash
# View backend status
pm2 status

# Restart backend
pm2 restart evidently-backend

# View logs
pm2 logs

# Update frontend
cd ~/projects/evidently && npm run build

# Check Nginx status
sudo systemctl status nginx

# Test Nginx config
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx

# Check disk space
df -h

# Check memory usage
free -h

# Check running processes
htop  # or top
```

## 🆘 Getting Help

If you encounter issues:
1. Check the logs first (`pm2 logs` and Nginx logs)
2. Verify all environment variables are set
3. Check that all services are running (`pm2 list`, `sudo systemctl status nginx`)
4. Review firewall settings (`sudo ufw status`)

---

**Next Steps:** After following this guide, your application should be live at `https://coachez.ai`!

