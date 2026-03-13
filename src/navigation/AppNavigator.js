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

// Tabs para admin/gestor/operario
function AdminTabs() {
  const { isAdmin, isGestor } = useAuth()
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          const icons = {
            Dashboard:   focused ? 'grid'          : 'grid-outline',
            Tickets:     focused ? 'ticket'        : 'ticket-outline',
            Chat:        focused ? 'chatbubbles'   : 'chatbubbles-outline',
            Estadísticas:focused ? 'bar-chart'     : 'bar-chart-outline',
            Usuarios:    focused ? 'people'        : 'people-outline',
          }
          return <Ionicons name={icons[route.name] || 'ellipse'} size={size} color={color} />
        },
        tabBarStyle:            { backgroundColor: '#1e293b', borderTopColor: '#334155' },
        tabBarActiveTintColor:  '#0066ff',
        tabBarInactiveTintColor:'#64748b',
        headerShown:            false,
      })}
    >
      <Tab.Screen name="Dashboard"    component={DashboardScreen} />
      <Tab.Screen name="Tickets"      component={TicketsScreen} />
      <Tab.Screen name="Chat"         component={ChatScreen} />
      {(isAdmin() || isGestor()) && (
        <Tab.Screen name="Estadísticas" component={EstadisticasScreen} />
      )}
      {isAdmin() && (
        <Tab.Screen name="Usuarios" component={UsuariosScreen} />
      )}
    </Tab.Navigator>
  )
}

// Tabs para clientes
function ClienteTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          const icons = {
            'Mis Incidencias': focused ? 'ticket'      : 'ticket-outline',
            Chat:              focused ? 'chatbubbles' : 'chatbubbles-outline',
          }
          return <Ionicons name={icons[route.name] || 'ellipse'} size={size} color={color} />
        },
        tabBarStyle:             { backgroundColor: '#1e293b', borderTopColor: '#334155' },
        tabBarActiveTintColor:   '#0066ff',
        tabBarInactiveTintColor: '#64748b',
        headerShown:             false,
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
        <ActivityIndicator size="large" color="#0066ff" />
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
