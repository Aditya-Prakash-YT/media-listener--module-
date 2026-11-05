package expo.modules.mediasession

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import android.content.ComponentName
import android.content.Intent
import android.provider.Settings
import android.os.Bundle
import android.media.session.PlaybackState
import android.util.Log

class MediaSessionModule : Module() {
    companion object {
        private const val TAG = "MediaSessionModule"
    }

    override fun definition() = ModuleDefinition {
        Name("MediaSession")

        Events("onMediaChanged")

        Function("requestPermission") {
            try {
                val intent = Intent("android.settings.ACTION_NOTIFICATION_LISTENER_SETTINGS")
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                if (intent.resolveActivity(context.packageManager) != null) {
                    context.startActivity(intent)
                } else {
                    Log.w(TAG, "Notification listener settings activity not found on device")
                }
            } catch (e: Exception) {
                Log.e(TAG, "Failed to start notification listener settings", e)
            }
        }

        Function("hasPermission") {
            val packageName = context.packageName
            try {
                val enabledPackages = androidx.core.app.NotificationManagerCompat.getEnabledListenerPackages(context)
                if (enabledPackages.contains(packageName)) {
                    return@Function true
                }
            } catch (_: Throwable) {
                // Fallback to Settings.Secure below
            }

            try {
                val flat = Settings.Secure.getString(context.contentResolver, "enabled_notification_listeners")
                    ?: return@Function false
                val names = flat.split(":")
                for (name in names) {
                    val component = ComponentName.unflattenFromString(name)
                    if (component != null && component.packageName == packageName) {
                        return@Function true
                    }
                }
            } catch (e: Exception) {
                Log.w(TAG, "Error checking enabled_notification_listeners", e)
            }
            return@Function false
        }

        Function("play") {
            safeTransportAction { it.play() }
        }

        Function("pause") {
            safeTransportAction { it.pause() }
        }

        Function("skipNext") {
            safeTransportAction { it.skipToNext() }
        }

        Function("skipPrevious") {
            safeTransportAction { it.skipToPrevious() }
        }

        Function("seekTo") { position: Long ->
            if (position >= 0) {
                safeTransportAction { it.seekTo(position) }
            }
        }

        Function("getState") {
            val controller = MediaSessionService.activeController ?: return@Function null
            
            val pkg: String
            val metadata: android.media.MediaMetadata?
            val state: PlaybackState?

            try {
                pkg = controller.packageName ?: ""
                metadata = controller.metadata
                state = controller.playbackState
            } catch (e: android.os.DeadObjectException) {
                Log.w(TAG, "MediaController is dead during getState, clearing reference")
                MediaSessionService.clearActiveControllerIf(controller)
                return@Function null
            } catch (e: Exception) {
                Log.w(TAG, "Error querying controller in getState", e)
                return@Function null
            }
            
            val stateString = when (state?.state) {
                PlaybackState.STATE_PLAYING -> "playing"
                PlaybackState.STATE_PAUSED -> "paused"
                PlaybackState.STATE_STOPPED -> "stopped"
                PlaybackState.STATE_BUFFERING -> "buffering"
                else -> "unknown"
            }

            val rawTitle = metadata?.getString(android.media.MediaMetadata.METADATA_KEY_TITLE)
            val rawArtist = metadata?.getString(android.media.MediaMetadata.METADATA_KEY_ARTIST)
                ?: metadata?.getString(android.media.MediaMetadata.METADATA_KEY_ALBUM_ARTIST)
            val rawAlbum = metadata?.getString(android.media.MediaMetadata.METADATA_KEY_ALBUM)

            val title = (rawTitle ?: "").take(1000)
            val artist = (rawArtist ?: "").take(1000)
            val album = (rawAlbum ?: "").take(1000)
            val position = (state?.position ?: 0L).coerceAtLeast(0L)
            val duration = (metadata?.getLong(android.media.MediaMetadata.METADATA_KEY_DURATION) ?: 0L).coerceAtLeast(0L)

            // Use shared helper snapshot overload to avoid redundant Binder IPC calls
            val artworkUri = try {
                ArtworkHelper.resolveArtworkUri(pkg, metadata, context.cacheDir)
            } catch (e: Exception) {
                Log.e(TAG, "Error resolving artwork in getState", e)
                null
            }

            val result = mutableMapOf<String, Any?>(
                "package" to pkg,
                "title" to title,
                "artist" to artist,
                "album" to album,
                "state" to stateString,
                "position" to position,
                "duration" to duration,
                "timestamp" to System.currentTimeMillis()
            )

            if (artworkUri != null) {
                result["artworkUri"] = artworkUri
            }

            result
        }

        OnStartObserving {
            MediaEventManager.setListener { bundle ->
                try {
                    sendEvent("onMediaChanged", bundleToMap(bundle))
                } catch (e: Exception) {
                    Log.w(TAG, "Failed to send onMediaChanged event to JS runtime", e)
                }
            }
        }

        OnStopObserving {
            MediaEventManager.setListener(null)
        }
    }

    private fun safeTransportAction(action: (android.media.session.MediaController.TransportControls) -> Unit) {
        val controller = MediaSessionService.activeController ?: return
        try {
            val controls = controller.transportControls
            if (controls != null) {
                action(controls)
            }
        } catch (e: android.os.DeadObjectException) {
            Log.w(TAG, "MediaController is dead or process terminated, clearing reference", e)
            MediaSessionService.clearActiveControllerIf(controller)
        } catch (e: SecurityException) {
            Log.w(TAG, "SecurityException calling transport control", e)
        } catch (e: Exception) {
            Log.e(TAG, "Unexpected error calling transport control", e)
        }
    }

    private fun bundleToMap(bundle: Bundle): Map<String, Any?> {
        val map = mutableMapOf<String, Any?>()
        for (key in bundle.keySet()) {
            map[key] = bundle.get(key)
        }
        return map
    }

    private val context
        get() = requireNotNull(appContext.reactContext) { "React Application Context is null" }
}
