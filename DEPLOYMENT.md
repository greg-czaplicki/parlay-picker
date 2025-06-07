# 🚀 Golf Parlay Picker - Vercel Deployment Guide

## Overview
This guide covers deploying the Golf Parlay Picker to Vercel with password protection for alpha/beta access.

## Prerequisites
1. [Vercel CLI](https://vercel.com/cli) installed: `npm i -g vercel`
2. Vercel account connected to your GitHub
3. All environment variables ready

## 🔐 Environment Variables Required

Set these in your Vercel project dashboard (Project Settings → Environment Variables):

### **Authentication**
```
ALPHA_PASSWORD=your-secure-password-here
```

### **Database (Supabase)**
```
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_URL=your-supabase-url
SUPABASE_ANON_KEY=your-supabase-anon-key
```

### **DataGolf API**
```
DATAGOLF_API_KEY=your-datagolf-api-key
```

### **Optional - Other APIs**
```
DRAFTKINGS_API_KEY=your-draftkings-key-if-needed
```

## 📦 Deployment Steps

### Option 1: GitHub Integration (Recommended)

1. **Push to GitHub:**
   ```bash
   git add .
   git commit -m "feat: Add password protection for alpha deployment"
   git push origin main
   ```

2. **Connect to Vercel:**
   - Go to [vercel.com](https://vercel.com)
   - Click "New Project" 
   - Import your GitHub repository
   - Vercel will auto-detect Next.js settings

3. **Configure Environment Variables:**
   - In Vercel dashboard → Project Settings → Environment Variables
   - Add all environment variables listed above
   - Make sure to set them for Production, Preview, and Development

4. **Deploy:**
   - Vercel will automatically deploy on push
   - First deployment might take 3-5 minutes

### Option 2: Vercel CLI

1. **Login to Vercel:**
   ```bash
   vercel login
   ```

2. **Deploy:**
   ```bash
   vercel --prod
   ```

3. **Set Environment Variables:**
   ```bash
   vercel env add ALPHA_PASSWORD
   vercel env add NEXT_PUBLIC_SUPABASE_URL
   vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
   # ... add all other env vars
   ```

## 🔒 Password Protection Features

- **Simple password protection** for alpha/beta access
- **Cookie-based authentication** (30-day expiry)
- **API routes excluded** from authentication
- **Static files excluded** from authentication
- **Clean auth UI** matching your app theme

### How it works:
1. User visits your Vercel URL
2. Middleware redirects to `/auth` if not authenticated
3. User enters password (set in `ALPHA_PASSWORD` env var)
4. On success, cookie is set and user is redirected to main app
5. Cookie persists for 30 days

## 🌐 Post-Deployment Checklist

- [ ] App loads at your Vercel URL
- [ ] Password protection works
- [ ] API endpoints respond correctly
- [ ] 3-ball auto-detection functions
- [ ] DataGolf integration works
- [ ] Position data displays correctly
- [ ] Toast notifications work

## 🚨 Troubleshooting

### Build Failures
```bash
# Clear Vercel cache and redeploy
vercel --prod --force
```

### Environment Variable Issues
```bash
# Check env vars are set
vercel env ls
```

### API Timeouts
- API routes have 30-second timeout (configured in vercel.json)
- Check Vercel function logs in dashboard

### Authentication Issues
- Verify `ALPHA_PASSWORD` is set in Vercel environment variables
- Check browser cookies aren't blocked
- Try incognito/private browsing

## 📊 Performance Optimization

The deployment includes:
- **60-second API caching** with 5-minute stale-while-revalidate
- **30-second function timeout** for DataGolf API calls
- **Optimized build** with Next.js 15.2.4
- **Static asset optimization** via Vercel edge network

## 🔄 Continuous Deployment

Once set up with GitHub integration:
1. Push code changes to `main` branch
2. Vercel automatically builds and deploys
3. Zero-downtime deployments
4. Preview deployments for pull requests

## 📱 Custom Domain (Optional)

1. In Vercel dashboard → Project Settings → Domains
2. Add your custom domain
3. Configure DNS records as shown
4. SSL certificates are auto-provisioned

---

**Your Golf Parlay Picker with 3-ball auto-detection is ready for alpha testing! 🏌️‍♂️** 