import { useState, useEffect, useCallback } from 'react'
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput,
  ActivityIndicator, Alert, Modal, ScrollView, RefreshControl,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { getUsuarios, createUsuario, updateUsuario, deleteUsuario } from '../services/api'

const ROLES     = ['admin', 'gestor', 'operario', 'cliente']
const ROL_COLOR = { admin: '#dc2626', gestor: '#d97706', operario: '#0047b3', cliente: '#16a34a' }

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
        <Text style={styles.title}>Usuarios</Text>
        <TouchableOpacity onPress={openCreate} style={styles.addBtn}>
          <Ionicons name="add" size={18} color="#fff" />
          <Text style={styles.addBtnText}>Nuevo</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={16} color="#64748b" style={styles.searchIcon} />
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
        contentContainerStyle={{ padding: 12 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load() }}
            tintColor="#0047b3"
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={48} color="#334155" />
            <Text style={styles.empty}>Sin usuarios</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.userCard}>
            <View style={[styles.avatar, { backgroundColor: ROL_COLOR[item.rol] || '#64748b' }]}>
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
                <Ionicons name="pencil-outline" size={18} color="#64748b" />
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
        <SafeAreaView style={styles.safe}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowModal(false)} style={styles.iconBtn}>
              <Ionicons name="close" size={22} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{editing ? 'Editar Usuario' : 'Nuevo Usuario'}</Text>
            <TouchableOpacity onPress={handleSave} style={styles.saveBtn}>
              <Text style={styles.saveBtnText}>Guardar</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
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
                  style={[styles.rolBtn, form.rol === r && { backgroundColor: ROL_COLOR[r] || '#0047b3' }]}
                  onPress={() => setForm(f => ({ ...f, rol: r }))}
                >
                  <Text style={[styles.rolBtnText, form.rol === r && { color: '#fff' }]}>{r}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe:           { flex: 1, backgroundColor: '#0f172a' },
  center:         { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#1e293b', borderBottomWidth: 1, borderBottomColor: '#334155' },
  title:          { color: '#fff', fontSize: 18, fontWeight: '700' },
  addBtn:         { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#0047b3', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 },
  addBtnText:     { color: '#fff', fontWeight: '600', fontSize: 13 },
  searchWrap:     { flexDirection: 'row', alignItems: 'center', margin: 12, backgroundColor: '#1e293b', borderRadius: 8, borderWidth: 1, borderColor: '#334155', paddingHorizontal: 12 },
  searchIcon:     { marginRight: 8 },
  searchInput:    { flex: 1, color: '#fff', paddingVertical: 11, fontSize: 14 },
  emptyContainer: { alignItems: 'center', marginTop: 60, gap: 8 },
  empty:          { color: '#64748b', fontSize: 14 },
  userCard:       { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1e293b', borderRadius: 10, marginBottom: 8, padding: 12, gap: 10, borderWidth: 1, borderColor: '#334155' },
  avatar:         { width: 42, height: 42, borderRadius: 21, justifyContent: 'center', alignItems: 'center' },
  avatarText:     { color: '#fff', fontWeight: '700', fontSize: 16 },
  userName:       { color: '#fff', fontWeight: '600', fontSize: 14 },
  userEmail:      { color: '#64748b', fontSize: 12, marginTop: 1 },
  rolBadge:       { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  rolText:        { color: '#fff', fontSize: 11, fontWeight: '600' },
  actions:        { flexDirection: 'row', gap: 2 },
  actionBtn:      { padding: 6 },
  modalHeader:    { flexDirection: 'row', alignItems: 'center', padding: 14, backgroundColor: '#1e293b', borderBottomWidth: 1, borderBottomColor: '#334155' },
  iconBtn:        { padding: 4 },
  modalTitle:     { color: '#fff', fontWeight: '700', fontSize: 16, flex: 1, marginHorizontal: 10 },
  saveBtn:        { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#0047b3', borderRadius: 8 },
  saveBtnText:    { color: '#fff', fontWeight: '700', fontSize: 14 },
  modalBody:      { flex: 1, padding: 16 },
  fieldLabel:     { color: '#94a3b8', fontSize: 13, marginBottom: 6, marginTop: 16, fontWeight: '500' },
  fieldInput:     { backgroundColor: '#1e293b', color: '#fff', borderRadius: 8, borderWidth: 1, borderColor: '#334155', paddingHorizontal: 12, paddingVertical: 11, fontSize: 14 },
  rolRow:         { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  rolBtn:         { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, backgroundColor: '#1e293b', borderWidth: 1, borderColor: '#334155' },
  rolBtnText:     { color: '#94a3b8', fontSize: 13 },
})
