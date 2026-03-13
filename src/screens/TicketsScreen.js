import { useState, useEffect, useCallback } from 'react'
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput,
  ActivityIndicator, Alert, RefreshControl, Modal, ScrollView,
  KeyboardAvoidingView, Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '../context/AuthContext'
import {
  getTickets, createTicket, updateTicket, deleteTicket,
  getEmpresas, getTicketComentarios, createTicketComentario,
} from '../services/api'

const ESTADOS     = ['abierto', 'en_curso', 'pendiente', 'cerrado']
const PRIORIDADES = ['baja', 'media', 'alta', 'urgente']
const ESTADO_COLOR = { abierto: '#16a34a', en_curso: '#d97706', pendiente: '#9333ea', cerrado: '#64748b' }
const PRIO_COLOR   = { baja: '#16a34a', media: '#d97706', alta: '#dc2626', urgente: '#7f1d1d' }

function formatFecha(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function TicketsScreen() {
  const { isAdmin } = useAuth()
  const [tickets, setTickets]               = useState([])
  const [loading, setLoading]               = useState(true)
  const [refreshing, setRefreshing]         = useState(false)
  const [search, setSearch]                 = useState('')
  const [filtroEstado, setFiltroEstado]     = useState('')
  const [selected, setSelected]             = useState(null)
  const [comentarios, setComentarios]       = useState([])
  const [nuevoComentario, setNuevoComentario] = useState('')
  const [modalVisible, setModalVisible]     = useState(false)
  const [showCreate, setShowCreate]         = useState(false)
  const [empresas, setEmpresas]             = useState([])
  const [form, setForm]                     = useState({ titulo: '', descripcion: '', prioridad: 'media', empresa_id: '' })

  const load = useCallback(async () => {
    try {
      const params = {}
      if (filtroEstado) params.estado = filtroEstado
      const data = await getTickets(params)
      setTickets(Array.isArray(data) ? data : data.tickets || [])
    } catch (e) { Alert.alert('Error', e.message) }
    finally { setLoading(false); setRefreshing(false) }
  }, [filtroEstado])

  useEffect(() => { load() }, [load])
  useEffect(() => { getEmpresas().then(setEmpresas).catch(() => {}) }, [])

  async function openTicket(ticket) {
    setSelected(ticket)
    setModalVisible(true)
    try {
      const c = await getTicketComentarios(ticket.id)
      setComentarios(Array.isArray(c) ? c : [])
    } catch { setComentarios([]) }
  }

  async function handleComentario() {
    if (!nuevoComentario.trim() || !selected) return
    try {
      await createTicketComentario(selected.id, nuevoComentario.trim())
      setNuevoComentario('')
      const c = await getTicketComentarios(selected.id)
      setComentarios(Array.isArray(c) ? c : [])
    } catch (e) { Alert.alert('Error', e.message) }
  }

  async function handleChangeEstado(estado) {
    if (!selected) return
    try {
      await updateTicket(selected.id, { estado })
      setSelected(s => ({ ...s, estado }))
      load()
    } catch (e) { Alert.alert('Error', e.message) }
  }

  async function handleCreate() {
    if (!form.titulo.trim()) { Alert.alert('Error', 'Introduce un título'); return }
    try {
      await createTicket({ ...form, empresa_id: form.empresa_id || undefined })
      setShowCreate(false)
      setForm({ titulo: '', descripcion: '', prioridad: 'media', empresa_id: '' })
      load()
    } catch (e) { Alert.alert('Error', e.message) }
  }

  async function handleDelete(id) {
    Alert.alert('Eliminar ticket', '¿Confirmar?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: async () => {
        try { await deleteTicket(id); setModalVisible(false); load() }
        catch (e) { Alert.alert('Error', e.message) }
      }},
    ])
  }

  const filtered = tickets.filter(t =>
    (t.titulo || '').toLowerCase().includes(search.toLowerCase()) ||
    (t.empresa_nombre || '').toLowerCase().includes(search.toLowerCase())
  )

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}><ActivityIndicator size="large" color="#0047b3" /></View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>Tickets</Text>
        <TouchableOpacity onPress={() => setShowCreate(true)} style={styles.addBtn}>
          <Ionicons name="add" size={18} color="#fff" />
          <Text style={styles.addBtnText}>Nuevo</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.filters}>
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar ticket o empresa..."
          placeholderTextColor="#64748b"
          value={search}
          onChangeText={setSearch}
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
          <TouchableOpacity
            style={[styles.filterBtn, !filtroEstado && styles.filterBtnActive]}
            onPress={() => setFiltroEstado('')}
          >
            <Text style={[styles.filterBtnText, !filtroEstado && styles.filterBtnTextActive]}>Todos</Text>
          </TouchableOpacity>
          {ESTADOS.map(e => (
            <TouchableOpacity
              key={e}
              style={[styles.filterBtn, filtroEstado === e && { backgroundColor: ESTADO_COLOR[e] }]}
              onPress={() => setFiltroEstado(e)}
            >
              <Text style={[styles.filterBtnText, filtroEstado === e && styles.filterBtnTextActive]}>
                {e.replace('_', ' ')}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={item => String(item.id)}
        contentContainerStyle={{ padding: 12, paddingTop: 4 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load() }}
            tintColor="#0047b3"
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="ticket-outline" size={48} color="#334155" />
            <Text style={styles.empty}>Sin tickets</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.ticketCard} onPress={() => openTicket(item)}>
            <View style={[styles.prioBar, { backgroundColor: PRIO_COLOR[item.prioridad] || '#64748b' }]} />
            <View style={styles.ticketContent}>
              <View style={styles.ticketTop}>
                <Text style={styles.ticketTitulo} numberOfLines={1}>{item.titulo}</Text>
                <View style={[styles.badge, { backgroundColor: ESTADO_COLOR[item.estado] || '#64748b' }]}>
                  <Text style={styles.badgeText}>{item.estado?.replace('_', ' ')}</Text>
                </View>
              </View>
              <View style={styles.ticketBottom}>
                <Text style={styles.ticketEmpresa}>{item.empresa_nombre || '—'}</Text>
                <Text style={styles.ticketFecha}>{formatFecha(item.created_at)}</Text>
              </View>
            </View>
          </TouchableOpacity>
        )}
      />

      {/* Modal detalle */}
      <Modal visible={modalVisible} animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <SafeAreaView style={styles.safe}>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.iconBtn}>
                <Ionicons name="arrow-back" size={22} color="#fff" />
              </TouchableOpacity>
              <Text style={styles.modalTitle} numberOfLines={1}>{selected?.titulo}</Text>
              {isAdmin() && (
                <TouchableOpacity onPress={() => handleDelete(selected?.id)} style={styles.iconBtn}>
                  <Ionicons name="trash-outline" size={20} color="#dc2626" />
                </TouchableOpacity>
              )}
            </View>

            <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
              <View style={styles.badgeRow}>
                <View style={[styles.badge, { backgroundColor: PRIO_COLOR[selected?.prioridad] || '#64748b' }]}>
                  <Text style={styles.badgeText}>{selected?.prioridad}</Text>
                </View>
                <View style={[styles.badge, { backgroundColor: ESTADO_COLOR[selected?.estado] || '#64748b' }]}>
                  <Text style={styles.badgeText}>{selected?.estado?.replace('_', ' ')}</Text>
                </View>
              </View>

              <Text style={styles.descripcion}>{selected?.descripcion || 'Sin descripción'}</Text>

              {isAdmin() && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Cambiar estado</Text>
                  <View style={styles.chipRow}>
                    {ESTADOS.map(e => (
                      <TouchableOpacity
                        key={e}
                        style={[styles.chip, selected?.estado === e && { backgroundColor: ESTADO_COLOR[e] }]}
                        onPress={() => handleChangeEstado(e)}
                      >
                        <Text style={styles.chipText}>{e.replace('_', ' ')}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Comentarios ({comentarios.length})</Text>
                {comentarios.map(c => (
                  <View key={c.id} style={styles.comentario}>
                    <Text style={styles.comentarioAutor}>{c.autor_nombre || c.autor_email}</Text>
                    <Text style={styles.comentarioTexto}>{c.contenido}</Text>
                    <Text style={styles.comentarioFecha}>{formatFecha(c.created_at)}</Text>
                  </View>
                ))}
              </View>
            </ScrollView>

            <View style={styles.commentInput}>
              <TextInput
                style={styles.commentTextInput}
                placeholder="Añadir comentario..."
                placeholderTextColor="#64748b"
                value={nuevoComentario}
                onChangeText={setNuevoComentario}
                multiline
              />
              <TouchableOpacity onPress={handleComentario} style={styles.sendBtn}>
                <Ionicons name="send" size={18} color="#fff" />
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* Modal crear ticket */}
      <Modal visible={showCreate} animationType="slide" onRequestClose={() => setShowCreate(false)}>
        <SafeAreaView style={styles.safe}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowCreate(false)} style={styles.iconBtn}>
              <Ionicons name="close" size={22} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Nuevo Ticket</Text>
            <TouchableOpacity onPress={handleCreate} style={styles.saveBtn}>
              <Text style={styles.saveBtnText}>Crear</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
            <Text style={styles.fieldLabel}>Título *</Text>
            <TextInput
              style={styles.fieldInput}
              placeholder="Título del ticket"
              placeholderTextColor="#64748b"
              value={form.titulo}
              onChangeText={v => setForm(f => ({ ...f, titulo: v }))}
            />
            <Text style={styles.fieldLabel}>Descripción</Text>
            <TextInput
              style={[styles.fieldInput, { height: 100, textAlignVertical: 'top' }]}
              placeholder="Describe el problema..."
              placeholderTextColor="#64748b"
              value={form.descripcion}
              onChangeText={v => setForm(f => ({ ...f, descripcion: v }))}
              multiline
            />
            <Text style={styles.fieldLabel}>Prioridad</Text>
            <View style={styles.chipRow}>
              {PRIORIDADES.map(p => (
                <TouchableOpacity
                  key={p}
                  style={[styles.chip, form.prioridad === p && { backgroundColor: PRIO_COLOR[p] }]}
                  onPress={() => setForm(f => ({ ...f, prioridad: p }))}
                >
                  <Text style={styles.chipText}>{p}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.fieldLabel}>Empresa</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {empresas.map(e => (
                <TouchableOpacity
                  key={e.id}
                  style={[styles.chip, String(form.empresa_id) === String(e.id) && styles.chipActive]}
                  onPress={() => setForm(f => ({ ...f, empresa_id: e.id }))}
                >
                  <Text style={styles.chipText}>{e.nombre}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe:                { flex: 1, backgroundColor: '#0f172a' },
  center:              { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header:              { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#1e293b', borderBottomWidth: 1, borderBottomColor: '#334155' },
  title:               { color: '#fff', fontSize: 18, fontWeight: '700' },
  addBtn:              { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#0047b3', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 },
  addBtnText:          { color: '#fff', fontWeight: '600', fontSize: 13 },
  filters:             { paddingHorizontal: 12, paddingTop: 12, paddingBottom: 4 },
  searchInput:         { backgroundColor: '#1e293b', color: '#fff', borderRadius: 8, borderWidth: 1, borderColor: '#334155', paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  filterRow:           { marginTop: 8, marginBottom: 4 },
  filterBtn:           { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: '#1e293b', marginRight: 6 },
  filterBtnActive:     { backgroundColor: '#0047b3' },
  filterBtnText:       { color: '#94a3b8', fontSize: 12 },
  filterBtnTextActive: { color: '#fff' },
  emptyContainer:      { alignItems: 'center', marginTop: 60, gap: 8 },
  empty:               { color: '#64748b', fontSize: 14 },
  ticketCard:          { flexDirection: 'row', backgroundColor: '#1e293b', borderRadius: 10, marginBottom: 8, overflow: 'hidden', borderWidth: 1, borderColor: '#334155' },
  prioBar:             { width: 4 },
  ticketContent:       { flex: 1, padding: 13 },
  ticketTop:           { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6, gap: 8 },
  ticketTitulo:        { color: '#fff', fontWeight: '600', fontSize: 14, flex: 1 },
  ticketBottom:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  ticketEmpresa:       { color: '#64748b', fontSize: 12 },
  ticketFecha:         { color: '#475569', fontSize: 11 },
  badge:               { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText:           { color: '#fff', fontSize: 11, fontWeight: '600' },
  modalHeader:         { flexDirection: 'row', alignItems: 'center', padding: 14, backgroundColor: '#1e293b', borderBottomWidth: 1, borderBottomColor: '#334155' },
  iconBtn:             { padding: 4 },
  modalTitle:          { color: '#fff', fontWeight: '700', fontSize: 16, flex: 1, marginHorizontal: 10 },
  saveBtn:             { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#0047b3', borderRadius: 8 },
  saveBtnText:         { color: '#fff', fontWeight: '700', fontSize: 14 },
  modalBody:           { flex: 1, padding: 16 },
  badgeRow:            { flexDirection: 'row', gap: 6, marginBottom: 14, flexWrap: 'wrap' },
  descripcion:         { color: '#94a3b8', fontSize: 14, lineHeight: 22, marginBottom: 20 },
  section:             { marginBottom: 20 },
  sectionTitle:        { color: '#94a3b8', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 },
  chipRow:             { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip:                { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: '#1e293b' },
  chipActive:          { backgroundColor: '#0047b3' },
  chipText:            { color: '#cbd5e1', fontSize: 12 },
  comentario:          { backgroundColor: '#1e293b', borderRadius: 8, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: '#334155' },
  comentarioAutor:     { color: '#0047b3', fontSize: 12, fontWeight: '600', marginBottom: 4 },
  comentarioTexto:     { color: '#e2e8f0', fontSize: 14, lineHeight: 20 },
  comentarioFecha:     { color: '#475569', fontSize: 11, marginTop: 4 },
  commentInput:        { flexDirection: 'row', padding: 12, backgroundColor: '#1e293b', borderTopWidth: 1, borderTopColor: '#334155', gap: 8, alignItems: 'flex-end' },
  commentTextInput:    { flex: 1, backgroundColor: '#0f172a', color: '#fff', borderRadius: 20, borderWidth: 1, borderColor: '#334155', paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, maxHeight: 100 },
  sendBtn:             { width: 40, height: 40, borderRadius: 20, backgroundColor: '#0047b3', justifyContent: 'center', alignItems: 'center' },
  fieldLabel:          { color: '#94a3b8', fontSize: 13, marginBottom: 6, marginTop: 16, fontWeight: '500' },
  fieldInput:          { backgroundColor: '#1e293b', color: '#fff', borderRadius: 8, borderWidth: 1, borderColor: '#334155', paddingHorizontal: 12, paddingVertical: 11, fontSize: 14 },
})
