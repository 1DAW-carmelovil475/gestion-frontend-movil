import { useState, useEffect, useCallback } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, FlatList, ActivityIndicator, Alert, RefreshControl,
  Modal, Switch,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { getEmpresas, createEmpresa, updateEmpresa, deleteEmpresa } from '../services/api'

const SERVICIOS = ['Cloud', 'Soporte', 'Hardware', 'Redes', 'Seguridad', 'Backup']

const AVATAR_COLORS = ['#0066ff', '#16a34a', '#d97706', '#dc2626', '#9333ea', '#0891b2', '#be185d', '#065f46']

const PAGE_SIZE = 10

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

const MODAL_TABS = ['Datos', 'Servicios', 'Contactos']

function EmpresaModal({ visible, empresa, onClose, onSave, colors }) {
  const [tab, setTab] = useState('Datos')
  const [form, setForm] = useState({
    nombre: '', cif: '', email: '', telefono: '', direccion: '',
    notas: '', empresa_matriz_nombre: '', estado: 'Activo',
    servicios: [], contactos: [],
  })

  useEffect(() => {
    if (visible) {
      setTab('Datos')
      if (empresa) {
        setForm({
          nombre:                empresa.nombre || '',
          cif:                   empresa.cif || '',
          email:                 empresa.email || '',
          telefono:              empresa.telefono || '',
          direccion:             empresa.direccion || '',
          notas:                 empresa.notas || '',
          empresa_matriz_nombre: empresa.empresa_matriz_nombre || '',
          estado:                empresa.estado || 'Activo',
          servicios:             empresa.servicios || [],
          contactos:             (empresa.contactos || []).map(c => ({ ...c })),
        })
      } else {
        setForm({
          nombre: '', cif: '', email: '', telefono: '', direccion: '',
          notas: '', empresa_matriz_nombre: '', estado: 'Activo',
          servicios: [], contactos: [],
        })
      }
    }
  }, [visible, empresa])

  function toggleServicio(s) {
    setForm(f => ({
      ...f,
      servicios: f.servicios.includes(s)
        ? f.servicios.filter(x => x !== s)
        : [...f.servicios, s],
    }))
  }

  function addContacto() {
    setForm(f => ({
      ...f,
      contactos: [...f.contactos, { nombre: '', telefono: '', email: '', cargo: '' }],
    }))
  }

  function updateContacto(idx, field, value) {
    setForm(f => {
      const c = [...f.contactos]
      c[idx] = { ...c[idx], [field]: value }
      return { ...f, contactos: c }
    })
  }

  function removeContacto(idx) {
    setForm(f => ({ ...f, contactos: f.contactos.filter((_, i) => i !== idx) }))
  }

  function handleSave() {
    if (!form.nombre.trim()) { Alert.alert('Error', 'El nombre es obligatorio'); return }
    const { empresa_matriz_nombre, ...saveData } = form
    onSave({ ...saveData, estado: saveData.estado || 'Activo' })
  }

  const s = makeModalStyles(colors)

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={s.sheet}>
          {/* Header */}
          <View style={s.header}>
            <Text style={s.title}>{empresa ? 'Editar empresa' : 'Nueva empresa'}</Text>
            <TouchableOpacity onPress={onClose} style={s.closeBtn}>
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Tabs */}
          <View style={s.tabRow}>
            {MODAL_TABS.map(t => (
              <TouchableOpacity key={t} style={[s.tabBtn, tab === t && s.tabBtnActive]} onPress={() => setTab(t)}>
                <Text style={[s.tabBtnTxt, tab === t && s.tabBtnTxtActive]}>{t}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <ScrollView style={s.body} keyboardShouldPersistTaps="handled">
            {tab === 'Datos' && (
              <View>
                {[
                  { key: 'nombre',   label: 'Nombre *',     placeholder: 'Nombre de la empresa' },
                  { key: 'cif',      label: 'CIF',          placeholder: 'B12345678' },
                  { key: 'email',    label: 'Email',        placeholder: 'empresa@email.com' },
                  { key: 'telefono', label: 'Teléfono',     placeholder: '+34 600 000 000' },
                  { key: 'direccion',label: 'Dirección',    placeholder: 'Calle, número, ciudad' },
                  { key: 'empresa_matriz_nombre', label: 'Empresa matriz', placeholder: 'Opcional' },
                ].map(({ key, label, placeholder }) => (
                  <View key={key} style={s.field}>
                    <Text style={s.fieldLabel}>{label}</Text>
                    <TextInput
                      style={s.input}
                      value={form[key]}
                      onChangeText={v => setForm(f => ({ ...f, [key]: v }))}
                      placeholder={placeholder}
                      placeholderTextColor={colors.textMuted}
                    />
                  </View>
                ))}
                {/* Estado */}
                <View style={s.field}>
                  <Text style={s.fieldLabel}>Estado</Text>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {EMPRESA_ESTADOS.map(e => {
                      const sel = form.estado === e
                      const { bg, text } = getEstadoStyle(e)
                      return (
                        <TouchableOpacity
                          key={e}
                          onPress={() => setForm(f => ({ ...f, estado: e }))}
                          style={{ flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8, borderWidth: 1.5, borderColor: sel ? text : colors.border, backgroundColor: sel ? bg : colors.bg }}
                        >
                          <Text style={{ fontSize: 11, fontWeight: '700', color: sel ? text : colors.textMuted }}>{e}</Text>
                        </TouchableOpacity>
                      )
                    })}
                  </View>
                </View>

                <View style={s.field}>
                  <Text style={s.fieldLabel}>Notas internas</Text>
                  <TextInput
                    style={[s.input, { height: 80, textAlignVertical: 'top', paddingTop: 10 }]}
                    value={form.notas}
                    onChangeText={v => setForm(f => ({ ...f, notas: v }))}
                    placeholder="Notas internas sobre la empresa..."
                    placeholderTextColor={colors.textMuted}
                    multiline
                  />
                </View>
              </View>
            )}

            {tab === 'Servicios' && (
              <View style={s.serviciosGrid}>
                {SERVICIOS.map(sv => {
                  const active = form.servicios.includes(sv)
                  return (
                    <TouchableOpacity
                      key={sv}
                      style={[s.servBadge, active && s.servBadgeActive]}
                      onPress={() => toggleServicio(sv)}
                    >
                      <Ionicons
                        name={active ? 'checkmark-circle' : 'ellipse-outline'}
                        size={16}
                        color={active ? colors.primary : colors.textMuted}
                      />
                      <Text style={[s.servTxt, active && s.servTxtActive]}>{sv}</Text>
                    </TouchableOpacity>
                  )
                })}
              </View>
            )}

            {tab === 'Contactos' && (
              <View>
                {form.contactos.map((c, idx) => (
                  <View key={idx} style={s.contactCard}>
                    <View style={s.contactHeader}>
                      <Text style={s.contactNum}>Contacto {idx + 1}</Text>
                      <TouchableOpacity onPress={() => removeContacto(idx)}>
                        <Ionicons name="trash-outline" size={16} color={colors.danger} />
                      </TouchableOpacity>
                    </View>
                    {[
                      { field: 'nombre',   label: 'Nombre',    placeholder: 'Nombre completo' },
                      { field: 'telefono', label: 'Teléfono',  placeholder: '+34 600 000 000' },
                      { field: 'email',    label: 'Email',     placeholder: 'correo@empresa.com' },
                      { field: 'cargo',    label: 'Cargo',     placeholder: 'Director, IT, etc.' },
                    ].map(({ field, label, placeholder }) => (
                      <View key={field} style={s.contactField}>
                        <Text style={s.contactFieldLabel}>{label}</Text>
                        <TextInput
                          style={s.input}
                          value={c[field]}
                          onChangeText={v => updateContacto(idx, field, v)}
                          placeholder={placeholder}
                          placeholderTextColor={colors.textMuted}
                        />
                      </View>
                    ))}
                  </View>
                ))}
                <TouchableOpacity style={s.addContactBtn} onPress={addContacto}>
                  <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
                  <Text style={s.addContactTxt}>Añadir contacto</Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>

          {/* Footer */}
          <View style={s.footer}>
            <TouchableOpacity style={s.cancelBtn} onPress={onClose}>
              <Text style={s.cancelTxt}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.saveBtn} onPress={handleSave}>
              <Text style={s.saveTxt}>{empresa ? 'Guardar' : 'Crear'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  )
}

function makeModalStyles(colors) {
  return StyleSheet.create({
    overlay:     { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay },
    sheet:       { backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '90%', paddingBottom: 24 },
    header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderBottomColor: colors.border },
    title:       { fontSize: 18, fontWeight: '700', color: colors.text },
    closeBtn:    { padding: 4 },
    tabRow:      { flexDirection: 'row', padding: 12, gap: 8 },
    tabBtn:      { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8, backgroundColor: colors.bg },
    tabBtnActive:{ backgroundColor: colors.primaryBg },
    tabBtnTxt:   { fontSize: 13, fontWeight: '600', color: colors.textMuted },
    tabBtnTxtActive: { color: colors.primary },
    body:        { paddingHorizontal: 20, paddingBottom: 16 },
    field:       { marginBottom: 14 },
    fieldLabel:  { fontSize: 12, fontWeight: '600', color: colors.textMuted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
    input: {
      backgroundColor: colors.inputBg, borderWidth: 1.5, borderColor: colors.inputBorder,
      borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: colors.text,
    },
    segmented:      { flexDirection: 'row', gap: 8 },
    segBtn:         { flex: 1, paddingVertical: 9, alignItems: 'center', borderRadius: 8, borderWidth: 1.5, borderColor: colors.border },
    segBtnActive:   { borderColor: colors.primary, backgroundColor: colors.primaryBg },
    segBtnTxt:      { fontSize: 14, color: colors.textMuted, fontWeight: '500' },
    segBtnTxtActive:{ color: colors.primary, fontWeight: '700' },
    serviciosGrid:  { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingTop: 4 },
    servBadge:      { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.bg },
    servBadgeActive:{ borderColor: colors.primary, backgroundColor: colors.primaryBg },
    servTxt:        { fontSize: 14, color: colors.textMuted, fontWeight: '500' },
    servTxtActive:  { color: colors.primary, fontWeight: '700' },
    contactCard:    { backgroundColor: colors.bg, borderRadius: 10, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: colors.border },
    contactHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    contactNum:     { fontSize: 13, fontWeight: '700', color: colors.text },
    contactField:   { marginBottom: 10 },
    contactFieldLabel: { fontSize: 11, fontWeight: '600', color: colors.textMuted, marginBottom: 4, textTransform: 'uppercase' },
    addContactBtn:  { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 14, justifyContent: 'center' },
    addContactTxt:  { fontSize: 14, color: colors.primary, fontWeight: '600' },
    footer:         { flexDirection: 'row', gap: 12, paddingHorizontal: 20, paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.border },
    cancelBtn:      { flex: 1, paddingVertical: 13, alignItems: 'center', borderRadius: 8, borderWidth: 1.5, borderColor: colors.border },
    cancelTxt:      { fontSize: 15, fontWeight: '600', color: colors.textMuted },
    saveBtn:        { flex: 2, paddingVertical: 13, alignItems: 'center', borderRadius: 8, backgroundColor: colors.primary },
    saveTxt:        { fontSize: 15, fontWeight: '700', color: '#ffffff' },
  })
}

// ── Estado badge ──────────────────────────────────────────────────────────────
const EMPRESA_ESTADOS = ['Activo', 'En revisión', 'Suspendido']

function getEstadoStyle(estado) {
  const e = String(estado || 'Activo')
  if (e === 'Activo')      return { bg: '#dcfce7', text: '#16a34a' }
  if (e === 'En revisión') return { bg: '#fef9c3', text: '#b45309' }
  return                          { bg: '#fee2e2', text: '#dc2626' }
}

function EstadoBadge({ estado, colors }) {
  const { bg, text } = getEstadoStyle(estado)
  return (
    <View style={{ paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20, alignSelf: 'flex-start', backgroundColor: bg }}>
      <Text style={{ fontSize: 11, fontWeight: '700', color: text }}>
        {estado || 'Activo'}
      </Text>
    </View>
  )
}

// ── Empresa card ──────────────────────────────────────────────────────────────
function EmpresaCard({ empresa, onPress, onEdit, onDelete, colors, isMatriz, isFilial, isExpanded, onToggleExpand, filialesCount }) {
  return (
    <View style={[
      cardStyles.card,
      { backgroundColor: colors.card, borderColor: colors.border },
      isFilial && cardStyles.filialCard,
    ]}>
      {/* Tappable header area (toggles expand for matrices, navigates for others) */}
      <TouchableOpacity
        onPress={isMatriz ? onToggleExpand : onPress}
        activeOpacity={0.8}
      >
        <View style={cardStyles.top}>
          {isFilial && (
            <Text style={[cardStyles.filialArrow, { color: colors.textMuted }]}>{'→'}</Text>
          )}
          <View style={[cardStyles.avatar, { backgroundColor: getAvatarColor(empresa.id) }]}>
            <Text style={cardStyles.avatarTxt}>{getInitials(empresa.nombre)}</Text>
          </View>
          <View style={cardStyles.info}>
            <Text style={[cardStyles.nombre, { color: colors.text }]} numberOfLines={1}>{empresa.nombre}</Text>
            {empresa.cif ? <Text style={[cardStyles.cif, { color: colors.textMuted }]}>{empresa.cif}</Text> : null}
          </View>
          {isMatriz && (
            <View style={[cardStyles.filialBadge, { backgroundColor: colors.primaryBg }]}>
              <Text style={[cardStyles.filialBadgeTxt, { color: colors.primary }]}>{filialesCount}</Text>
            </View>
          )}
          {isMatriz && (
            <Ionicons
              name={isExpanded ? 'chevron-down' : 'chevron-forward'}
              size={18}
              color={colors.textMuted}
              style={{ marginLeft: 4 }}
            />
          )}
          {!isMatriz && <EstadoBadge estado={empresa.estado} colors={colors} />}
        </View>
        {isMatriz && (
          <View style={{ marginTop: 2, marginBottom: 6 }}>
            <EstadoBadge estado={empresa.estado} colors={colors} />
          </View>
        )}

        {(empresa.email || empresa.telefono) && (
          <View style={cardStyles.row}>
            {empresa.email ? (
              <View style={cardStyles.detail}>
                <Ionicons name="mail-outline" size={12} color={colors.textMuted} />
                <Text style={[cardStyles.detailTxt, { color: colors.textMuted }]} numberOfLines={1}>{empresa.email}</Text>
              </View>
            ) : null}
            {empresa.telefono ? (
              <View style={cardStyles.detail}>
                <Ionicons name="call-outline" size={12} color={colors.textMuted} />
                <Text style={[cardStyles.detailTxt, { color: colors.textMuted }]}>{empresa.telefono}</Text>
              </View>
            ) : null}
          </View>
        )}

        {empresa.servicios && empresa.servicios.length > 0 && (
          <View style={cardStyles.servicios}>
            {empresa.servicios.slice(0, 4).map(s => (
              <View key={s} style={[cardStyles.servBadge, { backgroundColor: colors.primaryBg }]}>
                <Text style={[cardStyles.servTxt, { color: colors.primary }]}>{s}</Text>
              </View>
            ))}
            {empresa.servicios.length > 4 && (
              <View style={[cardStyles.servBadge, { backgroundColor: colors.badgeGray }]}>
                <Text style={[cardStyles.servTxt, { color: colors.textMuted }]}>+{empresa.servicios.length - 4}</Text>
              </View>
            )}
          </View>
        )}
      </TouchableOpacity>

      <View style={[cardStyles.actions, { borderTopColor: colors.border }]}>
        {isMatriz && (
          <TouchableOpacity style={cardStyles.actionBtn} onPress={onPress}>
            <Ionicons name="eye-outline" size={15} color={colors.primary} />
            <Text style={[cardStyles.actionTxt, { color: colors.primary }]}>Ver</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={cardStyles.actionBtn} onPress={() => onEdit(empresa)}>
          <Ionicons name="pencil-outline" size={15} color={colors.primary} />
          <Text style={[cardStyles.actionTxt, { color: colors.primary }]}>Editar</Text>
        </TouchableOpacity>
        <TouchableOpacity style={cardStyles.actionBtn} onPress={() => onDelete(empresa)}>
          <Ionicons name="trash-outline" size={15} color={colors.danger} />
          <Text style={[cardStyles.actionTxt, { color: colors.danger }]}>Eliminar</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const cardStyles = StyleSheet.create({
  card:         { borderRadius: 12, borderWidth: 1, marginBottom: 12, padding: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  filialCard:   { marginLeft: 16, borderStyle: 'dashed' },
  top:          { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  avatar:       { width: 42, height: 42, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarTxt:    { color: '#fff', fontWeight: '800', fontSize: 15 },
  info:         { flex: 1 },
  nombre:       { fontSize: 15, fontWeight: '700' },
  cif:          { fontSize: 12, marginTop: 2 },
  row:          { flexDirection: 'row', gap: 16, marginBottom: 8, flexWrap: 'wrap' },
  detail:       { flexDirection: 'row', alignItems: 'center', gap: 4 },
  detailTxt:    { fontSize: 12 },
  servicios:    { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  servBadge:    { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  servTxt:      { fontSize: 11, fontWeight: '600' },
  actions:      { flexDirection: 'row', borderTopWidth: 1, paddingTop: 10, gap: 16 },
  actionBtn:    { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionTxt:    { fontSize: 13, fontWeight: '600' },
  filialArrow:  { fontSize: 16, fontWeight: '700', marginRight: -4 },
  filialBadge:  { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, marginRight: 2 },
  filialBadgeTxt: { fontSize: 12, fontWeight: '700' },
})

export default function EmpresasScreen({ navigation }) {
  const { user, logout } = useAuth()
  const { colors, isDark, toggleTheme } = useTheme()
  const [empresas, setEmpresas]       = useState([])
  const [loading, setLoading]         = useState(true)
  const [refreshing, setRefreshing]   = useState(false)
  const [search, setSearch]           = useState('')
  const [showModal, setShowModal]     = useState(false)
  const [editingEmpresa, setEditingEmpresa] = useState(null)
  const [expandedMatrices, setExpandedMatrices] = useState({})
  const [page, setPage]               = useState(1)

  const load = useCallback(async () => {
    try {
      const data = await getEmpresas()
      setEmpresas(Array.isArray(data) ? data : [])
    } catch (e) {
      Alert.alert('Error', e.message)
    }
  }, [])

  useEffect(() => {
    load().finally(() => setLoading(false))
  }, [])

  async function onRefresh() {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }

  // Tree helpers
  function isMatriz(emp) {
    return empresas.some(e => e.empresa_matriz_id === emp.id)
  }

  function getFiliales(id) {
    return empresas.filter(e => e.empresa_matriz_id === id)
  }

  function toggleExpand(id) {
    setExpandedMatrices(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const searchActive = search.trim().length > 0

  // When search changes, reset page
  function handleSearchChange(text) {
    setSearch(text)
    setPage(1)
  }

  // Filtered list
  const allFiltered = searchActive
    ? empresas.filter(e =>
        e.nombre?.toLowerCase().includes(search.toLowerCase()) ||
        e.cif?.toLowerCase().includes(search.toLowerCase()) ||
        e.email?.toLowerCase().includes(search.toLowerCase())
      )
    : null

  // Root companies: no empresa_matriz_id (or matriz_id is null/undefined)
  const filteredRoot = searchActive
    ? allFiltered
    : empresas.filter(e => !e.empresa_matriz_id).sort((a, b) => (isMatriz(b) ? 1 : 0) - (isMatriz(a) ? 1 : 0))

  const paginatedRoot = filteredRoot.slice(0, page * PAGE_SIZE)
  const hasMore = filteredRoot.length > page * PAGE_SIZE
  const total = empresas.length

  async function handleSave(form) {
    try {
      if (editingEmpresa) {
        await updateEmpresa(editingEmpresa.id, form)
      } else {
        await createEmpresa({ ...form, estado: form.estado || 'Activo' })
      }
      setShowModal(false)
      setEditingEmpresa(null)
      await load()
    } catch (e) {
      Alert.alert('Error', e.message)
    }
  }

  function handleEdit(empresa) {
    setEditingEmpresa(empresa)
    setShowModal(true)
  }

  function handleDelete(empresa) {
    Alert.alert(
      'Eliminar empresa',
      `¿Eliminar "${empresa.nombre}"? Esta acción no se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar', style: 'destructive',
          onPress: async () => {
            try {
              await deleteEmpresa(empresa.id)
              await load()
            } catch (e) {
              Alert.alert('Error', e.message)
            }
          },
        },
      ]
    )
  }

  // Build the flat list of items to render (root + expanded filiales inline)
  function buildListItems() {
    const items = []
    for (const emp of paginatedRoot) {
      const matriz = !searchActive && isMatriz(emp)
      const filiales = matriz ? getFiliales(emp.id) : []
      items.push({ type: 'empresa', empresa: emp, isMatriz: matriz, isFilial: false, filialesCount: filiales.length })
      if (matriz && expandedMatrices[emp.id]) {
        for (const fil of filiales) {
          items.push({ type: 'empresa', empresa: fil, isMatriz: false, isFilial: true, filialesCount: 0 })
        }
      }
    }
    return items
  }

  const listItems = buildListItems()

  const s = makeStyles(colors)

  if (loading) {
    return (
      <View style={[s.center, { backgroundColor: colors.bg }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    )
  }

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: colors.bg }]}>
      {/* Header */}
      <View style={[s.header, { backgroundColor: colors.headerBg, borderBottomColor: colors.border }]}>
        <View style={s.headerLeft}>
          <Text style={[s.headerTitle, { color: colors.text }]}>Empresas</Text>
          <Text style={[s.headerSub, { color: colors.textMuted }]}>Gestión integral de clientes</Text>
        </View>
        <View style={s.headerRight}>
          <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: getAvatarColor(user?.id), alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>{getInitials(user?.nombre || user?.email)}</Text>
          </View>
          <Text style={{ fontSize: 12, color: colors.textMuted, maxWidth: 100 }} numberOfLines={1}>{(user?.nombre || user?.email || '').substring(0, 14)}</Text>
          <TouchableOpacity onPress={toggleTheme} style={s.iconBtn}>
            <Ionicons name={isDark ? 'sunny-outline' : 'moon-outline'} size={20} color={colors.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => Alert.alert('Cerrar sesión', '¿Cerrar sesión?', [
              { text: 'Cancelar', style: 'cancel' },
              { text: 'Salir', style: 'destructive', onPress: logout },
            ])}
            style={s.iconBtn}
          >
            <Ionicons name="log-out-outline" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Search + New */}
      <View style={s.toolsRow}>
        <View style={[s.searchBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Ionicons name="search-outline" size={16} color={colors.textMuted} />
          <TextInput
            style={[s.searchInput, { color: colors.text }]}
            placeholder="Buscar empresa..."
            placeholderTextColor={colors.textMuted}
            value={search}
            onChangeText={handleSearchChange}
          />
          {search ? (
            <TouchableOpacity onPress={() => handleSearchChange('')}>
              <Ionicons name="close-circle" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>
        <TouchableOpacity
          style={[s.newBtn, { backgroundColor: colors.primary }]}
          onPress={() => { setEditingEmpresa(null); setShowModal(true) }}
        >
          <Ionicons name="add" size={20} color="#fff" />
          <Text style={s.newBtnTxt}>Nueva</Text>
        </TouchableOpacity>
      </View>

      {/* List */}
      <FlatList
        data={listItems}
        keyExtractor={(item, index) => `${item.isFilial ? 'fil' : 'root'}-${item.empresa.id}-${index}`}
        contentContainerStyle={{ padding: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        renderItem={({ item }) => (
          <EmpresaCard
            empresa={item.empresa}
            colors={colors}
            isMatriz={item.isMatriz}
            isFilial={item.isFilial}
            isExpanded={!!expandedMatrices[item.empresa.id]}
            filialesCount={item.filialesCount}
            onToggleExpand={() => toggleExpand(item.empresa.id)}
            onPress={() => navigation.navigate('EmpresaDetalle', { empresa: item.empresa, allEmpresas: empresas })}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        )}
        ListEmptyComponent={
          <View style={s.empty}>
            <Ionicons name="business-outline" size={48} color={colors.textMuted} />
            <Text style={[s.emptyTxt, { color: colors.textMuted }]}>
              {search ? 'Sin resultados' : 'No hay empresas'}
            </Text>
          </View>
        }
        ListFooterComponent={
          hasMore ? (
            <TouchableOpacity
              style={[s.loadMoreBtn, { borderColor: colors.border }]}
              onPress={() => setPage(p => p + 1)}
            >
              <Text style={[s.loadMoreTxt, { color: colors.primary }]}>Cargar más</Text>
            </TouchableOpacity>
          ) : null
        }
      />

      {/* Modal */}
      <EmpresaModal
        visible={showModal}
        empresa={editingEmpresa}
        onClose={() => { setShowModal(false); setEditingEmpresa(null) }}
        onSave={handleSave}
        colors={colors}
      />
    </SafeAreaView>
  )
}

function makeStyles(colors) {
  return StyleSheet.create({
    safe:        { flex: 1 },
    center:      { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
    headerLeft:  { flex: 1 },
    headerTitle: { fontSize: 22, fontWeight: '800' },
    headerSub:   { fontSize: 12, marginTop: 2 },
    headerRight: { flexDirection: 'row', gap: 8, alignItems: 'center' },
    iconBtn:     { padding: 6 },
    toolsRow:    { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
    searchBox:   { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 9 },
    searchInput: { flex: 1, fontSize: 14 },
    newBtn:      { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10 },
    newBtnTxt:   { color: '#fff', fontWeight: '700', fontSize: 14 },
    empty:       { alignItems: 'center', paddingTop: 60, gap: 12 },
    emptyTxt:    { fontSize: 15, fontWeight: '500' },
    loadMoreBtn: { alignItems: 'center', paddingVertical: 14, marginTop: 4, borderRadius: 10, borderWidth: 1 },
    loadMoreTxt: { fontSize: 14, fontWeight: '700' },
  })
}
