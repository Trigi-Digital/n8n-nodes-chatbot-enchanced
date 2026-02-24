# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed

- **CRITICAL:** Fixed emergency timeout override bug in buffer message feature
  - Removed hardcoded 8-second emergency timeout that was overriding user's `bufferTime` configuration
  - Users can now use bufferTime values greater than 8 seconds (e.g., 30s, 60s, 120s)
  - Existing protections (circuit breaker, timeout protection, Redis health check) remain intact
  - See: `tech-spec-fix-emergency-timeout-override-buffer-message.md` for details

### Changed

- Improved buffer wait loop documentation with named constants
- Added reference to tech spec for buffer timeout configuration

## [1.0.0] - 2025-08-08

### Added

- Initial release of ChatBot Enhanced n8n node
- Redis-based state management
- Rate limiting with multiple algorithms
- Spam detection
- Message buffering
- Session management
- Analytics tracking
