import { useState, useEffect, useCallback } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, FlatList, ActivityIndicator, Alert, Modal,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '../context/ThemeContext'
import {
  getDispositivos, createDispositivo, updateDispositivo, deleteDispositivo,
  updateEmpresa,
} from '../services/api'

const TIPO_SUGERENCIAS = {
  equipo:   ['PC', 'Portátil', 'Cámara de Seguridad', 'Impresora', 'Tablet', 'All-in-One'],
  servidor: ['Servidor Físico', 'Servidor Virtual', 'Servidor de Archivos'],
  nas:      ['NAS Synology', 'NAS QNAP'],
  red:      ['Router', 'Switch', 'Access Point', 'Firewall', 'Modem'],
  correo:   ['Exchange', 'Gmail', 'Outlook', 'IMAP'],
  otro:     [],
}

const CATEGORIAS = [
  { key: 'equipo',   label: 'Equipos',    icon: 'desktop-outline' },
  { key: 'servidor', label: 'Servidores', icon: 'server-outline' },
  { key: 'nas',      label: 'NAS',        icon: 'save-outline' },
  { key: 'red',      label: 'Redes',      icon: 'git-network-outline' },
  { key: 'correo',   label: 'Correos',    icon: 'mail-outline' },
  { key: 'otro',     label: 'Otros',      icon: 'cube-outline' },
]

const CAMPOS_CAT = {
  equipo:   [
    { key: 'tipo',       label: 'Tipo' },
    { key: 'usuario',    label: 'Usuario' },
    { key: 'password',   label: 'Contraseña', secret: true },
    { key: 'ip',         label: 'IP' },
    { key: 'anydesk_id', label: 'AnyDesk ID' },
  ],
  servidor: [
    { key: 'tipo',     label: 'Tipo' },
    { key: 'ip',       label: 'IP' },
    { key: 'usuario',  label: 'Usuario' },
    { key: 'password', label: 'Contraseña', secret: true },
  ],
  nas: [
    { key: 'tipo',     label: 'Modelo' },
    { key: 'ip',       label: 'IP' },
    { key: 'usuario',  label: 'Usuario' },
    { key: 'password', label: 'Contraseña', secret: true },
  ],
  red: [
    { key: 'tipo',     label: 'Tipo' },
    { key: 'ip',       label: 'IP' },
    { key: 'usuario',  label: 'Usuario' },
    { key: 'password', label: 'Contraseña', secret: true },
  ],
  correo: [
    { key: 'tipo',     label: 'Servidor' },
    { key: 'usuario',  label: 'Cuenta' },
    { key: 'password', label: 'Contraseña', secret: true },
  ],
  otro: [
    { key: 'tipo',     label: 'Tipo' },
    { key: 'ip',       label: 'IP' },
    { key: 'usuario',  label: 'Usuario' },
    { key: 'password', label: 'Contraseña', secret: true },
  ],
}

const EMPRESA_ESTADOS = ['Activo', 'En revisión', 'Suspendido']

function getEstadoStyle(estado) {
  const e = String(estado || 'Activo')
  if (e === 'Activo')      return { bg: '#dcfce7', text: '#16a34a' }
  if (e === 'En revisión') return { bg: '#fef9c3', text: '#b45309' }
  return                          { bg: '#fee2e2', text: '#dc2626' }
}

function EditEmpresaSheet({ visible, empresa, onClose, onSave, colors }) {
  const [form, setForm] = useState({})

  useEffect(() => {
    if (visible && empresa) {
      setForm({
        nombre:    empresa.nombre    || '',
        email:     empresa.email     || '',
        telefono:  empresa.telefono  || '',
        direccion: empresa.direccion || '',
        notas:     empresa.notas     || '',
        estado:    empresa.estado    || 'Activo',
        servicios: empresa.servicios || [],
      })
    }
  }, [visible, empresa])

  function handleSave() {
    if (!form.nombre?.trim()) { Alert.alert('Error', 'El nombre es obligatorio'); return }
    onSave(form)
  }

  const inputStyle = {
    backgroundColor: colors.inputBg, borderWidth: 1.5, borderColor: colors.inputBorder,
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: colors.text,
  }
  const labelStyle = { fontSize: 11, fontWeight: '700', color: colors.textMuted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' }}>
        <View style={{ backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '85%', paddingBottom: 24 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text }}>Editar empresa</Text>
            <TouchableOpacity onPress={onClose}><Ionicons name="close" size={22} color={colors.textMuted} /></TouchableOpacity>
          </View>
          <ScrollView style={{ padding: 20 }} keyboardShouldPersistTaps="handled">
            {[
              { key: 'nombre',    label: 'Nombre *',    placeholder: 'Nombre de la empresa' },
              { key: 'email',     label: 'Email',       placeholder: 'empresa@email.com' },
              { key: 'telefono',  label: 'Teléfono',    placeholder: '+34 600 000 000' },
              { key: 'direccion', label: 'Dirección',   placeholder: 'Calle, número, ciudad' },
            ].map(({ key, label, placeholder }) => (
              <View key={key} style={{ marginBottom: 14 }}>
                <Text style={labelStyle}>{label}</Text>
                <TextInput
                  style={inputStyle}
                  value={form[key] || ''}
                  onChangeText={v => setForm(f => ({ ...f, [key]: v }))}
                  placeholder={placeholder}
                  placeholderTextColor={colors.textMuted}
                />
              </View>
            ))}
            {/* Estado */}
            <View style={{ marginBottom: 14 }}>
              <Text style={labelStyle}>Estado</Text>
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

            <View style={{ marginBottom: 14 }}>
              <Text style={labelStyle}>Notas internas</Text>
              <TextInput
                style={[inputStyle, { height: 80, textAlignVertical: 'top', paddingTop: 10 }]}
                value={form.notas || ''}
                onChangeText={v => setForm(f => ({ ...f, notas: v }))}
                placeholder="Notas sobre la empresa..."
                placeholderTextColor={colors.textMuted}
                multiline
              />
            </View>
          </ScrollView>
          <View style={{ flexDirection: 'row', gap: 12, paddingHorizontal: 20, paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.border }}>
            <TouchableOpacity style={{ flex: 1, paddingVertical: 13, alignItems: 'center', borderRadius: 8, borderWidth: 1.5, borderColor: colors.border }} onPress={onClose}>
              <Text style={{ fontSize: 15, fontWeight: '600', color: colors.textMuted }}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={{ flex: 2, paddingVertical: 13, alignItems: 'center', borderRadius: 8, backgroundColor: colors.primary }} onPress={handleSave}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: '#ffffff' }}>Guardar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  )
}

function DispositivoModal({ visible, categoriaActiva, dispositivo, empresaId, onClose, onSave, colors }) {
  const campos = CAMPOS_CAT[categoriaActiva] || []
  const [form, setForm] = useState({})

  useEffect(() => {
    if (visible) {
      if (dispositivo) {
        setForm({ ...dispositivo })
      } else {
        const def = { categoria: categoriaActiva, empresa_id: empresaId }
        campos.forEach(c => { def[c.key] = '' })
        def.nombre = ''
        def.numero_serie = ''
        def.notas = ''
        setForm(def)
      }
    }
  }, [visible, dispositivo, categoriaActiva])

  function handleSave() {
    if (!form.nombre?.trim()) { Alert.alert('Error', 'El nombre es obligatorio'); return }
    onSave({ ...form, categoria: categoriaActiva, empresa_id: empresaId })
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay }}>
        <View style={{ backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '85%', paddingBottom: 24 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text }}>
              {dispositivo ? 'Editar dispositivo' : 'Nuevo dispositivo'}
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ padding: 20 }} keyboardShouldPersistTaps="handled">
            <View style={{ marginBottom: 14 }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textMuted, marginBottom: 6, textTransform: 'uppercase' }}>Nombre *</Text>
              <TextInput
                style={{ backgroundColor: colors.inputBg, borderWidth: 1.5, borderColor: colors.inputBorder, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: colors.text }}
                value={form.nombre || ''}
                onChangeText={v => setForm(f => ({ ...f, nombre: v }))}
                placeholder="Nombre del dispositivo"
                placeholderTextColor={colors.textMuted}
              />
            </View>

            <View style={{ marginBottom: 14 }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textMuted, marginBottom: 6, textTransform: 'uppercase' }}>N° Serie</Text>
              <TextInput
                style={{ backgroundColor: colors.inputBg, borderWidth: 1.5, borderColor: colors.inputBorder, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: colors.text }}
                value={form.numero_serie || ''}
                onChangeText={v => setForm(f => ({ ...f, numero_serie: v }))}
                placeholder="Número de serie"
                placeholderTextColor={colors.textMuted}
              />
            </View>

            {campos.map(({ key, label }) => {
              const sugerencias = key === 'tipo' ? (TIPO_SUGERENCIAS[categoriaActiva] || []) : []
              return (
                <View key={key} style={{ marginBottom: 14 }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textMuted, marginBottom: 6, textTransform: 'uppercase' }}>{label}</Text>
                  <TextInput
                    style={{ backgroundColor: colors.inputBg, borderWidth: 1.5, borderColor: colors.inputBorder, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: colors.text }}
                    value={form[key] || ''}
                    onChangeText={v => setForm(f => ({ ...f, [key]: v }))}
                    placeholder={sugerencias.length > 0 ? 'Selecciona o escribe...' : label}
                    placeholderTextColor={colors.textMuted}
                  />
                  {sugerencias.length > 0 && (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 6 }}>
                      {sugerencias.map(s => (
                        <TouchableOpacity
                          key={s}
                          style={{
                            paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, marginRight: 6,
                            borderWidth: 1.5,
                            borderColor: form[key] === s ? colors.primary : colors.border,
                            backgroundColor: form[key] === s ? colors.primaryBg : colors.card,
                          }}
                          onPress={() => setForm(f => ({ ...f, [key]: s }))}
                        >
                          <Text style={{ fontSize: 12, fontWeight: '600', color: form[key] === s ? colors.primary : colors.textMuted }}>{s}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  )}
                </View>
              )
            })}

            <View style={{ marginBottom: 14 }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textMuted, marginBottom: 6, textTransform: 'uppercase' }}>Notas</Text>
              <TextInput
                style={{ backgroundColor: colors.inputBg, borderWidth: 1.5, borderColor: colors.inputBorder, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: colors.text, height: 70, textAlignVertical: 'top', paddingTop: 10 }}
                value={form.notas || ''}
                onChangeText={v => setForm(f => ({ ...f, notas: v }))}
                placeholder="Notas adicionales"
                placeholderTextColor={colors.textMuted}
                multiline
              />
            </View>
          </ScrollView>

          <View style={{ flexDirection: 'row', gap: 12, paddingHorizontal: 20, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border }}>
            <TouchableOpacity style={{ flex: 1, paddingVertical: 13, alignItems: 'center', borderRadius: 8, borderWidth: 1.5, borderColor: colors.border }} onPress={onClose}>
              <Text style={{ fontSize: 15, fontWeight: '600', color: colors.textMuted }}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={{ flex: 2, paddingVertical: 13, alignItems: 'center', borderRadius: 8, backgroundColor: colors.primary }} onPress={handleSave}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: '#ffffff' }}>{dispositivo ? 'Guardar' : 'Añadir'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  )
}

function DispositivoCard({ disp, onEdit, onDelete, colors }) {
  const [showPwd, setShowPwd] = useState(false)
  const campos = CAMPOS_CAT[disp.categoria] || []

  return (
    <View style={{ backgroundColor: colors.bg, borderRadius: 10, borderWidth: 1, borderColor: colors.border, padding: 14, marginBottom: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <Text style={{ fontWeight: '700', fontSize: 14, color: colors.text, flex: 1 }} numberOfLines={1}>{disp.nombre}</Text>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <TouchableOpacity onPress={() => onEdit(disp)}>
            <Ionicons name="pencil-outline" size={16} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => onDelete(disp)}>
            <Ionicons name="trash-outline" size={16} color={colors.danger} />
          </TouchableOpacity>
        </View>
      </View>

      {disp.numero_serie ? (
        <View style={{ flexDirection: 'row', gap: 6, marginBottom: 4 }}>
          <Text style={{ fontSize: 12, color: colors.textMuted }}>N° Serie:</Text>
          <Text style={{ fontSize: 12, color: colors.text }}>{disp.numero_serie}</Text>
        </View>
      ) : null}

      {campos.map(({ key, label, secret }) => {
        const val = disp[key]
        if (!val) return null
        return (
          <View key={key} style={{ flexDirection: 'row', gap: 6, marginBottom: 4, alignItems: 'center' }}>
            <Text style={{ fontSize: 12, color: colors.textMuted, width: 80 }}>{label}:</Text>
            {secret ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Text style={{ fontSize: 12, color: colors.text }}>{showPwd ? val : '••••••••'}</Text>
                <TouchableOpacity onPress={() => setShowPwd(v => !v)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                  <Ionicons name={showPwd ? 'eye-off-outline' : 'eye-outline'} size={14} color={colors.textMuted} />
                </TouchableOpacity>
              </View>
            ) : (
              <Text style={{ fontSize: 12, color: colors.text }}>{val}</Text>
            )}
          </View>
        )
      })}

      {disp.notas ? (
        <View style={{ marginTop: 6, padding: 8, backgroundColor: colors.card, borderRadius: 6 }}>
          <Text style={{ fontSize: 12, color: colors.textMuted }}>{disp.notas}</Text>
        </View>
      ) : null}
    </View>
  )
}

export default function EmpresaDetalleScreen({ route, navigation }) {
  const { empresa: initialEmpresa, allEmpresas = [] } = route.params
  const { colors } = useTheme()

  const [empresa, setEmpresa]       = useState(initialEmpresa)
  const [catTab, setCatTab]         = useState('equipo')

  const empresaMatriz = allEmpresas.find(e => e.id === empresa.empresa_matriz_id) || null
  const filiales      = allEmpresas.filter(e => e.empresa_matriz_id === empresa.id)
  const [dispositivos, setDispositivos] = useState([])
  const [loadingDisp, setLoadingDisp] = useState(false)
  const [showModal, setShowModal]   = useState(false)
  const [editingDisp, setEditingDisp] = useState(null)
  const [notasText, setNotasText]   = useState(empresa.notas || '')
  const [editingNotas, setEditingNotas] = useState(false)
  const [showEditEmpresa, setShowEditEmpresa] = useState(false)

  const loadDispositivos = useCallback(async (cat) => {
    setLoadingDisp(true)
    try {
      const data = await getDispositivos(empresa.id, cat)
      setDispositivos(Array.isArray(data) ? data : [])
    } catch {}
    finally { setLoadingDisp(false) }
  }, [empresa.id])

  useEffect(() => { loadDispositivos(catTab) }, [catTab])

  async function handleSaveDisp(form) {
    try {
      if (editingDisp) {
        await updateDispositivo(editingDisp.id, form)
      } else {
        await createDispositivo(form)
      }
      setShowModal(false)
      setEditingDisp(null)
      await loadDispositivos(catTab)
    } catch (e) {
      Alert.alert('Error', e.message)
    }
  }

  function handleDeleteDisp(disp) {
    Alert.alert('Eliminar dispositivo', `¿Eliminar "${disp.nombre}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar', style: 'destructive',
        onPress: async () => {
          try {
            await deleteDispositivo(disp.id)
            await loadDispositivos(catTab)
          } catch (e) { Alert.alert('Error', e.message) }
        },
      },
    ])
  }

  async function saveNotas() {
    try {
      await updateEmpresa(empresa.id, { notas: notasText })
      setEmpresa(e => ({ ...e, notas: notasText }))
      setEditingNotas(false)
    } catch (e) { Alert.alert('Error', e.message) }
  }

  async function handleSaveEmpresa(form) {
    try {
      const updated = await updateEmpresa(empresa.id, form)
      setEmpresa(e => ({ ...e, ...form, ...updated }))
      setNotasText(form.notas || notasText)
      setShowEditEmpresa(false)
    } catch (e) { Alert.alert('Error', e.message) }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Top header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: colors.headerBg, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginRight: 12 }}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text }} numberOfLines={1}>{empresa.nombre}</Text>
          {empresa.cif ? <Text style={{ fontSize: 12, color: colors.textMuted }}>{empresa.cif}</Text> : null}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: getEstadoStyle(empresa.estado).text }} />
          <TouchableOpacity onPress={() => setShowEditEmpresa(true)} style={{ padding: 6 }}>
            <Ionicons name="pencil-outline" size={20} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView>
        {/* Company info card */}
        <View style={{ backgroundColor: colors.card, margin: 16, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 16 }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textMuted, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>Información</Text>
          {[
            { icon: 'mail-outline',     label: 'Email',      value: empresa.email },
            { icon: 'call-outline',     label: 'Teléfono',   value: empresa.telefono },
            { icon: 'location-outline', label: 'Dirección',  value: empresa.direccion },
            { icon: 'business-outline', label: 'Empresa matriz', value: empresa.empresa_matriz_nombre },
          ].map(({ icon, label, value }) => value ? (
            <View key={label} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <Ionicons name={icon} size={16} color={colors.primary} />
              <Text style={{ fontSize: 12, color: colors.textMuted, width: 70 }}>{label}</Text>
              <Text style={{ fontSize: 13, color: colors.text, flex: 1 }}>{value}</Text>
            </View>
          ) : null)}

          {empresa.servicios?.length > 0 && (
            <View style={{ marginTop: 8 }}>
              <Text style={{ fontSize: 12, color: colors.textMuted, marginBottom: 6 }}>Servicios</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {empresa.servicios.map(s => (
                  <View key={s} style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, backgroundColor: colors.primaryBg }}>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: colors.primary }}>{s}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>

        {/* Empresa Matriz / Filiales */}
        {(empresaMatriz || filiales.length > 0) && (
          <View style={{ backgroundColor: colors.card, marginHorizontal: 16, marginBottom: 16, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <Ionicons name="git-network-outline" size={18} color={colors.primary} />
              <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>
                {empresaMatriz ? 'Empresa unida a' : `Empresa matriz · ${filiales.length} vinculada${filiales.length !== 1 ? 's' : ''}`}
              </Text>
            </View>
            {empresaMatriz ? (
              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, backgroundColor: colors.primaryBg, borderRadius: 8 }}
                onPress={() => navigation.replace('EmpresaDetalle', { empresa: empresaMatriz, allEmpresas })}
              >
                <View style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: '#fff', fontWeight: '800', fontSize: 13 }}>
                    {(empresaMatriz.nombre || '?').substring(0, 2).toUpperCase()}
                  </Text>
                </View>
                <Text style={{ flex: 1, fontSize: 14, fontWeight: '700', color: colors.primary }}>{empresaMatriz.nombre}</Text>
                <Ionicons name="chevron-forward" size={16} color={colors.primary} />
              </TouchableOpacity>
            ) : (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {filiales.map(f => (
                  <TouchableOpacity
                    key={f.id}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: colors.primaryBg, borderRadius: 20 }}
                    onPress={() => navigation.replace('EmpresaDetalle', { empresa: f, allEmpresas })}
                  >
                    <View style={{ width: 22, height: 22, borderRadius: 4, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ color: '#fff', fontWeight: '800', fontSize: 10 }}>{(f.nombre || '?').charAt(0).toUpperCase()}</Text>
                    </View>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: colors.primary }}>{f.nombre}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Notas internas */}
        <View style={{ backgroundColor: colors.card, marginHorizontal: 16, marginBottom: 16, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>Notas internas</Text>
            <TouchableOpacity onPress={() => setEditingNotas(v => !v)}>
              <Ionicons name={editingNotas ? 'close-outline' : 'pencil-outline'} size={16} color={colors.primary} />
            </TouchableOpacity>
          </View>
          {editingNotas ? (
            <>
              <TextInput
                style={{ backgroundColor: colors.bg, borderWidth: 1.5, borderColor: colors.inputBorder, borderRadius: 8, padding: 10, fontSize: 14, color: colors.text, height: 100, textAlignVertical: 'top' }}
                value={notasText}
                onChangeText={setNotasText}
                multiline
                placeholder="Añade notas internas..."
                placeholderTextColor={colors.textMuted}
              />
              <TouchableOpacity
                style={{ marginTop: 10, backgroundColor: colors.primary, borderRadius: 8, paddingVertical: 10, alignItems: 'center' }}
                onPress={saveNotas}
              >
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Guardar notas</Text>
              </TouchableOpacity>
            </>
          ) : (
            <Text style={{ fontSize: 14, color: notasText ? colors.text : colors.textMuted, lineHeight: 20 }}>
              {notasText || 'Sin notas internas.'}
            </Text>
          )}
        </View>

        {/* Contactos */}
        {empresa.contactos?.length > 0 && (
          <View style={{ backgroundColor: colors.card, marginHorizontal: 16, marginBottom: 16, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 16 }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textMuted, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>Contactos</Text>
            {empresa.contactos.map((c, i) => (
              <View key={i} style={{ paddingVertical: 10, borderBottomWidth: i < empresa.contactos.length - 1 ? 1 : 0, borderBottomColor: colors.border }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>{c.nombre}</Text>
                {c.cargo ? <Text style={{ fontSize: 12, color: colors.primary, marginTop: 2 }}>{c.cargo}</Text> : null}
                <View style={{ flexDirection: 'row', gap: 16, marginTop: 4 }}>
                  {c.telefono ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Ionicons name="call-outline" size={12} color={colors.textMuted} />
                      <Text style={{ fontSize: 12, color: colors.textMuted }}>{c.telefono}</Text>
                    </View>
                  ) : null}
                  {c.email ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Ionicons name="mail-outline" size={12} color={colors.textMuted} />
                      <Text style={{ fontSize: 12, color: colors.textMuted }}>{c.email}</Text>
                    </View>
                  ) : null}
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Dispositivos - Category tabs */}
        <View style={{ marginHorizontal: 16, marginBottom: 8 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {CATEGORIAS.map(cat => (
              <TouchableOpacity
                key={cat.key}
                style={[{
                  paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, marginRight: 8,
                  borderWidth: 1.5, borderColor: catTab === cat.key ? colors.primary : colors.border,
                  backgroundColor: catTab === cat.key ? colors.primaryBg : colors.card,
                  flexDirection: 'row', alignItems: 'center', gap: 6,
                }]}
                onPress={() => setCatTab(cat.key)}
              >
                <Ionicons name={cat.icon} size={14} color={catTab === cat.key ? colors.primary : colors.textMuted} />
                <Text style={{ fontSize: 13, fontWeight: '600', color: catTab === cat.key ? colors.primary : colors.textMuted }}>{cat.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Devices list */}
        <View style={{ paddingHorizontal: 16, paddingBottom: 30 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>
              {CATEGORIAS.find(c => c.key === catTab)?.label}
            </Text>
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: colors.primaryBg }}
              onPress={() => { setEditingDisp(null); setShowModal(true) }}
            >
              <Ionicons name="add" size={16} color={colors.primary} />
              <Text style={{ fontSize: 13, fontWeight: '600', color: colors.primary }}>Añadir</Text>
            </TouchableOpacity>
          </View>

          {loadingDisp ? (
            <ActivityIndicator color={colors.primary} style={{ paddingVertical: 20 }} />
          ) : dispositivos.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 30 }}>
              <Ionicons name={CATEGORIAS.find(c => c.key === catTab)?.icon} size={36} color={colors.textMuted} />
              <Text style={{ color: colors.textMuted, marginTop: 8, fontSize: 14 }}>Sin dispositivos en esta categoría</Text>
            </View>
          ) : (
            dispositivos.map(disp => (
              <DispositivoCard
                key={disp.id}
                disp={disp}
                colors={colors}
                onEdit={d => { setEditingDisp(d); setShowModal(true) }}
                onDelete={handleDeleteDisp}
              />
            ))
          )}
        </View>
      </ScrollView>

      <DispositivoModal
        visible={showModal}
        categoriaActiva={catTab}
        dispositivo={editingDisp}
        empresaId={empresa.id}
        onClose={() => { setShowModal(false); setEditingDisp(null) }}
        onSave={handleSaveDisp}
        colors={colors}
      />

      <EditEmpresaSheet
        visible={showEditEmpresa}
        empresa={empresa}
        onClose={() => setShowEditEmpresa(false)}
        onSave={handleSaveEmpresa}
        colors={colors}
      />
    </SafeAreaView>
  )
}
