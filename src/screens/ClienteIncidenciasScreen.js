import { useState, useEffect, useCallback } from 'react'
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput,
  ActivityIndicator, Alert, Modal, ScrollView, RefreshControl,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '../context/AuthContext'
import { getIncidenciasCliente, createIncidencia } from '../services/api'

const ESTADO_COLOR = { abierto: '#16a34a', en_curso: '#d97706', pendiente: '#9333ea', cerrado: '#64748b' }
const PRIO_COLOR   = { baja: '#16a34a', media: '#d97706', alta: '#dc2626', urgente: '#7f1d1d' }

function formatFecha(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function ClienteIncidenciasScreen() {
  const { user } = useAuth()
  const [tickets, setTickets]       = useState([])
  const [loading, setLoading]       = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm]             = useState({ titulo: '', descripcion: '', prioridad: 'media' })

  const load = useCallback(async () => {
    try {
      const data = await getIncidenciasCliente()
      setTickets(Array.isArray(data) ? data : data.tickets || [])
    } catch (e) { Alert.alert('Error', e.message) }
    finally { setLoading(false); setRefreshing(false) }
  }, [])

  useEffect(() => { load() }, [load])

  async function handleCreate() {
    if (!form.titulo.trim()) { Alert.alert('Error', 'Introduce un título'); return }
    try {
      await createIncidencia(form)
      setShowCreate(false)
      setForm({ titulo: '', descripcion: '', prioridad: 'media' })
      load()
    } catch (e) { Alert.alert('Error', e.message) }
  }

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#0066ff" /></View>

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Mis Incidencias</Text>
        <TouchableOpacity onPress={() => setShowCreate(true)} style={styles.newBtn}>
          <Ionicons name="add" size={18} color="#fff" />
          <Text style={styles.newBtnText}>Nueva</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={tickets}
        keyExtractor={item => String(item.id)}
        contentContainerStyle={{ padding: 12 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load() }} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="ticket-outline" size={48} color="#334155" />
            <Text style={styles.empty}>Sin incidencias</Text>
            <Text style={styles.emptySub}>Pulsa "Nueva" para crear tu primera incidencia</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardTop}>
              <Text style={styles.cardTitulo} numberOfLines={2}>{item.titulo}</Text>
              <View style={[styles.badge, { backgroundColor: PRIO_COLOR[item.prioridad] || '#64748b' }]}>
                <Text style={styles.badgeText}>{item.prioridad}</Text>
              </View>
            </View>
            {item.descripcion && (
              <Text style={styles.cardDesc} numberOfLines={2}>{item.descripcion}</Text>
            )}
            <View style={styles.cardBottom}>
              <View style={[styles.estadoBadge, { backgroundColor: ESTADO_COLOR[item.estado] || '#64748b' }]}>
                <Text style={styles.badgeText}>{item.estado?.replace('_', ' ')}</Text>
              </View>
              <Text style={styles.cardFecha}>{formatFecha(item.created_at)}</Text>
            </View>
          </View>
        )}
      />

      {/* Modal nueva incidencia */}
      <Modal visible={showCreate} animationType="slide" onRequestClose={() => setShowCreate(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowCreate(false)}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Nueva Incidencia</Text>
            <TouchableOpacity onPress={handleCreate}>
              <Text style={{ color: '#0066ff', fontWeight: '700' }}>Enviar</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalBody}>
            <Text style={styles.fieldLabel}>Título *</Text>
            <TextInput
              style={styles.fieldInput}
              placeholder="Describe el problema brevemente"
              placeholderTextColor="#64748b"
              value={form.titulo}
              onChangeText={v => setForm(f => ({ ...f, titulo: v }))}
            />
            <Text style={styles.fieldLabel}>Descripción</Text>
            <TextInput
              style={[styles.fieldInput, { height: 120, textAlignVertical: 'top' }]}
              placeholder="Explica el problema con más detalle..."
              placeholderTextColor="#64748b"
              value={form.descripcion}
              onChangeText={v => setForm(f => ({ ...f, descripcion: v }))}
              multiline
            />
            <Text style={styles.fieldLabel}>Prioridad</Text>
            <View style={styles.prioRow}>
              {['baja', 'media', 'alta', 'urgente'].map(p => (
                <TouchableOpacity
                  key={p}
                  style={[styles.prioBtn, form.prioridad === p && { backgroundColor: PRIO_COLOR[p] }]}
                  onPress={() => setForm(f => ({ ...f, prioridad: p }))}
                >
                  <Text style={styles.prioBtnText}>{p}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: '#0f172a' },
  center:         { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#1e293b', borderBottomWidth: 1, borderBottomColor: '#334155' },
  title:          { color: '#fff', fontSize: 18, fontWeight: '700' },
  newBtn:         { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#0066ff', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 },
  newBtnText:     { color: '#fff', fontWeight: '600', fontSize: 14 },
  emptyContainer: { alignItems: 'center', marginTop: 60, gap: 8 },
  empty:          { color: '#64748b', fontSize: 16, fontWeight: '600' },
  emptySub:       { color: '#475569', fontSize: 13, textAlign: 'center' },
  card:           { backgroundColor: '#1e293b', borderRadius: 10, padding: 14, marginBottom: 10 },
  cardTop:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6, gap: 8 },
  cardTitulo:     { color: '#fff', fontWeight: '600', fontSize: 15, flex: 1 },
  cardDesc:       { color: '#94a3b8', fontSize: 13, lineHeight: 18, marginBottom: 10 },
  cardBottom:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  badge:          { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  estadoBadge:    { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText:      { color: '#fff', fontSize: 11, fontWeight: '600' },
  cardFecha:      { color: '#475569', fontSize: 12 },
  modalContainer: { flex: 1, backgroundColor: '#0f172a' },
  modalHeader:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, backgroundColor: '#1e293b', borderBottomWidth: 1, borderBottomColor: '#334155' },
  modalTitle:     { color: '#fff', fontWeight: '700', fontSize: 16, flex: 1, marginHorizontal: 12 },
  modalBody:      { flex: 1, padding: 16 },
  fieldLabel:     { color: '#94a3b8', fontSize: 13, marginBottom: 6, marginTop: 14 },
  fieldInput:     { backgroundColor: '#1e293b', color: '#fff', borderRadius: 8, borderWidth: 1, borderColor: '#334155', paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  prioRow:        { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 4 },
  prioBtn:        { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8, backgroundColor: '#1e293b' },
  prioBtnText:    { color: '#cbd5e1', fontSize: 13 },
})
