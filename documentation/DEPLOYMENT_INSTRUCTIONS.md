# Deployment Instructions for VPS

This guide explains how to sync your local changes to your live hosted application on VPS.

## Prerequisites

1. SSH access to your VPS server
2. Git repository set up on both local and VPS
3. PM2 installed on VPS (for backend process management)
4. Nginx configured (for serving frontend)

## Deployment Methods

### Method 1: Using Git (Recommended)

This is the cleanest approach - push changes to Git and pull on VPS.

#### Step 1: Commit and Push Changes Locally

```bash
# Make sure all changes are committed
git add .
git commit -m "Your commit message describing the changes"
git push origin main  # or your branch name
```

#### Step 2: SSH into VPS and Pull Changes

```bash
# SSH into your VPS
ssh user@your-vps-ip

# Navigate to project directory
cd /home/dev/projects/evidently

# Pull latest changes
git pull origin main  # or your branch name
```

#### Step 3: Deploy Using the Deployment Script

```bash
# Deploy both frontend and backend
./deploy.sh all

# Or deploy individually:
./deploy.sh backend   # Only backend
./deploy.sh frontend  # Only frontend
```

### Method 2: Using SCP (Direct File Transfer)

If you don't want to use Git, you can directly copy files:

```bash
# From your local machine, copy files to VPS
scp -r src/ user@your-vps-ip:/home/dev/projects/evidently/
scp -r backend/src/ user@your-vps-ip:/home/dev/projects/evidently/backend/src/

# Then SSH and deploy
ssh user@your-vps-ip
cd /home/dev/projects/evidently
./deploy.sh all
```

### Method 3: Manual Deployment

If you need more control:

```bash
# SSH into VPS
ssh user@your-vps-ip
cd /home/dev/projects/evidently

# Backend deployment
cd backend
npm install --production
npm run build
pm2 restart evidently-backend

# Frontend deployment
cd ..
npm install
npm run build
# Nginx will automatically serve the new dist/ folder
```

## What the Deployment Script Does

The `deploy.sh` script:

1. **Backend:**
   - Installs production dependencies
   - Builds TypeScript to JavaScript
   - Restarts PM2 process

2. **Frontend:**
   - Installs dependencies
   - Builds React app with Vite
   - Outputs to `dist/` folder (served by Nginx)

## Troubleshooting

### Backend not restarting
```bash
# Check PM2 status
pm2 status

# View logs
pm2 logs evidently-backend

# Restart manually
pm2 restart evidently-backend
```

### Frontend not updating
```bash
# Clear browser cache (hard refresh: Ctrl+Shift+R or Cmd+Shift+R)
# Or check if Nginx is serving the correct directory
sudo nginx -t
sudo systemctl reload nginx
```

### Build errors
```bash
# Check Node.js version (should match local)
node --version

# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

## Quick Deploy Checklist

- [ ] All changes committed and pushed to Git
- [ ] SSH into VPS
- [ ] Pull latest changes: `git pull`
- [ ] Run deployment: `./deploy.sh all`
- [ ] Check PM2 status: `pm2 status`
- [ ] Test the application in browser
- [ ] Check logs if issues: `pm2 logs evidently-backend`

## Environment Variables

Make sure your `.env` files are properly configured on VPS:

- `backend/.env` - Backend environment variables
- `.env` (root) - Frontend environment variables

**Note:** `.env` files are gitignored, so you need to manually copy them or use a secure method to sync them.

## Automated Deployment (Optional)

You can set up a CI/CD pipeline using GitHub Actions or similar to automatically deploy on push to main branch. This requires additional setup but makes deployment seamless.

