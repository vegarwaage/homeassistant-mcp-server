# Project Cleanup Proposal

## Current Issues
1. **Duplicate worktree** taking up space
2. **Documentation scattered** across 8+ files
3. **Old test scripts** no longer needed
4. **Plan files** from development phases
5. **Review files** that served their purpose

---

## Proposed Changes

### 🗑️ DELETE (Safe to Remove)

#### 1. Git Worktree
```bash
rm -rf .worktrees/
```
**Why:** Old feature branch, marked as "prunable", no longer needed

#### 2. Old Test Scripts
```bash
rm test-server-init.js
rm test-v2-tools.js
```
**Why:** Superseded by proper Jest tests in `tests/` directory

#### 3. Development Plan Files
```bash
rm -rf docs/plans/
```
**Why:** Historical planning documents, implementation is complete
**What they contain:**
- `2025-10-23-ha-mcp-server-implementation.md` - Initial design
- `2025-10-23-homeassistant-mcp-integration-design.md` - Integration design
- `2025-10-24-ha-mcp-http-oauth-design.md` - OAuth design
- `2025-10-25-ha-mcp-consolidation-and-enhancement.md` - Consolidation plan

#### 4. Review Documents
```bash
rm CODE_REVIEW.md
rm CODE_REVIEW_RESPONSE.md
rm TEST_REPORT.md
```
**Why:** One-time code review that's been addressed. Keep the fixes, not the reviews.

#### 5. Issue Docs
```bash
rm -rf docs/issues/
```
**Why:** Single issue file about permissions - addressed in v2.1.0

---

### 📝 CONSOLIDATE Documentation

**Current (8 files):**
- README.md (main)
- ADDON_INSTALL.md (installation)
- HTTP_OAUTH_GUIDE.md (HTTP setup)
- CHANGELOG.md (version history)
- API_LIMITATIONS.md (known issues)
- CODE_REVIEW.md (review)
- CODE_REVIEW_RESPONSE.md (response)
- TEST_REPORT.md (test results)

**Proposed (3 files):**

#### 1. **README.md** (Keep, enhance)
```
- Project overview
- Quick start
- Feature list (132 tools)
- stdio setup (current)
- Link to INSTALL.md for details
```

#### 2. **INSTALL.md** (New, consolidates 2 files)
```
Merge:
- ADDON_INSTALL.md
- HTTP_OAUTH_GUIDE.md

Structure:
- Prerequisites
- Option 1: Home Assistant Add-on (stdio)
- Option 2: HTTP Transport with OAuth
- Configuration options
- Troubleshooting
```

#### 3. **CHANGELOG.md** (Keep as-is)
```
- Version history
- Release notes
```

**Move API_LIMITATIONS.md:**
```bash
mkdir -p docs/technical
mv docs/API_LIMITATIONS.md docs/technical/
```

---

### 📁 REORGANIZE Directory Structure

#### Current Structure (Flat)
```
homeassistant-mcp-server/
├── README.md
├── ADDON_INSTALL.md
├── HTTP_OAUTH_GUIDE.md
├── CHANGELOG.md
├── CODE_REVIEW.md (delete)
├── CODE_REVIEW_RESPONSE.md (delete)
├── TEST_REPORT.md (delete)
├── docs/
│   ├── API_LIMITATIONS.md
│   ├── plans/ (delete)
│   └── issues/ (delete)
├── src/
├── tests/
└── ...
```

#### Proposed Structure (Clean)
```
homeassistant-mcp-server/
├── README.md                 # Main entry point
├── INSTALL.md                # Installation guide (consolidated)
├── CHANGELOG.md              # Version history
│
├── docs/
│   └── technical/
│       └── API_LIMITATIONS.md   # Technical notes
│
├── src/                      # Source code (unchanged)
│   ├── advanced/
│   ├── core/
│   ├── domain/
│   ├── system/
│   ├── tools/
│   └── transports/
│
├── tests/                    # Test suite (unchanged)
│   ├── core/
│   ├── domain/
│   ├── integration/
│   └── system/
│
├── config.yaml               # HA addon config
├── Dockerfile                # Container config
├── package.json              # Node dependencies
├── tsconfig.json             # TypeScript config
└── jest.config.cjs           # Test config
```

---

## Summary of Changes

### Files to DELETE (14 files + 1 directory)
- `.worktrees/` (entire directory)
- `test-server-init.js`
- `test-v2-tools.js`
- `docs/plans/` (4 files)
- `docs/issues/` (1 file)
- `CODE_REVIEW.md`
- `CODE_REVIEW_RESPONSE.md`
- `TEST_REPORT.md`

### Files to CREATE (1 file)
- `INSTALL.md` (consolidates ADDON_INSTALL.md + HTTP_OAUTH_GUIDE.md)

### Files to DELETE after consolidation (2 files)
- `ADDON_INSTALL.md` → merged into INSTALL.md
- `HTTP_OAUTH_GUIDE.md` → merged into INSTALL.md

### Files to MOVE (1 file)
- `docs/API_LIMITATIONS.md` → `docs/technical/API_LIMITATIONS.md`

### Files to KEEP (Core functionality)
- README.md ✅
- CHANGELOG.md ✅
- All src/ files ✅
- All tests/ files ✅
- All config files ✅

---

## Impact Analysis

### ✅ Safe (No Breaking Changes)
- App functionality: **Unchanged**
- Tests: **Unchanged**
- Build: **Unchanged**
- Deployment: **Unchanged**

### 📦 Benefits
- **75% fewer** documentation files (8 → 3)
- **Clearer** structure for new users
- **Easier** to maintain
- **Removed** 1.5 GB+ of duplicate code (.worktrees)

### ⚠️ Git History
- Deleted files remain in git history
- Can be recovered if needed
- Consider: Keep CODE_REVIEW.md archived in git, but remove from working directory

---

## Execution Plan

### Phase 1: Safe Deletions (Can't break anything)
```bash
git rm -rf .worktrees/
git rm test-server-init.js test-v2-tools.js
git rm -rf docs/plans/ docs/issues/
git rm CODE_REVIEW.md CODE_REVIEW_RESPONSE.md TEST_REPORT.md
```

### Phase 2: Documentation Consolidation
```bash
# Create new consolidated INSTALL.md
# Review and merge ADDON_INSTALL.md + HTTP_OAUTH_GUIDE.md

# Once verified, remove old files
git rm ADDON_INSTALL.md HTTP_OAUTH_GUIDE.md
```

### Phase 3: Reorganize Technical Docs
```bash
mkdir -p docs/technical
git mv docs/API_LIMITATIONS.md docs/technical/
```

### Phase 4: Commit
```bash
git commit -m "chore: cleanup project structure and consolidate documentation"
```

---

## Recommendation

**Execute in this order:**
1. ✅ Phase 1 first (safe, obvious wins)
2. ⏸️ Review proposed INSTALL.md before Phase 2
3. ✅ Phase 3 after reviewing
4. ✅ Phase 4 to commit everything

**Estimated time:** 15-20 minutes

Would you like me to proceed with this cleanup?
