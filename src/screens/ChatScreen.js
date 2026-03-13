import { useState, useEffect, useRef, useCallback } from 'react'
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '../context/AuthContext'
import { getChatCanales, getChatMensajes, sendChatMensaje } from '../services/api'

function formatHora(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
}

export default function ChatScreen() {
  const { user } = useAuth()
  const [canales, setCanales]   = useState([])
  const [canal, setCanal]       = useState(null)
  const [mensajes, setMensajes] = useState([])
  const [texto, setTexto]       = useState('')
  const [loading, setLoading]   = useState(true)
  const [sending, setSending]   = useState(false)
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

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}><ActivityIndicator size="large" color="#0047b3" /></View>
      </SafeAreaView>
    )
  }

  if (!canal) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Chat</Text>
        </View>
        <FlatList
          data={canales}
          keyExtractor={item => String(item.id)}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="chatbubbles-outline" size={48} color="#334155" />
              <Text style={styles.empty}>Sin canales disponibles</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.canalItem} onPress={() => openCanal(item)}>
              <View style={styles.canalIcon}>
                <Ionicons name="chatbubbles-outline" size={20} color="#0047b3" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.canalNombre}>{item.nombre}</Text>
                {item.descripcion && (
                  <Text style={styles.canalDesc} numberOfLines={1}>{item.descripcion}</Text>
                )}
              </View>
              <Ionicons name="chevron-forward" size={18} color="#475569" />
            </TouchableOpacity>
          )}
        />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        {/* Header canal */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setCanal(null)} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <View style={styles.canalInfo}>
            <View style={styles.canalDot} />
            <Text style={styles.headerTitle} numberOfLines={1}>{canal.nombre}</Text>
          </View>
          <TouchableOpacity onPress={() => openCanal(canal)} style={styles.refreshBtn}>
            <Ionicons name="refresh-outline" size={20} color="#64748b" />
          </TouchableOpacity>
        </View>

        {/* Mensajes */}
        <FlatList
          ref={flatRef}
          data={mensajes}
          keyExtractor={item => String(item.id)}
          contentContainerStyle={{ padding: 12, paddingBottom: 8 }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.empty}>Sin mensajes aún</Text>
            </View>
          }
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
            {sending
              ? <ActivityIndicator size="small" color="#fff" />
              : <Ionicons name="send" size={18} color="#fff" />
            }
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe:            { flex: 1, backgroundColor: '#0f172a' },
  center:          { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header:          { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 13, backgroundColor: '#1e293b', borderBottomWidth: 1, borderBottomColor: '#334155' },
  backBtn:         { padding: 2 },
  refreshBtn:      { padding: 2 },
  canalInfo:       { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  canalDot:        { width: 8, height: 8, borderRadius: 4, backgroundColor: '#16a34a' },
  headerTitle:     { color: '#fff', fontSize: 16, fontWeight: '700', flex: 1 },
  emptyContainer:  { alignItems: 'center', marginTop: 60, gap: 8 },
  empty:           { color: '#64748b', fontSize: 14 },
  canalItem:       { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderBottomWidth: 1, borderBottomColor: '#1e293b' },
  canalIcon:       { width: 44, height: 44, borderRadius: 22, backgroundColor: '#1e293b', justifyContent: 'center', alignItems: 'center' },
  canalNombre:     { color: '#fff', fontWeight: '600', fontSize: 15 },
  canalDesc:       { color: '#64748b', fontSize: 12, marginTop: 2 },
  msgRow:          { marginBottom: 8, alignItems: 'flex-start' },
  msgRowMe:        { alignItems: 'flex-end' },
  msgBubble:       { maxWidth: '80%', backgroundColor: '#1e293b', borderRadius: 16, borderBottomLeftRadius: 4, padding: 10, borderWidth: 1, borderColor: '#334155' },
  msgBubbleMe:     { backgroundColor: '#0047b3', borderBottomRightRadius: 4, borderBottomLeftRadius: 16, borderColor: '#0047b3' },
  msgAutor:        { color: '#60a5fa', fontSize: 11, fontWeight: '600', marginBottom: 3 },
  msgTexto:        { color: '#e2e8f0', fontSize: 14, lineHeight: 20 },
  msgHora:         { color: 'rgba(255,255,255,0.4)', fontSize: 10, marginTop: 3, textAlign: 'right' },
  inputRow:        { flexDirection: 'row', padding: 10, backgroundColor: '#1e293b', borderTopWidth: 1, borderTopColor: '#334155', gap: 8, alignItems: 'flex-end' },
  msgInput:        { flex: 1, backgroundColor: '#0f172a', color: '#fff', borderRadius: 22, borderWidth: 1, borderColor: '#334155', paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, maxHeight: 100 },
  sendBtn:         { width: 42, height: 42, borderRadius: 21, backgroundColor: '#0047b3', justifyContent: 'center', alignItems: 'center' },
  sendBtnDisabled: { opacity: 0.5 },
})
