# 🔄 How to Restore v1.0 Stable Backup

**Created:** November 21, 2025
**Backup Tag:** `v1.0-stable-backup`
**Backup Branch:** `backup/v1.0-stable-single-user`

---

## 📋 What This Backup Contains

This is a **fully working single-user version** of PrimeAI with:

- ✅ Smart caching (instant contact list loading)
- ✅ Pull-to-refresh functionality
- ✅ Voice recording with auto-save
- ✅ Photo upload to Cloudinary
- ✅ N8N webhook integration
- ✅ All critical bugs fixed (edit with recordings, unsaved changes warnings)
- ✅ Works perfectly on TestFlight

**Last Known Working Commit:** `7acf8d1`

---

## 🚨 When to Use This Backup

Use this restore guide if:

- ❌ Authentication refactor broke the app
- ❌ Database migration failed
- ❌ App crashes after recent changes
- ❌ Need to revert to last known working state
- ❌ Multi-user implementation has issues

**DO NOT restore if you just want to reference old code** - use `git checkout` instead (see Quick Reference section).

---

## 🎯 Restore Options

Choose the scenario that matches your situation:

### Option A: Complete Restore (Nuclear Option)
**When:** Everything is broken, need to go back completely
**Impact:** Loses ALL changes after backup was created
**Time:** 5 minutes

### Option B: Cherry-Pick Restore
**When:** Only need specific files from backup
**Impact:** Keeps recent changes, restores select files
**Time:** 10 minutes

### Option C: Side-by-Side Comparison
**When:** Want to compare backup vs current code
**Impact:** No changes, just reference
**Time:** 2 minutes

---

## 📦 OPTION A: Complete Restore (Start Fresh)

### Step 1: Verify Backup Exists

```bash
# Navigate to project
cd /path/to/PrimeAI

# Check backup exists on GitHub
git fetch --all --tags

# List all tags (should see v1.0-stable-backup)
git tag -l

# List backup branch (should see backup/v1.0-stable-single-user)
git branch -a | grep backup
```

**Expected Output:**
```
v1.0-stable-backup
remotes/origin/backup/v1.0-stable-single-user
```

**❌ If backup doesn't exist:** Contact support or check BACKUP-README.md

---

### Step 2: Save Current Work (Just in Case)

```bash
# Check what you have now
git status

# If you have uncommitted changes, stash them
git stash save "Pre-restore backup $(date +%Y%m%d)"

# Create emergency branch of current state
git branch emergency-backup-$(date +%Y%m%d)

# Push emergency backup to GitHub
git push origin emergency-backup-$(date +%Y%m%d)
```

**Why:** This creates a safety net if you change your mind

---

### Step 3: Restore from Tag (Recommended Method)

```bash
# Option 3A: Create new branch from backup tag
git checkout -b restore-from-backup-$(date +%Y%m%d) v1.0-stable-backup

# Verify you're on the new branch
git branch

# Push to GitHub
git push origin restore-from-backup-$(date +%Y%m%d)
```

**OR**

```bash
# Option 3B: Reset current branch to backup
git checkout main  # or whatever branch you want to restore
git reset --hard v1.0-stable-backup

# ⚠️ WARNING: This deletes uncommitted changes!
# Only do this if you're SURE

# Push to GitHub (force push required)
git push origin main --force
```

---

### Step 4: Verify Restore Worked

```bash
# Check commit hash matches backup
git log --oneline -1
# Should show: 7acf8d1 Add comprehensive backup documentation

# Check file exists
ls -la BACKUP-README.md
# Should exist

# Check line count of key file
wc -l screens/ContactCaptureScreen.js
# Should show: 1404 screens/ContactCaptureScreen.js

# Check for smart caching code
grep -n "CACHE_EXPIRY_MS" screens/ContactListScreen.js
# Should show: 22:const CACHE_EXPIRY_MS = 5 * 60 * 1000;
```

**✅ If all checks pass:** Restore successful!
**❌ If checks fail:** See Troubleshooting section

---

### Step 5: Deploy to Railway

```bash
# If you restored to main branch, Railway auto-deploys
# Just push:
git checkout main
git push origin main

# Wait 2-3 minutes for Railway deployment
# Check Railway dashboard for deployment status
```

---

### Step 6: Rebuild for TestFlight (Optional)

**Only if you need to update TestFlight:**

```bash
# Build new version
eas build --platform ios --profile production

# Wait for build to complete (~10-15 minutes)

# Submit to TestFlight
eas submit --platform ios

# Wait for App Store processing (~30 minutes)
```

---

## 📦 OPTION B: Cherry-Pick Restore (Selective Files)

### When to Use

- You want to keep most of your recent changes
- Only specific files are broken
- Need to restore just ContactCaptureScreen or ContactListScreen

### Step 1: List Files in Backup

```bash
# Fetch backup
git fetch --all --tags

# See what files exist in backup
git show v1.0-stable-backup --name-only
```

### Step 2: Restore Specific Files

```bash
# Restore ContactCaptureScreen only
git checkout v1.0-stable-backup -- screens/ContactCaptureScreen.js

# Restore ContactListScreen only
git checkout v1.0-stable-backup -- screens/ContactListScreen.js

# Restore entire screens directory
git checkout v1.0-stable-backup -- screens/

# Restore config
git checkout v1.0-stable-backup -- config/api.js

# Restore server routes
git checkout v1.0-stable-backup -- server/routes/contacts.js
```

### Step 3: Commit Restored Files

```bash
# Check what was restored
git status

# Commit the restored files
git add -A
git commit -m "Restore files from v1.0 stable backup

Restored:
- screens/ContactCaptureScreen.js
- screens/ContactListScreen.js

Reason: [explain why you needed to restore]"

# Push
git push origin [your-branch-name]
```

---

## 📦 OPTION C: Side-by-Side Comparison

### View Backup Without Changing Anything

```bash
# Method 1: Checkout backup in detached HEAD state
git checkout v1.0-stable-backup

# Look around, read files, don't commit anything
# When done, return to your branch:
git checkout [your-branch-name]
```

```bash
# Method 2: Open backup in separate terminal
# Terminal 1:
cd /path/to/PrimeAI
git checkout v1.0-stable-backup

# Terminal 2:
cd /path/to/PrimeAI
git checkout [your-current-branch]

# Now you can compare files side-by-side
```

```bash
# Method 3: Use git show to view backup files
git show v1.0-stable-backup:screens/ContactCaptureScreen.js > /tmp/backup-capture.js
code /tmp/backup-capture.js  # Open in VS Code for comparison
```

---

## 🔧 Troubleshooting

### Problem: "Tag v1.0-stable-backup not found"

```bash
# Fetch tags from GitHub
git fetch --all --tags

# If still not found, list all tags
git tag -l

# Try using backup branch instead
git checkout backup/v1.0-stable-single-user
```

---

### Problem: "Branch backup/v1.0-stable-single-user doesn't exist"

```bash
# Fetch all branches
git fetch origin

# Create local branch from remote
git checkout -b backup/v1.0-stable-single-user origin/backup/v1.0-stable-single-user

# If remote doesn't exist, restore from tag
git checkout -b backup/v1.0-stable-single-user v1.0-stable-backup
```

---

### Problem: "Restore didn't work, app still broken"

```bash
# 1. Verify you're on the right commit
git log --oneline -1
# Should show: 7acf8d1

# 2. Check for uncommitted changes
git status
# Should say "nothing to commit, working tree clean"

# 3. Hard reset to backup
git reset --hard v1.0-stable-backup

# 4. Clean node_modules and rebuild
rm -rf node_modules
npm install

# 5. Clear app cache
# In Expo: Shake device → Clear cache → Reload
```

---

### Problem: "I restored but Railway is still broken"

```bash
# 1. Ensure main branch has the backup
git checkout main
git reset --hard v1.0-stable-backup
git push origin main --force

# 2. Check Railway logs in dashboard
# Look for deployment errors

# 3. Verify Railway environment variables
# DATABASE_URL, N8N_WEBHOOK_URL, PORT

# 4. Manually trigger Railway deployment
# In Railway dashboard: Deployments → Redeploy
```

---

### Problem: "TestFlight still has broken version"

```bash
# TestFlight doesn't auto-update, you need to rebuild

# 1. Restore code locally (as above)
# 2. Build new version
eas build --platform ios --profile production

# 3. Wait for build
# 4. Submit to TestFlight
eas submit --platform ios

# 5. Wait for Apple processing (~30 min)
# 6. Testers will see update in TestFlight app
```

---

## ✅ Verification Checklist

After restoring, verify these features work:

### Mobile App Tests

- [ ] App launches without crashes
- [ ] Contact list loads (should show cached contacts instantly)
- [ ] Pull-to-refresh works
- [ ] Can add new contact
- [ ] Can edit existing contact
- [ ] Can delete contact
- [ ] Voice recording works
- [ ] Photo upload works
- [ ] Edit contact with existing recording (no file error)
- [ ] Navigate between tabs without false warnings
- [ ] Make changes → navigate away → see warning
- [ ] Click "Save Changes" in warning → saves correctly

### Console Log Tests

Look for these emoji logs:

- [ ] `📦 Loaded X contacts from cache` (instant load)
- [ ] `⏰ Cache age: Xs, FRESH` (within 5 min)
- [ ] `🔄 Cache is stale` (after 5 min)
- [ ] `🌐 Syncing contacts from server`
- [ ] `✅ Synced X contacts from server`
- [ ] `💾 Saved X contacts to cache`
- [ ] `🗑️ Contacts cache invalidated` (after save/delete)

### Backend Tests

- [ ] Railway deployment successful
- [ ] Can fetch contacts: `curl https://your-railway-url/api/contacts`
- [ ] Database has contacts: Check Railway PostgreSQL
- [ ] N8N webhook works (if configured)

---

## 📊 What Each Restore Method Does

| Method | Changes Main | Changes Files | Keep Recent Work | Best For |
|--------|--------------|---------------|------------------|----------|
| **Tag Restore** | Yes (force) | Yes (all) | No | Complete disaster |
| **New Branch** | No | Yes (new branch) | Yes (old branch) | Safe testing |
| **Cherry-Pick** | Optional | Yes (selective) | Yes | Specific fixes |
| **Comparison** | No | No | Yes | Reference only |

---

## 🔍 Quick Reference Commands

### View Backup Info
```bash
# Show backup commit details
git show v1.0-stable-backup

# List files in backup
git ls-tree -r v1.0-stable-backup --name-only

# Compare current vs backup
git diff v1.0-stable-backup
```

### Find Backup Commit Hash
```bash
# Get exact commit hash
git rev-parse v1.0-stable-backup
# Returns: 7acf8d1...
```

### Restore Single File Quickly
```bash
git checkout v1.0-stable-backup -- path/to/file.js
```

### Undo Restore (if you made a mistake)
```bash
# If you saved to emergency-backup branch
git reset --hard emergency-backup-20251121

# Or if you stashed changes
git stash pop
```

---

## 📝 Database Considerations

### Current Database Schema (v1.0 Backup)

```sql
-- NO user_id column (single-user)
CREATE TABLE contacts (
  contact_id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  email VARCHAR(255),
  photo_url TEXT,
  has_recording BOOLEAN DEFAULT FALSE,
  recording_uri TEXT,
  transcript TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### If Restoring After Auth Migration

**⚠️ WARNING:** If you added authentication and added `user_id` column, restoring this backup will cause issues!

**Option 1: Keep New Database, Restore Code Only**
```bash
# Don't deploy backend to Railway
# Only restore mobile app code
git checkout v1.0-stable-backup -- screens/
git checkout v1.0-stable-backup -- App.js
git checkout v1.0-stable-backup -- config/

# Keep server/ unchanged (has user_id support)
```

**Option 2: Full Restore (Database Rollback)**
```bash
# 1. Restore code
git reset --hard v1.0-stable-backup
git push origin main --force

# 2. Railway auto-deploys old backend

# 3. Manually revert database schema
# Connect to Railway PostgreSQL
# Run: ALTER TABLE contacts DROP COLUMN user_id;

# ⚠️ This deletes user isolation! All contacts shared again!
```

---

## 🆘 Emergency Contacts

### If This Guide Doesn't Work

1. **Check GitHub:** https://github.com/ShortenTheGap/PrimeAI
   - Tags tab → v1.0-stable-backup
   - Branches → backup/v1.0-stable-single-user

2. **Read Backup README:** `BACKUP-README.md` in repository
   - Contains feature list
   - Known limitations
   - Testing checklist

3. **Railway Dashboard:** https://railway.app
   - Check deployment logs
   - Verify environment variables
   - Manual redeploy option

4. **Last Resort:**
   ```bash
   # Clone fresh from GitHub
   cd ~/Projects
   git clone https://github.com/ShortenTheGap/PrimeAI.git PrimeAI-fresh
   cd PrimeAI-fresh
   git checkout v1.0-stable-backup
   npm install
   ```

---

## 📅 Backup Information

**Created By:** Claude (Session: claude/setup-new-session-01EDutHX4vNsTjoE1XgUkq27)
**Date:** November 21, 2025
**Commit:** `7acf8d1`
**Tag:** `v1.0-stable-backup`
**Branch:** `backup/v1.0-stable-single-user`

**Files Count:** ~50 files
**Key Files Line Count:**
- ContactCaptureScreen.js: 1404 lines
- ContactListScreen.js: 401 lines
- SettingsScreen.js: ~450 lines

**Testing Status:** ✅ Fully tested and working on TestFlight
**Known Issues:** None (all bugs fixed)

---

## ✨ Success Indicators

**You'll know restore worked when:**

1. **App starts instantly** - No loading spinner on contact list (cache working)
2. **No false warnings** - Only warns when actually making changes
3. **Edit with recordings works** - No "file not found" error
4. **Logs show emoji** - 📦 💾 ⏰ 🌐 ✅ in console
5. **Pull-to-refresh smooth** - Works without errors
6. **All 3 tabs work** - Can navigate freely

**If you see these, you're good! 🎉**

---

**Remember:** This backup is your safety net. Don't delete it!

Keep these files safe:
- ✅ BACKUP-README.md (overview)
- ✅ RESTORE-INSTRUCTIONS.md (this file)
- ✅ Tag: v1.0-stable-backup (on GitHub)
- ✅ Branch: backup/v1.0-stable-single-user (on GitHub)
