# Privacy Policy for Media Session Listener

**Last Updated:** October 26, 2026

## 1. Overview
The **Media Session Listener** application ("we", "our", or "us") is dedicated to protecting your privacy. This Privacy Policy discloses the nature of data handled when you use the Media Session Listener application.

## 2. Notification Listener Access (`android.permission.BIND_NOTIFICATION_LISTENER_SERVICE`)
To provide system-wide media playback detection, the app requires Android Notification Listener access. 

### Why this access is required
Under Android security architecture (API 21+), access to system media sessions via `android.media.session.MediaSessionManager` requires active `NotificationListenerService` registration. 

### What data we access
When permission is granted, the app accesses:
- Active media session playback state (`playing`, `paused`, `stopped`, `buffering`).
- Track metadata provided by active media players (track title, artist, album name, duration, and playback position).
- Album artwork provided by the media session or local media player.

### What data we NEVER access, store, or transmit
- **Zero Personal Notifications:** We do not read, process, store, or log any personal notifications, chat messages, SMS messages, one-time passwords (OTPs), two-factor authentication codes, emails, or personal alert texts.
- **Zero Remote Transmission:** All media state processing occurs strictly on your device. No metadata or artwork is transmitted to external servers.
- **Zero Tracking / Advertising:** We do not track user identities or display advertisements.

## 3. Local Storage & Caching
- Album artwork extracted from active media sessions is cached temporarily in the app's internal, private application cache directory (`context.cacheDir`).
- No files are stored in external public directories.
- Cached artwork files are automatically managed via an LRU (Least Recently Used) cache and deleted when the app's cache is cleared.

## 4. Third-Party Services
This application does not integrate third-party analytics SDKs, advertising networks, or user profiling trackers.

## 5. Contact
For questions or concerns regarding this Privacy Policy, please file an issue at:
https://github.com/Aditya-Prakash-YT/media-listener--module-/issues
