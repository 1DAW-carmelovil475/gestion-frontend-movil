import { useState, useEffect, useCallback, useRef } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Alert, Modal, KeyboardAvoidingView,
  Platform, FlatList, Linking,
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import * as DocumentPicker from 'expo-document-picker'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import {
  getTicket, updateTicket, deleteTicket,
  getTicketComentarios, createTicketComentario, deleteTicketComentario,
  assignOperarios, removeOperario,
  getOperarios, getEmpresas, getDispositivos, getArchivoUrl, deleteArchivo,
  updateTicketNotas, uploadTicketArchivos,
} from '../services/api'

const ESTADOS    = ['Pendiente', 'En curso', 'Completado', 'Pendiente de facturar', 'Facturado']
const PRIORIDADES = ['Baja', 'Media', 'Alta', 'Urgente']

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
function formatFecha(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}
function formatHoras(h) {
  if (!h || h <= 0) return '0min'
  if (h < 1) return `${Math.round(h * 60)}min`
  const hrs = Math.floor(h); const min = Math.round((h - hrs) * 60)
  if (h < 24) return min > 0 ? `${hrs}h ${min}min` : `${hrs}h`
  return `${Math.floor(h / 24)}d`
}

function PrioridadBadge({ p, colors }) {
  const cfg = { Urgente: { bg: colors.dangerBg, txt: colors.danger }, Alta: { bg: colors.warningBg, txt: colors.warning }, Media: { bg: colors.infoBg, txt: colors.info }, Baja: { bg: colors.badgeGray, txt: colors.textMuted } }
  const c = cfg[p] || cfg.Baja
  return <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, backgroundColor: c.bg }}><Text style={{ fontSize: 12, fontWeight: '700', color: c.txt }}>{p}</Text></View>
}

function EstadoBadge({ e, colors }) {
  const cfg = { 'Pendiente': { bg: colors.warningBg, txt: colors.warning }, 'En curso': { bg: colors.infoBg, txt: colors.info }, 'Completado': { bg: colors.successBg, txt: colors.success }, 'Pendiente de facturar': { bg: colors.purpleBg, txt: colors.purple }, 'Facturado': { bg: colors.cyanBg, txt: colors.cyan } }
  const c = cfg[e] || { bg: colors.badgeGray, txt: colors.textMuted }
  return <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, backgroundColor: c.bg }}><Text style={{ fontSize: 12, fontWeight: '700', color: c.txt }}>{e}</Text></View>
}

const HISTORIAL_ICONS = {
  creacion:    { icon: 'add-circle-outline',      color: '#16a34a' },
  estado:      { icon: 'swap-horizontal-outline', color: '#0066ff' },
  prioridad:   { icon: 'flag-outline',            color: '#d97706' },
  asignacion:  { icon: 'person-add-outline',      color: '#9333ea' },
  comentario:  { icon: 'chatbubble-outline',      color: '#0891b2' },
  archivo:     { icon: 'attach-outline',          color: '#be185d' },
  edicion:     { icon: 'pencil-outline',          color: '#64748b' },
  default:     { icon: 'ellipse-outline',         color: '#64748b' },
}

export default function TicketDetalleScreen({ route, navigation }) {
  const { ticket: initialTicket } = route.params
  const { user } = useAuth()
  const { colors, isDark } = useTheme()
  const insets = useSafeAreaInsets()

  const [ticket, setTicket]           = useState(initialTicket)
  const [loading, setLoading]         = useState(true)
  const [comentarios, setComentarios] = useState([])
  const [operarios, setOperarios]     = useState([])
  const [activeTab, setActiveTab]     = useState('comentarios')
  const [newComment, setNewComment]   = useState('')
  const [sendingComment, setSendingComment] = useState(false)
  const [showEstadoModal, setShowEstadoModal] = useState(false)
  const [showPrioModal, setShowPrioModal]     = useState(false)
  const [showOperModal, setShowOperModal]     = useState(false)
  const [showInfoPanel, setShowInfoPanel]     = useState(false)
  const [showEditModal, setShowEditModal]     = useState(false)
  // Notas privadas
  const [notasValue, setNotasValue]   = useState('')
  const [savingNotas, setSavingNotas] = useState(false)
  const [notasSaved, setNotasSaved]   = useState(false)
  const notasTimer = useRef(null)
  // File upload
  const [uploadingFiles, setUploadingFiles] = useState(false)
  const [commentFiles, setCommentFiles]     = useState([])
  const scrollRef = useRef(null)

  const loadAll = useCallback(async () => {
    try {
      const [t, c, o] = await Promise.all([
        getTicket(initialTicket.id),
        getTicketComentarios(initialTicket.id),
        getOperarios(),
      ])
      setTicket(t)
      setNotasValue(t.notas || '')
      setComentarios(Array.isArray(c) ? c : [])
      setOperarios(Array.isArray(o) ? o : [])
    } catch (e) { Alert.alert('Error', e.message) }
  }, [initialTicket.id])

  useEffect(() => {
    loadAll().finally(() => setLoading(false))
  }, [])

  // ── Estado / Prioridad ──────────────────────────────────────────────────────
  async function changeEstado(estado) {
    try {
      await updateTicket(ticket.id, { estado })
      setTicket(t => ({ ...t, estado }))
      setShowEstadoModal(false)
    } catch (e) { Alert.alert('Error', e.message) }
  }

  async function changePrioridad(prioridad) {
    try {
      await updateTicket(ticket.id, { prioridad })
      setTicket(t => ({ ...t, prioridad }))
      setShowPrioModal(false)
    } catch (e) { Alert.alert('Error', e.message) }
  }

  // ── Edit ticket ─────────────────────────────────────────────────────────────
  async function handleEditSave(form) {
    try {
      const { operarios: ops, ...ticketData } = form
      await updateTicket(ticket.id, ticketData)
      if (ops !== undefined) {
        await assignOperarios(ticket.id, ops)
      }
      await loadAll()
      setShowEditModal(false)
    } catch (e) { Alert.alert('Error', e.message) }
  }

  // ── Comentarios ─────────────────────────────────────────────────────────────
  async function pickCommentFile() {
    try {
      const result = await DocumentPicker.getDocumentAsync({ multiple: true, copyToCacheDirectory: true })
      if (result.canceled) return
      const files = result.assets || (result.uri ? [result] : [])
      setCommentFiles(prev => [...prev, ...files])
    } catch (e) {}
  }

  async function sendComment() {
    if (!newComment.trim() && commentFiles.length === 0) return
    setSendingComment(true)
    try {
      if (newComment.trim()) {
        const c = await createTicketComentario(ticket.id, newComment.trim())
        setComentarios(prev => [...prev, c])
      }
      if (commentFiles.length > 0) {
        await uploadTicketArchivos(ticket.id, commentFiles.map(f => ({ uri: f.uri, name: f.name, mimeType: f.mimeType || 'application/octet-stream' })))
        await loadAll()
      }
      setNewComment('')
      setCommentFiles([])
      setTimeout(() => scrollRef.current?.scrollToEnd?.({ animated: true }), 100)
    } catch (e) { Alert.alert('Error', e.message) }
    finally { setSendingComment(false) }
  }

  async function deleteComment(id) {
    Alert.alert('Eliminar comentario', '¿Eliminar este comentario?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: async () => {
        try {
          await deleteTicketComentario(id)
          setComentarios(prev => prev.filter(c => c.id !== id))
        } catch (e) { Alert.alert('Error', e.message) }
      }},
    ])
  }

  // ── Notas privadas (auto-save) ───────────────────────────────────────────────
  function handleNotasChange(val) {
    setNotasValue(val)
    setNotasSaved(false)
    if (notasTimer.current) clearTimeout(notasTimer.current)
    notasTimer.current = setTimeout(async () => {
      setSavingNotas(true)
      try {
        await updateTicketNotas(ticket.id, val)
        setNotasSaved(true)
        setTimeout(() => setNotasSaved(false), 2000)
      } catch (e) {}
      finally { setSavingNotas(false) }
    }, 1200)
  }

  // ── Archivos ─────────────────────────────────────────────────────────────────
  async function pickAndUploadFiles() {
    try {
      const result = await DocumentPicker.getDocumentAsync({ multiple: true, copyToCacheDirectory: true })
      if (result.canceled) return
      const files = result.assets || (result.uri ? [result] : [])
      if (!files.length) return
      setUploadingFiles(true)
      try {
        await uploadTicketArchivos(ticket.id, files.map(f => ({ uri: f.uri, name: f.name, mimeType: f.mimeType || 'application/octet-stream' })))
        await loadAll()
      } catch (e) { Alert.alert('Error', e.message) }
      finally { setUploadingFiles(false) }
    } catch (e) {}
  }

  async function openArchivo(id) {
    try {
      const { url } = await getArchivoUrl(id)
      if (url) Linking.openURL(url)
    } catch (e) { Alert.alert('Error', 'No se pudo abrir el archivo') }
  }

  async function handleDeleteArchivo(id) {
    Alert.alert('Eliminar archivo', '¿Eliminar este archivo?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: async () => {
        try {
          await deleteArchivo(id)
          setTicket(t => ({ ...t, ticket_archivos: t.ticket_archivos?.filter(a => a.id !== id) }))
        } catch (e) { Alert.alert('Error', e.message) }
      }},
    ])
  }

  // ── Operarios ────────────────────────────────────────────────────────────────
  async function removeOperarioFromTicket(uid) {
    try {
      await removeOperario(ticket.id, uid)
      await loadAll()
    } catch (e) { Alert.alert('Error', e.message) }
  }

  async function addOperario(uid) {
    try {
      const current = ticket.ticket_asignaciones?.map(a => a.user_id) || []
      await assignOperarios(ticket.id, [...current, uid])
      await loadAll()
      setShowOperModal(false)
    } catch (e) { Alert.alert('Error', e.message) }
  }

  function handleDeleteTicket() {
    Alert.alert('Eliminar ticket', '¿Eliminar este ticket?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: async () => {
        try {
          await deleteTicket(ticket.id)
          navigation.goBack()
        } catch (e) { Alert.alert('Error', e.message) }
      }},
    ])
  }

  const asignados = ticket.ticket_asignaciones || []
  const archivos  = ticket.ticket_archivos || []
  const historial = [...(ticket.ticket_historial || [])].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

  if (loading) {
    return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg }}><ActivityIndicator size="large" color={colors.primary} /></View>
  }

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

        {/* ── Header ── */}
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, backgroundColor: colors.headerBg, borderBottomWidth: 1, borderBottomColor: colors.border, gap: 10 }}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13, fontWeight: '800', color: colors.primary }}>#{ticket.numero || ticket.id}</Text>
            <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }} numberOfLines={1}>{ticket.asunto}</Text>
          </View>
          <TouchableOpacity onPress={pickAndUploadFiles} style={{ padding: 4 }} disabled={uploadingFiles}>
            {uploadingFiles
              ? <ActivityIndicator size="small" color={colors.primary} />
              : <Ionicons name="attach-outline" size={22} color={colors.primary} />}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowEditModal(true)} style={{ padding: 4 }}>
            <Ionicons name="pencil-outline" size={20} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowInfoPanel(v => !v)} style={{ padding: 4 }}>
            <Ionicons name="information-circle-outline" size={22} color={showInfoPanel ? colors.primary : colors.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleDeleteTicket} style={{ padding: 4 }}>
            <Ionicons name="trash-outline" size={20} color={colors.danger} />
          </TouchableOpacity>
        </View>

        {/* ── Badges row ── */}
        <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: colors.headerBg, borderBottomWidth: 1, borderBottomColor: colors.border }}>
          <TouchableOpacity onPress={() => setShowEstadoModal(true)}>
            <EstadoBadge e={ticket.estado} colors={colors} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowPrioModal(true)}>
            <PrioridadBadge p={ticket.prioridad} colors={colors} />
          </TouchableOpacity>
          {ticket.horas_totales > 0 && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: colors.badgeGray, borderRadius: 12 }}>
              <Ionicons name="time-outline" size={13} color={colors.textMuted} />
              <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textMuted }}>{formatHoras(ticket.horas_totales)}</Text>
            </View>
          )}
        </View>

        {/* ── Info panel ── */}
        {showInfoPanel && (
          <View style={{ backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border, padding: 16 }}>
            {(() => {
              const allDisps = [ticket.dispositivos, ...(ticket.dispositivos_extra || [])].filter(Boolean)
              const equipoLabel = allDisps.length > 1 ? 'Equipos' : 'Equipo'
              const equipoValue = allDisps.length > 0 ? allDisps.map(d => d.nombre).join(', ') : 'Sin equipo'
              return (
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 6 }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textMuted, width: 70 }}>{equipoLabel}:</Text>
                  <Text style={{ fontSize: 12, color: allDisps.length > 0 ? colors.text : colors.textMuted, flex: 1 }}>{equipoValue}</Text>
                </View>
              )
            })()}
            {[
              { label: 'Empresa',  value: ticket.empresas?.nombre },
              { label: 'Contacto', value: ticket.contacto_nombre },
              { label: 'Teléfono', value: ticket.telefono_cliente },
              { label: 'Creado',   value: formatFecha(ticket.created_at) },
            ].map(({ label, value }) => value ? (
              <View key={label} style={{ flexDirection: 'row', gap: 8, marginBottom: 6 }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textMuted, width: 70 }}>{label}:</Text>
                <Text style={{ fontSize: 12, color: colors.text, flex: 1 }}>{value}</Text>
              </View>
            ) : null)}

            {ticket.descripcion ? (
              <View style={{ marginTop: 4 }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textMuted, marginBottom: 4 }}>Descripción:</Text>
                <Text style={{ fontSize: 13, color: colors.text, lineHeight: 18 }}>{ticket.descripcion}</Text>
              </View>
            ) : null}

            {/* Operarios */}
            <View style={{ marginTop: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textMuted }}>Operarios asignados</Text>
                <TouchableOpacity onPress={() => setShowOperModal(true)}>
                  <Ionicons name="person-add-outline" size={16} color={colors.primary} />
                </TouchableOpacity>
              </View>
              {asignados.length === 0 ? (
                <Text style={{ fontSize: 12, color: colors.textMuted }}>Sin operarios</Text>
              ) : (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {asignados.map(a => (
                    <View key={a.user_id} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 16, backgroundColor: colors.primaryBg }}>
                      <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: getAvatarColor(a.user_id), alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ fontSize: 8, color: '#fff', fontWeight: '700' }}>{getInitials(a.profiles?.nombre)}</Text>
                      </View>
                      <Text style={{ fontSize: 12, fontWeight: '600', color: colors.primary }}>{a.profiles?.nombre?.split(' ')[0]}</Text>
                      <TouchableOpacity onPress={() => removeOperarioFromTicket(a.user_id)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                        <Ionicons name="close-circle" size={14} color={colors.primary} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
            </View>

            {/* Archivos adjuntos */}
            {archivos.length > 0 && (
              <View style={{ marginTop: 10 }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textMuted, marginBottom: 6 }}>Archivos ({archivos.length})</Text>
                {archivos.map(a => (
                  <View key={a.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 5, paddingHorizontal: 8, borderRadius: 8, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, marginBottom: 4 }}>
                    <Ionicons name={a.mime_type?.startsWith('image/') ? 'image-outline' : 'document-outline'} size={14} color={colors.primary} />
                    <Text style={{ fontSize: 12, color: colors.text, flex: 1 }} numberOfLines={1}>{a.nombre_original}</Text>
                    <TouchableOpacity onPress={() => openArchivo(a.id)} style={{ padding: 4 }}>
                      <Ionicons name="download-outline" size={16} color={colors.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDeleteArchivo(a.id)} style={{ padding: 4 }}>
                      <Ionicons name="trash-outline" size={14} color={colors.danger} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* ── Tabs ── */}
        <View style={{ flexDirection: 'row', backgroundColor: colors.headerBg, borderBottomWidth: 1, borderBottomColor: colors.border, paddingHorizontal: 16 }}>
          {[
            { key: 'comentarios', label: 'Comentarios' },
            { key: 'historial',   label: 'Historial' },
            { key: 'notas',       label: 'Notas' },
          ].map(tab => (
            <TouchableOpacity
              key={tab.key}
              style={{ paddingVertical: 12, marginRight: 20, borderBottomWidth: 2, borderBottomColor: activeTab === tab.key ? colors.primary : 'transparent' }}
              onPress={() => setActiveTab(tab.key)}
            >
              <Text style={{ fontSize: 13, fontWeight: '700', color: activeTab === tab.key ? colors.primary : colors.textMuted }}>{tab.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── NOTAS tab ── (not keyboard-related, just a flex TextInput) */}
        {activeTab === 'notas' && (
          <View style={{ flex: 1, padding: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <Text style={{ fontSize: 11, color: colors.textMuted, fontWeight: '600' }}>Solo visible para el equipo</Text>
              <Text style={{ fontSize: 11, color: savingNotas ? colors.textMuted : notasSaved ? colors.success : 'transparent', fontWeight: '600' }}>
                {savingNotas ? 'Guardando...' : notasSaved ? 'Guardado ✓' : '·'}
              </Text>
            </View>
            <TextInput
              style={{
                flex: 1, backgroundColor: colors.inputBg, borderWidth: 1.5,
                borderColor: colors.inputBorder, borderRadius: 12,
                paddingHorizontal: 14, paddingVertical: 12, fontSize: 14,
                color: colors.text, lineHeight: 22, textAlignVertical: 'top',
              }}
              value={notasValue}
              onChangeText={handleNotasChange}
              placeholder="Escribe notas privadas aquí..."
              placeholderTextColor={colors.textMuted}
              multiline
            />
          </View>
        )}

        {/* ── HISTORIAL tab ── */}
        {activeTab === 'historial' && (
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 16 }}>
            {historial.length === 0 ? (
              <View style={{ alignItems: 'center', paddingTop: 40, gap: 8 }}>
                <Ionicons name="time-outline" size={36} color={colors.textMuted} />
                <Text style={{ fontSize: 14, color: colors.textMuted }}>Sin historial</Text>
              </View>
            ) : historial.map((h, i) => {
              const cfg = HISTORIAL_ICONS[h.tipo] || HISTORIAL_ICONS.default
              return (
                <View key={h.id} style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
                  <View style={{ alignItems: 'center' }}>
                    <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: cfg.color + '20', alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name={cfg.icon} size={16} color={cfg.color} />
                    </View>
                    {i < historial.length - 1 && <View style={{ width: 1, flex: 1, backgroundColor: colors.border, marginTop: 4 }} />}
                  </View>
                  <View style={{ flex: 1, paddingTop: 4 }}>
                    <Text style={{ fontSize: 13, color: colors.text, lineHeight: 18 }}>{h.descripcion}</Text>
                    <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
                      {h.profiles?.nombre && <Text style={{ fontSize: 11, color: colors.primary, fontWeight: '600' }}>{h.profiles.nombre.split(' ')[0]}</Text>}
                      <Text style={{ fontSize: 11, color: colors.textMuted }}>{formatFecha(h.created_at)}</Text>
                    </View>
                  </View>
                </View>
              )
            })}
          </ScrollView>
        )}

        {/* ── COMENTARIOS tab ── */}
        {activeTab === 'comentarios' && (
          <>
            <FlatList
              ref={scrollRef}
              data={comentarios}
              keyExtractor={item => String(item.id)}
              contentContainerStyle={{ padding: 16, paddingBottom: 8 }}
              ListEmptyComponent={
                <View style={{ alignItems: 'center', paddingTop: 40, gap: 8 }}>
                  <Ionicons name="chatbubble-outline" size={36} color={colors.textMuted} />
                  <Text style={{ fontSize: 14, color: colors.textMuted }}>Sin comentarios</Text>
                </View>
              }
              renderItem={({ item }) => {
                const isOwn = item.user_id === user?.id
                return (
                  <View style={{ marginBottom: 14 }}>
                    <View style={{ flexDirection: isOwn ? 'row-reverse' : 'row', gap: 10, alignItems: 'flex-start' }}>
                      <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: getAvatarColor(item.user_id), alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Text style={{ fontSize: 11, color: '#fff', fontWeight: '800' }}>{getInitials(item.profiles?.nombre)}</Text>
                      </View>
                      <View style={{ flex: 1, maxWidth: '80%' }}>
                        <View style={{ flexDirection: isOwn ? 'row-reverse' : 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                          <Text style={{ fontSize: 12, fontWeight: '700', color: colors.text }}>{item.profiles?.nombre || 'Usuario'}</Text>
                          <Text style={{ fontSize: 10, color: colors.textMuted }}>{formatFecha(item.created_at)}</Text>
                        </View>
                        <View style={{
                          padding: 12, borderRadius: 12,
                          backgroundColor: isOwn ? colors.chatMine : colors.chatOther,
                          borderWidth: isOwn ? 0 : 1, borderColor: colors.border,
                          borderTopRightRadius: isOwn ? 4 : 12,
                          borderTopLeftRadius: isOwn ? 12 : 4,
                        }}>
                          <Text style={{ fontSize: 14, color: isOwn ? colors.chatMineTxt : colors.chatOtherTxt, lineHeight: 20 }}>
                            {item.contenido}
                          </Text>
                          {/* Archivos del comentario */}
                          {item.ticket_comentarios_archivos?.length > 0 && (
                            <View style={{ marginTop: 6, gap: 4 }}>
                              {item.ticket_comentarios_archivos.map((arch, ai) => (
                                <TouchableOpacity
                                  key={ai}
                                  onPress={() => openArchivo(arch.id)}
                                  style={{ flexDirection: 'row', alignItems: 'center', gap: 6, padding: 6, borderRadius: 8, backgroundColor: isOwn ? 'rgba(255,255,255,0.15)' : colors.bg, borderWidth: 1, borderColor: colors.border }}
                                >
                                  <Ionicons name={arch.mime_type?.startsWith('image/') ? 'image-outline' : 'document-outline'} size={14} color={isOwn ? '#fff' : colors.primary} />
                                  <Text style={{ fontSize: 12, color: isOwn ? '#fff' : colors.text, flex: 1 }} numberOfLines={1}>{arch.nombre_original}</Text>
                                </TouchableOpacity>
                              ))}
                            </View>
                          )}
                        </View>
                      </View>
                      {isOwn && (
                        <TouchableOpacity onPress={() => deleteComment(item.id)} style={{ paddingTop: 4 }}>
                          <Ionicons name="trash-outline" size={14} color={colors.danger} />
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                )
              }}
            />
            {/* Comment input — sticky footer */}
            <View style={{ backgroundColor: colors.headerBg, borderTopWidth: 1, borderTopColor: colors.border }}>
              {commentFiles.length > 0 && (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 12, paddingTop: 8 }}>
                  {commentFiles.map((f, i) => (
                    <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, backgroundColor: colors.inputBg, borderWidth: 1, borderColor: colors.inputBorder }}>
                      <Ionicons name="document-outline" size={13} color={colors.textMuted} />
                      <Text style={{ fontSize: 12, color: colors.text, maxWidth: 100 }} numberOfLines={1}>{f.name}</Text>
                      <TouchableOpacity onPress={() => setCommentFiles(prev => prev.filter((_, idx) => idx !== i))}>
                        <Ionicons name="close-circle" size={14} color={colors.textMuted} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
              <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingTop: 10, paddingBottom: 12, alignItems: 'flex-end' }}>
                <TouchableOpacity onPress={pickCommentFile} style={{ padding: 6, marginBottom: 2 }}>
                  <Ionicons name="attach-outline" size={22} color={colors.primary} />
                </TouchableOpacity>
                <TextInput
                  style={{ flex: 1, backgroundColor: colors.inputBg, borderWidth: 1.5, borderColor: colors.inputBorder, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, color: colors.text, maxHeight: 100 }}
                  placeholder="Escribe un comentario..."
                  placeholderTextColor={colors.textMuted}
                  value={newComment}
                  onChangeText={setNewComment}
                  multiline
                />
                <TouchableOpacity
                  style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: (newComment.trim() || commentFiles.length > 0) ? colors.primary : colors.border, alignItems: 'center', justifyContent: 'center' }}
                  onPress={sendComment}
                  disabled={(!newComment.trim() && commentFiles.length === 0) || sendingComment}
                >
                  {sendingComment
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Ionicons name="send" size={18} color="#fff" />}
                </TouchableOpacity>
              </View>
            </View>
          </>
        )}
      </KeyboardAvoidingView>

      {/* ── Estado modal ── */}
      <Modal visible={showEstadoModal} transparent animationType="fade" onRequestClose={() => setShowEstadoModal(false)}>
        <TouchableOpacity style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', alignItems: 'center' }} onPress={() => setShowEstadoModal(false)}>
          <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 20, width: '80%', gap: 8 }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 8 }}>Cambiar estado</Text>
            {ESTADOS.map(e => (
              <TouchableOpacity
                key={e}
                style={{ paddingVertical: 12, paddingHorizontal: 16, borderRadius: 8, backgroundColor: ticket.estado === e ? colors.primaryBg : colors.bg, borderWidth: 1, borderColor: ticket.estado === e ? colors.primary : colors.border }}
                onPress={() => changeEstado(e)}
              >
                <Text style={{ fontWeight: '600', color: ticket.estado === e ? colors.primary : colors.text }}>{e}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── Prioridad modal ── */}
      <Modal visible={showPrioModal} transparent animationType="fade" onRequestClose={() => setShowPrioModal(false)}>
        <TouchableOpacity style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', alignItems: 'center' }} onPress={() => setShowPrioModal(false)}>
          <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 20, width: '80%', gap: 8 }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 8 }}>Cambiar prioridad</Text>
            {PRIORIDADES.map(p => (
              <TouchableOpacity
                key={p}
                style={{ paddingVertical: 12, paddingHorizontal: 16, borderRadius: 8, backgroundColor: ticket.prioridad === p ? colors.primaryBg : colors.bg, borderWidth: 1, borderColor: ticket.prioridad === p ? colors.primary : colors.border }}
                onPress={() => changePrioridad(p)}
              >
                <Text style={{ fontWeight: '600', color: ticket.prioridad === p ? colors.primary : colors.text }}>{p}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── Edit ticket modal ── */}
      <EditTicketModal
        visible={showEditModal}
        ticket={ticket}
        operarios={operarios}
        onClose={() => setShowEditModal(false)}
        onSave={handleEditSave}
        colors={colors}
      />

      {/* ── Operarios modal ── */}
      <Modal visible={showOperModal} transparent animationType="slide" onRequestClose={() => setShowOperModal(false)}>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay }}>
          <View style={{ backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '60%' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text }}>Añadir operario</Text>
              <TouchableOpacity onPress={() => setShowOperModal(false)}><Ionicons name="close" size={22} color={colors.textMuted} /></TouchableOpacity>
            </View>
            <ScrollView>
              {operarios
                .filter(op => !asignados.find(a => a.user_id === op.id))
                .map(op => (
                  <TouchableOpacity
                    key={op.id}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}
                    onPress={() => addOperario(op.id)}
                  >
                    <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: getAvatarColor(op.id), alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>{getInitials(op.nombre)}</Text>
                    </View>
                    <View>
                      <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>{op.nombre}</Text>
                      <Text style={{ fontSize: 11, color: colors.textMuted }}>{op.rol}</Text>
                    </View>
                  </TouchableOpacity>
                ))
              }
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}

// ── SearchableMultiSelect (for EditTicketModal operarios) ──────────────────────
function MultiSelectOperarios({ items, selectedIds, onToggle, colors }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const filtered = query.trim() ? items.filter(i => i.nombre?.toLowerCase().includes(query.trim().toLowerCase())) : items
  const selectedItems = items.filter(i => selectedIds.includes(i.id))
  const AVCOLORS = ['#0066ff','#16a34a','#d97706','#dc2626','#9333ea','#0891b2','#be185d','#065f46']
  function avColor(str) { if (!str) return AVCOLORS[0]; let h=0; for (let i=0;i<str.length;i++) h=str.charCodeAt(i)+((h<<5)-h); return AVCOLORS[Math.abs(h)%AVCOLORS.length] }
  function inits(n) { if (!n) return '?'; return n.split(' ').map(x=>x[0]).join('').substring(0,2).toUpperCase() }
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textMuted, marginBottom: 6, textTransform: 'uppercase' }}>Operarios asignados</Text>
      <TouchableOpacity
        onPress={() => { setQuery(''); setOpen(true) }}
        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.inputBg, borderWidth: 1.5, borderColor: selectedIds.length > 0 ? colors.primary : colors.inputBorder, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 11 }}
      >
        <Text style={{ fontSize: 14, color: selectedIds.length > 0 ? colors.text : colors.textMuted, flex: 1 }}>
          {selectedIds.length > 0 ? `${selectedIds.length} operario${selectedIds.length !== 1 ? 's' : ''} seleccionado${selectedIds.length !== 1 ? 's' : ''}` : 'Seleccionar operarios...'}
        </Text>
        <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
      </TouchableOpacity>
      {selectedItems.length > 0 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
          {selectedItems.map(op => (
            <View key={op.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 16, backgroundColor: colors.primaryBg, borderWidth: 1, borderColor: colors.primary }}>
              <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: avColor(op.id), alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 8, color: '#fff', fontWeight: '700' }}>{inits(op.nombre)}</Text>
              </View>
              <Text style={{ fontSize: 12, fontWeight: '600', color: colors.primary }}>{op.nombre?.split(' ')[0]}</Text>
              <TouchableOpacity onPress={() => onToggle(op.id)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                <Ionicons name="close-circle" size={14} color={colors.primary} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => { setOpen(false); setQuery('') }}>
        <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', paddingHorizontal: 20 }} activeOpacity={1} onPress={() => { setOpen(false); setQuery('') }}>
          <TouchableOpacity activeOpacity={1} onPress={() => {}}>
            <View style={{ backgroundColor: colors.card, borderRadius: 14, overflow: 'hidden', maxHeight: 400 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>Seleccionar operarios</Text>
                <TouchableOpacity onPress={() => { setOpen(false); setQuery('') }}><Ionicons name="close" size={20} color={colors.textMuted} /></TouchableOpacity>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                <Ionicons name="search-outline" size={16} color={colors.textMuted} />
                <TextInput style={{ flex: 1, fontSize: 14, color: colors.text }} placeholder="Buscar..." placeholderTextColor={colors.textMuted} value={query} onChangeText={setQuery} autoFocus />
              </View>
              <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 280 }}>
                {filtered.map((item, idx) => {
                  const sel = selectedIds.includes(item.id)
                  return (
                    <TouchableOpacity key={item.id} onPress={() => onToggle(item.id)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: idx < filtered.length - 1 ? 1 : 0, borderBottomColor: colors.border, backgroundColor: sel ? colors.primaryBg : 'transparent' }}>
                      <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: avColor(item.id), alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ fontSize: 11, color: '#fff', fontWeight: '700' }}>{inits(item.nombre)}</Text>
                      </View>
                      <Text style={{ flex: 1, fontSize: 14, color: sel ? colors.primary : colors.text, fontWeight: sel ? '700' : '400' }} numberOfLines={1}>{item.nombre}</Text>
                      {sel && <Ionicons name="checkmark-circle" size={20} color={colors.primary} />}
                    </TouchableOpacity>
                  )
                })}
              </ScrollView>
              <TouchableOpacity onPress={() => { setOpen(false); setQuery('') }} style={{ margin: 12, paddingVertical: 12, alignItems: 'center', borderRadius: 8, backgroundColor: colors.primary }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#fff' }}>{selectedIds.length > 0 ? `Confirmar (${selectedIds.length})` : 'Cerrar'}</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  )
}

// ── EditTicketModal ────────────────────────────────────────────────────────────
function EditTicketModal({ visible, ticket, operarios, onClose, onSave, colors }) {
  const [form, setForm] = useState({ asunto: '', descripcion: '', prioridad: 'Media', estado: 'Pendiente', contacto_nombre: null, telefono_cliente: null })
  const [selOperarios, setSelOperarios] = useState([])
  const [selDispositivos, setSelDispositivos] = useState([])
  const [dispositivos, setDispositivos] = useState([])
  const [empresaContactos, setEmpresaContactos] = useState([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (visible && ticket) {
      setForm({
        asunto: ticket.asunto || '',
        descripcion: ticket.descripcion || '',
        prioridad: ticket.prioridad || 'Media',
        estado: ticket.estado || 'Pendiente',
        contacto_nombre: ticket.contacto_nombre || null,
        telefono_cliente: ticket.telefono_cliente || null,
      })
      // Pre-select assigned operarios
      setSelOperarios((ticket.ticket_asignaciones || []).map(a => a.user_id))
      // Pre-select dispositivos
      const dispIds = []
      if (ticket.dispositivos?.id) dispIds.push(ticket.dispositivos.id)
      ;(ticket.dispositivos_extra || []).forEach(d => { if (d.id) dispIds.push(d.id) })
      setSelDispositivos(dispIds)
      // Load dispositivos and contacts for the empresa
      if (ticket.empresa_id) {
        getDispositivos(ticket.empresa_id).then(data => setDispositivos((data || []).filter(d => d.categoria !== 'correo'))).catch(() => setDispositivos([]))
        getEmpresas().then(data => {
          const list = Array.isArray(data) ? data : (data?.empresas || [])
          const emp = list.find(e => e.id === ticket.empresa_id)
          setEmpresaContactos((emp?.contactos || []).filter(c => c.nombre?.trim()))
        }).catch(() => setEmpresaContactos([]))
      }
    }
  }, [visible, ticket])

  function toggleDispositivo(id) {
    setSelDispositivos(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  function toggleOperario(id) {
    setSelOperarios(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  async function handleSave() {
    if (!form.asunto.trim()) { Alert.alert('Error', 'El asunto es obligatorio'); return }
    setSaving(true)
    try {
      await onSave({
        asunto: form.asunto.trim(),
        descripcion: form.descripcion.trim() || null,
        prioridad: form.prioridad,
        estado: form.estado,
        contacto_nombre: form.contacto_nombre || null,
        telefono_cliente: form.telefono_cliente || null,
        operarios: selOperarios,
        dispositivos_ids: selDispositivos,
      })
    } finally { setSaving(false) }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay }}>
        <View style={{ backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '92%', paddingBottom: 24 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text }}>Editar ticket #{ticket?.numero}</Text>
            <TouchableOpacity onPress={onClose}><Ionicons name="close" size={22} color={colors.textMuted} /></TouchableOpacity>
          </View>

          <ScrollView style={{ padding: 20 }} keyboardShouldPersistTaps="handled">
            {/* Asunto */}
            <View style={{ marginBottom: 14 }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textMuted, marginBottom: 6, textTransform: 'uppercase' }}>Asunto *</Text>
              <TextInput
                style={{ backgroundColor: colors.inputBg, borderWidth: 1.5, borderColor: colors.inputBorder, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: colors.text }}
                value={form.asunto}
                onChangeText={v => setForm(f => ({ ...f, asunto: v }))}
                placeholder="Describe el problema..."
                placeholderTextColor={colors.textMuted}
              />
            </View>

            {/* Descripción */}
            <View style={{ marginBottom: 14 }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textMuted, marginBottom: 6, textTransform: 'uppercase' }}>Descripción</Text>
              <TextInput
                style={{ backgroundColor: colors.inputBg, borderWidth: 1.5, borderColor: colors.inputBorder, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: colors.text, height: 80, textAlignVertical: 'top', paddingTop: 10 }}
                value={form.descripcion}
                onChangeText={v => setForm(f => ({ ...f, descripcion: v }))}
                placeholder="Detalles adicionales..."
                placeholderTextColor={colors.textMuted}
                multiline
              />
            </View>

            {/* Dispositivos */}
            {dispositivos.length > 0 && (
              <View style={{ marginBottom: 14 }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textMuted, marginBottom: 6, textTransform: 'uppercase' }}>Equipos</Text>
                <View style={{ gap: 6 }}>
                  {dispositivos.map(d => {
                    const sel = selDispositivos.includes(d.id)
                    return (
                      <TouchableOpacity
                        key={d.id}
                        onPress={() => toggleDispositivo(d.id)}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8, borderWidth: 1.5, borderColor: sel ? colors.primary : colors.border, backgroundColor: sel ? colors.primaryBg : colors.bg }}
                      >
                        <View style={{ width: 18, height: 18, borderRadius: 4, borderWidth: 1.5, borderColor: sel ? colors.primary : colors.border, backgroundColor: sel ? colors.primary : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                          {sel && <Ionicons name="checkmark" size={12} color="#fff" />}
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 13, fontWeight: '600', color: sel ? colors.primary : colors.text }}>{d.nombre}</Text>
                          {d.tipo ? <Text style={{ fontSize: 11, color: colors.textMuted }}>{d.tipo}</Text> : null}
                        </View>
                      </TouchableOpacity>
                    )
                  })}
                </View>
              </View>
            )}

            {/* Prioridad */}
            <View style={{ marginBottom: 14 }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textMuted, marginBottom: 6, textTransform: 'uppercase' }}>Prioridad</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {PRIORIDADES.map(p => (
                  <TouchableOpacity
                    key={p}
                    style={{ flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8, borderWidth: 1.5, borderColor: form.prioridad === p ? colors.primary : colors.border, backgroundColor: form.prioridad === p ? colors.primaryBg : colors.bg }}
                    onPress={() => setForm(f => ({ ...f, prioridad: p }))}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '700', color: form.prioridad === p ? colors.primary : colors.textMuted }}>{p}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Estado */}
            <View style={{ marginBottom: 14 }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textMuted, marginBottom: 6, textTransform: 'uppercase' }}>Estado</Text>
              <View style={{ gap: 6 }}>
                {ESTADOS.map(e => (
                  <TouchableOpacity
                    key={e}
                    style={{ paddingHorizontal: 14, paddingVertical: 9, borderRadius: 8, borderWidth: 1.5, borderColor: form.estado === e ? colors.primary : colors.border, backgroundColor: form.estado === e ? colors.primaryBg : colors.bg }}
                    onPress={() => setForm(f => ({ ...f, estado: e }))}
                  >
                    <Text style={{ fontSize: 13, fontWeight: '600', color: form.estado === e ? colors.primary : colors.text }}>{e}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Contacto */}
            {empresaContactos.length > 0 && (
              <View style={{ marginBottom: 14 }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textMuted, marginBottom: 6, textTransform: 'uppercase' }}>Contacto</Text>
                <View style={{ gap: 6 }}>
                  <TouchableOpacity
                    onPress={() => setForm(f => ({ ...f, contacto_nombre: null, telefono_cliente: null }))}
                    style={{ paddingHorizontal: 12, paddingVertical: 9, borderRadius: 8, borderWidth: 1.5, borderColor: !form.contacto_nombre ? colors.primary : colors.border, backgroundColor: !form.contacto_nombre ? colors.primaryBg : colors.bg }}
                  >
                    <Text style={{ fontSize: 13, color: !form.contacto_nombre ? colors.primary : colors.textMuted }}>Sin contacto</Text>
                  </TouchableOpacity>
                  {empresaContactos.map((c, i) => {
                    const sel = form.contacto_nombre === c.nombre
                    return (
                      <TouchableOpacity
                        key={i}
                        onPress={() => setForm(f => ({ ...f, contacto_nombre: c.nombre, telefono_cliente: c.telefono || null }))}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8, borderWidth: 1.5, borderColor: sel ? colors.primary : colors.border, backgroundColor: sel ? colors.primaryBg : colors.bg }}
                      >
                        <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: sel ? colors.primary : colors.border, alignItems: 'center', justifyContent: 'center' }}>
                          <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>{(c.nombre || '?').charAt(0).toUpperCase()}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 13, fontWeight: '600', color: sel ? colors.primary : colors.text }}>{c.nombre}</Text>
                          {c.cargo ? <Text style={{ fontSize: 11, color: colors.textMuted }}>{c.cargo}</Text> : null}
                        </View>
                        {c.telefono ? (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            <Ionicons name="call-outline" size={13} color={colors.textMuted} />
                            <Text style={{ fontSize: 12, color: colors.textMuted }}>{c.telefono}</Text>
                          </View>
                        ) : null}
                      </TouchableOpacity>
                    )
                  })}
                </View>
              </View>
            )}

            {/* Operarios */}
            {operarios.length > 0 && (
              <MultiSelectOperarios
                items={operarios}
                selectedIds={selOperarios}
                onToggle={toggleOperario}
                colors={colors}
              />
            )}
          </ScrollView>

          <View style={{ flexDirection: 'row', gap: 12, paddingHorizontal: 20, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border }}>
            <TouchableOpacity style={{ flex: 1, paddingVertical: 13, alignItems: 'center', borderRadius: 8, borderWidth: 1.5, borderColor: colors.border }} onPress={onClose}>
              <Text style={{ fontSize: 15, fontWeight: '600', color: colors.textMuted }}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={{ flex: 2, paddingVertical: 13, alignItems: 'center', borderRadius: 8, backgroundColor: colors.primary }} onPress={handleSave} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={{ fontSize: 15, fontWeight: '700', color: '#ffffff' }}>Guardar cambios</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  )
}
