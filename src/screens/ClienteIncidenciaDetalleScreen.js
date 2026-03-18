import { useState, useEffect } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '../context/ThemeContext'
import { getTicket, getArchivoUrl } from '../services/api'
import { Linking } from 'react-native'

function formatFecha(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
}

function estadoCliente(estado) {
  if (estado === 'Pendiente de facturar' || estado === 'Facturado') return 'Completado'
  return estado
}

function EstadoBadge({ estado, colors }) {
  const visible = estadoCliente(estado)
  const cfg = {
    'Pendiente':  { bg: colors.warningBg, txt: colors.warning },
    'En curso':   { bg: colors.infoBg,    txt: colors.info },
    'Completado': { bg: colors.successBg, txt: colors.success },
  }
  const c = cfg[visible] || { bg: colors.badgeGray, txt: colors.textMuted }
  return (
    <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, backgroundColor: c.bg }}>
      <Text style={{ fontSize: 12, fontWeight: '700', color: c.txt }}>{visible}</Text>
    </View>
  )
}

function getFileIcon(mime) {
  if (!mime) return 'document-outline'
  if (mime.startsWith('image/')) return 'image-outline'
  if (mime === 'application/pdf') return 'document-text-outline'
  if (mime.includes('word')) return 'document-outline'
  if (mime.includes('excel') || mime.includes('spreadsheet')) return 'grid-outline'
  return 'attach-outline'
}

function formatSize(bytes) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function ClienteIncidenciaDetalleScreen({ route, navigation }) {
  const { ticket: initialTicket } = route.params
  const { colors } = useTheme()

  const [ticket, setTicket]   = useState(initialTicket)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getTicket(initialTicket.id)
      .then(t => setTicket(t))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [initialTicket.id])

  async function handleDownload(archivo) {
    try {
      const { url } = await getArchivoUrl(archivo.id)
      await Linking.openURL(url)
    } catch {
      Alert.alert('Error', 'No se pudo abrir el archivo')
    }
  }

  const archivos = ticket?.ticket_archivos || []

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    )
  }

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Header */}
      <View style={{
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 16, paddingVertical: 12,
        backgroundColor: colors.headerBg,
        borderBottomWidth: 1, borderBottomColor: colors.border,
        gap: 10,
      }}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 12, fontWeight: '800', color: colors.primary }}>
            #{ticket.numero || ticket.id}
          </Text>
          <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }} numberOfLines={2}>
            {ticket.asunto}
          </Text>
        </View>
        <EstadoBadge estado={ticket.estado} colors={colors} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        {/* Info card */}
        <View style={{
          backgroundColor: colors.card, borderRadius: 12,
          borderWidth: 1, borderColor: colors.border, padding: 16,
        }}>
          <Text style={{ fontSize: 12, fontWeight: '800', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>
            Detalle de incidencia
          </Text>

          {/* Asunto */}
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10, alignItems: 'flex-start' }}>
            <Ionicons name="pricetag-outline" size={14} color={colors.textMuted} style={{ marginTop: 2 }} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textMuted, marginBottom: 2 }}>Asunto</Text>
              <Text style={{ fontSize: 14, color: colors.text, fontWeight: '600' }}>{ticket.asunto}</Text>
            </View>
          </View>

          {/* Estado */}
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10, alignItems: 'center' }}>
            <Ionicons name="information-circle-outline" size={14} color={colors.textMuted} />
            <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textMuted, width: 60 }}>Estado</Text>
            <EstadoBadge estado={ticket.estado} colors={colors} />
          </View>

          {/* Fecha */}
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10, alignItems: 'center' }}>
            <Ionicons name="calendar-outline" size={14} color={colors.textMuted} />
            <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textMuted, width: 60 }}>Fecha</Text>
            <Text style={{ fontSize: 13, color: colors.text }}>{formatFecha(ticket.created_at)}</Text>
          </View>

          {/* Descripción */}
          {ticket.descripcion ? (
            <View style={{ marginTop: 8, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border }}>
              <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', marginBottom: 8 }}>
                <Ionicons name="reorder-three-outline" size={14} color={colors.textMuted} />
                <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textMuted }}>Descripción</Text>
              </View>
              <Text style={{ fontSize: 14, color: colors.text, lineHeight: 20 }}>{ticket.descripcion}</Text>
            </View>
          ) : null}
        </View>

        {/* Archivos */}
        <View style={{
          backgroundColor: colors.card, borderRadius: 12,
          borderWidth: 1, borderColor: colors.border, padding: 16,
        }}>
          <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', marginBottom: 12 }}>
            <Ionicons name="attach-outline" size={14} color={colors.textMuted} />
            <Text style={{ fontSize: 12, fontWeight: '800', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Archivos adjuntos
            </Text>
          </View>

          {archivos.length === 0 ? (
            <Text style={{ fontSize: 13, color: colors.textMuted, fontStyle: 'italic' }}>Sin archivos adjuntos</Text>
          ) : (
            archivos.map(a => (
              <TouchableOpacity
                key={a.id}
                onPress={() => handleDownload(a)}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 10,
                  paddingVertical: 10,
                  borderBottomWidth: 1, borderBottomColor: colors.border,
                }}
              >
                <View style={{
                  width: 36, height: 36, borderRadius: 8,
                  backgroundColor: colors.primaryBg,
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Ionicons name={getFileIcon(a.mime_type)} size={18} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text }} numberOfLines={1}>
                    {a.nombre_original}
                  </Text>
                  {a.tamanio ? (
                    <Text style={{ fontSize: 11, color: colors.textMuted }}>{formatSize(a.tamanio)}</Text>
                  ) : null}
                </View>
                <Ionicons name="download-outline" size={18} color={colors.primary} />
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
