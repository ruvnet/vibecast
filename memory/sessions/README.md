# Sessions Directory

This directory stores information about Claude-Flow orchestration sessions.

## Structure
- Each session gets its own subdirectory
- Session data includes tasks, coordination state, and results
- Session logs are automatically rotated

## Usage
Sessions are managed automatically during orchestration:
- Start sessions with `claude-flow start`
- Monitor sessions with `claude-flow status`
- Review session history with `claude-flow session list`

## Files
- `session-<id>/`: Individual session directories
- `active-sessions.json`: Currently active sessions
- `session-history.json`: Historical session data
