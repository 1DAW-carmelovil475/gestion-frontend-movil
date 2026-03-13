import { useState, useEffect, useRef, useCallback } from 'react'
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '../context/AuthContext'
import { getChatCanales, getChatMensajes, sendChatMensaje } from '../services/api'

function formatHora(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
}

export default function ChatScreen() {
  const { user } = useAuth()
  const [canales, setCanales]     = useState([])
  const [canal, setCanal]         = useState(null)
  const [mensajes, setMensajes]   = useState([])
  const [texto, setTexto]         = useState('')
  const [loading, setLoading]     = useState(true)
  const [sending, setSending]     = useState(false)
  const flatRef = useRef(null)

  const loadCanales = useCallback(async () => {
    try {
      const data = await getChatCanales()
      setCanales(Array.isArray(data) ? data : data.canales || [])
    } catch (e) { Alert.alert('Error', e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { loadCanales() }, [loadCanales])

  async function openCanal(c) {
    setCanal(c)
    try {
      const data = await getChatMensajes(c.id)
      setMensajes(Array.isArray(data) ? data : data.mensajes || [])
    } catch { setMensajes([]) }
  }

  async function handleSend() {
    if (!texto.trim() || !canal) return
    setSending(true)
    try {
      const m = await sendChatMensaje(canal.id, texto.trim())
      setMensajes(prev => [...prev, m])
      setTexto('')
      setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100)
    } catch (e) { Alert.alert('Error', e.message) }
    finally { setSending(false) }
  }

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#0066ff" /></View>

  if (!canal) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Chat</Text>
        </View>
        <FlatList
          data={canales}
          keyExtractor={item => String(item.id)}
          ListEmptyComponent={<Text style={styles.empty}>Sin canales disponibles</Text>}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.canalItem} onPress={() => openCanal(item)}>
              <View style={styles.canalIcon}>
                <Ionicons name="chatbubbles-outline" size={20} color="#0066ff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.canalNombre}>{item.nombre}</Text>
                {item.descripcion && <Text style={styles.canalDesc} numberOfLines={1}>{item.descripcion}</Text>}
              </View>
              <Ionicons name="chevron-forward" size={18} color="#475569" />
            </TouchableOpacity>
          )}
        />
      </View>
    )
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={80}
    >
      {/* Header canal */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setCanal(null)}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{canal.nombre}</Text>
        <TouchableOpacity onPress={() => openCanal(canal)}>
          <Ionicons name="refresh-outline" size={22} color="#94a3b8" />
        </TouchableOpacity>
      </View>

      {/* Mensajes */}
      <FlatList
        ref={flatRef}
        data={mensajes}
        keyExtractor={item => String(item.id)}
        contentContainerStyle={{ padding: 12, paddingBottom: 8 }}
        ListEmptyComponent={<Text style={styles.empty}>Sin mensajes aún</Text>}
        onLayout={() => flatRef.current?.scrollToEnd({ animated: false })}
        renderItem={({ item }) => {
          const isMe = String(item.autor_id) === String(user?.id)
          return (
            <View style={[styles.msgRow, isMe && styles.msgRowMe]}>
              <View style={[styles.msgBubble, isMe && styles.msgBubbleMe]}>
                {!isMe && (
                  <Text style={styles.msgAutor}>{item.autor_nombre || item.autor_email}</Text>
                )}
                <Text style={styles.msgTexto}>{item.contenido}</Text>
                <Text style={styles.msgHora}>{formatHora(item.created_at)}</Text>
              </View>
            </View>
          )
        }}
      />

      {/* Input */}
      <View style={styles.inputRow}>
        <TextInput
          style={styles.msgInput}
          placeholder="Escribe un mensaje..."
          placeholderTextColor="#64748b"
          value={texto}
          onChangeText={setTexto}
          multiline
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!texto.trim() || sending) && styles.sendBtnDisabled]}
          onPress={handleSend}
          disabled={!texto.trim() || sending}
        >
          {sending ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="send" size={18} color="#fff" />}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: '#0f172a' },
  center:          { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header:          { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#1e293b', borderBottomWidth: 1, borderBottomColor: '#334155' },
  headerTitle:     { color: '#fff', fontSize: 17, fontWeight: '700', flex: 1 },
  empty:           { color: '#64748b', textAlign: 'center', marginTop: 40 },
  canalItem:       { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderBottomWidth: 1, borderBottomColor: '#1e293b' },
  canalIcon:       { width: 40, height: 40, borderRadius: 20, backgroundColor: '#1e293b', justifyContent: 'center', alignItems: 'center' },
  canalNombre:     { color: '#fff', fontWeight: '600', fontSize: 15 },
  canalDesc:       { color: '#64748b', fontSize: 12, marginTop: 2 },
  msgRow:          { marginBottom: 8, alignItems: 'flex-start' },
  msgRowMe:        { alignItems: 'flex-end' },
  msgBubble:       { maxWidth: '80%', backgroundColor: '#1e293b', borderRadius: 14, borderBottomLeftRadius: 4, padding: 10 },
  msgBubbleMe:     { backgroundColor: '#1d4ed8', borderBottomRightRadius: 4, borderBottomLeftRadius: 14 },
  msgAutor:        { color: '#60a5fa', fontSize: 11, fontWeight: '600', marginBottom: 3 },
  msgTexto:        { color: '#e2e8f0', fontSize: 14, lineHeight: 19 },
  msgHora:         { color: '#64748b', fontSize: 10, marginTop: 3, textAlign: 'right' },
  inputRow:        { flexDirection: 'row', padding: 10, backgroundColor: '#1e293b', borderTopWidth: 1, borderTopColor: '#334155', gap: 8, alignItems: 'flex-end' },
  msgInput:        { flex: 1, backgroundColor: '#0f172a', color: '#fff', borderRadius: 20, borderWidth: 1, borderColor: '#334155', paddingHorizontal: 14, paddingVertical: 9, fontSize: 14, maxHeight: 100 },
  sendBtn:         { width: 40, height: 40, borderRadius: 20, backgroundColor: '#0066ff', justifyContent: 'center', alignItems: 'center' },
  sendBtnDisabled: { opacity: 0.5 },
})
