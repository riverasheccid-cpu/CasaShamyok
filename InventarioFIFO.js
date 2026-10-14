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
  aviso: '#9A6B22',
  exito: '#3E7651',
};

const dinero = (v) =>
  `$${Number(v || 0).toLocaleString('es-MX', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const texto = (v) => String(v ?? '').trim();
const num = (v) => {
  const n = Number(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};

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

function Chip({ titulo, activo, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.chip, activo && styles.chipActivo, pressed && { opacity: 0.75 }]}
    >
      <Text style={[styles.chipTexto, activo && styles.chipTextoActivo]}>{titulo}</Text>
    </Pressable>
  );
}

function Campo({ etiqueta, value, onChangeText, placeholder = '', keyboardType = 'default', multiline = false }) {
  return (
    <View style={styles.campoGrupo}>
      <Text style={styles.etiqueta}>{etiqueta}</Text>
      <TextInput
        value={String(value ?? '')}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#A39A92"
        keyboardType={keyboardType}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
        style={[styles.input, multiline && styles.inputMultiline]}
      />
    </View>
  );
}

function ModalBase({ visible, titulo, onCerrar, children, alto = '90%' }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCerrar}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalFondo}
      >
        <View style={[styles.modalCaja, { height: alto }]}> 
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitulo}>{titulo}</Text>
            <Pressable onPress={onCerrar} style={styles.cerrar}>
              <Text style={styles.cerrarTexto}>✕</Text>
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

function SelectorInsumo({ insumos, seleccionado, onSelect, buscar, setBuscar }) {
  const visibles = useMemo(() => {
    const q = String(buscar || '').toLowerCase().trim();
    return [...insumos]
      .filter((i) => !q || `${i.nombre || ''} ${i.categoria || ''}`.toLowerCase().includes(q))
      .sort((a, b) => String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es'));
  }, [insumos, buscar]);

  return (
    <>
      <Campo etiqueta="Buscar insumo" value={buscar} onChangeText={setBuscar} placeholder="Ej. leche, café, vaso..." />
      <View style={styles.listaSeleccion}>
        {visibles.slice(0, 30).map((i) => (
          <Pressable
            key={i.id}
            onPress={() => onSelect(i.id)}
            style={[styles.opcionFila, seleccionado === i.id && styles.opcionFilaActiva]}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.opcionTitulo}>{i.nombre}</Text>
              <Text style={styles.opcionMeta}>{i.categoria || 'General'} · {i.unidadBase || 'unidad'}</Text>
            </View>
            {seleccionado === i.id ? <Text style={styles.check}>✓</Text> : null}
          </Pressable>
        ))}
      </View>
    </>
  );
}

export default function InventarioFIFO(props = {}) {
  const volver = props.onVolver || props.volver || props.onBack || null;

  const {
    insumos,
    movimientos,
    comprasPendientes,
    comprasLibres,
    valorInventario,
    inventarioConCostoPendiente,
    existenciaDe,
    valorDe,
    agregarInsumo,
    editarInsumo,
    eliminarInsumo,
    registrarCompraInsumo,
    agregarInventarioSinCosto,
    registrarMerma,
    agregarCompraLibre,
    asignarCompraLibre,
    cancelarAsignacionCompraLibre,
    cancelarCompraLibre,
    asignarCostoPendienteLote,
    cancelarMovimientoInventario,
    valorInventarioPendiente,
  } = useNegocio();

  const [tab, setTab] = useState('Inventario');
  const [buscar, setBuscar] = useState('');

  const [modalInsumo, setModalInsumo] = useState(false);
  const [insumoEditando, setInsumoEditando] = useState(null);
  const [insumoDraft, setInsumoDraft] = useState(null);

  const [modalCompra, setModalCompra] = useState(false);
  const [compraInsumoId, setCompraInsumoId] = useState(null);
  const [compraBuscar, setCompraBuscar] = useState('');
  const [compraCantidad, setCompraCantidad] = useState('');
  const [compraCostoTotal, setCompraCostoTotal] = useState('');
  const [compraMetodo, setCompraMetodo] = useState('Efectivo');
  const [compraFuente, setCompraFuente] = useState('Casa Shamy');
  const [compraPagadoPor, setCompraPagadoPor] = useState('');
  const [compraPerteneceA, setCompraPerteneceA] = useState('');
  const [compraNota, setCompraNota] = useState('');

  const [modalSinCosto, setModalSinCosto] = useState(false);
  const [sinCostoInsumoId, setSinCostoInsumoId] = useState(null);
  const [sinCostoBuscar, setSinCostoBuscar] = useState('');
  const [sinCostoCantidad, setSinCostoCantidad] = useState('');
  const [sinCostoNota, setSinCostoNota] = useState('');

  const [modalMerma, setModalMerma] = useState(false);
  const [mermaInsumoId, setMermaInsumoId] = useState(null);
  const [mermaBuscar, setMermaBuscar] = useState('');
  const [mermaCantidad, setMermaCantidad] = useState('');
  const [mermaMotivo, setMermaMotivo] = useState('Merma');
  const [mermaObservacion, setMermaObservacion] = useState('');

  const [modalCompraLibre, setModalCompraLibre] = useState(false);
  const [libreConcepto, setLibreConcepto] = useState('');
  const [libreMonto, setLibreMonto] = useState('');
  const [libreMetodo, setLibreMetodo] = useState('Efectivo');
  const [libreFuente, setLibreFuente] = useState('Casa Shamy');
  const [librePagadoPor, setLibrePagadoPor] = useState('');
  const [librePerteneceA, setLibrePerteneceA] = useState('');
  const [libreNota, setLibreNota] = useState('');

  const [modalAsignarCompra, setModalAsignarCompra] = useState(false);
  const [compraAsignar, setCompraAsignar] = useState(null);
  const [asignarInsumoId, setAsignarInsumoId] = useState(null);
  const [asignarBuscar, setAsignarBuscar] = useState('');
  const [asignarMonto, setAsignarMonto] = useState('');
  const [asignarCantidad, setAsignarCantidad] = useState('');
  const [asignarNota, setAsignarNota] = useState('');

  const [modalCostoLote, setModalCostoLote] = useState(false);
  const [loteCosto, setLoteCosto] = useState(null);
  const [costoLoteMonto, setCostoLoteMonto] = useState('');
  const [costoLoteCompraId, setCostoLoteCompraId] = useState(null);
  const [costoLoteNota, setCostoLoteNota] = useState('');

  const insumosVisibles = useMemo(() => {
    const q = buscar.toLowerCase().trim();
    return [...insumos]
      .filter((i) => !q || `${i.nombre || ''} ${i.categoria || ''}`.toLowerCase().includes(q))
      .sort((a, b) => String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es'));
  }, [insumos, buscar]);

  const lotesPendientes = useMemo(() => {
    const lista = [];
    insumos.forEach((insumo) => {
      (insumo.lotes || []).forEach((lote) => {
        if (lote.costoPendiente && num(lote.cantidadDisponible) > 0) {
          lista.push({ insumo, lote });
        }
      });
    });
    return lista;
  }, [insumos]);

  const movimientosVisibles = useMemo(
    () => [...(movimientos || [])].sort((a, b) => `${b.fechaKey || ''}${b.hora || ''}`.localeCompare(`${a.fechaKey || ''}${a.hora || ''}`)),
    [movimientos]
  );

  const abrirNuevoInsumo = () => {
    setInsumoEditando(null);
    setInsumoDraft({
      nombre: '',
      categoria: 'General',
      presentacionCompra: '',
      contenidoPresentacion: '',
      unidadBase: 'unidad',
      stockMinimo: '',
    });
    setModalInsumo(true);
  };

  const abrirEditarInsumo = (insumo) => {
    setInsumoEditando(insumo);
    setInsumoDraft({
      nombre: insumo.nombre || '',
      categoria: insumo.categoria || 'General',
      presentacionCompra: insumo.presentacionCompra || '',
      contenidoPresentacion: String(insumo.contenidoPresentacion ?? ''),
      unidadBase: insumo.unidadBase || 'unidad',
      stockMinimo: String(insumo.stockMinimo ?? ''),
    });
    setModalInsumo(true);
  };

  const guardarInsumo = () => {
    const d = insumoDraft || {};
    if (!texto(d.nombre)) return Alert.alert('Falta nombre', 'Escribe el nombre del insumo.');
    const payload = {
      nombre: texto(d.nombre),
      categoria: texto(d.categoria) || 'General',
      presentacionCompra: texto(d.presentacionCompra),
      presentacion: texto(d.presentacionCompra),
      contenidoPresentacion: num(d.contenidoPresentacion),
      unidadBase: texto(d.unidadBase) || 'unidad',
      stockMinimo: num(d.stockMinimo),
    };
    const r = insumoEditando ? editarInsumo(insumoEditando.id, payload) : agregarInsumo(payload);
    if (!r?.ok) return Alert.alert('No se pudo guardar', r?.mensaje || 'Revisa los datos.');
    setModalInsumo(false);
  };

  const confirmarEliminarInsumo = (insumo) => {
    Alert.alert('Eliminar insumo', `¿Eliminar ${insumo.nombre}?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: () => {
          const r = eliminarInsumo(insumo.id);
          if (!r?.ok) Alert.alert('No se puede eliminar', r?.mensaje || '');
        },
      },
    ]);
  };

  const abrirCompra = () => {
    setCompraInsumoId(insumos[0]?.id || null);
    setCompraBuscar('');
    setCompraCantidad('');
    setCompraCostoTotal('');
    setCompraMetodo('Efectivo');
    setCompraFuente('Casa Shamy');
    setCompraPagadoPor('');
    setCompraPerteneceA('');
    setCompraNota('');
    setModalCompra(true);
  };

  const guardarCompra = () => {
    if (!compraInsumoId) return Alert.alert('Selecciona un insumo');
    const r = registrarCompraInsumo({
      insumoId: compraInsumoId,
      cantidadPresentaciones: num(compraCantidad),
      costoTotal: num(compraCostoTotal),
      metodoPago: compraMetodo,
      fuenteDinero: compraFuente,
      origenCompra: compraFuente,
      pagadoPor: compraFuente === 'Aportación nueva' ? texto(compraPagadoPor) : null,
      pagadoPorCompra: compraFuente === 'Aportación nueva' ? texto(compraPagadoPor) : null,
      perteneceA: compraFuente === 'Aportación nueva' ? texto(compraPerteneceA) || texto(compraPagadoPor) : null,
      inversionDeCompra: compraFuente === 'Aportación nueva' ? texto(compraPerteneceA) || texto(compraPagadoPor) : null,
      nota: texto(compraNota),
    });
    if (!r?.ok) return Alert.alert('No se pudo registrar', r?.mensaje || 'Revisa la compra.');
    setModalCompra(false);
  };

  const abrirSinCosto = () => {
    setSinCostoInsumoId(insumos[0]?.id || null);
    setSinCostoBuscar('');
    setSinCostoCantidad('');
    setSinCostoNota('');
    setModalSinCosto(true);
  };

  const guardarSinCosto = () => {
    if (!sinCostoInsumoId) return Alert.alert('Selecciona un insumo');
    const r = agregarInventarioSinCosto({
      insumoId: sinCostoInsumoId,
      cantidad: num(sinCostoCantidad),
      nota: texto(sinCostoNota),
    });
    if (!r?.ok) return Alert.alert('No se pudo registrar', r?.mensaje || 'Revisa la cantidad.');
    setModalSinCosto(false);
  };

  const abrirMerma = () => {
    setMermaInsumoId(insumos[0]?.id || null);
    setMermaBuscar('');
    setMermaCantidad('');
    setMermaMotivo('Merma');
    setMermaObservacion('');
    setModalMerma(true);
  };

  const guardarMerma = () => {
    if (!mermaInsumoId) return Alert.alert('Selecciona un insumo');
    const r = registrarMerma({
      insumoId: mermaInsumoId,
      cantidad: num(mermaCantidad),
      motivo: texto(mermaMotivo) || 'Merma',
      observacion: texto(mermaObservacion),
    });
    if (!r?.ok) return Alert.alert('No se pudo registrar', r?.mensaje || 'Revisa la merma.');
    setModalMerma(false);
  };

  const abrirCompraLibre = () => {
    setLibreConcepto('');
    setLibreMonto('');
    setLibreMetodo('Efectivo');
    setLibreFuente('Casa Shamy');
    setLibrePagadoPor('');
    setLibrePerteneceA('');
    setLibreNota('');
    setModalCompraLibre(true);
  };

  const guardarCompraLibre = () => {
    const r = agregarCompraLibre({
      concepto: texto(libreConcepto) || 'Compra rápida de inventario',
      monto: num(libreMonto),
      metodoPago: libreMetodo,
      fuenteDinero: libreFuente,
      pagadoPor: libreFuente === 'Aportación nueva' ? texto(librePagadoPor) : null,
      perteneceA: libreFuente === 'Aportación nueva' ? texto(librePerteneceA) || texto(librePagadoPor) : null,
      nota: texto(libreNota),
    });
    if (!r?.ok) return Alert.alert('No se pudo registrar', r?.mensaje || 'Revisa la compra.');
    setModalCompraLibre(false);
    setTab('Pendientes');
  };

  const abrirAsignarCompra = (compra) => {
    setCompraAsignar(compra);
    setAsignarInsumoId(insumos[0]?.id || null);
    setAsignarBuscar('');
    setAsignarMonto('');
    setAsignarCantidad('');
    setAsignarNota('');
    setModalAsignarCompra(true);
  };

  const guardarAsignacionCompra = () => {
    if (!compraAsignar) return;
    const r = asignarCompraLibre({
      compraId: compraAsignar.id,
      insumoId: asignarInsumoId,
      montoAsignado: num(asignarMonto),
      cantidad: num(asignarCantidad),
      nota: texto(asignarNota),
    });
    if (!r?.ok) return Alert.alert('No se pudo asignar', r?.mensaje || 'Revisa los datos.');
    setModalAsignarCompra(false);
  };

  const abrirCostoLote = (insumo, lote) => {
    setLoteCosto({ insumo, lote });
    setCostoLoteMonto('');
    setCostoLoteCompraId(null);
    setCostoLoteNota('');
    setModalCostoLote(true);
  };

  const guardarCostoLote = () => {
    if (!loteCosto) return;
    const r = asignarCostoPendienteLote({
      insumoId: loteCosto.insumo.id,
      loteId: loteCosto.lote.id,
      monto: num(costoLoteMonto),
      compraLibreId: costoLoteCompraId || null,
      nota: texto(costoLoteNota),
    });
    if (!r?.ok) return Alert.alert('No se pudo asignar el costo', r?.mensaje || 'Revisa los datos.');
    setModalCostoLote(false);
  };

  const confirmarCancelarMovimiento = (mov) => {
    Alert.alert('Cancelar movimiento', `¿Cancelar ${mov.tipo} de ${mov.insumoNombre || 'inventario'}?`, [
      { text: 'No', style: 'cancel' },
      {
        text: 'Sí, cancelar',
        style: 'destructive',
        onPress: () => {
          const r = cancelarMovimientoInventario(mov.id);
          if (!r?.ok) Alert.alert('No se puede cancelar', r?.mensaje || '');
        },
      },
    ]);
  };

  const confirmarCancelarCompraLibre = (compra) => {
    Alert.alert('Cancelar compra libre', `¿Cancelar ${compra.concepto}?`, [
      { text: 'No', style: 'cancel' },
      {
        text: 'Sí, cancelar',
        style: 'destructive',
        onPress: () => {
          const r = cancelarCompraLibre(compra.id);
          if (!r?.ok) Alert.alert('No se puede cancelar', r?.mensaje || '');
        },
      },
    ]);
  };

  const confirmarDesasignar = (compra, clasificacion) => {
    Alert.alert('Desasignar', `¿Quitar la asignación de ${clasificacion.insumoNombre || 'insumo'}?`, [
      { text: 'No', style: 'cancel' },
      {
        text: 'Sí, desasignar',
        style: 'destructive',
        onPress: () => {
          const r = cancelarAsignacionCompraLibre({
            compraId: compra.id,
            clasificacionId: clasificacion.id,
          });
          if (!r?.ok) Alert.alert('No se puede desasignar', r?.mensaje || '');
        },
      },
    ]);
  };

  const montoPendienteCompras = typeof valorInventarioPendiente === 'function' ? valorInventarioPendiente() : 0;

  return (
    <SafeAreaView style={styles.pantalla}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.titulo}>Inventario</Text>
          <Text style={styles.subtitulo}>FIFO, compras, mermas y costos pendientes</Text>
        </View>
        {volver ? <Boton titulo="Volver" tipo="secundario" compacto onPress={volver} /> : null}
      </View>

      <View style={styles.tabs}>
        {['Inventario', 'Movimientos', 'Pendientes'].map((t) => (
          <Chip key={t} titulo={t} activo={tab === t} onPress={() => setTab(t)} />
        ))}
      </View>

      {tab === 'Inventario' ? (
        <ScrollView contentContainerStyle={styles.contenido} keyboardShouldPersistTaps="handled">
          <View style={styles.metricas}>
            <View style={styles.metrica}>
              <Text style={styles.metricaLabel}>Valor conocido</Text>
              <Text style={styles.metricaValor}>{dinero(valorInventario)}</Text>
            </View>
            <View style={styles.metrica}>
              <Text style={styles.metricaLabel}>Cantidad con costo pendiente</Text>
              <Text style={styles.metricaValor}>{num(inventarioConCostoPendiente).toLocaleString('es-MX')}</Text>
            </View>
            <View style={styles.metrica}>
              <Text style={styles.metricaLabel}>Compras por asignar</Text>
              <Text style={styles.metricaValor}>{dinero(montoPendienteCompras)}</Text>
            </View>
          </View>

          <View style={styles.accionesWrap}>
            <Boton titulo="+ Insumo" compacto onPress={abrirNuevoInsumo} />
            <Boton titulo="Compra directa" tipo="suave" compacto onPress={abrirCompra} />
            <Boton titulo="Compra libre" tipo="suave" compacto onPress={abrirCompraLibre} />
            <Boton titulo="Entrada sin costo" tipo="suave" compacto onPress={abrirSinCosto} />
            <Boton titulo="Merma" tipo="peligro" compacto onPress={abrirMerma} />
          </View>

          <Campo etiqueta="Buscar" value={buscar} onChangeText={setBuscar} placeholder="Buscar insumo..." />

          {insumosVisibles.length === 0 ? (
            <View style={styles.vacio}><Text style={styles.vacioTitulo}>No hay insumos</Text></View>
          ) : (
            insumosVisibles.map((insumo) => {
              const existencia = existenciaDe(insumo);
              const valor = valorDe(insumo);
              const bajo = num(insumo.stockMinimo) > 0 && existencia <= num(insumo.stockMinimo);
              const pendientes = (insumo.lotes || []).filter((l) => l.costoPendiente && num(l.cantidadDisponible) > 0);

              return (
                <View key={insumo.id} style={styles.card}>
                  <View style={styles.cardTop}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardTitulo}>{insumo.nombre}</Text>
                      <Text style={styles.cardMeta}>{insumo.categoria || 'General'} · {insumo.presentacionCompra || 'Sin presentación'}</Text>
                    </View>
                    <Text style={styles.stock}>{existencia.toLocaleString('es-MX')} {insumo.unidadBase || ''}</Text>
                  </View>

                  <View style={styles.badges}>
                    <View style={[styles.badge, bajo && styles.badgePeligro]}>
                      <Text style={styles.badgeTxt}>{bajo ? 'Stock bajo' : 'Stock OK'}</Text>
                    </View>
                    <View style={styles.badge}><Text style={styles.badgeTxt}>Valor {dinero(valor)}</Text></View>
                    {pendientes.length ? <View style={styles.badgeAviso}><Text style={styles.badgeTxt}>{pendientes.length} lote(s) sin costo</Text></View> : null}
                  </View>

                  {(insumo.lotes || []).filter((l) => num(l.cantidadDisponible) > 0).length ? (
                    <View style={styles.lotesCaja}>
                      {(insumo.lotes || []).filter((l) => num(l.cantidadDisponible) > 0).map((lote) => (
                        <View key={lote.id} style={styles.loteFila}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.loteTitulo}>{lote.origen || 'Lote'} · {num(lote.cantidadDisponible).toLocaleString('es-MX')} {insumo.unidadBase || ''}</Text>
                            <Text style={styles.loteMeta}>{lote.costoPendiente ? 'Costo pendiente' : `Costo unitario ${dinero(lote.costoUnidadBase)}`}</Text>
                          </View>
                          {lote.costoPendiente ? <Boton titulo="Asignar costo" tipo="suave" compacto onPress={() => abrirCostoLote(insumo, lote)} /> : null}
                        </View>
                      ))}
                    </View>
                  ) : null}

                  <View style={styles.botonesCard}>
                    <Boton titulo="Editar" tipo="suave" compacto onPress={() => abrirEditarInsumo(insumo)} />
                    <Boton titulo="Eliminar" tipo="peligro" compacto onPress={() => confirmarEliminarInsumo(insumo)} />
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      ) : null}

      {tab === 'Movimientos' ? (
        <ScrollView contentContainerStyle={styles.contenido}>
          {movimientosVisibles.length === 0 ? <View style={styles.vacio}><Text style={styles.vacioTitulo}>Sin movimientos</Text></View> : null}
          {movimientosVisibles.map((mov) => (
            <View key={mov.id} style={styles.card}>
              <View style={styles.cardTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitulo}>{mov.tipo} · {mov.insumoNombre || 'Inventario'}</Text>
                  <Text style={styles.cardMeta}>{mov.fecha || mov.fechaKey || ''} {mov.hora || ''} · {mov.origen || ''}</Text>
                </View>
                <Text style={[styles.stock, num(mov.cantidad) < 0 && { color: C.peligro }]}> {num(mov.cantidad) > 0 ? '+' : ''}{num(mov.cantidad).toLocaleString('es-MX')} {mov.unidadBase || ''}</Text>
              </View>
              <Text style={styles.detalle}>Costo: {mov.costo === null || mov.costo === undefined ? 'Pendiente' : dinero(mov.costo)}</Text>
              {mov.nota ? <Text style={styles.detalle}>Nota: {mov.nota}</Text> : null}
              {(mov.tipo === 'Merma' || (mov.tipo === 'Entrada' && mov.loteId)) ? (
                <View style={styles.botonesCard}>
                  <Boton titulo="Cancelar movimiento" tipo="peligro" compacto onPress={() => confirmarCancelarMovimiento(mov)} />
                </View>
              ) : null}
            </View>
          ))}
        </ScrollView>
      ) : null}

      {tab === 'Pendientes' ? (
        <ScrollView contentContainerStyle={styles.contenido}>
          <Text style={styles.seccionTitulo}>Compras por asignar</Text>
          {(comprasPendientes || []).length === 0 ? <Text style={styles.vacioTexto}>No hay compras pendientes.</Text> : null}
          {(comprasPendientes || []).map((compra) => (
            <View key={compra.id} style={styles.card}>
              <View style={styles.cardTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitulo}>{compra.concepto}</Text>
                  <Text style={styles.cardMeta}>{compra.fecha || compra.fechaKey || ''} · {compra.metodoPago || ''}</Text>
                </View>
                <Text style={styles.stock}>{dinero(compra.montoPendiente)}</Text>
              </View>
              <Text style={styles.detalle}>Total: {dinero(compra.monto)} · Asignado: {dinero(compra.montoClasificado)}</Text>

              {(compra.clasificaciones || []).map((cla) => (
                <View key={cla.id} style={styles.clasificacionFila}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.opcionTitulo}>{cla.insumoNombre || 'Insumo'} · {dinero(cla.monto)}</Text>
                    <Text style={styles.opcionMeta}>{num(cla.cantidad).toLocaleString('es-MX')} unidades base · {cla.tipo || 'Asignación'}</Text>
                  </View>
                  <Boton titulo="Desasignar" tipo="peligro" compacto onPress={() => confirmarDesasignar(compra, cla)} />
                </View>
              ))}

              <View style={styles.botonesCard}>
                <Boton titulo="Asignar a insumo" compacto onPress={() => abrirAsignarCompra(compra)} />
                <Boton titulo="Cancelar compra" tipo="peligro" compacto onPress={() => confirmarCancelarCompraLibre(compra)} />
              </View>
            </View>
          ))}

          <Text style={styles.seccionTitulo}>Lotes con costo pendiente</Text>
          {lotesPendientes.length === 0 ? <Text style={styles.vacioTexto}>No hay lotes pendientes de costo.</Text> : null}
          {lotesPendientes.map(({ insumo, lote }) => (
            <View key={lote.id} style={styles.card}>
              <Text style={styles.cardTitulo}>{insumo.nombre}</Text>
              <Text style={styles.cardMeta}>{num(lote.cantidadDisponible).toLocaleString('es-MX')} {insumo.unidadBase || ''} disponibles · {lote.origen || 'Lote'}</Text>
              <View style={styles.botonesCard}>
                <Boton titulo="Asignar costo" compacto onPress={() => abrirCostoLote(insumo, lote)} />
              </View>
            </View>
          ))}
        </ScrollView>
      ) : null}

      <ModalBase visible={modalInsumo} titulo={insumoEditando ? 'Editar insumo' : 'Nuevo insumo'} onCerrar={() => setModalInsumo(false)} alto="82%">
        {insumoDraft ? (
          <>
            <Campo etiqueta="Nombre" value={insumoDraft.nombre} onChangeText={(v) => setInsumoDraft({ ...insumoDraft, nombre: v })} />
            <Campo etiqueta="Categoría" value={insumoDraft.categoria} onChangeText={(v) => setInsumoDraft({ ...insumoDraft, categoria: v })} />
            <Campo etiqueta="Presentación de compra" value={insumoDraft.presentacionCompra} onChangeText={(v) => setInsumoDraft({ ...insumoDraft, presentacionCompra: v })} placeholder="Ej. botella 1 L, bolsa 1 kg" />
            <Campo etiqueta="Contenido de cada presentación" value={insumoDraft.contenidoPresentacion} onChangeText={(v) => setInsumoDraft({ ...insumoDraft, contenidoPresentacion: v })} keyboardType="decimal-pad" />
            <Campo etiqueta="Unidad base" value={insumoDraft.unidadBase} onChangeText={(v) => setInsumoDraft({ ...insumoDraft, unidadBase: v })} placeholder="ml, g, unidad..." />
            <Campo etiqueta="Stock mínimo" value={insumoDraft.stockMinimo} onChangeText={(v) => setInsumoDraft({ ...insumoDraft, stockMinimo: v })} keyboardType="decimal-pad" />
            <Boton titulo="Guardar insumo" onPress={guardarInsumo} />
          </>
        ) : null}
      </ModalBase>

      <ModalBase visible={modalCompra} titulo="Compra directa de inventario" onCerrar={() => setModalCompra(false)}>
        <SelectorInsumo insumos={insumos} seleccionado={compraInsumoId} onSelect={setCompraInsumoId} buscar={compraBuscar} setBuscar={setCompraBuscar} />
        <Campo etiqueta="Cantidad de presentaciones compradas" value={compraCantidad} onChangeText={setCompraCantidad} keyboardType="decimal-pad" placeholder="Ej. 3" />
        <Campo etiqueta="Costo total de la compra" value={compraCostoTotal} onChangeText={setCompraCostoTotal} keyboardType="decimal-pad" placeholder="0.00" />
        <Text style={styles.etiqueta}>Método de pago</Text>
        <View style={styles.chipsWrap}>{['Efectivo', 'Transferencia', 'Tarjeta'].map((m) => <Chip key={m} titulo={m} activo={compraMetodo === m} onPress={() => setCompraMetodo(m)} />)}</View>
        <Text style={styles.etiqueta}>¿De dónde salió el dinero?</Text>
        <View style={styles.chipsWrap}>{['Casa Shamy', 'Aportación nueva'].map((f) => <Chip key={f} titulo={f} activo={compraFuente === f} onPress={() => setCompraFuente(f)} />)}</View>
        {compraFuente === 'Aportación nueva' ? (
          <>
            <Campo etiqueta="Pagado por" value={compraPagadoPor} onChangeText={setCompraPagadoPor} />
            <Campo etiqueta="La inversión pertenece a" value={compraPerteneceA} onChangeText={setCompraPerteneceA} placeholder="Si se deja vacío, usa Pagado por" />
          </>
        ) : null}
        <Campo etiqueta="Nota" value={compraNota} onChangeText={setCompraNota} placeholder="Opcional" multiline />
        <Boton titulo="Registrar compra" onPress={guardarCompra} />
      </ModalBase>

      <ModalBase visible={modalSinCosto} titulo="Entrada de inventario sin costo" onCerrar={() => setModalSinCosto(false)} alto="80%">
        <Text style={styles.info}>La existencia física sí estará disponible para vender, pero su costo quedará pendiente hasta que lo asignes.</Text>
        <SelectorInsumo insumos={insumos} seleccionado={sinCostoInsumoId} onSelect={setSinCostoInsumoId} buscar={sinCostoBuscar} setBuscar={setSinCostoBuscar} />
        <Campo etiqueta="Cantidad en unidad base" value={sinCostoCantidad} onChangeText={setSinCostoCantidad} keyboardType="decimal-pad" />
        <Campo etiqueta="Nota" value={sinCostoNota} onChangeText={setSinCostoNota} multiline />
        <Boton titulo="Agregar inventario" onPress={guardarSinCosto} />
      </ModalBase>

      <ModalBase visible={modalMerma} titulo="Registrar merma" onCerrar={() => setModalMerma(false)} alto="82%">
        <SelectorInsumo insumos={insumos} seleccionado={mermaInsumoId} onSelect={setMermaInsumoId} buscar={mermaBuscar} setBuscar={setMermaBuscar} />
        <Campo etiqueta="Cantidad" value={mermaCantidad} onChangeText={setMermaCantidad} keyboardType="decimal-pad" />
        <Campo etiqueta="Motivo" value={mermaMotivo} onChangeText={setMermaMotivo} />
        <Campo etiqueta="Observación" value={mermaObservacion} onChangeText={setMermaObservacion} multiline />
        <Boton titulo="Registrar merma" tipo="peligro" onPress={guardarMerma} />
      </ModalBase>

      <ModalBase visible={modalCompraLibre} titulo="Compra libre de inventario" onCerrar={() => setModalCompraLibre(false)}>
        <Text style={styles.info}>Úsala cuando ya pagaste una compra pero todavía no quieres repartirla entre los insumos. El dinero sale una sola vez y después solo clasificas el monto.</Text>
        <Campo etiqueta="Concepto" value={libreConcepto} onChangeText={setLibreConcepto} placeholder="Ej. Ticket Costco, proveedor..." />
        <Campo etiqueta="Monto total" value={libreMonto} onChangeText={setLibreMonto} keyboardType="decimal-pad" />
        <Text style={styles.etiqueta}>Método de pago</Text>
        <View style={styles.chipsWrap}>{['Efectivo', 'Transferencia', 'Tarjeta'].map((m) => <Chip key={m} titulo={m} activo={libreMetodo === m} onPress={() => setLibreMetodo(m)} />)}</View>
        <Text style={styles.etiqueta}>¿De dónde salió el dinero?</Text>
        <View style={styles.chipsWrap}>{['Casa Shamy', 'Aportación nueva'].map((f) => <Chip key={f} titulo={f} activo={libreFuente === f} onPress={() => setLibreFuente(f)} />)}</View>
        {libreFuente === 'Aportación nueva' ? (
          <>
            <Campo etiqueta="Pagado por" value={librePagadoPor} onChangeText={setLibrePagadoPor} />
            <Campo etiqueta="La inversión pertenece a" value={librePerteneceA} onChangeText={setLibrePerteneceA} />
          </>
        ) : null}
        <Campo etiqueta="Nota" value={libreNota} onChangeText={setLibreNota} multiline />
        <Boton titulo="Guardar compra libre" onPress={guardarCompraLibre} />
      </ModalBase>

      <ModalBase visible={modalAsignarCompra} titulo="Asignar compra a inventario" onCerrar={() => setModalAsignarCompra(false)}>
        {compraAsignar ? <Text style={styles.info}>Saldo pendiente: {dinero(compraAsignar.montoPendiente)}</Text> : null}
        <SelectorInsumo insumos={insumos} seleccionado={asignarInsumoId} onSelect={setAsignarInsumoId} buscar={asignarBuscar} setBuscar={setAsignarBuscar} />
        <Campo etiqueta="Monto de esta asignación" value={asignarMonto} onChangeText={setAsignarMonto} keyboardType="decimal-pad" />
        <Campo etiqueta="Cantidad recibida en unidad base" value={asignarCantidad} onChangeText={setAsignarCantidad} keyboardType="decimal-pad" />
        <Campo etiqueta="Nota" value={asignarNota} onChangeText={setAsignarNota} multiline />
        <Boton titulo="Asignar" onPress={guardarAsignacionCompra} />
      </ModalBase>

      <ModalBase visible={modalCostoLote} titulo="Asignar costo a lote" onCerrar={() => setModalCostoLote(false)} alto="82%">
        {loteCosto ? (
          <Text style={styles.info}>{loteCosto.insumo.nombre} · Lote con {num(loteCosto.lote.cantidadInicial).toLocaleString('es-MX')} {loteCosto.insumo.unidadBase || ''} iniciales.</Text>
        ) : null}
        <Campo etiqueta="Costo total del lote" value={costoLoteMonto} onChangeText={setCostoLoteMonto} keyboardType="decimal-pad" />
        <Text style={styles.etiqueta}>Relacionar con compra libre (opcional)</Text>
        <View style={styles.chipsWrap}>
          <Chip titulo="Ninguna" activo={!costoLoteCompraId} onPress={() => setCostoLoteCompraId(null)} />
          {(comprasPendientes || []).map((c) => (
            <Chip key={c.id} titulo={`${c.concepto} · ${dinero(c.montoPendiente)}`} activo={costoLoteCompraId === c.id} onPress={() => setCostoLoteCompraId(c.id)} />
          ))}
        </View>
        <Campo etiqueta="Nota" value={costoLoteNota} onChangeText={setCostoLoteNota} multiline />
        <Boton titulo="Asignar costo" onPress={guardarCostoLote} />
      </ModalBase>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: C.fondo },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 18, paddingTop: 14, paddingBottom: 13, backgroundColor: C.verde },
  titulo: { fontSize: 24, fontWeight: '900', color: '#FFF' },
  subtitulo: { marginTop: 3, fontSize: 12, color: '#E5EEE9' },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, padding: 12, backgroundColor: '#F1EAE0', borderBottomWidth: 1, borderBottomColor: C.linea },
  contenido: { padding: 14, paddingBottom: 90 },
  metricas: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginBottom: 12 },
  metrica: { width: '48%', minHeight: 88, backgroundColor: '#FFF', borderRadius: 14, borderWidth: 1, borderColor: C.linea, padding: 12 },
  metricaLabel: { color: C.secundario, fontSize: 11, fontWeight: '700' },
  metricaValor: { color: C.verde, fontSize: 18, fontWeight: '900', marginTop: 8 },
  accionesWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 12 },
  card: { backgroundColor: '#FFF', borderRadius: 16, borderWidth: 1, borderColor: C.linea, padding: 13, marginBottom: 10 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  cardTitulo: { fontSize: 16, fontWeight: '900', color: C.texto },
  cardMeta: { fontSize: 11, color: C.secundario, marginTop: 3, lineHeight: 16 },
  stock: { color: C.verde, fontWeight: '900', fontSize: 14, textAlign: 'right' },
  detalle: { color: C.secundario, fontSize: 12, marginTop: 7, lineHeight: 17 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  badge: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 9, backgroundColor: '#E8F0EB' },
  badgePeligro: { backgroundColor: '#F6E2DE' },
  badgeAviso: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 9, backgroundColor: '#F6EDD8' },
  badgeTxt: { fontSize: 10, fontWeight: '800', color: C.texto },
  lotesCaja: { marginTop: 10, borderTopWidth: 1, borderTopColor: '#EEE6DB', paddingTop: 6 },
  loteFila: { flexDirection: 'row', gap: 8, alignItems: 'center', paddingVertical: 7 },
  loteTitulo: { fontSize: 11, fontWeight: '800', color: C.texto },
  loteMeta: { fontSize: 10, color: C.secundario, marginTop: 2 },
  botonesCard: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  clasificacionFila: { flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: 1, borderTopColor: '#EEE6DB', paddingVertical: 9, marginTop: 6 },
  seccionTitulo: { fontSize: 16, fontWeight: '900', color: C.texto, marginTop: 4, marginBottom: 9 },
  vacio: { backgroundColor: '#FFF', borderRadius: 14, borderWidth: 1, borderColor: C.linea, padding: 22, alignItems: 'center' },
  vacioTitulo: { color: C.texto, fontWeight: '800' },
  vacioTexto: { color: C.secundario, fontSize: 12, marginBottom: 12 },
  boton: { minHeight: 43, borderRadius: 11, paddingHorizontal: 14, paddingVertical: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: C.verde },
  botonCompacto: { minHeight: 35, paddingHorizontal: 10, paddingVertical: 7 },
  botonSecundario: { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#D5C9BD' },
  botonSuave: { backgroundColor: C.crema },
  botonPeligro: { backgroundColor: '#F8E9E6', borderWidth: 1, borderColor: '#E9C7C0' },
  botonDisabled: { opacity: 0.4 },
  botonTexto: { color: '#FFF', fontWeight: '900', fontSize: 12 },
  botonTextoOscuro: { color: C.texto },
  botonTextoPeligro: { color: C.peligro },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 15, borderWidth: 1, borderColor: C.linea, backgroundColor: '#FFF' },
  chipActivo: { backgroundColor: C.verde, borderColor: C.verde },
  chipTexto: { color: C.texto, fontWeight: '800', fontSize: 12 },
  chipTextoActivo: { color: '#FFF' },
  campoGrupo: { marginBottom: 12 },
  etiqueta: { fontSize: 12, fontWeight: '900', color: C.texto, marginBottom: 6 },
  input: { minHeight: 46, borderRadius: 11, borderWidth: 1, borderColor: C.linea, backgroundColor: '#FFF', paddingHorizontal: 12, color: C.texto, fontSize: 14 },
  inputMultiline: { minHeight: 90, paddingTop: 11 },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 12 },
  modalFondo: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.38)' },
  modalCaja: { backgroundColor: C.fondo, borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: C.linea },
  modalTitulo: { flex: 1, fontSize: 18, fontWeight: '900', color: C.texto },
  cerrar: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.crema, alignItems: 'center', justifyContent: 'center' },
  cerrarTexto: { fontWeight: '900', color: C.texto },
  modalContenido: { padding: 16, paddingBottom: 45 },
  listaSeleccion: { maxHeight: 260, borderWidth: 1, borderColor: C.linea, borderRadius: 12, overflow: 'hidden', backgroundColor: '#FFF', marginBottom: 12 },
  opcionFila: { flexDirection: 'row', alignItems: 'center', padding: 10, borderBottomWidth: 1, borderBottomColor: '#EEE7DF' },
  opcionFilaActiva: { backgroundColor: '#EAF1EC' },
  opcionTitulo: { fontSize: 12, fontWeight: '800', color: C.texto },
  opcionMeta: { color: C.secundario, fontSize: 10, marginTop: 2 },
  check: { color: C.verde, fontSize: 18, fontWeight: '900' },
  info: { backgroundColor: '#EEF3EF', color: C.verde, borderRadius: 11, padding: 11, marginBottom: 12, fontSize: 12, lineHeight: 17 },
});
