import { onMounted, onBeforeUnmount } from 'vue'

/**
 * useAutoRefresh
 * Registers a listener for 'it-equipment:data-refresh' custom window event (triggered by backend SSE).
 * Ensures views automatically refresh data without page reloads (zero F5).
 */
export function useAutoRefresh(callback) {
  const handler = (event) => {
    if (typeof callback === 'function') {
      try {
        callback(event?.detail)
      } catch (err) {
        console.error('AUTO_REFRESH_CALLBACK_ERROR:', err)
      }
    }
  }

  onMounted(() => {
    window.addEventListener('it-equipment:data-refresh', handler)
  })

  onBeforeUnmount(() => {
    window.removeEventListener('it-equipment:data-refresh', handler)
  })
}

