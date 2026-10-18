import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { supabase } from './lib/supabase.js';

export default function AuthCasaShamy() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [cargando, setCargando] = useState(false);

  const entrar = async () => {
    const correo = String(email || '').trim().toLowerCase();

    if (!correo || !password) {
      Alert.alert('Faltan datos', 'Escribe tu correo y contraseña.');
      return;
    }

    setCargando(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: correo,
        password,
      });

      if (error) {
        Alert.alert('No se pudo iniciar sesión', error.message);
      }
    } catch (error) {
      Alert.alert(
        'No se pudo iniciar sesión',
        error?.message || 'Revisa tu conexión e inténtalo de nuevo.'
      );
    } finally {
      setCargando(false);
    }
  };

  return (
    <SafeAreaView style={styles.pantalla}>
      <KeyboardAvoidingView
        style={styles.centrado}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.tarjeta}>
          <Text style={styles.titulo}>Casa Shamy</Text>
          <Text style={styles.subtitulo}>Administración · San Quintín</Text>

          <Text style={styles.etiqueta}>Correo</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            placeholder="correo@ejemplo.com"
            placeholderTextColor="#98A09D"
            style={styles.input}
          />

          <Text style={styles.etiqueta}>Contraseña</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            autoCapitalize="none"
            secureTextEntry
            placeholder="Contraseña"
            placeholderTextColor="#98A09D"
            style={styles.input}
            onSubmitEditing={entrar}
          />

          <Pressable
            onPress={entrar}
            disabled={cargando}
            style={({ pressed }) => [
              styles.boton,
              cargando && styles.botonDeshabilitado,
              pressed && !cargando && styles.presionado,
            ]}
          >
            {cargando ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.botonTexto}>Entrar</Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: '#F6F3EC' },
  centrado: { flex: 1, justifyContent: 'center', padding: 22 },
  tarjeta: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 22,
    borderWidth: 1,
    borderColor: '#E1DED5',
  },
  titulo: { fontSize: 32, fontWeight: '900', color: '#244B40' },
  subtitulo: { marginTop: 5, marginBottom: 24, fontSize: 14, color: '#7B817E' },
  etiqueta: { marginTop: 12, marginBottom: 6, fontSize: 13, fontWeight: '800', color: '#34433E' },
  input: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: '#D8DCD9',
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 16,
    color: '#25332E',
    backgroundColor: '#FFFFFF',
  },
  boton: {
    minHeight: 50,
    marginTop: 22,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2E5A4F',
  },
  botonDeshabilitado: { opacity: 0.6 },
  botonTexto: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  presionado: { opacity: 0.75 },
});
