import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Image,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '../context/AuthContext'

export default function LoginScreen() {
  const [email, setEmail]             = useState('')
  const [password, setPassword]       = useState('')
  const [error, setError]             = useState('')
  const [loading, setLoading]         = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const { login } = useAuth()

  async function handleSubmit() {
    if (!email.trim() || !password) {
      setError('Introduce email y contraseña.')
      return
    }
    setError('')
    setLoading(true)
    try {
      await login(email.trim(), password)
    } catch (err) {
      setError(err.message)
      setPassword('')
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          {/* Logo */}
          <View style={styles.logoSection}>
            <View style={styles.logoBox}>
              <Text style={styles.logoText}>HI</Text>
            </View>
            <Text style={styles.title}>Hola Informática</Text>
            <Text style={styles.subtitle}>Panel de Gestión · Acceso</Text>
          </View>

          {/* Error */}
          {!!error && (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={16} color="#dc2626" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Email */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>
              <Ionicons name="mail-outline" size={14} color="#6b7280" /> Email
            </Text>
            <TextInput
              style={styles.input}
              placeholder="tu@email.com"
              placeholderTextColor="#9ca3af"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />
          </View>

          {/* Password */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>
              <Ionicons name="lock-closed-outline" size={14} color="#6b7280" /> Contraseña
            </Text>
            <View style={styles.inputWrap}>
              <TextInput
                style={[styles.input, styles.inputPwd]}
                placeholder="••••••••"
                placeholderTextColor="#9ca3af"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoComplete="password"
              />
              <TouchableOpacity
                style={styles.eyeBtn}
                onPress={() => setShowPassword(v => !v)}
              >
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color="#6b7280"
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Botón */}
          <TouchableOpacity
            style={[styles.btn, loading && styles.btnDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnText}>Entrar</Text>
            )}
          </TouchableOpacity>

          <Text style={styles.footer}>Hola Informática © 2026</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: '#0f172a' },
  scroll:      { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  card:        { width: '100%', maxWidth: 400, backgroundColor: '#1e293b', borderRadius: 16, padding: 28 },
  logoSection: { alignItems: 'center', marginBottom: 24 },
  logoBox:     { width: 64, height: 64, borderRadius: 32, backgroundColor: '#0066ff', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  logoText:    { color: '#fff', fontWeight: 'bold', fontSize: 22 },
  title:       { color: '#fff', fontSize: 22, fontWeight: 'bold' },
  subtitle:    { color: '#94a3b8', fontSize: 13, marginTop: 4 },
  errorBox:    { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fef2f2', borderRadius: 8, padding: 10, marginBottom: 16, gap: 8 },
  errorText:   { color: '#dc2626', fontSize: 13, flex: 1 },
  fieldGroup:  { marginBottom: 16 },
  label:       { color: '#94a3b8', fontSize: 13, marginBottom: 6 },
  input:       { backgroundColor: '#0f172a', color: '#fff', borderRadius: 8, borderWidth: 1, borderColor: '#334155', paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  inputWrap:   { position: 'relative' },
  inputPwd:    { paddingRight: 48 },
  eyeBtn:      { position: 'absolute', right: 14, top: 12 },
  btn:         { backgroundColor: '#0066ff', borderRadius: 8, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  btnDisabled: { opacity: 0.6 },
  btnText:     { color: '#fff', fontWeight: '600', fontSize: 16 },
  footer:      { color: '#475569', fontSize: 12, textAlign: 'center', marginTop: 20 },
})
