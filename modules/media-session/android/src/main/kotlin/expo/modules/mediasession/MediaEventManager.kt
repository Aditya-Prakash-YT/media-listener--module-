package expo.modules.mediasession

import android.os.Bundle

object MediaEventManager {
    private var listener: ((Bundle) -> Unit)? = null

    fun setListener(callback: (Bundle) -> Unit) {
        listener = callback
    }

    fun emitEvent(data: Bundle) {
        listener?.invoke(data)
    }
}
