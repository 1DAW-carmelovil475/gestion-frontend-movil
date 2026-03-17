import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { AuthProvider } from './src/context/AuthContext'
import { ThemeProvider, useTheme } from './src/context/ThemeContext'
import { ChatNotificationsProvider } from './src/context/ChatNotificationsContext'
import AppNavigator from './src/navigation/AppNavigator'

function AppInner() {
  const { isDark } = useTheme()
  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} backgroundColor={isDark ? '#0f172a' : '#ffffff'} />
      <AppNavigator />
    </>
  )
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <ChatNotificationsProvider>
            <AppInner />
          </ChatNotificationsProvider>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  )
}
