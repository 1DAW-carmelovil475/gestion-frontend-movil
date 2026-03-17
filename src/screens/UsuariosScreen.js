import { useState, useEffect, useCallback } from 'react'
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput,
  ActivityIndicator, Alert, Modal, ScrollView, RefreshControl,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '../context/ThemeContext'
import { useAuth } from '../context/AuthContext'
import { getUsuarios, createUsuario, updateUsuario, deleteUsuario, getEmpresas } from '../services/api'

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
  return new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
}

const ROLES = ['trabajador', 'gestor', 'admin', 'cliente']
const ROL_CONFIG = {
  admin:     { label: 'Admin',      bg: '#fee2e2', txt: '#dc2626' },
  gestor:    { label: 'Gestor',     bg: '#fef3c7', txt: '#d97706' },
  trabajador:{ label: 'Trabajador', bg: '#dbeafe', txt: '#0047b3' },
  cliente:   { label: 'Cliente',    bg: '#dcfce7', txt: '#16a34a' },
}

function SearchableSelect({ label, placeholder, items, selectedId, onSelect, colors }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const selected = items.find(i => i.id === selectedId)
  const filtered = query.trim()
    ? items.filter(i => i.nombre?.toLowerCase().includes(query.trim().toLowerCase()))
    : items
  return (
    <View style={{ marginBottom: 14 }}>
      {label ? <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textMuted, marginBottom: 6, textTransform: 'uppercase' }}>{label}</Text> : null}
      <TouchableOpacity
        onPress={() => { setQuery(''); setOpen(true) }}
        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.inputBg, borderWidth: 1.5, borderColor: selectedId ? colors.primary : colors.inputBorder, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 11 }}
      >
        <Text style={{ fontSize: 14, color: selected ? colors.text : colors.textMuted, flex: 1 }} numberOfLines={1}>
          {selected ? selected.nombre : placeholder || 'Seleccionar...'}
        </Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textMuted} />
      </TouchableOpacity>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => { setOpen(false); setQuery('') }}>
        <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', paddingHorizontal: 20 }} activeOpacity={1} onPress={() => { setOpen(false); setQuery('') }}>
          <TouchableOpacity activeOpacity={1} onPress={() => {}}>
            <View style={{ backgroundColor: colors.card, borderRadius: 14, overflow: 'hidden', maxHeight: 400 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                <Ionicons name="search-outline" size={16} color={colors.textMuted} />
                <TextInput style={{ flex: 1, fontSize: 14, color: colors.text }} placeholder="Buscar empresa..." placeholderTextColor={colors.textMuted} value={query} onChangeText={setQuery} autoFocus />
                {query ? <TouchableOpacity onPress={() => setQuery('')}><Ionicons name="close-circle" size={16} color={colors.textMuted} /></TouchableOpacity> : null}
              </View>
              <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 320 }}>
                {filtered.length === 0 ? (
                  <View style={{ paddingVertical: 24, alignItems: 'center' }}><Text style={{ color: colors.textMuted, fontSize: 13 }}>Sin resultados</Text></View>
                ) : filtered.map((item, idx) => (
                  <TouchableOpacity key={item.id} onPress={() => { onSelect(item.id); setOpen(false); setQuery('') }}
                    style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: idx < filtered.length - 1 ? 1 : 0, borderBottomColor: colors.border, backgroundColor: item.id === selectedId ? colors.primaryBg : 'transparent' }}
                  >
                    <Text style={{ fontSize: 14, color: item.id === selectedId ? colors.primary : colors.text, fontWeight: item.id === selectedId ? '700' : '400', flex: 1 }} numberOfLines={1}>{item.nombre}</Text>
                    {item.id === selectedId && <Ionicons name="checkmark" size={16} color={colors.primary} />}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  )
}

function RolBadge({ rol, colors }) {
  const cfg = ROL_CONFIG[rol] || { label: rol, bg: colors.badgeGray, txt: colors.textMuted }
  return (
    <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, backgroundColor: cfg.bg }}>
      <Text style={{ fontSize: 11, fontWeight: '700', color: cfg.txt }}>{cfg.label}</Text>
    </View>
  )
}

function UsuarioModal({ visible, usuario, empresas, onClose, onSave, colors }) {
  const [form, setForm] = useState({ nombre: '', email: '', rol: 'trabajador', empresa_id: '', telefono: '', password: '', activo: true })
  const [showPwd, setShowPwd] = useState(false)
  const [showEmpresa, setShowEmpresa] = useState(false)

  useEffect(() => {
    if (visible) {
      if (usuario) {
        setForm({
          nombre:     usuario.nombre || '',
          email:      usuario.email || '',
          rol:        usuario.rol || 'trabajador',
          empresa_id: usuario.empresa_id || '',
          telefono:   usuario.telefono || '',
          password:   '',
          activo:     usuario.activo !== false,
        })
        setShowEmpresa(usuario.rol === 'cliente')
      } else {
        setForm({ nombre: '', email: '', rol: 'trabajador', empresa_id: '', telefono: '', password: '', activo: true })
        setShowEmpresa(false)
      }
    }
  }, [visible, usuario])

  function handleRolChange(rol) {
    setForm(f => ({ ...f, rol, empresa_id: rol !== 'cliente' ? '' : f.empresa_id }))
    setShowEmpresa(rol === 'cliente')
  }

  function handleSave() {
    if (!form.nombre.trim()) { Alert.alert('Error', 'El nombre es obligatorio'); return }
    if (!usuario && !form.email.trim()) { Alert.alert('Error', 'El email es obligatorio'); return }
    if (!usuario && !form.password) { Alert.alert('Error', 'La contraseña es obligatoria'); return }
    if (form.rol === 'cliente' && !usuario && !form.empresa_id) { Alert.alert('Error', 'Selecciona una empresa para el cliente'); return }
    onSave(form)
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay }}>
        <View style={{ backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '90%', paddingBottom: 24 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text }}>{usuario ? 'Editar usuario' : 'Nuevo usuario'}</Text>
            <TouchableOpacity onPress={onClose}><Ionicons name="close" size={22} color={colors.textMuted} /></TouchableOpacity>
          </View>

          <ScrollView style={{ padding: 20 }} keyboardShouldPersistTaps="handled">
            {/* Nombre */}
            <View style={{ marginBottom: 14 }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textMuted, marginBottom: 6, textTransform: 'uppercase' }}>Nombre completo *</Text>
              <TextInput
                style={{ backgroundColor: colors.inputBg, borderWidth: 1.5, borderColor: colors.inputBorder, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: colors.text }}
                value={form.nombre}
                onChangeText={v => setForm(f => ({ ...f, nombre: v }))}
                placeholder="Nombre completo"
                placeholderTextColor={colors.textMuted}
              />
            </View>

            {/* Email - solo en creación */}
            {!usuario && (
              <View style={{ marginBottom: 14 }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textMuted, marginBottom: 6, textTransform: 'uppercase' }}>Email *</Text>
                <TextInput
                  style={{ backgroundColor: colors.inputBg, borderWidth: 1.5, borderColor: colors.inputBorder, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: colors.text }}
                  value={form.email}
                  onChangeText={v => setForm(f => ({ ...f, email: v }))}
                  placeholder="correo@empresa.com"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>
            )}

            {/* Rol */}
            <View style={{ marginBottom: 14 }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textMuted, marginBottom: 6, textTransform: 'uppercase' }}>Rol *</Text>
              <View style={{ gap: 8 }}>
                {ROLES.map(r => {
                  const cfg = ROL_CONFIG[r]
                  return (
                    <TouchableOpacity
                      key={r}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 11, borderRadius: 8, borderWidth: 1.5, borderColor: form.rol === r ? colors.primary : colors.border, backgroundColor: form.rol === r ? colors.primaryBg : colors.bg }}
                      onPress={() => handleRolChange(r)}
                    >
                      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: cfg.txt }} />
                      <Text style={{ fontSize: 13, fontWeight: '600', color: form.rol === r ? colors.primary : colors.text }}>{cfg.label}</Text>
                      {form.rol === r && <Ionicons name="checkmark-circle" size={16} color={colors.primary} style={{ marginLeft: 'auto' }} />}
                    </TouchableOpacity>
                  )
                })}
              </View>
            </View>

            {/* Empresa - solo para clientes */}
            {showEmpresa && (
              <SearchableSelect
                label={`Empresa${!usuario ? ' *' : ''}`}
                placeholder="Seleccionar empresa..."
                items={empresas}
                selectedId={form.empresa_id}
                onSelect={id => setForm(f => ({ ...f, empresa_id: id }))}
                colors={colors}
              />
            )}

            {/* Telefono - solo para clientes */}
            {form.rol === 'cliente' && (
              <View style={{ marginBottom: 14 }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textMuted, marginBottom: 6, textTransform: 'uppercase' }}>Teléfono</Text>
                <TextInput
                  style={{ backgroundColor: colors.inputBg, borderWidth: 1.5, borderColor: colors.inputBorder, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: colors.text }}
                  value={form.telefono}
                  onChangeText={v => setForm(f => ({ ...f, telefono: v }))}
                  placeholder="+34 600 000 000"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="phone-pad"
                />
              </View>
            )}

            {/* Estado - solo en edición */}
            {usuario && (
              <View style={{ marginBottom: 14 }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textMuted, marginBottom: 6, textTransform: 'uppercase' }}>Estado</Text>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  {[{ val: true, label: 'Activo' }, { val: false, label: 'Desactivado' }].map(s => (
                    <TouchableOpacity
                      key={String(s.val)}
                      style={{ flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8, borderWidth: 1.5, borderColor: form.activo === s.val ? colors.primary : colors.border, backgroundColor: form.activo === s.val ? colors.primaryBg : colors.bg }}
                      onPress={() => setForm(f => ({ ...f, activo: s.val }))}
                    >
                      <Text style={{ fontWeight: '700', fontSize: 13, color: form.activo === s.val ? colors.primary : colors.textMuted }}>{s.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* Password */}
            <View style={{ marginBottom: 14 }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textMuted, marginBottom: 6, textTransform: 'uppercase' }}>
                {usuario ? 'Nueva contraseña (dejar vacío para no cambiar)' : 'Contraseña *'}
              </Text>
              <View style={{ position: 'relative' }}>
                <TextInput
                  style={{ backgroundColor: colors.inputBg, borderWidth: 1.5, borderColor: colors.inputBorder, borderRadius: 8, paddingHorizontal: 12, paddingRight: 48, paddingVertical: 10, fontSize: 14, color: colors.text }}
                  value={form.password}
                  onChangeText={v => setForm(f => ({ ...f, password: v }))}
                  placeholder={usuario ? 'Nueva contraseña...' : 'Contraseña segura...'}
                  placeholderTextColor={colors.textMuted}
                  secureTextEntry={!showPwd}
                  autoCapitalize="none"
                />
                <TouchableOpacity style={{ position: 'absolute', right: 12, top: 0, bottom: 0, justifyContent: 'center' }} onPress={() => setShowPwd(v => !v)}>
                  <Ionicons name={showPwd ? 'eye-off-outline' : 'eye-outline'} size={18} color={colors.textMuted} />
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>

          <View style={{ flexDirection: 'row', gap: 12, paddingHorizontal: 20, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border }}>
            <TouchableOpacity style={{ flex: 1, paddingVertical: 13, alignItems: 'center', borderRadius: 8, borderWidth: 1.5, borderColor: colors.border }} onPress={onClose}>
              <Text style={{ fontSize: 15, fontWeight: '600', color: colors.textMuted }}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={{ flex: 2, paddingVertical: 13, alignItems: 'center', borderRadius: 8, backgroundColor: colors.primary }} onPress={handleSave}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: '#ffffff' }}>{usuario ? 'Guardar' : 'Crear'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  )
}

function UsuarioCard({ usuario, onEdit, onDelete, colors }) {
  return (
    <View style={{ backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 14, marginBottom: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: getAvatarColor(usuario.id), alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: '#fff', fontSize: 15, fontWeight: '800' }}>{getInitials(usuario.nombre)}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>{usuario.nombre || 'Sin nombre'}</Text>
          <Text style={{ fontSize: 12, color: colors.textMuted }} numberOfLines={1}>{usuario.email}</Text>
          {usuario.empresas?.nombre && (
            <Text style={{ fontSize: 11, color: colors.primary, marginTop: 2 }} numberOfLines={1}>{usuario.empresas.nombre}</Text>
          )}
        </View>
        <View style={{ alignItems: 'flex-end', gap: 6 }}>
          <RolBadge rol={usuario.rol} colors={colors} />
          <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, backgroundColor: usuario.activo !== false ? colors.successBg : colors.badgeGray }}>
            <Text style={{ fontSize: 10, fontWeight: '700', color: usuario.activo !== false ? colors.success : colors.textMuted }}>
              {usuario.activo !== false ? 'Activo' : 'Inactivo'}
            </Text>
          </View>
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 6, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border }}>
        <Text style={{ flex: 1, fontSize: 11, color: colors.textMuted }}>Desde {formatFecha(usuario.created_at)}</Text>
        <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }} onPress={() => onEdit(usuario)}>
          <Ionicons name="pencil-outline" size={14} color={colors.primary} />
          <Text style={{ fontSize: 12, color: colors.primary, fontWeight: '600' }}>Editar</Text>
        </TouchableOpacity>
        <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 8 }} onPress={() => onDelete(usuario)}>
          <Ionicons name="trash-outline" size={14} color={colors.danger} />
          <Text style={{ fontSize: 12, color: colors.danger, fontWeight: '600' }}>Eliminar</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const PAGE_SIZE = 10

export default function UsuariosScreen() {
  const { colors, isDark, toggleTheme } = useTheme()
  const { user, logout } = useAuth()
  const [usuarios, setUsuarios]     = useState([])
  const [empresas, setEmpresas]     = useState([])
  const [loading, setLoading]       = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch]         = useState('')
  const [filterRol, setFilterRol]   = useState('')
  const [filterActivo, setFilterActivo] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [showModal, setShowModal]   = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [page, setPage]             = useState(1)

  const load = useCallback(async () => {
    try {
      const [u, e] = await Promise.all([getUsuarios(), getEmpresas()])
      setUsuarios(Array.isArray(u) ? u : (u?.usuarios || []))
      setEmpresas(Array.isArray(e) ? e : [])
    } catch (e) { Alert.alert('Error', e.message) }
  }, [])

  useEffect(() => { load().finally(() => setLoading(false)) }, [])

  async function onRefresh() {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }

  const filtered = usuarios.filter(u => {
    if (search && !u.nombre?.toLowerCase().includes(search.toLowerCase()) &&
        !u.email?.toLowerCase().includes(search.toLowerCase())) return false
    if (filterRol && u.rol !== filterRol) return false
    if (filterActivo === 'activo' && u.activo === false) return false
    if (filterActivo === 'inactivo' && u.activo !== false) return false
    return true
  })

  const paginated = filtered.slice(0, page * PAGE_SIZE)

  const total    = usuarios.length
  const admins   = usuarios.filter(u => u.rol === 'admin').length
  const gestores = usuarios.filter(u => u.rol === 'gestor').length
  const trabaj   = usuarios.filter(u => u.rol === 'trabajador').length
  const clientes = usuarios.filter(u => u.rol === 'cliente').length
  const activos  = usuarios.filter(u => u.activo !== false).length

  const statsCards = [
    { label: 'Total',      value: total,    bg: colors.infoBg,    txt: colors.info },
    { label: 'Admins',     value: admins,   bg: colors.dangerBg,  txt: colors.danger },
    { label: 'Gestores',   value: gestores, bg: colors.warningBg, txt: colors.warning },
    { label: 'Trabajadores', value: trabaj, bg: colors.primaryBg, txt: colors.primary },
    { label: 'Clientes',   value: clientes, bg: colors.successBg, txt: colors.success },
    { label: 'Activos',    value: activos,  bg: colors.successBg, txt: colors.success },
  ]

  async function handleSave(form) {
    try {
      if (editingUser) {
        const payload = { nombre: form.nombre, rol: form.rol, activo: form.activo }
        if (form.empresa_id) payload.empresa_id = form.empresa_id
        if (form.telefono)   payload.telefono = form.telefono
        if (form.password)   payload.password = form.password
        await updateUsuario(editingUser.id, payload)
      } else {
        await createUsuario(form)
      }
      setShowModal(false)
      setEditingUser(null)
      await load()
    } catch (e) { Alert.alert('Error', e.message) }
  }

  function handleDelete(usuario) {
    Alert.alert('Eliminar usuario', `¿Eliminar a "${usuario.nombre || usuario.email}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: async () => {
        try { await deleteUsuario(usuario.id); await load() }
        catch (e) { Alert.alert('Error', e.message) }
      }},
    ])
  }

  if (loading) {
    return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg }}><ActivityIndicator size="large" color={colors.primary} /></View>
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: colors.headerBg, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <View>
          <Text style={{ fontSize: 22, fontWeight: '800', color: colors.text }}>Usuarios</Text>
          <Text style={{ fontSize: 12, color: colors.textMuted }}>{total} usuario{total !== 1 ? 's' : ''}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: getAvatarColor(user?.id), alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>{getInitials(user?.nombre || user?.email)}</Text>
          </View>
          <Text style={{ fontSize: 12, color: colors.textMuted, maxWidth: 100 }} numberOfLines={1}>{user?.nombre || user?.email || ''}</Text>
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

      {/* Search + filter */}
      <View style={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 8, gap: 8 }}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, paddingHorizontal: 12, paddingVertical: 9 }}>
            <Ionicons name="search-outline" size={16} color={colors.textMuted} />
            <TextInput
              style={{ flex: 1, fontSize: 14, color: colors.text }}
              placeholder="Buscar usuario..."
              placeholderTextColor={colors.textMuted}
              value={search}
              onChangeText={setSearch}
            />
            {search ? <TouchableOpacity onPress={() => setSearch('')}><Ionicons name="close-circle" size={16} color={colors.textMuted} /></TouchableOpacity> : null}
          </View>
          <TouchableOpacity
            style={[{ padding: 10, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card }, (filterRol || filterActivo) && { borderColor: colors.primary, backgroundColor: colors.primaryBg }]}
            onPress={() => setShowFilters(v => !v)}
          >
            <Ionicons name="filter-outline" size={18} color={(filterRol || filterActivo) ? colors.primary : colors.textMuted} />
          </TouchableOpacity>
        </View>

        {showFilters && (
          <View style={{ gap: 8 }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                <TouchableOpacity
                  style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1.5, borderColor: !filterRol ? colors.primary : colors.border, backgroundColor: !filterRol ? colors.primaryBg : colors.card }}
                  onPress={() => setFilterRol('')}
                >
                  <Text style={{ fontSize: 12, fontWeight: '600', color: !filterRol ? colors.primary : colors.textMuted }}>Todos</Text>
                </TouchableOpacity>
                {ROLES.map(r => (
                  <TouchableOpacity
                    key={r}
                    style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1.5, borderColor: filterRol === r ? colors.primary : colors.border, backgroundColor: filterRol === r ? colors.primaryBg : colors.card }}
                    onPress={() => setFilterRol(filterRol === r ? '' : r)}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '600', color: filterRol === r ? colors.primary : colors.textMuted }}>{ROL_CONFIG[r]?.label || r}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {[{ key: '', label: 'Todos' }, { key: 'activo', label: 'Activos' }, { key: 'inactivo', label: 'Inactivos' }].map(opt => (
                  <TouchableOpacity
                    key={opt.key}
                    style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1.5, borderColor: filterActivo === opt.key ? colors.primary : colors.border, backgroundColor: filterActivo === opt.key ? colors.primaryBg : colors.card }}
                    onPress={() => setFilterActivo(opt.key)}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '600', color: filterActivo === opt.key ? colors.primary : colors.textMuted }}>{opt.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>
        )}
      </View>

      <FlatList
        data={paginated}
        keyExtractor={item => String(item.id)}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 20 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        renderItem={({ item }) => (
          <UsuarioCard
            usuario={item}
            colors={colors}
            onEdit={u => { setEditingUser(u); setShowModal(true) }}
            onDelete={handleDelete}
          />
        )}
        onEndReached={() => { if (paginated.length < filtered.length) setPage(p => p + 1) }}
        onEndReachedThreshold={0.3}
        ListFooterComponent={
          paginated.length < filtered.length ? (
            <TouchableOpacity
              style={{ paddingVertical: 14, alignItems: 'center', borderRadius: 10, borderWidth: 1, borderColor: colors.border, marginTop: 8 }}
              onPress={() => setPage(p => p + 1)}
            >
              <Text style={{ color: colors.primary, fontWeight: '600' }}>Cargar más ({filtered.length - paginated.length} restantes)</Text>
            </TouchableOpacity>
          ) : null
        }
        ListEmptyComponent={
          <View style={{ alignItems: 'center', paddingTop: 60, gap: 12 }}>
            <Ionicons name="people-outline" size={48} color={colors.textMuted} />
            <Text style={{ color: colors.textMuted, fontSize: 15 }}>Sin usuarios</Text>
          </View>
        }
      />

      <UsuarioModal
        visible={showModal}
        usuario={editingUser}
        empresas={empresas}
        onClose={() => { setShowModal(false); setEditingUser(null) }}
        onSave={handleSave}
        colors={colors}
      />

      {/* FAB */}
      <TouchableOpacity
        style={{ position: 'absolute', bottom: 24, right: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8 }}
        onPress={() => { setEditingUser(null); setShowModal(true) }}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>
    </SafeAreaView>
  )
}
