import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '../context/AuthContext'

export default function LoginScreen() {
  const [email, setEmail]               = useState('')
  const [password, setPassword]         = useState('')
  const [error, setError]               = useState('')
  const [loading, setLoading]           = useState(false)
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
      setError(err.message || 'Email o contraseña incorrectos.')
      setPassword('')
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            {/* Logo */}
            <View style={styles.logoSection}>
              <View style={styles.logoBox}>
                <Text style={styles.logoHola}>Hola</Text>
                <Text style={styles.logoIT}>.IT</Text>
              </View>
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
                <Ionicons name="mail-outline" size={13} color="#374151" /> Email
              </Text>
              <TextInput
                style={styles.input}
                placeholder="tu@email.com"
                placeholderTextColor="#9ca3af"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!loading}
              />
            </View>

            {/* Password */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>
                <Ionicons name="lock-closed-outline" size={13} color="#374151" /> Contraseña
              </Text>
              <View style={styles.inputWrap}>
                <TextInput
                  style={[styles.input, styles.inputPwd]}
                  placeholder="••••••••••"
                  placeholderTextColor="#9ca3af"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  editable={!loading}
                />
                <TouchableOpacity
                  style={styles.eyeBtn}
                  onPress={() => setShowPassword(v => !v)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color="#64748b"
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Submit button */}
            <TouchableOpacity
              style={[styles.btn, loading && styles.btnDisabled]}
              onPress={handleSubmit}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <View style={styles.btnInner}>
                  <Text style={styles.btnText}>Entrar</Text>
                  <Ionicons name="arrow-forward" size={18} color="#ffffff" style={{ marginLeft: 8 }} />
                </View>
              )}
            </TouchableOpacity>

            <Text style={styles.footer}>Hola Informática © 2026</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: '#0047b3' },
  container: { flex: 1 },
  scroll:    { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: '#0047b3' },
  card: {
    width: '100%', maxWidth: 420,
    backgroundColor: '#ffffff',
    borderRadius: 16, padding: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25, shadowRadius: 20,
    elevation: 12,
  },
  logoSection: { alignItems: 'center', marginBottom: 28 },
  logoBox: {
    flexDirection: 'row', alignItems: 'flex-end',
    marginBottom: 10,
  },
  logoHola: {
    fontSize: 38, fontWeight: '800', color: '#0047b3', letterSpacing: -1,
  },
  logoIT: {
    fontSize: 20, fontWeight: '700', color: '#0047b3', marginBottom: 4, opacity: 0.65,
  },
  subtitle:    { color: '#64748b', fontSize: 13, fontWeight: '500', letterSpacing: 0.2 },
  errorBox:    { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fee2e2', borderWidth: 1, borderColor: '#fca5a5', borderRadius: 8, padding: 10, marginBottom: 16, gap: 8 },
  errorText:   { color: '#dc2626', fontSize: 13, flex: 1, fontWeight: '500' },
  fieldGroup:  { marginBottom: 16 },
  label:       { color: '#374151', fontSize: 13, marginBottom: 6, fontWeight: '600' },
  input: {
    backgroundColor: '#f9fafb', borderWidth: 1.5, borderColor: '#e2e8f0', borderRadius: 8,
    paddingHorizontal: 14, paddingVertical: Platform.OS === 'ios' ? 14 : 10,
    fontSize: 15, color: '#1e2a45',
  },
  inputWrap:   { position: 'relative' },
  inputPwd:    { paddingRight: 48 },
  eyeBtn:      { position: 'absolute', right: 14, top: 0, bottom: 0, justifyContent: 'center' },
  btn: {
    backgroundColor: '#0047b3', borderRadius: 8, paddingVertical: 14,
    alignItems: 'center', justifyContent: 'center', marginTop: 8, marginBottom: 20,
    shadowColor: '#0047b3', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  btnDisabled: { opacity: 0.65 },
  btnInner:    { flexDirection: 'row', alignItems: 'center' },
  btnText:     { color: '#fff', fontWeight: '700', fontSize: 16, letterSpacing: 0.3 },
  footer:      { color: '#94a3b8', fontSize: 12, textAlign: 'center' },
})
