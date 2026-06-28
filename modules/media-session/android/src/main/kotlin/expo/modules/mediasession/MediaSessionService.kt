package expo.modules.mediasession

import android.content.ComponentName
import android.content.Context
import android.media.MediaMetadata
import android.media.session.MediaController
import android.media.session.MediaSessionManager
import android.media.session.PlaybackState
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.service.notification.NotificationListenerService
import android.util.Log

class MediaSessionService : NotificationListenerService() {
    private var sessionManager: MediaSessionManager? = null
    private val controllerCallbacks = mutableMapOf<MediaController, MediaController.Callback>()
    private val mainHandler = Handler(Looper.getMainLooper())

    companion object {
        private const val TAG = "MediaSessionService"
        @Volatile
        var activeController: MediaController? = null
            private set
    }

    private val sessionsListener = MediaSessionManager.OnActiveSessionsChangedListener { controllers ->
        mainHandler.post {
            onSessionsChanged(controllers)
        }
    }

    override fun onListenerConnected() {
        super.onListenerConnected()
        Log.d(TAG, "Listener connected")
        
        sessionManager = getSystemService(Context.MEDIA_SESSION_SERVICE) as MediaSessionManager
        val componentName = ComponentName(this, MediaSessionService::class.java)
        
        sessionManager?.addOnActiveSessionsChangedListener(sessionsListener, componentName)
        
        val controllers = sessionManager?.getActiveSessions(componentName)
        onSessionsChanged(controllers)
    }

    override fun onListenerDisconnected() {
        super.onListenerDisconnected()
        Log.d(TAG, "Listener disconnected")
        
        sessionManager?.removeOnActiveSessionsChangedListener(sessionsListener)
        
        // Safe copy to avoid ConcurrentModificationException
        val entries = controllerCallbacks.entries.toList()
        entries.forEach { (controller, callback) ->
            controller.unregisterCallback(callback)
        }
        controllerCallbacks.clear()
        activeController = null
    }

    private fun onSessionsChanged(controllers: List<MediaController>?) {
        Log.d(TAG, "Sessions changed: ${controllers?.size ?: 0} active")
        
        val currentPackages = controllers?.map { it.packageName }?.toSet() ?: emptySet()
        val registeredPackages = controllerCallbacks.keys.map { it.packageName }.toSet()
        
        // Safe removal — snapshot keys first to avoid ConcurrentModificationException
        val toRemove = controllerCallbacks.keys.filter { it.packageName !in currentPackages }
        toRemove.forEach { controller ->
            controllerCallbacks.remove(controller)?.let { callback ->
                controller.unregisterCallback(callback)
            }
        }
        
        controllers?.forEach { controller ->
            if (controller.packageName !in registeredPackages) {
                registerControllerCallback(controller)
            }
        }
        
        controllers?.firstOrNull()?.let { first ->
            if (first.playbackState?.state == PlaybackState.STATE_PLAYING) {
                activeController = first
                emitMediaState(first)
            }
        }
    }

    private fun registerControllerCallback(controller: MediaController) {
        val callback = object : MediaController.Callback() {
            override fun onMetadataChanged(metadata: MediaMetadata?) {
                Log.d(TAG, "Metadata changed for ${controller.packageName}")
                emitMediaState(controller)
            }

            override fun onPlaybackStateChanged(state: PlaybackState?) {
                Log.d(TAG, "Playback state changed: ${state?.state} for ${controller.packageName}")
                if (state?.state == PlaybackState.STATE_PLAYING) {
                    activeController = controller
                }
                emitMediaState(controller)
            }
        }

        controller.registerCallback(callback, mainHandler)
        controllerCallbacks[controller] = callback
        Log.d(TAG, "Registered callback for ${controller.packageName}")
    }

    private fun emitMediaState(controller: MediaController) {
        val metadata = controller.metadata
        val state = controller.playbackState

        val stateString = when (state?.state) {
            PlaybackState.STATE_PLAYING -> "playing"
            PlaybackState.STATE_PAUSED -> "paused"
            PlaybackState.STATE_STOPPED -> "stopped"
            PlaybackState.STATE_BUFFERING -> "buffering"
            else -> "unknown"
        }

        // Use shared helper — no more duplicated artwork logic
        val artworkUri = ArtworkHelper.resolveArtworkUri(controller, cacheDir)

        val bundle = Bundle().apply {
            putString("package", controller.packageName)
            putString("title", metadata?.getString(MediaMetadata.METADATA_KEY_TITLE) ?: "")
            putString("artist", metadata?.getString(MediaMetadata.METADATA_KEY_ARTIST)
                ?: metadata?.getString(MediaMetadata.METADATA_KEY_ALBUM_ARTIST) ?: "")
            putString("album", metadata?.getString(MediaMetadata.METADATA_KEY_ALBUM) ?: "")
            putString("state", stateString)
            putString("artworkUri", artworkUri)
            putLong("position", state?.position ?: 0L)
            putLong("duration", metadata?.getLong(MediaMetadata.METADATA_KEY_DURATION) ?: 0L)
            putLong("timestamp", System.currentTimeMillis())
        }

        MediaEventManager.emitEvent(bundle)
    }
}
