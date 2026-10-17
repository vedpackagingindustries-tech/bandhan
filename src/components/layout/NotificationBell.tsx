'use client'

import { useState, useEffect, useCallback } from 'react'
import { Bell, X, Check, CheckCheck, Trash2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'

interface Notification {
  id: string
  type: string
  title: string
  message: string
  read: boolean
  createdAt: string
}

export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)

  // Get session token from localStorage
  const getToken = useCallback(() => {
    try {
      const sessionStr = localStorage.getItem('bandhan-session')
      if (sessionStr) {
        const session = JSON.parse(sessionStr)
        return session?.token || null
      }
    } catch {}
    return null
  }, [])

  const token = getToken()

  // Fetch notifications when panel opens
  useEffect(() => {
    if (open && token) {
      fetchNotifications()
    }
  }, [open, token])

  // Poll unread count every 30s
  useEffect(() => {
    if (!token) return

    const fetchUnread = async () => {
      try {
        const res = await fetch('/api/v1/notifications?unread=true&limit=1', {
          headers: { Authorization: `Bearer ${token}` }
        })
        if (res.ok) {
          const data = await res.json()
          setUnreadCount(data.data?.unreadCount || 0)
        }
      } catch {}
    }

    fetchUnread()
    const interval = setInterval(fetchUnread, 30000)
    return () => clearInterval(interval)
  }, [token])

  const fetchNotifications = async () => {
    if (!token) return
    setLoading(true)
    try {
      const res = await fetch('/api/v1/notifications?limit=20', {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        setNotifications(data.data?.items || [])
        setUnreadCount(data.data?.unreadCount || 0)
      }
    } catch {}
    setLoading(false)
  }

  const markAsRead = async (id: string) => {
    if (!token) return
    try {
      const res = await fetch('/api/v1/notifications', {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id }),
      })
      if (res.ok) {
        setNotifications(prev =>
          prev.map(n => n.id === id ? { ...n, read: true } : n)
        )
        setUnreadCount(prev => Math.max(0, prev - 1))
      }
    } catch {}
  }

  const markAllRead = async () => {
    if (!token) return
    try {
      const res = await fetch('/api/v1/notifications', {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ markAll: true }),
      })
      if (res.ok) {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })))
        setUnreadCount(0)
      }
    } catch {}
  }

  const deleteNotification = async (id: string) => {
    if (!token) return
    try {
      const res = await fetch(`/api/v1/notifications?id=${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        setNotifications(prev => prev.filter(n => n.id !== id))
      }
    } catch {}
  }

  // Don't show bell if not logged in
  if (!token) return null

  const typeIcon: Record<string, string> = {
    APPROVAL: '✅',
    REJECTION: '❌',
    CONTACT_REQUEST: '💑',
    APPOINTMENT: '📅',
    MEMBERSHIP: '⭐',
    SYSTEM: '🔔',
  }

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'अभी'
    if (mins < 60) return `${mins} मिनट पहले`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours} घंटे पहले`
    const days = Math.floor(hours / 24)
    return `${days} दिन पहले`
  }

  return (
    <div className="relative">
      {/* Bell Button */}
      <button
        onClick={() => setOpen(!open)}
        className="relative flex h-9 w-9 items-center justify-center rounded-xl transition-all duration-200 hover:bg-cream"
        aria-label="Notifications"
      >
        <Bell className="h-4.5 w-4.5 text-foreground/70" strokeWidth={1.5} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4.5 min-w-[18px] items-center justify-center rounded-full bg-burgundy px-1 text-[10px] font-bold text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notification Panel */}
      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-40"
              onClick={() => setOpen(false)}
            />

            {/* Panel */}
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="absolute right-0 top-full z-50 mt-2 w-80 sm:w-96 overflow-hidden rounded-2xl border border-border/30 bg-white shadow-2xl"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-border/20 px-4 py-3">
                <h3 className="text-sm font-semibold text-foreground">
                  सूचनाएं {unreadCount > 0 && <span className="text-burgundy">({unreadCount})</span>}
                </h3>
                <div className="flex items-center gap-1">
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllRead}
                      className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-burgundy hover:bg-cream"
                    >
                      <CheckCheck className="h-3 w-3" />
                      सभी पढ़ें
                    </button>
                  )}
                  <button
                    onClick={() => setOpen(false)}
                    className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-cream"
                  >
                    <X className="h-3.5 w-3.5 text-foreground/50" />
                  </button>
                </div>
              </div>

              {/* List */}
              <div className="max-h-80 overflow-y-auto">
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-burgundy border-t-transparent" />
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                    कोई सूचना नहीं
                  </div>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      className={cn(
                        'group flex gap-3 border-b border-border/10 px-4 py-3 transition-colors hover:bg-cream/50',
                        !n.read && 'bg-burgundy/[0.03]'
                      )}
                    >
                      <span className="mt-0.5 text-base">
                        {typeIcon[n.type] || '🔔'}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className={cn(
                          'text-xs leading-snug',
                          n.read ? 'text-foreground/60' : 'font-medium text-foreground'
                        )}>
                          {n.title}
                        </p>
                        <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                          {n.message}
                        </p>
                        <p className="mt-1 text-[10px] text-muted-foreground/60">
                          {timeAgo(n.createdAt)}
                        </p>
                      </div>
                      <div className="flex flex-col items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        {!n.read && (
                          <button
                            onClick={() => markAsRead(n.id)}
                            className="flex h-6 w-6 items-center justify-center rounded-lg hover:bg-burgundy/10"
                            title="पढ़ें"
                          >
                            <Check className="h-3 w-3 text-burgundy" />
                          </button>
                        )}
                        <button
                          onClick={() => deleteNotification(n.id)}
                          className="flex h-6 w-6 items-center justify-center rounded-lg hover:bg-red-50"
                          title="हटाएं"
                        >
                          <Trash2 className="h-3 w-3 text-red-400" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
