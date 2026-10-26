# 📝 Changelog

All notable changes to the `expo-android-media-session-listener` native module and example application are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [3.0.8] - 2026-10-26

### Security & Hardening
- **Path Traversal Elimination**: Upgraded canonical boundary validation in `ArtworkHelper` with trailing directory delimiter checks fully compatible with Android API 24+.
- **Atomic File Writing**: Artwork is written to `.tmp` files and atomically renamed to prevent file corruption or race conditions.
- **Memory Safety & Native Crash Prevention**: Removed unsafe manual `.recycle()` calls on foreign `MediaMetadata` bitmaps, eliminating native canvas recycling crashes.
- **Asynchronous Execution & ANR Elimination**: Moved bitmap extraction, scaling, and disk I/O off the main UI thread to a background executor in `MediaSessionService`, preventing UI stutter and Android ANR dialogs.
- **IPC & Binder Exception Safety**: Wrapped playback controls (`play`, `pause`, `skipNext`, `skipPrevious`, `seekTo`) in safe exception blocks handling `DeadObjectException`, `SecurityException`, and `RemoteException`.
- **Safe Intent Resolution**: Added package manager capability checks before starting notification listener settings to prevent `ActivityNotFoundException`.
- **Modern Notification Check**: Added `NotificationManagerCompat.getEnabledListenerPackages` detection with fallback to `Settings.Secure`.
- **Manifest & Permission Hardening**: Removed `SYSTEM_ALERT_WINDOW` and unneeded legacy storage permissions from production manifest; disabled insecure `allowBackup`.
- **Release Signing Security**: Configured standalone `signingConfigs.release` supporting external keystore properties instead of hardcoded debug keys.
- **Privacy & Compliance**: Added in-app prominent privacy disclosure in `App.tsx` and comprehensive `PRIVACY_POLICY.md` for Google Play notification policy compliance.

---

## [3.0.7] - 2026-10-25

### Security & Architecture
- **Security Hardening (Permissions)**: Fixed `hasPermission()` false-positive vulnerability by replacing raw substring checking with exact `ComponentName` package verification.
- **Security Hardening (Path Traversal)**: Sanitized package names and enforced strict canonical path validation within `ArtworkHelper` to eliminate arbitrary file write / path traversal risks.
- **Stability & Performance (ANR/OOM Prevention)**: Added automatic aspect-ratio downscaling for oversized album art bitmaps (>512px) with explicit bitmap memory recycling to prevent UI thread freezes and Out-Of-Memory crashes.
- **Concurrency & Thread Safety**: Wrapped `MediaEventManager` callbacks in `AtomicReference` to prevent multi-threaded race conditions between Android binder and React Native threads.
- **Lifecycle Optimization**: Implemented `OnStopObserving` to unsubscribe native listeners when all JavaScript subscribers unmount, eliminating background battery and CPU drain.
- **Memory Management**: Added stale `activeController` cleanup when source sessions disconnect, and introduced a bounded LRU memory cache for artwork metadata.

---

## [3.0.6] - 2026-10-24

### Packaging & Compatibility
- **Published to npm**: Officially available on npm as `expo-android-media-session-listener`.
- **Expo SDK 58**: Fully compatible with Expo SDK 58, React Native `0.88.0`, React `19.3.0`, and `expo-modules-core` `~58.0.26`.
- **Refined Distribution**: Optimized package whitelist for minimal tarball footprint.

---

## [3.0.5] - 2026-10-20

### Dependencies & Packaging
- **Updated**: Upgraded module dependencies to latest Expo SDK 58 (`~58.0.14`), React Native `0.88.0`, React `19.3.0`, and `expo-modules-core` `~58.0.22`.
- **Renamed**: Renamed module to `expo-android-media-session-listener`.
- **Packaging**: Updated build and packing script `pack.js` to build `expo-android-media-session-listener-3.0.5.tgz` with clean distribution files.

---

## [3.0.4] - 2026-10-18

### Dependencies & Build
- **Updated**: Upgraded Expo to latest SDK 57 (`^57.0.28`).
- **Updated**: Upgraded React Native to `0.86.3`.
- **Updated**: Updated all Expo packages (`expo-font`, `expo-status-bar`, `expo-splash-screen`) and libraries to latest compatible versions.
- **Updated**: Migrated splash screen configuration to the `expo-splash-screen` config plugin format.
- **Updated**: Compiled clean native Android release APK build version 3.0.4.

---

## [3.0.3] - 2026-10-15

### Maintenance
- Minor internal codebase improvement.

---

## [3.0.2] - 2026-10-14

### Maintenance
- Minor internal codebase improvement.

---

## [3.0.1] - 2026-10-12

### Bug Fixes
- **Fixed**: Album artwork flashing on every event.
- **Added**: Smart artwork caching using Title+Album signature.
