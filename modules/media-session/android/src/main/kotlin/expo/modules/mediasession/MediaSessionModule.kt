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
            val controller = MediaSessionService.activeController
            if (controller == null) return@Function null
            
            val metadata = controller.metadata
            val state = controller.playbackState
            
            val stateString = when (state?.state) {
                PlaybackState.STATE_PLAYING -> "playing"
                PlaybackState.STATE_PAUSED -> "paused"
                PlaybackState.STATE_STOPPED -> "stopped"
                PlaybackState.STATE_BUFFERING -> "buffering"
                else -> "unknown"
            }

            // Use shared helper — single source of truth for artwork resolution
            val artworkUri = try {
                ArtworkHelper.resolveArtworkUri(controller, context.cacheDir)
            } catch (e: Exception) {
                Log.e(TAG, "Error resolving artwork in getState", e)
                null
            }
            
            val artistStr = metadata?.getString(android.media.MediaMetadata.METADATA_KEY_ARTIST)
                ?: metadata?.getString(android.media.MediaMetadata.METADATA_KEY_ALBUM_ARTIST) ?: ""

            val result = mutableMapOf<String, Any?>(
                "package" to controller.packageName,
                "title" to (metadata?.getString(android.media.MediaMetadata.METADATA_KEY_TITLE) ?: ""),
                "artist" to artistStr,
                "album" to (metadata?.getString(android.media.MediaMetadata.METADATA_KEY_ALBUM) ?: ""),
                "state" to stateString,
                "position" to (state?.position ?: 0L),
                "duration" to (metadata?.getLong(android.media.MediaMetadata.METADATA_KEY_DURATION) ?: 0L)
            )

            if (artworkUri != null) {
                result["artworkUri"] = artworkUri
            }

            result
        }

        OnStartObserving {
            MediaEventManager.setListener { bundle ->
                sendEvent("onMediaChanged", bundleToMap(bundle))
            }
        }

        OnStopObserving {
            MediaEventManager.setListener(null)
        }
    }

    private fun safeTransportAction(action: (android.media.session.MediaController.TransportControls) -> Unit) {
        try {
            val controller = MediaSessionService.activeController
            val controls = controller?.transportControls
            if (controls != null) {
                action(controls)
            }
        } catch (e: android.os.DeadObjectException) {
            Log.w(TAG, "MediaController is dead or process terminated", e)
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
