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
        // Strict alphanumeric + underscores/dots, strip path separators or traversal characters
        val safePkgName = rawPkg.filter { it.isLetterOrDigit() || it == '.' || it == '_' }.ifEmpty { "unknown" }

        val targetFile = File(cacheDir, "album_art_$safePkgName.jpg")

        // Strict canonical path boundary check against directory traversal (API 24+ compatible)
        try {
            val cacheCanonical = cacheDir.canonicalPath
            val targetCanonical = targetFile.canonicalPath
            val cachePrefix = if (cacheCanonical.endsWith(File.separator)) cacheCanonical else cacheCanonical + File.separator
            if (!targetCanonical.startsWith(cachePrefix)) {
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
                            // Atomic write via temp file to avoid leaving corrupt/partial files
                            val tempFile = File(cacheDir, "temp_art_${safePkgName}_${ts}.tmp")
                            try {
                                tempFile.outputStream().use { stream ->
                                    bitmap.compress(Bitmap.CompressFormat.JPEG, 80, stream)
                                }
                                if (targetFile.exists()) {
                                    targetFile.delete()
                                }
                                if (!tempFile.renameTo(targetFile)) {
                                    tempFile.copyTo(targetFile, overwrite = true)
                                    tempFile.delete()
                                }
                            } catch (writeEx: Exception) {
                                tempFile.delete()
                                throw writeEx
                            }
                            artworkCache[safePkgName] = ArtCache(signature, ts)
                        }
                    }

                    return "file://${targetFile.absolutePath}?ts=$ts"
                } finally {
                    // Recycle ONLY locally allocated scaledBitmap.
                    // DO NOT call rawBitmap.recycle() - rawBitmap belongs to MediaMetadata system parcel!
                    scaledBitmap?.recycle()
                }
            }

            // Fallback: URI string from metadata
            val artUriStr = metadata.getString(MediaMetadata.METADATA_KEY_ALBUM_ART_URI)
                ?: metadata.getString(MediaMetadata.METADATA_KEY_ART_URI)

            if (!artUriStr.isNullOrBlank()) {
                // Validate URI scheme to block arbitrary or dangerous schemes
                val parsedUri = android.net.Uri.parse(artUriStr)
                val scheme = parsedUri.scheme?.lowercase()
                if (scheme == "https" || scheme == "http" || scheme == "content" || scheme == "file") {
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
                } else {
                    Log.w(TAG, "Rejected untrusted artwork URI scheme '$scheme' for package $rawPkg")
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error resolving artwork for ${controller.packageName}", e)
        }

        return null
    }
}
