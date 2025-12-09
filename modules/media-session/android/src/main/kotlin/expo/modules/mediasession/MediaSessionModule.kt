package expo.modules.mediasession

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import android.content.Intent
import android.provider.Settings
import android.os.Bundle
import android.media.session.PlaybackState

class MediaSessionModule : Module() {
    override fun definition() = ModuleDefinition {
        Name("MediaSession")

        Events("onMediaChanged")

        Function("requestPermission") {
            val intent = Intent("android.settings.ACTION_NOTIFICATION_LISTENER_SETTINGS")
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            context.startActivity(intent)
        }

        Function("hasPermission") {
            val packageName = context.packageName
            val flat = Settings.Secure.getString(context.contentResolver, "enabled_notification_listeners")
            return@Function flat != null && flat.contains(packageName)
        }

        Function("play") {
            MediaSessionService.activeController?.transportControls?.play()
        }

        Function("pause") {
            MediaSessionService.activeController?.transportControls?.pause()
        }

        Function("skipNext") {
            MediaSessionService.activeController?.transportControls?.skipToNext()
        }

        Function("skipPrevious") {
            MediaSessionService.activeController?.transportControls?.skipToPrevious()
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
            
            mapOf(
                "package" to controller.packageName,
                "title" to (metadata?.getString(android.media.MediaMetadata.METADATA_KEY_TITLE) ?: ""),
                "artist" to (metadata?.getString(android.media.MediaMetadata.METADATA_KEY_ARTIST) ?: ""),
                "album" to (metadata?.getString(android.media.MediaMetadata.METADATA_KEY_ALBUM) ?: ""),
                "state" to stateString,
                "position" to (state?.position ?: 0L),
                "duration" to (metadata?.getLong(android.media.MediaMetadata.METADATA_KEY_DURATION) ?: 0L)
            )
        }

        OnStartObserving {
            MediaEventManager.setListener { bundle ->
                sendEvent("onMediaChanged", bundleToMap(bundle))
            }
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
