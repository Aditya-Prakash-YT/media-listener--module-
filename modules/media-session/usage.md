# Media Session Module

This is a local Expo module that provides control over the media session on Android.

## Installation

This module is distributed as a local tarball. To install it in another project:

1.  **Copy the tarball**:
    Copy the generated `.tgz` file (e.g., `media-session-YYYYMMDD-HHmmss-1.0.0.tgz`) to your project's root or a `libs` folder.

    > **Note**: You can generate a new timestamped tarball by running `npm run pack-time` inside the `modules/media-session` directory.

2.  **Install via npm/yarn**:
    Run the following command in your project root, pointing to the path of the tarball:

    ```bash
    npm install ./path/to/media-session-*.tgz
    # or
    yarn add ./path/to/media-session-*.tgz
    ```

    *Example:*
    ```bash
    npm install ./libs/media-session-20240101-120000-1.0.0.tgz
    ```

3.  **Rebuild the Dev Client**:
    Since this is a native module, you must rebuild your development client or android app.

    ```bash
    npx expo run:android
    ```

## Usage

```typescript
import * as MediaSession from 'media-session';

// Request permissions
await MediaSession.requestPermission();

// Check permissions
const hasPerm = MediaSession.hasPermission();

// Play/Pause
MediaSession.play();
MediaSession.pause();

// Listen to media changes
const subscription = MediaSession.addMediaListener((event) => {
  console.log('Media State:', event.state);
  console.log('Track:', event.title, 'by', event.artist);
});

// Clean up
subscription.remove();
```

## Development

To modify this module:
1.  Make changes in `modules/media-session`.
2.  Run `npm run pack-time` to create a new versioned tarball.
3.  Re-install the new tarball in your consumer app.
