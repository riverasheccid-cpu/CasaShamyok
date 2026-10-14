import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import InventarioFIFO from './InventarioFIFO.js';
import ProductosRecetas from './ProductosRecetas.js';
import Reportes from './Reportes.js';

import {
  DatosNegocioProvider,
  useNegocio,
} from './DatosNegocio.js';

const dinero = (valor) =>
  `$${Number(valor || 0).toLocaleString('es-MX', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const hoyKey = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dia}`;
};

const texto = (valor) => String(valor ?? '').trim();

function Boton({
  titulo,
  onPress,
  tipo = 'principal',
  compacto = false,
  disabled = false,
}) {
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
        disabled && styles.botonDeshabilitado,
        pressed && !disabled && styles.presionado,
      ]}
    >
      <Text
        style={[
          styles.botonTexto,
          (tipo === 'secundario' || tipo === 'suave') &&
            styles.botonTextoOscuro,
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
      style={({ pressed }) => [
        styles.chip,
        activo && styles.chipActivo,
        pressed && styles.presionado,
      ]}
    >
      <Text
        style={[
          styles.chipTexto,
          activo && styles.chipTextoActivo,
        ]}
      >
        {titulo}
      </Text>
    </Pressable>
  );
}

function Campo({
  etiqueta,
  value,
  onChangeText,
  placeholder = '',
  keyboardType = 'default',
}) {
  return (
    <View style={styles.campoGrupo}>
      <Text style={styles.campoEtiqueta}>{etiqueta}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#999"
        keyboardType={keyboardType}
        style={styles.input}
      />
    </View>
  );
}

function ModalBase({ visible, titulo, onCerrar, children }) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onCerrar}
    >
      <KeyboardAvoidingView
        style={styles.modalFondo}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.modalCaja}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitulo}>{titulo}</Text>
            <Pressable onPress={onCerrar} style={styles.cerrar}>
              <Text style={styles.cerrarTexto}>✕</Text>
            </Pressable>
          </View>

          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.modalContenido}
          >
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function TituloPantalla({ titulo, subtitulo, volver }) {
  return (
    <View style={styles.header}>
      <View style={styles.flex1}>
        <Text style={styles.titulo}>{titulo}</Text>
        {subtitulo ? (
          <Text style={styles.subtitulo}>{subtitulo}</Text>
        ) : null}
      </View>

      {volver ? (
        <Boton
          titulo="Volver"
          tipo="secundario"
          compacto
          onPress={volver}
        />
      ) : null}
    </View>
  );
}

function TarjetaMetrica({ titulo, valor, detalle }) {
  return (
    <View style={styles.metricaCard}>
      <Text style={styles.metricaTitulo}>{titulo}</Text>
      <Text style={styles.metricaValor}>{valor}</Text>
      {detalle ? (
        <Text style={styles.metricaDetalle}>{detalle}</Text>
      ) : null}
    </View>
  );
}

function CasaShamyApp() {
  const negocio = useNegocio();

  const {
    datosCargados,
    productos,
    ventas,
    gastos,
    inversiones,
    pagosInversion,
    movimientosFlujo,
    comprasPendientes,
    gastosPendientes,
    ventasPendientes,
    valorInventario,
    saldoFlujo,
    numero,
    registrarVentaProducto,
    registrarVentaProductoPendiente,
    registrarVentaLibre,
    clasificarVentaLibre,
    costearVentaProductoPendiente,
    cancelarVenta,
    agregarGasto,
    asignarGastoPendiente,
    cancelarGasto,
    agregarInversion,
    pagarInversion,
    obtenerResumenInversionistas,
    agregarCreditoProveedor,
    obtenerResumenCreditos,
    pagarCreditoProveedor,
    cancelarPagoCredito,
    cancelarCreditoProveedor,
  } = negocio;

  const [pantalla, setPantalla] = useState('Inicio');

  // Venta normal
  const [modalVentaProducto, setModalVentaProducto] = useState(false);
  const [ventaProductoId, setVentaProductoId] = useState('');
  const [ventaCantidad, setVentaCantidad] = useState('1');
  const [ventaMetodo, setVentaMetodo] = useState('Efectivo');
  const [ventaNota, setVentaNota] = useState('');

  // Venta libre
  const [modalVentaLibre, setModalVentaLibre] = useState(false);
  const [ventaLibreConcepto, setVentaLibreConcepto] = useState('');
  const [ventaLibreMonto, setVentaLibreMonto] = useState('');
  const [ventaLibreMetodo, setVentaLibreMetodo] = useState('Efectivo');
  const [ventaLibreNota, setVentaLibreNota] = useState('');

  // Clasificar venta
  const [modalClasificarVenta, setModalClasificarVenta] = useState(false);
  const [ventaAClasificar, setVentaAClasificar] = useState(null);
  const [clasificacionProductoId, setClasificacionProductoId] = useState('');
  const [clasificacionCantidad, setClasificacionCantidad] = useState('1');
  const [clasificacionPartidas, setClasificacionPartidas] = useState([]);

  // Gasto
  const [modalGasto, setModalGasto] = useState(false);
  const [conceptoGasto, setConceptoGasto] = useState('');
  const [montoGasto, setMontoGasto] = useState('');
  const [categoriaGasto, setCategoriaGasto] = useState('Operación');
  const [tipoGasto, setTipoGasto] = useState('Variable');
  const [frecuenciaGasto, setFrecuenciaGasto] = useState('Único');
  const [metodoGasto, setMetodoGasto] = useState('Efectivo');
  const [fuenteGasto, setFuenteGasto] = useState('Casa Shamy');
  const [pagadoPorGasto, setPagadoPorGasto] = useState('');
  const [perteneceAGasto, setPerteneceAGasto] = useState('');
  const [pendienteGasto, setPendienteGasto] = useState(false);
  const [notaGasto, setNotaGasto] = useState('');

  // Asignar gasto
  const [modalAsignarGasto, setModalAsignarGasto] = useState(false);
  const [gastoAAsignar, setGastoAAsignar] = useState(null);
  const [asignacionGastoMonto, setAsignacionGastoMonto] = useState('');
  const [asignacionGastoConcepto, setAsignacionGastoConcepto] = useState('');
  const [asignacionGastoCategoria, setAsignacionGastoCategoria] = useState('Operación');

  // Inversión
  const [modalInversion, setModalInversion] = useState(false);
  const [conceptoInversion, setConceptoInversion] = useState('');
  const [montoInversion, setMontoInversion] = useState('');
  const [pagadoPorInversion, setPagadoPorInversion] = useState('');
  const [perteneceAInversion, setPerteneceAInversion] = useState('');
  const [formaInversion, setFormaInversion] = useState('Efectivo a Casa Shamy');
  const [metodoInversion, setMetodoInversion] = useState('Transferencia');

  // Pago inversión
  const [modalPagoInversion, setModalPagoInversion] = useState(false);
  const [inversionistaPago, setInversionistaPago] = useState('');
  const [montoPagoInversion, setMontoPagoInversion] = useState('');
  const [metodoPagoInversion, setMetodoPagoInversion] = useState('Transferencia');

  // Crédito
  const [modalCredito, setModalCredito] = useState(false);
  const [proveedorCredito, setProveedorCredito] = useState('');
  const [conceptoCredito, setConceptoCredito] = useState('');
  const [montoCredito, setMontoCredito] = useState('');
  const [tipoCredito, setTipoCredito] = useState('Inventario');
  const [vencimientoCredito, setVencimientoCredito] = useState('');
  const [plazoCredito, setPlazoCredito] = useState('');
  const [categoriaCredito, setCategoriaCredito] = useState('Operación');

  // Pago crédito
  const [modalPagoCredito, setModalPagoCredito] = useState(false);
  const [creditoAPagar, setCreditoAPagar] = useState(null);
  const [montoPagoCredito, setMontoPagoCredito] = useState('');
  const [metodoPagoCredito, setMetodoPagoCredito] = useState('Transferencia');
  const [fuentePagoCredito, setFuentePagoCredito] = useState('Casa Shamy');
  const [pagadoPorCredito, setPagadoPorCredito] = useState('');
  const [perteneceACredito, setPerteneceACredito] = useState('');

  if (!datosCargados) {
    return (
      <SafeAreaView style={styles.cargandoPantalla}>
        <Text style={styles.cargandoTitulo}>Casa Shamy</Text>
        <Text style={styles.cargandoTexto}>Cargando información...</Text>
      </SafeAreaView>
    );
  }

  if (pantalla === 'Inventario') {
    return <InventarioFIFO onVolver={() => setPantalla('Inicio')} />;
  }

  if (pantalla === 'Productos') {
    return <ProductosRecetas onVolver={() => setPantalla('Inicio')} />;
  }

  if (pantalla === 'Reportes') {
    return <Reportes onVolver={() => setPantalla('Inicio')} />;
  }

  const hoy = hoyKey();

  const ventasHoy = ventas.filter((venta) => venta.fechaKey === hoy);
  const totalVentasHoy = ventasHoy.reduce(
    (sum, venta) => sum + numero(venta.monto),
    0
  );

  const utilidadConocidaHoy = ventasHoy.reduce((sum, venta) => {
    if (venta.utilidadBruta === null || venta.utilidadBruta === undefined) {
      return sum;
    }
    return sum + numero(venta.utilidadBruta);
  }, 0);

  const gastosHoy = gastos.filter((gasto) => gasto.fechaKey === hoy);
  const totalGastosHoy = gastosHoy.reduce(
    (sum, gasto) => sum + numero(gasto.monto),
    0
  );

  const resumenInversionistas = obtenerResumenInversionistas();
  const resumenCreditos = obtenerResumenCreditos();
  const saldoCaja = saldoFlujo();

  const totalCreditoPendiente = resumenCreditos.reduce(
    (sum, credito) => sum + numero(credito.saldo),
    0
  );

  const abrirVentaProducto = () => {
    setVentaProductoId(productos[0]?.id || '');
    setVentaCantidad('1');
    setVentaMetodo('Efectivo');
    setVentaNota('');
    setModalVentaProducto(true);
  };

  const guardarVentaProducto = () => {
    if (!ventaProductoId) {
      Alert.alert('Falta producto', 'Selecciona un producto.');
      return;
    }

    const cantidad = numero(ventaCantidad);
    if (!cantidad || cantidad <= 0) {
      Alert.alert('Cantidad inválida', 'Escribe una cantidad mayor a 0.');
      return;
    }

    const resultado = registrarVentaProducto({
      productoId: ventaProductoId,
      cantidad,
      metodoPago: ventaMetodo,
      nota: ventaNota,
    });

    if (resultado?.ok) {
      setModalVentaProducto(false);
      return;
    }

    if (resultado?.requiereVentaPendiente) {
      Alert.alert(
        'Venta pendiente de costeo',
        `${resultado.mensaje}\n\n¿Quieres registrar la venta de todos modos?`,
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Registrar pendiente',
            onPress: () => {
              const pendiente = registrarVentaProductoPendiente({
                productoId: ventaProductoId,
                cantidad,
                metodoPago: ventaMetodo,
                nota: ventaNota,
              });

              if (pendiente?.ok) {
                setModalVentaProducto(false);
              } else {
                Alert.alert(
                  'No se pudo registrar',
                  pendiente?.mensaje || 'Revisa los datos.'
                );
              }
            },
          },
        ]
      );
      return;
    }

    Alert.alert(
      'No se pudo registrar',
      resultado?.mensaje || 'Revisa la venta.'
    );
  };

  const guardarVentaLibre = () => {
    const resultado = registrarVentaLibre({
      concepto: ventaLibreConcepto,
      monto: ventaLibreMonto,
      metodoPago: ventaLibreMetodo,
      nota: ventaLibreNota,
    });

    if (!resultado?.ok) {
      Alert.alert(
        'No se pudo registrar',
        resultado?.mensaje || 'Revisa los datos.'
      );
      return;
    }

    setModalVentaLibre(false);
    setVentaLibreConcepto('');
    setVentaLibreMonto('');
    setVentaLibreNota('');
  };

  const abrirClasificarVenta = (venta) => {
    setVentaAClasificar(venta);
    setClasificacionPartidas([]);
    setClasificacionProductoId(productos[0]?.id || '');
    setClasificacionCantidad('1');
    setModalClasificarVenta(true);
  };

  const agregarPartidaClasificacion = () => {
    const producto = productos.find(
      (item) => item.id === clasificacionProductoId
    );
    const cantidad = numero(clasificacionCantidad);

    if (!producto) {
      Alert.alert('Falta producto', 'Selecciona un producto.');
      return;
    }

    if (!cantidad || cantidad <= 0) {
      Alert.alert('Cantidad inválida', 'Escribe una cantidad mayor a 0.');
      return;
    }

    setClasificacionPartidas((actual) => [
      ...actual,
      {
        id: `${Date.now()}_${Math.random()}`,
        productoId: producto.id,
        producto: producto.nombre,
        cantidad,
      },
    ]);

    setClasificacionCantidad('1');
  };

  const guardarClasificacionVenta = () => {
    if (!ventaAClasificar) return;

    const resultado = clasificarVentaLibre({
      ventaId: ventaAClasificar.id,
      partidas: clasificacionPartidas.map((item) => ({
        productoId: item.productoId,
        cantidad: item.cantidad,
      })),
    });

    if (!resultado?.ok) {
      Alert.alert(
        'No se pudo clasificar',
        resultado?.mensaje || 'Revisa la clasificación.'
      );
      return;
    }

    setModalClasificarVenta(false);
  };

  const intentarCostearPendiente = (venta) => {
    const resultado = costearVentaProductoPendiente(venta.id);

    if (!resultado?.ok) {
      Alert.alert(
        'Todavía no se puede costear',
        resultado?.mensaje || 'Revisa la receta y el inventario.'
      );
    }
  };

  const guardarGasto = () => {
    const resultado = agregarGasto({
      concepto: conceptoGasto,
      monto: montoGasto,
      categoria: categoriaGasto,
      tipo: tipoGasto,
      frecuencia: frecuenciaGasto,
      metodoPago: metodoGasto,
      fuenteDinero: fuenteGasto,
      pagadoDesde: fuenteGasto,
      pagadoPor: fuenteGasto === 'Aportación nueva' ? pagadoPorGasto : null,
      perteneceA:
        fuenteGasto === 'Aportación nueva'
          ? perteneceAGasto || pagadoPorGasto
          : null,
      pendienteAsignar: pendienteGasto,
      nota: notaGasto,
    });

    if (!resultado?.ok) {
      Alert.alert(
        'No se pudo registrar',
        resultado?.mensaje || 'Revisa el gasto.'
      );
      return;
    }

    setModalGasto(false);
    setConceptoGasto('');
    setMontoGasto('');
    setPagadoPorGasto('');
    setPerteneceAGasto('');
    setPendienteGasto(false);
    setNotaGasto('');
  };

  const abrirAsignarGasto = (gasto) => {
    setGastoAAsignar(gasto);
    setAsignacionGastoMonto('');
    setAsignacionGastoConcepto(gasto.concepto || '');
    setAsignacionGastoCategoria(gasto.categoria || 'Operación');
    setModalAsignarGasto(true);
  };

  const guardarAsignacionGasto = () => {
    if (!gastoAAsignar) return;

    const resultado = asignarGastoPendiente({
      gastoId: gastoAAsignar.id,
      montoAsignado: asignacionGastoMonto,
      concepto: asignacionGastoConcepto,
      categoria: asignacionGastoCategoria,
    });

    if (!resultado?.ok) {
      Alert.alert(
        'No se pudo asignar',
        resultado?.mensaje || 'Revisa los datos.'
      );
      return;
    }

    setModalAsignarGasto(false);
  };

  const guardarInversion = () => {
    const resultado = agregarInversion({
      concepto: conceptoInversion,
      monto: montoInversion,
      pagadoPor: pagadoPorInversion,
      perteneceA: perteneceAInversion || pagadoPorInversion,
      formaAportacion: formaInversion,
      metodoPago: metodoInversion,
      origen: 'Registro manual',
    });

    if (!resultado?.ok) {
      Alert.alert(
        'No se pudo registrar',
        resultado?.mensaje || 'Revisa la inversión.'
      );
      return;
    }

    setModalInversion(false);
    setConceptoInversion('');
    setMontoInversion('');
    setPagadoPorInversion('');
    setPerteneceAInversion('');
  };

  const guardarPagoInversion = () => {
    const resultado = pagarInversion({
      inversionista: inversionistaPago,
      monto: montoPagoInversion,
      metodoPago: metodoPagoInversion,
      desde: 'Casa Shamy',
    });

    if (!resultado?.ok) {
      Alert.alert(
        'No se pudo registrar',
        resultado?.mensaje || 'Revisa el pago.'
      );
      return;
    }

    setModalPagoInversion(false);
    setMontoPagoInversion('');
  };

  const guardarCredito = () => {
    const resultado = agregarCreditoProveedor({
      proveedor: proveedorCredito,
      concepto: conceptoCredito,
      monto: montoCredito,
      tipo: tipoCredito,
      categoriaGasto: categoriaCredito,
      fechaVencimiento: texto(vencimientoCredito) || null,
      plazoDias: texto(plazoCredito) || null,
      pendienteAsignar: true,
    });

    if (!resultado?.ok) {
      Alert.alert(
        'No se pudo registrar',
        resultado?.mensaje || 'Revisa el crédito.'
      );
      return;
    }

    setModalCredito(false);
    setProveedorCredito('');
    setConceptoCredito('');
    setMontoCredito('');
    setVencimientoCredito('');
    setPlazoCredito('');
  };

  const abrirPagoCredito = (credito) => {
    setCreditoAPagar(credito);
    setMontoPagoCredito('');
    setMetodoPagoCredito('Transferencia');
    setFuentePagoCredito('Casa Shamy');
    setPagadoPorCredito('');
    setPerteneceACredito('');
    setModalPagoCredito(true);
  };

  const guardarPagoCredito = () => {
    if (!creditoAPagar) return;

    const resultado = pagarCreditoProveedor({
      creditoId: creditoAPagar.id,
      monto: montoPagoCredito,
      metodoPago: metodoPagoCredito,
      fuenteDinero: fuentePagoCredito,
      pagadoPor:
        fuentePagoCredito === 'Aportación nueva'
          ? pagadoPorCredito
          : null,
      perteneceA:
        fuentePagoCredito === 'Aportación nueva'
          ? perteneceACredito || pagadoPorCredito
          : null,
    });

    if (!resultado?.ok) {
      Alert.alert(
        'No se pudo registrar',
        resultado?.mensaje || 'Revisa el pago.'
      );
      return;
    }

    setModalPagoCredito(false);
  };

  const confirmarCancelarVenta = (venta) => {
    Alert.alert(
      'Cancelar venta',
      'Se eliminará la venta y se revertirá el inventario si ya estaba costeada.',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Sí, cancelar',
          style: 'destructive',
          onPress: () => cancelarVenta(venta.id),
        },
      ]
    );
  };

  const confirmarCancelarGasto = (gasto) => {
    Alert.alert('Cancelar gasto', `¿Cancelar ${gasto.concepto}?`, [
      { text: 'No', style: 'cancel' },
      {
        text: 'Sí, cancelar',
        style: 'destructive',
        onPress: () => {
          const resultado = cancelarGasto(gasto.id);
          if (!resultado?.ok) {
            Alert.alert('No se puede cancelar', resultado?.mensaje || '');
          }
        },
      },
    ]);
  };

  const confirmarCancelarCredito = (credito) => {
    Alert.alert(
      'Cancelar crédito',
      `¿Cancelar el crédito de ${credito.proveedor}?`,
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Sí, cancelar',
          style: 'destructive',
          onPress: () => {
            const resultado = cancelarCreditoProveedor(credito.id);
            if (!resultado?.ok) {
              Alert.alert('No se puede cancelar', resultado?.mensaje || '');
            }
          },
        },
      ]
    );
  };

  const MenuInferior = () => (
    <View style={styles.menuInferior}>
      {['Inicio', 'Ventas', 'Gastos', 'Créditos'].map((item) => (
        <Pressable
          key={item}
          onPress={() => setPantalla(item)}
          style={[
            styles.menuItem,
            pantalla === item && styles.menuItemActivo,
          ]}
        >
          <Text
            style={[
              styles.menuTexto,
              pantalla === item && styles.menuTextoActivo,
            ]}
          >
            {item}
          </Text>
        </Pressable>
      ))}
    </View>
  );

  const pantallaInicio = (
    <>
      <TituloPantalla
        titulo="Casa Shamy"
        subtitulo="Administración · San Quintín"
      />

      <ScrollView contentContainerStyle={styles.contenido}>
        <Text style={styles.seccionTitulo}>Hoy</Text>

        <View style={styles.gridMetricas}>
          <TarjetaMetrica
            titulo="Ventas"
            valor={dinero(totalVentasHoy)}
            detalle={`${ventasHoy.length} movimientos`}
          />

          <TarjetaMetrica
            titulo="Utilidad conocida"
            valor={dinero(utilidadConocidaHoy)}
            detalle={
              ventasPendientes.length
                ? `${ventasPendientes.length} venta(s) pendiente(s)`
                : 'Todo costeado'
            }
          />

          <TarjetaMetrica
            titulo="Gastos"
            valor={dinero(totalGastosHoy)}
            detalle={`${gastosHoy.length} registros`}
          />

          <TarjetaMetrica
            titulo="Caja / flujo"
            valor={dinero(saldoCaja)}
            detalle={`${movimientosFlujo.length} movimientos`}
          />
        </View>

        <Text style={styles.seccionTitulo}>Negocio</Text>

        <View style={styles.gridMetricas}>
          <TarjetaMetrica
            titulo="Inventario conocido"
            valor={dinero(valorInventario)}
            detalle={
              comprasPendientes.length
                ? `${comprasPendientes.length} compra(s) por asignar`
                : 'Sin compras pendientes'
            }
          />

          <TarjetaMetrica
            titulo="Crédito proveedores"
            valor={dinero(totalCreditoPendiente)}
            detalle={`${resumenCreditos.filter((c) => c.saldo > 0).length} cuenta(s) abierta(s)`}
          />
        </View>

        {(ventasPendientes.length > 0 ||
          gastosPendientes.length > 0 ||
          comprasPendientes.length > 0) && (
          <View style={styles.avisoCard}>
            <Text style={styles.avisoTitulo}>Pendientes por completar</Text>
            <Text style={styles.avisoTexto}>
              Ventas: {ventasPendientes.length} · Gastos: {gastosPendientes.length} · Compras: {comprasPendientes.length}
            </Text>
          </View>
        )}

        <Text style={styles.seccionTitulo}>Accesos rápidos</Text>

        <View style={styles.accionesGrid}>
          <Boton titulo="Nueva venta" onPress={abrirVentaProducto} />
          <Boton titulo="Venta libre" tipo="secundario" onPress={() => setModalVentaLibre(true)} />
          <Boton titulo="Nuevo gasto" onPress={() => setModalGasto(true)} />
          <Boton titulo="Inventario" tipo="secundario" onPress={() => setPantalla('Inventario')} />
          <Boton titulo="Productos / recetas" tipo="secundario" onPress={() => setPantalla('Productos')} />
          <Boton titulo="Reportes" tipo="secundario" onPress={() => setPantalla('Reportes')} />
          <Boton titulo="Inversiones" tipo="suave" onPress={() => setPantalla('Inversiones')} />
          <Boton titulo="Créditos" tipo="suave" onPress={() => setPantalla('Créditos')} />
        </View>
      </ScrollView>
    </>
  );

  const pantallaVentas = (
    <>
      <TituloPantalla
        titulo="Ventas"
        subtitulo="Ventas normales y pendientes de costeo"
      />

      <ScrollView contentContainerStyle={styles.contenido}>
        <View style={styles.filaBotones}>
          <Boton titulo="+ Producto" onPress={abrirVentaProducto} />
          <Boton titulo="+ Venta libre" tipo="secundario" onPress={() => setModalVentaLibre(true)} />
        </View>

        {ventas.length === 0 ? (
          <View style={styles.vacio}>
            <Text style={styles.vacioTitulo}>Todavía no hay ventas</Text>
          </View>
        ) : (
          ventas.map((venta) => {
            const pendiente =
              venta.pendienteClasificar || venta.pendienteCostear;

            return (
              <View style={styles.card} key={venta.id}>
                <View style={styles.cardCabecera}>
                  <View style={styles.flex1}>
                    <Text style={styles.cardTitulo}>
                      {venta.producto || venta.concepto || 'Venta'}
                    </Text>
                    <Text style={styles.cardMeta}>
                      {venta.fecha} · {venta.hora || ''} · {venta.metodoPago || ''}
                    </Text>
                  </View>
                  <Text style={styles.cardImporte}>{dinero(venta.monto)}</Text>
                </View>

                <View style={styles.estadoFila}>
                  <View
                    style={[
                      styles.badge,
                      pendiente ? styles.badgePendiente : styles.badgeOk,
                    ]}
                  >
                    <Text style={styles.badgeTexto}>
                      {pendiente ? 'Pendiente de costeo' : 'Costeada'}
                    </Text>
                  </View>

                  <Text style={styles.cardMeta}>
                    Costo:{' '}
                    {venta.costoTotal === null || venta.costoTotal === undefined
                      ? 'Pendiente'
                      : dinero(venta.costoTotal)}
                  </Text>
                </View>

                <View style={styles.botonesCard}>
                  {pendiente && venta.productoId ? (
                    <Boton
                      titulo="Costear ahora"
                      compacto
                      onPress={() => intentarCostearPendiente(venta)}
                    />
                  ) : null}

                  {pendiente && !venta.productoId ? (
                    <Boton
                      titulo="Clasificar"
                      compacto
                      onPress={() => abrirClasificarVenta(venta)}
                    />
                  ) : null}

                  <Boton
                    titulo="Cancelar"
                    tipo="peligro"
                    compacto
                    onPress={() => confirmarCancelarVenta(venta)}
                  />
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </>
  );

  const pantallaGastos = (
    <>
      <TituloPantalla
        titulo="Gastos"
        subtitulo="Gastos operativos y pendientes de asignar"
      />

      <ScrollView contentContainerStyle={styles.contenido}>
        <Boton titulo="+ Nuevo gasto" onPress={() => setModalGasto(true)} />

        <View style={styles.espacio12} />

        {gastos.length === 0 ? (
          <View style={styles.vacio}>
            <Text style={styles.vacioTitulo}>Todavía no hay gastos</Text>
          </View>
        ) : (
          gastos.map((gasto) => (
            <View style={styles.card} key={gasto.id}>
              <View style={styles.cardCabecera}>
                <View style={styles.flex1}>
                  <Text style={styles.cardTitulo}>{gasto.concepto}</Text>
                  <Text style={styles.cardMeta}>
                    {gasto.categoria} · {gasto.tipo} · {gasto.fecha}
                  </Text>
                </View>
                <Text style={styles.cardImporte}>{dinero(gasto.monto)}</Text>
              </View>

              <Text style={styles.cardMeta}>
                Pagado desde: {gasto.fuenteDinero || gasto.pagadoDesde || 'Casa Shamy'}
              </Text>

              {gasto.pendienteAsignar ? (
                <View style={styles.avisoMini}>
                  <Text style={styles.avisoMiniTexto}>
                    Asignado: {dinero(gasto.montoClasificado)} · Pendiente: {dinero(gasto.montoPendiente)}
                  </Text>
                </View>
              ) : null}

              <View style={styles.botonesCard}>
                {gasto.pendienteAsignar ? (
                  <Boton
                    titulo="Asignar"
                    compacto
                    onPress={() => abrirAsignarGasto(gasto)}
                  />
                ) : null}

                <Boton
                  titulo="Cancelar"
                  tipo="peligro"
                  compacto
                  onPress={() => confirmarCancelarGasto(gasto)}
                />
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </>
  );

  const pantallaCreditos = (
    <>
      <TituloPantalla
        titulo="Créditos"
        subtitulo="Cuentas por pagar a proveedores"
      />

      <ScrollView contentContainerStyle={styles.contenido}>
        <Boton titulo="+ Nuevo crédito" onPress={() => setModalCredito(true)} />
        <View style={styles.espacio12} />

        {resumenCreditos.length === 0 ? (
          <View style={styles.vacio}>
            <Text style={styles.vacioTitulo}>No hay créditos registrados</Text>
          </View>
        ) : (
          resumenCreditos.map((credito) => (
            <View style={styles.card} key={credito.id}>
              <View style={styles.cardCabecera}>
                <View style={styles.flex1}>
                  <Text style={styles.cardTitulo}>{credito.proveedor}</Text>
                  <Text style={styles.cardMeta}>
                    {credito.concepto} · {credito.tipo}
                  </Text>
                </View>
                <Text style={styles.cardImporte}>{dinero(credito.saldo)}</Text>
              </View>

              <View style={styles.estadoFila}>
                <View
                  style={[
                    styles.badge,
                    credito.estado === 'Pagado'
                      ? styles.badgeOk
                      : credito.estado === 'Vencido'
                      ? styles.badgeVencido
                      : styles.badgePendiente,
                  ]}
                >
                  <Text style={styles.badgeTexto}>{credito.estado}</Text>
                </View>

                <Text style={styles.cardMeta}>
                  Original: {dinero(credito.montoOriginal)} · Pagado: {dinero(credito.pagado)}
                </Text>
              </View>

              {credito.fechaVencimiento ? (
                <Text style={styles.cardMeta}>
                  Vence: {credito.fechaVencimiento}
                </Text>
              ) : null}

              <View style={styles.botonesCard}>
                {credito.saldo > 0.0001 ? (
                  <Boton
                    titulo="Registrar pago"
                    compacto
                    onPress={() => abrirPagoCredito(credito)}
                  />
                ) : null}

                <Boton
                  titulo="Cancelar crédito"
                  tipo="peligro"
                  compacto
                  onPress={() => confirmarCancelarCredito(credito)}
                />
              </View>

              {(credito.pagos || []).map((pago) => (
                <View key={pago.id} style={styles.pagoFila}>
                  <Text style={styles.pagoTexto}>
                    Pago {pago.fecha}: {dinero(pago.monto)} · {pago.fuenteDinero}
                  </Text>
                  <Pressable
                    onPress={() => {
                      const resultado = cancelarPagoCredito(pago.id);
                      if (!resultado?.ok) {
                        Alert.alert('No se pudo cancelar', resultado?.mensaje || '');
                      }
                    }}
                  >
                    <Text style={styles.linkPeligro}>Cancelar</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          ))
        )}
      </ScrollView>
    </>
  );

  const pantallaInversiones = (
    <>
      <TituloPantalla
        titulo="Inversiones"
        subtitulo="Aportaciones de socios y recuperación"
        volver={() => setPantalla('Inicio')}
      />

      <ScrollView contentContainerStyle={styles.contenido}>
        <View style={styles.filaBotones}>
          <Boton titulo="+ Inversión" onPress={() => setModalInversion(true)} />
          <Boton
            titulo="Pagar inversión"
            tipo="secundario"
            disabled={resumenInversionistas.length === 0}
            onPress={() => {
              setInversionistaPago(resumenInversionistas[0]?.nombre || '');
              setModalPagoInversion(true);
            }}
          />
        </View>

        <View style={styles.espacio12} />

        {resumenInversionistas.length === 0 ? (
          <View style={styles.vacio}>
            <Text style={styles.vacioTitulo}>No hay inversiones registradas</Text>
          </View>
        ) : (
          resumenInversionistas.map((item) => (
            <View key={item.nombre} style={styles.card}>
              <Text style={styles.cardTitulo}>{item.nombre}</Text>
              <Text style={styles.cardMeta}>Aportado: {dinero(item.aportado)}</Text>
              <Text style={styles.cardMeta}>Recuperado: {dinero(item.recuperado)}</Text>
              <Text style={styles.cardImporte}>Pendiente: {dinero(item.pendiente)}</Text>
            </View>
          ))
        )}

        {inversiones.length > 0 ? (
          <>
            <Text style={styles.seccionTitulo}>Historial de aportaciones</Text>
            {inversiones.slice(0, 20).map((inv) => (
              <View key={inv.id} style={styles.cardSimple}>
                <Text style={styles.cardTitulo}>{inv.concepto}</Text>
                <Text style={styles.cardMeta}>
                  {inv.perteneceA || inv.pagadoPor} · {dinero(inv.monto)} · {inv.fecha}
                </Text>
              </View>
            ))}
          </>
        ) : null}

        {pagosInversion.length > 0 ? (
          <Text style={styles.cardMeta}>
            Pagos de inversión registrados: {pagosInversion.length}
          </Text>
        ) : null}
      </ScrollView>
    </>
  );

  let contenidoPantalla = pantallaInicio;
  if (pantalla === 'Ventas') contenidoPantalla = pantallaVentas;
  if (pantalla === 'Gastos') contenidoPantalla = pantallaGastos;
  if (pantalla === 'Créditos') contenidoPantalla = pantallaCreditos;
  if (pantalla === 'Inversiones') contenidoPantalla = pantallaInversiones;

  return (
    <SafeAreaView style={styles.pantalla}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.flex1}>{contenidoPantalla}</View>

      {pantalla !== 'Inversiones' ? <MenuInferior /> : null}

      <ModalBase
        visible={modalVentaProducto}
        titulo="Nueva venta de producto"
        onCerrar={() => setModalVentaProducto(false)}
      >
        <Text style={styles.campoEtiqueta}>Producto</Text>
        <View style={styles.chipsWrap}>
          {productos.length === 0 ? (
            <Text style={styles.ayudaTexto}>
              No hay productos. Créelos primero en Productos / recetas.
            </Text>
          ) : (
            productos.map((producto) => (
              <Chip
                key={producto.id}
                titulo={`${producto.nombre} · ${dinero(producto.precio)}`}
                activo={ventaProductoId === producto.id}
                onPress={() => setVentaProductoId(producto.id)}
              />
            ))
          )}
        </View>

        <Campo
          etiqueta="Cantidad"
          value={ventaCantidad}
          onChangeText={setVentaCantidad}
          keyboardType="decimal-pad"
        />

        <Text style={styles.campoEtiqueta}>Método de pago</Text>
        <View style={styles.chipsWrap}>
          {['Efectivo', 'Tarjeta', 'Transferencia'].map((item) => (
            <Chip
              key={item}
              titulo={item}
              activo={ventaMetodo === item}
              onPress={() => setVentaMetodo(item)}
            />
          ))}
        </View>

        <Campo
          etiqueta="Nota"
          value={ventaNota}
          onChangeText={setVentaNota}
          placeholder="Opcional"
        />

        <Boton
          titulo="Registrar venta"
          disabled={productos.length === 0}
          onPress={guardarVentaProducto}
        />
      </ModalBase>

      <ModalBase
        visible={modalVentaLibre}
        titulo="Venta libre"
        onCerrar={() => setModalVentaLibre(false)}
      >
        <Text style={styles.ayudaTexto}>
          La venta entra a ingresos ahora y queda pendiente de clasificar/costear. No se inventará un costo aproximado.
        </Text>

        <Campo
          etiqueta="Concepto"
          value={ventaLibreConcepto}
          onChangeText={setVentaLibreConcepto}
          placeholder="Ej. Venta mostrador"
        />

        <Campo
          etiqueta="Total vendido"
          value={ventaLibreMonto}
          onChangeText={setVentaLibreMonto}
          keyboardType="decimal-pad"
          placeholder="0.00"
        />

        <Text style={styles.campoEtiqueta}>Método de pago</Text>
        <View style={styles.chipsWrap}>
          {['Efectivo', 'Tarjeta', 'Transferencia'].map((item) => (
            <Chip
              key={item}
              titulo={item}
              activo={ventaLibreMetodo === item}
              onPress={() => setVentaLibreMetodo(item)}
            />
          ))}
        </View>

        <Campo
          etiqueta="Nota"
          value={ventaLibreNota}
          onChangeText={setVentaLibreNota}
          placeholder="Opcional"
        />

        <Boton titulo="Registrar venta libre" onPress={guardarVentaLibre} />
      </ModalBase>

      <ModalBase
        visible={modalClasificarVenta}
        titulo="Clasificar venta"
        onCerrar={() => setModalClasificarVenta(false)}
      >
        {ventaAClasificar ? (
          <View style={styles.resumenModal}>
            <Text style={styles.cardTitulo}>{ventaAClasificar.concepto}</Text>
            <Text style={styles.cardImporte}>{dinero(ventaAClasificar.monto)}</Text>
          </View>
        ) : null}

        <Text style={styles.campoEtiqueta}>Producto</Text>
        <View style={styles.chipsWrap}>
          {productos.map((producto) => (
            <Chip
              key={producto.id}
              titulo={producto.nombre}
              activo={clasificacionProductoId === producto.id}
              onPress={() => setClasificacionProductoId(producto.id)}
            />
          ))}
        </View>

        <Campo
          etiqueta="Cantidad"
          value={clasificacionCantidad}
          onChangeText={setClasificacionCantidad}
          keyboardType="decimal-pad"
        />

        <Boton
          titulo="Agregar producto"
          tipo="secundario"
          onPress={agregarPartidaClasificacion}
        />

        <View style={styles.espacio12} />

        {clasificacionPartidas.map((partida) => (
          <View key={partida.id} style={styles.pagoFila}>
            <Text style={styles.pagoTexto}>
              {partida.producto} × {partida.cantidad}
            </Text>
            <Pressable
              onPress={() =>
                setClasificacionPartidas((actual) =>
                  actual.filter((item) => item.id !== partida.id)
                )
              }
            >
              <Text style={styles.linkPeligro}>Quitar</Text>
            </Pressable>
          </View>
        ))}

        <Boton
          titulo="Guardar clasificación"
          disabled={clasificacionPartidas.length === 0}
          onPress={guardarClasificacionVenta}
        />
      </ModalBase>

      <ModalBase
        visible={modalGasto}
        titulo="Nuevo gasto"
        onCerrar={() => setModalGasto(false)}
      >
        <Campo
          etiqueta="Concepto"
          value={conceptoGasto}
          onChangeText={setConceptoGasto}
          placeholder="Ej. Gas, nómina, limpieza"
        />

        <Campo
          etiqueta="Monto"
          value={montoGasto}
          onChangeText={setMontoGasto}
          keyboardType="decimal-pad"
          placeholder="0.00"
        />

        <Campo
          etiqueta="Categoría"
          value={categoriaGasto}
          onChangeText={setCategoriaGasto}
        />

        <Text style={styles.campoEtiqueta}>Tipo</Text>
        <View style={styles.chipsWrap}>
          {['Variable', 'Fijo'].map((item) => (
            <Chip
              key={item}
              titulo={item}
              activo={tipoGasto === item}
              onPress={() => setTipoGasto(item)}
            />
          ))}
        </View>

        <Campo
          etiqueta="Frecuencia"
          value={frecuenciaGasto}
          onChangeText={setFrecuenciaGasto}
        />

        <Text style={styles.campoEtiqueta}>Método de pago</Text>
        <View style={styles.chipsWrap}>
          {['Efectivo', 'Tarjeta', 'Transferencia'].map((item) => (
            <Chip
              key={item}
              titulo={item}
              activo={metodoGasto === item}
              onPress={() => setMetodoGasto(item)}
            />
          ))}
        </View>

        <Text style={styles.campoEtiqueta}>¿De dónde salió el dinero?</Text>
        <View style={styles.chipsWrap}>
          {['Casa Shamy', 'Aportación nueva'].map((item) => (
            <Chip
              key={item}
              titulo={item}
              activo={fuenteGasto === item}
              onPress={() => setFuenteGasto(item)}
            />
          ))}
        </View>

        {fuenteGasto === 'Aportación nueva' ? (
          <>
            <Campo
              etiqueta="Pagado por"
              value={pagadoPorGasto}
              onChangeText={setPagadoPorGasto}
              placeholder="Nombre de la persona"
            />

            <Campo
              etiqueta="La inversión pertenece a"
              value={perteneceAGasto}
              onChangeText={setPerteneceAGasto}
              placeholder="Si se deja vacío, usa Pagado por"
            />
          </>
        ) : null}

        <Text style={styles.campoEtiqueta}>Clasificación del gasto</Text>
        <View style={styles.chipsWrap}>
          <Chip
            titulo="Ya clasificado"
            activo={!pendienteGasto}
            onPress={() => setPendienteGasto(false)}
          />
          <Chip
            titulo="Pendiente de asignar"
            activo={pendienteGasto}
            onPress={() => setPendienteGasto(true)}
          />
        </View>

        <Campo
          etiqueta="Nota"
          value={notaGasto}
          onChangeText={setNotaGasto}
          placeholder="Opcional"
        />

        <Boton titulo="Registrar gasto" onPress={guardarGasto} />
      </ModalBase>

      <ModalBase
        visible={modalAsignarGasto}
        titulo="Asignar gasto pendiente"
        onCerrar={() => setModalAsignarGasto(false)}
      >
        {gastoAAsignar ? (
          <Text style={styles.ayudaTexto}>
            Saldo pendiente: {dinero(gastoAAsignar.montoPendiente)}
          </Text>
        ) : null}

        <Campo
          etiqueta="Monto a asignar"
          value={asignacionGastoMonto}
          onChangeText={setAsignacionGastoMonto}
          keyboardType="decimal-pad"
        />

        <Campo
          etiqueta="Concepto"
          value={asignacionGastoConcepto}
          onChangeText={setAsignacionGastoConcepto}
        />

        <Campo
          etiqueta="Categoría"
          value={asignacionGastoCategoria}
          onChangeText={setAsignacionGastoCategoria}
        />

        <Boton titulo="Asignar" onPress={guardarAsignacionGasto} />
      </ModalBase>

      <ModalBase
        visible={modalInversion}
        titulo="Nueva inversión"
        onCerrar={() => setModalInversion(false)}
      >
        <Campo
          etiqueta="Concepto"
          value={conceptoInversion}
          onChangeText={setConceptoInversion}
          placeholder="Ej. Aportación inicial"
        />

        <Campo
          etiqueta="Monto"
          value={montoInversion}
          onChangeText={setMontoInversion}
          keyboardType="decimal-pad"
        />

        <Campo
          etiqueta="Pagado por"
          value={pagadoPorInversion}
          onChangeText={setPagadoPorInversion}
        />

        <Campo
          etiqueta="La inversión pertenece a"
          value={perteneceAInversion}
          onChangeText={setPerteneceAInversion}
          placeholder="Si se deja vacío, usa Pagado por"
        />

        <Text style={styles.campoEtiqueta}>Forma de aportación</Text>
        <View style={styles.chipsWrap}>
          {['Efectivo a Casa Shamy', 'Pago directo'].map((item) => (
            <Chip
              key={item}
              titulo={item}
              activo={formaInversion === item}
              onPress={() => setFormaInversion(item)}
            />
          ))}
        </View>

        <Text style={styles.campoEtiqueta}>Método de pago</Text>
        <View style={styles.chipsWrap}>
          {['Efectivo', 'Transferencia', 'Tarjeta'].map((item) => (
            <Chip
              key={item}
              titulo={item}
              activo={metodoInversion === item}
              onPress={() => setMetodoInversion(item)}
            />
          ))}
        </View>

        <Boton titulo="Registrar inversión" onPress={guardarInversion} />
      </ModalBase>

      <ModalBase
        visible={modalPagoInversion}
        titulo="Pagar inversión"
        onCerrar={() => setModalPagoInversion(false)}
      >
        <Text style={styles.campoEtiqueta}>Inversionista</Text>
        <View style={styles.chipsWrap}>
          {resumenInversionistas.map((item) => (
            <Chip
              key={item.nombre}
              titulo={`${item.nombre} · ${dinero(item.pendiente)}`}
              activo={inversionistaPago === item.nombre}
              onPress={() => setInversionistaPago(item.nombre)}
            />
          ))}
        </View>

        <Campo
          etiqueta="Monto a pagar"
          value={montoPagoInversion}
          onChangeText={setMontoPagoInversion}
          keyboardType="decimal-pad"
        />

        <Text style={styles.campoEtiqueta}>Método de pago</Text>
        <View style={styles.chipsWrap}>
          {['Efectivo', 'Transferencia', 'Tarjeta'].map((item) => (
            <Chip
              key={item}
              titulo={item}
              activo={metodoPagoInversion === item}
              onPress={() => setMetodoPagoInversion(item)}
            />
          ))}
        </View>

        <Boton titulo="Registrar pago" onPress={guardarPagoInversion} />
      </ModalBase>

      <ModalBase
        visible={modalCredito}
        titulo="Nuevo crédito con proveedor"
        onCerrar={() => setModalCredito(false)}
      >
        <Campo
          etiqueta="Proveedor"
          value={proveedorCredito}
          onChangeText={setProveedorCredito}
        />

        <Campo
          etiqueta="Concepto / factura"
          value={conceptoCredito}
          onChangeText={setConceptoCredito}
        />

        <Campo
          etiqueta="Monto original"
          value={montoCredito}
          onChangeText={setMontoCredito}
          keyboardType="decimal-pad"
        />

        <Text style={styles.campoEtiqueta}>Tipo</Text>
        <View style={styles.chipsWrap}>
          {['Inventario', 'Gasto'].map((item) => (
            <Chip
              key={item}
              titulo={item}
              activo={tipoCredito === item}
              onPress={() => setTipoCredito(item)}
            />
          ))}
        </View>

        {tipoCredito === 'Gasto' ? (
          <Campo
            etiqueta="Categoría del gasto"
            value={categoriaCredito}
            onChangeText={setCategoriaCredito}
          />
        ) : null}

        <Campo
          etiqueta="Fecha de vencimiento"
          value={vencimientoCredito}
          onChangeText={setVencimientoCredito}
          placeholder="AAAA-MM-DD (opcional)"
        />

        <Campo
          etiqueta="Plazo en días"
          value={plazoCredito}
          onChangeText={setPlazoCredito}
          keyboardType="number-pad"
          placeholder="Opcional si ya pusiste fecha"
        />

        <Boton titulo="Registrar crédito" onPress={guardarCredito} />
      </ModalBase>

      <ModalBase
        visible={modalPagoCredito}
        titulo="Pago a proveedor"
        onCerrar={() => setModalPagoCredito(false)}
      >
        {creditoAPagar ? (
          <View style={styles.resumenModal}>
            <Text style={styles.cardTitulo}>{creditoAPagar.proveedor}</Text>
            <Text style={styles.ayudaTexto}>
              Saldo pendiente: {dinero(creditoAPagar.saldo)}
            </Text>
          </View>
        ) : null}

        <Campo
          etiqueta="Monto del pago"
          value={montoPagoCredito}
          onChangeText={setMontoPagoCredito}
          keyboardType="decimal-pad"
        />

        <Text style={styles.campoEtiqueta}>Método de pago</Text>
        <View style={styles.chipsWrap}>
          {['Efectivo', 'Transferencia', 'Tarjeta'].map((item) => (
            <Chip
              key={item}
              titulo={item}
              activo={metodoPagoCredito === item}
              onPress={() => setMetodoPagoCredito(item)}
            />
          ))}
        </View>

        <Text style={styles.campoEtiqueta}>¿Quién paga?</Text>
        <View style={styles.chipsWrap}>
          {['Casa Shamy', 'Aportación nueva'].map((item) => (
            <Chip
              key={item}
              titulo={item}
              activo={fuentePagoCredito === item}
              onPress={() => setFuentePagoCredito(item)}
            />
          ))}
        </View>

        {fuentePagoCredito === 'Aportación nueva' ? (
          <>
            <Campo
              etiqueta="Pagado por"
              value={pagadoPorCredito}
              onChangeText={setPagadoPorCredito}
            />

            <Campo
              etiqueta="La inversión pertenece a"
              value={perteneceACredito}
              onChangeText={setPerteneceACredito}
            />
          </>
        ) : null}

        <Boton titulo="Registrar pago" onPress={guardarPagoCredito} />
      </ModalBase>
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <DatosNegocioProvider>
      <CasaShamyApp />
    </DatosNegocioProvider>
  );
}

const styles = StyleSheet.create({
  pantalla: {
    flex: 1,
    backgroundColor: '#F6F7F6',
  },

  flex1: {
    flex: 1,
  },

  cargandoPantalla: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F6F7F6',
  },

  cargandoTitulo: {
    fontSize: 28,
    fontWeight: '800',
    color: '#263832',
  },

  cargandoTexto: {
    marginTop: 8,
    color: '#77817D',
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 13,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E8E6',
  },

  titulo: {
    fontSize: 24,
    fontWeight: '800',
    color: '#22322D',
  },

  subtitulo: {
    marginTop: 3,
    fontSize: 13,
    color: '#75807C',
  },

  contenido: {
    padding: 16,
    paddingBottom: 100,
  },

  seccionTitulo: {
    fontSize: 15,
    fontWeight: '800',
    color: '#2A3733',
    marginTop: 6,
    marginBottom: 10,
  },

  gridMetricas: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 14,
  },

  metricaCard: {
    width: '48%',
    minHeight: 105,
    backgroundColor: '#FFFFFF',
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#E4E8E6',
    padding: 13,
  },

  metricaTitulo: {
    color: '#75807C',
    fontSize: 12,
    fontWeight: '700',
  },

  metricaValor: {
    color: '#244B40',
    fontSize: 20,
    fontWeight: '800',
    marginTop: 7,
  },

  metricaDetalle: {
    color: '#89928F',
    fontSize: 11,
    marginTop: 5,
  },

  accionesGrid: {
    gap: 9,
  },

  filaBotones: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 9,
  },

  boton: {
    minHeight: 44,
    borderRadius: 11,
    paddingHorizontal: 15,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2E5A4F',
  },

  botonCompacto: {
    minHeight: 37,
    paddingVertical: 7,
    paddingHorizontal: 11,
  },

  botonSecundario: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD3D0',
  },

  botonSuave: {
    backgroundColor: '#EAF0ED',
  },

  botonPeligro: {
    backgroundColor: '#FFF1EF',
    borderWidth: 1,
    borderColor: '#F0C9C3',
  },

  botonDeshabilitado: {
    opacity: 0.45,
  },

  botonTexto: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },

  botonTextoOscuro: {
    color: '#33413C',
  },

  botonTextoPeligro: {
    color: '#A34437',
  },

  presionado: {
    opacity: 0.7,
  },

  avisoCard: {
    backgroundColor: '#FFF3D9',
    borderRadius: 14,
    padding: 13,
    marginBottom: 15,
  },

  avisoTitulo: {
    color: '#644B17',
    fontSize: 14,
    fontWeight: '800',
  },

  avisoTexto: {
    color: '#775D27',
    marginTop: 4,
    fontSize: 12,
  },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#E3E7E5',
    padding: 14,
    marginBottom: 11,
  },

  cardSimple: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E8E7',
    padding: 12,
    marginBottom: 8,
  },

  cardCabecera: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },

  cardTitulo: {
    color: '#26332F',
    fontSize: 16,
    fontWeight: '800',
  },

  cardMeta: {
    color: '#747F7B',
    fontSize: 12,
    marginTop: 4,
  },

  cardImporte: {
    color: '#2E5A4F',
    fontWeight: '800',
    fontSize: 16,
  },

  estadoFila: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    marginTop: 11,
  },

  badge: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 9,
  },

  badgePendiente: {
    backgroundColor: '#FFF1CF',
  },

  badgeOk: {
    backgroundColor: '#DBEEE7',
  },

  badgeVencido: {
    backgroundColor: '#FCE1DD',
  },

  badgeTexto: {
    color: '#38443F',
    fontSize: 11,
    fontWeight: '800',
  },

  botonesCard: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    marginTop: 12,
  },

  avisoMini: {
    marginTop: 10,
    padding: 9,
    borderRadius: 10,
    backgroundColor: '#FFF5DF',
  },

  avisoMiniTexto: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6E5724',
  },

  vacio: {
    backgroundColor: '#FFFFFF',
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#E4E7E6',
    padding: 24,
    alignItems: 'center',
  },

  vacioTitulo: {
    color: '#39443F',
    fontSize: 15,
    fontWeight: '800',
  },

  espacio12: {
    height: 12,
  },

  menuInferior: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 8,
    paddingTop: 7,
    paddingBottom: Platform.OS === 'ios' ? 10 : 8,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E1E5E3',
  },

  menuItem: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },

  menuItemActivo: {
    backgroundColor: '#E7EFEC',
  },

  menuTexto: {
    color: '#7A8480',
    fontSize: 11,
    fontWeight: '700',
  },

  menuTextoActivo: {
    color: '#285347',
    fontWeight: '800',
  },

  modalFondo: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },

  modalCaja: {
    maxHeight: '92%',
    backgroundColor: '#F8F9F8',
    borderTopLeftRadius: 23,
    borderTopRightRadius: 23,
    overflow: 'hidden',
  },

  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 15,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E3E7E5',
  },

  modalTitulo: {
    flex: 1,
    fontSize: 18,
    fontWeight: '800',
    color: '#27342F',
  },

  cerrar: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEF1F0',
    borderRadius: 18,
  },

  cerrarTexto: {
    color: '#42504B',
    fontSize: 17,
    fontWeight: '800',
  },

  modalContenido: {
    padding: 18,
    paddingBottom: 35,
  },

  campoGrupo: {
    marginBottom: 12,
  },

  campoEtiqueta: {
    color: '#43504B',
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 6,
    marginTop: 5,
  },

  input: {
    minHeight: 46,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: '#D4DAD7',
    backgroundColor: '#FFFFFF',
    color: '#222C28',
    fontSize: 15,
    paddingHorizontal: 12,
  },

  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    marginBottom: 12,
  },

  chip: {
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#DDE2DF',
    backgroundColor: '#F0F2F1',
  },

  chipActivo: {
    backgroundColor: '#2E5A4F',
    borderColor: '#2E5A4F',
  },

  chipTexto: {
    color: '#45524D',
    fontSize: 12,
    fontWeight: '700',
  },

  chipTextoActivo: {
    color: '#FFFFFF',
  },

  ayudaTexto: {
    color: '#6F7975',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 12,
  },

  resumenModal: {
    backgroundColor: '#EEF3F1',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },

  pagoFila: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#EDF0EE',
  },

  pagoTexto: {
    flex: 1,
    color: '#59645F',
    fontSize: 12,
  },

  linkPeligro: {
    color: '#A9483A',
    fontSize: 12,
    fontWeight: '800',
  },
});
