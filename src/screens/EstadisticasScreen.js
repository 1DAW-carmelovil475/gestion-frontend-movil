import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  Dimensions,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BarChart, LineChart } from 'react-native-chart-kit';
import Svg, { Path, G } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import {
  getEstadisticasResumen,
  getEstadisticasOperarios,
  getEstadisticasEmpresas,
} from '../services/api';

const CHART_W = Dimensions.get('window').width - 32;

const ESTADO_COLORS = {
  pendientes: '#f59e0b',
  en_curso: '#06b6d4',
  completados: '#22c55e',
  facturados: '#8b5cf6',
};

const AVATAR_COLORS = [
  '#0066ff',
  '#16a34a',
  '#d97706',
  '#dc2626',
  '#9333ea',
  '#0891b2',
  '#be185d',
  '#065f46',
];

// ─── SVG Donut helpers ────────────────────────────────────────────────────────

function polarToXY(cx, cy, r, angleDeg) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

function describeArc(cx, cy, innerR, outerR, startAngle, endAngle) {
  const outerStart = polarToXY(cx, cy, outerR, startAngle);
  const outerEnd   = polarToXY(cx, cy, outerR, endAngle);
  const innerStart = polarToXY(cx, cy, innerR, startAngle);
  const innerEnd   = polarToXY(cx, cy, innerR, endAngle);
  const largeArc   = endAngle - startAngle > 180 ? 1 : 0;

  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${outerR} ${outerR} 0 ${largeArc} 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `A ${innerR} ${innerR} 0 ${largeArc} 0 ${innerStart.x} ${innerStart.y}`,
    'Z',
  ].join(' ');
}

function DonutChart({ data, size = 185, innerR = 52, outerR = 82 }) {
  const cx    = size / 2;
  const cy    = size / 2;
  const total = data.reduce((s, d) => s + d.value, 0);

  if (total === 0) {
    return (
      <Svg width={size} height={size}>
        <Path
          d={describeArc(cx, cy, innerR, outerR, 0, 359.99)}
          fill="#e5e7eb"
        />
      </Svg>
    );
  }

  let currentAngle = 0;
  const segments = data.map((item) => {
    const sweep = (item.value / total) * 360;
    const start = currentAngle;
    const end   = currentAngle + sweep;
    currentAngle = end;
    return { ...item, start, end };
  });

  return (
    <Svg width={size} height={size}>
      <G>
        {segments.map((seg, i) => {
          const gap     = 1.5;
          const safeEnd = seg.end - gap > seg.start ? seg.end - gap : seg.end;
          return (
            <Path
              key={i}
              d={describeArc(cx, cy, innerR, outerR, seg.start, safeEnd)}
              fill={seg.color}
            />
          );
        })}
      </G>
    </Svg>
  );
}

function DonutLegend({ data, colors }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <View style={styles.donutLegend}>
      {data.map((item, i) => (
        <View key={i} style={styles.donutLegendRow}>
          <View style={[styles.donutDot, { backgroundColor: item.color }]} />
          <Text style={[styles.donutLegendName, { color: colors.textMuted }]} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={[styles.donutLegendValue, { color: colors.text }]}>
            {item.value}
          </Text>
          <Text style={[styles.donutLegendPct, { color: colors.textMuted }]}>
            {total > 0 ? ` (${Math.round((item.value / total) * 100)}%)` : ''}
          </Text>
        </View>
      ))}
    </View>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({ icon, label, value, iconColor, bgColor, colors }) {
  return (
    <View
      style={[
        styles.kpiCard,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <View style={[styles.kpiIconBox, { backgroundColor: bgColor }]}>
        <Ionicons name={icon} size={20} color={iconColor} />
      </View>
      <Text style={[styles.kpiValue, { color: colors.text }]}>{value}</Text>
      <Text style={[styles.kpiLabel, { color: colors.textMuted }]}>{label}</Text>
    </View>
  );
}

// ─── Tab Button ───────────────────────────────────────────────────────────────

function TabButton({ label, active, onPress, colors }) {
  return (
    <TouchableOpacity
      style={[
        styles.tabBtn,
        active && { borderBottomColor: colors.primary, borderBottomWidth: 2 },
      ]}
      onPress={onPress}
    >
      <Text
        style={[
          styles.tabBtnText,
          { color: active ? colors.primary : colors.textMuted },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

// ─── Operator Avatar ──────────────────────────────────────────────────────────

function Avatar({ name, index, size = 36 }) {
  const bg       = AVATAR_COLORS[index % AVATAR_COLORS.length];
  const initials = (name || '?')
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
  return (
    <View
      style={[
        styles.avatar,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: bg,
        },
      ]}
    >
      <Text style={[styles.avatarText, { fontSize: size * 0.38 }]}>
        {initials}
      </Text>
    </View>
  );
}

// ─── Progress Bar ─────────────────────────────────────────────────────────────

function ProgressBar({ pct, color, colors }) {
  return (
    <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
      <View
        style={[
          styles.progressFill,
          {
            width: `${Math.min(100, Math.max(0, pct))}%`,
            backgroundColor: color,
          },
        ]}
      />
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function EstadisticasScreen() {
  const { colors, isDark, toggleTheme } = useTheme();
  const { user, logout } = useAuth();

  const [tab, setTab]             = useState('tickets');
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [resumen, setResumen]     = useState(null);
  const [operarios, setOperarios] = useState([]);
  const [empresas, setEmpresas]   = useState([]);
  const [error, setError]         = useState(null);

  const fetchAll = useCallback(async () => {
    try {
      setError(null);
      const [r, o, e] = await Promise.all([
        getEstadisticasResumen(),
        getEstadisticasOperarios(),
        getEstadisticasEmpresas(),
      ]);
      setResumen(r);
      setOperarios(Array.isArray(o) ? o : []);
      setEmpresas(Array.isArray(e) ? e : []);
    } catch (err) {
      setError('No se pudieron cargar las estadísticas.');
    }
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await fetchAll();
      setLoading(false);
    })();
  }, [fetchAll]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchAll();
    setRefreshing(false);
  }, [fetchAll]);

  // ── Derived data ───────────────────────────────────────────────────────────

  const estadoData = resumen
    ? [
        {
          name: 'Pendientes',
          value: resumen.pendientes ?? 0,
          color: ESTADO_COLORS.pendientes,
        },
        {
          name: 'En curso',
          value: resumen.en_curso ?? 0,
          color: ESTADO_COLORS.en_curso,
        },
        {
          name: 'Completados',
          value: resumen.completados ?? 0,
          color: ESTADO_COLORS.completados,
        },
        {
          name: 'Facturados',
          value: resumen.facturados ?? 0,
          color: ESTADO_COLORS.facturados,
        },
      ]
    : [];

  const BAR_ABBREV = { 'Pendientes': 'Pend.', 'En curso': 'Curso', 'Completados': 'Comp.', 'Facturados': 'Fact.' };
  const barLabels = estadoData.map((d) => BAR_ABBREV[d.name] || d.name.split(' ')[0]);
  const barValues = estadoData.map((d) => d.value);
  const barColors = estadoData.map((d) => () => d.color);


  const chartConfig = {
    backgroundGradientFrom: isDark ? '#1e2430' : '#ffffff',
    backgroundGradientTo:   isDark ? '#1e2430' : '#ffffff',
    decimalPlaces: 0,
    color: (opacity = 1) =>
      isDark
        ? `rgba(148,163,184,${opacity})`
        : `rgba(100,116,139,${opacity})`,
    labelColor: (opacity = 1) =>
      isDark
        ? `rgba(148,163,184,${opacity})`
        : `rgba(100,116,139,${opacity})`,
    style: { borderRadius: 12 },
    propsForDots: { r: '4', strokeWidth: '2' },
    fillShadowGradientOpacity: 0.15,
  };

  // ── Sub-renders ────────────────────────────────────────────────────────────

  const renderHeader = () => (
    <View
      style={[
        styles.header,
        {
          backgroundColor: colors.card,
          borderBottomColor: colors.border,
        },
      ]}
    >
      <Text style={[styles.headerTitle, { color: colors.text }]}>
        Estadísticas
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: AVATAR_COLORS[Math.abs((user?.id || '').split('').reduce((h, c) => c.charCodeAt(0) + ((h << 5) - h), 0)) % AVATAR_COLORS.length], alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>
            {(user?.nombre || user?.email || '?').split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
          </Text>
        </View>
        <Text style={{ fontSize: 12, color: colors.textMuted, maxWidth: 100 }} numberOfLines={1}>
          {user?.nombre || user?.email || ''}
        </Text>
        <TouchableOpacity onPress={toggleTheme} style={styles.headerBtn}>
          <Ionicons
            name={isDark ? 'sunny-outline' : 'moon-outline'}
            size={22}
            color={colors.text}
          />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => Alert.alert('Cerrar sesión', '¿Cerrar sesión?', [
            { text: 'Cancelar', style: 'cancel' },
            { text: 'Salir', style: 'destructive', onPress: logout },
          ])}
          style={styles.headerBtn}
        >
          <Ionicons name="log-out-outline" size={22} color={colors.text} />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderKpis = () => {
    if (!resumen) return null;
    const abiertos = (resumen.pendientes ?? 0) + (resumen.en_curso ?? 0);
    const cards = [
      {
        icon: 'ticket-outline',
        label: 'Total tickets',
        value: resumen.total ?? 0,
        iconColor: colors.primary,
        bgColor: colors.primaryBg,
      },
      {
        icon: 'time-outline',
        label: 'Abiertos',
        value: abiertos,
        iconColor: colors.warning,
        bgColor: colors.warningBg,
      },
      {
        icon: 'checkmark-circle-outline',
        label: 'Completados',
        value: resumen.completados ?? 0,
        iconColor: colors.success,
        bgColor: colors.successBg,
      },
      {
        icon: 'receipt-outline',
        label: 'Facturados',
        value: resumen.facturados ?? 0,
        iconColor: colors.purple,
        bgColor: colors.purpleBg,
      },
      {
        icon: 'warning-outline',
        label: 'Urgentes',
        value: resumen.urgentes ?? 0,
        iconColor: colors.danger,
        bgColor: colors.dangerBg,
      },
      {
        icon: 'calendar-outline',
        label: 'Últ. 7 días',
        value: resumen.ultimos_7_dias ?? 0,
        iconColor: colors.info,
        bgColor: colors.infoBg,
      },
    ];
    return (
      <View style={styles.kpiGrid}>
        {cards.map((c, i) => (
          <KpiCard key={i} {...c} colors={colors} />
        ))}
      </View>
    );
  };

  const renderTabsBar = () => (
    <View
      style={[
        styles.tabsBar,
        {
          backgroundColor: colors.card,
          borderBottomColor: colors.border,
        },
      ]}
    >
      {['tickets', 'operarios', 'empresas'].map((t) => (
        <TabButton
          key={t}
          label={t.charAt(0).toUpperCase() + t.slice(1)}
          active={tab === t}
          onPress={() => setTab(t)}
          colors={colors}
        />
      ))}
    </View>
  );

  // ── Tickets tab ────────────────────────────────────────────────────────────

  const renderTicketsTab = () => (
    <View>
      {/* Donut card */}
      <View
        style={[
          styles.card,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.cardTitle, { color: colors.text }]}>
          Distribución por estado
        </Text>
        <View style={styles.donutRow}>
          <DonutChart data={estadoData} size={160} innerR={44} outerR={70} />
          <DonutLegend data={estadoData} colors={colors} />
        </View>
      </View>

      {/* BarChart card */}
      <View
        style={[
          styles.card,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.cardTitle, { color: colors.text }]}>
          Volumen por estado
        </Text>
        {barValues.some((v) => v > 0) ? (
          <BarChart
            data={{
              labels: barLabels,
              datasets: [
                {
                  data: barValues,
                  colors: barColors,
                },
              ],
            }}
            width={CHART_W - 32}
            height={220}
            chartConfig={chartConfig}
            withCustomBarColorFromData
            flatColor
            showValuesOnTopOfBars
            fromZero
            style={styles.chartStyle}
          />
        ) : (
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>
            Sin datos
          </Text>
        )}
      </View>
    </View>
  );

  // ── Operarios tab ──────────────────────────────────────────────────────────

  const renderOperariosTab = () => {
    const operLineLabels   = operarios.map(o => (o.nombre || 'Op').split(' ')[0].substring(0, 7))
    const operCompletados  = operarios.map(o => o.completados ?? o.tickets_completados ?? 0)
    const operPendientes   = operarios.map(o => o.pendientes  ?? o.tickets_pendientes  ?? 0)
    const lineChartWidth   = Math.max(CHART_W - 32, operarios.length * 64)

    return (
    <View>
      {/* Line chart */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>Evolución por operario</Text>
        {operarios.length > 0 ? (
          <>
            <View style={[styles.lineLegend, { marginBottom: 8 }]}>
              {[['#22c55e', 'Completados'], ['#f59e0b', 'Pendientes']].map(([color, label]) => (
                <View key={label} style={styles.lineLegendItem}>
                  <View style={[styles.lineDot, { backgroundColor: color }]} />
                  <Text style={[styles.lineLegendText, { color: colors.textMuted }]}>{label}</Text>
                </View>
              ))}
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <LineChart
                data={{
                  labels: operLineLabels,
                  datasets: [
                    { data: operCompletados.length ? operCompletados : [0], color: () => '#22c55e', strokeWidth: 2 },
                    { data: operPendientes.length  ? operPendientes  : [0], color: () => '#f59e0b', strokeWidth: 2 },
                  ],
                  legend: ['Completados', 'Pendientes'],
                }}
                width={lineChartWidth}
                height={200}
                chartConfig={chartConfig}
                bezier
                withDots
                withInnerLines={false}
                withOuterLines
                style={styles.chartStyle}
              />
            </ScrollView>
          </>
        ) : (
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>Sin datos de operarios</Text>
        )}
      </View>

      {/* Activity chart */}
      <View
        style={[
          styles.card,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.cardTitle, { color: colors.text }]}>
          Actividad por operario
        </Text>
        {operarios.length > 0 ? (
          <>
            <View style={{ flexDirection: 'row', gap: 16, marginBottom: 10 }}>
              {[['#22c55e','Completados'],['#f59e0b','Pendientes'],['#06b6d4','En curso']].map(([color, label]) => (
                <View key={label} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color }} />
                  <Text style={{ fontSize: 11, color: colors.textMuted }}>{label}</Text>
                </View>
              ))}
            </View>
            {operarios.map((o, i) => {
              const comp = o.completados ?? o.tickets_completados ?? 0
              const pend = o.pendientes ?? o.tickets_pendientes ?? 0
              const enC  = o.en_curso ?? 0
              const total = comp + pend + enC || 1
              const nombre = (o.nombre || 'Operario').split(' ').slice(0, 2).join(' ')
              return (
                <View key={o.id ?? i} style={{ marginBottom: 10 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 }}>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: colors.text }} numberOfLines={1}>{nombre}</Text>
                    <Text style={{ fontSize: 11, color: colors.textMuted }}>{comp+pend+enC}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden', backgroundColor: colors.badgeGray }}>
                    {comp > 0 && <View style={{ flex: comp / total, backgroundColor: '#22c55e' }} />}
                    {enC  > 0 && <View style={{ flex: enC  / total, backgroundColor: '#06b6d4' }} />}
                    {pend > 0 && <View style={{ flex: pend / total, backgroundColor: '#f59e0b' }} />}
                  </View>
                </View>
              )
            })}
          </>
        ) : (
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>
            Sin datos de operarios
          </Text>
        )}
      </View>

      {/* Individual operator cards */}
      {operarios.map((op, i) => {
        const comp  = op.completados ?? op.tickets_completados ?? 0;
        const pend  = op.pendientes  ?? op.tickets_pendientes  ?? 0;
        const enCur = op.en_curso    ?? 0;
        const total = op.tickets_totales || (comp + pend + enCur);
        const pctComp = total > 0 ? (comp / total) * 100 : 0;
        const mediaHoras = op.media_horas != null && op.media_horas !== undefined
          ? op.media_horas.toFixed(1) + 'h'
          : '0.0h';
        return (
          <View
            key={op.id ?? i}
            style={[
              styles.card,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <View style={styles.opCardHeader}>
              <Avatar name={op.nombre} index={i} size={40} />
              <View style={styles.opCardInfo}>
                <Text style={[styles.opName, { color: colors.text }]}>
                  {op.nombre ?? 'Operario'}
                </Text>
                <Text style={[styles.opSub, { color: colors.textMuted }]}>
                  {total} tickets totales
                </Text>
              </View>
              <View style={styles.opBadge}>
                <Text style={[styles.opBadgeText, { color: colors.primary }]}>
                  {Math.round(pctComp)}%
                </Text>
              </View>
            </View>
            <View style={styles.opStats}>
              <View style={styles.opStatItem}>
                <View
                  style={[
                    styles.opStatDot,
                    { backgroundColor: ESTADO_COLORS.completados },
                  ]}
                />
                <Text style={[styles.opStatLabel, { color: colors.textMuted }]}>
                  Completados
                </Text>
                <Text style={[styles.opStatVal, { color: colors.text }]}>
                  {comp}
                </Text>
              </View>
              <View style={styles.opStatItem}>
                <View
                  style={[
                    styles.opStatDot,
                    { backgroundColor: ESTADO_COLORS.pendientes },
                  ]}
                />
                <Text style={[styles.opStatLabel, { color: colors.textMuted }]}>
                  Pendientes
                </Text>
                <Text style={[styles.opStatVal, { color: colors.text }]}>
                  {pend}
                </Text>
              </View>
              <View style={styles.opStatItem}>
                <View
                  style={[
                    styles.opStatDot,
                    { backgroundColor: ESTADO_COLORS.en_curso },
                  ]}
                />
                <Text style={[styles.opStatLabel, { color: colors.textMuted }]}>
                  En curso
                </Text>
                <Text style={[styles.opStatVal, { color: colors.text }]}>
                  {enCur}
                </Text>
              </View>
              <View style={styles.opStatItem}>
                <View
                  style={[
                    styles.opStatDot,
                    { backgroundColor: colors.primary },
                  ]}
                />
                <Text style={[styles.opStatLabel, { color: colors.textMuted }]}>
                  Media h.
                </Text>
                <Text style={[styles.opStatVal, { color: colors.text }]}>
                  {mediaHoras}
                </Text>
              </View>
            </View>
            <ProgressBar
              pct={pctComp}
              color={ESTADO_COLORS.completados}
              colors={colors}
            />
          </View>
        );
      })}
    </View>
    )
  };

  // ── Empresas tab ───────────────────────────────────────────────────────────

  const renderEmpresasTab = () => (
    <View>
      {/* Horizontal stacked bar chart */}
      <View
        style={[
          styles.card,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.cardTitle, { color: colors.text }]}>
          Tickets por empresa
        </Text>
        {empresas.length === 0 ? (
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>
            Sin datos de empresas
          </Text>
        ) : (
          <>
            {empresas.slice(0, 6).map((emp, i) => {
              const total =
                (emp.pendientes ?? 0) +
                (emp.en_curso   ?? 0) +
                (emp.completados ?? 0) +
                (emp.facturados  ?? 0);
              if (total === 0) return null;
              return (
                <View key={emp.id ?? i} style={styles.stackedRow}>
                  <Text
                    style={[styles.stackedLabel, { color: colors.textMuted }]}
                    numberOfLines={1}
                  >
                    {emp.nombre ?? 'Empresa'}
                  </Text>
                  <View style={styles.stackedBarWrap}>
                    {[
                      { key: 'pendientes',  color: ESTADO_COLORS.pendientes  },
                      { key: 'en_curso',    color: ESTADO_COLORS.en_curso    },
                      { key: 'completados', color: ESTADO_COLORS.completados },
                      { key: 'facturados',  color: ESTADO_COLORS.facturados  },
                    ].map(({ key, color }) => {
                      const v   = emp[key] ?? 0;
                      const pct = (v / total) * 100;
                      if (pct === 0) return null;
                      return (
                        <View
                          key={key}
                          style={[
                            styles.stackedSegment,
                            { width: `${pct}%`, backgroundColor: color },
                          ]}
                        />
                      );
                    })}
                  </View>
                  <Text style={[styles.stackedTotal, { color: colors.text }]}>
                    {total}
                  </Text>
                </View>
              );
            })}
            {/* Legend */}
            <View style={styles.stackedLegend}>
              {Object.entries(ESTADO_COLORS).map(([key, color]) => (
                <View key={key} style={styles.stackedLegendItem}>
                  <View style={[styles.donutDot, { backgroundColor: color }]} />
                  <Text
                    style={[
                      styles.stackedLegendText,
                      { color: colors.textMuted },
                    ]}
                  >
                    {key.charAt(0).toUpperCase() +
                      key.slice(1).replace('_', ' ')}
                  </Text>
                </View>
              ))}
            </View>
          </>
        )}
      </View>

      {/* Detailed list */}
      {empresas.map((emp, i) => {
        const total =
          (emp.pendientes  ?? 0) +
          (emp.en_curso    ?? 0) +
          (emp.completados ?? 0) +
          (emp.facturados  ?? 0);
        const pctComp = total > 0 ? ((emp.completados ?? 0) / total) * 100 : 0;
        const pctFact = total > 0 ? ((emp.facturados  ?? 0) / total) * 100 : 0;
        return (
          <View
            key={emp.id ?? i}
            style={[
              styles.card,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <View style={styles.empHeader}>
              <View
                style={[
                  styles.empIconBox,
                  { backgroundColor: colors.primaryBg },
                ]}
              >
                <Ionicons
                  name="business-outline"
                  size={18}
                  color={colors.primary}
                />
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={[styles.empName, { color: colors.text }]}>
                  {emp.nombre ?? 'Empresa'}
                </Text>
                <Text style={[styles.empSub, { color: colors.textMuted }]}>
                  {total} tickets
                </Text>
              </View>
              <View
                style={[
                  styles.empTotalBadge,
                  { backgroundColor: colors.primaryBg },
                ]}
              >
                <Text
                  style={[styles.empTotalText, { color: colors.primary }]}
                >
                  {total}
                </Text>
              </View>
            </View>

            <View style={styles.empStatsRow}>
              {[
                {
                  label: 'Pend.',
                  value: emp.pendientes  ?? 0,
                  color: ESTADO_COLORS.pendientes,
                },
                {
                  label: 'En curso',
                  value: emp.en_curso    ?? 0,
                  color: ESTADO_COLORS.en_curso,
                },
                {
                  label: 'Comp.',
                  value: emp.completados ?? 0,
                  color: ESTADO_COLORS.completados,
                },
                {
                  label: 'Fact.',
                  value: emp.facturados  ?? 0,
                  color: ESTADO_COLORS.facturados,
                },
              ].map((s) => (
                <View key={s.label} style={styles.empStatItem}>
                  <Text style={[styles.empStatVal, { color: s.color }]}>
                    {s.value}
                  </Text>
                  <Text
                    style={[styles.empStatLabel, { color: colors.textMuted }]}
                  >
                    {s.label}
                  </Text>
                </View>
              ))}
            </View>

            <View style={{ marginTop: 6 }}>
              <View style={styles.progressLabelRow}>
                <Text
                  style={[styles.progressLabel, { color: colors.textMuted }]}
                >
                  Completados
                </Text>
                <Text
                  style={[styles.progressLabel, { color: colors.textMuted }]}
                >
                  {Math.round(pctComp)}%
                </Text>
              </View>
              <ProgressBar
                pct={pctComp}
                color={ESTADO_COLORS.completados}
                colors={colors}
              />
              <View style={[styles.progressLabelRow, { marginTop: 6 }]}>
                <Text
                  style={[styles.progressLabel, { color: colors.textMuted }]}
                >
                  Facturados
                </Text>
                <Text
                  style={[styles.progressLabel, { color: colors.textMuted }]}
                >
                  {Math.round(pctFact)}%
                </Text>
              </View>
              <ProgressBar
                pct={pctFact}
                color={ESTADO_COLORS.facturados}
                colors={colors}
              />
            </View>
          </View>
        );
      })}
    </View>
  );

  // ── Main render ────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <SafeAreaView style={[styles.centered, { backgroundColor: colors.bg }]}>
        {renderHeader()}
        <ActivityIndicator
          size="large"
          color={colors.primary}
          style={{ marginTop: 60 }}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.bg }]}>
      {renderHeader()}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {error ? (
          <View
            style={[
              styles.errorBox,
              {
                backgroundColor: colors.dangerBg,
                borderColor: colors.danger,
              },
            ]}
          >
            <Ionicons
              name="alert-circle-outline"
              size={18}
              color={colors.danger}
            />
            <Text style={[styles.errorText, { color: colors.danger }]}>
              {error}
            </Text>
          </View>
        ) : null}

        {renderKpis()}
        {renderTabsBar()}

        <View style={styles.tabContent}>
          {tab === 'tickets'   && renderTicketsTab()}
          {tab === 'operarios' && renderOperariosTab()}
          {tab === 'empresas'  && renderEmpresasTab()}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  centered: {
    flex: 1,
  },
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  headerBtn: {
    padding: 4,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  // KPI grid
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    paddingTop: 14,
    gap: 8,
  },
  kpiCard: {
    width: '30.5%',
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
    alignItems: 'center',
    marginBottom: 4,
  },
  kpiIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  kpiValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  kpiLabel: {
    fontSize: 10,
    marginTop: 2,
    textAlign: 'center',
  },
  // Tabs bar
  tabsBar: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 16,
    borderBottomWidth: 1,
  },
  tabBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
  },
  tabBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  tabContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  // Generic card
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    marginBottom: 14,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 12,
  },
  // Donut
  donutRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  donutLegend: {
    flex: 1,
    paddingLeft: 12,
  },
  donutLegendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  donutDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 6,
  },
  donutLegendName: {
    fontSize: 12,
    flex: 1,
  },
  donutLegendValue: {
    fontSize: 13,
    fontWeight: '600',
  },
  donutLegendPct: {
    fontSize: 11,
    marginLeft: 2,
  },
  // Charts
  chartStyle: {
    borderRadius: 10,
    marginTop: 4,
  },
  emptyText: {
    textAlign: 'center',
    paddingVertical: 24,
    fontSize: 13,
  },
  // Line chart legend
  lineLegend: {
    flexDirection: 'row',
    marginBottom: 8,
    gap: 16,
  },
  lineLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  lineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  lineLegendText: {
    fontSize: 12,
  },
  // Operator cards
  opCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  opCardInfo: {
    flex: 1,
    marginLeft: 10,
  },
  opName: {
    fontSize: 14,
    fontWeight: '600',
  },
  opSub: {
    fontSize: 11,
    marginTop: 1,
  },
  opBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  opBadgeText: {
    fontSize: 14,
    fontWeight: '700',
  },
  opStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 10,
    gap: 6,
  },
  opStatItem: {
    width: '47%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  opStatDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    flexShrink: 0,
  },
  opStatLabel: {
    fontSize: 11,
    flex: 1,
  },
  opStatVal: {
    fontSize: 13,
    fontWeight: '600',
  },
  // Avatar
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  // Progress bar
  progressTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  progressLabel: {
    fontSize: 11,
  },
  // Stacked bar chart
  stackedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  stackedLabel: {
    width: 72,
    fontSize: 11,
  },
  stackedBarWrap: {
    flex: 1,
    height: 14,
    borderRadius: 7,
    overflow: 'hidden',
    flexDirection: 'row',
    backgroundColor: '#e5e7eb',
  },
  stackedSegment: {
    height: '100%',
  },
  stackedTotal: {
    width: 28,
    textAlign: 'right',
    fontSize: 12,
    fontWeight: '600',
  },
  stackedLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 10,
    gap: 10,
  },
  stackedLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  stackedLegendText: {
    fontSize: 11,
  },
  // Empresa cards
  empHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  empIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empName: {
    fontSize: 14,
    fontWeight: '600',
  },
  empSub: {
    fontSize: 11,
    marginTop: 1,
  },
  empTotalBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  empTotalText: {
    fontSize: 14,
    fontWeight: '700',
  },
  empStatsRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  empStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  empStatVal: {
    fontSize: 16,
    fontWeight: '700',
  },
  empStatLabel: {
    fontSize: 10,
    marginTop: 1,
  },
  // Error banner
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    margin: 16,
    marginBottom: 0,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  errorText: {
    fontSize: 13,
    flex: 1,
  },
});
