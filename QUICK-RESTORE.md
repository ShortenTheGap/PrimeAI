# ⚡ Quick Restore Reference

**For detailed instructions, see: RESTORE-INSTRUCTIONS.md**

---

## 🚨 Emergency: Restore Everything NOW

```bash
# 1. Go to project
cd /path/to/PrimeAI

# 2. Save current work (just in case)
git branch emergency-backup-$(date +%Y%m%d)
git push origin emergency-backup-$(date +%Y%m%d)

# 3. Restore from backup
git checkout -b restored-version v1.0-stable-backup

# 4. Deploy to Railway
git checkout main
git reset --hard v1.0-stable-backup
git push origin main --force

# Done! Railway will auto-deploy in ~2 minutes
```

---

## 🔧 Restore Just One File

```bash
# ContactCaptureScreen
git checkout v1.0-stable-backup -- screens/ContactCaptureScreen.js

# ContactListScreen
git checkout v1.0-stable-backup -- screens/ContactListScreen.js

# Config
git checkout v1.0-stable-backup -- config/api.js

# Commit
git add -A
git commit -m "Restore file from v1.0 backup"
git push
```

---

## 🔍 Compare Without Changing

```bash
# View backup without changing anything
git checkout v1.0-stable-backup

# Look around...

# Go back when done
git checkout [your-branch]
```

---

## ✅ Verify Restore Worked

```bash
# Check commit
git log --oneline -1
# Should show: 625c98b or 7acf8d1

# Check file size
wc -l screens/ContactCaptureScreen.js
# Should show: 1404

# Check for caching
grep "CACHE_EXPIRY_MS" screens/ContactListScreen.js
# Should find it
```

---

## 📋 Backup Details

- **Tag:** `v1.0-stable-backup`
- **Branch:** `backup/v1.0-stable-single-user`
- **Commit:** `7acf8d1` (or `625c98b` with docs)
- **Date:** November 21, 2025

---

## 🆘 If Backup Not Found

```bash
# Fetch from GitHub
git fetch --all --tags

# List tags
git tag -l | grep stable

# List branches
git branch -a | grep backup
```

---

**For full documentation:** Read `RESTORE-INSTRUCTIONS.md`
