# 🎵 Expo Android Media Session Listener (`expo-android-media-session-listener`)

**Version 3.0.5**

A powerful **Expo Native Module** for Android that leverages the `MediaSessionManager` API to listen for media playback events from *any* active media app (Spotify, YouTube, Apple Music, SoundCloud, Samsung Music, etc.) on the device and control playback.

> **Platform**: Android only (API 24+)  
> **Expo SDK**: Supports Expo SDK 58+ and backward compatible with Expo SDK 50+

---

## ✨ Features

- **Real-time Event Listening** — Instantly detect metadata and playback state changes.
- **Universal Compatibility** — Works with Spotify, YouTube, SoundCloud, Apple Music, and more.
- **Playback Control** — Play, Pause, Skip Next, Skip Previous, and Seek.
- **Rich Metadata** — Title, Artist, Album, Package Name, Duration, Position.
- **Live Album Artwork** — Smart caching to prevent UI flashing.
- **Robust State Management** — Synchronous (`getState()`) and asynchronous (listeners).

---

## 📦 Installation

### Option 1: Install from Tarball (.tgz)

```bash
# In your Expo / React Native project root:
npm install ./path/to/expo-android-media-session-listener-3.0.5.tgz

# Prebuild and run Android
npx expo prebuild --platform android
npx expo run:android
```

### Option 2: Install from NPM Registry

```bash
npm install expo-android-media-session-listener

npx expo prebuild --platform android
npx expo run:android
```

### Option 3: Local Module (Development)

If using as a local module in `modules/media-session`:

```bash
# Expo autolinking handles it automatically
npx expo prebuild --platform android
npx expo run:android
```

---

## 🔨 Building the Package (.tgz)

To package the module into an installable `.tgz` tarball:

```bash
cd modules/media-session
npm run build
# or: npm run pack-time
```

This will automatically create `expo-android-media-session-listener-3.0.5.tgz` in the directory, ready to install into any Expo/React Native project.

---

## 🔒 Permissions

This module requires **Notification Listener** permission to access active media sessions.

```typescript
import * as MediaSession from 'expo-android-media-session-listener';

// Check permission
if (!MediaSession.hasPermission()) {
  MediaSession.requestPermission(); // Opens Android settings
}
```

---

## 🚀 Quick Start

```typescript
import * as MediaSession from 'expo-android-media-session-listener';

// 1. Subscribe to media events
const subscription = MediaSession.addMediaListener((event) => {
  console.log(`${event.title} by ${event.artist}`);
  console.log(`State: ${event.state}`);
  console.log(`Position: ${event.position}/${event.duration} ms`);
});

// 2. Control playback
MediaSession.play();
MediaSession.pause();
MediaSession.skipNext();
MediaSession.skipPrevious();
MediaSession.seekTo(30000); // 30 seconds

// 3. Cleanup when done
subscription.remove();
```

---

## 🎯 Usage Examples

### Basic Component

```typescript
import { useEffect, useState } from 'react';
import { Text, View, Image } from 'react-native';
import * as MediaSession from 'expo-android-media-session-listener';

export default function NowPlaying() {
  const [media, setMedia] = useState<MediaSession.MediaEvent | null>(null);

  useEffect(() => {
    if (!MediaSession.hasPermission()) {
      MediaSession.requestPermission();
      return;
    }

    const sub = MediaSession.addMediaListener(setMedia);
    return () => sub.remove();
  }, []);

  if (!media) return <Text>No active media</Text>;

  return (
    <View>
      {media.artworkUri && (
        <Image source={{ uri: media.artworkUri }} style={{ width: 200, height: 200 }} />
      )}
      <Text>{media.title}</Text>
      <Text>{media.artist}</Text>
    </View>
  );
}
```

### Seeking to Custom Time

```typescript
import * as MediaSession from 'expo-android-media-session-listener';

// Seek to 2 minutes
MediaSession.seekTo(120000);

// Seek forward 10 seconds
const current = media.position;
MediaSession.seekTo(current + 10000);

// Seek backward 10 seconds
MediaSession.seekTo(Math.max(0, current - 10000));
```

### Synchronous State

```typescript
import * as MediaSession from 'expo-android-media-session-listener';

// Get current state immediately (useful on mount)
const current = MediaSession.getState();
if (current) {
  console.log('Currently playing:', current.title);
}
```

---

## 📚 API Reference

### `MediaEvent` Object

| Property | Type | Description |
|----------|------|-------------|
| `title` | `string` | Track title |
| `artist` | `string` | Artist name |
| `album` | `string` | Album name |
| `package` | `string` | Source app package (e.g., `com.spotify.music`) |
| `state` | `'playing' \| 'paused' \| 'stopped' \| 'buffering' \| 'unknown'` | Playback state |
| `position` | `number` | Position in milliseconds |
| `duration` | `number` | Duration in milliseconds |
| `artworkUri` | `string?` | File URI with cache-busting timestamp |
| `timestamp` | `number` | Event timestamp |

### Methods

| Method | Description |
|--------|-------------|
| `requestPermission()` | Opens Notification Access settings |
| `hasPermission()` | Returns `true` if permission granted |
| `addMediaListener(callback)` | Subscribe to events, returns `{ remove() }` |
| `getState()` | Returns current `MediaEvent` or `null` |
| `play()` | Send play command |
| `pause()` | Send pause command |
| `skipNext()` | Skip to next track |
| `skipPrevious()` | Skip to previous track |
| `seekTo(position)` | Seek to position in milliseconds |

---

## 🛠 Troubleshooting

| Issue | Solution |
|-------|----------|
| Artwork missing | Some apps don't provide artwork; `artworkUri` will be `null` |
| Artwork flashing | Fixed in v3.0.1 with smart caching |
| Permission not detected | Re-check with `AppState.addEventListener('change')` |
| Controls not working | Source app may not support transport controls |

---

## 📝 Changelog

**v3.0.5** — Upgraded module compatibility to latest Expo SDK 58 (`~58.0.14`), React Native `0.88.0`, React `19.3.0`, and `expo-modules-core` `~58.0.22`. Officially renamed module to `expo-android-media-session-listener`. Updated packaging build script to generate `expo-android-media-session-listener-3.0.5.tgz` with optimized file whitelist.  
**v3.0.4** — Upgraded module compatibility to Expo SDK 57 (`~57.0.28`), React Native `0.86.3`, and `expo-modules-core` `~57.0.22`  
**v3.0.3** — Minor internal codebase improvement  
**v3.0.2** — Minor internal codebase improvement  
**v3.0.1** — Smart artwork caching, seek bar thumb, Feather icons  
**v3.0.0** — `seekTo()`, manual time entry, draggable seek bar  
**v2.0.0** — Artwork extraction, `getState()`  
**v1.0.0** — Initial release

---

## 📄 License

MIT
