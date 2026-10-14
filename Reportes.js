import React from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';

export default function Reportes({ onVolver }) {
  return (
    <SafeAreaView style={styles.pantalla}>
      <View style={styles.header}>
        <Text style={styles.titulo}>Reportes</Text>
        {onVolver ? (
          <Pressable onPress={onVolver} style={styles.boton}>
            <Text style={styles.botonTexto}>Volver</Text>
          </Pressable>
        ) : null}
      </View>
      <ScrollView contentContainerStyle={styles.contenido}>
        <Text style={styles.aviso}>
          Este archivo es temporal para completar la migración. La versión final de Reportes
          se restaurará y después se actualizará junto con utilidad provisional y flujo por método de pago.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: '#F6F4EF' },
  header: {
    padding: 18,
    backgroundColor: '#254A3E',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titulo: { color: '#fff', fontSize: 26, fontWeight: '800' },
  boton: { backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  botonTexto: { color: '#254A3E', fontWeight: '800' },
  contenido: { padding: 18 },
  aviso: { color: '#34413D', fontSize: 15, lineHeight: 22 },
});
