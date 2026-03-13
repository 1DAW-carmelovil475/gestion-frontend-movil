import { useEffect } from 'react'
import { View, ActivityIndicator } from 'react-native'
import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { Ionicons } from '@expo/vector-icons'

import { useAuth } from '../context/AuthContext'

import LoginScreen              from '../screens/LoginScreen'
import DashboardScreen          from '../screens/DashboardScreen'
import TicketsScreen            from '../screens/TicketsScreen'
import ChatScreen               from '../screens/ChatScreen'
import EstadisticasScreen       from '../screens/EstadisticasScreen'
import UsuariosScreen           from '../screens/UsuariosScreen'
import ClienteIncidenciasScreen from '../screens/ClienteIncidenciasScreen'

const Stack = createNativeStackNavigator()
const Tab   = createBottomTabNavigator()

const ICONS = {
  Dashboard:      ['grid',        'grid-outline'],
  Tickets:        ['ticket',      'ticket-outline'],
  Chat:           ['chatbubbles', 'chatbubbles-outline'],
  Estadísticas:   ['bar-chart',   'bar-chart-outline'],
  Usuarios:       ['people',      'people-outline'],
  'Mis Incidencias': ['ticket',   'ticket-outline'],
}

const TAB_OPTIONS = {
  tabBarStyle:            { backgroundColor: '#1e293b', borderTopColor: '#334155', height: 56 },
  tabBarActiveTintColor:  '#0047b3',
  tabBarInactiveTintColor:'#64748b',
  headerShown:            false,
  tabBarIcon: ({ focused, color, size, route }) => {
    const [active, inactive] = ICONS[route?.name] || ['ellipse', 'ellipse-outline']
    return <Ionicons name={focused ? active : inactive} size={size} color={color} />
  },
}

function AdminTabs() {
  const { user, isAdmin, isGestor } = useAuth()
  const rol = user?.rol

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        ...TAB_OPTIONS,
        tabBarIcon: ({ focused, color, size }) => {
          const [active, inactive] = ICONS[route.name] || ['ellipse', 'ellipse-outline']
          return <Ionicons name={focused ? active : inactive} size={size} color={color} />
        },
      })}
    >
      <Tab.Screen name="Dashboard"    component={DashboardScreen} />
      <Tab.Screen name="Tickets"      component={TicketsScreen} />
      <Tab.Screen name="Chat"         component={ChatScreen} />
      {(rol === 'admin' || rol === 'gestor') && (
        <Tab.Screen name="Estadísticas" component={EstadisticasScreen} />
      )}
      {rol === 'admin' && (
        <Tab.Screen name="Usuarios" component={UsuariosScreen} />
      )}
    </Tab.Navigator>
  )
}

function ClienteTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        ...TAB_OPTIONS,
        tabBarIcon: ({ focused, color, size }) => {
          const [active, inactive] = ICONS[route.name] || ['ellipse', 'ellipse-outline']
          return <Ionicons name={focused ? active : inactive} size={size} color={color} />
        },
      })}
    >
      <Tab.Screen name="Mis Incidencias" component={ClienteIncidenciasScreen} />
      <Tab.Screen name="Chat"            component={ChatScreen} />
    </Tab.Navigator>
  )
}

export default function AppNavigator() {
  const { user, loading, isCliente } = useAuth()

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f172a' }}>
        <ActivityIndicator size="large" color="#0047b3" />
      </View>
    )
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!user ? (
          <Stack.Screen name="Login" component={LoginScreen} />
        ) : isCliente() ? (
          <Stack.Screen name="ClienteHome" component={ClienteTabs} />
        ) : (
          <Stack.Screen name="AdminHome" component={AdminTabs} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  )
}
