# Backup Restore Instructions

## Backup Information

**Backup Branch:** `origin/claude/continue-context-work-01XzmFXzUtoiw1BMUT86LHhs`

**Latest Commit:** `a267534` - Fix stuck unsaved changes warning - clear form data when discarding

**Date Created:** November 28, 2025

**Build Number:** 28

---

## What's Included in This Backup

This backup includes all work from the session with the following features:

1. **Calendar Event Creation** - Native device calendar & N8N webhook options
2. **SMS Messaging** - Native SMS intent & N8N webhook options
3. **Contact Deletion** - Immediate UI update without success message
4. **Message Sending** - Loading spinner with immediate feedback
5. **Success Messages** - Shortened and concise
6. **Unsaved Changes Warning** - Fixed stuck warning issue
7. **Base64 Audio Encoding** - Fixed for N8N webhooks
8. **Smart Cache Updates** - Fixed 502 errors from full syncs
9. **Scroll to Top** - Auto-scroll when adding new contact

---

## Restore Instructions

### Option 1: Restore Entire Backup to Main Branch (Recommended)

Use this when you want to completely restore the app to this backup state.

```bash
# 1. Fetch latest from remote
git fetch origin

# 2. Switch to main branch
git checkout main

# 3. Reset main to the backup branch (this will discard any changes on main)
git reset --hard origin/claude/continue-context-work-01XzmFXzUtoiw1BMUT86LHhs

# 4. Verify the restore
git log --oneline -9

# 5. Push to origin/main (force push required)
git push origin main --force
```

**⚠️ WARNING:** This will completely replace your main branch with the backup. Any changes made after the backup will be lost.

---

### Option 2: Create a New Branch from Backup

Use this when you want to work from the backup without affecting main.

```bash
# 1. Fetch latest from remote
git fetch origin

# 2. Create a new branch from the backup
git checkout -b restore-from-backup origin/claude/continue-context-work-01XzmFXzUtoiw1BMUT86LHhs

# 3. Verify you're on the new branch
git branch
git log --oneline -9

# 4. Work on this branch and push when ready
git push -u origin restore-from-backup
```

---

### Option 3: Cherry-Pick Specific Commits

Use this when you only want specific fixes from the backup.

```bash
# 1. Fetch latest from remote
git fetch origin

# 2. View commits in the backup
git log origin/claude/continue-context-work-01XzmFXzUtoiw1BMUT86LHhs --oneline -9

# 3. Cherry-pick specific commits (replace <commit-hash> with actual hash)
git cherry-pick <commit-hash>

# Example: Only restore the 502 error fix
git cherry-pick a92832c
```

**Available commits to cherry-pick:**
- `a267534` - Fix stuck unsaved changes warning - clear form data when discarding
- `a92832c` - Fix 502 errors by updating cache instead of invalidating it
- `a677a7d` - Fix stuck unsaved changes warning - clear alert function on early return
- `83030a9` - Fix stuck unsaved changes warning appearing on every navigation
- `12c6d44` - Fix Base64 encoding error for audio recordings
- `861bb01` - Fix stuck unsaved changes warning
- `a253f82` - Improve UX with better feedback and streamlined messages
- `bab9270` - Fix contact deletion to update UI immediately
- `c43c4fa` - Update Follow-up button to respect calendar delivery method toggle

---

### Option 4: Compare Current Code with Backup

Use this to see what's different between current state and backup.

```bash
# 1. Fetch latest from remote
git fetch origin

# 2. Compare your current branch with backup
git diff HEAD..origin/claude/continue-context-work-01XzmFXzUtoiw1BMUT86LHhs

# 3. See list of changed files
git diff --name-status HEAD..origin/claude/continue-context-work-01XzmFXzUtoiw1BMUT86LHhs

# 4. View specific file differences
git diff HEAD..origin/claude/continue-context-work-01XzmFXzUtoiw1BMUT86LHhs -- screens/ContactCaptureScreen.js
```

---

## Verification After Restore

After restoring, verify the backup was successful:

```bash
# 1. Check current commit
git log --oneline -1
# Should show: a267534 Fix stuck unsaved changes warning - clear form data when discarding

# 2. Check branch status
git status

# 3. Verify app.json build number
cat app.json | grep buildNumber
# Should show: "buildNumber": 28

# 4. Run the app to test
npm start
```

---

## Key Files Modified in This Backup

- `screens/ContactCaptureScreen.js` - Main contact form with all fixes
- `screens/ContactListScreen.js` - Contact list with deletion fix
- `screens/SettingsScreen.js` - SMS and calendar delivery settings
- `App.js` - Tab navigation with unsaved changes handling
- `app.json` - Build 28 with calendar permissions
- `package.json` - Added expo-calendar dependency

---

## Emergency Rollback

If something goes wrong after restoring:

```bash
# 1. Find the commit you want to go back to
git reflog

# 2. Reset to that commit (replace <commit-hash>)
git reset --hard <commit-hash>

# 3. Force push if needed
git push origin main --force
```

---

## Support

If you encounter issues during restore:
1. Check that the backup branch still exists: `git branch -r | grep continue-context-work`
2. Ensure you have internet connection for git fetch/pull
3. Back up any local changes before restoring: `git stash` or `git branch backup-local-changes`

---

**Created:** November 28, 2025
**Session ID:** 01XzmFXzUtoiw1BMUT86LHhs
