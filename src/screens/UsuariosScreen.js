import { useState, useEffect, useCallback } from 'react'
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput,
  ActivityIndicator, Alert, Modal, ScrollView, RefreshControl,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { getUsuarios, createUsuario, updateUsuario, deleteUsuario } from '../services/api'

const ROLES = ['admin', 'gestor', 'operario', 'cliente']
const ROL_COLOR = { admin: '#dc2626', gestor: '#d97706', operario: '#0066ff', cliente: '#16a34a' }

export default function UsuariosScreen() {
  const [usuarios, setUsuarios]     = useState([])
  const [loading, setLoading]       = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch]         = useState('')
  const [showModal, setShowModal]   = useState(false)
  const [editing, setEditing]       = useState(null)
  const [form, setForm]             = useState({ nombre: '', email: '', password: '', rol: 'operario' })

  const load = useCallback(async () => {
    try {
      const data = await getUsuarios()
      setUsuarios(Array.isArray(data) ? data : data.usuarios || [])
    } catch (e) { Alert.alert('Error', e.message) }
    finally { setLoading(false); setRefreshing(false) }
  }, [])

  useEffect(() => { load() }, [load])

  function openCreate() {
    setEditing(null)
    setForm({ nombre: '', email: '', password: '', rol: 'operario' })
    setShowModal(true)
  }

  function openEdit(u) {
    setEditing(u)
    setForm({ nombre: u.nombre || '', email: u.email || '', password: '', rol: u.rol || 'operario' })
    setShowModal(true)
  }

  async function handleSave() {
    if (!form.email.trim()) { Alert.alert('Error', 'Email requerido'); return }
    try {
      if (editing) {
        const payload = { nombre: form.nombre, email: form.email, rol: form.rol }
        if (form.password.trim()) payload.password = form.password
        await updateUsuario(editing.id, payload)
      } else {
        if (!form.password.trim()) { Alert.alert('Error', 'Contraseña requerida'); return }
        await createUsuario(form)
      }
      setShowModal(false)
      load()
    } catch (e) { Alert.alert('Error', e.message) }
  }

  async function handleDelete(id) {
    Alert.alert('Eliminar usuario', '¿Confirmar?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: async () => {
        try { await deleteUsuario(id); load() }
        catch (e) { Alert.alert('Error', e.message) }
      }},
    ])
  }

  const filtered = usuarios.filter(u =>
    (u.nombre || '').toLowerCase().includes(search.toLowerCase()) ||
    (u.email  || '').toLowerCase().includes(search.toLowerCase())
  )

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#0066ff" /></View>

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Usuarios</Text>
        <TouchableOpacity onPress={openCreate}>
          <Ionicons name="add-circle-outline" size={26} color="#0066ff" />
        </TouchableOpacity>
      </View>

      <View style={{ padding: 12 }}>
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar usuario..."
          placeholderTextColor="#64748b"
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={item => String(item.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load() }} />}
        ListEmptyComponent={<Text style={styles.empty}>Sin usuarios</Text>}
        renderItem={({ item }) => (
          <View style={styles.userCard}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{(item.nombre || item.email || '?')[0].toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.userName}>{item.nombre || '—'}</Text>
              <Text style={styles.userEmail}>{item.email}</Text>
            </View>
            <View style={[styles.rolBadge, { backgroundColor: ROL_COLOR[item.rol] || '#64748b' }]}>
              <Text style={styles.rolText}>{item.rol}</Text>
            </View>
            <View style={styles.actions}>
              <TouchableOpacity onPress={() => openEdit(item)} style={styles.actionBtn}>
                <Ionicons name="pencil-outline" size={18} color="#94a3b8" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleDelete(item.id)} style={styles.actionBtn}>
                <Ionicons name="trash-outline" size={18} color="#dc2626" />
              </TouchableOpacity>
            </View>
          </View>
        )}
      />

      {/* Modal crear/editar */}
      <Modal visible={showModal} animationType="slide" onRequestClose={() => setShowModal(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowModal(false)}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{editing ? 'Editar Usuario' : 'Nuevo Usuario'}</Text>
            <TouchableOpacity onPress={handleSave}>
              <Text style={{ color: '#0066ff', fontWeight: '700' }}>Guardar</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalBody}>
            <Text style={styles.fieldLabel}>Nombre</Text>
            <TextInput
              style={styles.fieldInput}
              placeholder="Nombre completo"
              placeholderTextColor="#64748b"
              value={form.nombre}
              onChangeText={v => setForm(f => ({ ...f, nombre: v }))}
            />
            <Text style={styles.fieldLabel}>Email *</Text>
            <TextInput
              style={styles.fieldInput}
              placeholder="email@ejemplo.com"
              placeholderTextColor="#64748b"
              value={form.email}
              onChangeText={v => setForm(f => ({ ...f, email: v }))}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <Text style={styles.fieldLabel}>{editing ? 'Nueva contraseña (opcional)' : 'Contraseña *'}</Text>
            <TextInput
              style={styles.fieldInput}
              placeholder="••••••••"
              placeholderTextColor="#64748b"
              value={form.password}
              onChangeText={v => setForm(f => ({ ...f, password: v }))}
              secureTextEntry
            />
            <Text style={styles.fieldLabel}>Rol</Text>
            <View style={styles.rolRow}>
              {ROLES.map(r => (
                <TouchableOpacity
                  key={r}
                  style={[styles.rolBtn, form.rol === r && { backgroundColor: ROL_COLOR[r] || '#1d4ed8' }]}
                  onPress={() => setForm(f => ({ ...f, rol: r }))}
                >
                  <Text style={styles.rolBtnText}>{r}</Text>
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
  searchInput:    { backgroundColor: '#1e293b', color: '#fff', borderRadius: 8, borderWidth: 1, borderColor: '#334155', paddingHorizontal: 12, paddingVertical: 9, fontSize: 14 },
  empty:          { color: '#64748b', textAlign: 'center', marginTop: 40 },
  userCard:       { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1e293b', marginHorizontal: 12, marginBottom: 8, borderRadius: 10, padding: 12, gap: 10 },
  avatar:         { width: 40, height: 40, borderRadius: 20, backgroundColor: '#0066ff', justifyContent: 'center', alignItems: 'center' },
  avatarText:     { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  userName:       { color: '#fff', fontWeight: '600', fontSize: 14 },
  userEmail:      { color: '#64748b', fontSize: 12 },
  rolBadge:       { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  rolText:        { color: '#fff', fontSize: 11, fontWeight: '600' },
  actions:        { flexDirection: 'row', gap: 4 },
  actionBtn:      { padding: 6 },
  modalContainer: { flex: 1, backgroundColor: '#0f172a' },
  modalHeader:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, backgroundColor: '#1e293b', borderBottomWidth: 1, borderBottomColor: '#334155' },
  modalTitle:     { color: '#fff', fontWeight: '700', fontSize: 16, flex: 1, marginHorizontal: 12 },
  modalBody:      { flex: 1, padding: 16 },
  fieldLabel:     { color: '#94a3b8', fontSize: 13, marginBottom: 6, marginTop: 14 },
  fieldInput:     { backgroundColor: '#1e293b', color: '#fff', borderRadius: 8, borderWidth: 1, borderColor: '#334155', paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  rolRow:         { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  rolBtn:         { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8, backgroundColor: '#1e293b' },
  rolBtnText:     { color: '#cbd5e1', fontSize: 13 },
})
