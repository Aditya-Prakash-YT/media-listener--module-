package expo.modules.mediasession

import android.os.Bundle
import java.util.concurrent.atomic.AtomicReference

object MediaEventManager {
    private val listenerRef = AtomicReference<((Bundle) -> Unit)?>()

    fun setListener(callback: ((Bundle) -> Unit)?) {
        listenerRef.set(callback)
    }

    fun emitEvent(data: Bundle) {
        listenerRef.get()?.invoke(data)
    }
}
