# 🎵 Media Session (Expo Native Module)

A powerful **Expo Native Module** for Android that leverages the `MediaSessionManager` API to listen for media playback events from *any* active media app (Spotify, YouTube, Apple Music, etc.) on the device.

## ✨ Features

- **Real-time Event Listening**: Instantly detect when metadata or playback state changes.
- **Universal Compatibility**: Works with any app that posts a standard MediaSession (Spotify, YouTube, SoundCloud, etc.).
- **Playback Control**: Play, Pause, Skip Next, Skip Previous, and Seek.
- **Rich Metadata**: Access Title, Artist, Album, Package Name, and Duration.
- **Album Artwork**: Automatically extracts album art as a Base64 URI.
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
import { useEffect } from 'react';
import * as MediaSession from 'media-session';

export default function MediaTracker() {
  useEffect(() => {
    // 1. Request/Check permissions
    // This takes the user to Notification Access settings
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

- **Artwork missing**: Some apps (like YouTube) may not always provide the artwork in the media metadata or it might be dropped if too large.
- **Permission delay**: Android sometimes delays updating permission status. Check again when the app returns from settings using `AppState`.

## License

MIT
