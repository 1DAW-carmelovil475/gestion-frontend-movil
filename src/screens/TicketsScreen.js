import { useState, useEffect, useCallback } from 'react'
import {
  View, Text, StyleSheet, FlatList, SectionList, TouchableOpacity, TextInput,
  ActivityIndicator, Alert, RefreshControl, Modal, ScrollView,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import {
  getTickets, createTicket, deleteTicket,
  getEmpresas, getOperarios, getDispositivos,
} from '../services/api'

const ESTADOS = ['Pendiente', 'En curso', 'Completado', 'Pendiente de facturar', 'Facturado']
const PRIORIDADES = ['Baja', 'Media', 'Alta', 'Urgente']
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
          borderColor: selectedId ? colors.primary : colors.inputBorder,
          borderRadius: 8, paddingHorizontal: 12, paddingVertical: 11,
        }}
      >
        <Text style={{ fontSize: 14, color: selected ? colors.text : colors.textMuted, flex: 1 }} numberOfLines={1}>
          {selected ? selected.nombre : placeholder || 'Seleccionar...'}
        </Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textMuted} />
      </TouchableOpacity>

      {/* Inline dropdown modal */}
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => { setOpen(false); setQuery('') }}>
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', paddingHorizontal: 20 }}
          activeOpacity={1}
          onPress={() => { setOpen(false); setQuery('') }}
        >
          <TouchableOpacity activeOpacity={1} onPress={() => {}}>
            <View style={{ backgroundColor: colors.card, borderRadius: 14, overflow: 'hidden', maxHeight: 400 }}>
              {/* Search bar */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                <Ionicons name="search-outline" size={16} color={colors.textMuted} />
                <TextInput
                  style={{ flex: 1, fontSize: 14, color: colors.text }}
                  placeholder="Buscar empresa..."
                  placeholderTextColor={colors.textMuted}
                  value={query}
                  onChangeText={setQuery}
                  autoFocus
                />
                {query ? (
                  <TouchableOpacity onPress={() => setQuery('')}>
                    <Ionicons name="close-circle" size={16} color={colors.textMuted} />
                  </TouchableOpacity>
                ) : null}
              </View>
              {/* List */}
              <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 320 }}>
                {filtered.length === 0 ? (
                  <View style={{ paddingVertical: 24, alignItems: 'center' }}>
                    <Text style={{ color: colors.textMuted, fontSize: 13 }}>Sin resultados</Text>
                  </View>
                ) : (
                  filtered.map((item, idx) => (
                    <TouchableOpacity
                      key={item.id}
                      onPress={() => handleSelect(item)}
                      style={{
                        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                        paddingHorizontal: 16, paddingVertical: 13,
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
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
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

      {/* Dropdown modal */}
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => { setOpen(false); setQuery('') }}>
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', paddingHorizontal: 20 }}
          activeOpacity={1}
          onPress={() => { setOpen(false); setQuery('') }}
        >
          <TouchableOpacity activeOpacity={1} onPress={() => {}}>
            <View style={{ backgroundColor: colors.card, borderRadius: 14, overflow: 'hidden', maxHeight: 420 }}>
              {/* Header */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>Seleccionar operarios</Text>
                <TouchableOpacity onPress={() => { setOpen(false); setQuery('') }}>
                  <Ionicons name="close" size={20} color={colors.textMuted} />
                </TouchableOpacity>
              </View>
              {/* Search */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                <Ionicons name="search-outline" size={16} color={colors.textMuted} />
                <TextInput
                  style={{ flex: 1, fontSize: 14, color: colors.text }}
                  placeholder="Buscar operario..."
                  placeholderTextColor={colors.textMuted}
                  value={query}
                  onChangeText={setQuery}
                  autoFocus
                />
                {query ? (
                  <TouchableOpacity onPress={() => setQuery('')}>
                    <Ionicons name="close-circle" size={16} color={colors.textMuted} />
                  </TouchableOpacity>
                ) : null}
              </View>
              {/* List */}
              <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 320 }}>
                {filtered.length === 0 ? (
                  <View style={{ paddingVertical: 24, alignItems: 'center' }}>
                    <Text style={{ color: colors.textMuted, fontSize: 13 }}>Sin resultados</Text>
                  </View>
                ) : (
                  filtered.map((item, idx) => {
                    const sel = selectedIds.includes(item.id)
                    return (
                      <TouchableOpacity
                        key={item.id}
                        onPress={() => onToggle(item.id)}
                        style={{
                          flexDirection: 'row', alignItems: 'center', gap: 10,
                          paddingHorizontal: 16, paddingVertical: 12,
                          borderBottomWidth: idx < filtered.length - 1 ? 1 : 0,
                          borderBottomColor: colors.border,
                          backgroundColor: sel ? colors.primaryBg : 'transparent',
                        }}
                      >
                        <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: getAvatarColor(item.id), alignItems: 'center', justifyContent: 'center' }}>
                          <Text style={{ fontSize: 11, color: '#fff', fontWeight: '700' }}>{getInitials(item.nombre)}</Text>
                        </View>
                        <Text style={{ flex: 1, fontSize: 14, color: sel ? colors.primary : colors.text, fontWeight: sel ? '700' : '400' }} numberOfLines={1}>
                          {item.nombre}
                        </Text>
                        {sel && <Ionicons name="checkmark-circle" size={20} color={colors.primary} />}
                      </TouchableOpacity>
                    )
                  })
                )}
              </ScrollView>
              {/* Done button */}
              <TouchableOpacity
                onPress={() => { setOpen(false); setQuery('') }}
                style={{ margin: 12, paddingVertical: 12, alignItems: 'center', borderRadius: 8, backgroundColor: colors.primary }}
              >
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#fff' }}>
                  {selectedIds.length > 0 ? `Confirmar (${selectedIds.length})` : 'Cerrar'}
                </Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  )
}

// ─── NuevoTicketModal ─────────────────────────────────────────────────────────
function NuevoTicketModal({ visible, empresas, operarios, onClose, onSave, colors }) {
  const [form, setForm] = useState({
    empresa_id: '', asunto: '', descripcion: '',
    prioridad: 'Media', estado: 'Pendiente',
    contacto_nombre: null, telefono_cliente: null,
  })
  const [selOperarios, setSelOperarios] = useState([])
  const [selDispositivos, setSelDispositivos] = useState([])
  const [dispositivos, setDispositivos] = useState([])

  useEffect(() => {
    if (visible) {
      setForm({ empresa_id: '', asunto: '', descripcion: '', prioridad: 'Media', estado: 'Pendiente', contacto_nombre: null, telefono_cliente: null })
      setSelOperarios([])
      setSelDispositivos([])
      setDispositivos([])
    }
  }, [visible])

  useEffect(() => {
    setForm(f => ({ ...f, contacto_nombre: null, telefono_cliente: null }))
    setSelDispositivos([])
    if (form.empresa_id) {
      getDispositivos(form.empresa_id).then(data => setDispositivos((data || []).filter(d => d.categoria !== 'correo'))).catch(() => setDispositivos([]))
    } else {
      setDispositivos([])
    }
  }, [form.empresa_id])

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

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay }}>
        <View style={{ backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '92%', paddingBottom: 24 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text }}>Nuevo ticket</Text>
            <TouchableOpacity onPress={onClose}><Ionicons name="close" size={22} color={colors.textMuted} /></TouchableOpacity>
          </View>

          <ScrollView style={{ padding: 20 }} keyboardShouldPersistTaps="handled">
            {/* Empresa — searchable select */}
            <SearchableSelect
              label="Empresa *"
              placeholder="Seleccionar empresa..."
              items={empresas}
              selectedId={form.empresa_id}
              onSelect={id => setForm(f => ({ ...f, empresa_id: id }))}
              colors={colors}
            />

            {/* Contacto de empresa */}
            {form.empresa_id && (() => {
              const emp = empresas.find(e => e.id === form.empresa_id)
              const cts = (emp?.contactos || []).filter(c => c.nombre?.trim())
              if (!cts.length) return null
              return (
                <View style={{ marginBottom: 14 }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textMuted, marginBottom: 6, textTransform: 'uppercase' }}>Contacto</Text>
                  <View style={{ gap: 6 }}>
                    <TouchableOpacity
                      onPress={() => setForm(f => ({ ...f, contacto_nombre: null, telefono_cliente: null }))}
                      style={{ paddingHorizontal: 14, paddingVertical: 9, borderRadius: 8, borderWidth: 1.5, borderColor: !form.contacto_nombre ? colors.primary : colors.border, backgroundColor: !form.contacto_nombre ? colors.primaryBg : colors.bg }}
                    >
                      <Text style={{ fontSize: 13, fontWeight: '600', color: !form.contacto_nombre ? colors.primary : colors.textMuted }}>Sin contacto</Text>
                    </TouchableOpacity>
                    {cts.map((c, i) => {
                      const sel = form.contacto_nombre === c.nombre
                      return (
                        <TouchableOpacity
                          key={i}
                          onPress={() => setForm(f => ({ ...f, contacto_nombre: c.nombre, telefono_cliente: c.telefono || null }))}
                          style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8, borderWidth: 1.5, borderColor: sel ? colors.primary : colors.border, backgroundColor: sel ? colors.primaryBg : colors.bg }}
                        >
                          <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: sel ? colors.primary : colors.badgeGray, alignItems: 'center', justifyContent: 'center' }}>
                            <Text style={{ fontSize: 12, fontWeight: '700', color: sel ? '#fff' : colors.textMuted }}>
                              {(c.nombre || '?').charAt(0).toUpperCase()}
                            </Text>
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
                </View>
              )
            })()}

            {/* Dispositivos — checklist */}
            {dispositivos.length > 0 && (
              <View style={{ marginBottom: 14 }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textMuted, marginBottom: 6, textTransform: 'uppercase' }}>Equipos</Text>
                <View style={{ gap: 6 }}>
                  {dispositivos.map(d => {
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

            {/* Operarios — searchable multi-select */}
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
    </Modal>
  )
}

function TicketCard({ ticket, onPress, onDelete, colors }) {
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
  const statCompletados   = tickets.filter(t => t.estado === 'Completado').length
  const statPendFacturar  = tickets.filter(t => t.estado === 'Pendiente de facturar').length
  const statFacturados    = tickets.filter(t => t.estado === 'Facturado').length

  // Abiertos agrupados por operario
  const sectionsByOperario = (() => {
    const open = tickets.filter(t => {
      if (!ESTADOS_ABIERTOS.includes(t.estado)) return false
      if (!matchesSearch(t)) return false
      if (filterOperario !== 'all' && !(t.ticket_asignaciones || []).some(a => a.user_id === filterOperario)) return false
      return true
    })
    const map = {}
    open.forEach(t => {
      const asigs = t.ticket_asignaciones || []
      if (!asigs.length) {
        if (filterOperario !== 'all') return
        if (!map['__sin__']) map['__sin__'] = { key: '__sin__', title: 'Sin asignar', allData: [] }
        map['__sin__'].allData.push(t)
      } else {
        asigs.forEach(a => {
          if (filterOperario !== 'all' && a.user_id !== filterOperario) return
          if (!map[a.user_id]) map[a.user_id] = { key: a.user_id, title: a.profiles?.nombre || '?', allData: [] }
          map[a.user_id].allData.push(t)
        })
      }
    })
    return Object.values(map).map(s => ({
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
              <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: getAvatarColor(section.key), alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 10, color: '#fff', fontWeight: '700' }}>{getInitials(section.title)}</Text>
              </View>
              <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text, flex: 1 }}>Incidencias de {section.title}</Text>
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
