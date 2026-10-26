# 🎵 expo-android-media-session-listener

[![npm version](https://img.shields.io/npm/v/expo-android-media-session-listener.svg?style=flat-square&color=cb3837)](https://www.npmjs.com/package/expo-android-media-session-listener)
[![npm downloads](https://img.shields.io/npm/dm/expo-android-media-session-listener.svg?style=flat-square&color=blue)](https://www.npmjs.com/package/expo-android-media-session-listener)
[![Platform](https://img.shields.io/badge/Platform-Android%20(API%2024%2B)-3DDC84.svg?style=flat-square&logo=android)](https://developer.android.com)
[![Expo](https://img.shields.io/badge/Expo-SDK%2050%2B%20%7C%2058-000020.svg?style=flat-square&logo=expo)](https://expo.dev)
[![React Native](https://img.shields.io/badge/React%20Native-0.73%2B%20%7C%200.88-61DAFB.svg?style=flat-square&logo=react)](https://reactnative.dev)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)

A high-performance **Expo Native Module** for Android that leverages Android's `MediaSessionManager` and `NotificationListenerService` APIs to observe active media playback events, extract real-time metadata and album artwork, track playback position, and interactively control media playback across **any** active media player on the device.

Works out of the box with **Spotify**, **YouTube**, **YouTube Music**, **SoundCloud**, **Apple Music**, **Samsung Music**, **Amazon Music**, **Audible**, **VLC**, and any media player that implements Android's `MediaSession` APIs.

---

## ✨ Features

- 🎧 **System-Wide Media Listening** — Intercept real-time playback state and metadata from any active media player on the device.
- 🖼️ **Live Album Artwork Extraction** — Automatically extracts embedded album art into local file URIs with **smart signature-based caching** (no UI flashing).
- ⏯️ **Interactive Playback Controls** — Trigger `play()`, `pause()`, `skipNext()`, `skipPrevious()`, and precision `seekTo(ms)` commands.
- ⏱️ **Real-Time Position & Duration** — Accurate track duration and playback position tracking in milliseconds.
- ⚡ **Synchronous & Asynchronous Access** — Subscribe to continuous live event streams (`addMediaListener`) or query instant state (`getState()`).
- 🛡️ **Clean Native Kotlin Layer** — Built with modern Expo Modules API, fully typed in TypeScript, zero external native bloat.
- 🚀 **Expo CNG Ready** — Works with Expo Prebuild, Config Plugins, and EAS Build.

---

## 📱 Compatibility & Requirements

| Requirement | Minimum / Supported Version |
|---|---|
| **Platform** | Android only (API level 24 / Android 7.0+) |
| **Expo SDK** | SDK 50, 51, 52, 57, 58+ |
| **React Native** | `>= 0.73` up to `0.88.x` |
| **Build System** | Expo Prebuild / CNG / Custom Dev Client or bare React Native (`Expo Go` is **not** supported due to custom native services) |

> [!IMPORTANT]
> Because this module uses Android's native `NotificationListenerService` (`android.permission.BIND_NOTIFICATION_LISTENER_SERVICE`) to access system media sessions, it **requires a custom development client (Expo Prebuild / CNG)**. It cannot run inside the precompiled Expo Go app.

---

## 📦 Installation

Install the package into your Expo or React Native project:

```bash
# Using Expo CLI (Recommended)
npx expo install expo-android-media-session-listener

# Using npm
npm install expo-android-media-session-listener

# Using yarn
yarn add expo-android-media-session-listener

# Using pnpm
pnpm add expo-android-media-session-listener

# Using bun
bun add expo-android-media-session-listener
```

### Prebuild Android Project

Generate or update your native Android build directories:

```bash
# Generate native Android project with autolinking
npx expo prebuild --platform android

# Run on an Android device or emulator
npx expo run:android
```

Or build a development client with **EAS Build**:

```bash
eas build --platform android --profile development
```

---

## 🔒 Android Permissions Setup

Android restricts access to system-wide media controllers to apps with **Notification Access** (`NotificationListenerService`). 

The module automatically registers its service in `AndroidManifest.xml` via Expo autolinking. At runtime, your app must prompt the user to enable notification access in Android Settings:

### Permission Workflow & AppState Hook

1. Call `hasPermission()` to check if permission has been granted.
2. If `false`, call `requestPermission()` to open the Android **Notification Access** settings screen.
3. Listen for `AppState` changes to detect when the user returns to the app and refresh state.

```typescript
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import * as MediaSession from 'expo-android-media-session-listener';

export function useNotificationPermission() {
  const [hasPermission, setHasPermission] = useState<boolean>(false);

  const check = () => {
    const granted = MediaSession.hasPermission();
    setHasPermission(granted);
    return granted;
  };

  useEffect(() => {
    check();

    // Re-check permission automatically when user switches back from Android Settings
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        check();
      }
    });

    return () => sub.remove();
  }, []);

  const request = () => {
    MediaSession.requestPermission();
  };

  return { hasPermission, requestPermission: request, checkPermission: check };
}
```

---

## ⚡ Quick Start

```typescript
import React, { useEffect, useState } from 'react';
import { View, Text, Button, Image, StyleSheet } from 'react-native';
import * as MediaSession from 'expo-android-media-session-listener';

export default function App() {
  const [media, setMedia] = useState<MediaSession.MediaEvent | null>(null);

  useEffect(() => {
    // 1. Check & request permission
    if (!MediaSession.hasPermission()) {
      MediaSession.requestPermission();
    }

    // 2. Hydrate initial state immediately
    const current = MediaSession.getState();
    if (current) setMedia(current);

    // 3. Subscribe to real-time playback updates
    const subscription = MediaSession.addMediaListener((event) => {
      console.log(`Now Playing: ${event.title} - ${event.artist} [${event.state}]`);
      setMedia(event);
    });

    return () => subscription.remove();
  }, []);

  if (!media) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>No active media detected.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {media.artworkUri && (
        <Image source={{ uri: media.artworkUri }} style={styles.art} />
      )}
      <Text style={styles.title}>{media.title}</Text>
      <Text style={styles.artist}>{media.artist}</Text>
      <Text style={styles.sub}>{media.album} ({media.package})</Text>

      <View style={styles.row}>
        <Button title="⏮ Prev" onPress={() => MediaSession.skipPrevious()} />
        <Button
          title={media.state === 'playing' ? '⏸ Pause' : '▶️ Play'}
          onPress={() => (media.state === 'playing' ? MediaSession.pause() : MediaSession.play())}
        />
        <Button title="⏭ Next" onPress={() => MediaSession.skipNext()} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' },
  text: { color: '#888' },
  art: { width: 220, height: 220, borderRadius: 12, marginBottom: 16 },
  title: { color: '#FFF', fontSize: 20, fontWeight: 'bold' },
  artist: { color: '#AAA', fontSize: 16, marginTop: 4 },
  sub: { color: '#666', fontSize: 12, marginTop: 4, marginBottom: 20 },
  row: { flexDirection: 'row', gap: 12 },
});
```

---

## 📖 Usage Guide & Examples

### 1. Real-time Track Listener

```typescript
import * as MediaSession from 'expo-android-media-session-listener';

const subscription = MediaSession.addMediaListener((event: MediaSession.MediaEvent) => {
  console.log('Title:', event.title);
  console.log('Artist:', event.artist);
  console.log('Album:', event.album);
  console.log('Package:', event.package);
  console.log('State:', event.state); // 'playing' | 'paused' | 'stopped' | 'buffering' | 'unknown'
  console.log('Position / Duration (ms):', event.position, '/', event.duration);
});

// To stop listening:
subscription.remove();
```

---

### 2. Displaying Album Artwork with Smart Caching

Album art is extracted into local disk cache with a signature hash based on `Title + Album`. The file URI remains stable during playback progress and only updates when the track changes:

```typescript
import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import * as MediaSession from 'expo-android-media-session-listener';

export function AlbumArt({ media }: { media: MediaSession.MediaEvent }) {
  if (!media.artworkUri) {
    return (
      <View style={[styles.artwork, styles.fallback]}>
        <Text style={styles.fallbackText}>No Artwork</Text>
      </View>
    );
  }

  return (
    <Image
      source={{ uri: media.artworkUri }}
      style={styles.artwork}
      resizeMode="cover"
    />
  );
}

const styles = StyleSheet.create({
  artwork: { width: 240, height: 240, borderRadius: 12 },
  fallback: { backgroundColor: '#1e1e1e', justifyContent: 'center', alignItems: 'center' },
  fallbackText: { color: '#666', fontSize: 12 },
});
```

---

### 3. Controlling Playback & Seeking

```typescript
import * as MediaSession from 'expo-android-media-session-listener';

// Transport controls
MediaSession.play();
MediaSession.pause();
MediaSession.skipNext();
MediaSession.skipPrevious();

// Jump to 30 seconds (30,000 ms)
MediaSession.seekTo(30000);

// Relative seek (forward 15s)
const current = MediaSession.getState();
if (current) {
  MediaSession.seekTo(Math.min(current.position + 15000, current.duration));
}
```

---

## 📚 API Reference

### `MediaEvent` Interface

```typescript
export interface MediaEvent {
  package: string;
  title: string;
  artist: string;
  album: string;
  state: 'playing' | 'paused' | 'stopped' | 'buffering' | 'unknown';
  position: number;    // In milliseconds
  duration: number;    // In milliseconds
  timestamp: number;   // Epoch timestamp (ms)
  artworkUri?: string; // File URI of cached cover art, or undefined
}
```

---

### Methods

| Method | Return Type | Description |
|---|---|---|
| `hasPermission()` | `boolean` | Checks if Notification Access permission is granted. |
| `requestPermission()` | `void` | Opens the system Notification Access settings screen. |
| `addMediaListener(callback)` | `EventSubscription` | Subscribes to live playback changes. Returns `{ remove() }`. |
| `getState()` | `MediaEvent \| null` | Synchronously returns the last known media state. |
| `play()` | `void` | Sends a play command to the active media session. |
| `pause()` | `void` | Sends a pause command to the active media session. |
| `skipNext()` | `void` | Skips to the next track. |
| `skipPrevious()` | `void` | Skips to the previous track. |
| `seekTo(positionMs)` | `void` | Seeks the active player to a specific timestamp in milliseconds. |

---

## 📱 Tested Media Players

| Player | Listening | Play/Pause | Skip Prev/Next | Seeking | Artwork |
|---|:---:|:---:|:---:|:---:|:---:|
| **Spotify** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **YouTube** | ✅ | ✅ | ✅ | ✅ | ⚠️ *(app-dependent)* |
| **YouTube Music** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Apple Music** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **SoundCloud** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Amazon Music** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Samsung Music** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **VLC for Android** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Audible** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Pocket Casts** | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## ❓ FAQ & Troubleshooting

- **Why does `hasPermission()` not update immediately after toggling in Settings?**  
  Android does not emit an activity result when returning from System Settings. Use `AppState.addEventListener('change', ...)` to re-check `MediaSession.hasPermission()` when your app returns to the `active` state.

- **Does this work in Expo Go?**  
  No. Android's `NotificationListenerService` requires custom native entries in `AndroidManifest.xml`. You must use a custom development build (`npx expo run:android` or EAS Build).

- **Why is `artworkUri` undefined?**  
  Some players (like standard YouTube or certain podcast apps) do not embed artwork bitmaps in their `MediaMetadata`. Always provide a fallback UI placeholder.

---

## 📝 Changelog

### v3.0.8
- **Security Audit & Path Traversal Fix**: Upgraded canonical path boundary validation in `ArtworkHelper` using trailing directory delimiter checks fully compatible with Android API 24+.
- **Atomic File Writing**: Artwork is written to `.tmp` files and atomically renamed to prevent file corruption or race conditions.
- **Memory Safety & Native Crash Prevention**: Removed unsafe manual `.recycle()` calls on foreign `MediaMetadata` bitmaps, eliminating native canvas recycling crashes.
- **Asynchronous Execution & ANR Elimination**: Moved bitmap extraction, scaling, and disk I/O off the main UI thread to a background executor in `MediaSessionService`, preventing UI stutter and Android ANR dialogs.
- **IPC & Binder Exception Safety**: Wrapped playback controls (`play`, `pause`, `skipNext`, `skipPrevious`, `seekTo`) in safe exception blocks handling `DeadObjectException`, `SecurityException`, and `RemoteException`.
- **Safe Intent Resolution**: Added package manager capability checks before starting notification listener settings to prevent `ActivityNotFoundException`.
- **Modern Notification Check**: Added `NotificationManagerCompat.getEnabledListenerPackages` detection with fallback to `Settings.Secure`.
- **Manifest & Permission Hardening**: Removed `SYSTEM_ALERT_WINDOW` and unneeded legacy storage permissions from production manifest; disabled insecure `allowBackup`.
- **Release Signing Security**: Configured standalone `signingConfigs.release` supporting external keystore properties instead of hardcoded debug keys.
- **Privacy & Compliance**: Added in-app prominent privacy disclosure in `App.tsx` and comprehensive `PRIVACY_POLICY.md` for Google Play notification policy compliance.

### v3.0.7
- **Security Hardening (Permissions)**: Fixed `hasPermission()` false-positive vulnerability by replacing raw substring checking with exact `ComponentName` package verification.
- **Security Hardening (Path Traversal)**: Sanitized package names and enforced strict canonical path validation within `ArtworkHelper` to eliminate arbitrary file write / path traversal risks.
- **Stability & Performance (ANR/OOM Prevention)**: Added automatic aspect-ratio downscaling for oversized album art bitmaps (>512px) with explicit bitmap memory recycling to prevent UI thread freezes and Out-Of-Memory crashes.
- **Concurrency & Thread Safety**: Wrapped `MediaEventManager` callbacks in `AtomicReference` to prevent multi-threaded race conditions between Android binder and React Native threads.
- **Lifecycle Optimization**: Implemented `OnStopObserving` to unsubscribe native listeners when all JavaScript subscribers unmount, eliminating background battery and CPU drain.
- **Memory Management**: Added stale `activeController` cleanup when source sessions disconnect, and introduced a bounded LRU memory cache for artwork metadata.

### v3.0.6
- **Published to npm**: Officially available on npm as `expo-android-media-session-listener`.
- **Expo SDK 58**: Fully compatible with Expo SDK 58, React Native `0.88.0`, React `19.3.0`, and `expo-modules-core` `~58.0.26`.

### v3.0.5
- **Updated**: Upgraded module dependencies to latest Expo SDK 58 (`~58.0.14`), React Native `0.88.0`, React `19.3.0`, and `expo-modules-core` `~58.0.22`.
- **Renamed**: Renamed module to `expo-android-media-session-listener`.
- **Packaging**: Updated build and packing script `pack.js` to build `expo-android-media-session-listener-3.0.5.tgz` with clean distribution files.

### v3.0.4
- **Updated**: Upgraded Expo to latest SDK 57 (`^57.0.28`).
- **Updated**: Upgraded React Native to `0.86.3`.
- **Updated**: Updated all Expo packages (`expo-font`, `expo-status-bar`, `expo-splash-screen`) and libraries to latest compatible versions.
- **Updated**: Migrated splash screen configuration to the `expo-splash-screen` config plugin format.
- **Updated**: Compiled clean native Android release APK build version 3.0.4.

### v3.0.3
- Minor internal codebase improvement.

### v3.0.2
- Minor internal codebase improvement.

### v3.0.1 (Patch 1)
- **Fixed**: Album artwork flashing on every event.
- **Added**: Smart artwork caching using Title+Album signature.

---

## 📄 License

MIT © [aditya8prakash](https://github.com/Aditya-Prakash-YT)
