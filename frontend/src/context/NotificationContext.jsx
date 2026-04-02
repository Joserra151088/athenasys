import { createContext, useContext, useState, useCallback, useRef } from 'react'

const NotificationContext = createContext(null)

const CONFIG = {
  error:   { bg: '#ef4444', border: '#b91c1c', icon: '✕', label: 'Error del sistema' },
  success: { bg: '#10b981', border: '#047857', icon: '✓', label: 'Operación exitosa' },
  warning: { bg: '#f59e0b', border: '#b45309', icon: '⚠', label: 'Aviso' },
  info:    { bg: '#3b82f6', border: '#1d4ed8', icon: 'i', label: 'Información' },
}

function NotificationItem({ id, type, title, message, onRemove }) {
  const cfg = CONFIG[type] || CONFIG.info
  return (
    <div style={{
      background: cfg.bg,
      border: `2px solid ${cfg.border}`,
      borderRadius: 16,
      padding: '18px 20px 22px',
      minWidth: 360,
      maxWidth: 500,
      boxShadow: '0 20px 60px rgba(0,0,0,0.35), 0 4px 16px rgba(0,0,0,0.2)',
      display: 'flex',
      alignItems: 'flex-start',
      gap: 14,
      position: 'relative',
      overflow: 'hidden',
      animation: 'notif-scale-in 0.35s cubic-bezier(0.34,1.56,0.64,1) forwards',
    }}>
      {/* Icon */}
      <div style={{
        width: 38, height: 38, borderRadius: '50%',
        background: 'rgba(255,255,255,0.22)',
        border: '2px solid rgba(255,255,255,0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: cfg.icon === 'i' ? 15 : 17,
        fontWeight: 900,
        color: '#fff',
        flexShrink: 0,
        fontStyle: cfg.icon === 'i' ? 'italic' : 'normal',
      }}>
        {cfg.icon}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: '#fff', fontWeight: 700, fontSize: 14, lineHeight: 1.3, marginBottom: message ? 5 : 0 }}>
          {title || cfg.label}
        </div>
        {message && (
          <div style={{ color: 'rgba(255,255,255,0.92)', fontSize: 13, lineHeight: 1.6, wordBreak: 'break-word' }}>
            {message}
          </div>
        )}
      </div>

      {/* Close */}
      <button
        onClick={() => onRemove(id)}
        style={{
          background: 'rgba(255,255,255,0.18)',
          border: '1px solid rgba(255,255,255,0.3)',
          borderRadius: 8,
          color: '#fff',
          cursor: 'pointer',
          width: 26, height: 26,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 12,
          fontWeight: 700,
          flexShrink: 0,
          marginTop: -2,
          transition: 'background 0.15s',
        }}
        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.32)'}
        onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.18)'}
      >✕</button>

      {/* Progress bar */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        height: 4,
        background: 'rgba(255,255,255,0.2)',
      }}>
        <div style={{
          height: '100%',
          background: 'rgba(255,255,255,0.6)',
          animation: 'notif-progress 6s linear forwards',
          transformOrigin: 'left',
        }} />
      </div>
    </div>
  )
}

function NotificationContainer({ notifications, onRemove }) {
  if (notifications.length === 0) return null
  return (
    <>
      <style>{`
        @keyframes notif-scale-in {
          from { opacity: 0; transform: scale(0.75); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes notif-progress {
          from { width: 100%; }
          to   { width: 0%; }
        }
      `}</style>
      {/* Backdrop */}
      <div style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.25)',
        zIndex: 99998,
        animation: 'notif-scale-in 0.2s ease forwards',
      }} />
      {/* Stack */}
      <div style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 99999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 12,
        pointerEvents: 'none',
      }}>
        {notifications.map(n => (
          <div key={n.id} style={{ pointerEvents: 'auto' }}>
            <NotificationItem {...n} onRemove={onRemove} />
          </div>
        ))}
      </div>
    </>
  )
}

export function NotificationProvider({ children }) {
  const [notifications, setNotifications] = useState([])
  const counter = useRef(0)

  const add = useCallback((type, message, title) => {
    const id = ++counter.current
    setNotifications(prev => [...prev.slice(-2), { id, type, title, message }])
    const timer = setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id))
    }, 6000)
    return () => clearTimeout(timer)
  }, [])

  const remove = useCallback((id) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
  }, [])

  const showError   = useCallback((msg, title) => add('error',   msg, title), [add])
  const showSuccess = useCallback((msg, title) => add('success', msg, title), [add])
  const showWarning = useCallback((msg, title) => add('warning', msg, title), [add])
  const showInfo    = useCallback((msg, title) => add('info',    msg, title), [add])

  return (
    <NotificationContext.Provider value={{ showError, showSuccess, showWarning, showInfo }}>
      {children}
      <NotificationContainer notifications={notifications} onRemove={remove} />
    </NotificationContext.Provider>
  )
}

export function useNotification() {
  const ctx = useContext(NotificationContext)
  if (!ctx) {
    return {
      showError:   (msg) => { console.error(msg) },
      showSuccess: (msg) => { console.log(msg) },
      showWarning: (msg) => { console.warn(msg) },
      showInfo:    (msg) => { console.log(msg) },
    }
  }
  return ctx
}
