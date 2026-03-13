import { useState, useEffect, useCallback } from 'react'
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput,
  ActivityIndicator, Alert, RefreshControl, Modal, ScrollView,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '../context/AuthContext'
import {
  getTickets, getTicket, createTicket, updateTicket, deleteTicket,
  getEmpresas, getOperarios, getTicketComentarios, createTicketComentario,
} from '../services/api'

const ESTADOS = ['abierto', 'en_curso', 'pendiente', 'cerrado']
const PRIORIDADES = ['baja', 'media', 'alta', 'urgente']
const ESTADO_COLOR = { abierto: '#16a34a', en_curso: '#d97706', pendiente: '#9333ea', cerrado: '#64748b' }
const PRIO_COLOR   = { baja: '#16a34a', media: '#d97706', alta: '#dc2626', urgente: '#7f1d1d' }

function formatFecha(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function TicketsScreen() {
  const { user, isAdmin } = useAuth()
  const [tickets, setTickets]       = useState([])
  const [loading, setLoading]       = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch]         = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')
  const [selected, setSelected]     = useState(null)
  const [comentarios, setComentarios] = useState([])
  const [nuevoComentario, setNuevoComentario] = useState('')
  const [modalVisible, setModalVisible] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [empresas, setEmpresas]     = useState([])
  const [form, setForm]             = useState({ titulo: '', descripcion: '', prioridad: 'media', empresa_id: '' })

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
      setComentarios(c)
    } catch { setComentarios([]) }
  }

  async function handleComentario() {
    if (!nuevoComentario.trim() || !selected) return
    try {
      await createTicketComentario(selected.id, nuevoComentario.trim())
      setNuevoComentario('')
      const c = await getTicketComentarios(selected.id)
      setComentarios(c)
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

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#0066ff" /></View>

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Tickets</Text>
        <TouchableOpacity onPress={() => setShowCreate(true)}>
          <Ionicons name="add-circle-outline" size={26} color="#0066ff" />
        </TouchableOpacity>
      </View>

      {/* Filtros */}
      <View style={styles.filters}>
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar ticket..."
          placeholderTextColor="#64748b"
          value={search}
          onChangeText={setSearch}
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
          <TouchableOpacity
            style={[styles.filterBtn, !filtroEstado && styles.filterBtnActive]}
            onPress={() => setFiltroEstado('')}
          >
            <Text style={styles.filterBtnText}>Todos</Text>
          </TouchableOpacity>
          {ESTADOS.map(e => (
            <TouchableOpacity
              key={e}
              style={[styles.filterBtn, filtroEstado === e && styles.filterBtnActive]}
              onPress={() => setFiltroEstado(e)}
            >
              <Text style={styles.filterBtnText}>{e}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Lista */}
      <FlatList
        data={filtered}
        keyExtractor={item => String(item.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load() }} />}
        ListEmptyComponent={<Text style={styles.empty}>Sin tickets</Text>}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.ticketCard} onPress={() => openTicket(item)}>
            <View style={styles.ticketTop}>
              <Text style={styles.ticketTitulo} numberOfLines={1}>{item.titulo}</Text>
              <View style={[styles.badge, { backgroundColor: PRIO_COLOR[item.prioridad] || '#64748b' }]}>
                <Text style={styles.badgeText}>{item.prioridad}</Text>
              </View>
            </View>
            <View style={styles.ticketBottom}>
              <Text style={styles.ticketEmpresa}>{item.empresa_nombre || '—'}</Text>
              <View style={[styles.estadoBadge, { backgroundColor: ESTADO_COLOR[item.estado] || '#64748b' }]}>
                <Text style={styles.badgeText}>{item.estado}</Text>
              </View>
            </View>
            <Text style={styles.ticketFecha}>{formatFecha(item.created_at)}</Text>
          </TouchableOpacity>
        )}
      />

      {/* Modal detalle */}
      <Modal visible={modalVisible} animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.modalTitle} numberOfLines={1}>{selected?.titulo}</Text>
            {isAdmin() && (
              <TouchableOpacity onPress={() => handleDelete(selected?.id)}>
                <Ionicons name="trash-outline" size={22} color="#dc2626" />
              </TouchableOpacity>
            )}
          </View>

          <ScrollView style={styles.modalBody}>
            {/* Info */}
            <View style={styles.infoRow}>
              <View style={[styles.badge, { backgroundColor: PRIO_COLOR[selected?.prioridad] || '#64748b' }]}>
                <Text style={styles.badgeText}>{selected?.prioridad}</Text>
              </View>
              <View style={[styles.estadoBadge, { backgroundColor: ESTADO_COLOR[selected?.estado] || '#64748b' }]}>
                <Text style={styles.badgeText}>{selected?.estado}</Text>
              </View>
            </View>

            <Text style={styles.descripcion}>{selected?.descripcion || 'Sin descripción'}</Text>

            {/* Cambiar estado */}
            {isAdmin() && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Cambiar estado</Text>
                <View style={styles.estadoRow}>
                  {ESTADOS.map(e => (
                    <TouchableOpacity
                      key={e}
                      style={[styles.estadoBtn, selected?.estado === e && styles.estadoBtnActive]}
                      onPress={() => handleChangeEstado(e)}
                    >
                      <Text style={styles.estadoBtnText}>{e}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* Comentarios */}
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

          {/* Nuevo comentario */}
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
              <Ionicons name="send" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal crear ticket */}
      <Modal visible={showCreate} animationType="slide" onRequestClose={() => setShowCreate(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowCreate(false)}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Nuevo Ticket</Text>
            <TouchableOpacity onPress={handleCreate}>
              <Text style={{ color: '#0066ff', fontWeight: '700' }}>Crear</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalBody}>
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
            <View style={styles.estadoRow}>
              {PRIORIDADES.map(p => (
                <TouchableOpacity
                  key={p}
                  style={[styles.estadoBtn, form.prioridad === p && styles.estadoBtnActive]}
                  onPress={() => setForm(f => ({ ...f, prioridad: p }))}
                >
                  <Text style={styles.estadoBtnText}>{p}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.fieldLabel}>Empresa</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {empresas.map(e => (
                <TouchableOpacity
                  key={e.id}
                  style={[styles.empresaChip, String(form.empresa_id) === String(e.id) && styles.empresaChipActive]}
                  onPress={() => setForm(f => ({ ...f, empresa_id: e.id }))}
                >
                  <Text style={styles.estadoBtnText}>{e.nombre}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </ScrollView>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: '#0f172a' },
  center:           { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#1e293b', borderBottomWidth: 1, borderBottomColor: '#334155' },
  title:            { color: '#fff', fontSize: 18, fontWeight: '700' },
  filters:          { padding: 12 },
  searchInput:      { backgroundColor: '#1e293b', color: '#fff', borderRadius: 8, borderWidth: 1, borderColor: '#334155', paddingHorizontal: 12, paddingVertical: 9, fontSize: 14 },
  filterBtn:        { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: '#1e293b', marginRight: 6 },
  filterBtnActive:  { backgroundColor: '#1d4ed8' },
  filterBtnText:    { color: '#cbd5e1', fontSize: 12 },
  empty:            { color: '#64748b', textAlign: 'center', marginTop: 40 },
  ticketCard:       { backgroundColor: '#1e293b', marginHorizontal: 12, marginBottom: 8, borderRadius: 10, padding: 14 },
  ticketTop:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  ticketTitulo:     { color: '#fff', fontWeight: '600', fontSize: 14, flex: 1, marginRight: 8 },
  ticketBottom:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  ticketEmpresa:    { color: '#94a3b8', fontSize: 12 },
  ticketFecha:      { color: '#475569', fontSize: 11, marginTop: 4 },
  badge:            { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  estadoBadge:      { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText:        { color: '#fff', fontSize: 11, fontWeight: '600' },
  // Modal
  modalContainer:   { flex: 1, backgroundColor: '#0f172a' },
  modalHeader:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, backgroundColor: '#1e293b', borderBottomWidth: 1, borderBottomColor: '#334155' },
  modalTitle:       { color: '#fff', fontWeight: '700', fontSize: 16, flex: 1, marginHorizontal: 12 },
  modalBody:        { flex: 1, padding: 16 },
  infoRow:          { flexDirection: 'row', gap: 8, marginBottom: 12 },
  descripcion:      { color: '#94a3b8', fontSize: 14, lineHeight: 20, marginBottom: 20 },
  section:          { marginBottom: 20 },
  sectionTitle:     { color: '#fff', fontWeight: '600', fontSize: 14, marginBottom: 10 },
  estadoRow:        { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  estadoBtn:        { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: '#1e293b' },
  estadoBtnActive:  { backgroundColor: '#1d4ed8' },
  estadoBtnText:    { color: '#cbd5e1', fontSize: 12 },
  comentario:       { backgroundColor: '#1e293b', borderRadius: 8, padding: 10, marginBottom: 8 },
  comentarioAutor:  { color: '#60a5fa', fontSize: 12, fontWeight: '600', marginBottom: 4 },
  comentarioTexto:  { color: '#e2e8f0', fontSize: 14 },
  comentarioFecha:  { color: '#475569', fontSize: 11, marginTop: 4 },
  commentInput:     { flexDirection: 'row', padding: 12, backgroundColor: '#1e293b', borderTopWidth: 1, borderTopColor: '#334155', gap: 8 },
  commentTextInput: { flex: 1, backgroundColor: '#0f172a', color: '#fff', borderRadius: 8, borderWidth: 1, borderColor: '#334155', paddingHorizontal: 12, paddingVertical: 8, fontSize: 14 },
  sendBtn:          { backgroundColor: '#0066ff', borderRadius: 8, padding: 10, justifyContent: 'center' },
  fieldLabel:       { color: '#94a3b8', fontSize: 13, marginBottom: 6, marginTop: 12 },
  fieldInput:       { backgroundColor: '#1e293b', color: '#fff', borderRadius: 8, borderWidth: 1, borderColor: '#334155', paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  empresaChip:      { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: '#1e293b', marginRight: 6 },
  empresaChipActive:{ backgroundColor: '#1d4ed8' },
})
