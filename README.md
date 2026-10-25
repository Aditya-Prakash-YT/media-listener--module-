# 🎵 expo-android-media-session-listener

[![npm version](https://img.shields.io/npm/v/expo-android-media-session-listener.svg?style=flat-square&color=cb3837)](https://www.npmjs.com/package/expo-android-media-session-listener)
[![npm downloads](https://img.shields.io/npm/dm/expo-android-media-session-listener.svg?style=flat-square&color=blue)](https://www.npmjs.com/package/expo-android-media-session-listener)
[![Platform](https://img.shields.io/badge/Platform-Android%20(API%2024%2B)-3DDC84.svg?style=flat-square&logo=android)](https://developer.android.com)
[![Expo](https://img.shields.io/badge/Expo-SDK%2050%2B%20%7C%2058-000020.svg?style=flat-square&logo=expo)](https://expo.dev)
[![React Native](https://img.shields.io/badge/React%20Native-0.73%2B%20%7C%200.88-61DAFB.svg?style=flat-square&logo=react)](https://reactnative.dev)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)

A high-performance **Expo Native Module** for Android that leverages the Android `MediaSessionManager` and `NotificationListenerService` APIs to observe active media playback events, extract real-time metadata and album artwork, track playback position, and interactively control media playback across **any** active media player on the device.

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

## 📋 Table of Contents

- [Compatibility & Requirements](#-compatibility--requirements)
- [Installation](#-installation)
- [Android Permissions Setup](#-android-permissions-setup)
- [Quick Start](#-quick-start)
- [Usage Guide & Examples](#-usage-guide--examples)
  - [1. Real-time Track Listener](#1-real-time-track-listener)
  - [2. Displaying Album Artwork](#2-displaying-album-artwork)
  - [3. Controlling Playback](#3-controlling-playback)
  - [4. Precision Seeking & Progress Tracking](#4-precision-seeking--progress-tracking)
  - [5. Full Production Media Player Component](#5-full-production-media-player-component)
- [API Reference](#-api-reference)
  - [Types & Interfaces](#types--interfaces)
  - [Permission Methods](#permission-methods)
  - [Listener Methods](#listener-methods)
  - [Playback Control Methods](#playback-control-methods)
- [Architecture & How It Works](#-architecture--how-it-works)
- [Tested Media Players](#-tested-media-players)
- [Troubleshooting & FAQ](#-troubleshooting--faq)
- [Local Development & Example App](#-local-development--example-app)
- [Changelog](#-changelog)
- [License](#-license)

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

Install the package from npm using your preferred package manager:

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

### Native Android Prebuild

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

### Permission Workflow

1. Call `hasPermission()` to check if the permission is already granted.
2. If `false`, call `requestPermission()` to immediately open the Android **Notification Access** settings screen.
3. The user toggles the switch for your app.
4. Listen for `AppState` changes to detect when the user returns to the app and refresh state.

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
    // 1. Verify Android Notification Access
    if (!MediaSession.hasPermission()) {
      MediaSession.requestPermission();
    }

    // 2. Fetch current media immediately on mount
    const current = MediaSession.getState();
    if (current) setMedia(current);

    // 3. Subscribe to real-time playback events
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

Use `addMediaListener` to receive continuous updates as tracks change or playback states update:

```typescript
import * as MediaSession from 'expo-android-media-session-listener';

const subscription = MediaSession.addMediaListener((event: MediaSession.MediaEvent) => {
  console.log('Track Title:', event.title);
  console.log('Artist:', event.artist);
  console.log('Album:', event.album);
  console.log('Source App Package:', event.package);
  console.log('Playback State:', event.state); // 'playing' | 'paused' | 'stopped' | 'buffering' | 'unknown'
  console.log('Position / Duration (ms):', event.position, '/', event.duration);
});

// Always unsubscribe when unmounting:
subscription.remove();
```

---

### 2. Displaying Album Artwork

The native module extracts high-resolution album art from `MediaMetadata` into local cache storage with **signature-based caching** (Title + Album hash). This ensures image URLs only change when the track changes, eliminating image flashing during position updates:

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
  artwork: { width: 260, height: 260, borderRadius: 8 },
  fallback: { backgroundColor: '#1a1a1a', justifyContent: 'center', alignItems: 'center' },
  fallbackText: { color: '#666', fontSize: 12 },
});
```

---

### 3. Controlling Playback

Send playback commands to the active media session from anywhere in your app:

```typescript
import * as MediaSession from 'expo-android-media-session-listener';

// Play / Resume
MediaSession.play();

// Pause
MediaSession.pause();

// Skip to Next Track
MediaSession.skipNext();

// Skip to Previous Track
MediaSession.skipPrevious();
```

---

### 4. Precision Seeking & Progress Tracking

Jump to exact timestamps in milliseconds using `seekTo(positionMs)`:

```typescript
import * as MediaSession from 'expo-android-media-session-listener';

// Jump to 45 seconds (45,000 ms)
MediaSession.seekTo(45000);

// Fast-forward 10 seconds from current position
const current = MediaSession.getState();
if (current) {
  const target = Math.min(current.position + 10000, current.duration);
  MediaSession.seekTo(target);
}

// Rewind 10 seconds
if (current) {
  const target = Math.max(0, current.position - 10000);
  MediaSession.seekTo(target);
}
```

---

### 5. Full Production Media Player Component

Below is a complete, beautifully designed player component featuring a draggable slider, smooth local timer progress, formatted MM:SS timestamps, and playback controls:

```tsx
import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  PanResponder,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import * as MediaSession from 'expo-android-media-session-listener';

export default function FullMediaPlayer() {
  const [media, setMedia] = useState<MediaSession.MediaEvent | null>(null);
  const [displayPosition, setDisplayPosition] = useState(0);
  const [sliderWidth, setSliderWidth] = useState(0);
  const isDragging = useRef(false);
  const trackPositionRef = useRef(0);
  const sliderXRef = useRef(0);

  // Sync state and listen for real-time events
  useEffect(() => {
    if (!MediaSession.hasPermission()) {
      MediaSession.requestPermission();
      return;
    }

    const current = MediaSession.getState();
    if (current) {
      setMedia(current);
      trackPositionRef.current = current.position;
      setDisplayPosition(current.position);
    }

    const subscription = MediaSession.addMediaListener((event) => {
      setMedia(event);
      if (!isDragging.current) {
        trackPositionRef.current = event.position;
        setDisplayPosition(event.position);
      }
    });

    // Local 1-second ticker for smooth progress while playing
    const interval = setInterval(() => {
      if (media?.state === 'playing' && !isDragging.current) {
        trackPositionRef.current += 1000;
        setDisplayPosition(trackPositionRef.current);
      }
    }, 1000);

    return () => {
      subscription.remove();
      clearInterval(interval);
    };
  }, [media?.state]);

  // Draggable seek bar gesture handling
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        isDragging.current = true;
        sliderXRef.current = evt.nativeEvent.pageX - evt.nativeEvent.locationX;
      },
      onPanResponderMove: (evt, gesture) => {
        if (!sliderWidth || !media?.duration) return;
        const touchX = Math.max(0, Math.min(gesture.moveX - sliderXRef.current, sliderWidth));
        const ratio = touchX / sliderWidth;
        setDisplayPosition(Math.floor(ratio * media.duration));
      },
      onPanResponderRelease: (evt, gesture) => {
        if (!sliderWidth || !media?.duration) {
          isDragging.current = false;
          return;
        }
        const touchX = Math.max(0, Math.min(gesture.moveX - sliderXRef.current, sliderWidth));
        const ratio = touchX / sliderWidth;
        const targetMs = Math.floor(ratio * media.duration);

        MediaSession.seekTo(targetMs);
        trackPositionRef.current = targetMs;
        setDisplayPosition(targetMs);
        isDragging.current = false;
      },
    })
  ).current;

  const formatTime = (ms: number) => {
    if (!ms || ms < 0) return '0:00';
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  if (!media) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.idleTitle}>NO MEDIA PLAYING</Text>
        <Text style={styles.idleSub}>Start playback in Spotify, YouTube, or any music app.</Text>
      </View>
    );
  }

  const progressPercent = media.duration > 0
    ? Math.min(100, Math.max(0, (displayPosition / media.duration) * 100))
    : 0;

  return (
    <View style={styles.container}>
      {/* Artwork */}
      {media.artworkUri ? (
        <Image source={{ uri: media.artworkUri }} style={styles.artwork} resizeMode="cover" />
      ) : (
        <View style={[styles.artwork, styles.artworkPlaceholder]}>
          <Text style={{ color: '#444', fontSize: 32 }}>🎵</Text>
        </View>
      )}

      {/* Metadata */}
      <Text style={styles.title} numberOfLines={1}>{media.title || 'Unknown Title'}</Text>
      <Text style={styles.artist} numberOfLines={1}>{media.artist || 'Unknown Artist'}</Text>
      <Text style={styles.album} numberOfLines={1}>{media.album}</Text>

      {/* Seek Progress Bar */}
      <View
        {...panResponder.panHandlers}
        style={styles.sliderTouchArea}
        onLayout={(e) => setSliderWidth(e.nativeEvent.layout.width)}
      >
        <View style={styles.trackBackground}>
          <View style={[styles.trackFill, { width: `${progressPercent}%` }]} />
        </View>
      </View>

      <View style={styles.timeRow}>
        <Text style={styles.timeLabel}>{formatTime(displayPosition)}</Text>
        <Text style={styles.timeLabel}>{formatTime(media.duration)}</Text>
      </View>

      {/* Controls */}
      <View style={styles.controlsRow}>
        <TouchableOpacity style={styles.controlBtn} onPress={() => MediaSession.skipPrevious()}>
          <Text style={styles.controlText}>⏮</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.playPauseBtn}
          onPress={() => (media.state === 'playing' ? MediaSession.pause() : MediaSession.play())}
        >
          <Text style={styles.playPauseText}>
            {media.state === 'playing' ? '⏸' : '▶'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.controlBtn} onPress={() => MediaSession.skipNext()}>
          <Text style={styles.controlText}>⏭</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.packageTag}>SOURCE: {media.package}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0A', alignItems: 'center', justifyContent: 'center', padding: 24 },
  centerContainer: { flex: 1, backgroundColor: '#0A0A0A', alignItems: 'center', justifyContent: 'center', padding: 24 },
  idleTitle: { color: '#FFF', fontSize: 16, fontWeight: '700', letterSpacing: 1.5, marginBottom: 8 },
  idleSub: { color: '#666', fontSize: 13, textAlign: 'center' },
  artwork: { width: 280, height: 280, borderRadius: 16, marginBottom: 28 },
  artworkPlaceholder: { backgroundColor: '#161616', justifyContent: 'center', alignItems: 'center' },
  title: { color: '#FFF', fontSize: 22, fontWeight: 'bold', textAlign: 'center', width: '100%' },
  artist: { color: '#AAA', fontSize: 16, marginTop: 4, textAlign: 'center', width: '100%' },
  album: { color: '#555', fontSize: 13, marginTop: 2, marginBottom: 24, textAlign: 'center', width: '100%' },
  sliderTouchArea: { width: '100%', height: 32, justifyContent: 'center' },
  trackBackground: { height: 6, backgroundColor: '#222', borderRadius: 3, overflow: 'hidden' },
  trackFill: { height: '100%', backgroundColor: '#FFF', borderRadius: 3 },
  timeRow: { width: '100%', flexDirection: 'row', justifyContent: 'space-between', marginTop: 4, marginBottom: 20 },
  timeLabel: { color: '#777', fontSize: 11, fontVariant: ['tabular-nums'] },
  controlsRow: { flexDirection: 'row', alignItems: 'center', gap: 36, marginBottom: 28 },
  controlBtn: { padding: 12 },
  controlText: { color: '#FFF', fontSize: 26 },
  playPauseBtn: { width: 68, height: 68, borderRadius: 34, backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center' },
  playPauseText: { color: '#000', fontSize: 28, marginLeft: 2 },
  packageTag: { color: '#444', fontSize: 10, letterSpacing: 1 },
});
```

---

## 📚 API Reference

### Types & Interfaces

```typescript
export interface MediaEvent {
  /** The Android application package name of the active player (e.g., 'com.spotify.music') */
  package: string;

  /** Track title */
  title: string;

  /** Artist name */
  artist: string;

  /** Album name */
  album: string;

  /** Current playback state */
  state: 'playing' | 'paused' | 'stopped' | 'buffering' | 'unknown';

  /** Current playback position in milliseconds */
  position: number;

  /** Total track duration in milliseconds */
  duration: number;

  /** Unix epoch timestamp (ms) when this event was emitted */
  timestamp: number;

  /** Local file URI of the extracted album artwork (cached), or undefined if unavailable */
  artworkUri?: string;
}
```

---

### Permission Methods

#### `hasPermission(): boolean`
Returns `true` if Notification Listener Access has been granted by the user.

```typescript
const isGranted: boolean = MediaSession.hasPermission();
```

#### `requestPermission(): void`
Opens the Android **Notification Access** settings screen (`Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS`), allowing the user to grant access.

```typescript
MediaSession.requestPermission();
```

---

### Listener Methods

#### `addMediaListener(callback: (event: MediaEvent) => void): EventSubscription`
Registers a listener callback for real-time media session changes (`onMediaChanged`). Returns an `EventSubscription` with a `.remove()` method to unsubscribe.

```typescript
const subscription = MediaSession.addMediaListener((event) => {
  console.log('Track updated:', event.title);
});

// To clean up:
subscription.remove();
```

#### `getState(): MediaEvent | null`
Synchronously retrieves the last known `MediaEvent` state directly from native memory without waiting for an event. Useful for hydrating UI immediately on component mount.

```typescript
const currentMedia = MediaSession.getState();
```

---

### Playback Control Methods

| Method | Return Type | Description |
|---|---|---|
| `play()` | `void` | Sends a play command to the active media session. |
| `pause()` | `void` | Sends a pause command to the active media session. |
| `skipNext()` | `void` | Skips to the next track. |
| `skipPrevious()` | `void` | Skips to the previous track. |
| `seekTo(position: number)` | `void` | Seeks the active player to a specific position in **milliseconds**. |

```typescript
// Examples:
MediaSession.play();
MediaSession.pause();
MediaSession.skipNext();
MediaSession.skipPrevious();
MediaSession.seekTo(120000); // 2 minutes in ms
```

---

## 🏗 Architecture & How It Works

```
┌─────────────────────────────────────────────────────────────────┐
│                       React Native / Expo                       │
│                                                                 │
│   import * as MediaSession from                                 │
│   'expo-android-media-session-listener';                        │
│                                                                 │
│   • MediaSession.addMediaListener(listener)                     │
│   • MediaSession.getState()                                     │
│   • MediaSession.play() / pause() / skipNext() / seekTo(ms)     │
└───────────────────────────────┬─────────────────────────────────┘
                                │ Expo Modules Bridge
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Native Android Layer (Kotlin)                │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                MediaSessionModule.kt                      │  │
│  │  - Exposes JS methods and emits "onMediaChanged"          │  │
│  └────────────────────────────┬──────────────────────────────┘  │
│                               │ Singleton Callback              │
│                               ▼                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                MediaEventManager.kt                       │  │
│  │  - Manages thread-safe communication & event dispatch     │  │
│  └────────────────────────────▲──────────────────────────────┘  │
│                               │ Updates                         │
│  ┌────────────────────────────┴──────────────────────────────┐  │
│  │                MediaSessionService.kt                     │  │
│  │  - Extends Android's NotificationListenerService          │  │
│  │  - Intercepts MediaSessionManager active sessions         │  │
│  │  - Extracts Metadata, PlaybackState, and Bitmaps          │  │
│  │  - Signature-based smart artwork disk caching             │  │
│  └────────────────────────────▲──────────────────────────────┘  │
└───────────────────────────────┼─────────────────────────────────┘
                                │
                                ▼
         Android MediaSessionManager / Active Media App
       (Spotify, YouTube, Apple Music, SoundCloud, etc.)
```

1. **Service Registration**: `MediaSessionService` extends Android's `NotificationListenerService`, which gives it the system privilege to observe `MediaSessionManager.getActiveSessions()`.
2. **Session Monitoring**: Whenever an external app starts playing, pauses, or changes tracks, the active `MediaController` invokes `onMetadataChanged` and `onPlaybackStateChanged`.
3. **Artwork Extraction**: Bitmaps are extracted from `MediaMetadata.METADATA_KEY_ALBUM_ART` or `METADATA_KEY_ART`, compressed, and written to a cached file. A signature of `Title + Album` prevents regenerating the image unless the track actually changes.
4. **Bridge Delivery**: Extracted metadata is routed through `MediaEventManager` to `MediaSessionModule`, which emits an `onMediaChanged` event to your React Native listeners.

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

## ❓ Troubleshooting & FAQ

### 1. `hasPermission()` returns `false` even after toggling the switch
Android does not send an explicit activity callback when returning from the system Settings screen.
**Solution**: Use `AppState.addEventListener('change', ...)` as shown in the [Permissions section](#-android-permissions-setup) to re-evaluate `MediaSession.hasPermission()` when your app transitions back to the foreground (`active` state).

### 2. Can I use this in Expo Go?
No. Because `expo-android-media-session-listener` registers an Android background `NotificationListenerService` in the native manifest, it cannot run in the pre-compiled Expo Go client. You must use a development build (`npx expo run:android` or `eas build --profile development`).

### 3. Album artwork is missing or `null`
Some apps (like standard YouTube or certain podcast apps) do not embed full album art bitmaps in their `MediaMetadata`. If neither `METADATA_KEY_ALBUM_ART` nor `METADATA_KEY_ART` are populated by the active player, `artworkUri` will be `undefined`. Always provide a fallback UI placeholder.

### 4. Seeking does not respond in certain apps
The `seekTo(ms)` command relies on the source player's `MediaController.TransportControls.seekTo()`. Certain live streams, radios, or third-party audio apps with restricted playback policies do not implement seek handling.

### 5. Native module not found error
If you see an error stating that the native module `MediaSession` could not be found:
```bash
# Clean prebuild and reinstall native artifacts:
npx expo prebuild --clean --platform android
npx expo run:android
```

---

## 🧪 Local Development & Example App

This repository includes a full Expo demonstration app in the root directory.

### Running the Example App:

```bash
# 1. Clone repository
git clone https://github.com/Aditya-Prakash-YT/media-listener--module-.git
cd media-listener--module-

# 2. Install dependencies
npm install

# 3. Prebuild & run on Android device or emulator
npx expo prebuild --platform android
npx expo run:android
```

### Packaging the Module Locally:

To pack the standalone module into a local `.tgz` archive:

```bash
npm run build:module
# Generated in modules/media-session/expo-android-media-session-listener-3.0.6.tgz
```

---

## 📝 Changelog

See the full history in [GitHub Releases](https://github.com/Aditya-Prakash-YT/media-listener--module-/releases).

### v3.0.6
- **Published to npm**: Officially available on npm as `expo-android-media-session-listener`.
- **Expo SDK 58**: Fully compatible with Expo SDK 58, React Native `0.88.0`, React `19.3.0`, and `expo-modules-core` `~58.0.26`.
- **Refined Distribution**: Optimized package whitelist for minimal tarball footprint.

### v3.0.1 - v3.0.5
- **Smart Artwork Caching**: Added Title + Album signature cache to eliminate artwork flickering.
- **Precision Seeking**: Added `seekTo(ms)` method.
- **Synchronous State**: Added `getState()` method for zero-delay hydration.

---

## 📄 License

MIT © [aditya8prakash](https://github.com/Aditya-Prakash-YT)
