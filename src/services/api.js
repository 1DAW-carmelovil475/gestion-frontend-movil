import * as SecureStore from 'expo-secure-store'
import { API_BASE_URL } from '../config'

export const API_URL = API_BASE_URL
// ────────────────────────────────────────────────────────────────────────────

async function tryRefreshTokenInternal() {
  const refreshToken = await SecureStore.getItemAsync('hola_refresh')
  if (!refreshToken) return null
  try {
    const res = await fetch(`${API_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    })
    if (!res.ok) return null
    const data = await res.json()
    if (!data.access_token) return null
    await SecureStore.setItemAsync('hola_token', data.access_token)
    if (data.refresh_token)
      await SecureStore.setItemAsync('hola_refresh', data.refresh_token)
    return data.access_token
  } catch {
    return null
  }
}

export async function apiFetch(path, options = {}, _isRetry = false) {
  const token = await SecureStore.getItemAsync('hola_token')
  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
    ...options,
  }
  if (options.body instanceof FormData) delete config.headers['Content-Type']

  const url = path.startsWith('http') ? path : `${API_URL}${path}`
  let res
  try {
    res = await fetch(url, config)
  } catch {
    throw new Error(`Error de conexión con el servidor (${API_URL})`)
  }

  if (res.status === 401 && !_isRetry) {
    const newToken = await tryRefreshTokenInternal()
    if (newToken) return apiFetch(path, options, true)
    if (token) {
      await SecureStore.deleteItemAsync('hola_token')
      await SecureStore.deleteItemAsync('hola_refresh')
    }
    throw new Error('Sesión expirada.')
  }

  const contentType = res.headers.get('content-type') || ''
  if (!contentType.includes('application/json')) {
    const text = await res.text()
    throw new Error(`Respuesta inesperada (${res.status})`)
  }

  const data = await res.json()
  if (!res.ok) throw new Error(data.error || data.message || `Error ${res.status}`)
  return data
}

// ── Empresas ──────────────────────────────────────────────────────────────
export const getEmpresas           = ()         => apiFetch('/api/empresas')
export const getEmpresa            = (id)       => apiFetch(`/api/empresas/${id}`)
export const createEmpresa         = (d)        => apiFetch('/api/empresas', { method: 'POST', body: JSON.stringify(d) })
export const updateEmpresa         = (id, d)    => apiFetch(`/api/empresas/${id}`, { method: 'PUT', body: JSON.stringify(d) })
export const deleteEmpresa         = (id)       => apiFetch(`/api/empresas/${id}`, { method: 'DELETE' })

// ── Dispositivos ──────────────────────────────────────────────────────────
export async function getDispositivos(empresaId, categoria) {
  const p = new URLSearchParams()
  if (empresaId) p.set('empresa_id', empresaId)
  if (categoria) p.set('categoria', categoria)
  return apiFetch(`/api/dispositivos?${p}`)
}
export const createDispositivo     = (d)        => apiFetch('/api/dispositivos', { method: 'POST', body: JSON.stringify(d) })
export const updateDispositivo     = (id, d)    => apiFetch(`/api/dispositivos/${id}`, { method: 'PUT', body: JSON.stringify(d) })
export const deleteDispositivo     = (id)       => apiFetch(`/api/dispositivos/${id}`, { method: 'DELETE' })

// ── Tickets ───────────────────────────────────────────────────────────────
export const getTickets            = (p = {})   => apiFetch(`/api/v2/tickets?${new URLSearchParams(p)}`)
export const getTicket             = (id)       => apiFetch(`/api/v2/tickets/${id}`)
export const createTicket          = (d)        => apiFetch('/api/v2/tickets', { method: 'POST', body: JSON.stringify(d) })
export const updateTicket          = (id, d)    => apiFetch(`/api/v2/tickets/${id}`, { method: 'PUT', body: JSON.stringify(d) })
export const deleteTicket          = (id)       => apiFetch(`/api/v2/tickets/${id}`, { method: 'DELETE' })
export const updateTicketNotas     = (id, n)    => apiFetch(`/api/v2/tickets/${id}/notas`, { method: 'PUT', body: JSON.stringify({ notas: n }) })

export const getTicketComentarios  = (tid)      => apiFetch(`/api/v2/tickets/${tid}/comentarios`)
export const deleteTicketComentario= (id)       => apiFetch(`/api/v2/comentarios/${id}`, { method: 'DELETE' })

export async function createTicketComentario(ticketId, contenido) {
  const token = await SecureStore.getItemAsync('hola_token')
  const res = await fetch(`${API_URL}/api/v2/tickets/${ticketId}/comentarios`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ contenido }),
  })
  if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Error al crear comentario') }
  return res.json()
}

// ── Asignaciones ──────────────────────────────────────────────────────────
export const assignOperarios       = (tid, op)  => apiFetch(`/api/v2/tickets/${tid}/asignaciones`, { method: 'POST', body: JSON.stringify({ operarios: op }) })
export const removeOperario        = (tid, uid) => apiFetch(`/api/v2/tickets/${tid}/asignaciones/${uid}`, { method: 'DELETE' })

// ── Archivos ──────────────────────────────────────────────────────────────
export const getArchivoUrl         = (id)       => apiFetch(`/api/v2/archivos/${id}/url`)
export const deleteArchivo         = (id)       => apiFetch(`/api/v2/archivos/${id}`, { method: 'DELETE' })
export const addTicketHoras        = (tid, d)   => apiFetch(`/api/v2/tickets/${tid}/horas`, { method: 'POST', body: JSON.stringify(d) })

export async function uploadTicketArchivos(ticketId, files) {
  const token = await SecureStore.getItemAsync('hola_token')
  const formData = new FormData()
  formData.append('file_names', JSON.stringify(files.map(f => f.name)))
  files.forEach(f => formData.append('files', { uri: f.uri, name: f.name, type: f.mimeType || 'application/octet-stream' }))
  const res = await fetch(`${API_URL}/api/v2/tickets/${ticketId}/archivos`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  })
  if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Error al subir archivos') }
  return res.json()
}

// ── Operarios / Usuarios ──────────────────────────────────────────────────
export const getOperarios          = ()         => apiFetch('/api/v2/operarios')
export const getUsuarios           = ()         => apiFetch('/api/usuarios')
export const createUsuario         = (d)        => apiFetch('/api/usuarios', { method: 'POST', body: JSON.stringify(d) })
export const updateUsuario         = (id, d)    => apiFetch(`/api/usuarios/${id}`, { method: 'PUT', body: JSON.stringify(d) })
export const deleteUsuario         = (id)       => apiFetch(`/api/usuarios/${id}`, { method: 'DELETE' })

// ── Incidencias (Cliente) ─────────────────────────────────────────────────
export const getIncidenciasCliente = ()         => apiFetch('/api/v2/tickets')
export const createIncidencia      = (d)        => apiFetch('/api/v2/tickets/incidencia', { method: 'POST', body: JSON.stringify(d) })

export async function createIncidenciaConArchivos(asunto, descripcion, archivos = [], sistemaCat = null, sistemaNombre = null) {
  const form = new FormData()
  form.append('asunto', asunto)
  if (descripcion) form.append('descripcion', descripcion)
  if (sistemaCat)    form.append('sistema_categoria', sistemaCat)
  if (sistemaNombre) form.append('sistema_nombre',    sistemaNombre)
  for (const file of archivos) {
    form.append('archivos', { uri: file.uri, name: file.name, type: file.mimeType || 'application/octet-stream' })
  }
  return apiFetch('/api/v2/tickets/incidencia', { method: 'POST', body: form })
}

// ── Estadísticas ──────────────────────────────────────────────────────────
export const getEstadisticasResumen   = ()      => apiFetch('/api/v2/estadisticas/resumen')
export const getEstadisticasOperarios = (p={})  => apiFetch(`/api/v2/estadisticas/operarios?${new URLSearchParams(p)}`)
export const getEstadisticasEmpresas  = (p={})  => apiFetch(`/api/v2/estadisticas/empresas?${new URLSearchParams(p)}`)

// ── Chat ──────────────────────────────────────────────────────────────────
export const getChatCanales        = ()         => apiFetch('/api/v2/chat/canales')
export const createChatCanal       = (d)        => apiFetch('/api/v2/chat/canales', { method: 'POST', body: JSON.stringify(d) })
export const updateChatCanal       = (id, d)    => apiFetch(`/api/v2/chat/canales/${id}`, { method: 'PUT', body: JSON.stringify(d) })
export const deleteChatCanal       = (id)       => apiFetch(`/api/v2/chat/canales/${id}`, { method: 'DELETE' })
export const getChatMensajes       = (cid, l=100) => apiFetch(`/api/v2/chat/canales/${cid}/mensajes?limit=${l}`)
export const deleteChatMensaje     = (id)       => apiFetch(`/api/v2/chat/mensajes/${id}`, { method: 'DELETE' })
export const editChatMensaje       = (id, c)    => apiFetch(`/api/v2/chat/mensajes/${id}`, { method: 'PATCH', body: JSON.stringify({ contenido: c }) })
export const pinChatMensaje        = (id, a)    => apiFetch(`/api/v2/chat/mensajes/${id}/pin`, { method: 'PATCH', body: JSON.stringify({ anclado: a }) })
export const addChatMiembros       = (cid, m)   => apiFetch(`/api/v2/chat/canales/${cid}/miembros`, { method: 'POST', body: JSON.stringify({ miembros: m }) })
export const getChatArchivoUrl     = (id)       => apiFetch(`/api/v2/chat/archivos/${id}/url`)

export async function sendChatMensaje(canalId, contenido, ticketRefId = null, files = []) {
  const token = await SecureStore.getItemAsync('hola_token')
  if (files && files.length > 0) {
    const formData = new FormData()
    formData.append('contenido', contenido || '')
    if (ticketRefId) formData.append('ticket_ref_id', String(ticketRefId))
    formData.append('file_names', JSON.stringify(files.map(f => f.name)))
    files.forEach(f => formData.append('files', { uri: f.uri, name: f.name, type: f.mimeType || 'application/octet-stream' }))
    const res = await fetch(`${API_URL}/api/v2/chat/canales/${canalId}/mensajes`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    })
    if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Error al enviar') }
    return res.json()
  } else {
    const body = { contenido: contenido || '' }
    if (ticketRefId) body.ticket_ref_id = ticketRefId
    const res = await fetch(`${API_URL}/api/v2/chat/canales/${canalId}/mensajes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    })
    if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Error al enviar') }
    return res.json()
  }
}
