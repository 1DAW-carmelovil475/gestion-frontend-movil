import { useState, useEffect, useCallback, useRef } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Alert, Modal, KeyboardAvoidingView,
  Platform, FlatList, Linking,
} from 'react-native'
import DateTimePicker from '@react-native-community/datetimepicker'
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
  updateEmpresa, createDispositivo,
  getUsuarios, updateUsuario,
  createTicketHoras, deleteTicketHoras,
} from '../services/api'

const ESTADOS    = ['Pendiente', 'En curso', 'Pausado', 'Completado', 'Pendiente de facturar', 'Facturado']
const PRIORIDADES = ['Baja', 'Media', 'Alta', 'Urgente']
const DEVICE_CATEGORIAS = [
  { key: 'equipo',   label: 'Equipos',    icon: 'desktop-outline' },
  { key: 'servidor', label: 'Servidores', icon: 'server-outline' },
  { key: 'nas',      label: 'NAS',        icon: 'save-outline' },
  { key: 'red',      label: 'Redes',      icon: 'wifi-outline' },
  { key: 'web',      label: 'Web',        icon: 'globe-outline' },
]
const DEVICE_TIPO_SUGERENCIAS = {
  equipo:   ['PC', 'Portátil', 'Cámara de Seguridad', 'Impresora', 'Tablet', 'All-in-One'],
  servidor: ['Servidor Físico', 'Servidor Virtual', 'Servidor de Archivos'],
  nas:      ['NAS Synology', 'NAS QNAP'],
  red:      ['Router', 'Switch', 'Access Point', 'Firewall', 'Modem'],
  web:      ['Web corporativa', 'Tienda online', 'Portal', 'Aplicación web'],
}

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
  const cfg = { 'Pendiente': { bg: colors.warningBg, txt: colors.warning }, 'En curso': { bg: colors.infoBg, txt: colors.info }, 'Pausado': { bg: '#f1f5f9', txt: '#64748b' }, 'Completado': { bg: colors.successBg, txt: colors.success }, 'Pendiente de facturar': { bg: colors.purpleBg, txt: colors.purple }, 'Facturado': { bg: colors.cyanBg, txt: colors.cyan } }
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
  const [empresas, setEmpresas]       = useState([])
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
  // Horas manuales
  const [horasInicio, setHorasInicio] = useState(new Date())
  const [horasFin, setHorasFin]       = useState(new Date())
  const [horasDesc, setHorasDesc]     = useState('')
  const [savingHoras, setSavingHoras] = useState(false)
  const [pickerVisible, setPickerVisible] = useState(null) // 'inicio' | 'fin' | null
  const [pickerMode, setPickerMode] = useState('date') // 'date' | 'time'
  const [pickerTemp, setPickerTemp] = useState(new Date())
  // File upload
  const [uploadingFiles, setUploadingFiles] = useState(false)
  const [commentFiles, setCommentFiles]     = useState([])
  const scrollRef = useRef(null)

  const loadAll = useCallback(async () => {
    try {
      const [t, c, o, emps] = await Promise.all([
        getTicket(initialTicket.id),
        getTicketComentarios(initialTicket.id),
        getOperarios(),
        getEmpresas(),
      ])
      setTicket(t)
      setNotasValue(t.notas || '')
      setComentarios(Array.isArray(c) ? c : [])
      setOperarios(Array.isArray(o) ? o : [])
      setEmpresas(Array.isArray(emps) ? emps : (emps?.empresas || []))
    } catch (e) { Alert.alert('Error', e.message) }
  }, [initialTicket.id])

  useEffect(() => {
    loadAll().finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const data = await getTicketComentarios(initialTicket.id)
        setComentarios(Array.isArray(data) ? data : [])
      } catch {}
    }, 5000)
    return () => clearInterval(interval)
  }, [initialTicket.id])

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

  // ── Horas manuales ──────────────────────────────────────────────────────
  function openPicker(field, mode) {
    setPickerTemp(field === 'inicio' ? horasInicio : horasFin)
    setPickerMode(mode)
    setPickerVisible(field)
  }
  function onPickerChange(event, selected) {
    if (event.type === 'dismissed' || !selected) { setPickerVisible(null); return }
    if (pickerMode === 'date') {
      // After picking date, open time picker
      setPickerTemp(selected)
      if (Platform.OS === 'android') {
        // On Android the picker auto-closes; reopen for time
        setPickerMode('time')
        // Keep pickerVisible so it re-renders as time picker
      } else {
        setPickerMode('time')
      }
    } else {
      // Commit the full datetime
      const merged = new Date(pickerTemp)
      merged.setHours(selected.getHours(), selected.getMinutes(), 0, 0)
      if (pickerVisible === 'inicio') setHorasInicio(merged)
      else setHorasFin(merged)
      setPickerVisible(null)
    }
  }

  async function handleAddHoras() {
    if (horasFin <= horasInicio) return Alert.alert('Error', 'La fecha fin debe ser posterior a la de inicio')
    setSavingHoras(true)
    try {
      await createTicketHoras(ticket.id, {
        fecha_inicio: horasInicio.toISOString(),
        fecha_fin: horasFin.toISOString(),
        descripcion: horasDesc || undefined,
      })
      const fresh = await getTicket(ticket.id)
      setTicket(fresh)
      setHorasInicio(new Date())
      setHorasFin(new Date())
      setHorasDesc('')
    } catch (e) { Alert.alert('Error', e.message) }
    setSavingHoras(false)
  }

  async function handleDeleteHoras(horaId) {
    Alert.alert('Eliminar', '¿Eliminar este registro de horas?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: async () => {
        try {
          await deleteTicketHoras(ticket.id, horaId)
          const fresh = await getTicket(ticket.id)
          setTicket(fresh)
        } catch (e) { Alert.alert('Error', e.message) }
      }},
    ])
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
          {(() => {
            const estadoCerrado = ['Completado', 'Pendiente de facturar', 'Facturado'].includes(ticket.estado)
            const pausado = ticket.estado === 'Pausado' || ticket.estado === 'Pendiente'
            const h = ticket.horas_totales > 0 ? ticket.horas_totales : (ticket.horas_transcurridas || 0)
            if (h <= 0 && !estadoCerrado) return null
            return (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: colors.badgeGray, borderRadius: 12 }}>
                <Ionicons name={estadoCerrado ? 'lock-closed-outline' : pausado ? 'pause-outline' : 'time-outline'} size={13} color={pausado ? '#64748b' : colors.textMuted} />
                <Text style={{ fontSize: 12, fontWeight: '600', color: pausado ? '#64748b' : colors.textMuted }}>{formatHoras(h)}</Text>
              </View>
            )
          })()}
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
            { key: 'horas',       label: 'Horas' },
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

        {/* ── HORAS tab ── */}
        {activeTab === 'horas' && (
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
            {/* Form */}
            <View style={{ backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 14, marginBottom: 16 }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text, marginBottom: 12 }}>Registrar horas</Text>

              {/* Inicio */}
              <View style={{ marginBottom: 10 }}>
                <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textMuted, marginBottom: 6 }}>Inicio</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity
                    onPress={() => openPicker('inicio', 'date')}
                    style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.inputBg, borderWidth: 1, borderColor: colors.inputBorder, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10 }}
                  >
                    <Ionicons name="calendar-outline" size={15} color={colors.textMuted} />
                    <Text style={{ fontSize: 13, color: colors.text }}>
                      {horasInicio.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => openPicker('inicio', 'time')}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.inputBg, borderWidth: 1, borderColor: colors.inputBorder, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10 }}
                  >
                    <Ionicons name="time-outline" size={15} color={colors.textMuted} />
                    <Text style={{ fontSize: 13, color: colors.text }}>
                      {horasInicio.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Fin */}
              <View style={{ marginBottom: 10 }}>
                <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textMuted, marginBottom: 6 }}>Fin</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity
                    onPress={() => openPicker('fin', 'date')}
                    style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.inputBg, borderWidth: 1, borderColor: colors.inputBorder, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10 }}
                  >
                    <Ionicons name="calendar-outline" size={15} color={colors.textMuted} />
                    <Text style={{ fontSize: 13, color: colors.text }}>
                      {horasFin.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => openPicker('fin', 'time')}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.inputBg, borderWidth: 1, borderColor: colors.inputBorder, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10 }}
                  >
                    <Ionicons name="time-outline" size={15} color={colors.textMuted} />
                    <Text style={{ fontSize: 13, color: colors.text }}>
                      {horasFin.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Duración preview */}
              {horasFin > horasInicio && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10, paddingHorizontal: 2 }}>
                  <Ionicons name="hourglass-outline" size={13} color={colors.primary} />
                  <Text style={{ fontSize: 12, color: colors.primary, fontWeight: '600' }}>
                    {formatHoras(Math.round((horasFin - horasInicio) / 36e5 * 100) / 100)}
                  </Text>
                </View>
              )}

              {/* Descripción */}
              <View style={{ marginBottom: 12 }}>
                <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textMuted, marginBottom: 6 }}>Descripción (opcional)</Text>
                <TextInput
                  style={{ backgroundColor: colors.inputBg, borderWidth: 1, borderColor: colors.inputBorder, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: colors.text }}
                  value={horasDesc}
                  onChangeText={setHorasDesc}
                  placeholder="Qué se hizo..."
                  placeholderTextColor={colors.textMuted}
                />
              </View>

              <TouchableOpacity
                onPress={handleAddHoras}
                disabled={savingHoras}
                style={{ backgroundColor: colors.primary, borderRadius: 8, paddingVertical: 11, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6, opacity: savingHoras ? 0.6 : 1 }}
              >
                <Ionicons name="add-circle-outline" size={16} color="#fff" />
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>{savingHoras ? 'Guardando...' : 'Añadir registro'}</Text>
              </TouchableOpacity>
            </View>

            {/* List */}
            {(ticket.ticket_horas || []).length === 0 ? (
              <View style={{ alignItems: 'center', paddingTop: 30, gap: 8 }}>
                <Ionicons name="time-outline" size={36} color={colors.textMuted} />
                <Text style={{ fontSize: 14, color: colors.textMuted }}>No hay horas registradas</Text>
              </View>
            ) : (
              <>
                {[...(ticket.ticket_horas || [])].sort((a, b) => a.fecha_inicio > b.fecha_inicio ? -1 : 1).map(h => {
                  const op = (ticket.ticket_asignaciones || []).find(a => a.user_id === h.user_id)
                  const ms = new Date(h.fecha_fin) - new Date(h.fecha_inicio)
                  const hrs = Math.round(ms / 36e5 * 100) / 100
                  const nombre = op?.profiles?.nombre || h.profiles?.nombre || '—'
                  const fmtDt = (iso) => new Date(iso).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
                  return (
                    <View key={h.id} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: 10, borderWidth: 1, borderColor: colors.border, padding: 12, marginBottom: 8, gap: 12 }}>
                      {/* Avatar */}
                      <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: getAvatarColor(h.user_id), alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>{getInitials(nombre)}</Text>
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        {/* Horas + nombre */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                          <Text style={{ fontSize: 15, fontWeight: '800', color: colors.primary }}>{formatHoras(hrs)}</Text>
                          <Text style={{ fontSize: 12, fontWeight: '600', color: colors.text }}>{nombre}</Text>
                        </View>
                        {/* Rango fechas */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                          <Ionicons name="arrow-forward-outline" size={10} color={colors.textMuted} />
                          <Text style={{ fontSize: 11, color: colors.textMuted }}>{fmtDt(h.fecha_inicio)}</Text>
                          <Text style={{ fontSize: 11, color: colors.textMuted, opacity: 0.5 }}>→</Text>
                          <Text style={{ fontSize: 11, color: colors.textMuted }}>{fmtDt(h.fecha_fin)}</Text>
                        </View>
                        {h.descripcion ? <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 1 }}>{h.descripcion}</Text> : null}
                      </View>
                      {h.user_id === user?.id && (
                        <TouchableOpacity onPress={() => handleDeleteHoras(h.id)} style={{ padding: 6 }}>
                          <Ionicons name="trash-outline" size={16} color={colors.danger} />
                        </TouchableOpacity>
                      )}
                    </View>
                  )
                })}
                {/* Total */}
                <View style={{ flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 8, paddingTop: 10, paddingHorizontal: 4, borderTopWidth: 1.5, borderTopColor: colors.border, marginTop: 4 }}>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textMuted }}>Total</Text>
                  <Text style={{ fontSize: 16, fontWeight: '800', color: colors.primary }}>
                    {formatHoras(Math.round((ticket.ticket_horas || []).reduce((s, h) => s + Math.max(0, (new Date(h.fecha_fin) - new Date(h.fecha_inicio)) / 36e5), 0) * 100) / 100)}
                  </Text>
                </View>
              </>
            )}
          </ScrollView>
        )}

        {/* ── DateTimePicker modal ── */}
        {pickerVisible && (
          <DateTimePicker
            value={pickerMode === 'time' ? pickerTemp : (pickerVisible === 'inicio' ? horasInicio : horasFin)}
            mode={pickerMode}
            is24Hour={true}
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={onPickerChange}
          />
        )}

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
              ListHeaderComponent={ticket.descripcion ? (
                <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginBottom: 14 }}>
                  <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: colors.border, alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Ionicons name="document-text-outline" size={16} color={colors.textMuted} />
                  </View>
                  <View style={{ flex: 1, maxWidth: '85%' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <Text style={{ fontSize: 12, fontWeight: '700', color: colors.text }}>Descripción del ticket</Text>
                      <Text style={{ fontSize: 11, color: colors.textMuted }}>{formatFecha(ticket.created_at)}</Text>
                    </View>
                    <View style={{ padding: 12, borderRadius: 12, backgroundColor: colors.inputBg, borderLeftWidth: 3, borderLeftColor: colors.border }}>
                      <Text style={{ fontSize: 13, color: colors.text, lineHeight: 19 }}>{ticket.descripcion}</Text>
                    </View>
                  </View>
                </View>
              ) : null}
              ListEmptyComponent={!ticket.descripcion ? (
                <View style={{ alignItems: 'center', paddingTop: 40, gap: 8 }}>
                  <Ionicons name="chatbubble-outline" size={36} color={colors.textMuted} />
                  <Text style={{ fontSize: 14, color: colors.textMuted }}>Sin comentarios</Text>
                </View>
              ) : null}
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
        empresas={empresas}
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

// ── CrearContactoModal ────────────────────────────────────────────────────────
function CrearContactoModal({ visible, empresaId, empresas, onClose, onSaved, colors }) {
  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')
  const [email, setEmail] = useState('')
  const [cargo, setCargo] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (visible) { setNombre(''); setTelefono(''); setEmail(''); setCargo('') }
  }, [visible])

  async function handleSave() {
    if (!nombre.trim()) { Alert.alert('Error', 'El nombre es obligatorio'); return }
    setSaving(true)
    try {
      const empresa = (Array.isArray(empresas) ? empresas : []).find(e => e.id === empresaId)
      const newContact = { nombre: nombre.trim(), telefono: telefono.trim() || null, email: email.trim() || null, cargo: cargo.trim() || null }
      const nuevosContactos = [...(empresa?.contactos || []), newContact]
      await updateEmpresa(empresaId, { ...empresa, contactos: nuevosContactos })
      onSaved(newContact, nuevosContactos)
    } catch (e) { Alert.alert('Error', e.message) }
    finally { setSaving(false) }
  }

  const inp = { backgroundColor: colors.inputBg, borderWidth: 1.5, borderColor: colors.inputBorder, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: colors.text }
  const lbl = { fontSize: 11, fontWeight: '700', color: colors.textMuted, marginBottom: 6, textTransform: 'uppercase' }

  if (!visible) return null
  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'flex-end', backgroundColor: colors.overlay, zIndex: 999 }}>
      <View style={{ backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '80%', paddingBottom: 24 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderBottomColor: colors.border }}>
          <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text }}>Nuevo contacto</Text>
          <TouchableOpacity onPress={onClose}><Ionicons name="close" size={22} color={colors.textMuted} /></TouchableOpacity>
        </View>
        <ScrollView style={{ padding: 20 }} keyboardShouldPersistTaps="handled">
          <View style={{ marginBottom: 14 }}><Text style={lbl}>Nombre *</Text><TextInput style={inp} value={nombre} onChangeText={setNombre} placeholder="Nombre del contacto" placeholderTextColor={colors.textMuted} /></View>
          <View style={{ marginBottom: 14 }}><Text style={lbl}>Teléfono</Text><TextInput style={inp} value={telefono} onChangeText={setTelefono} placeholder="612 345 678" placeholderTextColor={colors.textMuted} keyboardType="phone-pad" /></View>
          <View style={{ marginBottom: 14 }}><Text style={lbl}>Email</Text><TextInput style={inp} value={email} onChangeText={setEmail} placeholder="contacto@empresa.com" placeholderTextColor={colors.textMuted} keyboardType="email-address" autoCapitalize="none" /></View>
          <View style={{ marginBottom: 14 }}><Text style={lbl}>Cargo</Text><TextInput style={inp} value={cargo} onChangeText={setCargo} placeholder="Ej: Responsable IT, Gerente..." placeholderTextColor={colors.textMuted} /></View>
        </ScrollView>
        <View style={{ flexDirection: 'row', gap: 12, paddingHorizontal: 20, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border }}>
          <TouchableOpacity style={{ flex: 1, paddingVertical: 13, alignItems: 'center', borderRadius: 8, borderWidth: 1.5, borderColor: colors.border }} onPress={onClose}>
            <Text style={{ fontSize: 15, fontWeight: '600', color: colors.textMuted }}>Cancelar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={{ flex: 2, paddingVertical: 13, alignItems: 'center', borderRadius: 8, backgroundColor: colors.primary, opacity: saving ? 0.7 : 1 }} onPress={handleSave} disabled={saving}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: '#ffffff' }}>{saving ? 'Guardando...' : 'Guardar contacto'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  )
}

// ── EditarContactoModal ───────────────────────────────────────────────────────
function EditarContactoModal({ visible, empresaId, empresas, contacto, onClose, onSaved, colors }) {
  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')
  const [email, setEmail] = useState('')
  const [cargo, setCargo] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (visible && contacto) {
      setNombre(contacto.nombre || '')
      setTelefono(contacto.telefono || '')
      setEmail(contacto.email || '')
      setCargo(contacto.cargo || '')
    }
  }, [visible, contacto])

  async function handleSave() {
    if (!nombre.trim()) { Alert.alert('Error', 'El nombre es obligatorio'); return }
    setSaving(true)
    try {
      const empresa = (Array.isArray(empresas) ? empresas : []).find(e => e.id === empresaId)
      const updatedContacto = { nombre: nombre.trim(), telefono: telefono.trim() || null, email: email.trim() || null, cargo: cargo.trim() || null }
      const nuevosContactos = (empresa?.contactos || []).map(c => c.nombre === contacto.nombre ? updatedContacto : c)
      await updateEmpresa(empresaId, { ...empresa, contactos: nuevosContactos })
      onSaved(updatedContacto, nuevosContactos)
    } catch (e) { Alert.alert('Error', e.message) }
    finally { setSaving(false) }
  }

  const inp = { backgroundColor: colors.inputBg, borderWidth: 1.5, borderColor: colors.inputBorder, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: colors.text }
  const lbl = { fontSize: 11, fontWeight: '700', color: colors.textMuted, marginBottom: 6, textTransform: 'uppercase' }

  if (!visible) return null
  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'flex-end', backgroundColor: colors.overlay, zIndex: 999 }}>
      <View style={{ backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '80%', paddingBottom: 24 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderBottomColor: colors.border }}>
          <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text }}>Editar contacto</Text>
          <TouchableOpacity onPress={onClose}><Ionicons name="close" size={22} color={colors.textMuted} /></TouchableOpacity>
        </View>
        <ScrollView style={{ padding: 20 }} keyboardShouldPersistTaps="handled">
          <View style={{ marginBottom: 14 }}><Text style={lbl}>Nombre *</Text><TextInput style={inp} value={nombre} onChangeText={setNombre} placeholder="Nombre del contacto" placeholderTextColor={colors.textMuted} /></View>
          <View style={{ marginBottom: 14 }}><Text style={lbl}>Teléfono</Text><TextInput style={inp} value={telefono} onChangeText={setTelefono} placeholder="612 345 678" placeholderTextColor={colors.textMuted} keyboardType="phone-pad" /></View>
          <View style={{ marginBottom: 14 }}><Text style={lbl}>Email</Text><TextInput style={inp} value={email} onChangeText={setEmail} placeholder="contacto@empresa.com" placeholderTextColor={colors.textMuted} keyboardType="email-address" autoCapitalize="none" /></View>
          <View style={{ marginBottom: 14 }}><Text style={lbl}>Cargo</Text><TextInput style={inp} value={cargo} onChangeText={setCargo} placeholder="Ej: Responsable IT, Gerente..." placeholderTextColor={colors.textMuted} /></View>
        </ScrollView>
        <View style={{ flexDirection: 'row', gap: 12, paddingHorizontal: 20, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border }}>
          <TouchableOpacity style={{ flex: 1, paddingVertical: 13, alignItems: 'center', borderRadius: 8, borderWidth: 1.5, borderColor: colors.border }} onPress={onClose}>
            <Text style={{ fontSize: 15, fontWeight: '600', color: colors.textMuted }}>Cancelar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={{ flex: 2, paddingVertical: 13, alignItems: 'center', borderRadius: 8, backgroundColor: colors.primary, opacity: saving ? 0.7 : 1 }} onPress={handleSave} disabled={saving}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: '#ffffff' }}>{saving ? 'Guardando...' : 'Guardar cambios'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  )
}

// ── AñadirDispositivoModal ────────────────────────────────────────────────────
function AñadirDispositivoModal({ visible, empresaId, onClose, onSaved, colors }) {
  const [step, setStep] = useState('select')
  const [categoria, setCategoria] = useState('')
  const [form, setForm] = useState({})
  const [extraFields, setExtraFields] = useState([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (visible) { setStep('select'); setCategoria(''); setForm({}); setExtraFields([]) }
  }, [visible])

  function f(key) { return form[key] || '' }
  function setF(key, val) { setForm(prev => ({ ...prev, [key]: val })) }

  async function handleSave() {
    if (!f('nombre').trim()) { Alert.alert('Error', 'El nombre es obligatorio'); return }
    if (categoria === 'equipo' && !f('numero_serie').trim()) { Alert.alert('Error', 'El número de serie es obligatorio'); return }
    const campos_extra = {}
    extraFields.forEach(({ key, val }) => { if (key.trim()) campos_extra[key.trim()] = val })
    setSaving(true)
    try {
      const payload = { ...form, empresa_id: empresaId, categoria, campos_extra }
      const newDevice = await createDispositivo(payload)
      onSaved(newDevice)
    } catch (e) { Alert.alert('Error', e.message) }
    finally { setSaving(false) }
  }

  const inp = { backgroundColor: colors.inputBg, borderWidth: 1.5, borderColor: colors.inputBorder, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: colors.text }
  const lbl = { fontSize: 11, fontWeight: '700', color: colors.textMuted, marginBottom: 6, textTransform: 'uppercase' }
  const sugerencias = DEVICE_TIPO_SUGERENCIAS[categoria] || []

  if (!visible) return null
  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'flex-end', backgroundColor: colors.overlay, zIndex: 999 }}>
      <View style={{ backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '90%', paddingBottom: 24 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderBottomColor: colors.border }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            {step === 'form' && <TouchableOpacity onPress={() => setStep('select')}><Ionicons name="arrow-back" size={22} color={colors.primary} /></TouchableOpacity>}
            <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text }}>{step === 'select' ? 'Añadir dispositivo' : DEVICE_CATEGORIAS.find(c => c.key === categoria)?.label || 'Dispositivo'}</Text>
          </View>
          <TouchableOpacity onPress={onClose}><Ionicons name="close" size={22} color={colors.textMuted} /></TouchableOpacity>
        </View>
        {step === 'select' ? (
          <View style={{ padding: 20 }}>
            <Text style={{ fontSize: 13, color: colors.textMuted, marginBottom: 16 }}>Selecciona el tipo de dispositivo:</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
              {DEVICE_CATEGORIAS.map(cat => (
                <TouchableOpacity key={cat.key} onPress={() => { setCategoria(cat.key); setForm({}); setExtraFields([]); setStep('form') }} style={{ width: '45%', paddingVertical: 18, alignItems: 'center', gap: 8, borderRadius: 12, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.bg }}>
                  <Ionicons name={cat.icon} size={28} color={colors.primary} />
                  <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text }}>{cat.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : (
          <ScrollView style={{ padding: 20 }} keyboardShouldPersistTaps="handled">
            <View style={{ marginBottom: 14 }}><Text style={lbl}>Nombre *</Text><TextInput style={inp} value={f('nombre')} onChangeText={v => setF('nombre', v)} placeholder="Nombre del dispositivo" placeholderTextColor={colors.textMuted} /></View>
            <View style={{ marginBottom: 14 }}>
              <Text style={lbl}>Tipo</Text>
              <TextInput style={{ ...inp, marginBottom: sugerencias.length ? 8 : 0 }} value={f('tipo')} onChangeText={v => setF('tipo', v)} placeholder="Selecciona o escribe..." placeholderTextColor={colors.textMuted} />
              {sugerencias.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    {sugerencias.map(s => (
                      <TouchableOpacity key={s} onPress={() => setF('tipo', s)} style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1.5, borderColor: f('tipo') === s ? colors.primary : colors.border, backgroundColor: f('tipo') === s ? colors.primaryBg : colors.bg }}>
                        <Text style={{ fontSize: 12, fontWeight: '600', color: f('tipo') === s ? colors.primary : colors.textMuted }}>{s}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              )}
            </View>
            {categoria === 'equipo' && (<>
              <View style={{ marginBottom: 14 }}><Text style={lbl}>Número de Serie *</Text><TextInput style={inp} value={f('numero_serie')} onChangeText={v => setF('numero_serie', v)} placeholder="Ej: SN-2024-ABC123" placeholderTextColor={colors.textMuted} autoCapitalize="characters" /></View>
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
                <View style={{ flex: 1 }}><Text style={lbl}>IP</Text><TextInput style={inp} value={f('ip')} onChangeText={v => setF('ip', v)} placeholder="192.168.1.10" placeholderTextColor={colors.textMuted} keyboardType="decimal-pad" /></View>
                <View style={{ flex: 1 }}><Text style={lbl}>AnyDesk ID</Text><TextInput style={inp} value={f('anydesk_id')} onChangeText={v => setF('anydesk_id', v)} placeholder="123456789" placeholderTextColor={colors.textMuted} keyboardType="numeric" /></View>
              </View>
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
                <View style={{ flex: 1 }}><Text style={lbl}>Usuario</Text><TextInput style={inp} value={f('usuario')} onChangeText={v => setF('usuario', v)} placeholder="admin" placeholderTextColor={colors.textMuted} autoCapitalize="none" /></View>
                <View style={{ flex: 1 }}><Text style={lbl}>Contraseña</Text><TextInput style={inp} value={f('password')} onChangeText={v => setF('password', v)} placeholder="••••••••" placeholderTextColor={colors.textMuted} autoCapitalize="none" /></View>
              </View>
            </>)}
            {categoria === 'servidor' && (
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
                <View style={{ flex: 1 }}><Text style={lbl}>IP</Text><TextInput style={inp} value={f('ip')} onChangeText={v => setF('ip', v)} placeholder="192.168.1.5" placeholderTextColor={colors.textMuted} keyboardType="decimal-pad" /></View>
                <View style={{ flex: 1 }}><Text style={lbl}>Usuario</Text><TextInput style={inp} value={f('usuario')} onChangeText={v => setF('usuario', v)} placeholder="admin" placeholderTextColor={colors.textMuted} autoCapitalize="none" /></View>
              </View>
            )}
            <View style={{ borderTopWidth: 1, borderTopColor: colors.border, marginTop: 4, paddingTop: 14, marginBottom: 14 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <Text style={lbl}>Campos personalizados</Text>
                <TouchableOpacity onPress={() => setExtraFields(prev => [...prev, { key: '', val: '' }])} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, borderWidth: 1, borderColor: colors.border }}>
                  <Ionicons name="add" size={14} color={colors.primary} />
                  <Text style={{ fontSize: 12, fontWeight: '600', color: colors.primary }}>Añadir</Text>
                </TouchableOpacity>
              </View>
              {extraFields.map((ef, i) => (
                <View key={i} style={{ flexDirection: 'row', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                  <TextInput style={{ ...inp, flex: 1 }} value={ef.key} onChangeText={v => { const u = [...extraFields]; u[i] = { ...u[i], key: v }; setExtraFields(u) }} placeholder="Campo" placeholderTextColor={colors.textMuted} />
                  <TextInput style={{ ...inp, flex: 1 }} value={ef.val} onChangeText={v => { const u = [...extraFields]; u[i] = { ...u[i], val: v }; setExtraFields(u) }} placeholder="Valor" placeholderTextColor={colors.textMuted} />
                  <TouchableOpacity onPress={() => setExtraFields(prev => prev.filter((_, j) => j !== i))} style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: '#fee2e2', alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="close" size={16} color="#b91c1c" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </ScrollView>
        )}
        {step === 'form' && (
          <View style={{ flexDirection: 'row', gap: 12, paddingHorizontal: 20, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border }}>
            <TouchableOpacity style={{ flex: 1, paddingVertical: 13, alignItems: 'center', borderRadius: 8, borderWidth: 1.5, borderColor: colors.border }} onPress={onClose}>
              <Text style={{ fontSize: 15, fontWeight: '600', color: colors.textMuted }}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={{ flex: 2, paddingVertical: 13, alignItems: 'center', borderRadius: 8, backgroundColor: colors.primary, opacity: saving ? 0.7 : 1 }} onPress={handleSave} disabled={saving}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: '#ffffff' }}>{saving ? 'Guardando...' : 'Guardar dispositivo'}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  )
}

// ── EmpresaPickerModal ─────────────────────────────────────────────────────────
function EmpresaPickerModal({ visible, empresas, selectedId, onSelect, onClose, colors }) {
  const [query, setQuery] = useState('')
  useEffect(() => { if (visible) setQuery('') }, [visible])
  const filtered = query.trim() ? empresas.filter(e => e.nombre?.toLowerCase().includes(query.toLowerCase())) : empresas
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.headerBg }}>
          <TouchableOpacity onPress={onClose} style={{ padding: 4 }}>
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text, flex: 1 }}>Seleccionar empresa</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, margin: 14, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5, borderColor: colors.inputBorder, backgroundColor: colors.inputBg }}>
          <Ionicons name="search-outline" size={16} color={colors.textMuted} />
          <TextInput style={{ flex: 1, fontSize: 14, color: colors.text }} placeholder="Buscar empresa..." placeholderTextColor={colors.textMuted} value={query} onChangeText={setQuery} autoFocus />
          {query ? <TouchableOpacity onPress={() => setQuery('')}><Ionicons name="close-circle" size={16} color={colors.textMuted} /></TouchableOpacity> : null}
        </View>
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => {
            const sel = item.id === selectedId
            return (
              <TouchableOpacity onPress={() => { onSelect(item.id); onClose() }} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: sel ? colors.primaryBg : 'transparent' }}>
                <Text style={{ flex: 1, fontSize: 15, color: sel ? colors.primary : colors.text, fontWeight: sel ? '700' : '400' }}>{item.nombre}</Text>
                {sel && <Ionicons name="checkmark" size={18} color={colors.primary} />}
              </TouchableOpacity>
            )
          }}
          ListEmptyComponent={<View style={{ paddingTop: 40, alignItems: 'center' }}><Text style={{ color: colors.textMuted, fontSize: 14 }}>Sin resultados</Text></View>}
        />
      </View>
    </Modal>
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
      {/* Inline dropdown */}
      {open && (
        <View style={{ borderWidth: 1.5, borderColor: colors.inputBorder, borderRadius: 8, marginTop: 4, backgroundColor: colors.card, overflow: 'hidden' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <Ionicons name="search-outline" size={15} color={colors.textMuted} />
            <TextInput style={{ flex: 1, fontSize: 13, color: colors.text }} placeholder="Buscar operario..." placeholderTextColor={colors.textMuted} value={query} onChangeText={setQuery} />
            {query ? <TouchableOpacity onPress={() => setQuery('')}><Ionicons name="close-circle" size={15} color={colors.textMuted} /></TouchableOpacity> : null}
          </View>
          {filtered.length === 0 ? (
            <View style={{ paddingVertical: 16, alignItems: 'center' }}><Text style={{ color: colors.textMuted, fontSize: 13 }}>Sin resultados</Text></View>
          ) : (
            filtered.map((item, idx) => {
              const sel = selectedIds.includes(item.id)
              return (
                <TouchableOpacity key={item.id} onPress={() => onToggle(item.id)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: idx < filtered.length - 1 ? 1 : 0, borderBottomColor: colors.border, backgroundColor: sel ? colors.primaryBg : 'transparent' }}>
                  <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: avColor(item.id), alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 10, color: '#fff', fontWeight: '700' }}>{inits(item.nombre)}</Text>
                  </View>
                  <Text style={{ flex: 1, fontSize: 13, color: sel ? colors.primary : colors.text, fontWeight: sel ? '700' : '400' }} numberOfLines={1}>{item.nombre}</Text>
                  {sel && <Ionicons name="checkmark-circle" size={18} color={colors.primary} />}
                </TouchableOpacity>
              )
            })
          )}
          <TouchableOpacity onPress={() => { setOpen(false); setQuery('') }} style={{ margin: 10, paddingVertical: 10, alignItems: 'center', borderRadius: 8, backgroundColor: colors.primary }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#fff' }}>{selectedIds.length > 0 ? `Confirmar (${selectedIds.length})` : 'Cerrar'}</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  )
}

// ── EditTicketModal ────────────────────────────────────────────────────────────
function EditTicketModal({ visible, ticket, operarios, empresas, onClose, onSave, colors }) {
  const insets = useSafeAreaInsets()
  const [form, setForm] = useState({
    empresa_id: '', asunto: '', descripcion: '',
    prioridad: 'Media', estado: 'Pendiente',
    contacto_nombre: null, telefono_cliente: null,
  })
  const [selOperarios, setSelOperarios] = useState([])
  const [selDispositivos, setSelDispositivos] = useState([])
  const [dispositivos, setDispositivos] = useState([])
  const [localContactos, setLocalContactos] = useState([])
  const [dispSearch, setDispSearch] = useState('')
  const [showCrearContacto, setShowCrearContacto] = useState(false)
  const [showEditarContacto, setShowEditarContacto] = useState(false)
  const [showAñadirDisp, setShowAñadirDisp] = useState(false)
  const [showEmpresaPicker, setShowEmpresaPicker] = useState(false)
  const [empresaQuery, setEmpresaQuery] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (visible && ticket) {
      const dispIds = ticket.dispositivos_ids?.length
        ? ticket.dispositivos_ids
        : (ticket.dispositivo_id ? [ticket.dispositivo_id] : [])
      setForm({
        empresa_id: ticket.empresa_id || '',
        asunto: ticket.asunto || '',
        descripcion: ticket.descripcion || '',
        prioridad: ticket.prioridad || 'Media',
        estado: ticket.estado || 'Pendiente',
        contacto_nombre: ticket.contacto_nombre || null,
        telefono_cliente: ticket.telefono_cliente || null,
      })
      setSelOperarios((ticket.ticket_asignaciones || []).map(a => a.user_id))
      setSelDispositivos(dispIds)
      setDispSearch('')
      const emp = (Array.isArray(empresas) ? empresas : []).find(e => e.id === ticket.empresa_id)
      setLocalContactos((emp?.contactos || []).filter(c => c.nombre?.trim()))
      if (ticket.empresa_id) {
        getDispositivos(ticket.empresa_id)
          .then(data => setDispositivos((data || []).filter(d => d.categoria !== 'correo')))
          .catch(() => setDispositivos([]))
      } else {
        setDispositivos([])
      }
    }
  }, [visible, ticket])

  function onChangeEmpresa(id) {
    const emp = (Array.isArray(empresas) ? empresas : []).find(e => e.id === id)
    setLocalContactos((emp?.contactos || []).filter(c => c.nombre?.trim()))
    setForm(f => ({ ...f, empresa_id: id, contacto_nombre: null, telefono_cliente: null }))
    setSelDispositivos([])
    setDispSearch('')
    if (id) {
      getDispositivos(id)
        .then(data => setDispositivos((data || []).filter(d => d.categoria !== 'correo')))
        .catch(() => setDispositivos([]))
    } else {
      setDispositivos([])
    }
  }

  function toggleDispositivo(id) {
    setSelDispositivos(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  function toggleOperario(id) {
    setSelOperarios(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  async function handleSave() {
    if (!form.empresa_id) { Alert.alert('Error', 'Selecciona una empresa'); return }
    if (!form.asunto.trim()) { Alert.alert('Error', 'El asunto es obligatorio'); return }
    setSaving(true)
    try {
      await onSave({ ...form, operarios: selOperarios, dispositivos_ids: selDispositivos })
    } finally { setSaving(false) }
  }

  const filteredDisps = dispSearch.trim()
    ? dispositivos.filter(d => d.nombre?.toLowerCase().includes(dispSearch.toLowerCase()) || (d.tipo || '').toLowerCase().includes(dispSearch.toLowerCase()))
    : dispositivos

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay }}>
        <View style={{ backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '92%', paddingBottom: 24 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text }}>Editar ticket #{ticket?.numero}</Text>
            <TouchableOpacity onPress={onClose}><Ionicons name="close" size={22} color={colors.textMuted} /></TouchableOpacity>
          </View>

          <ScrollView style={{ padding: 20 }} keyboardShouldPersistTaps="handled">
            {/* Empresa */}
            <View style={{ marginBottom: 14 }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textMuted, marginBottom: 6, textTransform: 'uppercase' }}>Empresa *</Text>
              <TouchableOpacity
                onPress={() => { setEmpresaQuery(''); setShowEmpresaPicker(true) }}
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.inputBg, borderWidth: 1.5, borderColor: form.empresa_id ? colors.primary : colors.inputBorder, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 12 }}
              >
                <Text style={{ fontSize: 14, color: form.empresa_id ? colors.text : colors.textMuted, flex: 1 }} numberOfLines={1}>
                  {form.empresa_id ? ((Array.isArray(empresas) ? empresas : []).find(e => e.id === form.empresa_id)?.nombre || 'Empresa seleccionada') : 'Seleccionar empresa...'}
                </Text>
                <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            {/* Contacto */}
            {form.empresa_id && (
              <View style={{ marginBottom: 14 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase' }}>Contacto</Text>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    {form.contacto_nombre && (
                      <TouchableOpacity
                        onPress={() => setShowEditarContacto(true)}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, borderWidth: 1, borderColor: colors.textMuted }}
                      >
                        <Ionicons name="pencil-outline" size={13} color={colors.textMuted} />
                        <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textMuted }}>Editar contacto</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      onPress={() => setShowCrearContacto(true)}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, borderWidth: 1, borderColor: colors.primary }}
                    >
                      <Ionicons name="person-add-outline" size={13} color={colors.primary} />
                      <Text style={{ fontSize: 12, fontWeight: '600', color: colors.primary }}>Crear contacto</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                {localContactos.length === 0 ? (
                  <Text style={{ fontSize: 12, color: colors.textMuted }}>Esta empresa no tiene contactos registrados.</Text>
                ) : (
                  <View style={{ gap: 6 }}>
                    <TouchableOpacity
                      onPress={() => setForm(f => ({ ...f, contacto_nombre: null, telefono_cliente: null }))}
                      style={{ paddingHorizontal: 14, paddingVertical: 9, borderRadius: 8, borderWidth: 1.5, borderColor: !form.contacto_nombre ? colors.primary : colors.border, backgroundColor: !form.contacto_nombre ? colors.primaryBg : colors.bg }}
                    >
                      <Text style={{ fontSize: 13, fontWeight: '600', color: !form.contacto_nombre ? colors.primary : colors.textMuted }}>Sin contacto</Text>
                    </TouchableOpacity>
                    {localContactos.map((c, i) => {
                      const sel = form.contacto_nombre === c.nombre
                      return (
                        <TouchableOpacity
                          key={i}
                          onPress={() => setForm(f => ({ ...f, contacto_nombre: c.nombre, telefono_cliente: c.telefono || null }))}
                          style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8, borderWidth: 1.5, borderColor: sel ? colors.primary : colors.border, backgroundColor: sel ? colors.primaryBg : colors.bg }}
                        >
                          <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: sel ? colors.primary : colors.badgeGray, alignItems: 'center', justifyContent: 'center' }}>
                            <Text style={{ fontSize: 12, fontWeight: '700', color: sel ? '#fff' : colors.textMuted }}>{(c.nombre || '?').charAt(0).toUpperCase()}</Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 13, fontWeight: '600', color: sel ? colors.primary : colors.text }}>{c.nombre}</Text>
                            {c.cargo ? <Text style={{ fontSize: 11, color: colors.textMuted }}>{c.cargo}</Text> : null}
                          </View>
                          {c.telefono ? (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                              <Ionicons name="call-outline" size={12} color={sel ? colors.primary : colors.textMuted} />
                              <Text style={{ fontSize: 12, color: sel ? colors.primary : colors.textMuted }}>{c.telefono}</Text>
                            </View>
                          ) : null}
                        </TouchableOpacity>
                      )
                    })}
                  </View>
                )}
              </View>
            )}

            {/* Dispositivos */}
            {form.empresa_id && (
              <View style={{ marginBottom: 14 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase' }}>Equipos</Text>
                  <TouchableOpacity
                    onPress={() => setShowAñadirDisp(true)}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, borderWidth: 1, borderColor: colors.primary }}
                  >
                    <Ionicons name="add-outline" size={13} color={colors.primary} />
                    <Text style={{ fontSize: 12, fontWeight: '600', color: colors.primary }}>Añadir dispositivo</Text>
                  </TouchableOpacity>
                </View>
                {dispositivos.length > 0 && (
                  <TextInput
                    style={{ backgroundColor: colors.inputBg, borderWidth: 1.5, borderColor: colors.inputBorder, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, fontSize: 13, color: colors.text, marginBottom: 8 }}
                    value={dispSearch}
                    onChangeText={setDispSearch}
                    placeholder="Buscar dispositivo..."
                    placeholderTextColor={colors.textMuted}
                  />
                )}
                {filteredDisps.length === 0 && dispositivos.length === 0 ? (
                  <Text style={{ fontSize: 12, color: colors.textMuted }}>Esta empresa no tiene dispositivos registrados.</Text>
                ) : filteredDisps.length === 0 ? (
                  <Text style={{ fontSize: 12, color: colors.textMuted }}>Sin resultados</Text>
                ) : (
                  <View style={{ gap: 6 }}>
                    {filteredDisps.map(d => {
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
                )}
                {selDispositivos.length > 0 && (
                  <TouchableOpacity onPress={() => setSelDispositivos([])} style={{ marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Ionicons name="close-circle-outline" size={14} color={colors.textMuted} />
                    <Text style={{ fontSize: 12, color: colors.textMuted }}>{selDispositivos.length} seleccionado{selDispositivos.length > 1 ? 's' : ''} · Limpiar</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* Asunto */}
            <View style={{ marginBottom: 14 }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textMuted, marginBottom: 6, textTransform: 'uppercase' }}>Asunto *</Text>
              <TextInput
                style={{ backgroundColor: colors.inputBg, borderWidth: 1.5, borderColor: colors.inputBorder, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: colors.text }}
                value={form.asunto}
                onChangeText={v => setForm(f => ({ ...f, asunto: v }))}
                placeholderTextColor={colors.textMuted}
              />
            </View>

            {/* Descripcion */}
            <View style={{ marginBottom: 14 }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textMuted, marginBottom: 6, textTransform: 'uppercase' }}>Descripción</Text>
              <TextInput
                style={{ backgroundColor: colors.inputBg, borderWidth: 1.5, borderColor: colors.inputBorder, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: colors.text, height: 80, textAlignVertical: 'top', paddingTop: 10 }}
                value={form.descripcion}
                onChangeText={v => setForm(f => ({ ...f, descripcion: v }))}
                placeholderTextColor={colors.textMuted}
                multiline
              />
            </View>

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

        <CrearContactoModal
          visible={showCrearContacto}
          empresaId={form.empresa_id}
          empresas={empresas}
          onClose={() => setShowCrearContacto(false)}
          onSaved={(newContact, allContacts) => {
            setLocalContactos(allContacts.filter(c => c.nombre?.trim()))
            setForm(f => ({ ...f, contacto_nombre: newContact.nombre, telefono_cliente: newContact.telefono || null }))
            setShowCrearContacto(false)
          }}
          colors={colors}
        />
        <EditarContactoModal
          visible={showEditarContacto}
          empresaId={form.empresa_id}
          empresas={empresas}
          contacto={localContactos.find(c => c.nombre === form.contacto_nombre) || null}
          onClose={() => setShowEditarContacto(false)}
          onSaved={(updatedContact, allContacts) => {
            setLocalContactos(allContacts.filter(c => c.nombre?.trim()))
            setForm(f => ({ ...f, contacto_nombre: updatedContact.nombre, telefono_cliente: updatedContact.telefono || null }))
            setShowEditarContacto(false)
          }}
          colors={colors}
        />
        <AñadirDispositivoModal
          visible={showAñadirDisp}
          empresaId={form.empresa_id}
          onClose={() => setShowAñadirDisp(false)}
          onSaved={newDevice => {
            setDispositivos(prev => [...prev, newDevice])
            setSelDispositivos(prev => [...prev, newDevice.id])
            setShowAñadirDisp(false)
          }}
          colors={colors}
        />

        {/* Empresa picker — inline overlay dentro del mismo Modal */}
        {showEmpresaPicker && (
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.bg, paddingTop: insets.top }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.headerBg }}>
              <TouchableOpacity onPress={() => setShowEmpresaPicker(false)} style={{ padding: 4 }}>
                <Ionicons name="arrow-back" size={22} color={colors.text} />
              </TouchableOpacity>
              <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text, flex: 1 }}>Seleccionar empresa</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, margin: 14, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5, borderColor: colors.inputBorder, backgroundColor: colors.inputBg }}>
              <Ionicons name="search-outline" size={16} color={colors.textMuted} />
              <TextInput style={{ flex: 1, fontSize: 14, color: colors.text }} placeholder="Buscar empresa..." placeholderTextColor={colors.textMuted} value={empresaQuery} onChangeText={setEmpresaQuery} autoFocus />
              {empresaQuery ? <TouchableOpacity onPress={() => setEmpresaQuery('')}><Ionicons name="close-circle" size={16} color={colors.textMuted} /></TouchableOpacity> : null}
            </View>
            <FlatList
              data={(Array.isArray(empresas) ? empresas : []).filter(e => !empresaQuery.trim() || e.nombre?.toLowerCase().includes(empresaQuery.toLowerCase()))}
              keyExtractor={item => item.id}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => {
                const sel = item.id === form.empresa_id
                return (
                  <TouchableOpacity
                    onPress={() => { onChangeEmpresa(item.id); setShowEmpresaPicker(false) }}
                    style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: sel ? colors.primaryBg : 'transparent' }}
                  >
                    <Text style={{ flex: 1, fontSize: 15, color: sel ? colors.primary : colors.text, fontWeight: sel ? '700' : '400' }}>{item.nombre}</Text>
                    {sel && <Ionicons name="checkmark" size={18} color={colors.primary} />}
                  </TouchableOpacity>
                )
              }}
              ListEmptyComponent={<View style={{ paddingTop: 40, alignItems: 'center' }}><Text style={{ color: colors.textMuted }}>Sin resultados</Text></View>}
            />
          </View>
        )}
      </View>
    </Modal>
  )
}
