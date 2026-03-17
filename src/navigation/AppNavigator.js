import { useEffect } from 'react'
import { View, Text, ActivityIndicator } from 'react-native'
import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { Ionicons } from '@expo/vector-icons'

import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { useChatNotifications } from '../context/ChatNotificationsContext'

import LoginScreen                    from '../screens/LoginScreen'
import EmpresasScreen                 from '../screens/EmpresasScreen'
import EmpresaDetalleScreen           from '../screens/EmpresaDetalleScreen'
import TicketsScreen                  from '../screens/TicketsScreen'
import TicketDetalleScreen            from '../screens/TicketDetalleScreen'
import ChatScreen                     from '../screens/ChatScreen'
import EstadisticasScreen             from '../screens/EstadisticasScreen'
import UsuariosScreen                 from '../screens/UsuariosScreen'
import ClienteIncidenciasScreen       from '../screens/ClienteIncidenciasScreen'
import ClienteIncidenciaDetalleScreen from '../screens/ClienteIncidenciaDetalleScreen'

const Stack = createNativeStackNavigator()
const Tab   = createBottomTabNavigator()

function EmpresasStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="EmpresasList"   component={EmpresasScreen} />
      <Stack.Screen name="EmpresaDetalle" component={EmpresaDetalleScreen} />
    </Stack.Navigator>
  )
}

function TicketsStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="TicketsList"   component={TicketsScreen} />
      <Stack.Screen name="TicketDetalle" component={TicketDetalleScreen} />
    </Stack.Navigator>
  )
}

function ClienteStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ClienteIncidenciasList"   component={ClienteIncidenciasScreen} />
      <Stack.Screen name="ClienteIncidenciaDetalle" component={ClienteIncidenciaDetalleScreen} />
    </Stack.Navigator>
  )
}

function AdminTabs() {
  const { user } = useAuth()
  const { colors, isDark } = useTheme()
  const { totalUnread } = useChatNotifications()
  const rol = user?.rol

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.tabBar,
          borderTopColor:  colors.tabBorder,
          height: 60,
          paddingBottom: 6,
          paddingTop: 4,
        },
        tabBarActiveTintColor:   colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '500' },
        tabBarIcon: ({ focused, color, size }) => {
          const icons = {
            Empresas:      ['business',   'business-outline'],
            Tickets:       ['headset',    'headset-outline'],
            Chat:          ['chatbubbles','chatbubbles-outline'],
            'Estadísticas':['bar-chart',  'bar-chart-outline'],
            Usuarios:      ['people',     'people-outline'],
          }
          const [active, inactive] = icons[route.name] || ['ellipse', 'ellipse-outline']
          const badgeCount = route.name === 'Chat' ? totalUnread : 0
          return (
            <View>
              <Ionicons name={focused ? active : inactive} size={size} color={color} />
              {badgeCount > 0 && (
                <View style={{
                  position: 'absolute', top: -4, right: -8,
                  backgroundColor: '#e53935', borderRadius: 9,
                  minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center',
                  paddingHorizontal: 3,
                }}>
                  <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>
                    {badgeCount > 9 ? '9+' : badgeCount}
                  </Text>
                </View>
              )}
            </View>
          )
        },
      })}
    >
      <Tab.Screen name="Empresas"     component={EmpresasStack} />
      {(rol === 'admin' || rol === 'gestor') && (
        <Tab.Screen name="Usuarios" component={UsuariosScreen} />
      )}
      <Tab.Screen name="Tickets"      component={TicketsStack} />
      {(rol === 'admin' || rol === 'gestor') && (
        <Tab.Screen name="Estadísticas" component={EstadisticasScreen} />
      )}
      <Tab.Screen name="Chat"         component={ChatScreen} />
    </Tab.Navigator>
  )
}

function ClienteTabs() {
  const { colors } = useTheme()
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.tabBar,
          borderTopColor:  colors.tabBorder,
          height: 60,
          paddingBottom: 6,
          paddingTop: 4,
        },
        tabBarActiveTintColor:   colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '500' },
        tabBarIcon: ({ focused, color, size }) => {
          const icons = {
            'Mis Incidencias': ['alert-circle', 'alert-circle-outline'],
            Chat:              ['chatbubbles',  'chatbubbles-outline'],
          }
          const [active, inactive] = icons[route.name] || ['ellipse', 'ellipse-outline']
          return <Ionicons name={focused ? active : inactive} size={size} color={color} />
        },
      })}
    >
      <Tab.Screen name="Mis Incidencias" component={ClienteStack} />
    </Tab.Navigator>
  )
}

export default function AppNavigator() {
  const { user, loading } = useAuth()
  const { colors, isDark } = useTheme()

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    )
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!user ? (
          <Stack.Screen name="Login" component={LoginScreen} />
        ) : user.rol === 'cliente' ? (
          <Stack.Screen name="ClienteHome" component={ClienteTabs} />
        ) : (
          <Stack.Screen name="AdminHome" component={AdminTabs} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  )
}
