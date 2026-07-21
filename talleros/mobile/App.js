import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View, Text, TouchableOpacity } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import * as Updates from 'expo-updates';
import { loadSession } from './src/api';
import LoginScreen from './src/screens/Login';
import HomeScreen from './src/screens/Home';
import AdminHomeScreen from './src/screens/AdminHome';

const Stack = createNativeStackNavigator();

// Red de seguridad: si una pantalla falla al dibujar, muestra un aviso en vez de pantalla negra.
class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { console.log('Error de pantalla:', error, info); }
  render() {
    if (this.state.error) {
      return (
        <View style={{ flex: 1, backgroundColor: '#f3f4f6', justifyContent: 'center', alignItems: 'center', padding: 30 }}>
          <Text style={{ fontSize: 40, marginBottom: 10 }}>⚠️</Text>
          <Text style={{ fontSize: 17, fontWeight: '800', color: '#16191d', textAlign: 'center' }}>Ocurrió un problema al mostrar esta pantalla</Text>
          <Text style={{ fontSize: 13, color: '#6b7480', textAlign: 'center', marginTop: 8 }}>{String(this.state.error && this.state.error.message || this.state.error)}</Text>
          <TouchableOpacity onPress={() => this.setState({ error: null })} style={{ backgroundColor: '#F5B700', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 22, marginTop: 18 }}>
            <Text style={{ fontWeight: '800', color: '#16191d' }}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState(null);
  const [actualizando, setActualizando] = useState(false);

  // Busca actualizaciones "por el aire" (OTA) al abrir la app.
  useEffect(() => {
    (async () => {
      try {
        if (!Updates.isEnabled) return; // en Expo Go / desarrollo no aplica
        const r = await Updates.checkForUpdateAsync();
        if (r.isAvailable) {
          setActualizando(true);
          await Updates.fetchUpdateAsync();
          await Updates.reloadAsync(); // reinicia con la versión nueva
        }
      } catch (e) { /* si falla, la app sigue con la versión instalada */ }
    })();
  }, []);

  useEffect(() => {
    loadSession().then((s) => { setSession(s); setReady(true); });
  }, []);

  if (actualizando) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#16191d' }}>
        <ActivityIndicator color="#F5B700" size="large" />
        <Text style={{ color: '#fff', marginTop: 14, fontWeight: '700' }}>Actualizando la aplicación…</Text>
        <Text style={{ color: '#9aa3ad', marginTop: 4, fontSize: 12 }}>Un momento, por favor</Text>
      </View>
    );
  }

  if (!ready) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', backgroundColor: '#16191d' }}>
        <ActivityIndicator color="#F5B700" size="large" />
      </View>
    );
  }

  const loggedIn = session && session.token;
  const esAdmin = loggedIn && session.me && (session.me.rol === 'administrador' || session.me.rol === 'superadmin');
  const initial = !loggedIn ? 'Login' : esAdmin ? 'AdminHome' : 'Home';

  return (
    <ErrorBoundary>
    <NavigationContainer>
      <StatusBar style="light" />
      <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName={initial}>
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Home" component={HomeScreen} initialParams={{ me: session && session.me, talleres: (session && session.talleres) || [] }} />
        <Stack.Screen name="AdminHome" component={AdminHomeScreen} initialParams={{ me: session && session.me, talleres: (session && session.talleres) || [] }} />
      </Stack.Navigator>
    </NavigationContainer>
    </ErrorBoundary>
  );
}
