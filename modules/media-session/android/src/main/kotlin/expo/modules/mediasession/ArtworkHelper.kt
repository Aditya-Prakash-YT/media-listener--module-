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
    private const val MAX_ARTWORK_DIMENSION = 512
    private const val MAX_CACHE_ENTRIES = 30

    private data class ArtCache(val signature: String, val timestamp: Long)

    // Thread-safe bounded LRU cache to prevent unbounded memory growth
    private val artworkCache = object : LinkedHashMap<String, ArtCache>(16, 0.75f, true) {
        override fun removeEldestEntry(eldest: MutableMap.MutableEntry<String, ArtCache>?): Boolean {
            return size > MAX_CACHE_ENTRIES
        }
    }

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

        val rawPkg = controller.packageName ?: "unknown"
        val safePkgName = rawPkg.replace("[^a-zA-Z0-9._-]".toRegex(), "_")

        val targetFile = File(cacheDir, "album_art_$safePkgName.jpg")

        // Canonical path validation against directory traversal
        try {
            if (!targetFile.canonicalPath.startsWith(cacheDir.canonicalPath)) {
                Log.w(TAG, "Path traversal attempt blocked for package: $rawPkg")
                return null
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to validate canonical path for package: $rawPkg", e)
            return null
        }

        try {
            // Try bitmap first (most local players embed it)
            val rawBitmap = metadata.getBitmap(MediaMetadata.METADATA_KEY_ALBUM_ART)
                ?: metadata.getBitmap(MediaMetadata.METADATA_KEY_ART)

            if (rawBitmap != null) {
                var scaledBitmap: Bitmap? = null
                try {
                    // Downscale large bitmaps to prevent OOM and reduce compression time
                    val bitmap = if (rawBitmap.width > MAX_ARTWORK_DIMENSION || rawBitmap.height > MAX_ARTWORK_DIMENSION) {
                        val ratio = minOf(
                            MAX_ARTWORK_DIMENSION.toFloat() / rawBitmap.width,
                            MAX_ARTWORK_DIMENSION.toFloat() / rawBitmap.height
                        )
                        val scaledWidth = (rawBitmap.width * ratio).toInt().coerceAtLeast(1)
                        val scaledHeight = (rawBitmap.height * ratio).toInt().coerceAtLeast(1)
                        val scaled = Bitmap.createScaledBitmap(rawBitmap, scaledWidth, scaledHeight, true)
                        if (scaled != rawBitmap) {
                            scaledBitmap = scaled
                        }
                        scaled
                    } else {
                        rawBitmap
                    }

                    val ts: Long
                    synchronized(artworkCache) {
                        val cache = artworkCache[safePkgName]
                        if (cache != null && cache.signature == signature && targetFile.exists()) {
                            ts = cache.timestamp
                        } else {
                            ts = System.currentTimeMillis()
                            targetFile.outputStream().use { stream ->
                                bitmap.compress(Bitmap.CompressFormat.JPEG, 80, stream)
                            }
                            artworkCache[safePkgName] = ArtCache(signature, ts)
                        }
                    }

                    return "file://${targetFile.absolutePath}?ts=$ts"
                } finally {
                    scaledBitmap?.recycle()
                    rawBitmap.recycle()
                }
            }

            // Fallback: URI string from metadata
            val artUriStr = metadata.getString(MediaMetadata.METADATA_KEY_ALBUM_ART_URI)
                ?: metadata.getString(MediaMetadata.METADATA_KEY_ART_URI)

            if (!artUriStr.isNullOrBlank()) {
                val ts: Long
                synchronized(artworkCache) {
                    val cache = artworkCache[safePkgName]
                    if (cache != null && cache.signature == signature) {
                        ts = cache.timestamp
                    } else {
                        ts = System.currentTimeMillis()
                        artworkCache[safePkgName] = ArtCache(signature, ts)
                    }
                }
                val separator = if (artUriStr.contains("?")) "&" else "?"
                return "$artUriStr${separator}ts=$ts"
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error resolving artwork for ${controller.packageName}", e)
        }

        return null
    }
}
