# Canadian Visa Requirements Gatherer

A comprehensive tool for tracking and comparing Canadian immigration program requirements across all federal and provincial programs. Uses claude-flow browser automation for reliable scraping of government websites. Includes detailed eligibility requirements for all 28 visa programs.

## Features

- **28 Official Immigration Sources** tracked including:
  - Express Entry programs (FSW, FST, CEC, CRS)
  - All Provincial Nominee Programs (PNP)
  - Study permits and PGWP
  - Work permits and IEC
  - Visitor visas
  - Official news sources (IRCC, CIC News)

- **Detailed Eligibility Requirements** for each program:
  - Minimum requirements and qualifications
  - Language proficiency levels (CLB/IELTS/TEF)
  - Work experience requirements
  - Education requirements
  - Points grids and scoring criteria
  - Available streams and pathways

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

# View eligibility requirements
node src/cli.js eligibility              # All programs
node src/cli.js eligibility ee-fsw       # Federal Skilled Worker
node src/cli.js eligibility pnp-on       # Ontario PNP
node src/cli.js eligibility sp-pgwp      # Post-Graduation Work Permit

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
  getEligibility,
  quickChangeCheck
} = require('./src');

// Gather all requirements
const results = await gatherVisaRequirements();
console.log(results.report);

// Get eligibility for specific program
const fswEligibility = getEligibility('ee-fsw');
console.log(fswEligibility.minimumRequirements);
console.log(fswEligibility.pointsGrid);

// Check for changes
const changes = await quickChangeCheck();
console.log(`Changes detected: ${changes.changesDetected}`);

// Get specific program
const source = getSourceById('ee-fsw');
console.log(source.name); // "Express Entry - Federal Skilled Worker Program"
console.log(source.eligibility); // Full eligibility object
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

## Eligibility Requirements

Each program includes structured eligibility data. Here's an example for the Federal Skilled Worker Program:

```
ELIGIBILITY REQUIREMENTS: Express Entry - Federal Skilled Worker Program

MINIMUM REQUIREMENTS:
  - Have at least 1 year of continuous full-time skilled work experience
  - Work experience must be in NOC TEER 0, 1, 2, or 3 occupation
  - Meet minimum language levels of CLB 7 for TEER 0/1, CLB 5 for TEER 2/3
  - Have Canadian high school credential or foreign equivalent with ECA
  - Score at least 67 points on the FSW points grid

LANGUAGE:
  Minimum: CLB 7 for TEER 0/1, CLB 5 for TEER 2/3
  Accepted Tests: IELTS General Training, CELPIP General, TEF Canada, TCF Canada

WORK EXPERIENCE:
  Minimum: 1 year continuous full-time or equivalent
  Recency: Within last 10 years
  Type: Skilled work in NOC TEER 0, 1, 2, or 3

EDUCATION:
  Minimum: Canadian secondary (high school) or foreign equivalent with ECA
  ECA Required: Yes

POINTS GRID:
  language: Max 28 points
  education: Max 25 points
  workExperience: Max 15 points
  age: Max 12 points
  arrangedEmployment: Max 10 points
  adaptability: Max 10 points
  Passing Score: 67 points
```

## Tracked Programs

### Express Entry (5 sources)
| ID | Program | Key Requirements |
|----|---------|------------------|
| ee-fsw | Federal Skilled Worker | 1yr experience, CLB 7, 67 points |
| ee-fst | Federal Skilled Trades | 2yr trade experience, CLB 5/4, job offer or certificate |
| ee-cec | Canadian Experience Class | 1yr Canadian experience, CLB 7/5 |
| ee-crs | CRS Scoring Criteria | Max 1200 points ranking system |
| ee-lang | Language Test Results | IELTS, CELPIP, TEF, TCF requirements |

### Work Programs (2 sources)
| ID | Program | Key Requirements |
|----|---------|------------------|
| wp-iec | International Experience Canada | Age 18-35, participating country citizenship |
| wp-general | Work Permit | LMIA or LMIA-exempt job offer |

### Study Programs (4 sources)
| ID | Program | Key Requirements |
|----|---------|------------------|
| sp-main | Study Permit | DLI enrollment, PAL, financial proof |
| sp-pal | Provincial Attestation Letter | Required since Jan 2024 (exceptions apply) |
| sp-pgwp | Post-Graduation Work Permit | 8+ month program, apply within 180 days |
| sp-spouse | Student Spouse Work Permit | Graduate/professional program student |

### Provincial Nominee Programs (13 sources)
| ID | Province | Key Streams |
|----|----------|-------------|
| pnp-on | Ontario | Employer Job Offer, Human Capital, Masters/PhD Graduate |
| pnp-bc | British Columbia | Skills Immigration, Express Entry BC, Entrepreneur |
| pnp-ab | Alberta | Opportunity Stream, Express Entry, Tech Pathway |
| pnp-sk | Saskatchewan | International Skilled Worker, Experience, Entrepreneur |
| pnp-mb | Manitoba | Skilled Worker, International Education, Business |
| qc-skilled | Quebec | Regular Skilled Worker, Quebec Experience (PEQ) |
| pnp-nb | New Brunswick | Express Entry, Employer Support, AIP |
| pnp-ns | Nova Scotia | Labour Market Priorities, Skilled Worker, AIP |
| pnp-pe | PEI | Express Entry, Labour Impact, Business |
| pnp-nl | Newfoundland | Express Entry, Skilled Worker, AIP |
| pnp-nt | NWT | Employer Driven, Business, Express Entry |
| pnp-yt | Yukon | Skilled Worker, Critical Impact, Business |
| nu-imm | Nunavut | Federal programs only (no PNP) |

### Other Programs
| ID | Program |
|----|---------|
| vp-trv | Visitor Visa (Temporary Resident Visa) |
| ec-pr | Economic Classes Permanent Residence |

### News Sources (2 sources)
| ID | Source |
|----|--------|
| news-cic | CIC News - Immigration News |
| news-ircc | IRCC Official Notices |

## Change Detection Report

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
- Modify eligibility requirements
- Customize CSS selectors for parsing

## API Reference

### Main Functions

```javascript
// Gather all requirements and detect changes
gatherVisaRequirements(options)

// Quick change check
quickChangeCheck(sourceIds?)

// Get eligibility for a program
getEligibility(programId)

// Get all eligibility summaries
getAllEligibilitySummaries()

// Format eligibility for display
formatEligibility(eligibility, indent)
```

### Options

```javascript
{
  category: 'express-entry' | 'pnp' | null,  // Filter by category
  sourceIds: ['ee-fsw', 'pnp-on'],           // Specific programs
  updateBaseline: true,                       // Update baseline after gather
  saveSnapshot: true,                         // Save historical snapshot
  useBrowser: false,                          // Use Playwright for JS sites
  concurrency: 3,                             // Concurrent requests
  timeout: 30000                              // Request timeout (ms)
}
```

## License

ISC

## Author

rUv - Weekly Vibecast Live coding sessions
