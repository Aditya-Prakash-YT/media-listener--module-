# 🎵 Media Session (Expo Native Module)

A powerful **Expo Native Module** for Android that leverages the `MediaSessionManager` API to listen for media playback events from *any* active media app (Spotify, YouTube, Apple Music, etc.) on the device.

## ✨ Features

- **Real-time Event Listening**: Instantly detect when metadata or playback state changes.
- **Universal Compatibility**: Works with any app that posts a standard MediaSession (Spotify, YouTube, SoundCloud, etc.).
- **Playback Control**: Play, Pause, Skip Next, Skip Previous, and Seek.
- **Rich Metadata**: Access Title, Artist, Album, Package Name, and Duration.
- **Live Album Artwork**: Automatically extracts art as a file URI with cache-busting timestamps.
- **State Management**: Robust state tracking (Playing, Paused, Buffering, Stopped).
- **Synchronous State**: Get the current media state immediately with `getState()`.

## 📦 Installation

This module is distributed as a local NPM tarball. To install it in your project:

### 1. Generate/Copy the Tarball

If you've made changes, generate a new timestamped tarball inside the module directory:
```bash
# Inside modules/media-session
npm run pack-time
```

Copy the generated `.tgz` file (e.g., `media-session-20240101-120000-1.0.0.tgz`) to your consumer project.

### 2. Install via NPM/Yarn

Run the following command in your project root, pointing to the path of the tarball:

```bash
npm install ./path/to/media-session-*.tgz
# or
yarn add ./path/to/media-session-*.tgz
```

### 3. Rebuild the Native App

Since this is a native module, you must rebuild your development client:

```bash
npx expo run:android
```

## 🚀 Usage

### Basic Example

```typescript
import { useEffect, useState } from 'react';
import { View, Button, Text } from 'react-native';
import * as MediaSession from 'media-session';

export default function MediaTracker() {
  const [media, setMedia] = useState<MediaSession.MediaEvent | null>(null);

  useEffect(() => {
    // 1. Request/Check permissions
    if (!MediaSession.hasPermission()) {
      MediaSession.requestPermission();
      return;
    }

    // 2. Subscribe to events
    const subscription = MediaSession.addMediaListener((event) => {
      setMedia(event);
      console.log('Now Playing:', event.title);
    });

    return () => subscription.remove();
  }, []);

  const handleSeek = () => {
    if (media) {
      // Seek to 30 seconds
      MediaSession.seekTo(30000); 
    }
  };

  if (!media) return <Text>No media playing</Text>;

  return (
    <View>
      <Text>{media.title} by {media.artist}</Text>
      <View style={{ flexDirection: 'row' }}>
        <Button title="Prev" onPress={() => MediaSession.skipPrevious()} />
        <Button title={media.state === 'playing' ? 'Pause' : 'Play'} 
                onPress={() => media.state === 'playing' ? MediaSession.pause() : MediaSession.play()} />
        <Button title="Next" onPress={() => MediaSession.skipNext()} />
      </View>
      <Button title="Seek to 0:30" onPress={handleSeek} />
    </View>
  );
}
```

### Synchronous State

Retrieve the last known media state immediately (e.g., on app launch):

```typescript
const current = MediaSession.getState();
if (current) {
  console.log('Last Title:', current.title);
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
| `package` | `string` | The package name of the app playing media. |
| `state` | `string` | `'playing'`, `'paused'`, `'stopped'`, `'buffering'`, or `'unknown'`. |
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
- **Returns**: A subscription object with a `.remove()` method.

#### `getState(): MediaEvent | null`
Synchronously retrieves the last known media state.

#### Control Methods
- `play(): void`
- `pause(): void`
- `skipNext(): void`
- `skipPrevious(): void`
- `seekTo(position: number): void`

## 🛠 Troubleshooting

- **Artwork missing/stale**: Some apps don't provide art. The module uses `?ts=<timestamp>` on URIs to prevent stale caching in the UI. 
- **Permission delay**: Android sometimes delays updating permission status. Check again when the app returns from settings using `AppState`.

## License

MIT
