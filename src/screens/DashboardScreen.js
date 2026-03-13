import { useState, useEffect, useCallback } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, FlatList, ActivityIndicator, Alert, RefreshControl,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '../context/AuthContext'
import { getEmpresas, createEmpresa, updateEmpresa, deleteEmpresa, getDispositivos } from '../services/api'

const CAT_LABELS = { equipo: 'Equipos', servidor: 'Servidores', nas: 'NAS', red: 'Redes', correo: 'Correos', otro: 'Otros' }
const ICONOS = { equipo: 'desktop-outline', servidor: 'server-outline', nas: 'save-outline', red: 'git-network-outline', correo: 'mail-outline', otro: 'cube-outline' }

export default function DashboardScreen() {
  const { user, logout, isAdmin } = useAuth()
  const [empresas, setEmpresas]             = useState([])
  const [selectedEmpresa, setSelectedEmpresa] = useState(null)
  const [dispositivos, setDispositivos]     = useState([])
  const [loading, setLoading]               = useState(true)
  const [refreshing, setRefreshing]         = useState(false)
  const [tab, setTab]                       = useState('equipo')
  const [searchEmpresa, setSearchEmpresa]   = useState('')
  const [showNewEmpresa, setShowNewEmpresa] = useState(false)
  const [newEmpresaNombre, setNewEmpresaNombre] = useState('')

  const load = useCallback(async () => {
    try {
      const data = await getEmpresas()
      setEmpresas(data)
      if (!selectedEmpresa && data.length > 0) setSelectedEmpresa(data[0])
    } catch (e) {
      Alert.alert('Error', e.message)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!selectedEmpresa) return
    getDispositivos(selectedEmpresa.id, tab).then(setDispositivos).catch(() => setDispositivos([]))
  }, [selectedEmpresa, tab])

  const filtered = empresas.filter(e => e.nombre.toLowerCase().includes(searchEmpresa.toLowerCase()))

  async function handleAddEmpresa() {
    if (!newEmpresaNombre.trim()) return
    try {
      await createEmpresa({ nombre: newEmpresaNombre.trim() })
      setNewEmpresaNombre('')
      setShowNewEmpresa(false)
      load()
    } catch (e) { Alert.alert('Error', e.message) }
  }

  async function handleDeleteEmpresa(id) {
    Alert.alert('Eliminar empresa', '¿Confirmar?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: async () => {
        try {
          await deleteEmpresa(id)
          if (selectedEmpresa?.id === id) setSelectedEmpresa(null)
          load()
        } catch (e) { Alert.alert('Error', e.message) }
      }},
    ])
  }

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#0066ff" /></View>

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Dashboard</Text>
        <View style={styles.headerRight}>
          <Text style={styles.userName}>{user?.nombre || user?.email}</Text>
          <TouchableOpacity onPress={logout} style={styles.logoutBtn}>
            <Ionicons name="log-out-outline" size={22} color="#94a3b8" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.body}>
        {/* Panel empresas */}
        <View style={styles.sidebar}>
          <View style={styles.sidebarHeader}>
            <Text style={styles.sidebarTitle}>Empresas</Text>
            {isAdmin() && (
              <TouchableOpacity onPress={() => setShowNewEmpresa(v => !v)}>
                <Ionicons name="add-circle-outline" size={22} color="#0066ff" />
              </TouchableOpacity>
            )}
          </View>

          {showNewEmpresa && (
            <View style={styles.newEmpresaRow}>
              <TextInput
                style={styles.newEmpresaInput}
                placeholder="Nombre empresa"
                placeholderTextColor="#64748b"
                value={newEmpresaNombre}
                onChangeText={setNewEmpresaNombre}
              />
              <TouchableOpacity onPress={handleAddEmpresa} style={styles.addBtn}>
                <Ionicons name="checkmark" size={18} color="#fff" />
              </TouchableOpacity>
            </View>
          )}

          <TextInput
            style={styles.searchInput}
            placeholder="Buscar..."
            placeholderTextColor="#64748b"
            value={searchEmpresa}
            onChangeText={setSearchEmpresa}
          />

          <ScrollView>
            {filtered.map(e => (
              <TouchableOpacity
                key={e.id}
                style={[styles.empresaItem, selectedEmpresa?.id === e.id && styles.empresaItemActive]}
                onPress={() => setSelectedEmpresa(e)}
                onLongPress={() => isAdmin() && handleDeleteEmpresa(e.id)}
              >
                <View style={styles.empresaAvatar}>
                  <Text style={styles.empresaAvatarText}>{e.nombre[0]?.toUpperCase()}</Text>
                </View>
                <Text style={styles.empresaNombre} numberOfLines={1}>{e.nombre}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Dispositivos */}
        <View style={styles.main}>
          {selectedEmpresa ? (
            <>
              <Text style={styles.mainTitle}>{selectedEmpresa.nombre}</Text>

              {/* Tabs categorías */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabs}>
                {Object.entries(CAT_LABELS).map(([key, label]) => (
                  <TouchableOpacity
                    key={key}
                    style={[styles.tabBtn, tab === key && styles.tabBtnActive]}
                    onPress={() => setTab(key)}
                  >
                    <Ionicons name={ICONOS[key]} size={14} color={tab === key ? '#0066ff' : '#94a3b8'} />
                    <Text style={[styles.tabLabel, tab === key && styles.tabLabelActive]}>{label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Lista dispositivos */}
              <FlatList
                data={dispositivos}
                keyExtractor={item => String(item.id)}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load() }} />}
                ListEmptyComponent={<Text style={styles.empty}>Sin {CAT_LABELS[tab]}</Text>}
                renderItem={({ item }) => (
                  <View style={styles.deviceCard}>
                    <Ionicons name={ICONOS[tab]} size={20} color="#0066ff" style={{ marginRight: 10 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.deviceName}>{item.nombre || item.tipo || '—'}</Text>
                      {item.ip && <Text style={styles.deviceDetail}>IP: {item.ip}</Text>}
                      {item.usuario && <Text style={styles.deviceDetail}>Usuario: {item.usuario}</Text>}
                    </View>
                  </View>
                )}
              />
            </>
          ) : (
            <View style={styles.center}>
              <Text style={styles.empty}>Selecciona una empresa</Text>
            </View>
          )}
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container:          { flex: 1, backgroundColor: '#0f172a' },
  center:             { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header:             { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, backgroundColor: '#1e293b', borderBottomWidth: 1, borderBottomColor: '#334155' },
  headerTitle:        { color: '#fff', fontSize: 18, fontWeight: '700' },
  headerRight:        { flexDirection: 'row', alignItems: 'center', gap: 8 },
  userName:           { color: '#94a3b8', fontSize: 13 },
  logoutBtn:          { padding: 4 },
  body:               { flex: 1, flexDirection: 'row' },
  sidebar:            { width: 160, backgroundColor: '#1e293b', borderRightWidth: 1, borderRightColor: '#334155', padding: 10 },
  sidebarHeader:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  sidebarTitle:       { color: '#fff', fontWeight: '600', fontSize: 13 },
  searchInput:        { backgroundColor: '#0f172a', color: '#fff', borderRadius: 6, borderWidth: 1, borderColor: '#334155', paddingHorizontal: 10, paddingVertical: 6, fontSize: 13, marginBottom: 8 },
  newEmpresaRow:      { flexDirection: 'row', gap: 4, marginBottom: 8 },
  newEmpresaInput:    { flex: 1, backgroundColor: '#0f172a', color: '#fff', borderRadius: 6, borderWidth: 1, borderColor: '#334155', paddingHorizontal: 8, paddingVertical: 6, fontSize: 13 },
  addBtn:             { backgroundColor: '#0066ff', borderRadius: 6, padding: 7 },
  empresaItem:        { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, paddingHorizontal: 6, borderRadius: 8, marginBottom: 4 },
  empresaItemActive:  { backgroundColor: '#1d4ed8' },
  empresaAvatar:      { width: 28, height: 28, borderRadius: 14, backgroundColor: '#0066ff', justifyContent: 'center', alignItems: 'center' },
  empresaAvatarText:  { color: '#fff', fontWeight: 'bold', fontSize: 12 },
  empresaNombre:      { color: '#e2e8f0', fontSize: 13, flex: 1 },
  main:               { flex: 1, padding: 12 },
  mainTitle:          { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 10 },
  tabs:               { flexGrow: 0, marginBottom: 10 },
  tabBtn:             { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, marginRight: 6, backgroundColor: '#1e293b' },
  tabBtnActive:       { backgroundColor: '#1d4ed8' },
  tabLabel:           { color: '#94a3b8', fontSize: 12 },
  tabLabelActive:     { color: '#60a5fa' },
  deviceCard:         { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: '#1e293b', borderRadius: 10, padding: 12, marginBottom: 8 },
  deviceName:         { color: '#fff', fontWeight: '600', fontSize: 14 },
  deviceDetail:       { color: '#94a3b8', fontSize: 12, marginTop: 2 },
  empty:              { color: '#64748b', textAlign: 'center', marginTop: 30 },
})
