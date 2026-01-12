# 🎵 Media Session Listener

A powerful **Expo Native Module** for Android that leverages the `MediaSessionManager` API to listen for media playback events from *any* active media app (Spotify, YouTube, Apple Music, etc.) on the device.

> **Note**: This module currently supports **Android only**.

## ✨ Features

- **Real-time Event Listening**: Instantly detect when metadata or playback state changes.
- **Universal Compatibility**: Works with any app that posts a standard MediaSession (Spotify, YouTube, SoundCloud, etc.).
- **Playback Control**: Play, Pause, Skip Next, Skip Previous, and Seek.
- **Rich Metadata**: Access Title, Artist, Album, Package Name, and Duration.
- **Album Artwork**: Automatically extracts album art as a Base64 URI.
- **State Management**: Robust state tracking (Playing, Paused, Buffering, Stopped).
- **Synchronous State**: Get the current media state immediately with `getState()`.

## 📦 Installation

### 1. Install the package

```bash
# Clone this repository or copy the module folder
git clone https://github.com/your-username/media-listener-app.git
cd media-listener-app

# Install dependencies
npm install
```

### 2. Configure Native Project

Since this is a native module, you must prebuild your Expo project to generate the android folder.

```bash
npx expo prebuild --platform android
```

### 3. Run the App

```bash
npx expo run:android
```

## 🔒 Permissions

This module relies on the **Notification Listener Service**.

1.  **Request Permission**: When you first call `MediaSession.requestPermission()`, the user will be taken to the Android **Notification Access** settings screen.
2.  **Grant Access**: The user must manually toggle the switch for your app to allow it to read media notifications.
3.  **Automatic Detection**: The `hasPermission()` method allows you to check if the user has granted access.

## 🚀 Usage

### Basic Usage

Subscribe to media events to log the currently playing song.

```typescript
import { useEffect } from 'react';
import * as MediaSession from './modules/media-session';

export default function MediaTracker() {
  useEffect(() => {
    // 1. Check permissions
    if (!MediaSession.hasPermission()) {
      MediaSession.requestPermission();
      return;
    }

    // 2. Subscribe to events
    const subscription = MediaSession.addMediaListener((event) => {
      console.log('Now Playing:', event.title);
      console.log('Artist:', event.artist);
      console.log('State:', event.state); // 'playing', 'paused', etc.
    });

    return () => subscription.remove();
  }, []);

  return null;
}
```

### Advanced: Full Media Player Component

Here is a complete example of a robust media player UI that tracks position, updates a progress bar, and controls playback.

```tsx
import React, { useEffect, useState, useRef } from 'react';
import { View, Text, Image, TouchableOpacity, AppState } from 'react-native';
import * as MediaSession from './modules/media-session';

export default function MusicPlayer() {
  const [media, setMedia] = useState<MediaSession.MediaEvent | null>(null);
  const [displayPosition, setDisplayPosition] = useState(0);
  const positionRef = useRef(0);

  useEffect(() => {
    // Initial check
    const current = MediaSession.getState();
    if (current) setMedia(current);

    // Listen for updates
    const sub = MediaSession.addMediaListener((event) => {
      setMedia(event);
      positionRef.current = event.position;
      setDisplayPosition(event.position);
    });

    // Local timer to smooth out the progress bar
    const interval = setInterval(() => {
      if (media?.state === 'playing') {
        positionRef.current += 1000;
        setDisplayPosition(positionRef.current);
      }
    }, 1000);

    return () => {
      sub.remove();
      clearInterval(interval);
    };
  }, [media?.state]);

  const handlePlayPause = () => {
    if (media?.state === 'playing') {
      MediaSession.pause();
    } else {
      MediaSession.play();
    }
  };

  if (!media) return <Text>No Media Playing</Text>;

  return (
    <View style={{ padding: 20, alignItems: 'center' }}>
      {/* Artwork */}
      {media.artworkUri && (
        <Image 
          source={{ uri: media.artworkUri }} 
          style={{ width: 200, height: 200, borderRadius: 10 }} 
        />
      )}
      
      {/* Metadata */}
      <Text style={{ fontSize: 18, fontWeight: 'bold', marginTop: 10 }}>
        {media.title}
      </Text>
      <Text style={{ color: '#888' }}>{media.artist}</Text>

      {/* Progress Bar */}
      <View style={{ width: '100%', height: 5, backgroundColor: '#333', marginVertical: 20 }}>
        <View style={{ 
          width: `${(displayPosition / media.duration) * 100}%`, 
          height: '100%', 
          backgroundColor: 'white' 
        }} />
      </View>

      {/* Controls */}
      <View style={{ flexDirection: 'row', gap: 20 }}>
        <TouchableOpacity onPress={MediaSession.skipPrevious}>
          <Text>⏮ Prev</Text>
        </TouchableOpacity>
        
        <TouchableOpacity onPress={handlePlayPause}>
          <Text>{media.state === 'playing' ? '⏸ Pause' : '▶ Play'}</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={MediaSession.skipNext}>
          <Text>Next ⏭</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
```

## 📚 API Reference

### `MediaEvent` Object

The event object returned by listeners and `getState()`.

| Property | Type | Description |
|----------|------|-------------|
| `title` | `string` | The title of the track. |
| `artist` | `string` | The name of the artist. |
| `album` | `string` | The album name. |
| `package` | `string` | The package name of the app playing media (e.g., `com.spotify.music`). |
| `state` | `string` | One of: `'playing'`, `'paused'`, `'stopped'`, `'buffering'`, `'unknown'`. |
| `position` | `number` | Current playback position in milliseconds. |
| `duration` | `number` | Total track duration in milliseconds. |
| `artworkUri`| `string?`| (Optional) Base64 encoded data URI of the album art. |
| `timestamp` | `number` | The timestamp when the event was generated. |

### Methods

#### `requestPermission(): void`
Opens the Android Notification Listener settings page.

#### `hasPermission(): boolean`
Returns `true` if the notification listener permission has been granted.

#### `addMediaListener(callback): Subscription`
Subscribes to real-time media events.
- **callback**: `(event: MediaEvent) => void`
- **Returns**: A simplified subscription object with a `.remove()` method.

#### `getState(): MediaEvent | null`
Synchronously retrieves the last known media state without waiting for a new event. Useful for populating the UI on app launch.

#### Control Methods
- `play(): void` - Send play command.
- `pause(): void` - Send pause command.
- `skipNext(): void` - Skip to the next track.
- `skipPrevious(): void` - Skip to the previous track.
- `seekTo(position: number): void` - Seek to a specific position in ms.

## 🛠 Troubleshooting

### Artwork is missing or not updating
- **Cause**: Some apps do not publish the bitmap in the standard MediaMetadata fields, or the image is too large and was dropped by the system binder.
- **Solution**: The module attempts to cache the image to disk to avoid binder limits. Ensure you are using the latest version of the module.

### `hasPermission` returns false even after granting
- **Cause**: Android sometimes delays the status update.
- **Solution**: Use `AppState` to check permission again when the user returns to the app from settings.

### Controls (Play/Pause) not working
- **Cause**: The active media session might not support transport controls, or the app has been killed by the system.
- **Solution**: This is a limitation of the source app. Controls only work if the source app has an active `MediaSession`.

## License

MIT License.
