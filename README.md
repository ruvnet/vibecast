# vibecast
Weekly Vibecast Live coding sessions with rUv. Check branches for each week.

## Linux x64 Verification Results

**Date:** 2025-11-27
**Platform:** Linux x64
**Node.js:** v22.21.1

### Packages Tested

| Package | Version | Status |
|---------|---------|--------|
| @ruvector/tiny-dancer | 0.1.15 | Passed |
| @ruvector/tiny-dancer-linux-x64-gnu | 0.1.15 | Passed |
| @ruvector/router | 0.1.15 | Passed |
| @ruvector/router-linux-x64-gnu | 0.1.15 | Passed |

### Test Results Summary

**12 / 12 tests passed**

#### @ruvector/tiny-dancer
- Module import
- Router class
- version() (0.1.15)
- hello()

#### @ruvector/router
- Module import
- VectorDb class
- DistanceMetric enum
- VectorDb create
- insertAsync()
- count()
- searchAsync()
- getAllIds()

### Running Verification

```bash
npm install @ruvector/tiny-dancer@0.1.15 @ruvector/router@0.1.15
node verify-linux.js
``` 
