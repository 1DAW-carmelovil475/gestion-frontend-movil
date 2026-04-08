import { useState, useEffect, useCallback } from 'react'
import {
  View, Text, StyleSheet, FlatList, SectionList, TouchableOpacity, TextInput,
  ActivityIndicator, Alert, RefreshControl, Modal, ScrollView,
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import {
  getTickets, createTicket, updateTicket, deleteTicket,
  getEmpresas, getOperarios, getDispositivos,
  assignOperarios, removeOperario,
  updateEmpresa, createDispositivo,
  getUsuarios, updateUsuario,
} from '../services/api'

const ESTADOS = ['Pendiente', 'En curso', 'Completado', 'Pendiente de facturar', 'Facturado']
const PRIORIDADES = ['Baja', 'Media', 'Alta', 'Urgente']
const DEVICE_CATEGORIAS = [
  { key: 'equipo',   label: 'Equipos',    icon: 'desktop-outline' },
  { key: 'servidor', label: 'Servidores', icon: 'server-outline' },
  { key: 'nas',      label: 'NAS',        icon: 'save-outline' },
  { key: 'red',      label: 'Redes',      icon: 'wifi-outline' },
  { key: 'web',      label: 'Web',        icon: 'globe-outline' },
]
const DEVICE_TIPO_SUGERENCIAS = {
  equipo:   ['PC', 'Portátil', 'Cámara de Seguridad', 'Impresora', 'Tablet', 'All-in-One'],
  servidor: ['Servidor Físico', 'Servidor Virtual', 'Servidor de Archivos'],
  nas:      ['NAS Synology', 'NAS QNAP'],
  red:      ['Router', 'Switch', 'Access Point', 'Firewall', 'Modem'],
  web:      ['Web corporativa', 'Tienda online', 'Portal', 'Aplicación web'],
}
const PAGE_SIZE = 25

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
  return new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: '2-digit' })
}

function formatHoras(h) {
  if (!h || h <= 0) return '0min'
  if (h < 1) return `${Math.round(h * 60)}min`
  if (h < 24) { const hrs = Math.floor(h); const min = Math.round((h - hrs) * 60); return min > 0 ? `${hrs}h ${min}min` : `${hrs}h` }
  const dias = Math.floor(h / 24); return `${dias}d`
}

function PrioridadBadge({ p, colors }) {
  const cfg = {
    Urgente: { bg: colors.dangerBg,  txt: colors.danger },
    Alta:    { bg: colors.warningBg, txt: colors.warning },
    Media:   { bg: colors.infoBg,    txt: colors.info },
    Baja:    { bg: colors.badgeGray, txt: colors.textMuted },
  }
  const c = cfg[p] || cfg.Baja
  return (
    <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, backgroundColor: c.bg }}>
      <Text style={{ fontSize: 10, fontWeight: '700', color: c.txt }}>{p}</Text>
    </View>
  )
}

function EstadoBadge({ e, colors }) {
  const cfg = {
    'Pendiente':             { bg: colors.warningBg,  txt: colors.warning },
    'En curso':              { bg: colors.infoBg,     txt: colors.info },
    'Completado':            { bg: colors.successBg,  txt: colors.success },
    'Pendiente de facturar': { bg: colors.purpleBg,   txt: colors.purple },
    'Facturado':             { bg: colors.cyanBg,     txt: colors.cyan },
  }
  const c = cfg[e] || { bg: colors.badgeGray, txt: colors.textMuted }
  return (
    <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, backgroundColor: c.bg }}>
      <Text style={{ fontSize: 10, fontWeight: '700', color: c.txt }}>{e}</Text>
    </View>
  )
}

// ─── Searchable single-select dropdown ────────────────────────────────────────
function SearchableSelect({ label, placeholder, items, selectedId, onSelect, colors }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const selected = items.find(i => i.id === selectedId)
  const filtered = query.trim()
    ? items.filter(i => i.nombre?.toLowerCase().includes(query.trim().toLowerCase()))
    : items

  function handleSelect(item) {
    onSelect(item.id)
    setOpen(false)
    setQuery('')
  }

  return (
    <View style={{ marginBottom: 14 }}>
      {label ? (
        <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textMuted, marginBottom: 6, textTransform: 'uppercase' }}>
          {label}
        </Text>
      ) : null}

      {/* Trigger button */}
      <TouchableOpacity
        onPress={() => { setQuery(''); setOpen(o => !o) }}
        style={{
          flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
          backgroundColor: colors.inputBg, borderWidth: 1.5,
          borderColor: open ? colors.primary : (selectedId ? colors.primary : colors.inputBorder),
          borderRadius: open ? 8 : 8, paddingHorizontal: 12, paddingVertical: 11,
        }}
      >
        <Text style={{ fontSize: 14, color: selected ? colors.text : colors.textMuted, flex: 1 }} numberOfLines={1}>
          {selected ? selected.nombre : placeholder || 'Seleccionar...'}
        </Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textMuted} />
      </TouchableOpacity>

      {/* Inline dropdown — no nested Modal */}
      {open && (
        <View style={{ borderWidth: 1.5, borderColor: colors.primary, borderTopWidth: 0, borderBottomLeftRadius: 8, borderBottomRightRadius: 8, backgroundColor: colors.card, overflow: 'hidden', maxHeight: 260 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <Ionicons name="search-outline" size={14} color={colors.textMuted} />
            <TextInput
              style={{ flex: 1, fontSize: 13, color: colors.text }}
              placeholder="Buscar..."
              placeholderTextColor={colors.textMuted}
              value={query}
              onChangeText={setQuery}
              autoFocus
            />
            {query ? (
              <TouchableOpacity onPress={() => setQuery('')}>
                <Ionicons name="close-circle" size={14} color={colors.textMuted} />
              </TouchableOpacity>
            ) : null}
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 200 }} nestedScrollEnabled>
            {filtered.length === 0 ? (
              <View style={{ paddingVertical: 16, alignItems: 'center' }}>
                <Text style={{ color: colors.textMuted, fontSize: 13 }}>Sin resultados</Text>
              </View>
            ) : (
              filtered.map((item, idx) => (
                <TouchableOpacity
                  key={item.id}
                  onPress={() => handleSelect(item)}
                  style={{
                    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                    paddingHorizontal: 14, paddingVertical: 11,
                    borderBottomWidth: idx < filtered.length - 1 ? 1 : 0,
                    borderBottomColor: colors.border,
                    backgroundColor: item.id === selectedId ? colors.primaryBg : 'transparent',
                  }}
                >
                  <Text style={{ fontSize: 14, color: item.id === selectedId ? colors.primary : colors.text, fontWeight: item.id === selectedId ? '700' : '400', flex: 1 }} numberOfLines={1}>
                    {item.nombre}
                  </Text>
                  {item.id === selectedId && (
                    <Ionicons name="checkmark" size={16} color={colors.primary} />
                  )}
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        </View>
      )}
    </View>
  )
}

// ─── Searchable multi-select for operarios ────────────────────────────────────
function SearchableMultiSelect({ label, placeholder, items, selectedIds, onToggle, colors }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const filtered = query.trim()
    ? items.filter(i => i.nombre?.toLowerCase().includes(query.trim().toLowerCase()))
    : items

  const selectedItems = items.filter(i => selectedIds.includes(i.id))

  function handleOpen() {
    setQuery('')
    setOpen(true)
  }

  return (
    <View style={{ marginBottom: 14 }}>
      {label ? (
        <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textMuted, marginBottom: 6, textTransform: 'uppercase' }}>
          {label}
        </Text>
      ) : null}

      {/* Trigger button */}
      <TouchableOpacity
        onPress={handleOpen}
        style={{
          flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
          backgroundColor: colors.inputBg, borderWidth: 1.5,
          borderColor: selectedIds.length > 0 ? colors.primary : colors.inputBorder,
          borderRadius: 8, paddingHorizontal: 12, paddingVertical: 11,
        }}
      >
        <Text style={{ fontSize: 14, color: selectedIds.length > 0 ? colors.text : colors.textMuted, flex: 1 }}>
          {selectedIds.length > 0 ? `${selectedIds.length} operario${selectedIds.length !== 1 ? 's' : ''} seleccionado${selectedIds.length !== 1 ? 's' : ''}` : (placeholder || 'Seleccionar operarios...')}
        </Text>
        <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
      </TouchableOpacity>

      {/* Selected chips */}
      {selectedItems.length > 0 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
          {selectedItems.map(op => (
            <View
              key={op.id}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 16, backgroundColor: colors.primaryBg, borderWidth: 1, borderColor: colors.primary }}
            >
              <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: getAvatarColor(op.id), alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 8, color: '#fff', fontWeight: '700' }}>{getInitials(op.nombre)}</Text>
              </View>
              <Text style={{ fontSize: 12, fontWeight: '600', color: colors.primary }}>{op.nombre?.split(' ')[0]}</Text>
              <TouchableOpacity onPress={() => onToggle(op.id)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                <Ionicons name="close-circle" size={14} color={colors.primary} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {/* Inline dropdown */}
      {open && (
        <View style={{ borderWidth: 1.5, borderColor: colors.inputBorder, borderRadius: 8, marginTop: 4, backgroundColor: colors.card, overflow: 'hidden' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <Ionicons name="search-outline" size={15} color={colors.textMuted} />
            <TextInput
              style={{ flex: 1, fontSize: 13, color: colors.text }}
              placeholder="Buscar operario..."
              placeholderTextColor={colors.textMuted}
              value={query}
              onChangeText={setQuery}
            />
            {query ? <TouchableOpacity onPress={() => setQuery('')}><Ionicons name="close-circle" size={15} color={colors.textMuted} /></TouchableOpacity> : null}
          </View>
          {filtered.length === 0 ? (
            <View style={{ paddingVertical: 16, alignItems: 'center' }}>
              <Text style={{ color: colors.textMuted, fontSize: 13 }}>Sin resultados</Text>
            </View>
          ) : (
            filtered.map((item, idx) => {
              const sel = selectedIds.includes(item.id)
              return (
                <TouchableOpacity
                  key={item.id}
                  onPress={() => onToggle(item.id)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: idx < filtered.length - 1 ? 1 : 0, borderBottomColor: colors.border, backgroundColor: sel ? colors.primaryBg : 'transparent' }}
                >
                  <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: getAvatarColor(item.id), alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 10, color: '#fff', fontWeight: '700' }}>{getInitials(item.nombre)}</Text>
                  </View>
                  <Text style={{ flex: 1, fontSize: 13, color: sel ? colors.primary : colors.text, fontWeight: sel ? '700' : '400' }} numberOfLines={1}>{item.nombre}</Text>
                  {sel && <Ionicons name="checkmark-circle" size={18} color={colors.primary} />}
                </TouchableOpacity>
              )
            })
          )}
          <TouchableOpacity onPress={() => { setOpen(false); setQuery('') }} style={{ margin: 10, paddingVertical: 10, alignItems: 'center', borderRadius: 8, backgroundColor: colors.primary }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#fff' }}>{selectedIds.length > 0 ? `Confirmar (${selectedIds.length})` : 'Cerrar'}</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  )
}

// ─── CrearContactoModal ───────────────────────────────────────────────────────
function CrearContactoModal({ visible, empresaId, empresas, onClose, onSaved, colors }) {
  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')
  const [email, setEmail] = useState('')
  const [cargo, setCargo] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (visible) { setNombre(''); setTelefono(''); setEmail(''); setCargo('') }
  }, [visible])

  async function handleSave() {
    if (!nombre.trim()) { Alert.alert('Error', 'El nombre es obligatorio'); return }
    setSaving(true)
    try {
      const empresa = empresas.find(e => e.id === empresaId)
      const newContact = { nombre: nombre.trim(), telefono: telefono.trim() || null, email: email.trim() || null, cargo: cargo.trim() || null }
      const nuevosContactos = [...(empresa?.contactos || []), newContact]
      await updateEmpresa(empresaId, { ...empresa, contactos: nuevosContactos })
      onSaved(newContact, nuevosContactos)
    } catch (e) { Alert.alert('Error', e.message) }
    finally { setSaving(false) }
  }

  const inp = { backgroundColor: colors.inputBg, borderWidth: 1.5, borderColor: colors.inputBorder, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: colors.text }
  const lbl = { fontSize: 11, fontWeight: '700', color: colors.textMuted, marginBottom: 6, textTransform: 'uppercase' }

  if (!visible) return null
  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'flex-end', backgroundColor: colors.overlay, zIndex: 999 }}>
      <View style={{ backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '80%', paddingBottom: 24 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text }}>Nuevo contacto</Text>
            <TouchableOpacity onPress={onClose}><Ionicons name="close" size={22} color={colors.textMuted} /></TouchableOpacity>
          </View>
          <ScrollView style={{ padding: 20 }} keyboardShouldPersistTaps="handled">
            <View style={{ marginBottom: 14 }}>
              <Text style={lbl}>Nombre *</Text>
              <TextInput style={inp} value={nombre} onChangeText={setNombre} placeholder="Nombre del contacto" placeholderTextColor={colors.textMuted} />
            </View>
            <View style={{ marginBottom: 14 }}>
              <Text style={lbl}>Teléfono</Text>
              <TextInput style={inp} value={telefono} onChangeText={setTelefono} placeholder="612 345 678" placeholderTextColor={colors.textMuted} keyboardType="phone-pad" />
            </View>
            <View style={{ marginBottom: 14 }}>
              <Text style={lbl}>Email</Text>
              <TextInput style={inp} value={email} onChangeText={setEmail} placeholder="contacto@empresa.com" placeholderTextColor={colors.textMuted} keyboardType="email-address" autoCapitalize="none" />
            </View>
            <View style={{ marginBottom: 14 }}>
              <Text style={lbl}>Cargo</Text>
              <TextInput style={inp} value={cargo} onChangeText={setCargo} placeholder="Ej: Responsable IT, Gerente..." placeholderTextColor={colors.textMuted} />
            </View>
          </ScrollView>
          <View style={{ flexDirection: 'row', gap: 12, paddingHorizontal: 20, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border }}>
            <TouchableOpacity style={{ flex: 1, paddingVertical: 13, alignItems: 'center', borderRadius: 8, borderWidth: 1.5, borderColor: colors.border }} onPress={onClose}>
              <Text style={{ fontSize: 15, fontWeight: '600', color: colors.textMuted }}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={{ flex: 2, paddingVertical: 13, alignItems: 'center', borderRadius: 8, backgroundColor: colors.primary, opacity: saving ? 0.7 : 1 }} onPress={handleSave} disabled={saving}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: '#ffffff' }}>{saving ? 'Guardando...' : 'Guardar contacto'}</Text>
            </TouchableOpacity>
          </View>
        </View>
    </View>
  )
}

// ─── EditarContactoModal ──────────────────────────────────────────────────────
function EditarContactoModal({ visible, empresaId, empresas, contacto, onClose, onSaved, colors }) {
  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')
  const [email, setEmail] = useState('')
  const [cargo, setCargo] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (visible && contacto) {
      setNombre(contacto.nombre || '')
      setTelefono(contacto.telefono || '')
      setEmail(contacto.email || '')
      setCargo(contacto.cargo || '')
    }
  }, [visible, contacto])

  async function handleSave() {
    if (!nombre.trim()) { Alert.alert('Error', 'El nombre es obligatorio'); return }
    setSaving(true)
    try {
      const empresa = empresas.find(e => e.id === empresaId)
      const updatedContacto = { nombre: nombre.trim(), telefono: telefono.trim() || null, email: email.trim() || null, cargo: cargo.trim() || null }
      const nuevosContactos = (empresa?.contactos || []).map(c => c.nombre === contacto.nombre ? updatedContacto : c)
      await updateEmpresa(empresaId, { ...empresa, contactos: nuevosContactos })
      onSaved(updatedContacto, nuevosContactos)
    } catch (e) { Alert.alert('Error', e.message) }
    finally { setSaving(false) }
  }

  const inp = { backgroundColor: colors.inputBg, borderWidth: 1.5, borderColor: colors.inputBorder, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: colors.text }
  const lbl = { fontSize: 11, fontWeight: '700', color: colors.textMuted, marginBottom: 6, textTransform: 'uppercase' }

  if (!visible) return null
  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'flex-end', backgroundColor: colors.overlay, zIndex: 999 }}>
      <View style={{ backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '80%', paddingBottom: 24 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderBottomColor: colors.border }}>
          <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text }}>Editar contacto</Text>
          <TouchableOpacity onPress={onClose}><Ionicons name="close" size={22} color={colors.textMuted} /></TouchableOpacity>
        </View>
        <ScrollView style={{ padding: 20 }} keyboardShouldPersistTaps="handled">
          <View style={{ marginBottom: 14 }}><Text style={lbl}>Nombre *</Text><TextInput style={inp} value={nombre} onChangeText={setNombre} placeholder="Nombre del contacto" placeholderTextColor={colors.textMuted} /></View>
          <View style={{ marginBottom: 14 }}><Text style={lbl}>Teléfono</Text><TextInput style={inp} value={telefono} onChangeText={setTelefono} placeholder="612 345 678" placeholderTextColor={colors.textMuted} keyboardType="phone-pad" /></View>
          <View style={{ marginBottom: 14 }}><Text style={lbl}>Email</Text><TextInput style={inp} value={email} onChangeText={setEmail} placeholder="contacto@empresa.com" placeholderTextColor={colors.textMuted} keyboardType="email-address" autoCapitalize="none" /></View>
          <View style={{ marginBottom: 14 }}><Text style={lbl}>Cargo</Text><TextInput style={inp} value={cargo} onChangeText={setCargo} placeholder="Ej: Responsable IT, Gerente..." placeholderTextColor={colors.textMuted} /></View>
        </ScrollView>
        <View style={{ flexDirection: 'row', gap: 12, paddingHorizontal: 20, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border }}>
          <TouchableOpacity style={{ flex: 1, paddingVertical: 13, alignItems: 'center', borderRadius: 8, borderWidth: 1.5, borderColor: colors.border }} onPress={onClose}>
            <Text style={{ fontSize: 15, fontWeight: '600', color: colors.textMuted }}>Cancelar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={{ flex: 2, paddingVertical: 13, alignItems: 'center', borderRadius: 8, backgroundColor: colors.primary, opacity: saving ? 0.7 : 1 }} onPress={handleSave} disabled={saving}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: '#ffffff' }}>{saving ? 'Guardando...' : 'Guardar cambios'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  )
}

// ─── AñadirDispositivoModal ───────────────────────────────────────────────────
function AñadirDispositivoModal({ visible, empresaId, onClose, onSaved, colors }) {
  const [step, setStep] = useState('select')
  const [categoria, setCategoria] = useState('')
  const [form, setForm] = useState({})
  const [extraFields, setExtraFields] = useState([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (visible) { setStep('select'); setCategoria(''); setForm({}); setExtraFields([]) }
  }, [visible])

  function selectCategoria(cat) {
    setCategoria(cat)
    setForm({})
    setExtraFields([])
    setStep('form')
  }

  function f(key) { return form[key] || '' }
  function setF(key, val) { setForm(prev => ({ ...prev, [key]: val })) }

  async function handleSave() {
    if (!f('nombre').trim()) { Alert.alert('Error', 'El nombre es obligatorio'); return }
    if (categoria === 'equipo' && !f('numero_serie').trim()) { Alert.alert('Error', 'El número de serie es obligatorio'); return }
    const campos_extra = {}
    extraFields.forEach(({ key, val }) => { if (key.trim()) campos_extra[key.trim()] = val })
    setSaving(true)
    try {
      const payload = { ...form, empresa_id: empresaId, categoria, campos_extra }
      const newDevice = await createDispositivo(payload)
      onSaved(newDevice)
    } catch (e) { Alert.alert('Error', e.message) }
    finally { setSaving(false) }
  }

  const inp = { backgroundColor: colors.inputBg, borderWidth: 1.5, borderColor: colors.inputBorder, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: colors.text }
  const lbl = { fontSize: 11, fontWeight: '700', color: colors.textMuted, marginBottom: 6, textTransform: 'uppercase' }
  const sugerencias = DEVICE_TIPO_SUGERENCIAS[categoria] || []

  if (!visible) return null
  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'flex-end', backgroundColor: colors.overlay, zIndex: 999 }}>
      <View style={{ backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '90%', paddingBottom: 24 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              {step === 'form' && (
                <TouchableOpacity onPress={() => setStep('select')}>
                  <Ionicons name="arrow-back" size={22} color={colors.primary} />
                </TouchableOpacity>
              )}
              <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text }}>
                {step === 'select' ? 'Añadir dispositivo' : DEVICE_CATEGORIAS.find(c => c.key === categoria)?.label || 'Dispositivo'}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose}><Ionicons name="close" size={22} color={colors.textMuted} /></TouchableOpacity>
          </View>

          {step === 'select' ? (
            <View style={{ padding: 20 }}>
              <Text style={{ fontSize: 13, color: colors.textMuted, marginBottom: 16 }}>Selecciona el tipo de dispositivo:</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                {DEVICE_CATEGORIAS.map(cat => (
                  <TouchableOpacity
                    key={cat.key}
                    onPress={() => selectCategoria(cat.key)}
                    style={{ width: '45%', paddingVertical: 18, alignItems: 'center', gap: 8, borderRadius: 12, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.bg }}
                  >
                    <Ionicons name={cat.icon} size={28} color={colors.primary} />
                    <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text }}>{cat.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ) : (
            <ScrollView style={{ padding: 20 }} keyboardShouldPersistTaps="handled">
              {/* Nombre */}
              <View style={{ marginBottom: 14 }}>
                <Text style={lbl}>Nombre *</Text>
                <TextInput style={inp} value={f('nombre')} onChangeText={v => setF('nombre', v)} placeholder="Nombre del dispositivo" placeholderTextColor={colors.textMuted} />
              </View>
              {/* Tipo con sugerencias */}
              <View style={{ marginBottom: 14 }}>
                <Text style={lbl}>Tipo</Text>
                <TextInput style={{ ...inp, marginBottom: sugerencias.length ? 8 : 0 }} value={f('tipo')} onChangeText={v => setF('tipo', v)} placeholder="Selecciona o escribe..." placeholderTextColor={colors.textMuted} />
                {sugerencias.length > 0 && (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      {sugerencias.map(s => (
                        <TouchableOpacity key={s} onPress={() => setF('tipo', s)}
                          style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1.5, borderColor: f('tipo') === s ? colors.primary : colors.border, backgroundColor: f('tipo') === s ? colors.primaryBg : colors.bg }}>
                          <Text style={{ fontSize: 12, fontWeight: '600', color: f('tipo') === s ? colors.primary : colors.textMuted }}>{s}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>
                )}
              </View>
              {/* Campos por categoría */}
              {categoria === 'equipo' && (<>
                <View style={{ marginBottom: 14 }}>
                  <Text style={lbl}>Número de Serie *</Text>
                  <TextInput style={inp} value={f('numero_serie')} onChangeText={v => setF('numero_serie', v)} placeholder="Ej: SN-2024-ABC123" placeholderTextColor={colors.textMuted} autoCapitalize="characters" />
                </View>
                <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={lbl}>IP</Text>
                    <TextInput style={inp} value={f('ip')} onChangeText={v => setF('ip', v)} placeholder="192.168.1.10" placeholderTextColor={colors.textMuted} keyboardType="decimal-pad" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={lbl}>AnyDesk ID</Text>
                    <TextInput style={inp} value={f('anydesk_id')} onChangeText={v => setF('anydesk_id', v)} placeholder="123456789" placeholderTextColor={colors.textMuted} keyboardType="numeric" />
                  </View>
                </View>
                <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={lbl}>Usuario</Text>
                    <TextInput style={inp} value={f('usuario')} onChangeText={v => setF('usuario', v)} placeholder="admin" placeholderTextColor={colors.textMuted} autoCapitalize="none" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={lbl}>Contraseña</Text>
                    <TextInput style={inp} value={f('password')} onChangeText={v => setF('password', v)} placeholder="••••••••" placeholderTextColor={colors.textMuted} autoCapitalize="none" />
                  </View>
                </View>
              </>)}
              {categoria === 'servidor' && (<>
                <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={lbl}>IP</Text>
                    <TextInput style={inp} value={f('ip')} onChangeText={v => setF('ip', v)} placeholder="192.168.1.5" placeholderTextColor={colors.textMuted} keyboardType="decimal-pad" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={lbl}>S.O.</Text>
                    <TextInput style={inp} value={f('sistema_operativo')} onChangeText={v => setF('sistema_operativo', v)} placeholder="Windows Server 2022" placeholderTextColor={colors.textMuted} />
                  </View>
                </View>
                <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={lbl}>Usuario</Text>
                    <TextInput style={inp} value={f('usuario')} onChangeText={v => setF('usuario', v)} placeholder="admin" placeholderTextColor={colors.textMuted} autoCapitalize="none" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={lbl}>Contraseña</Text>
                    <TextInput style={inp} value={f('password')} onChangeText={v => setF('password', v)} placeholder="••••••••" placeholderTextColor={colors.textMuted} autoCapitalize="none" />
                  </View>
                </View>
              </>)}
              {categoria === 'nas' && (<>
                <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={lbl}>IP</Text>
                    <TextInput style={inp} value={f('ip')} onChangeText={v => setF('ip', v)} placeholder="192.168.1.20" placeholderTextColor={colors.textMuted} keyboardType="decimal-pad" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={lbl}>Capacidad</Text>
                    <TextInput style={inp} value={f('capacidad')} onChangeText={v => setF('capacidad', v)} placeholder="4TB" placeholderTextColor={colors.textMuted} />
                  </View>
                </View>
                <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={lbl}>Usuario</Text>
                    <TextInput style={inp} value={f('usuario')} onChangeText={v => setF('usuario', v)} placeholder="admin" placeholderTextColor={colors.textMuted} autoCapitalize="none" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={lbl}>Contraseña</Text>
                    <TextInput style={inp} value={f('password')} onChangeText={v => setF('password', v)} placeholder="••••••••" placeholderTextColor={colors.textMuted} autoCapitalize="none" />
                  </View>
                </View>
              </>)}
              {categoria === 'red' && (<>
                <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={lbl}>IP</Text>
                    <TextInput style={inp} value={f('ip')} onChangeText={v => setF('ip', v)} placeholder="192.168.1.1" placeholderTextColor={colors.textMuted} keyboardType="decimal-pad" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={lbl}>Modelo</Text>
                    <TextInput style={inp} value={f('modelo')} onChangeText={v => setF('modelo', v)} placeholder="Cisco RV340" placeholderTextColor={colors.textMuted} />
                  </View>
                </View>
                <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={lbl}>Usuario</Text>
                    <TextInput style={inp} value={f('usuario')} onChangeText={v => setF('usuario', v)} placeholder="admin" placeholderTextColor={colors.textMuted} autoCapitalize="none" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={lbl}>Contraseña</Text>
                    <TextInput style={inp} value={f('password')} onChangeText={v => setF('password', v)} placeholder="••••••••" placeholderTextColor={colors.textMuted} autoCapitalize="none" />
                  </View>
                </View>
              </>)}
              {/* Campos personalizados */}
              <View style={{ borderTopWidth: 1, borderTopColor: colors.border, marginTop: 4, paddingTop: 14, marginBottom: 14 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <Text style={lbl}>Campos personalizados</Text>
                  <TouchableOpacity
                    onPress={() => setExtraFields(prev => [...prev, { key: '', val: '' }])}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, borderWidth: 1, borderColor: colors.border }}
                  >
                    <Ionicons name="add" size={14} color={colors.primary} />
                    <Text style={{ fontSize: 12, fontWeight: '600', color: colors.primary }}>Añadir</Text>
                  </TouchableOpacity>
                </View>
                {extraFields.map((ef, i) => (
                  <View key={i} style={{ flexDirection: 'row', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                    <TextInput
                      style={{ ...inp, flex: 1 }}
                      value={ef.key}
                      onChangeText={v => { const u = [...extraFields]; u[i] = { ...u[i], key: v }; setExtraFields(u) }}
                      placeholder="Campo"
                      placeholderTextColor={colors.textMuted}
                    />
                    <TextInput
                      style={{ ...inp, flex: 1 }}
                      value={ef.val}
                      onChangeText={v => { const u = [...extraFields]; u[i] = { ...u[i], val: v }; setExtraFields(u) }}
                      placeholder="Valor"
                      placeholderTextColor={colors.textMuted}
                    />
                    <TouchableOpacity onPress={() => setExtraFields(prev => prev.filter((_, j) => j !== i))}
                      style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: '#fee2e2', alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name="close" size={16} color="#b91c1c" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            </ScrollView>
          )}

          {step === 'form' && (
            <View style={{ flexDirection: 'row', gap: 12, paddingHorizontal: 20, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border }}>
              <TouchableOpacity style={{ flex: 1, paddingVertical: 13, alignItems: 'center', borderRadius: 8, borderWidth: 1.5, borderColor: colors.border }} onPress={onClose}>
                <Text style={{ fontSize: 15, fontWeight: '600', color: colors.textMuted }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={{ flex: 2, paddingVertical: 13, alignItems: 'center', borderRadius: 8, backgroundColor: colors.primary, opacity: saving ? 0.7 : 1 }} onPress={handleSave} disabled={saving}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: '#ffffff' }}>{saving ? 'Guardando...' : 'Guardar dispositivo'}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
    </View>
  )
}

// ─── NuevoTicketModal ─────────────────────────────────────────────────────────
function NuevoTicketModal({ visible, empresas, operarios, onClose, onSave, colors }) {
  const insets = useSafeAreaInsets()
  const [form, setForm] = useState({
    empresa_id: '', asunto: '', descripcion: '',
    prioridad: 'Media', estado: 'Pendiente',
    contacto_nombre: null, telefono_cliente: null,
  })
  const [selOperarios, setSelOperarios] = useState([])
  const [selDispositivos, setSelDispositivos] = useState([])
  const [dispositivos, setDispositivos] = useState([])
  const [localContactos, setLocalContactos] = useState([])
  const [dispSearch, setDispSearch] = useState('')
  const [showCrearContacto, setShowCrearContacto] = useState(false)
  const [showEditarContacto, setShowEditarContacto] = useState(false)
  const [showAñadirDisp, setShowAñadirDisp] = useState(false)
  const [showEmpresaPicker, setShowEmpresaPicker] = useState(false)
  const [empresaQuery, setEmpresaQuery] = useState('')

  useEffect(() => {
    if (visible) {
      setForm({ empresa_id: '', asunto: '', descripcion: '', prioridad: 'Media', estado: 'Pendiente', contacto_nombre: null, telefono_cliente: null })
      setSelOperarios([])
      setSelDispositivos([])
      setDispositivos([])
      setLocalContactos([])
      setDispSearch('')
    }
  }, [visible])

  function onSelectEmpresa(id) {
    const emp = empresas.find(e => e.id === id)
    setLocalContactos((emp?.contactos || []).filter(c => c.nombre?.trim()))
    setForm(f => ({ ...f, empresa_id: id, contacto_nombre: null, telefono_cliente: null }))
    setSelDispositivos([])
    setDispSearch('')
    if (id) {
      getDispositivos(id)
        .then(data => setDispositivos((data || []).filter(d => d.categoria !== 'correo')))
        .catch(() => setDispositivos([]))
    } else {
      setDispositivos([])
    }
  }

  function toggleDispositivo(id) {
    setSelDispositivos(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  function toggleOperario(id) {
    setSelOperarios(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  function handleSave() {
    if (!form.empresa_id) { Alert.alert('Error', 'Selecciona una empresa'); return }
    if (!form.asunto.trim()) { Alert.alert('Error', 'El asunto es obligatorio'); return }
    onSave({ ...form, operarios: selOperarios, dispositivos_ids: selDispositivos })
  }

  const filteredDisps = dispSearch.trim()
    ? dispositivos.filter(d => d.nombre?.toLowerCase().includes(dispSearch.toLowerCase()) || (d.tipo || '').toLowerCase().includes(dispSearch.toLowerCase()))
    : dispositivos

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay }}>
        <View style={{ backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '92%', paddingBottom: 24 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text }}>Nuevo ticket</Text>
            <TouchableOpacity onPress={onClose}><Ionicons name="close" size={22} color={colors.textMuted} /></TouchableOpacity>
          </View>

          <ScrollView style={{ padding: 20 }} keyboardShouldPersistTaps="handled">
            {/* Empresa */}
            <View style={{ marginBottom: 14 }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textMuted, marginBottom: 6, textTransform: 'uppercase' }}>Empresa *</Text>
              <TouchableOpacity
                onPress={() => { setEmpresaQuery(''); setShowEmpresaPicker(true) }}
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.inputBg, borderWidth: 1.5, borderColor: form.empresa_id ? colors.primary : colors.inputBorder, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 12 }}
              >
                <Text style={{ fontSize: 14, color: form.empresa_id ? colors.text : colors.textMuted, flex: 1 }} numberOfLines={1}>
                  {form.empresa_id ? (empresas.find(e => e.id === form.empresa_id)?.nombre || 'Empresa seleccionada') : 'Seleccionar empresa...'}
                </Text>
                <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            {/* Contacto */}
            {form.empresa_id && (
              <View style={{ marginBottom: 14 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase' }}>Contacto</Text>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    {form.contacto_nombre && (
                      <TouchableOpacity
                        onPress={() => setShowEditarContacto(true)}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, borderWidth: 1, borderColor: colors.textMuted }}
                      >
                        <Ionicons name="pencil-outline" size={13} color={colors.textMuted} />
                        <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textMuted }}>Editar contacto</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      onPress={() => setShowCrearContacto(true)}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, borderWidth: 1, borderColor: colors.primary }}
                    >
                      <Ionicons name="person-add-outline" size={13} color={colors.primary} />
                      <Text style={{ fontSize: 12, fontWeight: '600', color: colors.primary }}>Crear contacto</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                {localContactos.length === 0 ? (
                  <Text style={{ fontSize: 12, color: colors.textMuted }}>Esta empresa no tiene contactos registrados.</Text>
                ) : (
                  <View style={{ gap: 6 }}>
                    <TouchableOpacity
                      onPress={() => setForm(f => ({ ...f, contacto_nombre: null, telefono_cliente: null }))}
                      style={{ paddingHorizontal: 14, paddingVertical: 9, borderRadius: 8, borderWidth: 1.5, borderColor: !form.contacto_nombre ? colors.primary : colors.border, backgroundColor: !form.contacto_nombre ? colors.primaryBg : colors.bg }}
                    >
                      <Text style={{ fontSize: 13, fontWeight: '600', color: !form.contacto_nombre ? colors.primary : colors.textMuted }}>Sin contacto</Text>
                    </TouchableOpacity>
                    {localContactos.map((c, i) => {
                      const sel = form.contacto_nombre === c.nombre
                      return (
                        <TouchableOpacity
                          key={i}
                          onPress={() => setForm(f => ({ ...f, contacto_nombre: c.nombre, telefono_cliente: c.telefono || null }))}
                          style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8, borderWidth: 1.5, borderColor: sel ? colors.primary : colors.border, backgroundColor: sel ? colors.primaryBg : colors.bg }}
                        >
                          <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: sel ? colors.primary : colors.badgeGray, alignItems: 'center', justifyContent: 'center' }}>
                            <Text style={{ fontSize: 12, fontWeight: '700', color: sel ? '#fff' : colors.textMuted }}>{(c.nombre || '?').charAt(0).toUpperCase()}</Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 13, fontWeight: '600', color: sel ? colors.primary : colors.text }}>{c.nombre}</Text>
                            {c.cargo ? <Text style={{ fontSize: 11, color: colors.textMuted }}>{c.cargo}</Text> : null}
                          </View>
                          {c.telefono ? (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                              <Ionicons name="call-outline" size={12} color={sel ? colors.primary : colors.textMuted} />
                              <Text style={{ fontSize: 12, color: sel ? colors.primary : colors.textMuted }}>{c.telefono}</Text>
                            </View>
                          ) : null}
                        </TouchableOpacity>
                      )
                    })}
                  </View>
                )}
              </View>
            )}

            {/* Dispositivos */}
            {form.empresa_id && (
              <View style={{ marginBottom: 14 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase' }}>Equipos</Text>
                  <TouchableOpacity
                    onPress={() => setShowAñadirDisp(true)}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, borderWidth: 1, borderColor: colors.primary }}
                  >
                    <Ionicons name="add-outline" size={13} color={colors.primary} />
                    <Text style={{ fontSize: 12, fontWeight: '600', color: colors.primary }}>Añadir dispositivo</Text>
                  </TouchableOpacity>
                </View>
                {dispositivos.length > 0 && (
                  <TextInput
                    style={{ backgroundColor: colors.inputBg, borderWidth: 1.5, borderColor: colors.inputBorder, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, fontSize: 13, color: colors.text, marginBottom: 8 }}
                    value={dispSearch}
                    onChangeText={setDispSearch}
                    placeholder="Buscar dispositivo..."
                    placeholderTextColor={colors.textMuted}
                  />
                )}
                {filteredDisps.length === 0 && dispositivos.length === 0 ? (
                  <Text style={{ fontSize: 12, color: colors.textMuted }}>Esta empresa no tiene dispositivos registrados.</Text>
                ) : filteredDisps.length === 0 ? (
                  <Text style={{ fontSize: 12, color: colors.textMuted }}>Sin resultados</Text>
                ) : (
                  <View style={{ gap: 6 }}>
                    {filteredDisps.map(d => {
                      const sel = selDispositivos.includes(d.id)
                      return (
                        <TouchableOpacity
                          key={d.id}
                          onPress={() => toggleDispositivo(d.id)}
                          style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8, borderWidth: 1.5, borderColor: sel ? colors.primary : colors.border, backgroundColor: sel ? colors.primaryBg : colors.bg }}
                        >
                          <View style={{ width: 18, height: 18, borderRadius: 4, borderWidth: 1.5, borderColor: sel ? colors.primary : colors.border, backgroundColor: sel ? colors.primary : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                            {sel && <Ionicons name="checkmark" size={12} color="#fff" />}
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 13, fontWeight: '600', color: sel ? colors.primary : colors.text }}>{d.nombre}</Text>
                            {d.tipo ? <Text style={{ fontSize: 11, color: colors.textMuted }}>{d.tipo}</Text> : null}
                          </View>
                        </TouchableOpacity>
                      )
                    })}
                  </View>
                )}
                {selDispositivos.length > 0 && (
                  <TouchableOpacity onPress={() => setSelDispositivos([])} style={{ marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Ionicons name="close-circle-outline" size={14} color={colors.textMuted} />
                    <Text style={{ fontSize: 12, color: colors.textMuted }}>{selDispositivos.length} seleccionado{selDispositivos.length > 1 ? 's' : ''} · Limpiar</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* Asunto */}
            <View style={{ marginBottom: 14 }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textMuted, marginBottom: 6, textTransform: 'uppercase' }}>Asunto *</Text>
              <TextInput
                style={{ backgroundColor: colors.inputBg, borderWidth: 1.5, borderColor: colors.inputBorder, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: colors.text }}
                value={form.asunto}
                onChangeText={v => setForm(f => ({ ...f, asunto: v }))}
                placeholder="Describe el problema..."
                placeholderTextColor={colors.textMuted}
              />
            </View>

            {/* Descripcion */}
            <View style={{ marginBottom: 14 }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textMuted, marginBottom: 6, textTransform: 'uppercase' }}>Descripción</Text>
              <TextInput
                style={{ backgroundColor: colors.inputBg, borderWidth: 1.5, borderColor: colors.inputBorder, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: colors.text, height: 80, textAlignVertical: 'top', paddingTop: 10 }}
                value={form.descripcion}
                onChangeText={v => setForm(f => ({ ...f, descripcion: v }))}
                placeholder="Detalles adicionales..."
                placeholderTextColor={colors.textMuted}
                multiline
              />
            </View>

            {/* Prioridad */}
            <View style={{ marginBottom: 14 }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textMuted, marginBottom: 6, textTransform: 'uppercase' }}>Prioridad</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {PRIORIDADES.map(p => (
                  <TouchableOpacity
                    key={p}
                    style={{ flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8, borderWidth: 1.5, borderColor: form.prioridad === p ? colors.primary : colors.border, backgroundColor: form.prioridad === p ? colors.primaryBg : colors.bg }}
                    onPress={() => setForm(f => ({ ...f, prioridad: p }))}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '700', color: form.prioridad === p ? colors.primary : colors.textMuted }}>{p}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Estado */}
            <View style={{ marginBottom: 14 }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textMuted, marginBottom: 6, textTransform: 'uppercase' }}>Estado</Text>
              <View style={{ gap: 6 }}>
                {ESTADOS.map(e => (
                  <TouchableOpacity
                    key={e}
                    style={{ paddingHorizontal: 14, paddingVertical: 9, borderRadius: 8, borderWidth: 1.5, borderColor: form.estado === e ? colors.primary : colors.border, backgroundColor: form.estado === e ? colors.primaryBg : colors.bg }}
                    onPress={() => setForm(f => ({ ...f, estado: e }))}
                  >
                    <Text style={{ fontSize: 13, fontWeight: '600', color: form.estado === e ? colors.primary : colors.text }}>{e}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Operarios */}
            {operarios.length > 0 && (
              <SearchableMultiSelect
                label="Operarios asignados"
                placeholder="Seleccionar operarios..."
                items={operarios}
                selectedIds={selOperarios}
                onToggle={toggleOperario}
                colors={colors}
              />
            )}
          </ScrollView>

          <View style={{ flexDirection: 'row', gap: 12, paddingHorizontal: 20, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border }}>
            <TouchableOpacity style={{ flex: 1, paddingVertical: 13, alignItems: 'center', borderRadius: 8, borderWidth: 1.5, borderColor: colors.border }} onPress={onClose}>
              <Text style={{ fontSize: 15, fontWeight: '600', color: colors.textMuted }}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={{ flex: 2, paddingVertical: 13, alignItems: 'center', borderRadius: 8, backgroundColor: colors.primary }} onPress={handleSave}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: '#ffffff' }}>Crear ticket</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <CrearContactoModal
        visible={showCrearContacto}
        empresaId={form.empresa_id}
        empresas={empresas}
        onClose={() => setShowCrearContacto(false)}
        onSaved={(newContact, allContacts) => {
          setLocalContactos(allContacts.filter(c => c.nombre?.trim()))
          setForm(f => ({ ...f, contacto_nombre: newContact.nombre, telefono_cliente: newContact.telefono || null }))
          setShowCrearContacto(false)
        }}
        colors={colors}
      />
      <EditarContactoModal
        visible={showEditarContacto}
        empresaId={form.empresa_id}
        empresas={empresas}
        contacto={localContactos.find(c => c.nombre === form.contacto_nombre) || null}
        onClose={() => setShowEditarContacto(false)}
        onSaved={(updatedContact, allContacts) => {
          setLocalContactos(allContacts.filter(c => c.nombre?.trim()))
          setForm(f => ({ ...f, contacto_nombre: updatedContact.nombre, telefono_cliente: updatedContact.telefono || null }))
          setShowEditarContacto(false)
        }}
        colors={colors}
      />
      <AñadirDispositivoModal
        visible={showAñadirDisp}
        empresaId={form.empresa_id}
        onClose={() => setShowAñadirDisp(false)}
        onSaved={newDevice => {
          setDispositivos(prev => [...prev, newDevice])
          setSelDispositivos(prev => [...prev, newDevice.id])
          setShowAñadirDisp(false)
        }}
        colors={colors}
      />

      {/* Empresa picker — inline overlay dentro del mismo Modal */}
      {showEmpresaPicker && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.bg, paddingTop: insets.top }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.headerBg }}>
              <TouchableOpacity onPress={() => setShowEmpresaPicker(false)} style={{ padding: 4 }}>
                <Ionicons name="arrow-back" size={22} color={colors.text} />
              </TouchableOpacity>
              <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text, flex: 1 }}>Seleccionar empresa</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, margin: 14, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5, borderColor: colors.inputBorder, backgroundColor: colors.inputBg }}>
              <Ionicons name="search-outline" size={16} color={colors.textMuted} />
              <TextInput style={{ flex: 1, fontSize: 14, color: colors.text }} placeholder="Buscar empresa..." placeholderTextColor={colors.textMuted} value={empresaQuery} onChangeText={setEmpresaQuery} autoFocus />
              {empresaQuery ? <TouchableOpacity onPress={() => setEmpresaQuery('')}><Ionicons name="close-circle" size={16} color={colors.textMuted} /></TouchableOpacity> : null}
            </View>
            <FlatList
              data={empresas.filter(e => !empresaQuery.trim() || e.nombre?.toLowerCase().includes(empresaQuery.toLowerCase()))}
              keyExtractor={item => item.id}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => {
                const sel = item.id === form.empresa_id
                return (
                  <TouchableOpacity
                    onPress={() => { onSelectEmpresa(item.id); setShowEmpresaPicker(false) }}
                    style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: sel ? colors.primaryBg : 'transparent' }}
                  >
                    <Text style={{ flex: 1, fontSize: 15, color: sel ? colors.primary : colors.text, fontWeight: sel ? '700' : '400' }}>{item.nombre}</Text>
                    {sel && <Ionicons name="checkmark" size={18} color={colors.primary} />}
                  </TouchableOpacity>
                )
              }}
              ListEmptyComponent={<View style={{ paddingTop: 40, alignItems: 'center' }}><Text style={{ color: colors.textMuted }}>Sin resultados</Text></View>}
            />
        </View>
      )}
    </Modal>
  )
}

// ─── EditarTicketModal ────────────────────────────────────────────────────────
function EditarTicketModal({ visible, ticket, empresas, operarios, onClose, onSave, colors }) {
  const insets = useSafeAreaInsets()
  const [form, setForm] = useState({
    empresa_id: '', asunto: '', descripcion: '',
    prioridad: 'Media', estado: 'Pendiente',
    contacto_nombre: null, telefono_cliente: null,
  })
  const [selOperarios, setSelOperarios] = useState([])
  const [selDispositivos, setSelDispositivos] = useState([])
  const [dispositivos, setDispositivos] = useState([])
  const [localContactos, setLocalContactos] = useState([])
  const [dispSearch, setDispSearch] = useState('')
  const [showCrearContacto, setShowCrearContacto] = useState(false)
  const [showEditarContacto, setShowEditarContacto] = useState(false)
  const [showAñadirDisp, setShowAñadirDisp] = useState(false)
  const [showEmpresaPicker, setShowEmpresaPicker] = useState(false)
  const [empresaQuery, setEmpresaQuery] = useState('')

  useEffect(() => {
    if (visible && ticket) {
      const dispIds = ticket.dispositivos_ids?.length
        ? ticket.dispositivos_ids
        : (ticket.dispositivo_id ? [ticket.dispositivo_id] : [])
      setForm({
        empresa_id: ticket.empresa_id || '',
        asunto: ticket.asunto || '',
        descripcion: ticket.descripcion || '',
        prioridad: ticket.prioridad || 'Media',
        estado: ticket.estado || 'Pendiente',
        contacto_nombre: ticket.contacto_nombre || null,
        telefono_cliente: ticket.telefono_cliente || null,
      })
      setSelOperarios((ticket.ticket_asignaciones || []).map(a => a.user_id))
      setSelDispositivos(dispIds)
      setDispSearch('')
      const emp = empresas.find(e => e.id === ticket.empresa_id)
      setLocalContactos((emp?.contactos || []).filter(c => c.nombre?.trim()))
      if (ticket.empresa_id) {
        getDispositivos(ticket.empresa_id)
          .then(data => setDispositivos((data || []).filter(d => d.categoria !== 'correo')))
          .catch(() => setDispositivos([]))
      } else {
        setDispositivos([])
      }
    }
  }, [visible, ticket])

  function onChangeEmpresa(id) {
    const emp = empresas.find(e => e.id === id)
    setLocalContactos((emp?.contactos || []).filter(c => c.nombre?.trim()))
    setForm(f => ({ ...f, empresa_id: id, contacto_nombre: null, telefono_cliente: null }))
    setSelDispositivos([])
    setDispSearch('')
    if (id) {
      getDispositivos(id)
        .then(data => setDispositivos((data || []).filter(d => d.categoria !== 'correo')))
        .catch(() => setDispositivos([]))
    } else {
      setDispositivos([])
    }
  }

  function toggleDispositivo(id) {
    setSelDispositivos(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  function toggleOperario(id) {
    setSelOperarios(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  function handleSave() {
    if (!form.empresa_id) { Alert.alert('Error', 'Selecciona una empresa'); return }
    if (!form.asunto.trim()) { Alert.alert('Error', 'El asunto es obligatorio'); return }
    onSave(ticket, { ...form, operarios: selOperarios, dispositivos_ids: selDispositivos })
  }

  const filteredDisps = dispSearch.trim()
    ? dispositivos.filter(d => d.nombre?.toLowerCase().includes(dispSearch.toLowerCase()) || (d.tipo || '').toLowerCase().includes(dispSearch.toLowerCase()))
    : dispositivos

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay }}>
        <View style={{ backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '92%', paddingBottom: 24 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text }}>Editar ticket</Text>
            <TouchableOpacity onPress={onClose}><Ionicons name="close" size={22} color={colors.textMuted} /></TouchableOpacity>
          </View>

          <ScrollView style={{ padding: 20 }} keyboardShouldPersistTaps="handled">
            {/* Empresa */}
            <View style={{ marginBottom: 14 }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textMuted, marginBottom: 6, textTransform: 'uppercase' }}>Empresa *</Text>
              <TouchableOpacity
                onPress={() => { setEmpresaQuery(''); setShowEmpresaPicker(true) }}
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.inputBg, borderWidth: 1.5, borderColor: form.empresa_id ? colors.primary : colors.inputBorder, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 12 }}
              >
                <Text style={{ fontSize: 14, color: form.empresa_id ? colors.text : colors.textMuted, flex: 1 }} numberOfLines={1}>
                  {form.empresa_id ? (empresas.find(e => e.id === form.empresa_id)?.nombre || 'Empresa seleccionada') : 'Seleccionar empresa...'}
                </Text>
                <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            {/* Contacto */}
            {form.empresa_id && (
              <View style={{ marginBottom: 14 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase' }}>Contacto</Text>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    {form.contacto_nombre && (
                      <TouchableOpacity
                        onPress={() => setShowEditarContacto(true)}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, borderWidth: 1, borderColor: colors.textMuted }}
                      >
                        <Ionicons name="pencil-outline" size={13} color={colors.textMuted} />
                        <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textMuted }}>Editar contacto</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      onPress={() => setShowCrearContacto(true)}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, borderWidth: 1, borderColor: colors.primary }}
                    >
                      <Ionicons name="person-add-outline" size={13} color={colors.primary} />
                      <Text style={{ fontSize: 12, fontWeight: '600', color: colors.primary }}>Crear contacto</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                {localContactos.length === 0 ? (
                  <Text style={{ fontSize: 12, color: colors.textMuted }}>Esta empresa no tiene contactos registrados.</Text>
                ) : (
                  <View style={{ gap: 6 }}>
                    <TouchableOpacity
                      onPress={() => setForm(f => ({ ...f, contacto_nombre: null, telefono_cliente: null }))}
                      style={{ paddingHorizontal: 14, paddingVertical: 9, borderRadius: 8, borderWidth: 1.5, borderColor: !form.contacto_nombre ? colors.primary : colors.border, backgroundColor: !form.contacto_nombre ? colors.primaryBg : colors.bg }}
                    >
                      <Text style={{ fontSize: 13, fontWeight: '600', color: !form.contacto_nombre ? colors.primary : colors.textMuted }}>Sin contacto</Text>
                    </TouchableOpacity>
                    {localContactos.map((c, i) => {
                      const sel = form.contacto_nombre === c.nombre
                      return (
                        <TouchableOpacity
                          key={i}
                          onPress={() => setForm(f => ({ ...f, contacto_nombre: c.nombre, telefono_cliente: c.telefono || null }))}
                          style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8, borderWidth: 1.5, borderColor: sel ? colors.primary : colors.border, backgroundColor: sel ? colors.primaryBg : colors.bg }}
                        >
                          <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: sel ? colors.primary : colors.badgeGray, alignItems: 'center', justifyContent: 'center' }}>
                            <Text style={{ fontSize: 12, fontWeight: '700', color: sel ? '#fff' : colors.textMuted }}>{(c.nombre || '?').charAt(0).toUpperCase()}</Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 13, fontWeight: '600', color: sel ? colors.primary : colors.text }}>{c.nombre}</Text>
                            {c.cargo ? <Text style={{ fontSize: 11, color: colors.textMuted }}>{c.cargo}</Text> : null}
                          </View>
                          {c.telefono ? (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                              <Ionicons name="call-outline" size={12} color={sel ? colors.primary : colors.textMuted} />
                              <Text style={{ fontSize: 12, color: sel ? colors.primary : colors.textMuted }}>{c.telefono}</Text>
                            </View>
                          ) : null}
                        </TouchableOpacity>
                      )
                    })}
                  </View>
                )}
              </View>
            )}

            {/* Dispositivos */}
            {form.empresa_id && (
              <View style={{ marginBottom: 14 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase' }}>Equipos</Text>
                  <TouchableOpacity
                    onPress={() => setShowAñadirDisp(true)}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, borderWidth: 1, borderColor: colors.primary }}
                  >
                    <Ionicons name="add-outline" size={13} color={colors.primary} />
                    <Text style={{ fontSize: 12, fontWeight: '600', color: colors.primary }}>Añadir dispositivo</Text>
                  </TouchableOpacity>
                </View>
                {dispositivos.length > 0 && (
                  <TextInput
                    style={{ backgroundColor: colors.inputBg, borderWidth: 1.5, borderColor: colors.inputBorder, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, fontSize: 13, color: colors.text, marginBottom: 8 }}
                    value={dispSearch}
                    onChangeText={setDispSearch}
                    placeholder="Buscar dispositivo..."
                    placeholderTextColor={colors.textMuted}
                  />
                )}
                {filteredDisps.length === 0 && dispositivos.length === 0 ? (
                  <Text style={{ fontSize: 12, color: colors.textMuted }}>Esta empresa no tiene dispositivos registrados.</Text>
                ) : filteredDisps.length === 0 ? (
                  <Text style={{ fontSize: 12, color: colors.textMuted }}>Sin resultados</Text>
                ) : (
                  <View style={{ gap: 6 }}>
                    {filteredDisps.map(d => {
                      const sel = selDispositivos.includes(d.id)
                      return (
                        <TouchableOpacity
                          key={d.id}
                          onPress={() => toggleDispositivo(d.id)}
                          style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8, borderWidth: 1.5, borderColor: sel ? colors.primary : colors.border, backgroundColor: sel ? colors.primaryBg : colors.bg }}
                        >
                          <View style={{ width: 18, height: 18, borderRadius: 4, borderWidth: 1.5, borderColor: sel ? colors.primary : colors.border, backgroundColor: sel ? colors.primary : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                            {sel && <Ionicons name="checkmark" size={12} color="#fff" />}
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 13, fontWeight: '600', color: sel ? colors.primary : colors.text }}>{d.nombre}</Text>
                            {d.tipo ? <Text style={{ fontSize: 11, color: colors.textMuted }}>{d.tipo}</Text> : null}
                          </View>
                        </TouchableOpacity>
                      )
                    })}
                  </View>
                )}
                {selDispositivos.length > 0 && (
                  <TouchableOpacity onPress={() => setSelDispositivos([])} style={{ marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Ionicons name="close-circle-outline" size={14} color={colors.textMuted} />
                    <Text style={{ fontSize: 12, color: colors.textMuted }}>{selDispositivos.length} seleccionado{selDispositivos.length > 1 ? 's' : ''} · Limpiar</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* Asunto */}
            <View style={{ marginBottom: 14 }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textMuted, marginBottom: 6, textTransform: 'uppercase' }}>Asunto *</Text>
              <TextInput
                style={{ backgroundColor: colors.inputBg, borderWidth: 1.5, borderColor: colors.inputBorder, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: colors.text }}
                value={form.asunto}
                onChangeText={v => setForm(f => ({ ...f, asunto: v }))}
                placeholderTextColor={colors.textMuted}
              />
            </View>

            {/* Descripcion */}
            <View style={{ marginBottom: 14 }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textMuted, marginBottom: 6, textTransform: 'uppercase' }}>Descripción</Text>
              <TextInput
                style={{ backgroundColor: colors.inputBg, borderWidth: 1.5, borderColor: colors.inputBorder, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: colors.text, height: 80, textAlignVertical: 'top', paddingTop: 10 }}
                value={form.descripcion}
                onChangeText={v => setForm(f => ({ ...f, descripcion: v }))}
                placeholderTextColor={colors.textMuted}
                multiline
              />
            </View>

            {/* Prioridad */}
            <View style={{ marginBottom: 14 }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textMuted, marginBottom: 6, textTransform: 'uppercase' }}>Prioridad</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {PRIORIDADES.map(p => (
                  <TouchableOpacity
                    key={p}
                    style={{ flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8, borderWidth: 1.5, borderColor: form.prioridad === p ? colors.primary : colors.border, backgroundColor: form.prioridad === p ? colors.primaryBg : colors.bg }}
                    onPress={() => setForm(f => ({ ...f, prioridad: p }))}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '700', color: form.prioridad === p ? colors.primary : colors.textMuted }}>{p}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Estado */}
            <View style={{ marginBottom: 14 }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textMuted, marginBottom: 6, textTransform: 'uppercase' }}>Estado</Text>
              <View style={{ gap: 6 }}>
                {ESTADOS.map(e => (
                  <TouchableOpacity
                    key={e}
                    style={{ paddingHorizontal: 14, paddingVertical: 9, borderRadius: 8, borderWidth: 1.5, borderColor: form.estado === e ? colors.primary : colors.border, backgroundColor: form.estado === e ? colors.primaryBg : colors.bg }}
                    onPress={() => setForm(f => ({ ...f, estado: e }))}
                  >
                    <Text style={{ fontSize: 13, fontWeight: '600', color: form.estado === e ? colors.primary : colors.text }}>{e}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Operarios */}
            {operarios.length > 0 && (
              <SearchableMultiSelect
                label="Operarios asignados"
                placeholder="Seleccionar operarios..."
                items={operarios}
                selectedIds={selOperarios}
                onToggle={toggleOperario}
                colors={colors}
              />
            )}
          </ScrollView>

          <View style={{ flexDirection: 'row', gap: 12, paddingHorizontal: 20, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border }}>
            <TouchableOpacity style={{ flex: 1, paddingVertical: 13, alignItems: 'center', borderRadius: 8, borderWidth: 1.5, borderColor: colors.border }} onPress={onClose}>
              <Text style={{ fontSize: 15, fontWeight: '600', color: colors.textMuted }}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={{ flex: 2, paddingVertical: 13, alignItems: 'center', borderRadius: 8, backgroundColor: colors.primary }} onPress={handleSave}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: '#ffffff' }}>Guardar cambios</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <CrearContactoModal
        visible={showCrearContacto}
        empresaId={form.empresa_id}
        empresas={empresas}
        onClose={() => setShowCrearContacto(false)}
        onSaved={(newContact, allContacts) => {
          setLocalContactos(allContacts.filter(c => c.nombre?.trim()))
          setForm(f => ({ ...f, contacto_nombre: newContact.nombre, telefono_cliente: newContact.telefono || null }))
          setShowCrearContacto(false)
        }}
        colors={colors}
      />
      <EditarContactoModal
        visible={showEditarContacto}
        empresaId={form.empresa_id}
        empresas={empresas}
        contacto={localContactos.find(c => c.nombre === form.contacto_nombre) || null}
        onClose={() => setShowEditarContacto(false)}
        onSaved={(updatedContact, allContacts) => {
          setLocalContactos(allContacts.filter(c => c.nombre?.trim()))
          setForm(f => ({ ...f, contacto_nombre: updatedContact.nombre, telefono_cliente: updatedContact.telefono || null }))
          setShowEditarContacto(false)
        }}
        colors={colors}
      />
      <AñadirDispositivoModal
        visible={showAñadirDisp}
        empresaId={form.empresa_id}
        onClose={() => setShowAñadirDisp(false)}
        onSaved={newDevice => {
          setDispositivos(prev => [...prev, newDevice])
          setSelDispositivos(prev => [...prev, newDevice.id])
          setShowAñadirDisp(false)
        }}
        colors={colors}
      />

      {/* Empresa picker — inline overlay dentro del mismo Modal */}
      {showEmpresaPicker && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.bg, paddingTop: insets.top }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.headerBg }}>
              <TouchableOpacity onPress={() => setShowEmpresaPicker(false)} style={{ padding: 4 }}>
                <Ionicons name="arrow-back" size={22} color={colors.text} />
              </TouchableOpacity>
              <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text, flex: 1 }}>Seleccionar empresa</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, margin: 14, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5, borderColor: colors.inputBorder, backgroundColor: colors.inputBg }}>
              <Ionicons name="search-outline" size={16} color={colors.textMuted} />
              <TextInput style={{ flex: 1, fontSize: 14, color: colors.text }} placeholder="Buscar empresa..." placeholderTextColor={colors.textMuted} value={empresaQuery} onChangeText={setEmpresaQuery} autoFocus />
              {empresaQuery ? <TouchableOpacity onPress={() => setEmpresaQuery('')}><Ionicons name="close-circle" size={16} color={colors.textMuted} /></TouchableOpacity> : null}
            </View>
            <FlatList
              data={empresas.filter(e => !empresaQuery.trim() || e.nombre?.toLowerCase().includes(empresaQuery.toLowerCase()))}
              keyExtractor={item => item.id}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => {
                const sel = item.id === form.empresa_id
                return (
                  <TouchableOpacity
                    onPress={() => { onChangeEmpresa(item.id); setShowEmpresaPicker(false) }}
                    style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: sel ? colors.primaryBg : 'transparent' }}
                  >
                    <Text style={{ flex: 1, fontSize: 15, color: sel ? colors.primary : colors.text, fontWeight: sel ? '700' : '400' }}>{item.nombre}</Text>
                    {sel && <Ionicons name="checkmark" size={18} color={colors.primary} />}
                  </TouchableOpacity>
                )
              }}
              ListEmptyComponent={<View style={{ paddingTop: 40, alignItems: 'center' }}><Text style={{ color: colors.textMuted }}>Sin resultados</Text></View>}
            />
        </View>
      )}
    </Modal>
  )
}

function EmpresaPickerModal({ visible, empresas, selectedId, onSelect, onClose, colors }) {
  const [query, setQuery] = useState('')

  useEffect(() => { if (visible) setQuery('') }, [visible])

  const filtered = query.trim()
    ? empresas.filter(e => e.nombre?.toLowerCase().includes(query.toLowerCase()))
    : empresas

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.headerBg }}>
          <TouchableOpacity onPress={onClose} style={{ padding: 4 }}>
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text, flex: 1 }}>Seleccionar empresa</Text>
        </View>
        {/* Search */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, margin: 14, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5, borderColor: colors.inputBorder, backgroundColor: colors.inputBg }}>
          <Ionicons name="search-outline" size={16} color={colors.textMuted} />
          <TextInput
            style={{ flex: 1, fontSize: 14, color: colors.text }}
            placeholder="Buscar empresa..."
            placeholderTextColor={colors.textMuted}
            value={query}
            onChangeText={setQuery}
            autoFocus
          />
          {query ? <TouchableOpacity onPress={() => setQuery('')}><Ionicons name="close-circle" size={16} color={colors.textMuted} /></TouchableOpacity> : null}
        </View>
        {/* List */}
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => {
            const sel = item.id === selectedId
            return (
              <TouchableOpacity
                onPress={() => { onSelect(item.id); onClose() }}
                style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: sel ? colors.primaryBg : 'transparent' }}
              >
                <Text style={{ flex: 1, fontSize: 15, color: sel ? colors.primary : colors.text, fontWeight: sel ? '700' : '400' }}>{item.nombre}</Text>
                {sel && <Ionicons name="checkmark" size={18} color={colors.primary} />}
              </TouchableOpacity>
            )
          }}
          ListEmptyComponent={
            <View style={{ paddingTop: 40, alignItems: 'center' }}>
              <Text style={{ color: colors.textMuted, fontSize: 14 }}>Sin resultados</Text>
            </View>
          }
        />
      </View>
    </Modal>
  )
}

function TicketCard({ ticket, onPress, onEdit, onDelete, colors }) {
  return (
    <TouchableOpacity
      style={{ backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 14, marginBottom: 10 }}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
        <View style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: colors.primaryBg, minWidth: 44, alignItems: 'center' }}>
          <Text style={{ fontSize: 11, fontWeight: '800', color: colors.primary }}>#{ticket.numero || ticket.id?.toString().slice(-4)}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 4 }} numberOfLines={2}>{ticket.asunto}</Text>
          <Text style={{ fontSize: 12, color: colors.textMuted, marginBottom: 6 }} numberOfLines={1}>
            {ticket.empresas?.nombre || 'Sin empresa'}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
            <PrioridadBadge p={ticket.prioridad} colors={colors} />
            <EstadoBadge e={ticket.estado} colors={colors} />
            {ticket.horas_totales > 0 && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                <Ionicons name="time-outline" size={11} color={colors.textMuted} />
                <Text style={{ fontSize: 10, color: colors.textMuted }}>{formatHoras(ticket.horas_totales)}</Text>
              </View>
            )}
          </View>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 6 }}>
          <Text style={{ fontSize: 11, color: colors.textMuted }}>{formatFecha(ticket.created_at)}</Text>
          {ticket.ticket_asignaciones?.length > 0 && (
            <View style={{ flexDirection: 'row' }}>
              {ticket.ticket_asignaciones.slice(0, 3).map((a, i) => (
                <View
                  key={a.user_id || i}
                  style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: getAvatarColor(a.user_id), borderWidth: 2, borderColor: colors.card, marginLeft: i > 0 ? -6 : 0, alignItems: 'center', justifyContent: 'center' }}
                >
                  <Text style={{ fontSize: 8, color: '#fff', fontWeight: '700' }}>{getInitials(a.profiles?.nombre)}</Text>
                </View>
              ))}
            </View>
          )}
          <TouchableOpacity onPress={() => onEdit(ticket)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
            <Ionicons name="create-outline" size={14} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => onDelete(ticket)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
            <Ionicons name="trash-outline" size={14} color={colors.danger} />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  )
}

export default function TicketsScreen({ navigation }) {
  const { user, logout } = useAuth()
  const { colors, isDark, toggleTheme } = useTheme()

  const [tickets, setTickets]     = useState([])
  const [empresas, setEmpresas]   = useState([])
  const [operarios, setOperarios] = useState([])
  const [loading, setLoading]     = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch]       = useState('')
  const [filterEstado, setFilterEstado]     = useState('')
  const [filterPrioridad, setFilterPrioridad] = useState('')
  const [showFilters, setShowFilters]       = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingTicket, setEditingTicket] = useState(null)
  const [page, setPage]           = useState(1)
  const [mostrarCerrados, setMostrarCerrados] = useState(false)
  const [filterOperario, setFilterOperario] = useState('all')
  const [collapsedSections, setCollapsedSections] = useState({})
  const toggleSection = key => setCollapsedSections(prev => ({ ...prev, [key]: !prev[key] }))

  const load = useCallback(async () => {
    try {
      const [t, e, o] = await Promise.all([getTickets(), getEmpresas(), getOperarios()])
      setTickets(Array.isArray(t?.tickets) ? t.tickets : Array.isArray(t) ? t : [])
      setEmpresas(Array.isArray(e) ? e : [])
      setOperarios(Array.isArray(o) ? o : [])
    } catch (e) { Alert.alert('Error', e.message) }
  }, [])

  useEffect(() => {
    load().finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    const interval = setInterval(() => { load().catch(() => {}) }, 30000)
    return () => clearInterval(interval)
  }, [load])

  async function onRefresh() {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }

  const ESTADOS_ABIERTOS = ['Pendiente', 'En curso']
  const ESTADOS_CERRADOS = ['Completado', 'Pendiente de facturar', 'Facturado']

  function matchesSearch(t) {
    if (!search) return true
    return t.asunto?.toLowerCase().includes(search.toLowerCase()) ||
      t.empresas?.nombre?.toLowerCase().includes(search.toLowerCase()) ||
      String(t.numero || '').includes(search)
  }

  // Stats computados desde tickets (siempre frescos)
  const statAbiertosTotal = tickets.filter(t => ESTADOS_ABIERTOS.includes(t.estado)).length
  const statMisAbiertos   = tickets.filter(t => ESTADOS_ABIERTOS.includes(t.estado) && (t.ticket_asignaciones || []).some(a => a.user_id === user?.id)).length
  const statSinAsignar    = tickets.filter(t => ESTADOS_ABIERTOS.includes(t.estado) && (t.ticket_asignaciones || []).length === 0).length
  const statCompletados   = tickets.filter(t => t.estado === 'Completado').length
  const statPendFacturar  = tickets.filter(t => t.estado === 'Pendiente de facturar').length
  const statFacturados    = tickets.filter(t => t.estado === 'Facturado').length

  // Abiertos agrupados por operario
  const sectionsByOperario = (() => {
    const open = tickets.filter(t => {
      if (!ESTADOS_ABIERTOS.includes(t.estado)) return false
      if (!matchesSearch(t)) return false
      if (filterOperario === '__sin__' && (t.ticket_asignaciones || []).length > 0) return false
      if (filterOperario !== 'all' && filterOperario !== '__sin__' && !(t.ticket_asignaciones || []).some(a => a.user_id === filterOperario)) return false
      return true
    })
    const map = {}
    open.forEach(t => {
      const asigs = t.ticket_asignaciones || []
      if (!asigs.length) {
        if (!map['__sin__']) map['__sin__'] = { key: '__sin__', title: 'Sin asignar', allData: [] }
        map['__sin__'].allData.push(t)
      } else {
        asigs.forEach(a => {
          if (filterOperario !== 'all' && filterOperario !== '__sin__' && a.user_id !== filterOperario) return
          if (!map[a.user_id]) map[a.user_id] = { key: a.user_id, title: a.profiles?.nombre || '?', allData: [] }
          map[a.user_id].allData.push(t)
        })
      }
    })
    const grupos = Object.values(map)
    grupos.sort((a, b) => a.key === '__sin__' ? -1 : b.key === '__sin__' ? 1 : 0)
    return grupos.map(s => ({
      ...s,
      count: s.allData.length,
      data: collapsedSections[s.key] ? [] : s.allData,
    }))
  })()

  const filtered = tickets.filter(t => {
    if (!ESTADOS_CERRADOS.includes(t.estado)) return false
    if (!matchesSearch(t)) return false
    if (filterEstado && t.estado !== filterEstado) return false
    if (filterPrioridad && t.prioridad !== filterPrioridad) return false
    return true
  })

  // Reset page when search/filters change
  useEffect(() => {
    setPage(1)
  }, [search, filterEstado, filterPrioridad, mostrarCerrados])

  const pagedData = filtered.slice(0, page * PAGE_SIZE)
  const hasMore = filtered.length > pagedData.length

  const total = tickets.length

  async function handleCreate(form) {
    try {
      await createTicket(form)
      setShowModal(false)
      await load()
    } catch (e) { Alert.alert('Error', e.message) }
  }

  async function handleEdit(ticket, form) {
    try {
      await updateTicket(ticket.id, {
        empresa_id: form.empresa_id,
        asunto: form.asunto.trim(),
        descripcion: form.descripcion.trim() || null,
        prioridad: form.prioridad,
        estado: form.estado,
        dispositivo_id: form.dispositivos_ids?.[0] || null,
        dispositivos_ids: form.dispositivos_ids || [],
        contacto_nombre: form.contacto_nombre || null,
        telefono_cliente: form.telefono_cliente || null,
      })
      const prevOps = (ticket.ticket_asignaciones || []).map(a => a.user_id)
      if (form.operarios.length > 0) {
        await assignOperarios(ticket.id, form.operarios)
      }
      for (const uid of prevOps.filter(id => !form.operarios.includes(id))) {
        await removeOperario(ticket.id, uid)
      }
      setShowEditModal(false)
      setEditingTicket(null)
      await load()
    } catch (e) { Alert.alert('Error', e.message) }
  }

  function handleDelete(ticket) {
    Alert.alert('Eliminar ticket', `¿Eliminar ticket #${ticket.numero || ticket.id}?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar', style: 'destructive',
        onPress: async () => {
          try { await deleteTicket(ticket.id); await load() }
          catch (e) { Alert.alert('Error', e.message) }
        },
      },
    ])
  }

  if (loading) {
    return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg }}><ActivityIndicator size="large" color={colors.primary} /></View>
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Header */}
      <View style={{ paddingHorizontal: 16, paddingVertical: 12, backgroundColor: colors.headerBg, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <View>
            <Text style={{ fontSize: 22, fontWeight: '800', color: colors.text }}>Tickets</Text>
            <Text style={{ fontSize: 12, color: colors.textMuted }}>{total} ticket{total !== 1 ? 's' : ''}</Text>
          </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: getAvatarColor(user?.id), alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>{getInitials(user?.nombre || user?.email)}</Text>
          </View>
          <Text style={{ fontSize: 12, color: colors.textMuted, maxWidth: 100 }} numberOfLines={1}>{(user?.nombre || user?.email || '').substring(0, 14)}</Text>
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
      </View>

      {/* Search + filter */}
      <View style={{ paddingHorizontal: 16, paddingBottom: 8, gap: 8, marginTop: 8 }}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, paddingHorizontal: 12, paddingVertical: 9 }}>
            <Ionicons name="search-outline" size={16} color={colors.textMuted} />
            <TextInput
              style={{ flex: 1, fontSize: 14, color: colors.text }}
              placeholder="Buscar tickets..."
              placeholderTextColor={colors.textMuted}
              value={search}
              onChangeText={setSearch}
            />
            {search ? <TouchableOpacity onPress={() => setSearch('')}><Ionicons name="close-circle" size={16} color={colors.textMuted} /></TouchableOpacity> : null}
          </View>
          <TouchableOpacity
            style={[{ padding: 10, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card }, (filterEstado || filterPrioridad) && { borderColor: colors.primary, backgroundColor: colors.primaryBg }]}
            onPress={() => setShowFilters(v => !v)}
          >
            <Ionicons name="filter-outline" size={18} color={(filterEstado || filterPrioridad) ? colors.primary : colors.textMuted} />
          </TouchableOpacity>
        </View>

        {showFilters && (
          <View style={{ gap: 8 }}>
            {mostrarCerrados && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  <TouchableOpacity
                    style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1.5, borderColor: !filterEstado ? colors.primary : colors.border, backgroundColor: !filterEstado ? colors.primaryBg : colors.card }}
                    onPress={() => setFilterEstado('')}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '600', color: !filterEstado ? colors.primary : colors.textMuted }}>Todos</Text>
                  </TouchableOpacity>
                  {ESTADOS_CERRADOS.map(e => (
                    <TouchableOpacity
                      key={e}
                      style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1.5, borderColor: filterEstado === e ? colors.primary : colors.border, backgroundColor: filterEstado === e ? colors.primaryBg : colors.card }}
                      onPress={() => setFilterEstado(filterEstado === e ? '' : e)}
                    >
                      <Text style={{ fontSize: 12, fontWeight: '600', color: filterEstado === e ? colors.primary : colors.textMuted }}>{e}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            )}
          </View>
        )}
      </View>

      {/* Stats bar */}
      <View style={{ flexDirection: 'row', marginHorizontal: 16, marginBottom: 8, gap: 8 }}>
        {!mostrarCerrados ? (
          <>
            <TouchableOpacity
              onPress={() => setFilterOperario('all')}
              style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 10, borderWidth: 1.5, borderColor: filterOperario === 'all' ? colors.primary : colors.border, backgroundColor: colors.card }}
            >
              <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: filterOperario === 'all' ? colors.primaryBg : colors.border, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="ticket-outline" size={14} color={colors.primary} />
              </View>
              <View>
                <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text }}>{statAbiertosTotal}</Text>
                <Text style={{ fontSize: 10, color: colors.textMuted }}>Total</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setFilterOperario(user?.id)}
              style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 10, borderWidth: 1.5, borderColor: filterOperario === user?.id ? '#d97706' : colors.border, backgroundColor: colors.card }}
            >
              <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: filterOperario === user?.id ? '#fef3c7' : colors.border, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="person-outline" size={14} color="#d97706" />
              </View>
              <View>
                <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text }}>{statMisAbiertos}</Text>
                <Text style={{ fontSize: 10, color: colors.textMuted }}>Mis abiertos</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setFilterOperario('__sin__')}
              style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 10, borderWidth: 1.5, borderColor: filterOperario === '__sin__' ? '#dc2626' : colors.border, backgroundColor: colors.card }}
            >
              <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: filterOperario === '__sin__' ? '#fee2e2' : colors.border, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="person-remove-outline" size={14} color="#dc2626" />
              </View>
              <View>
                <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text }}>{statSinAsignar}</Text>
                <Text style={{ fontSize: 10, color: colors.textMuted }}>Sin asignar</Text>
              </View>
            </TouchableOpacity>
          </>
        ) : (
          <>
            {[
              { label: 'Completados',    val: statCompletados,  estado: 'Completado',            color: '#16a34a', bg: '#dcfce7' },
              { label: 'Pend. fact.',    val: statPendFacturar, estado: 'Pendiente de facturar', color: '#ea580c', bg: '#fff7ed' },
              { label: 'Facturados',     val: statFacturados,   estado: 'Facturado',             color: '#9333ea', bg: '#f3e8ff' },
            ].map(s => (
              <TouchableOpacity
                key={s.estado}
                onPress={() => setFilterEstado(filterEstado === s.estado ? '' : s.estado)}
                style={{ flex: 1, alignItems: 'center', padding: 10, borderRadius: 10, borderWidth: 1.5, borderColor: filterEstado === s.estado ? s.color : colors.border, backgroundColor: colors.card }}
              >
                <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text }}>{s.val}</Text>
                <Text style={{ fontSize: 9, color: colors.textMuted, textAlign: 'center' }}>{s.label}</Text>
              </TouchableOpacity>
            ))}
          </>
        )}
      </View>

      {/* Toggle abiertos / cerrados */}
      <View style={{ flexDirection: 'row', marginHorizontal: 16, marginBottom: 8, borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: colors.border }}>
        <TouchableOpacity
          onPress={() => setMostrarCerrados(false)}
          style={{ flex: 1, paddingVertical: 9, alignItems: 'center', backgroundColor: !mostrarCerrados ? colors.primary : colors.card }}
        >
          <Text style={{ fontSize: 13, fontWeight: '700', color: !mostrarCerrados ? '#fff' : colors.textMuted }}>Abiertos</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setMostrarCerrados(true)}
          style={{ flex: 1, paddingVertical: 9, alignItems: 'center', backgroundColor: mostrarCerrados ? colors.primary : colors.card, borderLeftWidth: 1, borderLeftColor: colors.border }}
        >
          <Text style={{ fontSize: 13, fontWeight: '700', color: mostrarCerrados ? '#fff' : colors.textMuted }}>Cerrados</Text>
        </TouchableOpacity>
      </View>

      {/* List: abiertos agrupados | cerrados plano */}
      {!mostrarCerrados ? (
        <SectionList
          sections={sectionsByOperario}
          keyExtractor={item => String(item.id)}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          renderSectionHeader={({ section }) => (
            <TouchableOpacity
              onPress={() => toggleSection(section.key)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, marginTop: 8, borderBottomWidth: 1.5, borderBottomColor: colors.border }}
            >
              {section.key === '__sin__' ? (
                <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: '#fee2e2', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="person-remove-outline" size={12} color="#dc2626" />
                </View>
              ) : (
                <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: getAvatarColor(section.key), alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 10, color: '#fff', fontWeight: '700' }}>{getInitials(section.title)}</Text>
                </View>
              )}
              <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text, flex: 1 }}>{section.key === '__sin__' ? 'Incidencias sin asignar' : `Incidencias de ${section.title}`}</Text>
              <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12, backgroundColor: colors.primary }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: '#fff' }}>{section.count}</Text>
              </View>
              <Ionicons
                name={collapsedSections[section.key] ? 'chevron-forward' : 'chevron-down'}
                size={16}
                color={colors.textMuted}
              />
            </TouchableOpacity>
          )}
          renderItem={({ item }) => (
            <TicketCard
              ticket={item}
              colors={colors}
              onPress={() => navigation.navigate('TicketDetalle', { ticket: item })}
              onEdit={t => { setEditingTicket(t); setShowEditModal(true) }}
              onDelete={handleDelete}
            />
          )}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingTop: 60, gap: 12 }}>
              <Ionicons name="checkmark-circle-outline" size={48} color={colors.success} />
              <Text style={{ color: colors.textMuted, fontSize: 15 }}>No hay tickets abiertos</Text>
            </View>
          }
        />
      ) : (
        <FlatList
          data={pagedData}
          keyExtractor={item => String(item.id)}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          renderItem={({ item }) => (
            <TicketCard
              ticket={item}
              colors={colors}
              onPress={() => navigation.navigate('TicketDetalle', { ticket: item })}
              onEdit={t => { setEditingTicket(t); setShowEditModal(true) }}
              onDelete={handleDelete}
            />
          )}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingTop: 60, gap: 12 }}>
              <Ionicons name="headset-outline" size={48} color={colors.textMuted} />
              <Text style={{ color: colors.textMuted, fontSize: 15 }}>Sin tickets cerrados</Text>
            </View>
          }
          ListFooterComponent={
            hasMore ? (
              <TouchableOpacity
                onPress={() => setPage(p => p + 1)}
                style={{ marginTop: 4, marginBottom: 8, paddingVertical: 13, alignItems: 'center', borderRadius: 10, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.card }}
              >
                <Text style={{ fontSize: 14, fontWeight: '600', color: colors.primary }}>
                  Cargar más ({filtered.length} total)
                </Text>
              </TouchableOpacity>
            ) : null
          }
        />
      )}

      <NuevoTicketModal
        visible={showModal}
        empresas={empresas}
        operarios={operarios}
        onClose={() => setShowModal(false)}
        onSave={handleCreate}
        colors={colors}
      />
      <EditarTicketModal
        visible={showEditModal}
        ticket={editingTicket}
        empresas={empresas}
        operarios={operarios}
        onClose={() => { setShowEditModal(false); setEditingTicket(null) }}
        onSave={handleEdit}
        colors={colors}
      />

      {/* FAB */}
      <TouchableOpacity
        style={{ position: 'absolute', bottom: 24, right: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8 }}
        onPress={() => setShowModal(true)}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>
    </SafeAreaView>
  )
}
