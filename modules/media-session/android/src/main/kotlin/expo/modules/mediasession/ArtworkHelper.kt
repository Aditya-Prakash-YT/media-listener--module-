package expo.modules.mediasession

import android.graphics.Bitmap
import android.media.MediaMetadata
import android.media.session.MediaController
import android.util.Log
import java.io.File

/**
 * Shared artwork resolution logic.
 * Used by both MediaSessionModule (synchronous getState) and MediaSessionService (event emission).
 */
object ArtworkHelper {
    private const val TAG = "ArtworkHelper"

    private data class ArtCache(val signature: String, val timestamp: Long)
    private val artworkCache = mutableMapOf<String, ArtCache>()

    /**
     * Resolve artwork URI for a media controller.
     * Returns a file:// URI with cache-busting timestamp, or a pass-through URI string, or null.
     *
     * @param controller The active MediaController
     * @param cacheDir   Directory to write bitmap files into
     */
    fun resolveArtworkUri(controller: MediaController, cacheDir: File): String? {
        val metadata = controller.metadata ?: return null

        val title = metadata.getString(MediaMetadata.METADATA_KEY_TITLE) ?: ""
        val album = metadata.getString(MediaMetadata.METADATA_KEY_ALBUM) ?: ""
        val signature = "$title|$album"

        try {
            // Try bitmap first (most local players embed it)
            val bitmap = metadata.getBitmap(MediaMetadata.METADATA_KEY_ALBUM_ART)
                ?: metadata.getBitmap(MediaMetadata.METADATA_KEY_ART)

            if (bitmap != null) {
                try {
                    val cache = artworkCache[controller.packageName]
                    val ts: Long

                    if (cache != null && cache.signature == signature) {
                        ts = cache.timestamp
                    } else {
                        ts = System.currentTimeMillis()
                        val file = File(cacheDir, "album_art_${controller.packageName}.jpg")
                        file.outputStream().use { stream ->
                            bitmap.compress(Bitmap.CompressFormat.JPEG, 80, stream)
                        }
                        artworkCache[controller.packageName] = ArtCache(signature, ts)
                    }

                    val file = File(cacheDir, "album_art_${controller.packageName}.jpg")
                    return "file://${file.absolutePath}?ts=$ts"
                } finally {
                    bitmap.recycle()
                }
            }

            // Fallback: URI string from metadata
            val artUriStr = metadata.getString(MediaMetadata.METADATA_KEY_ALBUM_ART_URI)
                ?: metadata.getString(MediaMetadata.METADATA_KEY_ART_URI)

            if (artUriStr != null) {
                val cache = artworkCache[controller.packageName]
                val ts: Long
                if (cache != null && cache.signature == signature) {
                    ts = cache.timestamp
                } else {
                    ts = System.currentTimeMillis()
                    artworkCache[controller.packageName] = ArtCache(signature, ts)
                }
                return "$artUriStr?ts=$ts"
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error resolving artwork for ${controller.packageName}", e)
        }

        return null
    }
}
