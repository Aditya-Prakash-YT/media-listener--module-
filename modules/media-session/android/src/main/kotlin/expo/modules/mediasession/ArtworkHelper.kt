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

    // Volatile reference to the most recently used cache directory for LRU eviction disk cleanup
    @Volatile
    private var lastCacheDir: File? = null

    // Ensures orphaned temp file cleanup runs at most once per process
    private val tempCleanupDone = java.util.concurrent.atomic.AtomicBoolean(false)

    // Thread-safe bounded LRU cache to prevent unbounded memory growth.
    // Deletes on-disk artwork files when evicting entries to prevent disk accumulation (SEC-05).
    private val artworkCache = object : LinkedHashMap<String, ArtCache>(16, 0.75f, true) {
        override fun removeEldestEntry(eldest: MutableMap.MutableEntry<String, ArtCache>?): Boolean {
            if (size > MAX_CACHE_ENTRIES && eldest != null) {
                val dir = lastCacheDir
                if (dir != null) {
                    try { File(dir, "album_art_${eldest.key}.jpg").delete() } catch (_: Exception) {}
                }
                return true
            }
            return false
        }
    }

    /**
     * Remove orphaned temporary artwork files left behind by interrupted writes.
     * Runs at most once per process lifetime to avoid repeated I/O.
     */
    private fun cleanupOrphanedTempFiles(cacheDir: File) {
        if (!tempCleanupDone.compareAndSet(false, true)) return
        try {
            cacheDir.listFiles()?.filter {
                it.name.startsWith("temp_art_") && it.name.endsWith(".tmp")
            }?.forEach { it.delete() }
        } catch (_: Exception) { /* best-effort cleanup */ }
    }

    /**
     * Resolve artwork URI for a media controller safely.
     * Extracts metadata defensively and delegates to snapshot-based resolution.
     */
    fun resolveArtworkUri(controller: MediaController, cacheDir: File): String? {
        val (pkg, metadata) = try {
            val p = controller.packageName
            val m = controller.metadata
            p to m
        } catch (e: Exception) {
            Log.w(TAG, "Failed to read metadata or package from controller", e)
            return null
        }
        return resolveArtworkUri(pkg, metadata, cacheDir)
    }

    /**
     * Resolve artwork URI from a captured metadata snapshot.
     * Prevents race conditions and avoids cross-thread Binder IPC calls.
     */
    fun resolveArtworkUri(packageName: String?, metadata: MediaMetadata?, cacheDir: File): String? {
        if (metadata == null) return null

        // Store cache directory reference for LRU eviction disk cleanup and clean orphaned temp files
        lastCacheDir = cacheDir
        cleanupOrphanedTempFiles(cacheDir)

        val rawPkg = packageName ?: "unknown"
        // Strict alphanumeric + underscores/dots, truncated to 128 chars to avoid OS filename overflow
        val safePkgName = rawPkg.filter { it.isLetterOrDigit() || it == '.' || it == '_' }.take(128).ifEmpty { "unknown" }

        val title = metadata.getString(MediaMetadata.METADATA_KEY_TITLE) ?: ""
        val album = metadata.getString(MediaMetadata.METADATA_KEY_ALBUM) ?: ""
        val signature = "$title|$album"

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
            val rawBitmap = try {
                metadata.getBitmap(MediaMetadata.METADATA_KEY_ALBUM_ART)
                    ?: metadata.getBitmap(MediaMetadata.METADATA_KEY_ART)
            } catch (e: Exception) {
                Log.w(TAG, "Error getting bitmap from metadata for $rawPkg", e)
                null
            }

            if (rawBitmap != null && !rawBitmap.isRecycled) {
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
                            if (!cacheDir.exists()) {
                                cacheDir.mkdirs()
                            }
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
                                // Set owner-only readable permission
                                targetFile.setReadable(true, true)
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
            val artUriStr = try {
                metadata.getString(MediaMetadata.METADATA_KEY_ALBUM_ART_URI)
                    ?: metadata.getString(MediaMetadata.METADATA_KEY_ART_URI)
            } catch (e: Exception) {
                null
            }

            if (!artUriStr.isNullOrBlank()) {
                val trimmedUri = artUriStr.trim()
                // Reject control characters or newlines
                if (trimmedUri.contains('\n') || trimmedUri.contains('\r')) {
                    Log.w(TAG, "Rejected artwork URI with control characters for package $rawPkg")
                    return null
                }

                // Validate URI scheme to block arbitrary or dangerous schemes
                val parsedUri = android.net.Uri.parse(trimmedUri)
                val scheme = parsedUri.scheme?.lowercase()

                // SEC-01/SEC-02: Only allow https and content URIs from external metadata.
                // Blocks cleartext http and arbitrary local file:// URIs.
                if (scheme == "https") {
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
                    val separator = if (trimmedUri.contains("?")) "&" else "?"
                    return "$trimmedUri${separator}ts=$ts"
                } else if (scheme == "content") {
                    // Pass content:// URIs cleanly without appending query parameters
                    // to prevent breaking ContentUris.parseId() in Android ContentProviders
                    return trimmedUri
                } else {
                    Log.w(TAG, "Rejected artwork URI with disallowed scheme '$scheme' for package $rawPkg (only https and content are permitted)")
                }
            }
        } catch (oom: OutOfMemoryError) {
            // SEC-03: OutOfMemoryError is a java.lang.Error, not Exception.
            Log.e(TAG, "OutOfMemoryError resolving artwork for $rawPkg", oom)
        } catch (t: Throwable) {
            Log.e(TAG, "Error resolving artwork for $rawPkg", t)
        }

        return null
    }
}
