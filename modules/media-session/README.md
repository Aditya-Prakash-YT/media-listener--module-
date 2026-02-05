# 🎵 Media Session (Expo Native Module)

**Version 3.0 Patch 1**

A powerful **Expo Native Module** for Android that leverages the `MediaSessionManager` API to listen for media playback events from *any* active media app (Spotify, YouTube, Apple Music, etc.) on the device.

> **Platform**: Android only (API 24+)

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

### Option 1: Local Module (Development)

If using as a local module in `modules/media-session`:

```bash
# Expo autolinking handles it automatically
npx expo prebuild --platform android
npx expo run:android
```

### Option 2: NPM Tarball

```bash
# Generate timestamped tarball
cd modules/media-session
npm run pack-time

# Install in your project
npm install ./path/to/media-session-*.tgz
npx expo run:android
```

---

## 🔒 Permissions

This module requires **Notification Listener** permission.

```typescript
import * as MediaSession from 'media-session';

// Check permission
if (!MediaSession.hasPermission()) {
  MediaSession.requestPermission(); // Opens Android settings
}
```

---

## 🚀 Quick Start

```typescript
import * as MediaSession from 'media-session';

// Subscribe to media events
const subscription = MediaSession.addMediaListener((event) => {
  console.log(`${event.title} by ${event.artist}`);
  console.log(`State: ${event.state}`);
  console.log(`Position: ${event.position}/${event.duration} ms`);
});

// Control playback
MediaSession.play();
MediaSession.pause();
MediaSession.skipNext();
MediaSession.skipPrevious();
MediaSession.seekTo(30000); // 30 seconds

// Cleanup
subscription.remove();
```

---

## 🎯 Usage Examples

### Basic Component

```typescript
import { useEffect, useState } from 'react';
import { Text, View, Image } from 'react-native';
import * as MediaSession from 'media-session';

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

**v3.0.1** — Smart artwork caching, seek bar thumb, Feather icons  
**v3.0.0** — `seekTo()`, manual time entry, draggable seek bar  
**v2.0.0** — Artwork extraction, `getState()`  
**v1.0.0** — Initial release

---

## 📄 License

MIT
