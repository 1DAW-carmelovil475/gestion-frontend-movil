import { useState, useEffect, useCallback } from 'react'
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput,
  ActivityIndicator, Alert, Modal, ScrollView, RefreshControl,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import * as DocumentPicker from 'expo-document-picker'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { getIncidenciasCliente, createIncidenciaConArchivos } from '../services/api'

function formatFecha(iso) {
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
  return (
    <View style={{ paddingHorizontal: 9, paddingVertical: 3, borderRadius: 10, backgroundColor: c.bg }}>
      <Text style={{ fontSize: 11, fontWeight: '700', color: c.txt }}>{estado}</Text>
    </View>
  )
}

function NuevaIncidenciaModal({ visible, onClose, onSave, loading: saving, colors }) {
  const [asunto, setAsunto]       = useState('')
  const [descripcion, setDesc]    = useState('')
  const [archivos, setArchivos]   = useState([])

  useEffect(() => {
    if (visible) { setAsunto(''); setDesc(''); setArchivos([]) }
  }, [visible])

  async function pickArchivo() {
    try {
      const result = await DocumentPicker.getDocumentAsync({ multiple: true, copyToCacheDirectory: true })
      if (!result.canceled && result.assets?.length) {
        setArchivos(prev => {
          const existing = new Set(prev.map(f => f.uri))
          const nuevos = result.assets.filter(f => !existing.has(f.uri))
          return [...prev, ...nuevos]
        })
      }
    } catch (e) { Alert.alert('Error', 'No se pudo adjuntar el archivo') }
  }

  function removeArchivo(uri) {
    setArchivos(prev => prev.filter(f => f.uri !== uri))
  }

  function handleSave() {
    if (!asunto.trim()) { Alert.alert('Error', 'El asunto es obligatorio'); return }
    onSave({ asunto: asunto.trim(), descripcion: descripcion.trim(), archivos })
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay }}>
        <View style={{ backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 30, maxHeight: '90%' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
              <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text }}>Nueva incidencia</Text>
            </View>
            <TouchableOpacity onPress={onClose}><Ionicons name="close" size={22} color={colors.textMuted} /></TouchableOpacity>
          </View>

          <ScrollView style={{ padding: 20 }} keyboardShouldPersistTaps="handled">
            <View style={{ marginBottom: 16 }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textMuted, marginBottom: 6, textTransform: 'uppercase' }}>
                Asunto *
              </Text>
              <TextInput
                style={{ backgroundColor: colors.inputBg, borderWidth: 1.5, borderColor: colors.inputBorder, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: colors.text }}
                value={asunto}
                onChangeText={setAsunto}
                placeholder="Describe brevemente el problema..."
                placeholderTextColor={colors.textMuted}
                autoFocus
              />
            </View>

            <View style={{ marginBottom: 16 }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textMuted, marginBottom: 6, textTransform: 'uppercase' }}>
                Descripción
              </Text>
              <TextInput
                style={{ backgroundColor: colors.inputBg, borderWidth: 1.5, borderColor: colors.inputBorder, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: colors.text, height: 100, textAlignVertical: 'top', paddingTop: 10 }}
                value={descripcion}
                onChangeText={setDesc}
                placeholder="Explica con más detalle qué está ocurriendo, cuándo empezó, qué has intentado..."
                placeholderTextColor={colors.textMuted}
                multiline
              />
            </View>

            {/* Archivos adjuntos */}
            <View style={{ marginBottom: 16 }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textMuted, marginBottom: 6, textTransform: 'uppercase' }}>
                Archivos adjuntos
              </Text>
              {archivos.map(file => (
                <View key={file.uri} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, paddingHorizontal: 10, backgroundColor: colors.inputBg, borderRadius: 8, borderWidth: 1, borderColor: colors.border, marginBottom: 6 }}>
                  <Ionicons name="attach-outline" size={16} color={colors.primary} />
                  <Text style={{ flex: 1, fontSize: 13, color: colors.text }} numberOfLines={1}>{file.name}</Text>
                  {file.size != null && (
                    <Text style={{ fontSize: 11, color: colors.textMuted }}>{(file.size / 1024).toFixed(0)} KB</Text>
                  )}
                  <TouchableOpacity onPress={() => removeArchivo(file.uri)} style={{ padding: 2 }}>
                    <Ionicons name="close-circle" size={18} color={colors.danger} />
                  </TouchableOpacity>
                </View>
              ))}
              <TouchableOpacity
                onPress={pickArchivo}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 8, borderWidth: 1.5, borderColor: colors.border, borderStyle: 'dashed' }}
              >
                <Ionicons name="cloud-upload-outline" size={18} color={colors.primary} />
                <Text style={{ fontSize: 13, fontWeight: '600', color: colors.primary }}>Adjuntar archivo</Text>
              </TouchableOpacity>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, backgroundColor: colors.primaryBg, borderRadius: 8, marginBottom: 16 }}>
              <Ionicons name="information-circle-outline" size={16} color={colors.info} />
              <Text style={{ fontSize: 12, color: colors.info, flex: 1 }}>Tu incidencia será atendida por nuestro equipo lo antes posible.</Text>
            </View>
          </ScrollView>

          <View style={{ flexDirection: 'row', gap: 12, paddingHorizontal: 20, paddingTop: 4 }}>
            <TouchableOpacity style={{ flex: 1, paddingVertical: 13, alignItems: 'center', borderRadius: 8, borderWidth: 1.5, borderColor: colors.border }} onPress={onClose} disabled={saving}>
              <Text style={{ fontSize: 15, fontWeight: '600', color: colors.textMuted }}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{ flex: 2, flexDirection: 'row', paddingVertical: 13, alignItems: 'center', justifyContent: 'center', borderRadius: 8, backgroundColor: colors.primary, gap: 8 }}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="paper-plane-outline" size={16} color="#fff" />
                  <Text style={{ fontSize: 15, fontWeight: '700', color: '#ffffff' }}>Enviar</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  )
}

export default function ClienteIncidenciasScreen({ navigation }) {
  const { user, logout } = useAuth()
  const { colors, isDark, toggleTheme } = useTheme()

  const [tickets, setTickets]       = useState([])
  const [loading, setLoading]       = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [saving, setSaving]         = useState(false)
  const [showCreate, setShowCreate] = useState(false)

  const load = useCallback(async () => {
    try {
      const data = await getIncidenciasCliente()
      setTickets(Array.isArray(data) ? data : (data?.tickets || []))
    } catch (e) { Alert.alert('Error', e.message) }
  }, [])

  useEffect(() => { load().finally(() => setLoading(false)) }, [])

  async function onRefresh() {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }

  async function handleCreate({ asunto, descripcion, archivos }) {
    setSaving(true)
    try {
      await createIncidenciaConArchivos(asunto, descripcion, archivos)
      setShowCreate(false)
      await load()
      Alert.alert('Enviada', 'Tu incidencia ha sido registrada correctamente.')
    } catch (e) { Alert.alert('Error', e.message) }
    finally { setSaving(false) }
  }

  const abiertos  = tickets.filter(t => t.estado !== 'Completado' && t.estado !== 'Facturado').length
  const cerrados  = tickets.filter(t => t.estado === 'Completado' || t.estado === 'Facturado').length

  if (loading) {
    return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg }}><ActivityIndicator size="large" color={colors.primary} /></View>
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Header */}
      <View style={{ backgroundColor: colors.headerBg, borderBottomWidth: 1, borderBottomColor: colors.border, paddingHorizontal: 16, paddingVertical: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <View>
            <Text style={{ fontSize: 22, fontWeight: '800', color: colors.text }}>Mis Incidencias</Text>
            {user?.empresas?.nombre && (
              <Text style={{ fontSize: 12, color: colors.primary, fontWeight: '600' }}>{user.empresas.nombre}</Text>
            )}
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity onPress={toggleTheme} style={{ padding: 6 }}>
              <Ionicons name={isDark ? 'sunny-outline' : 'moon-outline'} size={20} color={colors.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => Alert.alert('Cerrar sesión', '¿Cerrar sesión?', [
                { text: 'Cancelar', style: 'cancel' },
                { text: 'Salir', style: 'destructive', onPress: logout },
              ])}
              style={{ padding: 6 }}
            >
              <Ionicons name="log-out-outline" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Stats badges */}
        <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: colors.warningBg }}>
            <Ionicons name="time-outline" size={14} color={colors.warning} />
            <Text style={{ fontSize: 13, fontWeight: '700', color: colors.warning }}>{abiertos} abiertos</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: colors.successBg }}>
            <Ionicons name="checkmark-circle-outline" size={14} color={colors.success} />
            <Text style={{ fontSize: 13, fontWeight: '700', color: colors.success }}>{cerrados} cerrados</Text>
          </View>
        </View>
      </View>

      <FlatList
        data={tickets}
        keyExtractor={item => String(item.id)}
        contentContainerStyle={{ padding: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={{ backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 14, marginBottom: 10 }}
            onPress={() => navigation.navigate('ClienteIncidenciaDetalle', { ticket: item })}
            activeOpacity={0.8}
          >
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
              <View style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: colors.primaryBg, minWidth: 44, alignItems: 'center' }}>
                <Text style={{ fontSize: 11, fontWeight: '800', color: colors.primary }}>#{item.numero || item.id?.toString().slice(-4)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 6 }} numberOfLines={2}>{item.asunto}</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  <EstadoBadge estado={item.estado} colors={colors} />
                </View>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                <Text style={{ fontSize: 11, color: colors.textMuted }}>{formatFecha(item.created_at)}</Text>
                <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
              </View>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', paddingTop: 60, gap: 12 }}>
            <Ionicons name="alert-circle-outline" size={56} color={colors.textMuted} />
            <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>Sin incidencias</Text>
            <Text style={{ fontSize: 14, color: colors.textMuted, textAlign: 'center', paddingHorizontal: 32 }}>
              Cuando tengas algún problema, pulsa el botón de abajo para reportarlo.
            </Text>
          </View>
        }
      />

      {/* FAB */}
      <TouchableOpacity
        style={{ position: 'absolute', right: 20, bottom: 24, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingVertical: 14, borderRadius: 30, backgroundColor: colors.primary, shadowColor: colors.primary, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 8 }}
        onPress={() => setShowCreate(true)}
      >
        <Ionicons name="add" size={20} color="#fff" />
        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Nueva Incidencia</Text>
      </TouchableOpacity>

      <NuevaIncidenciaModal
        visible={showCreate}
        onClose={() => setShowCreate(false)}
        onSave={handleCreate}
        loading={saving}
        colors={colors}
      />
    </SafeAreaView>
  )
}
