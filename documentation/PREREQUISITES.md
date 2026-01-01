# Deployment Prerequisites

This document outlines everything you need to know and prepare before deploying your application to the VPS.

## 🔑 Credentials & Access

### 1. VPS Server Access ✅
- **Status**: You already have this!
- **SSH Command**: `ssh dev@coachez.ai`
- **Username**: `dev`
- **Password**: (provided by your manager)
- **Domain**: `coachez.ai` (IP: 85.239.244.166)

### 2. Domain Configuration
- **Primary Domain**: `coachez.ai`
- **DNS Settings**: Ensure your domain's A record points to `85.239.244.166`
- **SSL**: Will be configured via Let's Encrypt (free SSL certificates)

## 🗄️ Database (Supabase)

Your application uses **Supabase** as the database. You'll need:

### Required:
1. **Supabase Project URL**
   - Format: `https://xxxxx.supabase.co`
   - Found in: Supabase Dashboard → Settings → API

2. **Supabase Anon Key**
   - Public key (safe for frontend)
   - Found in: Supabase Dashboard → Settings → API → Project API keys

3. **Supabase Service Role Key**
   - ⚠️ **KEEP SECRET** - Never expose in frontend
   - Used by backend for admin operations
   - Found in: Supabase Dashboard → Settings → API → Project API keys

### Database Migrations:
- Ensure all migrations in `supabase/migrations/` have been run
- You can run them via Supabase Dashboard SQL Editor or Supabase CLI

**How to get Supabase credentials:**
1. Go to https://app.supabase.com
2. Select your project (or create one)
3. Go to Settings → API
4. Copy the required keys

## 🔐 API Keys & Secrets

### Required API Keys:

1. **OpenAI API Key** (Required)
   - **Purpose**: LLM queries and AI features
   - **Where to get**: https://platform.openai.com/api-keys
   - **Cost**: Pay-per-use (monitor usage)
   - **Usage**: Used in query generation and other AI features

2. **JWT Secret** (Required)
   - **Purpose**: Signing and verifying authentication tokens
   - **How to generate**: Run `openssl rand -base64 32` on your server
   - **Security**: Must be a strong, random string (never commit to git)

### Optional API Keys:

3. **Cerebras API Key** (Optional)
   - Alternative LLM provider
   - Only needed if using Cerebras models

4. **DataForSEO Credentials** (Optional)
   - Username and password
   - For SEO data collection
   - Only needed if using DataForSEO features

5. **Oxylabs Credentials** (Optional)
   - Username and password
   - For web scraping/proxy services
   - Only needed if using Oxylabs features

6. **SERP API Key** (Optional)
   - For search engine results
   - Only needed if using SERP API features

## 🖥️ Server Requirements

### Minimum Specifications:
- **CPU**: 2+ cores recommended
- **RAM**: 2GB+ recommended (4GB+ for better performance)
- **Storage**: 20GB+ free space
- **OS**: Ubuntu 24.04 LTS (already installed ✅)

### Software to Install:
1. **Node.js** (v20.x or higher)
   - Will be installed during deployment
   - Your app requires Node.js ≥18.0.0

2. **PM2** (Process Manager)
   - For keeping backend running 24/7
   - Auto-restart on crashes
   - Will be installed globally

3. **Nginx** (Web Server)
   - Serves frontend static files
   - Reverse proxy for backend API
   - Handles SSL/TLS

4. **Certbot** (SSL Certificates)
   - Free SSL certificates via Let's Encrypt
   - Auto-renewal setup

### Network Requirements:
- **Port 80**: HTTP (will redirect to HTTPS)
- **Port 443**: HTTPS (main traffic)
- **Port 22**: SSH (already open)
- **Port 3000**: Backend (internal only, proxied through Nginx)

## 📁 Project Structure

Your project has two main parts:

### Backend (`/backend`)
- **Type**: Node.js/Express/TypeScript
- **Port**: 3000 (internal)
- **Build**: TypeScript → JavaScript (`npm run build`)
- **Start**: `node dist/app.js` or via PM2

### Frontend (`/src`)
- **Type**: React/Vite/TypeScript
- **Build**: Vite bundler (`npm run build`)
- **Output**: Static files in `/dist` directory
- **Served by**: Nginx

## 🔒 Security Considerations

### Before Deployment:
1. **Environment Variables**
   - Never commit `.env` files to git
   - Use `.gitignore` (already configured ✅)
   - Store secrets securely (password manager)

2. **SSH Security** (Recommended)
   - Set up SSH key authentication (more secure than passwords)
   - Disable root login (if not already)
   - Change default SSH port (optional)

3. **Firewall**
   - Only open necessary ports (22, 80, 443)
   - Block all other ports by default

4. **API Keys Security**
   - Backend API keys: Store in backend `.env` (server-side only)
   - Frontend API keys: Only public keys (Supabase anon key)
   - Never expose service role keys or secrets in frontend

### After Deployment:
- Regular security updates: `sudo apt update && sudo apt upgrade`
- Monitor logs for suspicious activity
- Keep dependencies updated
- Regular backups (database handled by Supabase)

## 📊 Monitoring & Maintenance

### What to Monitor:
1. **Server Resources**
   - CPU usage
   - Memory usage
   - Disk space
   - Network traffic

2. **Application Health**
   - PM2 process status
   - Backend logs
   - Nginx logs
   - API response times

3. **Costs**
   - OpenAI API usage (can add up quickly)
   - Server hosting costs
   - Domain renewal

### Maintenance Tasks:
- Weekly: Check server resources and logs
- Monthly: Update system packages
- As needed: Update application dependencies
- Quarterly: Review and rotate secrets

## 🚨 Common Issues to Watch For

1. **Out of Memory**
   - Monitor with `free -h`
   - PM2 will restart if memory limit exceeded

2. **Disk Space Full**
   - Check with `df -h`
   - Clean old logs periodically

3. **SSL Certificate Expiry**
   - Let's Encrypt certificates expire every 90 days
   - Auto-renewal should be configured

4. **API Rate Limits**
   - OpenAI has rate limits
   - Monitor API usage and errors

5. **Database Connection Issues**
   - Check Supabase status
   - Verify credentials are correct
   - Check network connectivity

## 📝 Quick Reference

### Where to Find Things:

**Supabase Credentials:**
- Dashboard: https://app.supabase.com
- Settings → API

**OpenAI API Key:**
- Dashboard: https://platform.openai.com/api-keys

**Server Access:**
- SSH: `ssh dev@coachez.ai`
- IP: 85.239.244.166

**Project Location on Server:**
- Path: `/home/dev/projects/evidently`

**Logs Location:**
- PM2 logs: `pm2 logs`
- Nginx logs: `/var/log/nginx/`
- Application logs: `/home/dev/logs/`

## ✅ Pre-Deployment Checklist

Before starting deployment, ensure you have:

- [x] VPS SSH access working
- [ ] Supabase project created
- [ ] Supabase credentials (URL, anon key, service role key)
- [ ] OpenAI API key
- [ ] All database migrations run
- [ ] JWT secret generated
- [ ] Domain DNS configured (if using custom domain)
- [ ] All optional API keys (if needed)

## 🆘 Getting Help

If you get stuck:
1. Check the **DEPLOYMENT_GUIDE.md** for step-by-step instructions
2. Review logs: `pm2 logs` and Nginx error logs
3. Verify all environment variables are set correctly
4. Check that services are running: `pm2 status`, `sudo systemctl status nginx`
5. Verify firewall: `sudo ufw status`

---

**Ready to deploy?** Follow the step-by-step guide in **DEPLOYMENT_GUIDE.md**!



