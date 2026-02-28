# KAP Society & Admin Setup Guide for eregi-dev

## Overview

This guide walks you through setting up the KAP (Korean Academy of Periodology) society in the eregi-dev Firebase project, including configuring the admin user.

## Prerequisites

1. **Firebase Project**: eregi-dev (already created)
2. **Admin Account**: aaron@beoksolution.com (already exists in Firebase Auth)
3. **Admin UID**: fhA74HNo90fGppk2wNK63cO3gcz1

## Method 1: Automated Script (Recommended)

### Step 1: Download Service Account Key

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select project: **eregi-dev**
3. Navigate to: **Project Settings** → **Service Accounts**
4. Click **"Generate New Private Key"**
5. Save the file as `service-account.json` in the project root
6. **⚠️ IMPORTANT**: Never commit this file to git!

### Step 2: Set Environment Variable

```bash
# Linux/Mac
export GOOGLE_APPLICATION_CREDENTIALS="./service-account.json"

# Windows PowerShell
$env:GOOGLE_APPLICATION_CREDENTIALS=".\service-account.json"

# Windows CMD
set GOOGLE_APPLICATION_CREDENTIALS=.\service-account.json
```

### Step 3: Run Initialization Script

```bash
node scripts/init-kap-dev.mjs
```

The script will create:
1. ✅ `societies/kap` document
2. ✅ `super_admins/aaron@beoksolution.com` document

## Method 2: Manual Firebase Console Setup

If the script fails, follow these manual steps:

### Step 1: Create Society Document

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select project: **eregi-dev**
3. Navigate to: **Firestore Database**
4. Create collection: `societies`
5. Add document with ID: `kap`

**Document Fields:**
```json
{
  "id": "kap",
  "name": {
    "ko": "대한치주조치과학회",
    "en": "Korean Academy of Periodontology"
  },
  "description": {
    "ko": "치주조치과학 관련 학술 및 연구 활동",
    "en": "Academic and research activities in periodontology"
  },
  "adminEmails": ["aaron@beoksolution.com"],
  "settings": {
    "abstractEnabled": true
  },
  "createdAt": { ".sv": "Timestamp" }
}
```

### Step 2: Create Super Admin Document

1. In Firestore Database
2. Create collection: `super_admins`
3. Add document with ID: `aaron@beoksolution.com`

**Document Fields:**
```json
{
  "email": "aaron@beoksolution.com",
  "role": "SUPER_ADMIN",
  "createdAt": { ".sv": "Timestamp" }
}
```

## Verification

After setup, verify the configuration:

### 1. Check Firestore Data

**Society Document:**
- Path: `societies/kap`
- Fields: `name.ko`, `adminEmails`, `createdAt`

**Super Admin Document:**
- Path: `super_admins/aaron@beoksolution.com`
- Fields: `email`, `role`, `createdAt`

### 2. Test Admin Access

1. Go to: https://eregi-dev.web.app
2. Login with: aaron@beoksolution.com
3. Access URLs:
   - **Super Admin**: https://eregi-dev.web.app?admin=true
   - **Society Admin**: https://eregi-dev.web.app?society=kap

### 3. Verify Permissions

After logging in:
- ✅ Can see Super Admin dashboard
- ✅ Can create conferences for KAP
- ✅ Can manage verification codes
- ✅ Can access all admin features

## What Gets Created

### Society Document Structure

```
societies/kap
├── id: "kap"
├── name
│   ├── ko: "대한치주조치과학회"
│   └── en: "Korean Academy of Periodontology"
├── description
│   ├── ko: "치주조치과학 관련 학술 및 연구 활동"
│   └── en: "Academic and research activities in periodontology"
├── adminEmails: ["aaron@beoksolution.com"]
├── settings
│   └── abstractEnabled: true
└── createdAt: Timestamp
```

### Super Admin Document Structure

```
super_admins/aaron@beoksolution.com
├── email: "aaron@beoksolution.com"
├── role: "SUPER_ADMIN"
└── createdAt: Timestamp
```

## Common Issues & Solutions

### Issue 1: Script fails with permission error

**Solution:**
- Verify service account key path is correct
- Check service account has **Firestore Admin** role
- Confirm you're using eregi-dev project (not eregi-8fc1e)

### Issue 2: "Cannot read property of undefined"

**Solution:**
- Ensure `service-account.json` exists in project root
- Check `GOOGLE_APPLICATION_CREDENTIALS` env var is set
- Run `echo $GOOGLE_APPLICATION_CREDENTIALS` to verify

### Issue 3: Can't login as super admin

**Solution:**
- Verify Firebase Auth user exists: aaron@beoksolution.com
- Check `SUPER_ADMINS` constant in `src/constants/defaults.ts`
- Ensure `super_admins/{email}` document exists in Firestore

### Issue 4: Society admin not working

**Solution:**
- Confirm `societies/kap` document exists
- Verify `adminEmails` array contains the email
- Check browser URL includes `?society=kap` parameter

## Next Steps After Setup

1. **Create Test Conference**
   - Go to Super Admin dashboard
   - Create conference for KAP
   - Test registration flow

2. **Set Up Member Verification**
   - Generate verification codes
   - Test member registration

3. **Configure Payment**
   - Add Toss/Nice payment credentials
   - Test payment flow

4. **Test Full Flow**
   - Member registration
   - Abstract submission
   - Payment processing
   - Badge generation

## Environment Variables Reference

| Variable | Value | Purpose |
|----------|-------|---------|
| `GOOGLE_APPLICATION_CREDENTIALS` | `./service-account.json` | Service account key path |

## URL Reference

| Environment | URL | Purpose |
|-------------|-----|---------|
| eregi-dev | `https://eregi-dev.web.app` | Dev environment |
| Super Admin | `?admin=true` | Super admin access |
| Society Admin | `?society=kap` | KAP society admin access |

## Support

If you encounter issues:
1. Check Firebase Console for error messages
2. Verify Firestore rules allow write access
3. Confirm service account permissions
4. Check browser console for JavaScript errors
