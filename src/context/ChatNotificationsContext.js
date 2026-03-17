import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react'
import { getChatCanales, getChatMensajes } from '../services/api'
import { useAuth } from './AuthContext'

const ChatNotificationsContext = createContext({
  dmUnread: {},
  channelUnread: {},
  channelMentionCnt: {},
  totalDmUnread: 0,
  totalMentions: 0,
  totalUnread: 0,
  markRead: () => {},
})

export function ChatNotificationsProvider({ children }) {
  const { user } = useAuth()
  const userId   = user?.id
  const userName = (user?.nombre || user?.email || '').toLowerCase()

  const [dmUnread,          setDmUnread]          = useState({})
  const [channelUnread,     setChannelUnread]      = useState({})
  const [channelMentionCnt, setChannelMentionCnt]  = useState({})

  // last seen message id per canal (in-memory only)
  const lastSeenRef  = useRef({})  // { canalId: messageId }
  const openCanalRef = useRef(null) // id of currently open canal

  function markRead(canalId) {
    openCanalRef.current = canalId
    setDmUnread(prev      => prev[canalId]          ? { ...prev, [canalId]: 0 }          : prev)
    setChannelUnread(prev => prev[canalId]          ? { ...prev, [canalId]: 0 }          : prev)
    setChannelMentionCnt(prev => prev[canalId]      ? { ...prev, [canalId]: 0 }          : prev)
  }

  function unmarkOpen() {
    openCanalRef.current = null
  }

  function decodeEntities(str) {
    return String(str)
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
  }

  function hasMention(contenido) {
    if (!contenido) return false
    const decoded = decodeEntities(String(contenido))
    // HTML richtext mentions: <span ... data-id="userId" ...>
    if (userId && (
      decoded.includes(`data-id="${userId}"`) ||
      decoded.includes(`data-id='${userId}'`)
    )) return true
    // Fallback: plain @username text
    if (userName) {
      const plain = decoded.replace(/<[^>]+>/g, '').toLowerCase()
      if (plain.includes(`@${userName}`)) return true
    }
    return false
  }

  const pollRef = useRef(null)

  const doPoll = useCallback(async () => {
    if (!userId) return
    try {
      const raw = await getChatCanales()
      const canales = Array.isArray(raw) ? raw : (raw?.canales || [])

      const newDm      = {}
      const newCh      = {}
      const newMention = {}

      for (const canal of canales) {
        // skip canal that is currently open (user can see messages)
        const isOpen = openCanalRef.current === canal.id
        try {
          const msgs = await getChatMensajes(canal.id, 30)
          if (!Array.isArray(msgs) || msgs.length === 0) continue

          const lastKnownId = lastSeenRef.current[canal.id]
          // find messages newer than what we've seen
          let newMsgs
          if (!lastKnownId) {
            // First poll — mark everything as seen, no badge
            lastSeenRef.current[canal.id] = msgs[msgs.length - 1].id
            continue
          } else {
            const lastIdx = msgs.findIndex(m => m.id === lastKnownId)
            newMsgs = lastIdx >= 0 ? msgs.slice(lastIdx + 1) : msgs
          }

          // Update last seen to most recent
          if (msgs.length > 0) {
            lastSeenRef.current[canal.id] = msgs[msgs.length - 1].id
          }

          // Filter out own messages
          const othersNewMsgs = newMsgs.filter(m => m.user_id !== userId)

          if (othersNewMsgs.length === 0) continue

          if (isOpen) {
            // Channel is open — mark read immediately
            continue
          }

          if (canal.tipo === 'directo') {
            newDm[canal.id] = (newDm[canal.id] || 0) + othersNewMsgs.length
          } else {
            const mentions = othersNewMsgs.filter(m => hasMention(m.contenido))
            if (mentions.length > 0) {
              newMention[canal.id] = (newMention[canal.id] || 0) + mentions.length
            }
            // Any activity (not just mentions) for the channel unread dot
            newCh[canal.id] = (newCh[canal.id] || 0) + othersNewMsgs.length
          }
        } catch {
          // skip canal on error
        }
      }

      setDmUnread(prev      => mergeUnread(prev, newDm))
      setChannelUnread(prev => mergeUnread(prev, newCh))
      setChannelMentionCnt(prev => mergeUnread(prev, newMention))
    } catch {
      // network error — skip
    }
  }, [userId, userName])

  function mergeUnread(prev, incoming) {
    // Only add new counts on top of existing ones (badges accumulate until markRead)
    const result = { ...prev }
    for (const [id, cnt] of Object.entries(incoming)) {
      result[id] = (result[id] || 0) + cnt
    }
    return result
  }

  useEffect(() => {
    if (!userId) return
    // Initial poll after short delay
    const init = setTimeout(doPoll, 1500)
    pollRef.current = setInterval(doPoll, 6000)
    return () => {
      clearTimeout(init)
      clearInterval(pollRef.current)
    }
  }, [doPoll, userId])

  const totalDmUnread  = Object.values(dmUnread).reduce((a, b) => a + b, 0)
  const totalMentions  = Object.values(channelMentionCnt).reduce((a, b) => a + b, 0)
  const totalUnread    = totalDmUnread + totalMentions

  return (
    <ChatNotificationsContext.Provider value={{
      dmUnread,
      channelUnread,
      channelMentionCnt,
      totalDmUnread,
      totalMentions,
      totalUnread,
      markRead,
      unmarkOpen,
    }}>
      {children}
    </ChatNotificationsContext.Provider>
  )
}

export function useChatNotifications() {
  return useContext(ChatNotificationsContext)
}
