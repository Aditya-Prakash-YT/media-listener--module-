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

import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

class MediaSessionService : NotificationListenerService() {
    private var sessionManager: MediaSessionManager? = null
    private val controllerCallbacks = mutableMapOf<MediaController, MediaController.Callback>()
    private val mainHandler = Handler(Looper.getMainLooper())

    @Volatile
    private var executorService: ExecutorService? = null

    companion object {
        private const val TAG = "MediaSessionService"
        private const val MAX_STRING_LENGTH = 1000

        @Volatile
        var activeController: MediaController? = null
            private set

        /**
         * Clears activeController if it matches the dead controller.
         * Prevents subsequent commands from repeatedly invoking a dead Binder proxy.
         */
        fun clearActiveControllerIf(controller: MediaController?) {
            if (controller != null && activeController == controller) {
                activeController = null
            }
        }

        private fun sanitizeString(str: String?): String {
            if (str == null) return ""
            return str.take(MAX_STRING_LENGTH)
        }
    }

    /**
     * Lazily creates or recovers the single-thread background executor.
     * Prevents RejectedExecutionException if Android reconnects/re-binds the service
     * within the same application process lifetime.
     */
    private fun getExecutor(): ExecutorService {
        val current = executorService
        if (current != null && !current.isShutdown && !current.isTerminated) {
            return current
        }
        return synchronized(this) {
            val existing = executorService
            if (existing != null && !existing.isShutdown && !existing.isTerminated) {
                existing
            } else {
                val newExec = Executors.newSingleThreadExecutor { runnable ->
                    Thread(runnable, "MediaSessionWorker").apply {
                        isDaemon = true
                    }
                }
                executorService = newExec
                newExec
            }
        }
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
        
        // Defensively extract package names to avoid crashing on dead controller Binder proxies
        val currentPackages = controllers?.mapNotNull {
            try { it.packageName } catch (_: Exception) { null }
        }?.toSet() ?: emptySet()

        val registeredPackages = controllerCallbacks.keys.mapNotNull {
            try { it.packageName } catch (_: Exception) { null }
        }?.toSet() ?: emptySet()

        // Clear activeController if its package is no longer active to prevent stale references
        if (activeController != null) {
            val activePkg = try { activeController?.packageName } catch (_: Exception) { null }
            if (activePkg == null || activePkg !in currentPackages) {
                activeController = null
            }
        }
        
        // Safe removal — snapshot keys first to avoid ConcurrentModificationException
        val toRemove = controllerCallbacks.keys.filter { controller ->
            val pkg = try { controller.packageName } catch (_: Exception) { null }
            pkg == null || pkg !in currentPackages
        }
        toRemove.forEach { controller ->
            controllerCallbacks.remove(controller)?.let { callback ->
                try {
                    controller.unregisterCallback(callback)
                } catch (_: Exception) {}
            }
        }
        
        controllers?.forEach { controller ->
            val pkg = try { controller.packageName } catch (_: Exception) { null }
            if (pkg != null && pkg !in registeredPackages) {
                registerControllerCallback(controller)
            }
        }
        
        controllers?.firstOrNull()?.let { first ->
            try {
                if (first.playbackState?.state == PlaybackState.STATE_PLAYING) {
                    activeController = first
                    emitMediaState(first)
                }
            } catch (e: Exception) {
                Log.w(TAG, "Failed to query state for first controller", e)
            }
        }
    }

    private fun registerControllerCallback(controller: MediaController) {
        val callback = object : MediaController.Callback() {
            override fun onMetadataChanged(metadata: MediaMetadata?) {
                Log.d(TAG, "Metadata changed for ${try { controller.packageName } catch (_: Exception) { "unknown" }}")
                emitMediaState(controller)
            }

            override fun onPlaybackStateChanged(state: PlaybackState?) {
                val pkg = try { controller.packageName } catch (_: Exception) { "unknown" }
                Log.d(TAG, "Playback state changed: ${state?.state} for $pkg")
                if (state?.state == PlaybackState.STATE_PLAYING) {
                    activeController = controller
                }
                emitMediaState(controller)
            }
        }

        try {
            controller.registerCallback(callback, mainHandler)
            controllerCallbacks[controller] = callback
            Log.d(TAG, "Registered callback for ${try { controller.packageName } catch (_: Exception) { "unknown" }}")
        } catch (e: Exception) {
            Log.w(TAG, "Failed to register callback for controller", e)
        }
    }

    private fun emitMediaState(controller: MediaController) {
        // Defensively capture state snapshot on main thread
        val pkg: String
        val metadata: MediaMetadata?
        val state: PlaybackState?

        try {
            pkg = controller.packageName ?: ""
            metadata = controller.metadata
            state = controller.playbackState
        } catch (e: android.os.DeadObjectException) {
            Log.w(TAG, "MediaController is dead during state capture, clearing reference")
            clearActiveControllerIf(controller)
            return
        } catch (e: Exception) {
            Log.w(TAG, "Error capturing controller state snapshot", e)
            return
        }

        val stateString = when (state?.state) {
            PlaybackState.STATE_PLAYING -> "playing"
            PlaybackState.STATE_PAUSED -> "paused"
            PlaybackState.STATE_STOPPED -> "stopped"
            PlaybackState.STATE_BUFFERING -> "buffering"
            else -> "unknown"
        }

        // Sanitize string inputs to defend against oversized or malicious metadata payloads
        val rawTitle = metadata?.getString(MediaMetadata.METADATA_KEY_TITLE)
        val rawArtist = metadata?.getString(MediaMetadata.METADATA_KEY_ARTIST)
            ?: metadata?.getString(MediaMetadata.METADATA_KEY_ALBUM_ARTIST)
        val rawAlbum = metadata?.getString(MediaMetadata.METADATA_KEY_ALBUM)

        val title = sanitizeString(rawTitle)
        val artist = sanitizeString(rawArtist)
        val album = sanitizeString(rawAlbum)
        val position = (state?.position ?: 0L).coerceAtLeast(0L)
        val duration = (metadata?.getLong(MediaMetadata.METADATA_KEY_DURATION) ?: 0L).coerceAtLeast(0L)

        getExecutor().execute {
            try {
                // Disk I/O and JPEG compression safely performed in background on captured snapshot
                val artworkUri = ArtworkHelper.resolveArtworkUri(pkg, metadata, cacheDir)

                val bundle = Bundle().apply {
                    putString("package", pkg)
                    putString("title", title)
                    putString("artist", artist)
                    putString("album", album)
                    putString("state", stateString)
                    putString("artworkUri", artworkUri)
                    putLong("position", position)
                    putLong("duration", duration)
                    putLong("timestamp", System.currentTimeMillis())
                }

                MediaEventManager.emitEvent(bundle)
            } catch (t: Throwable) {
                Log.e(TAG, "Error resolving artwork or emitting state in background", t)
            }
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        activeController = null
        synchronized(this) {
            try {
                executorService?.shutdown()
            } catch (e: Exception) {
                Log.e(TAG, "Error shutting down backgroundExecutor", e)
            } finally {
                executorService = null
            }
        }
    }
}
