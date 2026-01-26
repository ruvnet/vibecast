# Canadian Visa Requirements Gatherer

A comprehensive tool for tracking and comparing Canadian immigration program requirements across all federal and provincial programs. Uses claude-flow browser automation for reliable scraping of government websites.

## Features

- **28 Official Immigration Sources** tracked including:
  - Express Entry programs (FSW, FST, CEC, CRS)
  - All Provincial Nominee Programs (PNP)
  - Study permits and PGWP
  - Work permits and IEC
  - Visitor visas
  - Official news sources (IRCC, CIC News)

- **Change Detection** - Automatically compares current conditions against baseline
- **Historical Snapshots** - Track changes over time
- **Structured Data Extraction** - Extracts requirements, conditions, and key dates
- **Claude Flow Integration** - Works with claude-flow browser automation

## Installation

```bash
# Install claude-flow (full installation)
curl -fsSL https://cdn.jsdelivr.net/gh/ruvnet/claude-flow@main/scripts/install.sh | bash -s -- --full

# Install dependencies
npm install

# Install browser automation (optional, for JavaScript-heavy sites)
npx playwright install chromium
```

## Usage

### Command Line

```bash
# Gather all visa requirements and detect changes
npm run gather

# Gather Express Entry programs only
npm run gather:express

# Gather Provincial Nominee Programs only
npm run gather:pnp

# List all tracked programs
npm run list

# Quick change check (hash comparison only)
npm run check

# View historical snapshots
npm run history
```

### Programmatic Usage

```javascript
const {
  gatherVisaRequirements,
  getAllSources,
  getSourceById,
  quickChangeCheck
} = require('./src');

// Gather all requirements
const results = await gatherVisaRequirements();
console.log(results.report);

// Check for changes
const changes = await quickChangeCheck();
console.log(`Changes detected: ${changes.changesDetected}`);

// Get specific program
const source = getSourceById('ee-fsw');
console.log(source.name); // "Express Entry - Federal Skilled Worker Program"
```

### Claude Flow Agent

```bash
# Run as claude-flow browser agent
npx claude-flow@alpha browser-agent --script src/claude-flow-agent.js

# Or directly
node src/claude-flow-agent.js gatherAll
node src/claude-flow-agent.js gatherExpressEntry
node src/claude-flow-agent.js gatherPNP
node src/claude-flow-agent.js gatherProgram --programId=ee-fsw
```

## Tracked Programs

### Express Entry (5 sources)
- Federal Skilled Worker Program (ee-fsw)
- Federal Skilled Trades Program (ee-fst)
- Canadian Experience Class (ee-cec)
- CRS Scoring Criteria (ee-crs)
- Language Test Requirements (ee-lang)

### Work Programs (2 sources)
- International Experience Canada (wp-iec)
- General Work Permit (wp-general)

### Study Programs (4 sources)
- Study Permit (sp-main)
- Provincial Attestation Letter (sp-pal)
- Post-Graduation Work Permit (sp-pgwp)
- Student Spouse Work Permit (sp-spouse)

### Provincial Nominee Programs (13 sources)
- Ontario (OINP) - pnp-on
- British Columbia (BC PNP) - pnp-bc
- Alberta (AAIP) - pnp-ab
- Saskatchewan (SINP) - pnp-sk
- Manitoba (MPNP) - pnp-mb
- Quebec (Skilled Workers) - qc-skilled
- New Brunswick - pnp-nb
- Nova Scotia (NSNP) - pnp-ns
- PEI - pnp-pe
- Newfoundland (NLPNP) - pnp-nl
- Northwest Territories - pnp-nt
- Yukon - pnp-yt
- Nunavut - nu-imm

### Other Programs
- Visitor Visa (vp-trv)
- Economic Classes PR (ec-pr)

### News Sources (2 sources)
- CIC News (news-cic)
- IRCC Official Notices (news-ircc)

## Output

### Change Report

When changes are detected, the tool generates a detailed report:

```
================================================================================
CANADIAN VISA REQUIREMENTS - CHANGE REPORT
================================================================================

Baseline Date: 2024-01-15T10:00:00.000Z
Current Date:  2024-01-26T15:30:00.000Z

--------------------------------------------------------------------------------
NEW PROGRAMS DETECTED (1)
--------------------------------------------------------------------------------
  + [Provincial Nominee Program] New Stream Name
    Province: Ontario
    URL: https://example.com/new-stream

--------------------------------------------------------------------------------
PROGRAMS WITH CHANGES (3)
--------------------------------------------------------------------------------

[Express Entry] Federal Skilled Worker Program
URL: https://www.canada.ca/.../federal-skilled-workers.html
  * Content hash changed (page was updated)
  * Last modified: 2024-01-10 -> 2024-01-25

  NEW REQUIREMENTS (2):
    + Must have a valid language test result...
    + Must meet minimum education requirements...

  REMOVED REQUIREMENTS (1):
    - Previous requirement that no longer applies...

================================================================================
SUMMARY
================================================================================
  New Programs:     1
  Removed Programs: 0
  Changed Programs: 3
  Unchanged:        24
```

## Data Storage

- `data/baseline.json` - Current baseline for comparison
- `data/history/snapshot-*.json` - Historical snapshots

## Configuration

Edit `src/config/visa-sources.js` to:
- Add new immigration programs
- Update URLs if they change
- Customize CSS selectors for parsing

## License

ISC

## Author

rUv - Weekly Vibecast Live coding sessions
