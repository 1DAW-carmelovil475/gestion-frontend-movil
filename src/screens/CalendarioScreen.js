import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  RefreshControl, Modal, TextInput, Alert, Switch, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import {
  getCalendarioEventos, createCalendarioEvento,
  updateCalendarioEvento, deleteCalendarioEvento, getOperarios,
} from '../services/api';

const SCREEN_W = Dimensions.get('window').width;
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const DIAS_CORTOS = ['L','M','X','J','V','S','D'];
const COLORES = ['#0047b3','#16a34a','#d97706','#dc2626','#9333ea','#0891b2','#be185d','#065f46'];
const AVISO_OPCIONES = [
  { value: 0, label: 'En el momento' },
  { value: 15, label: '15 min antes' },
  { value: 60, label: '1 hora antes' },
  { value: 1440, label: '1 día antes' },
];

function getDaysInMonth(y, m) { return new Date(y, m + 1, 0).getDate(); }
function getFirstDay(y, m) { const d = new Date(y, m, 1).getDay(); return d === 0 ? 6 : d - 1; }
function pad2(n) { return n.toString().padStart(2, '0'); }
function toDateStr(d) { return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`; }
function toTimeStr(d) { return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`; }

export default function CalendarioScreen() {
  const { colors, isDark } = useTheme();
  const { user } = useAuth();
  const canAssign = user?.rol === 'admin' || user?.rol === 'gestor';

  const [eventos, setEventos] = useState([]);
  const [operarios, setOperarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const hoy = new Date();
  const [year, setYear] = useState(hoy.getFullYear());
  const [month, setMonth] = useState(hoy.getMonth());
  const [selectedDate, setSelectedDate] = useState(null);

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [editEvento, setEditEvento] = useState(null);
  const [showDetalle, setShowDetalle] = useState(null);

  const [form, setForm] = useState({
    titulo: '', descripcion: '', fecha: '', horaInicio: '09:00', horaFin: '10:00',
    todoElDia: false, color: '#0047b3', tipo: 'evento', asignado_a: '', avisos: [],
  });

  const cargar = useCallback(async () => {
    try {
      const data = await getCalendarioEventos();
      setEventos(data);
      if (canAssign) {
        const ops = await getOperarios();
        setOperarios(ops);
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
    setRefreshing(false);
  }, [canAssign]);

  useEffect(() => { cargar(); }, [cargar]);

  function onRefresh() { setRefreshing(true); cargar(); }

  function getEventosDia(date) {
    const ds = toDateStr(date);
    return eventos.filter(e => {
      const s = toDateStr(new Date(e.fecha_inicio));
      const en = toDateStr(new Date(e.fecha_fin));
      return ds >= s && ds <= en;
    });
  }

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  }
  function nextMonth() {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  }

  function abrirCrear(date) {
    const ds = toDateStr(date || new Date());
    setEditEvento(null);
    setForm({ titulo: '', descripcion: '', fecha: ds, horaInicio: '09:00', horaFin: '10:00',
      todoElDia: false, color: '#0047b3', tipo: 'evento', asignado_a: '', avisos: [] });
    setShowModal(true);
  }

  function abrirEditar(ev) {
    const inicio = new Date(ev.fecha_inicio);
    setEditEvento(ev);
    setForm({
      titulo: ev.titulo, descripcion: ev.descripcion || '',
      fecha: toDateStr(inicio), horaInicio: toTimeStr(inicio),
      horaFin: toTimeStr(new Date(ev.fecha_fin)),
      todoElDia: ev.todo_el_dia || false, color: ev.color || '#0047b3',
      tipo: ev.tipo || 'evento', asignado_a: ev.asignado_a || '',
      avisos: (ev.calendario_avisos || []).map(a => a.minutos_antes),
    });
    setShowDetalle(null);
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.titulo.trim()) { Alert.alert('Error', 'El título es obligatorio'); return; }
    try {
      const fi = form.todoElDia ? `${form.fecha}T00:00:00` : `${form.fecha}T${form.horaInicio}:00`;
      const ff = form.todoElDia ? `${form.fecha}T23:59:59` : `${form.fecha}T${form.horaFin}:00`;
      const payload = {
        titulo: form.titulo.trim(), descripcion: form.descripcion.trim() || null,
        fecha_inicio: fi, fecha_fin: ff, todo_el_dia: form.todoElDia,
        color: form.color, tipo: form.tipo, asignado_a: form.asignado_a || null,
        avisos: form.avisos,
      };
      if (editEvento) await updateCalendarioEvento(editEvento.id, payload);
      else await createCalendarioEvento(payload);
      setShowModal(false);
      cargar();
    } catch (e) { Alert.alert('Error', e.message); }
  }

  async function handleDelete(id) {
    Alert.alert('Eliminar', '¿Eliminar este evento?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: async () => {
        try { await deleteCalendarioEvento(id); setShowDetalle(null); cargar(); }
        catch (e) { Alert.alert('Error', e.message); }
      }},
    ]);
  }

  async function toggleCompletada(ev) {
    try {
      await updateCalendarioEvento(ev.id, { completada: !ev.completada });
      cargar();
      setShowDetalle(null);
    } catch (e) { Alert.alert('Error', e.message); }
  }

  function toggleAviso(min) {
    setForm(f => ({
      ...f, avisos: f.avisos.includes(min) ? f.avisos.filter(a => a !== min) : [...f.avisos, min],
    }));
  }

  // ── Render month calendar ─────────────────────────
  function renderMonth() {
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDay(year, month);
    const cellSize = (SCREEN_W - 32) / 7;
    const cells = [];

    for (let i = 0; i < firstDay; i++) {
      cells.push(<View key={`e-${i}`} style={[s.dayCell, { width: cellSize, height: cellSize }]} />);
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d);
      const isToday = d === hoy.getDate() && month === hoy.getMonth() && year === hoy.getFullYear();
      const isSelected = selectedDate && toDateStr(date) === toDateStr(selectedDate);
      const evs = getEventosDia(date);
      cells.push(
        <TouchableOpacity key={d} style={[s.dayCell, { width: cellSize, height: cellSize },
          isSelected && { backgroundColor: colors.primary + '20' }]}
          onPress={() => setSelectedDate(date)}
          onLongPress={() => abrirCrear(date)}>
          <Text style={[s.dayNum, { color: colors.text },
            isToday && s.todayNum, isToday && { backgroundColor: colors.primary, color: '#fff' }]}>{d}</Text>
          <View style={s.dotRow}>
            {evs.slice(0, 3).map((e, i) => (
              <View key={i} style={[s.dot, { backgroundColor: e.color || colors.primary }]} />
            ))}
          </View>
        </TouchableOpacity>
      );
    }
    return (
      <View style={s.monthGrid}>
        {DIAS_CORTOS.map(d => (
          <View key={d} style={[s.dayHeaderCell, { width: cellSize }]}>
            <Text style={[s.dayHeaderText, { color: colors.textMuted }]}>{d}</Text>
          </View>
        ))}
        {cells}
      </View>
    );
  }

  // ── Render selected day events ────────────────────
  function renderDayEvents() {
    if (!selectedDate) return null;
    const evs = getEventosDia(selectedDate);
    const dateLabel = selectedDate.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });

    return (
      <View style={[s.dayEventsContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={s.dayEventsHeader}>
          <Text style={[s.dayEventsTitle, { color: colors.text }]}>{dateLabel}</Text>
          <TouchableOpacity style={[s.addBtn, { backgroundColor: colors.primary }]} onPress={() => abrirCrear(selectedDate)}>
            <Ionicons name="add" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
        {evs.length === 0 ? (
          <Text style={[s.noEvents, { color: colors.textMuted }]}>Sin eventos este día</Text>
        ) : evs.map(e => (
          <TouchableOpacity key={e.id} style={[s.eventCard, { borderLeftColor: e.color || colors.primary }]}
            onPress={() => setShowDetalle(e)}>
            <View style={s.eventCardTop}>
              <Text style={[s.eventTitle, { color: colors.text }, e.completada && s.eventCompleted]}>{e.titulo}</Text>
              <Text style={[s.eventType, { color: e.tipo === 'tarea' ? '#d97706' : e.tipo === 'nota' ? '#9333ea' : colors.primary }]}>
                {e.tipo.charAt(0).toUpperCase() + e.tipo.slice(1)}
              </Text>
            </View>
            {!e.todo_el_dia && (
              <Text style={[s.eventTime, { color: colors.textMuted }]}>
                {toTimeStr(new Date(e.fecha_inicio))} – {toTimeStr(new Date(e.fecha_fin))}
              </Text>
            )}
            {e.todo_el_dia && <Text style={[s.eventTime, { color: colors.textMuted }]}>Todo el día</Text>}
            {e.asignado?.nombre && (
              <Text style={[s.eventAssigned, { color: colors.textMuted }]}>
                <Ionicons name="person-outline" size={12} /> {e.asignado.nombre}
              </Text>
            )}
          </TouchableOpacity>
        ))}
      </View>
    );
  }

  const TIPO_ICONS = { evento: 'calendar', tarea: 'checkbox', nota: 'document-text' };

  return (
    <SafeAreaView style={[s.container, { backgroundColor: colors.bg }]} edges={['top']}>
      {/* Header */}
      <View style={[s.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={prevMonth}><Ionicons name="chevron-back" size={24} color={colors.text} /></TouchableOpacity>
        <TouchableOpacity onPress={() => { setYear(hoy.getFullYear()); setMonth(hoy.getMonth()); setSelectedDate(hoy); }}>
          <Text style={[s.headerTitle, { color: colors.text }]}>{MESES[month]} {year}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={nextMonth}><Ionicons name="chevron-forward" size={24} color={colors.text} /></TouchableOpacity>
      </View>

      <ScrollView style={s.scroll} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}>
        {loading ? (
          <View style={s.loadingContainer}>
            <Text style={{ color: colors.textMuted }}>Cargando calendario...</Text>
          </View>
        ) : (
          <>
            {renderMonth()}
            {renderDayEvents()}
            <View style={{ height: 100 }} />
          </>
        )}
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity style={[s.fab, { backgroundColor: colors.primary }]}
        onPress={() => abrirCrear(selectedDate || new Date())}>
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      {/* ── Modal crear/editar ───────────────────────── */}
      <Modal visible={showModal} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={[s.modalContent, { backgroundColor: colors.card }]}>
            <View style={s.modalHeader}>
              <Text style={[s.modalTitle, { color: colors.text }]}>
                {editEvento ? 'Editar evento' : 'Nuevo evento'}
              </Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={s.modalBody}>
              <Text style={[s.label, { color: colors.text }]}>Título *</Text>
              <TextInput style={[s.input, { backgroundColor: colors.bg, color: colors.text, borderColor: colors.border }]}
                value={form.titulo} onChangeText={t => setForm(f => ({ ...f, titulo: t }))}
                placeholder="Nombre del evento" placeholderTextColor={colors.textMuted} />

              <Text style={[s.label, { color: colors.text }]}>Tipo</Text>
              <View style={s.tipoRow}>
                {['evento', 'tarea', 'nota'].map(t => (
                  <TouchableOpacity key={t} style={[s.tipoBtn,
                    form.tipo === t && { backgroundColor: colors.primary, borderColor: colors.primary },
                    { borderColor: colors.border }]}
                    onPress={() => setForm(f => ({ ...f, tipo: t }))}>
                    <Ionicons name={TIPO_ICONS[t]} size={16} color={form.tipo === t ? '#fff' : colors.text} />
                    <Text style={[s.tipoBtnText, form.tipo === t && { color: '#fff' }, { color: form.tipo === t ? '#fff' : colors.text }]}>
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={s.switchRow}>
                <Text style={[s.label, { color: colors.text, marginBottom: 0 }]}>Todo el día</Text>
                <Switch value={form.todoElDia} onValueChange={v => setForm(f => ({ ...f, todoElDia: v }))}
                  trackColor={{ true: colors.primary }} />
              </View>

              <Text style={[s.label, { color: colors.text }]}>Fecha</Text>
              <TextInput style={[s.input, { backgroundColor: colors.bg, color: colors.text, borderColor: colors.border }]}
                value={form.fecha} onChangeText={t => setForm(f => ({ ...f, fecha: t }))}
                placeholder="YYYY-MM-DD" placeholderTextColor={colors.textMuted} />

              {!form.todoElDia && (
                <View style={s.timeRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.label, { color: colors.text }]}>Hora inicio</Text>
                    <TextInput style={[s.input, { backgroundColor: colors.bg, color: colors.text, borderColor: colors.border }]}
                      value={form.horaInicio} onChangeText={t => setForm(f => ({ ...f, horaInicio: t }))}
                      placeholder="HH:MM" placeholderTextColor={colors.textMuted} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.label, { color: colors.text }]}>Hora fin</Text>
                    <TextInput style={[s.input, { backgroundColor: colors.bg, color: colors.text, borderColor: colors.border }]}
                      value={form.horaFin} onChangeText={t => setForm(f => ({ ...f, horaFin: t }))}
                      placeholder="HH:MM" placeholderTextColor={colors.textMuted} />
                  </View>
                </View>
              )}

              <Text style={[s.label, { color: colors.text }]}>Descripción</Text>
              <TextInput style={[s.input, s.textarea, { backgroundColor: colors.bg, color: colors.text, borderColor: colors.border }]}
                value={form.descripcion} onChangeText={t => setForm(f => ({ ...f, descripcion: t }))}
                placeholder="Detalles..." placeholderTextColor={colors.textMuted}
                multiline numberOfLines={3} />

              <Text style={[s.label, { color: colors.text }]}>Color</Text>
              <View style={s.colorRow}>
                {COLORES.map(c => (
                  <TouchableOpacity key={c} style={[s.colorBtn, { backgroundColor: c },
                    form.color === c && s.colorBtnSelected]}
                    onPress={() => setForm(f => ({ ...f, color: c }))} />
                ))}
              </View>

              {canAssign && (
                <>
                  <Text style={[s.label, { color: colors.text }]}>Asignar a</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.assignRow}>
                    <TouchableOpacity style={[s.assignChip,
                      !form.asignado_a && { backgroundColor: colors.primary, borderColor: colors.primary },
                      { borderColor: colors.border }]}
                      onPress={() => setForm(f => ({ ...f, asignado_a: '' }))}>
                      <Text style={[s.assignChipText, !form.asignado_a && { color: '#fff' }, { color: !form.asignado_a ? '#fff' : colors.text }]}>
                        Sin asignar
                      </Text>
                    </TouchableOpacity>
                    {operarios.map(o => (
                      <TouchableOpacity key={o.id} style={[s.assignChip,
                        form.asignado_a === o.id && { backgroundColor: colors.primary, borderColor: colors.primary },
                        { borderColor: colors.border }]}
                        onPress={() => setForm(f => ({ ...f, asignado_a: o.id }))}>
                        <Text style={[s.assignChipText,
                          form.asignado_a === o.id && { color: '#fff' },
                          { color: form.asignado_a === o.id ? '#fff' : colors.text }]}>
                          {o.nombre || o.email}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </>
              )}

              <Text style={[s.label, { color: colors.text }]}>Avisos</Text>
              <View style={s.avisosGrid}>
                {AVISO_OPCIONES.map(a => (
                  <TouchableOpacity key={a.value} style={[s.avisoChip,
                    form.avisos.includes(a.value) && { backgroundColor: colors.primary, borderColor: colors.primary },
                    { borderColor: colors.border }]}
                    onPress={() => toggleAviso(a.value)}>
                    <Ionicons name={form.avisos.includes(a.value) ? 'notifications' : 'notifications-outline'}
                      size={14} color={form.avisos.includes(a.value) ? '#fff' : colors.text} />
                    <Text style={[s.avisoText, form.avisos.includes(a.value) && { color: '#fff' },
                      { color: form.avisos.includes(a.value) ? '#fff' : colors.text }]}>
                      {a.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <View style={[s.modalFooter, { borderTopColor: colors.border }]}>
              <TouchableOpacity style={[s.btnCancel, { borderColor: colors.border }]} onPress={() => setShowModal(false)}>
                <Text style={{ color: colors.text }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.btnSave, { backgroundColor: colors.primary }]} onPress={handleSave}>
                <Ionicons name="checkmark" size={18} color="#fff" />
                <Text style={s.btnSaveText}>{editEvento ? 'Guardar' : 'Crear'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Modal detalle ────────────────────────────── */}
      <Modal visible={!!showDetalle} animationType="fade" transparent>
        <TouchableOpacity style={s.modalOverlay} activeOpacity={1} onPress={() => setShowDetalle(null)}>
          <View style={[s.detalleContent, { backgroundColor: colors.card }]} onStartShouldSetResponder={() => true}>
            {showDetalle && (
              <>
                <View style={[s.detalleHeader, { borderLeftColor: showDetalle.color || colors.primary }]}>
                  <Text style={[s.detalleTitle, { color: colors.text }]}>{showDetalle.titulo}</Text>
                  <TouchableOpacity onPress={() => setShowDetalle(null)}>
                    <Ionicons name="close" size={22} color={colors.text} />
                  </TouchableOpacity>
                </View>

                <View style={s.detalleBody}>
                  <View style={s.detalleBadges}>
                    <View style={[s.tipoBadge,
                      showDetalle.tipo === 'tarea' && { backgroundColor: '#fef3c7' },
                      showDetalle.tipo === 'nota' && { backgroundColor: '#ede9fe' },
                      showDetalle.tipo === 'evento' && { backgroundColor: '#dbeafe' }]}>
                      <Ionicons name={TIPO_ICONS[showDetalle.tipo]} size={14}
                        color={showDetalle.tipo === 'tarea' ? '#d97706' : showDetalle.tipo === 'nota' ? '#9333ea' : '#1d4ed8'} />
                      <Text style={{ color: showDetalle.tipo === 'tarea' ? '#d97706' : showDetalle.tipo === 'nota' ? '#9333ea' : '#1d4ed8',
                        fontSize: 12, fontWeight: '600' }}>
                        {showDetalle.tipo.charAt(0).toUpperCase() + showDetalle.tipo.slice(1)}
                      </Text>
                    </View>
                    {showDetalle.completada && (
                      <View style={[s.tipoBadge, { backgroundColor: '#d1fae5' }]}>
                        <Ionicons name="checkmark-circle" size={14} color="#059669" />
                        <Text style={{ color: '#059669', fontSize: 12, fontWeight: '600' }}>Completada</Text>
                      </View>
                    )}
                  </View>

                  <View style={s.detalleRow}>
                    <Ionicons name="time-outline" size={16} color={colors.textMuted} />
                    <Text style={[s.detalleText, { color: colors.text }]}>
                      {showDetalle.todo_el_dia ? 'Todo el día — ' : ''}
                      {new Date(showDetalle.fecha_inicio).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
                      {!showDetalle.todo_el_dia && ` ${toTimeStr(new Date(showDetalle.fecha_inicio))} – ${toTimeStr(new Date(showDetalle.fecha_fin))}`}
                    </Text>
                  </View>

                  {showDetalle.creador?.nombre && (
                    <View style={s.detalleRow}>
                      <Ionicons name="person-outline" size={16} color={colors.textMuted} />
                      <Text style={[s.detalleText, { color: colors.text }]}>Creado por: {showDetalle.creador.nombre}</Text>
                    </View>
                  )}
                  {showDetalle.asignado?.nombre && (
                    <View style={s.detalleRow}>
                      <Ionicons name="person-add-outline" size={16} color={colors.textMuted} />
                      <Text style={[s.detalleText, { color: colors.text }]}>Asignado a: {showDetalle.asignado.nombre}</Text>
                    </View>
                  )}

                  {showDetalle.descripcion ? (
                    <View style={[s.detalleDesc, { backgroundColor: colors.bg, borderColor: colors.border }]}>
                      <Text style={{ color: colors.text, fontSize: 14, lineHeight: 20 }}>{showDetalle.descripcion}</Text>
                    </View>
                  ) : null}
                </View>

                <View style={[s.detalleFooter, { borderTopColor: colors.border }]}>
                  {showDetalle.tipo === 'tarea' && (
                    <TouchableOpacity style={[s.detalleBtn, { backgroundColor: showDetalle.completada ? '#d97706' : '#16a34a' }]}
                      onPress={() => toggleCompletada(showDetalle)}>
                      <Ionicons name={showDetalle.completada ? 'arrow-undo' : 'checkmark'} size={16} color="#fff" />
                      <Text style={s.detalleBtnText}>{showDetalle.completada ? 'Desmarcar' : 'Completar'}</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity style={[s.detalleBtn, { backgroundColor: colors.primary }]}
                    onPress={() => abrirEditar(showDetalle)}>
                    <Ionicons name="create-outline" size={16} color="#fff" />
                    <Text style={s.detalleBtnText}>Editar</Text>
                  </TouchableOpacity>
                  {(showDetalle.creado_por === user.id || canAssign) && (
                    <TouchableOpacity style={[s.detalleBtn, { backgroundColor: '#dc2626' }]}
                      onPress={() => handleDelete(showDetalle.id)}>
                      <Ionicons name="trash-outline" size={16} color="#fff" />
                      <Text style={s.detalleBtnText}>Eliminar</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </>
            )}
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1 },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  scroll: { flex: 1 },
  loadingContainer: { paddingTop: 60, alignItems: 'center' },

  // Month grid
  monthGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, paddingTop: 8 },
  dayHeaderCell: { alignItems: 'center', paddingVertical: 8 },
  dayHeaderText: { fontSize: 12, fontWeight: '600' },
  dayCell: { alignItems: 'center', justifyContent: 'center', paddingVertical: 4 },
  dayNum: { fontSize: 14, fontWeight: '500', width: 28, height: 28, lineHeight: 28, textAlign: 'center', borderRadius: 14, overflow: 'hidden' },
  todayNum: { fontWeight: '700' },
  dotRow: { flexDirection: 'row', gap: 2, marginTop: 2, height: 6 },
  dot: { width: 5, height: 5, borderRadius: 3 },

  // Day events
  dayEventsContainer: { marginHorizontal: 16, marginTop: 16, borderRadius: 10, borderWidth: 1, padding: 14 },
  dayEventsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  dayEventsTitle: { fontSize: 15, fontWeight: '600', textTransform: 'capitalize' },
  addBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  noEvents: { textAlign: 'center', paddingVertical: 20, fontSize: 13 },
  eventCard: { borderLeftWidth: 3, paddingLeft: 10, paddingVertical: 8, marginBottom: 8 },
  eventCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  eventTitle: { fontSize: 14, fontWeight: '600', flex: 1 },
  eventCompleted: { textDecorationLine: 'line-through', opacity: 0.5 },
  eventType: { fontSize: 11, fontWeight: '600', marginLeft: 8 },
  eventTime: { fontSize: 12, marginTop: 2 },
  eventAssigned: { fontSize: 12, marginTop: 2 },

  // FAB
  fab: { position: 'absolute', bottom: 24, right: 24, width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', elevation: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 5 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingBottom: 8 },
  modalTitle: { fontSize: 18, fontWeight: '700' },
  modalBody: { paddingHorizontal: 16, paddingBottom: 16, maxHeight: 500 },
  modalFooter: { flexDirection: 'row', gap: 10, padding: 16, borderTopWidth: 1 },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 5, marginTop: 12 },
  input: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8, borderWidth: 1, fontSize: 14 },
  textarea: { minHeight: 70, textAlignVertical: 'top' },
  tipoRow: { flexDirection: 'row', gap: 8 },
  tipoBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 8, borderRadius: 8, borderWidth: 1 },
  tipoBtnText: { fontSize: 13, fontWeight: '500' },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  timeRow: { flexDirection: 'row', gap: 10 },
  colorRow: { flexDirection: 'row', gap: 8 },
  colorBtn: { width: 30, height: 30, borderRadius: 15, borderWidth: 3, borderColor: 'transparent' },
  colorBtnSelected: { borderColor: '#1e293b', transform: [{ scale: 1.15 }] },
  assignRow: { flexDirection: 'row', marginTop: 4 },
  assignChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1, marginRight: 8 },
  assignChipText: { fontSize: 13 },
  avisosGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  avisoChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  avisoText: { fontSize: 12 },
  btnCancel: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 8, borderWidth: 1 },
  btnSave: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 8 },
  btnSaveText: { color: '#fff', fontWeight: '600', fontSize: 14 },

  // Detalle
  detalleContent: { margin: 20, borderRadius: 12, maxHeight: '80%' },
  detalleHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderLeftWidth: 4 },
  detalleTitle: { fontSize: 17, fontWeight: '700', flex: 1, marginRight: 10 },
  detalleBody: { paddingHorizontal: 16, paddingBottom: 8 },
  detalleBadges: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  tipoBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  detalleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 5 },
  detalleText: { fontSize: 14, flex: 1 },
  detalleDesc: { marginTop: 12, padding: 12, borderRadius: 8, borderWidth: 1 },
  detalleFooter: { flexDirection: 'row', gap: 8, padding: 16, borderTopWidth: 1 },
  detalleBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 10, borderRadius: 8 },
  detalleBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
});
