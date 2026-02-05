# 🎵 Media Session Listener

**Version 3.0 Patch 1**

A powerful **Expo Native Module** for Android that leverages the `MediaSessionManager` API to listen for media playback events from *any* active media app (Spotify, YouTube, Apple Music, etc.) on the device.

> **Platform Support**: Android only (API 24+)

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| **Real-time Event Listening** | Instantly detect metadata and playback state changes from any media app. |
| **Universal Compatibility** | Works with Spotify, YouTube, SoundCloud, Apple Music, Samsung Music, and more. |
| **Interactive Playback Control** | Play, Pause, Skip Next, Skip Previous, and Seek to any position. |
| **Precise Seeking** | Draggable seek bar with real-time feedback and manual time entry (MM:SS). |
| **Rich Metadata** | Access Title, Artist, Album, Package Name, Duration, and Position. |
| **Live Album Artwork** | Automatic extraction with smart caching to prevent UI flashing. |
| **Robust State Tracking** | Synchronous (`getState()`) and asynchronous (event listener) state management. |
| **Feather Icons** | Clean, minimal UI with professional Feather icon integration. |

---

## 📋 Table of Contents

- [Installation](#-installation)
- [Permissions](#-permissions)
- [Quick Start](#-quick-start)
- [Usage Examples](#-usage-examples)
  - [Basic Event Listening](#basic-event-listening)
  - [Displaying Album Artwork](#displaying-album-artwork)
  - [Implementing Seek Controls](#implementing-seek-controls)
  - [Full Media Player Component](#full-media-player-component)
- [API Reference](#-api-reference)
  - [MediaEvent Object](#mediaevent-object)
  - [Permission Methods](#permission-methods)
  - [Listener Methods](#listener-methods)
  - [Playback Control Methods](#playback-control-methods)
- [Architecture](#-architecture)
- [Troubleshooting](#-troubleshooting)
- [Changelog](#-changelog)
- [License](#-license)

---

## 📦 Installation

### 1. Clone or Copy the Module

```bash
# Clone this repository
git clone https://github.com/your-username/media-listener-app.git
cd media-listener-app

# Install dependencies
npm install
```

### 2. Configure Native Project

Since this is a native module, you must prebuild your Expo project to generate the Android folder:

```bash
npx expo prebuild --platform android
```

### 3. Run the App

```bash
npx expo run:android
```

> **Note**: You cannot use Expo Go for this module. It requires a custom development build.

---

## 🔒 Permissions

This module relies on the **Notification Listener Service**, a special Android permission that allows apps to read active media sessions.

### How It Works

1. **Request Permission**: Call `MediaSession.requestPermission()` to open the Android Notification Access settings.
2. **Grant Access**: The user must manually toggle the switch for your app.
3. **Check Permission**: Use `MediaSession.hasPermission()` to verify the permission status.

### Best Practice: Re-check on App Focus

Android may delay updating the permission status. Use `AppState` to re-check when the user returns:

```typescript
import { useEffect } from 'react';
import { AppState } from 'react-native';
import * as MediaSession from './modules/media-session';

function usePermissionCheck() {
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        const granted = MediaSession.hasPermission();
        console.log('Permission status:', granted);
      }
    });

    return () => subscription.remove();
  }, []);
}
```

---

## 🚀 Quick Start

```typescript
import * as MediaSession from './modules/media-session';

// 1. Check permission
if (!MediaSession.hasPermission()) {
  MediaSession.requestPermission();
}

// 2. Listen for events
const subscription = MediaSession.addMediaListener((event) => {
  console.log('Now Playing:', event.title, 'by', event.artist);
});

// 3. Control playback
MediaSession.play();
MediaSession.pause();
MediaSession.skipNext();
MediaSession.skipPrevious();
MediaSession.seekTo(30000); // Seek to 30 seconds

// 4. Cleanup
subscription.remove();
```

---

## 🎯 Usage Examples

### Basic Event Listening

Subscribe to real-time media events and display the current track:

```typescript
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import * as MediaSession from './modules/media-session';

export default function NowPlaying() {
  const [track, setTrack] = useState<MediaSession.MediaEvent | null>(null);

  useEffect(() => {
    if (!MediaSession.hasPermission()) {
      MediaSession.requestPermission();
      return;
    }

    const subscription = MediaSession.addMediaListener((event) => {
      setTrack(event);
    });

    return () => subscription.remove();
  }, []);

  if (!track) return <Text>No active media</Text>;

  return (
    <View>
      <Text style={{ fontSize: 20, fontWeight: 'bold' }}>{track.title}</Text>
      <Text style={{ color: '#888' }}>{track.artist}</Text>
      <Text style={{ color: '#555' }}>{track.album}</Text>
      <Text style={{ fontSize: 10 }}>State: {track.state}</Text>
    </View>
  );
}
```

---

### Displaying Album Artwork

The module extracts album artwork and provides a file URI. Use it directly with the `Image` component:

```typescript
import { Image, View } from 'react-native';
import * as MediaSession from './modules/media-session';

function AlbumArt({ media }: { media: MediaSession.MediaEvent }) {
  if (!media.artworkUri) {
    return (
      <View style={{ width: 200, height: 200, backgroundColor: '#222' }}>
        <Text style={{ color: '#666', textAlign: 'center' }}>No Art</Text>
      </View>
    );
  }

  return (
    <Image
      source={{ uri: media.artworkUri }}
      style={{ width: 200, height: 200, borderRadius: 8 }}
      resizeMode="cover"
    />
  );
}
```

> **Note (v3.0.1)**: The module now uses **smart caching** to prevent artwork from flashing on every event. The URI only changes when the track actually changes.

---

### Implementing Seek Controls

#### Programmatic Seeking

```typescript
// Seek to 1 minute (60,000 ms)
MediaSession.seekTo(60000);

// Seek forward 10 seconds
const currentPosition = media.position;
MediaSession.seekTo(currentPosition + 10000);

// Seek backward 10 seconds
MediaSession.seekTo(Math.max(0, currentPosition - 10000));
```

#### Draggable Seek Bar with PanResponder

```typescript
import { useRef, useState } from 'react';
import { View, PanResponder } from 'react-native';
import * as MediaSession from './modules/media-session';

function SeekBar({ media }: { media: MediaSession.MediaEvent }) {
  const [trackWidth, setTrackWidth] = useState(0);
  const trackX = useRef(0);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        trackX.current = evt.nativeEvent.pageX - evt.nativeEvent.locationX;
      },
      onPanResponderRelease: (evt, gestureState) => {
        if (!trackWidth || !media.duration) return;
        
        const relativeX = Math.max(0, Math.min(gestureState.moveX - trackX.current, trackWidth));
        const percentage = relativeX / trackWidth;
        const newPosition = Math.floor(percentage * media.duration);
        
        MediaSession.seekTo(newPosition);
      },
    })
  ).current;

  const progressPercent = media.duration ? (media.position / media.duration) * 100 : 0;

  return (
    <View {...panResponder.panHandlers} style={{ paddingVertical: 10 }}>
      <View
        style={{ height: 4, backgroundColor: '#333', borderRadius: 2 }}
        onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
      >
        <View style={{ width: `${progressPercent}%`, height: '100%', backgroundColor: '#fff' }} />
      </View>
    </View>
  );
}
```

---

### Full Media Player Component

A complete, production-ready media player with all features:

```tsx
import React, { useEffect, useState, useRef } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as MediaSession from './modules/media-session';

export default function MusicPlayer() {
  const [media, setMedia] = useState<MediaSession.MediaEvent | null>(null);
  const [displayPosition, setDisplayPosition] = useState(0);
  const positionRef = useRef(0);

  useEffect(() => {
    // Get initial state
    const current = MediaSession.getState();
    if (current) {
      setMedia(current);
      positionRef.current = current.position;
      setDisplayPosition(current.position);
    }

    // Subscribe to updates
    const subscription = MediaSession.addMediaListener((event) => {
      setMedia(event);
      positionRef.current = event.position;
      setDisplayPosition(event.position);
    });

    // Local timer for smooth progress
    const interval = setInterval(() => {
      if (media?.state === 'playing') {
        positionRef.current += 1000;
        setDisplayPosition(positionRef.current);
      }
    }, 1000);

    return () => {
      subscription.remove();
      clearInterval(interval);
    };
  }, [media?.state]);

  const formatTime = (ms: number) => {
    if (!ms || ms < 0) return '0:00';
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  if (!media) {
    return (
      <View style={styles.container}>
        <Text style={styles.emptyText}>No Active Media</Text>
      </View>
    );
  }

  const progressPercent = media.duration ? (displayPosition / media.duration) * 100 : 0;

  return (
    <View style={styles.container}>
      {/* Artwork */}
      {media.artworkUri ? (
        <Image source={{ uri: media.artworkUri }} style={styles.artwork} />
      ) : (
        <View style={[styles.artwork, styles.artworkPlaceholder]}>
          <Feather name="music" size={48} color="#444" />
        </View>
      )}

      {/* Metadata */}
      <Text style={styles.title} numberOfLines={1}>{media.title}</Text>
      <Text style={styles.artist} numberOfLines={1}>{media.artist}</Text>

      {/* Progress Bar */}
      <View style={styles.progressContainer}>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
        </View>
        <View style={styles.timeRow}>
          <Text style={styles.time}>{formatTime(displayPosition)}</Text>
          <Text style={styles.time}>{formatTime(media.duration)}</Text>
        </View>
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        <TouchableOpacity onPress={() => MediaSession.skipPrevious()}>
          <Feather name="skip-back" size={28} color="#888" />
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.playButton}
          onPress={() => media.state === 'playing' ? MediaSession.pause() : MediaSession.play()}
        >
          <Feather name={media.state === 'playing' ? 'pause' : 'play'} size={32} color="#fff" />
        </TouchableOpacity>
        
        <TouchableOpacity onPress={() => MediaSession.skipNext()}>
          <Feather name="skip-forward" size={28} color="#888" />
        </TouchableOpacity>
      </View>

      {/* Source App */}
      <Text style={styles.source}>{media.package}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', padding: 30, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: '#555', fontSize: 14 },
  artwork: { width: 250, height: 250, borderRadius: 4, marginBottom: 30 },
  artworkPlaceholder: { backgroundColor: '#111', justifyContent: 'center', alignItems: 'center' },
  title: { color: '#fff', fontSize: 20, fontWeight: '600', marginBottom: 4 },
  artist: { color: '#888', fontSize: 14, marginBottom: 20 },
  progressContainer: { width: '100%', marginBottom: 30 },
  progressTrack: { height: 4, backgroundColor: '#333', borderRadius: 2 },
  progressFill: { height: '100%', backgroundColor: '#fff', borderRadius: 2 },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  time: { color: '#555', fontSize: 10, fontFamily: 'monospace' },
  controls: { flexDirection: 'row', alignItems: 'center', gap: 40, marginBottom: 30 },
  playButton: { width: 60, height: 60, borderRadius: 30, borderWidth: 1, borderColor: '#fff', justifyContent: 'center', alignItems: 'center' },
  source: { color: '#333', fontSize: 9, letterSpacing: 1 },
});
```

---

## 📚 API Reference

### `MediaEvent` Object

The event object returned by listeners and `getState()`.

| Property | Type | Description |
|----------|------|-------------|
| `title` | `string` | The title of the track. |
| `artist` | `string` | The name of the artist. |
| `album` | `string` | The album name. |
| `package` | `string` | Package name of the source app (e.g., `com.spotify.music`). |
| `state` | `'playing' \| 'paused' \| 'stopped' \| 'buffering' \| 'unknown'` | Current playback state. |
| `position` | `number` | Current playback position in **milliseconds**. |
| `duration` | `number` | Total track duration in **milliseconds**. |
| `artworkUri` | `string \| null` | File URI of the album art (with cache-busting timestamp). |
| `timestamp` | `number` | Unix timestamp when the event was generated. |

---

### Permission Methods

#### `requestPermission(): void`

Opens the Android Notification Access settings screen. The user must manually enable access for your app.

```typescript
MediaSession.requestPermission();
```

#### `hasPermission(): boolean`

Returns `true` if Notification Listener permission has been granted.

```typescript
if (MediaSession.hasPermission()) {
  console.log('Permission granted!');
}
```

---

### Listener Methods

#### `addMediaListener(callback: (event: MediaEvent) => void): Subscription`

Subscribes to real-time media session events. Returns a subscription object with a `.remove()` method.

```typescript
const subscription = MediaSession.addMediaListener((event) => {
  console.log(event.title);
});

// Later, to unsubscribe:
subscription.remove();
```

#### `getState(): MediaEvent | null`

Synchronously retrieves the last known media state. Useful for populating UI immediately on component mount.

```typescript
const currentMedia = MediaSession.getState();
if (currentMedia) {
  console.log('Currently playing:', currentMedia.title);
}
```

---

### Playback Control Methods

| Method | Description |
|--------|-------------|
| `play(): void` | Sends a play command to the active media session. |
| `pause(): void` | Sends a pause command to the active media session. |
| `skipNext(): void` | Skips to the next track. |
| `skipPrevious(): void` | Skips to the previous track. |
| `seekTo(position: number): void` | Seeks to a specific position in **milliseconds**. |

```typescript
// Play/Pause toggle
if (media.state === 'playing') {
  MediaSession.pause();
} else {
  MediaSession.play();
}

// Skip controls
MediaSession.skipNext();
MediaSession.skipPrevious();

// Seek to 2 minutes (120,000 ms)
MediaSession.seekTo(120000);
```

---

## 🏗 Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      React Native App                       │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                     App.tsx                           │  │
│  │  - Uses MediaSession.addMediaListener()               │  │
│  │  - Calls MediaSession.play(), pause(), seekTo()       │  │
│  └───────────────────────────────────────────────────────┘  │
│                             │                               │
│                             ▼                               │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              modules/media-session/index.ts           │  │
│  │  - TypeScript interface to native module              │  │
│  │  - Exports: addMediaListener, play, pause, etc.       │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     Native Android Layer                    │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              MediaSessionModule.kt                    │  │
│  │  - Expo Module Definition                             │  │
│  │  - Exposes JS functions: play, pause, seekTo, etc.    │  │
│  │  - Emits "onMediaChanged" events                      │  │
│  └───────────────────────────────────────────────────────┘  │
│                             │                               │
│                             ▼                               │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              MediaSessionService.kt                   │  │
│  │  - NotificationListenerService implementation         │  │
│  │  - Listens to MediaSessionManager                     │  │
│  │  - Extracts metadata, position, artwork               │  │
│  │  - Smart artwork caching (signature-based)            │  │
│  └───────────────────────────────────────────────────────┘  │
│                             │                               │
│                             ▼                               │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              MediaEventManager.kt                     │  │
│  │  - Event bridge between Service and Module            │  │
│  │  - Singleton pattern for event emission               │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## 🛠 Troubleshooting

### Artwork is missing or not updating

- **Cause**: Some apps (like YouTube) may not provide artwork in standard MediaMetadata fields.
- **Solution**: The module checks both `METADATA_KEY_ALBUM_ART` and `METADATA_KEY_ART`. If neither is available, `artworkUri` will be `null`.

### Artwork was flashing on every event (Fixed in v3.0.1)

- **Cause**: The URI was changing on every event due to timestamp cache-busting.
- **Solution**: v3.0.1 introduces **smart caching**. The timestamp only changes when the track actually changes (based on Title + Album signature).

### `hasPermission()` returns false even after granting

- **Cause**: Android may delay updating the permission status.
- **Solution**: Use `AppState` to re-check permission when your app returns to the foreground.

### Controls (Play/Pause) not working

- **Cause**: The media source app may not support transport controls, or its session has been destroyed.
- **Solution**: This is a limitation of the source app. Controls only work if the app has an active `MediaSession` with transport controls enabled.

### Module not found after installation

- **Cause**: Expo autolinking may not have run.
- **Solution**: Run `npx expo prebuild --clean` and then `npx expo run:android`.

---

## 📝 Changelog

### v3.0.1 (Patch 1)
- **Fixed**: Album artwork flashing on every event.
- **Added**: Smart artwork caching using Title+Album signature.
- **Added**: Visual seek bar thumb/knob.
- **Added**: Feather icons for all controls.
- **Improved**: Seek bar PanResponder now calculates position relative to track dynamically.

### v3.0.0
- **Added**: `seekTo(position)` method for precise seeking.
- **Added**: Manual time entry modal (MM:SS or seconds).
- **Added**: Draggable seek bar with real-time feedback.
- **Added**: Package name display in UI.

### v2.0.0
- **Added**: Album artwork extraction and display.
- **Added**: `getState()` for synchronous state retrieval.
- **Improved**: Event listener architecture.

### v1.0.0
- Initial release.
- Basic event listening and playback controls.

---

## 📄 License

MIT License.

```
Copyright (c) 2026

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software.
```
