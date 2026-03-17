import { useState, useEffect, useRef, useCallback } from 'react'
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
  Modal, ScrollView, Animated, Dimensions, Linking,
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import * as DocumentPicker from 'expo-document-picker'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { useChatNotifications } from '../context/ChatNotificationsContext'
import {
  getChatCanales, createChatCanal, updateChatCanal, deleteChatCanal,
  getChatMensajes, sendChatMensaje, deleteChatMensaje, editChatMensaje,
  pinChatMensaje, getOperarios, getTickets, getChatArchivoUrl,
} from '../services/api'

const SIDEBAR_W = Dimensions.get('window').width * 0.78

const DM_INVITE_PREFIX   = '__DM_INVITE__:'
const DM_ACCEPTED_PREFIX = '__DM_ACCEPTED__:'
const DM_REJECTED_PREFIX = '__DM_REJECTED__:'

const AVATAR_COLORS = ['#0066ff', '#16a34a', '#d97706', '#dc2626', '#9333ea', '#0891b2', '#be185d', '#065f46']
function getAvatarColor(str) {
  if (!str) return AVATAR_COLORS[0]
  let hash = 0
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}
function getInitials(nombre) {
  if (!nombre) return '?'
  return nombre.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
}
function formatHora(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
}
function formatFecha(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const now = new Date()
  const diff = Math.floor((now - d) / 86400000)
  if (diff === 0) return 'Hoy'
  if (diff === 1) return 'Ayer'
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })
}
function getDmNombre(canal, userId) {
  if (!canal?.chat_canales_miembros) return 'Chat directo'
  const otros = canal.chat_canales_miembros.filter(m => m.user_id !== userId)
  if (otros.length === 0) return 'Tú mismo'
  return otros.map(m => m.profiles?.nombre || m.profiles?.email || 'Desconocido').join(', ')
}

// ─── HTML / Markdown renderer ────────────────────────────────────────────────

// Decode HTML entities
function decodeEntities(str) {
  return String(str || '')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
}

// Convert HTML from web editor to a flat list of segments with styles + mention flag
function parseHtmlToSegments(raw) {
  if (!raw) return [{ text: '', bold: false, italic: false, strike: false, code: false, mention: false }]

  // Decode entities first
  const html = decodeEntities(raw)

  // Replace block-level tags with newlines
  const normalized = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')

  const segments = []

  // Tokenise: handle <b>, <strong>, <i>, <em>, <s>, <del>, <code>, <span class="mention-tag" ...>, plain text
  const tagPattern = /<(\/?)(\w+)([^>]*)>|([^<]+)/g
  let match
  const stack = { bold: false, italic: false, strike: false, code: false }

  while ((match = tagPattern.exec(normalized)) !== null) {
    const [full, closing, tag, attrs, textNode] = match

    if (textNode !== undefined) {
      // Plain text node
      const t = textNode.replace(/\n{3,}/g, '\n\n')
      if (t) segments.push({ text: t, ...stack, mention: false })
      continue
    }

    const tagLower = tag.toLowerCase()
    const isClosing = closing === '/'

    if (tagLower === 'b' || tagLower === 'strong') {
      stack.bold = !isClosing
    } else if (tagLower === 'i' || tagLower === 'em') {
      stack.italic = !isClosing
    } else if (tagLower === 's' || tagLower === 'del' || tagLower === 'strike') {
      stack.strike = !isClosing
    } else if (tagLower === 'code') {
      stack.code = !isClosing
    } else if (tagLower === 'span' && !isClosing && attrs.includes('mention-tag')) {
      // Extract the text content of the mention span from the next text node
      const spanContentMatch = tagPattern.exec(normalized)
      if (spanContentMatch && spanContentMatch[4]) {
        segments.push({ text: spanContentMatch[4], ...stack, mention: true, bold: true })
      }
      // consume closing </span>
      tagPattern.exec(normalized)
    }
  }

  // Fallback: if no segments produced (e.g. no HTML tags), treat as plain markdown
  if (segments.length === 0 || (segments.length === 1 && segments[0].text === '')) {
    const plain = normalized.replace(/<[^>]+>/g, '')
    return parseMarkdown(plain)
  }

  return segments
}

function parseMarkdown(text) {
  if (!text) return [{ text: '', bold: false, italic: false, strike: false, code: false }]
  const result = []
  const pattern = /\*\*([\s\S]+?)\*\*|__([\s\S]+?)__|~~([\s\S]+?)~~|_([\s\S]+?)_|`([\s\S]+?)`/g
  let lastIdx = 0
  let match
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIdx) {
      result.push({ text: text.slice(lastIdx, match.index), bold: false, italic: false, strike: false, code: false })
    }
    if (match[1] !== undefined)      result.push({ text: match[1], bold: true,  italic: false, strike: false, code: false })
    else if (match[2] !== undefined) result.push({ text: match[2], bold: false, italic: false, strike: false, code: false, underline: true })
    else if (match[3] !== undefined) result.push({ text: match[3], bold: false, italic: false, strike: true,  code: false })
    else if (match[4] !== undefined) result.push({ text: match[4], bold: false, italic: true,  strike: false, code: false })
    else if (match[5] !== undefined) result.push({ text: match[5], bold: false, italic: false, strike: false, code: true  })
    lastIdx = match.index + match[0].length
  }
  if (lastIdx < text.length) {
    result.push({ text: text.slice(lastIdx), bold: false, italic: false, strike: false, code: false })
  }
  return result.length > 0 ? result : [{ text, bold: false, italic: false, strike: false, code: false }]
}

function RichText({ text, color, fontSize = 14, lineHeight = 20, isOwn = false }) {
  // Detect if the content has HTML tags (from the web editor)
  const isHtml = typeof text === 'string' && /<[a-z][\s\S]*>/i.test(decodeEntities(text))
  const segments = isHtml ? parseHtmlToSegments(text) : parseMarkdown(text)

  return (
    <Text style={{ fontSize, color, lineHeight }}>
      {segments.map((seg, i) => {
        const s = []
        if (seg.bold)      s.push({ fontWeight: '700' })
        if (seg.italic)    s.push({ fontStyle: 'italic' })
        if (seg.strike)    s.push({ textDecorationLine: 'line-through' })
        if (seg.underline) s.push({ textDecorationLine: 'underline' })
        if (seg.code)      s.push({ fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', fontSize: 12, backgroundColor: isOwn ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.08)', borderRadius: 3, paddingHorizontal: 3 })
        if (seg.mention)   s.push({ color: isOwn ? '#fff' : '#0066ff', fontWeight: '700' })
        return <Text key={i} style={s.length ? s : undefined}>{seg.text}</Text>
      })}
    </Text>
  )
}

// ─── NuevoCanalModal ────────────────────────────────────────────────────────
function NuevoCanalModal({ visible, operarios, userId, onClose, onSave, colors }) {
  const [nombre, setNombre] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [miembros, setMiembros] = useState([])

  useEffect(() => {
    if (visible) { setNombre(''); setDescripcion(''); setMiembros([]) }
  }, [visible])

  function toggleMiembro(id) {
    setMiembros(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  function handleSave() {
    if (!nombre.trim()) { Alert.alert('Error', 'El nombre del canal es obligatorio'); return }
    onSave({ nombre: nombre.trim(), descripcion, miembros, tipo: 'canal' })
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay }}>
        <View style={{ backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '85%', paddingBottom: 24 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text }}>Nuevo canal</Text>
            <TouchableOpacity onPress={onClose}><Ionicons name="close" size={22} color={colors.textMuted} /></TouchableOpacity>
          </View>
          <ScrollView style={{ padding: 20 }} keyboardShouldPersistTaps="handled">
            <View style={{ marginBottom: 14 }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textMuted, marginBottom: 6, textTransform: 'uppercase' }}>Nombre del canal *</Text>
              <TextInput
                style={{ backgroundColor: colors.inputBg, borderWidth: 1.5, borderColor: colors.inputBorder, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: colors.text }}
                value={nombre}
                onChangeText={setNombre}
                placeholder="ej: general, marketing, soporte..."
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
              />
            </View>
            <View style={{ marginBottom: 14 }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textMuted, marginBottom: 6, textTransform: 'uppercase' }}>Descripción</Text>
              <TextInput
                style={{ backgroundColor: colors.inputBg, borderWidth: 1.5, borderColor: colors.inputBorder, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: colors.text, height: 70, textAlignVertical: 'top', paddingTop: 10 }}
                value={descripcion}
                onChangeText={setDescripcion}
                placeholder="Descripción del canal..."
                placeholderTextColor={colors.textMuted}
                multiline
              />
            </View>
            <View>
              <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textMuted, marginBottom: 8, textTransform: 'uppercase' }}>Miembros</Text>
              {operarios.filter(op => op.id !== userId).map(op => {
                const sel = miembros.includes(op.id)
                return (
                  <TouchableOpacity
                    key={op.id}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border }}
                    onPress={() => toggleMiembro(op.id)}
                  >
                    <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: getAvatarColor(op.id), alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>{getInitials(op.nombre)}</Text>
                    </View>
                    <Text style={{ flex: 1, fontSize: 14, fontWeight: '600', color: colors.text }}>{op.nombre || op.email}</Text>
                    <Ionicons name={sel ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={sel ? colors.primary : colors.border} />
                  </TouchableOpacity>
                )
              })}
            </View>
          </ScrollView>
          <View style={{ flexDirection: 'row', gap: 12, paddingHorizontal: 20, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border }}>
            <TouchableOpacity style={{ flex: 1, paddingVertical: 13, alignItems: 'center', borderRadius: 8, borderWidth: 1.5, borderColor: colors.border }} onPress={onClose}>
              <Text style={{ fontSize: 15, fontWeight: '600', color: colors.textMuted }}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={{ flex: 2, paddingVertical: 13, alignItems: 'center', borderRadius: 8, backgroundColor: colors.primary }} onPress={handleSave}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: '#ffffff' }}>Crear canal</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  )
}

// ─── EditCanalModal ──────────────────────────────────────────────────────────
function EditCanalModal({ visible, canal, onClose, onSave, colors }) {
  const [nombre, setNombre] = useState('')
  const [descripcion, setDescripcion] = useState('')

  useEffect(() => {
    if (visible && canal) {
      setNombre(canal.nombre || '')
      setDescripcion(canal.descripcion || '')
    }
  }, [visible, canal])

  function handleSave() {
    if (!nombre.trim()) { Alert.alert('Error', 'El nombre es obligatorio'); return }
    onSave({ nombre: nombre.trim(), descripcion })
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay }}>
        <View style={{ backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 24 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text }}>Editar canal</Text>
            <TouchableOpacity onPress={onClose}><Ionicons name="close" size={22} color={colors.textMuted} /></TouchableOpacity>
          </View>
          <View style={{ padding: 20, gap: 14 }}>
            <View>
              <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textMuted, marginBottom: 6, textTransform: 'uppercase' }}>Nombre *</Text>
              <TextInput
                style={{ backgroundColor: colors.inputBg, borderWidth: 1.5, borderColor: colors.inputBorder, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: colors.text }}
                value={nombre}
                onChangeText={setNombre}
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
              />
            </View>
            <View>
              <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textMuted, marginBottom: 6, textTransform: 'uppercase' }}>Descripción</Text>
              <TextInput
                style={{ backgroundColor: colors.inputBg, borderWidth: 1.5, borderColor: colors.inputBorder, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: colors.text, height: 70, textAlignVertical: 'top', paddingTop: 10 }}
                value={descripcion}
                onChangeText={setDescripcion}
                placeholderTextColor={colors.textMuted}
                multiline
              />
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 12, paddingHorizontal: 20, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12 }}>
            <TouchableOpacity style={{ flex: 1, paddingVertical: 13, alignItems: 'center', borderRadius: 8, borderWidth: 1.5, borderColor: colors.border }} onPress={onClose}>
              <Text style={{ fontSize: 15, fontWeight: '600', color: colors.textMuted }}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={{ flex: 2, paddingVertical: 13, alignItems: 'center', borderRadius: 8, backgroundColor: colors.primary }} onPress={handleSave}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: '#ffffff' }}>Guardar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  )
}

// ─── NuevoDirectoModal ───────────────────────────────────────────────────────
function NuevoDirectoModal({ visible, operarios, userId, onClose, onSelect, colors }) {
  const [busqueda, setBusqueda] = useState('')

  useEffect(() => {
    if (visible) setBusqueda('')
  }, [visible])

  const filtrados = operarios.filter(op => {
    if (op.id === userId) return false
    const q = busqueda.toLowerCase()
    return !q || (op.nombre || op.email || '').toLowerCase().includes(q)
  })

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' }}>
        <View style={{ backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '70%', paddingBottom: 24 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 18, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text }}>Nuevo mensaje directo</Text>
            <TouchableOpacity onPress={onClose}><Ionicons name="close" size={22} color={colors.textMuted} /></TouchableOpacity>
          </View>
          <View style={{ paddingHorizontal: 16, paddingVertical: 10 }}>
            <TextInput
              style={{ backgroundColor: colors.inputBg, borderWidth: 1.5, borderColor: colors.inputBorder, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, fontSize: 14, color: colors.text }}
              placeholder="Buscar persona..."
              placeholderTextColor={colors.textMuted}
              value={busqueda}
              onChangeText={setBusqueda}
            />
          </View>
          <ScrollView keyboardShouldPersistTaps="handled">
            {filtrados.map(op => (
              <TouchableOpacity
                key={op.id}
                onPress={() => onSelect(op.id)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border + '44' }}
              >
                <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: getAvatarColor(op.id), alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>{getInitials(op.nombre)}</Text>
                </View>
                <Text style={{ flex: 1, fontSize: 15, color: colors.text, fontWeight: '500' }}>{op.nombre || op.email}</Text>
                <Ionicons name="chatbubble-outline" size={18} color={colors.primary} />
              </TouchableOpacity>
            ))}
            {filtrados.length === 0 && (
              <Text style={{ textAlign: 'center', color: colors.textMuted, padding: 24, fontSize: 14 }}>Sin resultados</Text>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  )
}

// ─── OrdenarCanalesModal ─────────────────────────────────────────────────────
function OrdenarCanalesModal({ visible, canales, canalOrder, onMove, onClose, colors }) {
  const ordered = canalOrder.length > 0
    ? [...canales].sort((a, b) => {
        const ai = canalOrder.indexOf(a.id), bi = canalOrder.indexOf(b.id)
        if (ai === -1 && bi === -1) return 0
        if (ai === -1) return 1; if (bi === -1) return -1
        return ai - bi
      })
    : canales
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' }}>
        <View style={{ backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '70%' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 18, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text }}>Ordenar canales</Text>
            <TouchableOpacity onPress={onClose}><Ionicons name="close" size={22} color={colors.textMuted} /></TouchableOpacity>
          </View>
          <ScrollView>
            {ordered.map((canal, idx) => (
              <View key={canal.id} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border + '44' }}>
                <Text style={{ fontSize: 16, color: colors.textMuted, fontWeight: '700', width: 20 }}>#</Text>
                <Text style={{ flex: 1, fontSize: 15, color: colors.text, fontWeight: '500', marginLeft: 8 }}>{canal.nombre}</Text>
                <TouchableOpacity
                  onPress={() => onMove(canal.id, 'up')}
                  disabled={idx === 0}
                  style={{ padding: 8, opacity: idx === 0 ? 0.3 : 1 }}
                >
                  <Ionicons name="arrow-up" size={20} color={colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => onMove(canal.id, 'down')}
                  disabled={idx === ordered.length - 1}
                  style={{ padding: 8, opacity: idx === ordered.length - 1 ? 0.3 : 1 }}
                >
                  <Ionicons name="arrow-down" size={20} color={colors.primary} />
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
          <TouchableOpacity onPress={onClose} style={{ margin: 16, paddingVertical: 13, alignItems: 'center', borderRadius: 10, backgroundColor: colors.primary }}>
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Listo</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )
}

// ─── TicketPickerModal ───────────────────────────────────────────────────────
function TicketPickerModal({ visible, tickets, onClose, onSelect, colors }) {
  const [busqueda, setBusqueda] = useState('')

  useEffect(() => {
    if (visible) setBusqueda('')
  }, [visible])

  const filtrados = tickets.filter(t => {
    const q = busqueda.toLowerCase()
    return !q || String(t.numero).includes(q) || (t.asunto || '').toLowerCase().includes(q)
  }).slice(0, 25)

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' }}>
        <View style={{ backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '70%', paddingBottom: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 18, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text }}>Referenciar ticket</Text>
            <TouchableOpacity onPress={onClose}><Ionicons name="close" size={22} color={colors.textMuted} /></TouchableOpacity>
          </View>
          <View style={{ paddingHorizontal: 16, paddingVertical: 10 }}>
            <TextInput
              style={{ backgroundColor: colors.inputBg, borderWidth: 1.5, borderColor: colors.inputBorder, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, fontSize: 14, color: colors.text }}
              placeholder="#número o asunto..."
              placeholderTextColor={colors.textMuted}
              value={busqueda}
              onChangeText={setBusqueda}
            />
          </View>
          <ScrollView keyboardShouldPersistTaps="handled">
            {filtrados.map(t => (
              <TouchableOpacity
                key={t.id}
                onPress={() => onSelect(t)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border + '44' }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, color: colors.text, fontWeight: '600' }}>#{t.numero} — {t.asunto}</Text>
                  <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>{t.estado}</Text>
                </View>
                <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, backgroundColor: colors.primary + '22' }}>
                  <Text style={{ fontSize: 11, color: colors.primary, fontWeight: '700' }}>{t.estado}</Text>
                </View>
              </TouchableOpacity>
            ))}
            {filtrados.length === 0 && (
              <Text style={{ textAlign: 'center', color: colors.textMuted, padding: 24, fontSize: 14 }}>Sin resultados</Text>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  )
}

// ─── ChatScreen ──────────────────────────────────────────────────────────────
export default function ChatScreen() {
  const { user, isAdmin, logout } = useAuth()
  const { colors, isDark, toggleTheme } = useTheme()
  const { dmUnread, channelUnread, channelMentionCnt, markRead, unmarkOpen } = useChatNotifications()
  const insets = useSafeAreaInsets()
  const navigation = useNavigation()

  const [canales, setCanales]       = useState([])
  const [mensajes, setMensajes]     = useState([])
  const [operarios, setOperarios]   = useState([])
  const [canalActivo, setCanalActivo] = useState(null)
  const [texto, setTexto]           = useState('')
  const [loading, setLoading]       = useState(true)
  const [loadingMsgs, setLoadingMsgs] = useState(false)
  const [sending, setSending]       = useState(false)
  const [showNuevoCanalModal, setShowNuevoCanalModal] = useState(false)
  const [showEditCanalModal, setShowEditCanalModal] = useState(false)
  const [editingCanal, setEditingCanal] = useState(null)
  const [editingMsgId, setEditingMsgId] = useState(null)
  const [editingText, setEditingText]   = useState('')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [prefs, setPrefs]           = useState({})
  const [showHidden, setShowHidden] = useState(false)
  const [canalOrder, setCanalOrder] = useState([])
  const [canalMenu, setCanalMenu]   = useState(null)
  const [showOrdenarModal, setShowOrdenarModal] = useState(false)

  // DM invite state
  const [pendingInvites, setPendingInvites] = useState({})
  const [sentInvites, setSentInvites]       = useState({})
  const [showDirectoModal, setShowDirectoModal] = useState(false)
  const sentInvitesRef = useRef({})

  // File attachments
  const [pendingFiles, setPendingFiles] = useState([])

  // Ticket references
  const [ticketRef, setTicketRef]         = useState(null)

  // Text formatting
  const [msgSelection, setMsgSelection] = useState({ start: 0, end: 0 })
  const inputRef = useRef(null)
  const [allTickets, setAllTickets]       = useState([])
  const [showTicketPicker, setShowTicketPicker] = useState(false)

  // @mention picker
  const [mentionQuery, setMentionQuery]       = useState(null) // { start, query } | null
  const [pendingMentions, setPendingMentions] = useState([])   // [{ name, id }]

  const flatRef    = useRef(null)
  const pollingRef = useRef(null)
  const sidebarAnim = useRef(new Animated.Value(-SIDEBAR_W)).current

  const userId = user?.id

  function updatePref(canalId, changes) {
    setPrefs(prev => ({
      ...prev,
      [canalId]: { ...(prev[canalId] || {}), ...changes },
    }))
  }

  function openDrawer() {
    setDrawerOpen(true)
    Animated.timing(sidebarAnim, {
      toValue: 0,
      duration: 260,
      useNativeDriver: true,
    }).start()
  }

  function closeDrawer() {
    Animated.timing(sidebarAnim, {
      toValue: -SIDEBAR_W,
      duration: 220,
      useNativeDriver: true,
    }).start(() => setDrawerOpen(false))
  }

  const loadCanales = useCallback(async () => {
    try {
      const data = await getChatCanales()
      const list = Array.isArray(data) ? data : (data?.canales || [])
      setCanales(list)
    } catch (e) {}
  }, [])

  const loadMensajes = useCallback(async (cid) => {
    if (!cid) return
    setLoadingMsgs(true)
    try {
      const data = await getChatMensajes(cid, 100)
      const msgs = Array.isArray(data) ? data : (data?.mensajes || [])
      setMensajes(msgs)
      setTimeout(() => flatRef.current?.scrollToEnd({ animated: false }), 100)
    } catch (e) {}
    finally { setLoadingMsgs(false) }
  }, [])

  // Initial load
  useEffect(() => {
    Promise.all([
      getChatCanales(),
      getOperarios(),
      getTickets().catch(() => []),
    ]).then(([c, o, t]) => {
      const list = Array.isArray(c) ? c : (c?.canales || [])
      setCanales(list)
      setCanalOrder(prev => prev.length === 0 ? list.map(x => x.id) : prev)
      setOperarios(Array.isArray(o) ? o : [])
      const ticketList = Array.isArray(t) ? t : (t?.tickets || t?.data || [])
      setAllTickets(ticketList)
      if (list.length > 0) setCanalActivo(list[0])
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  // Message polling
  useEffect(() => {
    if (canalActivo) {
      loadMensajes(canalActivo.id)
      markRead(canalActivo.id)
    }
    if (pollingRef.current) clearInterval(pollingRef.current)
    pollingRef.current = setInterval(() => {
      if (canalActivo) loadMensajes(canalActivo.id)
    }, 5000)
    return () => { if (pollingRef.current) clearInterval(pollingRef.current) }
  }, [canalActivo])

  // DM invite polling
  useEffect(() => {
    if (!userId || canales.length === 0) return
    async function checkInvites() {
      const dms = canales.filter(c => c.tipo === 'directo')
      const newPending = {}
      const newSent = {}
      for (const canal of dms) {
        try {
          const msgs = await getChatMensajes(canal.id, 30)
          if (!msgs?.length) continue
          for (let i = msgs.length - 1; i >= 0; i--) {
            const m = msgs[i]
            if (m.contenido?.startsWith(DM_INVITE_PREFIX)) {
              const hasResponse = msgs.slice(i + 1).some(
                r => r.contenido?.startsWith(DM_ACCEPTED_PREFIX) || r.contenido?.startsWith(DM_REJECTED_PREFIX)
              )
              if (!hasResponse) {
                const payload = m.contenido.replace(DM_INVITE_PREFIX, '')
                try {
                  const parsed = JSON.parse(payload)
                  if (m.user_id !== userId) {
                    newPending[canal.id] = { nombreRemitente: parsed.remitente, remitenteId: m.user_id, canalId: canal.id }
                  } else {
                    newSent[canal.id] = { nombreDestinatario: parsed.destinatario }
                  }
                } catch {}
              }
              break
            }
            if (m.contenido?.startsWith(DM_ACCEPTED_PREFIX) || m.contenido?.startsWith(DM_REJECTED_PREFIX)) break
          }
        } catch {}
      }
      setPendingInvites(newPending)
      setSentInvites(newSent)
    }
    checkInvites()
    const t = setInterval(checkInvites, 6000)
    return () => clearInterval(t)
  }, [userId, canales])

  // ── DM functions ────────────────────────────────────────────────────────────
  async function crearDirecto(opId) {
    const operario = operarios.find(o => o.id === opId)
    if (isAdmin()) {
      await createChatCanal({ nombre: `directo-${opId}`, descripcion: null, tipo: 'directo', miembros: [opId] })
      setShowDirectoModal(false)
      await loadCanales()
    } else {
      const canal = await createChatCanal({ nombre: `directo-${opId}`, descripcion: null, tipo: 'directo', miembros: [opId] })
      const nombreRemitente = user?.nombre || user?.email || 'Alguien'
      const nombreDestinatario = operario?.nombre || operario?.email || 'Alguien'
      const payload = JSON.stringify({ remitente: nombreRemitente, destinatario: nombreDestinatario })
      await sendChatMensaje(canal.id || canal, `${DM_INVITE_PREFIX}${payload}`, null, [])
      setShowDirectoModal(false)
      await loadCanales()
    }
  }

  async function aceptarInvitacion(canalId, nombreRemitente) {
    const nombrePropio = user?.nombre || user?.email || 'Alguien'
    await sendChatMensaje(canalId, `${DM_ACCEPTED_PREFIX}${nombrePropio} aceptó el chat`, null, [])
    setPendingInvites(prev => { const n = { ...prev }; delete n[canalId]; return n })
    const canal = canales.find(c => c.id === canalId)
    if (canal) { setCanalActivo(canal); closeDrawer() }
  }

  async function rechazarInvitacion(canalId) {
    await deleteChatCanal(canalId)
    setPendingInvites(prev => { const n = { ...prev }; delete n[canalId]; return n })
    setCanales(prev => prev.filter(c => c.id !== canalId))
    if (canalActivo?.id === canalId) setCanalActivo(null)
  }

  // ── File pick ───────────────────────────────────────────────────────────────
  async function pickFile() {
    try {
      const result = await DocumentPicker.getDocumentAsync({ multiple: true, copyToCacheDirectory: true })
      if (result.canceled) return
      const files = result.assets || (result.uri ? [result] : [])
      setPendingFiles(prev => [...prev, ...files.map(f => ({ uri: f.uri, name: f.name, mimeType: f.mimeType || 'application/octet-stream', size: f.size }))])
    } catch (e) {}
  }

  // ── Format text ─────────────────────────────────────────────────────────────
  function applyFormat(prefix, suffix) {
    const { start, end } = msgSelection
    if (start === end) {
      inputRef.current?.focus()
      return
    }
    const selected = texto.slice(start, end)
    const newText = texto.slice(0, start) + prefix + selected + suffix + texto.slice(end)
    setTexto(newText)
    inputRef.current?.focus()
  }

  // ── @mention input handling ──────────────────────────────────────────────────
  function handleTextChange(val) {
    setTexto(val)
    // Detect @query: find last @ with no space after it
    const lastAt = val.lastIndexOf('@')
    if (lastAt >= 0) {
      const after = val.substring(lastAt + 1)
      if (!after.includes(' ') && after.length <= 30) {
        setMentionQuery({ start: lastAt, query: after.toLowerCase() })
        return
      }
    }
    setMentionQuery(null)
  }

  function insertMention(op) {
    if (!mentionQuery) return
    const { start, query } = mentionQuery
    const before = texto.substring(0, start)
    const after = texto.substring(start + 1 + query.length)
    setTexto(before + `@${op.nombre} ` + after)
    setPendingMentions(prev => [...prev, { name: op.nombre, id: op.id }])
    setMentionQuery(null)
    inputRef.current?.focus()
  }

  function buildHtmlContent(plainText) {
    let html = plainText
    // Replace each pending mention @nombre with HTML span
    for (const m of pendingMentions) {
      html = html.replace(
        `@${m.name}`,
        `<span class="mention-tag" data-id="${m.id}" contenteditable="false">@${m.name}</span>`
      )
    }
    return html
  }

  // ── Send message ────────────────────────────────────────────────────────────
  async function sendMsg() {
    if (!texto.trim() && pendingFiles.length === 0 && !ticketRef) return
    if (!canalActivo) return
    setSending(true)
    const htmlContent = buildHtmlContent(texto)
    const t = htmlContent; const files = pendingFiles; const tRef = ticketRef
    setTexto(''); setPendingFiles([]); setTicketRef(null); setPendingMentions([]); setMentionQuery(null)
    try {
      const msg = await sendChatMensaje(canalActivo.id, t, tRef?.id || null, files)
      if (tRef) msg.ticket_ref = tRef
      // Ensure file names are preserved in locally appended message
      if (files.length > 0 && Array.isArray(msg.chat_mensajes_archivos)) {
        msg.chat_mensajes_archivos = msg.chat_mensajes_archivos.map((arch, i) => ({
          ...arch,
          nombre_original: arch.nombre_original || arch.nombre || files[i]?.name || 'Archivo',
          mime_type: arch.mime_type || files[i]?.mimeType || 'application/octet-stream',
        }))
      }
      setMensajes(prev => [...prev, msg])
      setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100)
    } catch (e) { Alert.alert('Error', e.message); setTexto(t); setPendingFiles(files); setTicketRef(tRef) }
    finally { setSending(false) }
  }

  async function deleteMsg(id) {
    Alert.alert('Eliminar mensaje', '¿Eliminar este mensaje?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: async () => {
        try {
          await deleteChatMensaje(id)
          setMensajes(prev => prev.filter(m => m.id !== id))
        } catch (e) { Alert.alert('Error', e.message) }
      }},
    ])
  }

  async function saveEdit(id) {
    if (!editingText.trim()) return
    try {
      await editChatMensaje(id, editingText)
      setMensajes(prev => prev.map(m => m.id === id ? { ...m, contenido: editingText, editado: true } : m))
      setEditingMsgId(null)
      setEditingText('')
    } catch (e) { Alert.alert('Error', e.message) }
  }

  async function togglePinMsg(msg) {
    try {
      await pinChatMensaje(msg.id, !msg.anclado)
      setMensajes(prev => prev.map(m => m.id === msg.id ? { ...m, anclado: !msg.anclado } : m))
    } catch (e) { Alert.alert('Error', e.message) }
  }

  async function handleCrearCanal(form) {
    try {
      await createChatCanal(form)
      setShowNuevoCanalModal(false)
      await loadCanales()
    } catch (e) { Alert.alert('Error', e.message) }
  }

  async function handleEditarCanal(form) {
    if (!editingCanal) return
    try {
      await updateChatCanal(editingCanal.id, form)
      setShowEditCanalModal(false)
      setEditingCanal(null)
      await loadCanales()
    } catch (e) { Alert.alert('Error', e.message) }
  }

  async function deleteCanal(canal) {
    Alert.alert('Eliminar canal', `¿Eliminar #${canal.nombre}?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: async () => {
        try {
          await deleteChatCanal(canal.id)
          if (canalActivo?.id === canal.id) setCanalActivo(null)
          await loadCanales()
        } catch (e) { Alert.alert('Error', e.message) }
      }},
    ])
  }

  function selectCanal(canal) {
    setCanalActivo(canal)
    markRead(canal.id)
    closeDrawer()
  }

  function onLongPressCanal(canal) {
    setCanalMenu(canal)
  }

  function moveCanal(canalId, direction) {
    setCanalOrder(prev => {
      const idx = prev.indexOf(canalId)
      if (idx < 0) return prev
      const next = [...prev]
      const swapIdx = direction === 'up' ? idx - 1 : idx + 1
      if (swapIdx < 0 || swapIdx >= next.length) return prev
      ;[next[idx], next[swapIdx]] = [next[swapIdx], next[idx]]
      return next
    })
  }

  const canalesOrdenados = canalOrder.length > 0
    ? [...canales].sort((a, b) => {
        const ai = canalOrder.indexOf(a.id)
        const bi = canalOrder.indexOf(b.id)
        if (ai === -1 && bi === -1) return 0
        if (ai === -1) return 1
        if (bi === -1) return -1
        return ai - bi
      })
    : canales

  const canalesRegulares = canalesOrdenados.filter(c => c.tipo === 'canal')
  const canalesDirectos  = canalesOrdenados.filter(c => c.tipo === 'directo')

  const pinnedCanales  = canalesRegulares.filter(c => (prefs[c.id] || {}).pinned && !(prefs[c.id] || {}).hidden)
  const hiddenCanales  = canalesRegulares.filter(c => (prefs[c.id] || {}).hidden)
  const regularVisible = canalesRegulares.filter(c => !(prefs[c.id] || {}).pinned && !(prefs[c.id] || {}).hidden)
  const hiddenCount    = hiddenCanales.length

  if (loading) {
    return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg }}><ActivityIndicator size="large" color={colors.primary} /></View>
  }

  const canalName = canalActivo
    ? (canalActivo.tipo === 'directo' ? getDmNombre(canalActivo, userId) : canalActivo.nombre)
    : null

  const sidebarBg = isDark ? '#1a2236' : '#f0f4ff'

  function renderCanalItem(canal, isActive) {
    const pref = prefs[canal.id] || {}
    const name = canal.tipo === 'directo' ? getDmNombre(canal, userId) : canal.nombre
    const badgeCount = canal.tipo === 'directo'
      ? (dmUnread[canal.id] || 0)
      : (channelMentionCnt[canal.id] || 0)
    const hasActivity = !!(channelUnread[canal.id])
    const hasMentionBadge = badgeCount > 0
    const showActivity = canal.tipo === 'canal' && hasActivity && !hasMentionBadge && !isActive
    return (
      <TouchableOpacity
        key={canal.id}
        onPress={() => selectCanal(canal)}
        onLongPress={() => onLongPressCanal(canal)}
        style={{
          flexDirection: 'row', alignItems: 'center', gap: 8,
          paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8,
          marginBottom: 2,
          backgroundColor: isActive ? colors.primary + '22' : 'transparent',
        }}
      >
        {canal.tipo === 'directo' ? (
          <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: getAvatarColor(canal.id), alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>{getInitials(name)}</Text>
          </View>
        ) : (
          <Text style={{ fontSize: 16, color: isActive ? colors.primary : colors.textMuted, fontWeight: '700', width: 20, textAlign: 'center' }}>#</Text>
        )}
        <Text
          style={{ flex: 1, fontSize: 14, fontWeight: (isActive || hasMentionBadge || showActivity) ? '700' : '500', color: isActive ? colors.primary : colors.text }}
          numberOfLines={1}
        >
          {name}
        </Text>
        {pref.pinned && !hasMentionBadge && <Ionicons name="pin" size={13} color={colors.primary} />}
        {pref.muted  && !hasMentionBadge && <Ionicons name="notifications-off-outline" size={14} color={colors.textMuted} />}
        {showActivity && !pref.muted && (
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary }} />
        )}
        {hasMentionBadge && !isActive && !pref.muted && (
          <View style={{
            backgroundColor: '#e53935', borderRadius: 9,
            minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center',
            paddingHorizontal: 3,
          }}>
            <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>
              {badgeCount > 9 ? '9+' : badgeCount}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    )
  }

  return (
    <View style={{ flex: 1 }}>
      {/* Main chat area */}
      <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.bg }}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={0}
        >
          {/* Header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 12, backgroundColor: colors.headerBg, borderBottomWidth: 1, borderBottomColor: colors.border, gap: 10 }}>
            <TouchableOpacity onPress={openDrawer} style={{ padding: 4 }}>
              <Ionicons name="menu" size={24} color={colors.text} />
            </TouchableOpacity>

            {canalActivo ? (
              <>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }} numberOfLines={1}>
                    {canalActivo.tipo === 'canal' ? '# ' : ''}{canalName}
                  </Text>
                  {canalActivo.descripcion ? (
                    <Text style={{ fontSize: 11, color: colors.textMuted }} numberOfLines={1}>{canalActivo.descripcion}</Text>
                  ) : null}
                </View>
              </>
            ) : (
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>Chat del equipo</Text>
                <Text style={{ fontSize: 11, color: colors.textMuted }}>{canales.length} canales</Text>
              </View>
            )}

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: getAvatarColor(userId), alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>{getInitials(user?.nombre || user?.email)}</Text>
              </View>
              <Text style={{ fontSize: 12, color: colors.textMuted, maxWidth: 100 }} numberOfLines={1}>
                {user?.nombre || user?.email || ''}
              </Text>
              <TouchableOpacity onPress={toggleTheme} style={{ padding: 4 }}>
                <Ionicons name={isDark ? 'sunny-outline' : 'moon-outline'} size={18} color={colors.textMuted} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => Alert.alert('Cerrar sesión', '¿Cerrar sesión?', [
                  { text: 'Cancelar', style: 'cancel' },
                  { text: 'Salir', style: 'destructive', onPress: logout },
                ])}
                style={{ padding: 4 }}
              >
                <Ionicons name="log-out-outline" size={18} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Messages area */}
          {canalActivo ? (
            <View style={{ flex: 1 }}>
              {/* Pinned messages banner */}
              {mensajes.some(m => m.anclado) && (() => {
                const anclados = mensajes.filter(m => m.anclado)
                return (
                  <View style={{ backgroundColor: colors.primary + '15', borderBottomWidth: 1, borderBottomColor: colors.primary + '40', paddingHorizontal: 12, paddingVertical: 8 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <Ionicons name="pin" size={12} color={colors.primary} />
                      <Text style={{ fontSize: 11, fontWeight: '700', color: colors.primary, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        {anclados.length} mensaje{anclados.length !== 1 ? 's' : ''} anclado{anclados.length !== 1 ? 's' : ''}
                      </Text>
                    </View>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ gap: 6 }}>
                      <View style={{ flexDirection: 'row', gap: 6 }}>
                        {anclados.map(m => (
                          <TouchableOpacity
                            key={m.id}
                            onPress={() => {
                              const idx = mensajes.findIndex(x => x.id === m.id)
                              if (idx >= 0) flatRef.current?.scrollToIndex({ index: idx, animated: true, viewPosition: 0.5 })
                            }}
                            style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14, backgroundColor: colors.primary + '22', borderWidth: 1, borderColor: colors.primary + '55', maxWidth: 200 }}
                          >
                            <Ionicons name="pin" size={11} color={colors.primary} />
                            <Text style={{ fontSize: 12, color: colors.primary, fontWeight: '600' }} numberOfLines={1}>
                              {m.contenido?.replace(/\n/g, ' ') || 'Archivo'}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </ScrollView>
                  </View>
                )
              })()}
              {loadingMsgs && mensajes.length === 0 ? (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                  <ActivityIndicator color={colors.primary} />
                </View>
              ) : (
                <FlatList
                  style={{ flex: 1 }}
                  ref={flatRef}
                  data={mensajes}
                  keyExtractor={item => String(item.id)}
                  contentContainerStyle={{ padding: 16, gap: 4 }}
                  onContentSizeChange={() => flatRef.current?.scrollToEnd({ animated: false })}
                  ListEmptyComponent={
                    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 }}>
                      <Ionicons name="chatbubbles-outline" size={40} color={colors.textMuted} />
                      <Text style={{ color: colors.textMuted, marginTop: 10, fontSize: 14 }}>Comienza la conversación</Text>
                    </View>
                  }
                  renderItem={({ item, index }) => {
                    // Skip DM system messages
                    if (
                      item.contenido?.startsWith(DM_INVITE_PREFIX) ||
                      item.contenido?.startsWith(DM_ACCEPTED_PREFIX) ||
                      item.contenido?.startsWith(DM_REJECTED_PREFIX)
                    ) return null

                    const isOwn = item.user_id === userId
                    const prevMsg = mensajes[index - 1]
                    const showDate = !prevMsg || new Date(item.created_at).toDateString() !== new Date(prevMsg.created_at).toDateString()
                    const showAvatar = !prevMsg || prevMsg.user_id !== item.user_id

                    return (
                      <View>
                        {showDate && (
                          <View style={{ alignItems: 'center', marginVertical: 10 }}>
                            <View style={{ backgroundColor: colors.badgeGray, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 }}>
                              <Text style={{ fontSize: 11, color: colors.textMuted, fontWeight: '600' }}>{formatFecha(item.created_at)}</Text>
                            </View>
                          </View>
                        )}
                        <View style={{ flexDirection: isOwn ? 'row-reverse' : 'row', alignItems: 'flex-end', gap: 8, marginBottom: 4 }}>
                          {!isOwn ? (
                            <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: getAvatarColor(item.user_id), alignItems: 'center', justifyContent: 'center', opacity: showAvatar ? 1 : 0 }}>
                              <Text style={{ fontSize: 11, color: '#fff', fontWeight: '700' }}>{getInitials(item.profiles?.nombre)}</Text>
                            </View>
                          ) : null}

                          <View style={{ maxWidth: '72%' }}>
                            {showAvatar && !isOwn && (
                              <Text style={{ fontSize: 11, fontWeight: '700', color: getAvatarColor(item.user_id), marginBottom: 3, marginLeft: 4 }}>
                                {item.profiles?.nombre || 'Usuario'}
                              </Text>
                            )}

                            {editingMsgId === item.id ? (
                              <View style={{ gap: 6 }}>
                                <TextInput
                                  style={{ backgroundColor: colors.inputBg, borderWidth: 1.5, borderColor: colors.primary, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: colors.text, minWidth: 200 }}
                                  value={editingText}
                                  onChangeText={setEditingText}
                                  autoFocus
                                  multiline
                                />
                                <View style={{ flexDirection: 'row', gap: 8 }}>
                                  <TouchableOpacity onPress={() => { setEditingMsgId(null); setEditingText('') }}>
                                    <Text style={{ color: colors.textMuted, fontSize: 12 }}>Cancelar</Text>
                                  </TouchableOpacity>
                                  <TouchableOpacity onPress={() => saveEdit(item.id)}>
                                    <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '700' }}>Guardar</Text>
                                  </TouchableOpacity>
                                </View>
                              </View>
                            ) : (
                              <TouchableOpacity
                                onLongPress={() => {
                                  const canEdit = item.user_id === userId
                                  const canDelete = item.user_id === userId || isAdmin()
                                  if (!canEdit && !canDelete) return
                                  const opts = [
                                    { text: 'Cancelar', style: 'cancel' },
                                  ]
                                  if (canEdit) {
                                    opts.push({ text: 'Editar', onPress: () => { setEditingMsgId(item.id); setEditingText(item.contenido) } })
                                  }
                                  if (canDelete) {
                                    opts.push({ text: 'Eliminar', style: 'destructive', onPress: () => deleteMsg(item.id) })
                                  }
                                  opts.push({ text: item.anclado ? 'Desanclar' : 'Anclar', onPress: () => togglePinMsg(item) })
                                  Alert.alert('Opciones', item.contenido.substring(0, 50), opts)
                                }}
                                activeOpacity={0.9}
                              >
                                <View style={{
                                  padding: 10, borderRadius: 16,
                                  backgroundColor: isOwn ? colors.chatMine : colors.chatOther,
                                  borderWidth: isOwn ? 0 : 1, borderColor: colors.border,
                                  borderBottomRightRadius: isOwn ? 4 : 16,
                                  borderBottomLeftRadius: isOwn ? 16 : 4,
                                }}>
                                  {item.anclado && (
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4, opacity: 0.7 }}>
                                      <Ionicons name="pin" size={10} color={isOwn ? '#fff' : colors.textMuted} />
                                      <Text style={{ fontSize: 9, color: isOwn ? '#fff' : colors.textMuted }}>Anclado</Text>
                                    </View>
                                  )}
                                  <RichText
                                    text={item.contenido}
                                    color={isOwn ? colors.chatMineTxt : colors.chatOtherTxt}
                                    fontSize={14}
                                    lineHeight={20}
                                    isOwn={isOwn}
                                  />

                                  {/* Ticket reference card */}
                                  {(item.ticket_ref || item.tickets) && (() => {
                                    const tRef = item.ticket_ref || item.tickets
                                    return (
                                      <TouchableOpacity
                                        onPress={() => navigation.navigate('Tickets', { screen: 'TicketDetalle', params: { ticket: tRef } })}
                                        style={{ marginTop: 6, padding: 8, borderRadius: 8, backgroundColor: isOwn ? 'rgba(255,255,255,0.15)' : colors.bg, borderWidth: 1, borderColor: colors.border }}
                                        activeOpacity={0.7}
                                      >
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                                          <Ionicons name="ticket-outline" size={11} color={isOwn ? 'rgba(255,255,255,0.7)' : colors.primary} />
                                          <Text style={{ fontSize: 10, color: isOwn ? 'rgba(255,255,255,0.7)' : colors.primary, fontWeight: '700' }}>Ticket</Text>
                                        </View>
                                        <Text style={{ fontSize: 11, fontWeight: '800', color: isOwn ? 'rgba(255,255,255,0.9)' : colors.text }}>
                                          #{tRef.numero} — {tRef.asunto}
                                        </Text>
                                        <Text style={{ fontSize: 10, color: isOwn ? 'rgba(255,255,255,0.6)' : colors.textMuted, marginTop: 2 }}>
                                          {tRef.estado}
                                        </Text>
                                      </TouchableOpacity>
                                    )
                                  })()}

                                  {/* File attachments */}
                                  {item.chat_mensajes_archivos?.length > 0 && (
                                    <View style={{ marginTop: 6, gap: 4 }}>
                                      {item.chat_mensajes_archivos.map((arch, ai) => {
                                        const isImg = arch.mime_type?.startsWith('image/')
                                        const nombre = arch.nombre_original || arch.nombre || arch.name || 'Archivo'
                                        async function openFile() {
                                          try {
                                            const { url } = await getChatArchivoUrl(arch.id)
                                            if (url) Linking.openURL(url)
                                          } catch {}
                                        }
                                        return (
                                          <View
                                            key={ai}
                                            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, padding: 6, borderRadius: 8, backgroundColor: isOwn ? 'rgba(255,255,255,0.15)' : colors.bg, borderWidth: 1, borderColor: isOwn ? 'rgba(255,255,255,0.2)' : colors.border }}
                                          >
                                            <Ionicons name={isImg ? 'image-outline' : 'document-outline'} size={15} color={isOwn ? '#fff' : colors.primary} />
                                            <Text style={{ fontSize: 12, color: isOwn ? '#fff' : colors.text, flex: 1 }} numberOfLines={1}>{nombre}</Text>
                                            <TouchableOpacity onPress={openFile} style={{ padding: 2 }}>
                                              <Ionicons name="download-outline" size={16} color={isOwn ? '#fff' : colors.primary} />
                                            </TouchableOpacity>
                                          </View>
                                        )
                                      })}
                                    </View>
                                  )}

                                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4, justifyContent: isOwn ? 'flex-end' : 'flex-start' }}>
                                    <Text style={{ fontSize: 10, color: isOwn ? 'rgba(255,255,255,0.6)' : colors.textMuted }}>{formatHora(item.created_at)}</Text>
                                    {item.editado && <Text style={{ fontSize: 9, color: isOwn ? 'rgba(255,255,255,0.5)' : colors.textMuted }}>(editado)</Text>}
                                  </View>
                                </View>
                              </TouchableOpacity>
                            )}
                          </View>
                        </View>
                      </View>
                    )
                  }}
                />
              )}

              {/* Pending files / ticket ref chips */}
              {(pendingFiles.length > 0 || ticketRef) && (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 12, paddingTop: 8, backgroundColor: colors.headerBg, borderTopWidth: 1, borderTopColor: colors.border }}>
                  {ticketRef && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, backgroundColor: colors.primary + '22', borderWidth: 1, borderColor: colors.primary }}>
                      <Ionicons name="ticket-outline" size={13} color={colors.primary} />
                      <Text style={{ fontSize: 12, color: colors.primary, fontWeight: '600' }}>#{ticketRef.numero}</Text>
                      <TouchableOpacity onPress={() => setTicketRef(null)}>
                        <Ionicons name="close-circle" size={14} color={colors.primary} />
                      </TouchableOpacity>
                    </View>
                  )}
                  {pendingFiles.map((f, i) => (
                    <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, backgroundColor: colors.inputBg, borderWidth: 1, borderColor: colors.inputBorder }}>
                      <Ionicons name="document-outline" size={13} color={colors.textMuted} />
                      <Text style={{ fontSize: 12, color: colors.text, maxWidth: 120 }} numberOfLines={1}>{f.name}</Text>
                      <TouchableOpacity onPress={() => setPendingFiles(prev => prev.filter((_, idx) => idx !== i))}>
                        <Ionicons name="close-circle" size={14} color={colors.textMuted} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}

              {/* Formatting toolbar */}
              <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, backgroundColor: colors.headerBg, borderTopWidth: 1, borderTopColor: colors.border + '55', gap: 2 }}>
                {[
                  { label: 'B',  style: { fontWeight: '900' }, prefix: '**', suffix: '**', title: 'Negrita' },
                  { label: 'I',  style: { fontStyle: 'italic' }, prefix: '_', suffix: '_', title: 'Cursiva' },
                  { label: 'S',  style: { textDecorationLine: 'line-through' }, prefix: '~~', suffix: '~~', title: 'Tachado' },
                  { label: 'U',  style: { textDecorationLine: 'underline' }, prefix: '__', suffix: '__', title: 'Subrayado' },
                  { label: '<>', style: { fontFamily: 'monospace', fontSize: 11 }, prefix: '`', suffix: '`', title: 'Código' },
                  { label: '"',  style: {}, prefix: '> ', suffix: '', title: 'Cita' },
                ].map(fmt => (
                  <TouchableOpacity
                    key={fmt.title}
                    onPress={() => applyFormat(fmt.prefix, fmt.suffix)}
                    style={{ paddingHorizontal: 8, paddingVertical: 5, borderRadius: 6, marginHorizontal: 1 }}
                    activeOpacity={0.6}
                  >
                    <Text style={[{ fontSize: 13, color: colors.textMuted }, fmt.style]}>{fmt.label}</Text>
                  </TouchableOpacity>
                ))}
                <View style={{ flex: 1 }} />
                <TouchableOpacity onPress={pickFile} style={{ padding: 6 }}>
                  <Ionicons name="attach-outline" size={20} color={colors.textMuted} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setShowTicketPicker(true)} style={{ padding: 6 }}>
                  <Ionicons name="ticket-outline" size={18} color={colors.textMuted} />
                </TouchableOpacity>
              </View>

              {/* @mention picker */}
              {mentionQuery !== null && (() => {
                const q = mentionQuery.query
                const filtered = operarios
                  .filter(op => op.id !== userId)
                  .filter(op => !q || (op.nombre || op.email || '').toLowerCase().includes(q))
                  .slice(0, 6)
                if (filtered.length === 0) return null
                return (
                  <View style={{ backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.border, maxHeight: 220 }}>
                    <ScrollView keyboardShouldPersistTaps="always">
                      {filtered.map(op => (
                        <TouchableOpacity
                          key={op.id}
                          onPress={() => insertMention(op)}
                          style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border + '44' }}
                        >
                          <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: getAvatarColor(op.id), alignItems: 'center', justifyContent: 'center' }}>
                            <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>{getInitials(op.nombre || op.email)}</Text>
                          </View>
                          <View>
                            <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>{op.nombre || op.email}</Text>
                            {op.email && op.nombre ? <Text style={{ fontSize: 11, color: colors.textMuted }}>{op.email}</Text> : null}
                          </View>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )
              })()}

              {/* Input row */}
              <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 12, paddingTop: 8, paddingBottom: 12, backgroundColor: colors.headerBg, alignItems: 'flex-end' }}>
                <TextInput
                  ref={inputRef}
                  style={{ flex: 1, backgroundColor: colors.inputBg, borderWidth: 1.5, borderColor: colors.inputBorder, borderRadius: 22, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, color: colors.text, maxHeight: 100 }}
                  placeholder="Escribe un mensaje... (@ para mencionar)"
                  placeholderTextColor={colors.textMuted}
                  value={texto}
                  onChangeText={handleTextChange}
                  onSelectionChange={e => setMsgSelection(e.nativeEvent.selection)}
                  multiline
                  onSubmitEditing={sendMsg}
                  blurOnSubmit={false}
                />
                <TouchableOpacity
                  style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: (texto.trim() || pendingFiles.length > 0 || ticketRef) ? colors.primary : colors.border, alignItems: 'center', justifyContent: 'center' }}
                  onPress={sendMsg}
                  disabled={(!texto.trim() && pendingFiles.length === 0 && !ticketRef) || sending}
                >
                  {sending ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="send" size={18} color="#fff" />}
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
              <Ionicons name="chatbubbles-outline" size={56} color={colors.textMuted} />
              <Text style={{ fontSize: 16, color: colors.textMuted, fontWeight: '600' }}>Selecciona un canal</Text>
              <Text style={{ fontSize: 13, color: colors.textMuted }}>Abre el menú para ver los canales</Text>
              <TouchableOpacity
                onPress={openDrawer}
                style={{ marginTop: 8, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10, backgroundColor: colors.primary }}
              >
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Ver canales</Text>
              </TouchableOpacity>
            </View>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>

      {/* Overlay */}
      {drawerOpen && (
        <TouchableOpacity
          onPress={closeDrawer}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 10 }}
          activeOpacity={1}
        />
      )}

      {/* Animated Sidebar Drawer */}
      <Animated.View
        style={{
          position: 'absolute', top: 0, bottom: 0, left: 0,
          width: SIDEBAR_W,
          transform: [{ translateX: sidebarAnim }],
          zIndex: 20,
          backgroundColor: sidebarBg,
          shadowColor: '#000',
          shadowOffset: { width: 4, height: 0 },
          shadowOpacity: 0.18,
          shadowRadius: 10,
          elevation: 12,
        }}
      >
        <SafeAreaView edges={['top', 'bottom', 'left']} style={{ flex: 1 }}>
          {/* Drawer header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border + '44', gap: 10 }}>
            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: getAvatarColor(userId), alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>{getInitials(user?.nombre || user?.email)}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: '800', color: colors.text }} numberOfLines={1}>Chat del equipo</Text>
              <Text style={{ fontSize: 11, color: colors.textMuted }} numberOfLines={1}>{(user?.nombre || user?.email || '').substring(0, 18)}</Text>
            </View>
            <TouchableOpacity onPress={closeDrawer} style={{ padding: 4 }}>
              <Ionicons name="close" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingVertical: 8 }}>
            {/* Pending DM invite banners */}
            {Object.values(pendingInvites).map(inv => (
              <View key={"invite-" + inv.canalId} style={{ margin: 8, padding: 12, borderRadius: 10, backgroundColor: colors.primary + '22', borderWidth: 1, borderColor: colors.primary }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text, marginBottom: 6 }}>
                  {inv.nombreRemitente} quiere chatear contigo
                </Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity
                    onPress={() => aceptarInvitacion(inv.canalId, inv.nombreRemitente)}
                    style={{ flex: 1, paddingVertical: 7, borderRadius: 8, backgroundColor: colors.primary, alignItems: 'center' }}
                  >
                    <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>Aceptar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => rechazarInvitacion(inv.canalId)}
                    style={{ flex: 1, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: colors.danger, alignItems: 'center' }}
                  >
                    <Text style={{ color: colors.danger, fontWeight: '700', fontSize: 13 }}>Rechazar</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}

            {/* Pinned section */}
            {pinnedCanales.length > 0 && (
              <View style={{ marginBottom: 8 }}>
                <Text style={{ fontSize: 10, fontWeight: '800', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 1, paddingHorizontal: 16, paddingVertical: 6 }}>
                  Fijados
                </Text>
                {pinnedCanales.map(canal => renderCanalItem(canal, canalActivo?.id === canal.id))}
              </View>
            )}

            {/* CANALES section */}
            <View style={{ marginBottom: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 6 }}>
                <Text style={{ fontSize: 10, fontWeight: '800', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 1 }}>Canales</Text>
                {isAdmin() && (
                  <TouchableOpacity onPress={() => setShowNuevoCanalModal(true)}>
                    <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
                  </TouchableOpacity>
                )}
              </View>
              {regularVisible.length === 0 ? (
                <Text style={{ fontSize: 13, color: colors.textMuted, paddingHorizontal: 16 }}>Sin canales</Text>
              ) : (
                regularVisible.map(canal => renderCanalItem(canal, canalActivo?.id === canal.id))
              )}
            </View>

            {/* MENSAJES DIRECTOS section */}
            <View style={{ marginBottom: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 6 }}>
                <Text style={{ fontSize: 10, fontWeight: '800', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 1 }}>Mensajes directos</Text>
                <TouchableOpacity onPress={() => setShowDirectoModal(true)}>
                  <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
                </TouchableOpacity>
              </View>
              {canalesDirectos.map(canal => renderCanalItem(canal, canalActivo?.id === canal.id))}
              {canalesDirectos.length === 0 && (
                <Text style={{ fontSize: 13, color: colors.textMuted, paddingHorizontal: 16 }}>Sin mensajes directos</Text>
              )}
            </View>

            {/* Hidden canales toggle */}
            {hiddenCount > 0 && (
              <TouchableOpacity
                onPress={() => setShowHidden(v => !v)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 10 }}
              >
                <Ionicons name={showHidden ? 'eye-off-outline' : 'eye-outline'} size={16} color={colors.textMuted} />
                <Text style={{ fontSize: 12, color: colors.textMuted }}>
                  {showHidden ? 'Ocultar' : `${hiddenCount} canal${hiddenCount !== 1 ? 'es' : ''} oculto${hiddenCount !== 1 ? 's' : ''}`}
                </Text>
              </TouchableOpacity>
            )}
            {showHidden && hiddenCanales.map(canal => renderCanalItem(canal, canalActivo?.id === canal.id))}
          </ScrollView>
        </SafeAreaView>
      </Animated.View>

      {/* Canal options modal */}
      {canalMenu && (() => {
        const canal = canalMenu
        const pref = prefs[canal.id] || {}
        const name = canal.tipo === 'directo' ? getDmNombre(canal, userId) : canal.nombre
        return (
          <Modal visible transparent animationType="fade" onRequestClose={() => setCanalMenu(null)}>
            <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }} activeOpacity={1} onPress={() => setCanalMenu(null)}>
              <View style={{ backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: insets.bottom + 12 }}>
                {/* Modal header */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 18, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                  <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text, flex: 1 }}>
                    {canal.tipo === 'canal' ? '# ' : ''}{name}
                  </Text>
                  <TouchableOpacity onPress={() => setCanalMenu(null)}>
                    <Ionicons name="close" size={22} color={colors.textMuted} />
                  </TouchableOpacity>
                </View>
                {/* Options list */}
                {[
                  {
                    icon: pref.pinned ? 'pin' : 'pin-outline',
                    label: pref.pinned ? 'Desfijar canal' : 'Fijar canal',
                    color: colors.primary,
                    onPress: () => { updatePref(canal.id, { pinned: !pref.pinned }); setCanalMenu(null) },
                  },
                  {
                    icon: pref.muted ? 'notifications-outline' : 'notifications-off-outline',
                    label: pref.muted ? 'Activar notificaciones' : 'Silenciar',
                    color: colors.text,
                    onPress: () => { updatePref(canal.id, { muted: !pref.muted }); setCanalMenu(null) },
                  },
                  {
                    icon: 'eye-off-outline',
                    label: 'Ocultar canal',
                    color: colors.text,
                    onPress: () => { updatePref(canal.id, { hidden: true }); setCanalMenu(null) },
                    hide: canal.tipo !== 'canal',
                  },
                  ...(canal.tipo === 'canal' ? [
                    {
                      icon: 'swap-vertical-outline',
                      label: 'Ordenar canales',
                      color: colors.text,
                      onPress: () => { setCanalMenu(null); setShowOrdenarModal(true) },
                    },
                  ] : []),
                  ...(isAdmin() && canal.tipo === 'canal' ? [
                    {
                      icon: 'create-outline',
                      label: 'Editar canal',
                      color: colors.text,
                      onPress: () => { setEditingCanal(canal); setShowEditCanalModal(true); setCanalMenu(null) },
                    },
                    {
                      icon: 'trash-outline',
                      label: 'Eliminar canal',
                      color: colors.danger,
                      onPress: () => { setCanalMenu(null); deleteCanal(canal) },
                    },
                  ] : []),
                ].filter(o => !o.hide).map((opt, i) => (
                  <TouchableOpacity
                    key={i}
                    onPress={opt.onPress}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border + '55' }}
                  >
                    <Ionicons name={opt.icon} size={20} color={opt.color} />
                    <Text style={{ fontSize: 15, color: opt.color, fontWeight: '500' }}>{opt.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </TouchableOpacity>
          </Modal>
        )
      })()}

      {/* Modals */}
      <NuevoCanalModal
        visible={showNuevoCanalModal}
        operarios={operarios}
        userId={userId}
        onClose={() => setShowNuevoCanalModal(false)}
        onSave={handleCrearCanal}
        colors={colors}
      />
      <EditCanalModal
        visible={showEditCanalModal}
        canal={editingCanal}
        onClose={() => { setShowEditCanalModal(false); setEditingCanal(null) }}
        onSave={handleEditarCanal}
        colors={colors}
      />
      <NuevoDirectoModal
        visible={showDirectoModal}
        operarios={operarios}
        userId={userId}
        onClose={() => setShowDirectoModal(false)}
        onSelect={crearDirecto}
        colors={colors}
      />
      <OrdenarCanalesModal
        visible={showOrdenarModal}
        canales={canalesRegulares}
        canalOrder={canalOrder}
        onMove={moveCanal}
        onClose={() => setShowOrdenarModal(false)}
        colors={colors}
      />
      <TicketPickerModal
        visible={showTicketPicker}
        tickets={allTickets}
        onClose={() => setShowTicketPicker(false)}
        onSelect={t => { setTicketRef(t); setShowTicketPicker(false) }}
        colors={colors}
      />
    </View>
  )
}
