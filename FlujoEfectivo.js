import React, { useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useNegocio } from './DatosNegocio.js';

const CUENTAS = ['Efectivo', 'Banco', 'Tarjeta'];

const C = {
  fondo: '#F8F4EC',
  tarjeta: '#FFFFFF',
  verde: '#274E3A',
  verde2: '#3E6B53',
  crema: '#EFE6D7',
  terracota: '#B86F52',
  texto: '#28231F',
  secundario: '#786F67',
  linea: '#E2D8CC',
  peligro: '#9F3E35',
  entrada: '#3E7651',
};

const numero = (valor) => {
  const n = Number(String(valor ?? '').replace(/,/g, '').replace('$', '').trim());
  return Number.isFinite(n) ? n : 0;
};

const dinero = (valor) =>
  `$${numero(valor).toLocaleString('es-MX', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

function Boton({ titulo, onPress, tipo = 'principal', compacto = false, disabled = false }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.boton,
        tipo === 'secundario' && styles.botonSecundario,
        tipo === 'suave' && styles.botonSuave,
        tipo === 'peligro' && styles.botonPeligro,
        compacto && styles.botonCompacto,
        disabled && styles.botonDisabled,
        pressed && !disabled && { opacity: 0.75 },
      ]}
    >
      <Text
        style={[
          styles.botonTexto,
          (tipo === 'secundario' || tipo === 'suave') && styles.botonTextoOscuro,
          tipo === 'peligro' && styles.botonTextoPeligro,
        ]}
      >
        {titulo}
      </Text>
    </Pressable>
  );
}

function Chip({ label, activo, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        activo && styles.chipActivo,
        pressed && { opacity: 0.75 },
      ]}
    >
      <Text style={[styles.chipTexto, activo && styles.chipTextoActivo]}>{label}</Text>
    </Pressable>
  );
}

function Campo({ etiqueta, value, onChangeText, placeholder = '', keyboardType = 'default' }) {
  return (
    <View style={styles.campoGrupo}>
      <Text style={styles.etiqueta}>{etiqueta}</Text>
      <TextInput
        value={String(value ?? '')}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#A39A92"
        keyboardType={keyboardType}
        style={styles.input}
      />
    </View>
  );
}

function ModalBase({ visible, titulo, onCerrar, children }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCerrar}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalFondo}
      >
        <View style={styles.modalCaja}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitulo}>{titulo}</Text>
            <Pressable onPress={onCerrar} style={styles.cerrar}>
              <Text style={styles.cerrarTexto}>×</Text>
            </Pressable>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.modalContenido}>
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default function FlujoEfectivo(props = {}) {
  const volver = props.onVolver || props.volver || props.onBack || null;
  const {
    movimientosFlujo,
    obtenerResumenFlujo,
    establecerSaldoInicialFlujo,
    registrarTransferenciaInterna,
    cancelarTransferenciaInterna,
    normalizarCuentaFlujo,
  } = useNegocio();

  const [filtro, setFiltro] = useState('Todos');
  const [modalSaldo, setModalSaldo] = useState(false);
  const [cuentaSaldo, setCuentaSaldo] = useState('Efectivo');
  const [montoSaldo, setMontoSaldo] = useState('');

  const [modalTransferencia, setModalTransferencia] = useState(false);
  const [desde, setDesde] = useState('Efectivo');
  const [hacia, setHacia] = useState('Banco');
  const [montoTransferencia, setMontoTransferencia] = useState('');
  const [notaTransferencia, setNotaTransferencia] = useState('');

  const resumen = obtenerResumenFlujo();

  const movimientosVisibles = useMemo(() => {
    return (movimientosFlujo || []).filter((mov) => {
      if (filtro === 'Todos') return true;
      const cuenta = normalizarCuentaFlujo(mov.cuentaFlujo || mov.metodoPago);
      return cuenta === filtro;
    });
  }, [movimientosFlujo, filtro, normalizarCuentaFlujo]);

  const abrirSaldoInicial = (cuenta) => {
    setCuentaSaldo(cuenta);
    setMontoSaldo(String(resumen.cuentas?.[cuenta]?.saldoInicial ?? 0));
    setModalSaldo(true);
  };

  const guardarSaldoInicial = () => {
    const resultado = establecerSaldoInicialFlujo({ cuenta: cuentaSaldo, monto: montoSaldo });
    if (!resultado?.ok) {
      Alert.alert('No se pudo guardar', resultado?.mensaje || 'Revisa el saldo.');
      return;
    }
    setModalSaldo(false);
  };

  const abrirTransferencia = () => {
    setDesde('Efectivo');
    setHacia('Banco');
    setMontoTransferencia('');
    setNotaTransferencia('');
    setModalTransferencia(true);
  };

  const guardarTransferencia = () => {
    const resultado = registrarTransferenciaInterna({
      desde,
      hacia,
      monto: montoTransferencia,
      nota: notaTransferencia,
    });

    if (!resultado?.ok) {
      Alert.alert('No se pudo transferir', resultado?.mensaje || 'Revisa los datos.');
      return;
    }

    setModalTransferencia(false);
  };

  const confirmarCancelarTransferencia = (transferenciaId) => {
    Alert.alert(
      'Cancelar transferencia',
      'Se eliminarán la salida y la entrada de este traspaso. El total del negocio no cambia.',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Sí, cancelar',
          style: 'destructive',
          onPress: () => {
            const r = cancelarTransferenciaInterna(transferenciaId);
            if (!r?.ok) Alert.alert('No se pudo cancelar', r?.mensaje || '');
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.pantalla}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.titulo}>Flujo de efectivo</Text>
          <Text style={styles.subtitulo}>Efectivo, banco y tarjeta por separado</Text>
        </View>
        {volver ? <Boton titulo="Volver" tipo="secundario" compacto onPress={volver} /> : null}
      </View>

      <ScrollView contentContainerStyle={styles.contenido}>
        <View style={styles.totalCard}>
          <Text style={styles.totalEtiqueta}>Total disponible</Text>
          <Text style={styles.totalValor}>{dinero(resumen.total)}</Text>
          <Text style={styles.totalAyuda}>Los traspasos entre tus cuentas no cambian este total.</Text>
        </View>

        <View style={styles.grid}>
          {CUENTAS.map((cuenta) => {
            const datos = resumen.cuentas?.[cuenta] || { saldo: 0, saldoInicial: 0 };
            return (
              <View key={cuenta} style={styles.cuentaCard}>
                <Text style={styles.cuentaNombre}>{cuenta}</Text>
                <Text style={styles.cuentaSaldo}>{dinero(datos.saldo)}</Text>
                <Text style={styles.cuentaInicial}>Inicial: {dinero(datos.saldoInicial)}</Text>
                <Pressable onPress={() => abrirSaldoInicial(cuenta)} style={styles.linkBtn}>
                  <Text style={styles.linkTexto}>Editar saldo inicial</Text>
                </Pressable>
              </View>
            );
          })}
        </View>

        <View style={styles.acciones}>
          <Boton titulo="Transferir entre cuentas" onPress={abrirTransferencia} />
        </View>

        <Text style={styles.seccionTitulo}>Movimientos</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtros}>
          {['Todos', ...CUENTAS].map((item) => (
            <Chip key={item} label={item} activo={filtro === item} onPress={() => setFiltro(item)} />
          ))}
        </ScrollView>

        {movimientosVisibles.length === 0 ? (
          <View style={styles.vacio}>
            <Text style={styles.vacioTitulo}>No hay movimientos</Text>
            <Text style={styles.vacioTexto}>Las ventas, gastos, inversiones y transferencias aparecerán aquí.</Text>
          </View>
        ) : (
          movimientosVisibles.slice(0, 120).map((mov) => {
            const cuenta = normalizarCuentaFlujo(mov.cuentaFlujo || mov.metodoPago) || 'Sin cuenta';
            const esEntrada = mov.tipo === 'Entrada';
            const esTransferencia = mov.categoria === 'Transferencia interna' && mov.transferenciaId;
            return (
              <View key={mov.id} style={styles.movCard}>
                <View style={{ flex: 1 }}>
                  <View style={styles.movTop}>
                    <Text style={styles.movConcepto}>{mov.concepto}</Text>
                    <Text style={[styles.movMonto, esEntrada ? styles.montoEntrada : styles.montoSalida]}>
                      {esEntrada ? '+' : '-'}{dinero(mov.monto)}
                    </Text>
                  </View>
                  <Text style={styles.movMeta}>
                    {cuenta} · {mov.categoria || 'General'} · {mov.fecha || ''} {mov.hora || ''}
                  </Text>
                  {esTransferencia && mov.tipo === 'Salida' ? (
                    <Pressable onPress={() => confirmarCancelarTransferencia(mov.transferenciaId)} style={styles.cancelarLink}>
                      <Text style={styles.cancelarTexto}>Cancelar transferencia</Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      <ModalBase visible={modalSaldo} titulo="Saldo inicial" onCerrar={() => setModalSaldo(false)}>
        <Text style={styles.infoCaja}>
          Este valor es el punto de partida de {cuentaSaldo}. No se registra como venta, ingreso, gasto ni utilidad.
        </Text>
        <Text style={styles.etiqueta}>Cuenta</Text>
        <View style={styles.chipsWrap}>
          {CUENTAS.map((cuenta) => (
            <Chip key={cuenta} label={cuenta} activo={cuentaSaldo === cuenta} onPress={() => {
              setCuentaSaldo(cuenta);
              setMontoSaldo(String(resumen.cuentas?.[cuenta]?.saldoInicial ?? 0));
            }} />
          ))}
        </View>
        <Campo
          etiqueta="Saldo inicial"
          value={montoSaldo}
          onChangeText={setMontoSaldo}
          keyboardType="decimal-pad"
          placeholder="0.00"
        />
        <Boton titulo="Guardar saldo inicial" onPress={guardarSaldoInicial} />
      </ModalBase>

      <ModalBase visible={modalTransferencia} titulo="Transferencia interna" onCerrar={() => setModalTransferencia(false)}>
        <Text style={styles.infoCaja}>
          Úsalo para depósitos de efectivo al banco, retiros, movimientos de tarjeta a banco u otros traspasos propios. No afecta ventas, gastos ni utilidad.
        </Text>

        <Text style={styles.etiqueta}>Desde</Text>
        <View style={styles.chipsWrap}>
          {CUENTAS.map((cuenta) => (
            <Chip key={cuenta} label={`${cuenta} · ${dinero(resumen.cuentas?.[cuenta]?.saldo || 0)}`} activo={desde === cuenta} onPress={() => setDesde(cuenta)} />
          ))}
        </View>

        <Text style={styles.etiqueta}>Hacia</Text>
        <View style={styles.chipsWrap}>
          {CUENTAS.map((cuenta) => (
            <Chip key={cuenta} label={cuenta} activo={hacia === cuenta} onPress={() => setHacia(cuenta)} />
          ))}
        </View>

        <Campo
          etiqueta="Monto"
          value={montoTransferencia}
          onChangeText={setMontoTransferencia}
          keyboardType="decimal-pad"
          placeholder="0.00"
        />
        <Campo
          etiqueta="Nota"
          value={notaTransferencia}
          onChangeText={setNotaTransferencia}
          placeholder="Opcional"
        />
        <Boton titulo="Registrar transferencia" onPress={guardarTransferencia} disabled={desde === hacia} />
      </ModalBase>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: C.fondo },
  header: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 12,
    backgroundColor: C.verde,
  },
  titulo: { color: '#FFF', fontSize: 24, fontWeight: '800' },
  subtitulo: { color: '#E7EFEA', marginTop: 3, fontSize: 12 },
  contenido: { padding: 14, paddingBottom: 90 },
  totalCard: { backgroundColor: C.verde, borderRadius: 20, padding: 18, marginBottom: 12 },
  totalEtiqueta: { color: '#DDE9E1', fontSize: 13, fontWeight: '700' },
  totalValor: { color: '#FFF', fontSize: 30, fontWeight: '900', marginTop: 5 },
  totalAyuda: { color: '#DDE9E1', fontSize: 11, marginTop: 7, lineHeight: 16 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  cuentaCard: {
    width: '31%',
    minWidth: 105,
    flexGrow: 1,
    backgroundColor: C.tarjeta,
    borderWidth: 1,
    borderColor: C.linea,
    borderRadius: 15,
    padding: 12,
  },
  cuentaNombre: { color: C.secundario, fontSize: 12, fontWeight: '800' },
  cuentaSaldo: { color: C.verde, fontSize: 18, fontWeight: '900', marginTop: 7 },
  cuentaInicial: { color: C.secundario, fontSize: 10, marginTop: 5 },
  linkBtn: { marginTop: 9 },
  linkTexto: { color: C.terracota, fontSize: 10, fontWeight: '800' },
  acciones: { marginTop: 10, marginBottom: 18 },
  seccionTitulo: { color: C.texto, fontSize: 17, fontWeight: '900', marginBottom: 8 },
  filtros: { gap: 7, paddingBottom: 12 },
  chip: { paddingHorizontal: 13, paddingVertical: 9, borderRadius: 14, borderWidth: 1, borderColor: C.linea, backgroundColor: '#FFF' },
  chipActivo: { backgroundColor: C.verde, borderColor: C.verde },
  chipTexto: { color: C.texto, fontSize: 12, fontWeight: '800' },
  chipTextoActivo: { color: '#FFF' },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 14 },
  movCard: { backgroundColor: '#FFF', borderRadius: 14, borderWidth: 1, borderColor: C.linea, padding: 12, marginBottom: 8 },
  movTop: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  movConcepto: { flex: 1, color: C.texto, fontSize: 13, fontWeight: '800' },
  movMonto: { fontSize: 14, fontWeight: '900' },
  montoEntrada: { color: C.entrada },
  montoSalida: { color: C.peligro },
  movMeta: { color: C.secundario, fontSize: 10, lineHeight: 15, marginTop: 5 },
  cancelarLink: { marginTop: 8, alignSelf: 'flex-start' },
  cancelarTexto: { color: C.peligro, fontSize: 10, fontWeight: '800' },
  vacio: { backgroundColor: '#FFF', borderRadius: 15, borderWidth: 1, borderColor: C.linea, padding: 22, alignItems: 'center' },
  vacioTitulo: { color: C.texto, fontSize: 15, fontWeight: '900' },
  vacioTexto: { color: C.secundario, fontSize: 11, lineHeight: 16, marginTop: 5, textAlign: 'center' },
  boton: { backgroundColor: C.verde, minHeight: 44, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 11, alignItems: 'center', justifyContent: 'center', marginVertical: 4 },
  botonCompacto: { minHeight: 36, paddingVertical: 8, paddingHorizontal: 11 },
  botonSecundario: { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#D4C7BA' },
  botonSuave: { backgroundColor: C.crema },
  botonPeligro: { backgroundColor: '#F8E9E6', borderWidth: 1, borderColor: '#E9C7C0' },
  botonDisabled: { opacity: 0.4 },
  botonTexto: { color: '#FFF', fontSize: 13, fontWeight: '800' },
  botonTextoOscuro: { color: C.texto },
  botonTextoPeligro: { color: C.peligro },
  modalFondo: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.38)' },
  modalCaja: { maxHeight: '88%', backgroundColor: C.fondo, borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: C.linea },
  modalTitulo: { flex: 1, color: C.texto, fontSize: 18, fontWeight: '900' },
  cerrar: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.crema, alignItems: 'center', justifyContent: 'center' },
  cerrarTexto: { color: C.texto, fontSize: 22, fontWeight: '700' },
  modalContenido: { padding: 16, paddingBottom: 50 },
  campoGrupo: { marginBottom: 13 },
  etiqueta: { color: C.texto, fontSize: 13, fontWeight: '800', marginBottom: 7 },
  input: { minHeight: 46, borderRadius: 12, borderWidth: 1, borderColor: C.linea, backgroundColor: '#FFF', paddingHorizontal: 13, color: C.texto, fontSize: 15 },
  infoCaja: { backgroundColor: '#EEF3EF', color: C.verde, borderRadius: 12, padding: 12, lineHeight: 18, marginBottom: 14, fontSize: 12 },
});
