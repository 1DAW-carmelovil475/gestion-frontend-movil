import { useState, useEffect } from 'react'
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator, Alert, RefreshControl,
} from 'react-native'
import { getEstadisticasResumen, getEstadisticasOperarios } from '../services/api'

function StatCard({ titulo, valor, sub, color = '#0066ff' }) {
  return (
    <View style={[styles.statCard, { borderLeftColor: color }]}>
      <Text style={styles.statValor}>{valor}</Text>
      <Text style={styles.statTitulo}>{titulo}</Text>
      {!!sub && <Text style={styles.statSub}>{sub}</Text>}
    </View>
  )
}

export default function EstadisticasScreen() {
  const [resumen, setResumen]       = useState(null)
  const [operarios, setOperarios]   = useState([])
  const [loading, setLoading]       = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  async function load() {
    try {
      const [r, op] = await Promise.all([
        getEstadisticasResumen(),
        getEstadisticasOperarios(),
      ])
      setResumen(r)
      setOperarios(Array.isArray(op) ? op : op.operarios || [])
    } catch (e) { Alert.alert('Error', e.message) }
    finally { setLoading(false); setRefreshing(false) }
  }

  useEffect(() => { load() }, [])

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#0066ff" /></View>

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load() }} />}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Estadísticas</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Resumen General</Text>
        <View style={styles.statsGrid}>
          <StatCard titulo="Total Tickets"    valor={resumen?.total_tickets ?? '—'} />
          <StatCard titulo="Abiertos"         valor={resumen?.abiertos     ?? '—'} color="#16a34a" />
          <StatCard titulo="En Curso"         valor={resumen?.en_curso     ?? '—'} color="#d97706" />
          <StatCard titulo="Cerrados"         valor={resumen?.cerrados     ?? '—'} color="#64748b" />
          <StatCard titulo="Urgentes"         valor={resumen?.urgentes     ?? '—'} color="#dc2626" />
          <StatCard titulo="Tiempo Promedio"  valor={resumen?.tiempo_promedio ? `${Number(resumen.tiempo_promedio).toFixed(1)}h` : '—'} color="#9333ea" />
        </View>
      </View>

      {operarios.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Por Operario</Text>
          {operarios.map((op, i) => (
            <View key={i} style={styles.operarioRow}>
              <View style={styles.operarioAvatar}>
                <Text style={styles.operarioAvatarText}>{(op.nombre || op.email || '?')[0].toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.operarioNombre}>{op.nombre || op.email}</Text>
                <Text style={styles.operarioSub}>
                  {op.total_tickets ?? 0} tickets · {op.resueltos ?? 0} resueltos
                </Text>
              </View>
              <View style={styles.operarioBadge}>
                <Text style={styles.operarioBadgeText}>{op.total_horas ? `${Number(op.total_horas).toFixed(0)}h` : '—'}</Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container:          { flex: 1, backgroundColor: '#0f172a' },
  center:             { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header:             { paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#1e293b', borderBottomWidth: 1, borderBottomColor: '#334155' },
  title:              { color: '#fff', fontSize: 18, fontWeight: '700' },
  section:            { padding: 16 },
  sectionTitle:       { color: '#94a3b8', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 },
  statsGrid:          { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCard:           { backgroundColor: '#1e293b', borderRadius: 10, padding: 14, minWidth: '45%', flex: 1, borderLeftWidth: 4 },
  statValor:          { color: '#fff', fontSize: 28, fontWeight: '700' },
  statTitulo:         { color: '#94a3b8', fontSize: 13, marginTop: 4 },
  statSub:            { color: '#64748b', fontSize: 11, marginTop: 2 },
  operarioRow:        { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1e293b', borderRadius: 10, padding: 12, marginBottom: 8, gap: 12 },
  operarioAvatar:     { width: 38, height: 38, borderRadius: 19, backgroundColor: '#0066ff', justifyContent: 'center', alignItems: 'center' },
  operarioAvatarText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  operarioNombre:     { color: '#fff', fontWeight: '600', fontSize: 14 },
  operarioSub:        { color: '#64748b', fontSize: 12, marginTop: 2 },
  operarioBadge:      { backgroundColor: '#0f172a', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  operarioBadgeText:  { color: '#94a3b8', fontSize: 13, fontWeight: '600' },
})
