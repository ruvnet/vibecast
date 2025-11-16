const { existsSync, readFileSync } = require('fs')
const { join } = require('path')

const { platform, arch } = process

let nativeBinding = null
let localFileExisted = false
let loadError = null

function isMusl() {
  // For Node 10
  if (!process.report || typeof process.report.getReport !== 'function') {
    try {
      const lddPath = require('child_process').execSync('which ldd').toString().trim()
      return readFileSync(lddPath, 'utf8').includes('musl')
    } catch (e) {
      return true
    }
  } else {
    const { glibcVersionRuntime } = process.report.getReport().header
    return !glibcVersionRuntime
  }
}

switch (platform) {
  case 'linux':
    switch (arch) {
      case 'x64':
        if (isMusl()) {
          localFileExisted = existsSync(join(__dirname, 'agentic-robotics.linux-x64-musl.node'))
          try {
            if (localFileExisted) {
              nativeBinding = require('./agentic-robotics.linux-x64-musl.node')
            } else {
              nativeBinding = require('agentic-robotics-linux-x64-musl')
            }
          } catch (e) {
            loadError = e
          }
        } else {
          localFileExisted = existsSync(join(__dirname, 'agentic-robotics.linux-x64-gnu.node'))
          try {
            if (localFileExisted) {
              nativeBinding = require('./agentic-robotics.linux-x64-gnu.node')
            } else {
              nativeBinding = require('agentic-robotics-linux-x64-gnu')
            }
          } catch (e) {
            loadError = e
          }
        }
        break
      case 'arm64':
        localFileExisted = existsSync(join(__dirname, 'agentic-robotics.linux-arm64-gnu.node'))
        try {
          if (localFileExisted) {
            nativeBinding = require('./agentic-robotics.linux-arm64-gnu.node')
          } else {
            nativeBinding = require('agentic-robotics-linux-arm64-gnu')
          }
        } catch (e) {
          loadError = e
        }
        break
      default:
        throw new Error(`Unsupported architecture on Linux: ${arch}`)
    }
    break
  case 'darwin':
    switch (arch) {
      case 'x64':
        localFileExisted = existsSync(join(__dirname, 'agentic-robotics.darwin-x64.node'))
        try {
          if (localFileExisted) {
            nativeBinding = require('./agentic-robotics.darwin-x64.node')
          } else {
            nativeBinding = require('agentic-robotics-darwin-x64')
          }
        } catch (e) {
          loadError = e
        }
        break
      case 'arm64':
        localFileExisted = existsSync(join(__dirname, 'agentic-robotics.darwin-arm64.node'))
        try {
          if (localFileExisted) {
            nativeBinding = require('./agentic-robotics.darwin-arm64.node')
          } else {
            nativeBinding = require('agentic-robotics-darwin-arm64')
          }
        } catch (e) {
          loadError = e
        }
        break
      default:
        throw new Error(`Unsupported architecture on macOS: ${arch}`)
    }
    break
  default:
    throw new Error(`Unsupported OS: ${platform}, architecture: ${arch}`)
}

if (!nativeBinding) {
  if (loadError) {
    throw loadError
  }
  throw new Error(`Failed to load native binding`)
}

const { AgenticNode, AgenticPublisher, AgenticSubscriber, PublisherStats } = nativeBinding

module.exports.AgenticNode = AgenticNode
module.exports.AgenticPublisher = AgenticPublisher
module.exports.AgenticSubscriber = AgenticSubscriber
module.exports.PublisherStats = PublisherStats
