import { useState, useEffect, useCallback, useRef } from 'react'
import {
  View, Text, StyleSheet, ScrollView, FlatList, TouchableOpacity,
  TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import {
  getTicket, getTicketComentarios, createTicketComentario, getArchivoUrl,
} from '../services/api'

function formatFecha(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function formatFechaCorta(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
}

function EstadoBadge({ estado, colors }) {
  const cfg = {
    'Pendiente':             { bg: colors.warningBg,  txt: colors.warning },
    'En curso':              { bg: colors.infoBg,     txt: colors.info },
    'Completado':            { bg: colors.successBg,  txt: colors.success },
    'Pendiente de facturar': { bg: colors.purpleBg,   txt: colors.purple },
    'Facturado':             { bg: colors.cyanBg,     txt: colors.cyan },
  }
  const c = cfg[estado] || { bg: colors.badgeGray, txt: colors.textMuted }
  return <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, backgroundColor: c.bg }}><Text style={{ fontSize: 12, fontWeight: '700', color: c.txt }}>{estado}</Text></View>
}

function PrioridadBadge({ prioridad, colors }) {
  const cfg = {
    Urgente: { bg: colors.dangerBg, txt: colors.danger },
    Alta:    { bg: colors.warningBg, txt: colors.warning },
    Media:   { bg: colors.infoBg, txt: colors.info },
    Baja:    { bg: colors.badgeGray, txt: colors.textMuted },
  }
  const c = cfg[prioridad] || cfg.Baja
  return <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, backgroundColor: c.bg }}><Text style={{ fontSize: 12, fontWeight: '700', color: c.txt }}>{prioridad || 'Media'}</Text></View>
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

export default function ClienteIncidenciaDetalleScreen({ route, navigation }) {
  const { ticket: initialTicket } = route.params
  const { user } = useAuth()
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()

  const [ticket, setTicket]             = useState(initialTicket)
  const [comentarios, setComentarios]   = useState([])
  const [loading, setLoading]           = useState(true)
  const [newComment, setNewComment]     = useState('')
  const [sendingComment, setSendingComment] = useState(false)
  const flatRef = useRef(null)

  const loadAll = useCallback(async () => {
    try {
      const [t, c] = await Promise.all([
        getTicket(initialTicket.id),
        getTicketComentarios(initialTicket.id),
      ])
      setTicket(t)
      // Only show public comments to clients
      const publicos = Array.isArray(c) ? c.filter(cm => !cm.privado) : []
      setComentarios(publicos)
    } catch (e) {}
  }, [initialTicket.id])

  useEffect(() => {
    loadAll().finally(() => setLoading(false))
  }, [])

  async function sendComment() {
    if (!newComment.trim()) return
    setSendingComment(true)
    try {
      const c = await createTicketComentario(ticket.id, newComment.trim())
      setComentarios(prev => [...prev, c])
      setNewComment('')
      setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100)
    } catch (e) { Alert.alert('Error', e.message) }
    finally { setSendingComment(false) }
  }

  const archivos = ticket?.ticket_archivos || []

  if (loading) {
    return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg }}><ActivityIndicator size="large" color={colors.primary} /></View>
  }

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: colors.headerBg, borderBottomWidth: 1, borderBottomColor: colors.border, gap: 10 }}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 12, fontWeight: '800', color: colors.primary }}>#{ticket.numero || ticket.id}</Text>
            <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }} numberOfLines={2}>{ticket.asunto}</Text>
          </View>
        </View>

        {/* Badges */}
        <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: colors.headerBg, borderBottomWidth: 1, borderBottomColor: colors.border }}>
          <EstadoBadge estado={ticket.estado} colors={colors} />
        </View>

        <ScrollView>
          {/* Ticket info card */}
          <View style={{ backgroundColor: colors.card, margin: 16, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 16 }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textMuted, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>Información</Text>
            {[
              { label: 'Estado',     value: ticket.estado },
              { label: 'Fecha',      value: formatFechaCorta(ticket.created_at) },
            ].map(({ label, value }) => value ? (
              <View key={label} style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textMuted, width: 80 }}>{label}:</Text>
                <Text style={{ fontSize: 13, color: colors.text, flex: 1 }}>{value}</Text>
              </View>
            ) : null)}

            {ticket.descripcion ? (
              <View style={{ marginTop: 8, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textMuted, marginBottom: 6 }}>Descripción:</Text>
                <Text style={{ fontSize: 14, color: colors.text, lineHeight: 20 }}>{ticket.descripcion}</Text>
              </View>
            ) : null}
          </View>

          {/* Archivos */}
          {archivos.length > 0 && (
            <View style={{ backgroundColor: colors.card, marginHorizontal: 16, marginBottom: 16, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 16 }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textMuted, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Archivos adjuntos ({archivos.length})
              </Text>
              {archivos.map(a => (
                <View key={a.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                  <View style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: colors.primaryBg, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="attach-outline" size={18} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text }} numberOfLines={1}>{a.nombre_original}</Text>
                    {a.tamanio && <Text style={{ fontSize: 11, color: colors.textMuted }}>{(a.tamanio / 1024).toFixed(1)} KB</Text>}
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Comments header */}
          <View style={{ paddingHorizontal: 16, marginBottom: 8 }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>
              Comentarios ({comentarios.length})
            </Text>
          </View>

          {/* Comments */}
          {comentarios.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 24, gap: 8 }}>
              <Ionicons name="chatbubble-outline" size={36} color={colors.textMuted} />
              <Text style={{ fontSize: 14, color: colors.textMuted }}>Sin comentarios aún</Text>
            </View>
          ) : (
            <View style={{ paddingHorizontal: 16, gap: 12 }}>
              {comentarios.map(item => {
                const isOwn = item.user_id === user?.id
                return (
                  <View key={item.id} style={{ flexDirection: isOwn ? 'row-reverse' : 'row', gap: 10, alignItems: 'flex-start' }}>
                    <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: getAvatarColor(item.user_id), alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Text style={{ fontSize: 11, color: '#fff', fontWeight: '800' }}>{getInitials(item.profiles?.nombre)}</Text>
                    </View>
                    <View style={{ flex: 1, maxWidth: '80%' }}>
                      <View style={{ flexDirection: isOwn ? 'row-reverse' : 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                        <Text style={{ fontSize: 12, fontWeight: '700', color: colors.text }}>{item.profiles?.nombre || 'Soporte'}</Text>
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
                      </View>
                    </View>
                  </View>
                )
              })}
            </View>
          )}

          <View style={{ height: 20 }} />
        </ScrollView>

        {/* Comment input */}
        <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 12, paddingTop: 12, paddingBottom: 12 + insets.bottom, backgroundColor: colors.headerBg, borderTopWidth: 1, borderTopColor: colors.border, alignItems: 'flex-end' }}>
          <TextInput
            style={{ flex: 1, backgroundColor: colors.inputBg, borderWidth: 1.5, borderColor: colors.inputBorder, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, color: colors.text, maxHeight: 100 }}
            placeholder="Añade un comentario..."
            placeholderTextColor={colors.textMuted}
            value={newComment}
            onChangeText={setNewComment}
            multiline
          />
          <TouchableOpacity
            style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: newComment.trim() ? colors.primary : colors.border, alignItems: 'center', justifyContent: 'center' }}
            onPress={sendComment}
            disabled={!newComment.trim() || sendingComment}
          >
            {sendingComment ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="send" size={18} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
