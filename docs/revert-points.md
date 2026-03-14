# Revert Points

Safe commits to revert to if a future feature introduces issues.

## `ee56248` — Pre-Cascade Sheet Redesign (2026-03-14)

**What's included at this point:**
- Everything from `4dd5775` plus:
- Full data quality tracking system with waterfall data flow view
- HubSpot alignment fix (HAS_PROPERTY filter, lifecycle stage removal)
- Deal skip reason tracking, date anomalies, timing gaps, sparse combinations
- Discrepancy explanation section on Data Quality page
- Optimized deal fetch (closed-won only)
- 398 tests across 17 test files (all passing)
- CHANGELOG at v1.5.0

**How to revert:**
```bash
git reset --hard ee56248
git push --force origin main
```

**Why this is a safe point:**
- All tests pass, portal built and deployed successfully
- HubSpot data aligned (2,268 contacts match HubSpot report)
- Data quality system fully operational
- Clean state before cascade sheet redesign

---

## `4dd5775` — Pre-Data Quality Feature (2026-03-14)

**What's included at this point:**
- Full cascade model engine with HubSpot ELT sync
- Dynamic cascade sheets generated from HubSpot data
- Configurable sync (contact/deal property mapping, deal classification)
- Deal created date config question (5 deal properties total)
- Documentation page with timing distributions in Section 1
- Responsive UI for mobile/iPad
- Dashboard hero logo
- HubSpot sync on Refresh button
- Documentation link in top bar
- ILO renamed to "Inbound Led Outbound"
- 281 tests across 16 test files (all passing)
- CHANGELOG at v1.4.0

**How to revert:**
```bash
git revert HEAD..4dd5775   # revert all commits after this point
# or for a hard reset (destructive):
git reset --hard 4dd5775
git push --force origin main
```

**Why this is a safe point:**
- All tests pass
- Portal is built and deployed successfully
- All PM feedback (docs restructure, ILO rename, deal created date) is included
- Clean state before data quality/discrepancy handling feature
