import { useState, useEffect, useCallback } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, FlatList, ActivityIndicator, Alert, RefreshControl,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '../context/AuthContext'
import { getEmpresas, createEmpresa, deleteEmpresa, getDispositivos } from '../services/api'

const CAT_LABELS = { equipo: 'Equipos', servidor: 'Servidores', nas: 'NAS', red: 'Redes', correo: 'Correos', otro: 'Otros' }
const ICONOS     = { equipo: 'desktop-outline', servidor: 'server-outline', nas: 'save-outline', red: 'git-network-outline', correo: 'mail-outline', otro: 'cube-outline' }

export default function DashboardScreen() {
  const { user, logout, isAdmin } = useAuth()
  const [empresas, setEmpresas]               = useState([])
  const [selectedEmpresa, setSelectedEmpresa] = useState(null)
  const [dispositivos, setDispositivos]       = useState([])
  const [loading, setLoading]                 = useState(true)
  const [refreshing, setRefreshing]           = useState(false)
  const [tab, setTab]                         = useState('equipo')
  const [searchEmpresa, setSearchEmpresa]     = useState('')
  const [showNewEmpresa, setShowNewEmpresa]   = useState(false)
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

  const filtered = empresas.filter(e =>
    e.nombre.toLowerCase().includes(searchEmpresa.toLowerCase())
  )

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

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}><ActivityIndicator size="large" color="#0047b3" /></View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.headerLogo}>
            <Text style={styles.headerLogoText}>HI</Text>
          </View>
          <Text style={styles.headerTitle}>Dashboard</Text>
        </View>
        <View style={styles.headerRight}>
          <Text style={styles.userName} numberOfLines={1}>{user?.nombre || user?.email}</Text>
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
                <Ionicons name="add-circle-outline" size={22} color="#0047b3" />
              </TouchableOpacity>
            )}
          </View>

          {showNewEmpresa && (
            <View style={styles.newEmpresaRow}>
              <TextInput
                style={styles.newEmpresaInput}
                placeholder="Nombre"
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

          <ScrollView style={styles.sidebarScroll} showsVerticalScrollIndicator={false}>
            {filtered.map(e => (
              <TouchableOpacity
                key={e.id}
                style={[styles.empresaItem, selectedEmpresa?.id === e.id && styles.empresaItemActive]}
                onPress={() => setSelectedEmpresa(e)}
                onLongPress={() => isAdmin() && handleDeleteEmpresa(e.id)}
              >
                <View style={[styles.empresaAvatar, selectedEmpresa?.id === e.id && styles.empresaAvatarActive]}>
                  <Text style={styles.empresaAvatarText}>{e.nombre[0]?.toUpperCase()}</Text>
                </View>
                <Text style={[styles.empresaNombre, selectedEmpresa?.id === e.id && styles.empresaNombreActive]} numberOfLines={2}>
                  {e.nombre}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Panel principal */}
        <View style={styles.main}>
          {selectedEmpresa ? (
            <>
              {/* Nombre empresa */}
              <View style={styles.mainHeader}>
                <Text style={styles.mainTitle} numberOfLines={1}>{selectedEmpresa.nombre}</Text>
              </View>

              {/* Tabs categorías */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsRow}>
                {Object.entries(CAT_LABELS).map(([key, label]) => (
                  <TouchableOpacity
                    key={key}
                    style={[styles.tabBtn, tab === key && styles.tabBtnActive]}
                    onPress={() => setTab(key)}
                  >
                    <Ionicons name={ICONOS[key]} size={13} color={tab === key ? '#fff' : '#94a3b8'} />
                    <Text style={[styles.tabLabel, tab === key && styles.tabLabelActive]}>{label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Lista dispositivos */}
              <FlatList
                data={dispositivos}
                keyExtractor={item => String(item.id)}
                contentContainerStyle={{ paddingBottom: 12 }}
                refreshControl={
                  <RefreshControl
                    refreshing={refreshing}
                    onRefresh={() => { setRefreshing(true); load() }}
                    tintColor="#0047b3"
                  />
                }
                ListEmptyComponent={
                  <View style={styles.emptyContainer}>
                    <Ionicons name={ICONOS[tab]} size={36} color="#334155" />
                    <Text style={styles.empty}>Sin {CAT_LABELS[tab]}</Text>
                  </View>
                }
                renderItem={({ item }) => (
                  <View style={styles.deviceCard}>
                    <View style={styles.deviceIconWrap}>
                      <Ionicons name={ICONOS[tab]} size={18} color="#0047b3" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.deviceName}>{item.nombre || item.tipo || '—'}</Text>
                      {item.ip      && <Text style={styles.deviceDetail}>IP: {item.ip}</Text>}
                      {item.usuario && <Text style={styles.deviceDetail}>Usuario: {item.usuario}</Text>}
                    </View>
                  </View>
                )}
              />
            </>
          ) : (
            <View style={styles.center}>
              <Ionicons name="business-outline" size={48} color="#334155" />
              <Text style={styles.empty}>Selecciona una empresa</Text>
            </View>
          )}
        </View>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe:               { flex: 1, backgroundColor: '#0f172a' },
  center:             { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  header:             { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#1e293b', borderBottomWidth: 1, borderBottomColor: '#334155' },
  headerLeft:         { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerLogo:         { width: 32, height: 32, borderRadius: 8, backgroundColor: '#0047b3', justifyContent: 'center', alignItems: 'center' },
  headerLogoText:     { color: '#fff', fontWeight: '800', fontSize: 12 },
  headerTitle:        { color: '#fff', fontSize: 17, fontWeight: '700' },
  headerRight:        { flexDirection: 'row', alignItems: 'center', gap: 8, maxWidth: 160 },
  userName:           { color: '#94a3b8', fontSize: 12, flexShrink: 1 },
  logoutBtn:          { padding: 4 },
  body:               { flex: 1, flexDirection: 'row' },
  sidebar:            { width: 150, backgroundColor: '#1e293b', borderRightWidth: 1, borderRightColor: '#334155', paddingHorizontal: 8, paddingTop: 10, paddingBottom: 0 },
  sidebarHeader:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  sidebarTitle:       { color: '#fff', fontWeight: '700', fontSize: 13 },
  searchInput:        { backgroundColor: '#0f172a', color: '#fff', borderRadius: 6, borderWidth: 1, borderColor: '#334155', paddingHorizontal: 9, paddingVertical: 7, fontSize: 12, marginBottom: 8 },
  newEmpresaRow:      { flexDirection: 'row', gap: 4, marginBottom: 8 },
  newEmpresaInput:    { flex: 1, backgroundColor: '#0f172a', color: '#fff', borderRadius: 6, borderWidth: 1, borderColor: '#334155', paddingHorizontal: 8, paddingVertical: 6, fontSize: 12 },
  addBtn:             { backgroundColor: '#0047b3', borderRadius: 6, padding: 7 },
  sidebarScroll:      { flex: 1 },
  empresaItem:        { flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 8, paddingHorizontal: 6, borderRadius: 8, marginBottom: 3 },
  empresaItemActive:  { backgroundColor: '#0047b3' },
  empresaAvatar:      { width: 26, height: 26, borderRadius: 6, backgroundColor: '#334155', justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  empresaAvatarActive:{ backgroundColor: 'rgba(255,255,255,0.2)' },
  empresaAvatarText:  { color: '#fff', fontWeight: '700', fontSize: 11 },
  empresaNombre:      { color: '#94a3b8', fontSize: 12, flex: 1 },
  empresaNombreActive:{ color: '#fff' },
  main:               { flex: 1, backgroundColor: '#0f172a' },
  mainHeader:         { paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#1e293b' },
  mainTitle:          { color: '#fff', fontSize: 15, fontWeight: '700' },
  tabsRow:            { flexGrow: 0, paddingHorizontal: 10, paddingVertical: 10 },
  tabBtn:             { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, marginRight: 6, backgroundColor: '#1e293b' },
  tabBtnActive:       { backgroundColor: '#0047b3' },
  tabLabel:           { color: '#94a3b8', fontSize: 11 },
  tabLabelActive:     { color: '#fff' },
  emptyContainer:     { alignItems: 'center', marginTop: 48, gap: 8 },
  empty:              { color: '#64748b', fontSize: 14, textAlign: 'center' },
  deviceCard:         { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: '#1e293b', borderRadius: 10, padding: 12, marginHorizontal: 10, marginBottom: 8, borderWidth: 1, borderColor: '#334155' },
  deviceIconWrap:     { width: 34, height: 34, borderRadius: 8, backgroundColor: '#0f172a', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  deviceName:         { color: '#fff', fontWeight: '600', fontSize: 13 },
  deviceDetail:       { color: '#64748b', fontSize: 12, marginTop: 2 },
})
