# Agentic Robotics - Fixes and Improvements

This document provides concrete solutions for all issues found in the comprehensive review.

---

## CRITICAL FIX #1: Native Binding Loading

### Problem
The native bindings are installed but cannot be found by the loader.

### Solution A: Postinstall Script (Recommended)

Create `/scripts/link-bindings.js`:

```javascript
#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const platforms = {
  'linux-x64': 'linux-x64-gnu',
  'linux-arm64': 'linux-arm64-gnu',
  'darwin-x64': 'darwin-x64',
  'darwin-arm64': 'darwin-arm64'
};

const platform = process.platform;
const arch = process.arch;
const key = `${platform}-${arch}`;
const platformPkg = platforms[key];

if (!platformPkg) {
  console.log(`Platform ${key} not supported`);
  process.exit(0);
}

const sourceFile = path.join(
  __dirname,
  '..',
  'node_modules',
  '@agentic-robotics',
  platformPkg,
  `agentic-robotics.${platformPkg}.node`
);

const targetDirs = [
  path.join(__dirname, '..', 'node_modules', '@agentic-robotics', 'core'),
  path.join(__dirname, '..', 'node_modules', '@agentic-robotics', 'cli', 'node_modules', '@agentic-robotics', 'core')
];

if (!fs.existsSync(sourceFile)) {
  console.error(`Native binding not found: ${sourceFile}`);
  process.exit(1);
}

for (const targetDir of targetDirs) {
  if (fs.existsSync(targetDir)) {
    const targetFile = path.join(targetDir, `agentic-robotics.${platformPkg}.node`);
    try {
      fs.copyFileSync(sourceFile, targetFile);
      console.log(`✅ Linked native binding to ${targetFile}`);
    } catch (error) {
      console.error(`Failed to link to ${targetFile}:`, error.message);
    }
  }
}

console.log('✅ Native bindings linked successfully');
```

Update `agentic-robotics/package.json`:

```json
{
  "scripts": {
    "postinstall": "node scripts/link-bindings.js"
  }
}
```

### Solution B: Fix Require Statement

Update `@agentic-robotics/core/index.js` line 46:

```javascript
// Before:
nativeBinding = require('agentic-robotics-linux-x64-gnu')

// After:
nativeBinding = require('@agentic-robotics/linux-x64-gnu')
```

Apply same fix to all platform checks (lines 35, 46, 59, 78, 89).

### Solution C: Use pkg-dir to Find Bindings

```javascript
const pkgDir = require('pkg-dir');

async function loadNativeBinding() {
  const rootDir = await pkgDir(__dirname);
  const bindingPath = path.join(
    rootDir,
    'node_modules',
    '@agentic-robotics',
    platformPkg,
    `agentic-robotics.${platformPkg}.node`
  );

  if (existsSync(bindingPath)) {
    return require(bindingPath);
  }

  throw new Error(`Native binding not found at ${bindingPath}`);
}
```

---

## CRITICAL FIX #2: Message Serialization

### Problem
Publishing messages fails with "Serialization error: unsupported type"

### Investigation Steps

1. **Check Rust Implementation**
   - Review the `publish` function in Rust source
   - Verify JSON serialization logic
   - Check serde_json configuration

2. **Test with Different Data Types**

```javascript
// Test these variations:
await publisher.publish(JSON.stringify({ message: 'test' }));  // Object
await publisher.publish(JSON.stringify('test'));                // String
await publisher.publish(JSON.stringify(123));                   // Number
await publisher.publish(JSON.stringify(['test']));              // Array
await publisher.publish(JSON.stringify(null));                  // Null
await publisher.publish(JSON.stringify(true));                  // Boolean
```

3. **Add Debug Logging**

Update CLI test command:

```javascript
program
  .command('test')
  .option('-v, --verbose', 'Verbose output')
  .action(async (options) => {
    try {
      const testData = { message: 'Hello, World!', timestamp: Date.now() };
      const jsonString = JSON.stringify(testData);

      if (options.verbose) {
        console.log('Test data:', testData);
        console.log('JSON string:', jsonString);
        console.log('String length:', jsonString.length);
      }

      await publisher.publish(jsonString);
    } catch (error) {
      console.error('Detailed error:', error);
      if (options.verbose) {
        console.error('Stack:', error.stack);
      }
    }
  });
```

### Potential Rust Fix

If the Rust code has incorrect type handling:

```rust
// Incorrect (might be current implementation):
#[napi]
impl AgenticPublisher {
    #[napi]
    pub async fn publish(&self, data: JsObject) -> Result<()> {
        // Trying to serialize JsObject directly
    }
}

// Correct:
#[napi]
impl AgenticPublisher {
    #[napi]
    pub async fn publish(&self, data: String) -> Result<()> {
        // Accept string, parse as JSON in Rust
        let json: serde_json::Value = serde_json::from_str(&data)
            .map_err(|e| Error::from_reason(format!("Invalid JSON: {}", e)))?;

        // Serialize to bytes for transmission
        let bytes = serde_json::to_vec(&json)
            .map_err(|e| Error::from_reason(format!("Serialization failed: {}", e)))?;

        // Send bytes...
    }
}
```

---

## HIGH PRIORITY FIX: Security Vulnerabilities

### Fix Command

```bash
npm audit fix
```

### If Automatic Fix Doesn't Work

Update `package.json` dependencies:

```json
{
  "devDependencies": {
    "glob": "^11.0.4",
    "rimraf": "^6.0.0"
  }
}
```

Then:

```bash
npm install
npm audit
```

---

## MEDIUM PRIORITY: Documentation Updates

### Update CLI README

Add "Known Issues" section:

```markdown
## Known Issues

### Installation Issue (v0.2.1)

If you encounter `Error: Cannot find module 'agentic-robotics-linux-x64-gnu'`:

**Workaround:**
```bash
# After npm install, run:
cp node_modules/@agentic-robotics/linux-x64-gnu/*.node \
   node_modules/@agentic-robotics/cli/node_modules/@agentic-robotics/core/
```

This will be fixed in the next release.

### Message Publishing Issue (v0.2.1)

The `test` command currently fails with serialization errors. This is a known issue being addressed in the next release.
```

### Update Main README

```markdown
## Installation

```bash
npm install agentic-robotics
```

> **Note for v0.2.1 users:** See [Known Issues](#known-issues) if you encounter installation problems.

## Known Issues (v0.2.1)

- Native bindings may not be automatically linked after installation
- Message publishing in test mode is currently non-functional
- These issues are being addressed in v0.2.2

For workarounds, see the [troubleshooting guide](./TROUBLESHOOTING.md).
```

---

## TESTING IMPROVEMENTS

### Add Pre-Publish Test Script

`package.json`:

```json
{
  "scripts": {
    "test": "node test-installation.js",
    "prepublishOnly": "npm test"
  }
}
```

### Create Installation Test

`test-installation.js`:

```javascript
#!/usr/bin/env node

const { execSync } = require('child_process');
const { mkdtempSync, rmSync } = require('fs');
const { tmpdir } = require('os');
const path = require('path');

async function testInstallation() {
  const testDir = mkdtempSync(path.join(tmpdir(), 'agentic-test-'));

  try {
    console.log('🧪 Testing fresh installation...');

    // Create test package
    process.chdir(testDir);
    execSync('npm init -y', { stdio: 'ignore' });

    // Install package
    execSync('npm install agentic-robotics', { stdio: 'inherit' });

    // Test CLI
    console.log('\n✅ Testing CLI...');
    execSync('npx agentic-robotics info', { stdio: 'inherit' });

    // Test imports
    console.log('\n✅ Testing imports...');
    const { AgenticNode } = require('@agentic-robotics/core');
    const node = new AgenticNode('test');
    console.log('✅ Core imports work');

    console.log('\n✅ Installation test passed!');
    return true;
  } catch (error) {
    console.error('\n❌ Installation test failed:', error.message);
    return false;
  } finally {
    rmSync(testDir, { recursive: true, force: true });
  }
}

testInstallation().then(success => {
  process.exit(success ? 0 : 1);
});
```

---

## GITHUB ACTIONS CI/CD

`.github/workflows/test.yml`:

```yaml
name: Test Agentic Robotics

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main, develop ]

jobs:
  test:
    strategy:
      matrix:
        os: [ubuntu-latest, macos-latest]
        node: [18, 20, 22]

    runs-on: ${{ matrix.os }}

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run security audit
        run: npm audit --audit-level=moderate

      - name: Test CLI
        run: |
          npx agentic-robotics info
          npx agentic-robotics --version

      - name: Run unit tests
        run: npm test

      - name: Test fresh installation
        run: npm run test:install

  publish-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Check package can be packed
        run: npm pack --dry-run

      - name: Verify package contents
        run: |
          npm pack
          tar -tzf *.tgz | head -20
```

---

## IMPROVED ERROR HANDLING

### Better Error Messages in CLI

`cli/bin/cli.js`:

```javascript
program
  .command('test')
  .description('Test node creation and communication')
  .option('-v, --verbose', 'Show detailed error information')
  .action(async (options) => {
    console.log('🤖 Testing Agentic Robotics Node...');

    try {
      // Test 1: Native binding
      const { AgenticNode } = require('@agentic-robotics/core');
      console.log('✅ Native bindings loaded');

      // Test 2: Node creation
      const node = new AgenticNode('test-node');
      console.log('✅ Node created successfully');

      // Test 3: Publisher creation
      const publisher = await node.createPublisher('/test');
      console.log('✅ Publisher created');

      // Test 4: Message publishing
      try {
        await publisher.publish(JSON.stringify({
          message: 'Hello, World!',
          timestamp: Date.now()
        }));
        console.log('✅ Message published');

        const stats = publisher.getStats();
        console.log('✅ Stats:', stats);
      } catch (pubError) {
        console.error('❌ Publishing failed:', pubError.message);
        if (options.verbose) {
          console.error('Stack trace:', pubError.stack);
        }
        console.error('\n⚠️  Known issue in v0.2.1 - will be fixed in v0.2.2');
        process.exit(1);
      }
    } catch (error) {
      console.error('❌ Error:', error.message);

      if (error.message.includes('Cannot find module')) {
        console.error('\n⚠️  Native bindings not found!');
        console.error('\n📝 Workaround:');
        console.error('Run: npm run link-bindings');
        console.error('\nOr copy native bindings manually:');
        console.error('cp node_modules/@agentic-robotics/linux-x64-gnu/*.node \\');
        console.error('   node_modules/@agentic-robotics/cli/node_modules/@agentic-robotics/core/');
      }

      if (options.verbose) {
        console.error('\nFull error:', error);
      }

      process.exit(1);
    }
  });
```

---

## TROUBLESHOOTING GUIDE

Create `TROUBLESHOOTING.md`:

```markdown
# Troubleshooting Guide

## Error: Cannot find module 'agentic-robotics-linux-x64-gnu'

**Cause:** Native bindings not properly linked during installation.

**Solution:**

```bash
# Quick fix:
cp node_modules/@agentic-robotics/linux-x64-gnu/*.node \
   node_modules/@agentic-robotics/cli/node_modules/@agentic-robotics/core/

# Or reinstall:
rm -rf node_modules package-lock.json
npm install
```

## Error: Publish failed: Serialization error: unsupported type

**Cause:** Known bug in v0.2.1 native bindings.

**Status:** Being fixed in v0.2.2.

**Workaround:** None currently available. Upgrade to v0.2.2 when released.

## npm audit vulnerabilities

**Solution:**

```bash
npm audit fix
```

## MCP Server not responding

**Check:**

1. Server is running: `ps aux | grep agentic-robotics-mcp`
2. Database is accessible: `ls -la ros3-agentdb.db`
3. Port is not in use

**Debug mode:**

```bash
DEBUG=* agentic-robotics-mcp
```

## Node version compatibility

**Minimum:** Node.js >= 14.0.0

**Recommended:** Node.js >= 18.0.0

**Check version:**

```bash
node --version
```

**Upgrade Node:**

```bash
nvm install 20
nvm use 20
```
```

---

## IMPLEMENTATION CHECKLIST

### For v0.2.2 Release

- [ ] Fix native binding loading (Solution A or B)
- [ ] Debug and fix message serialization in Rust
- [ ] Run `npm audit fix`
- [ ] Update all READMEs with known issues
- [ ] Create TROUBLESHOOTING.md
- [ ] Add postinstall script
- [ ] Add pre-publish tests
- [ ] Set up GitHub Actions CI/CD
- [ ] Test on all supported platforms
- [ ] Update CHANGELOG.md
- [ ] Tag release: `git tag v0.2.2`

### Testing Checklist

- [ ] Fresh install on Ubuntu 22.04
- [ ] Fresh install on macOS (Intel & Apple Silicon)
- [ ] Test all CLI commands
- [ ] Run full test suite (expect 100% pass)
- [ ] Test MCP server startup
- [ ] Verify no security vulnerabilities
- [ ] Check package size (npm pack)
- [ ] Test npx usage without global install

---

## ESTIMATED TIMELINES

| Task | Time | Priority |
|------|------|----------|
| Fix native binding linking | 2-4h | CRITICAL |
| Fix serialization bug | 4-8h | CRITICAL |
| Security fixes | 0.5h | HIGH |
| Documentation updates | 2h | HIGH |
| Add tests | 4h | MEDIUM |
| CI/CD setup | 2h | MEDIUM |
| **Total** | **14.5-20.5h** | - |

**Recommended approach:** Fix critical issues first (6-12 hours), release v0.2.2, then add improvements in v0.3.0.

---

## CONTACT

For questions about these fixes:
- GitHub Issues: https://github.com/ruvnet/vibecast/issues
- Documentation: https://ruv.io/docs

---

**Document Version:** 1.0
**Last Updated:** 2025-11-18
