import React, { useMemo, useState } from 'react';
import {
  Alert,
  Image,
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
  peligro: '#A3453B',
  aviso: '#9A6B22',
  ok: '#3F7452',
};

const numero = (v) => {
  const n = Number(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};

const dinero = (v) =>
  `$${numero(v).toLocaleString('es-MX', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const uid = (p = 'TMP') => `${p}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

function Boton({ titulo, onPress, tipo = 'principal', disabled = false, compacto = false }) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.boton,
        tipo === 'secundario' && styles.botonSecundario,
        tipo === 'suave' && styles.botonSuave,
        tipo === 'peligro' && styles.botonPeligro,
        compacto && styles.botonCompacto,
        disabled && styles.disabled,
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

function Chip({ label, activo, onPress, disabled = false, detalle = '' }) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        activo && styles.chipActivo,
        disabled && styles.disabled,
        pressed && !disabled && { opacity: 0.75 },
      ]}
    >
      <Text style={[styles.chipTexto, activo && styles.chipTextoActivo]}>{label}</Text>
      {!!detalle && <Text style={[styles.chipDetalle, activo && styles.chipTextoActivo]}>{detalle}</Text>}
    </Pressable>
  );
}

function ModalBase({ visible, titulo, onCerrar, children, alto = '92%' }) {
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
              <Text style={styles.cerrarTxt}>✕</Text>
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

function iconoProducto(producto) {
  if (producto?.tipoProducto === 'Bebida configurable') return '☕';
  if (producto?.tipoProducto === 'Arma el tuyo') return '🥗';
  const c = String(producto?.categoria || '').toLowerCase();
  if (c.includes('pizza')) return '🍕';
  if (c.includes('postre')) return '🍰';
  if (c.includes('sand') || c.includes('bagu')) return '🥪';
  return '🍽️';
}

function ProductoCard({ producto, onPress }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.productoCard, pressed && { opacity: 0.78 }]}>
      <View style={styles.productoImagenCaja}>
        {producto.imagenUri ? (
          <Image source={{ uri: producto.imagenUri }} style={styles.productoImagen} resizeMode="cover" />
        ) : (
          <Text style={styles.productoEmoji}>{iconoProducto(producto)}</Text>
        )}
      </View>
      <Text style={styles.productoNombre} numberOfLines={2}>{producto.nombre}</Text>
      <Text style={styles.productoMeta}>{producto.tipoProducto || 'Fijo'}</Text>
      <Text style={styles.productoPrecio}>{dinero(producto.precio)}</Text>
    </Pressable>
  );
}

export default function VentasPOS({ onVolver }) {
  const {
    productos,
    insumos,
    ventas,
    registrarVentaCarrito,
    registrarVentaLibre,
    resolverRecetaPartidaV2,
    resolverValoresOpcionV2,
    precioPartidaV2,
    cancelarVenta,
    costearVentaProductoPendiente,
  } = useNegocio();

  const [vista, setVista] = useState('Vender');
  const [buscar, setBuscar] = useState('');
  const [categoria, setCategoria] = useState('Todos');
  const [carrito, setCarrito] = useState([]);

  const [modalProducto, setModalProducto] = useState(false);
  const [productoActual, setProductoActual] = useState(null);
  const [draft, setDraft] = useState(null);
  const [editandoId, setEditandoId] = useState(null);
  const [verPreparacion, setVerPreparacion] = useState(false);

  const [modalCarrito, setModalCarrito] = useState(false);
  const [metodoPago, setMetodoPago] = useState('Efectivo');
  const [notaTicket, setNotaTicket] = useState('');

  const [modalVentaLibre, setModalVentaLibre] = useState(false);
  const [libreConcepto, setLibreConcepto] = useState('');
  const [libreMonto, setLibreMonto] = useState('');
  const [libreMetodo, setLibreMetodo] = useState('Efectivo');
  const [libreNota, setLibreNota] = useState('');

  const activos = useMemo(
    () => productos.filter((p) => p.activo !== false),
    [productos]
  );

  const categorias = useMemo(() => {
    const lista = [...new Set(activos.map((p) => p.categoria || 'General'))].sort((a, b) =>
      String(a).localeCompare(String(b), 'es')
    );
    return ['Todos', ...lista];
  }, [activos]);

  const productosVisibles = useMemo(() => {
    const q = buscar.toLowerCase().trim();
    return activos
      .filter((p) => categoria === 'Todos' || (p.categoria || 'General') === categoria)
      .filter((p) => !q || `${p.nombre} ${p.categoria || ''}`.toLowerCase().includes(q))
      .sort((a, b) => String(a.nombre).localeCompare(String(b.nombre), 'es'));
  }, [activos, categoria, buscar]);

  const totalCarrito = carrito.reduce((sum, p) => sum + numero(p.subtotal), 0);
  const articulosCarrito = carrito.reduce((sum, p) => sum + numero(p.cantidad), 0);

  const existenciaInsumo = (insumoId) => {
    const insumo = insumos.find((i) => i.id === insumoId);
    return (insumo?.lotes || []).reduce((s, l) => s + numero(l.cantidadDisponible), 0);
  };

  const reservasCarrito = useMemo(() => {
    const mapa = {};
    for (const p of carrito) {
      const producto = productos.find((x) => x.id === p.productoId);
      if (!producto) continue;
      const info = resolverRecetaPartidaV2(producto, p);
      for (const ing of info?.receta || []) {
        mapa[ing.insumoId] = numero(mapa[ing.insumoId]) + numero(ing.cantidad) * numero(p.cantidad || 1);
      }
    }
    return mapa;
  }, [carrito, productos, resolverRecetaPartidaV2]);

  const disponiblePara = (insumoId, cantidad) =>
    existenciaInsumo(insumoId) - numero(reservasCarrito[insumoId]) + 0.000001 >= numero(cantidad);

  const abrirProducto = (producto, partida = null) => {
    setProductoActual(producto);
    setEditandoId(partida?.id || null);
    setVerPreparacion(false);
    setDraft({
      id: partida?.id || uid('PART'),
      productoId: producto.id,
      cantidad: numero(partida?.cantidad || 1),
      preparacionId: partida?.preparacionId || null,
      presentacionId: partida?.presentacionId || null,
      tamanoId: partida?.tamanoId || null,
      selecciones: Array.isArray(partida?.selecciones) ? JSON.parse(JSON.stringify(partida.selecciones)) : [],
      quitarInsumoIds: Array.isArray(partida?.quitarInsumoIds) ? [...partida.quitarInsumoIds] : [],
      nota: partida?.nota || '',
    });
    setModalProducto(true);
  };

  const preparacionesActivas = (productoActual?.preparaciones || []).filter((x) => x.activo !== false);
  const presentacionesActivas = (productoActual?.presentaciones || []).filter((x) => x.activa !== false);
  const tamanosActivos = (productoActual?.tamanos || []).filter((x) => x.activo !== false);
  const seccionesActivas = (productoActual?.seccionesPersonalizacion || []).filter((x) => x.activa !== false);

  const presentacionesDisponibles = productoActual?.tipoProducto === 'Bebida configurable' && draft?.preparacionId
    ? presentacionesActivas.filter((p) => p.preparacionId === draft.preparacionId)
    : presentacionesActivas;

  const tamanoActual = tamanosActivos.find((t) => t.id === draft?.tamanoId) || null;

  const puedeElegirPresentacion =
    productoActual?.tipoProducto !== 'Bebida configurable' ||
    preparacionesActivas.length === 0 ||
    !!draft?.preparacionId;

  const listoParaPersonalizar =
    !productoActual ||
    (productoActual.tipoProducto === 'Bebida configurable'
      ? (preparacionesActivas.length === 0 || !!draft?.preparacionId) &&
        (presentacionesActivas.length === 0 || !!draft?.presentacionId)
      : productoActual.tipoProducto === 'Arma el tuyo'
      ? tamanosActivos.length === 0 || !!draft?.tamanoId
      : true);

  const idsSeleccionados = (seccionId) => {
    const grupo = (draft?.selecciones || []).find((g) => g.seccionId === seccionId);
    return Array.isArray(grupo?.opcionIds) ? grupo.opcionIds : [];
  };

  const reglaTamano = (seccionId) =>
    (tamanoActual?.reglasSecciones || []).find((r) => r.seccionId === seccionId) || null;

  const limiteSeccion = (seccion) => {
    if (seccion.tipoSeleccion === 'Única') return 1;
    const max = Math.max(1, numero(seccion.max || 1));
    const regla = reglaTamano(seccion.id);
    if (regla && !regla.permiteExtras) return Math.min(max, numero(regla.incluidas));
    return max;
  };

  const opcionAgotada = (opcion) => {
    if (!opcion || opcion.accionInventario === 'Ninguno' || !opcion.insumoId) return false;
    const valoresOpcion = resolverValoresOpcionV2(productoActual, draft, opcion);
    return !disponiblePara(opcion.insumoId, numero(valoresOpcion.cantidad) * numero(draft?.cantidad || 1));
  };

  const toggleOpcion = (seccion, opcion) => {
    if (opcionAgotada(opcion)) return;
    const actuales = idsSeleccionados(seccion.id);
    let nuevos;

    if (seccion.tipoSeleccion === 'Única') {
      nuevos = actuales.includes(opcion.id) ? [] : [opcion.id];
    } else if (actuales.includes(opcion.id)) {
      nuevos = actuales.filter((id) => id !== opcion.id);
    } else {
      const limite = limiteSeccion(seccion);
      if (actuales.length >= limite) {
        Alert.alert('Límite alcanzado', `Puedes seleccionar hasta ${limite} opción(es) en ${seccion.nombre}.`);
        return;
      }
      nuevos = [...actuales, opcion.id];
    }

    const opcionesSnapshot = (seccion.opciones || [])
      .filter((o) => nuevos.includes(o.id))
      .map((o) => {
        const valoresOpcion = resolverValoresOpcionV2(productoActual, draft, o);
        return { id: o.id, nombre: o.nombre, ajustePrecio: numero(valoresOpcion.ajustePrecio) };
      });

    setDraft((d) => {
      const otros = (d.selecciones || []).filter((g) => g.seccionId !== seccion.id);
      return {
        ...d,
        selecciones: [
          ...otros,
          {
            seccionId: seccion.id,
            seccionNombre: seccion.nombre,
            opcionIds: nuevos,
            opciones: opcionesSnapshot,
          },
        ],
      };
    });
  };

  const recetaBaseVisible = useMemo(() => {
    if (!productoActual || !draft) return [];
    const presentacion = (productoActual.presentaciones || []).find((p) => p.id === draft.presentacionId);
    if (presentacion?.receta?.length) return presentacion.receta;
    return productoActual.receta || [];
  }, [productoActual, draft?.presentacionId]);

  const toggleQuitarIngrediente = (insumoId) => {
    setDraft((d) => {
      const actuales = d.quitarInsumoIds || [];
      return {
        ...d,
        quitarInsumoIds: actuales.includes(insumoId)
          ? actuales.filter((id) => id !== insumoId)
          : [...actuales, insumoId],
      };
    });
  };

  const precioActual = productoActual && draft ? precioPartidaV2(productoActual, draft) : 0;
  const subtotalActual = precioActual * numero(draft?.cantidad || 1);

  const validarConfiguracionLocal = () => {
    if (!productoActual || !draft) return false;

    if (productoActual.tipoProducto === 'Bebida configurable') {
      if (preparacionesActivas.length && !draft.preparacionId) {
        Alert.alert('Falta preparación', 'Selecciona si la bebida es fría, caliente u otra preparación configurada.');
        return false;
      }
      if (presentacionesDisponibles.length && !draft.presentacionId) {
        Alert.alert('Falta presentación', 'Selecciona la presentación o tamaño de la bebida.');
        return false;
      }
    }

    if (productoActual.tipoProducto === 'Arma el tuyo' && tamanosActivos.length && !draft.tamanoId) {
      Alert.alert('Falta tamaño', 'Selecciona el tamaño.');
      return false;
    }

    for (const seccion of seccionesActivas) {
      const ids = idsSeleccionados(seccion.id);
      const minimo = seccion.obligatoria ? Math.max(1, numero(seccion.min)) : numero(seccion.min);
      if (ids.length < minimo) {
        Alert.alert('Falta selección', `Selecciona ${seccion.nombre}.`);
        return false;
      }
    }

    const info = resolverRecetaPartidaV2(productoActual, draft);
    if ((info?.receta || []).length > 0) {
      for (const ing of info.receta || []) {
        const requerido = numero(ing.cantidad) * numero(draft.cantidad || 1);
        if (!disponiblePara(ing.insumoId, requerido)) {
          const ins = insumos.find((i) => i.id === ing.insumoId);
          Alert.alert('Sin inventario', `No hay suficiente ${ins?.nombre || 'inventario'} para preparar este producto.`);
          return false;
        }
      }
    }

    return true;
  };

  const guardarEnCarrito = () => {
    if (!validarConfiguracionLocal()) return;
    const preparacion = preparacionesActivas.find((p) => p.id === draft.preparacionId);
    const presentacion = presentacionesActivas.find((p) => p.id === draft.presentacionId);
    const tamano = tamanosActivos.find((t) => t.id === draft.tamanoId);
    const item = {
      ...draft,
      producto: productoActual.nombre,
      tipoProducto: productoActual.tipoProducto || 'Fijo',
      preparacionNombre: preparacion?.nombre || '',
      presentacionNombre: presentacion?.nombre || '',
      tamanoNombre: tamano?.nombre || '',
      precioUnitario: precioActual,
      subtotal: subtotalActual,
    };

    setCarrito((actual) =>
      editandoId ? actual.map((x) => (x.id === editandoId ? item : x)) : [...actual, item]
    );
    setModalProducto(false);
  };

  const cambiarCantidadCarrito = (id, delta) => {
    setCarrito((actual) =>
      actual.map((p) => {
        if (p.id !== id) return p;
        const producto = productos.find((x) => x.id === p.productoId);
        const cantidad = Math.max(1, numero(p.cantidad) + delta);
        const nuevo = { ...p, cantidad };
        const precio = producto ? precioPartidaV2(producto, nuevo) : numero(p.precioUnitario);
        return { ...nuevo, precioUnitario: precio, subtotal: precio * cantidad };
      })
    );
  };

  const cobrar = () => {
    if (!carrito.length) return;
    const r = registrarVentaCarrito({
      partidas: carrito,
      metodoPago,
      nota: notaTicket,
    });
    if (!r?.ok) {
      Alert.alert('No se pudo cobrar', r?.mensaje || 'Revisa el pedido y el inventario.');
      return;
    }
    setCarrito([]);
    setNotaTicket('');
    setModalCarrito(false);
    Alert.alert('Venta registrada', `Total: ${dinero(r.venta?.monto)}`);
  };

  const guardarVentaLibre = () => {
    const r = registrarVentaLibre({
      concepto: libreConcepto,
      monto: libreMonto,
      metodoPago: libreMetodo,
      nota: libreNota,
    });
    if (!r?.ok) return Alert.alert('No se pudo registrar', r?.mensaje || 'Revisa los datos.');
    setLibreConcepto('');
    setLibreMonto('');
    setLibreNota('');
    setModalVentaLibre(false);
  };

  const confirmarCancelar = (venta) => {
    Alert.alert('Cancelar venta', 'Se revertirá el inventario que ya se haya descontado.', [
      { text: 'No', style: 'cancel' },
      { text: 'Sí, cancelar', style: 'destructive', onPress: () => cancelarVenta(venta.id) },
    ]);
  };

  const intentarCostear = (venta) => {
    const r = costearVentaProductoPendiente(venta.id);
    Alert.alert(
      r?.ok ? 'Costeo actualizado' : 'Aún pendiente',
      r?.ok
        ? r.pendienteCostear
          ? 'Se actualizaron algunos costos, pero todavía quedan pendientes.'
          : 'La venta quedó costeada.'
        : r?.mensaje || 'Todavía no se puede costear.'
    );
  };

  return (
    <SafeAreaView style={styles.pantalla}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.titulo}>Ventas</Text>
          <Text style={styles.subtitulo}>Casa Shamy · Punto de venta</Text>
        </View>
        <Boton titulo="Volver" tipo="secundario" compacto onPress={onVolver} />
      </View>

      <View style={styles.tabs}>
        <Chip label="Vender" activo={vista === 'Vender'} onPress={() => setVista('Vender')} />
        <Chip label="Historial" activo={vista === 'Historial'} onPress={() => setVista('Historial')} />
        <Boton titulo="Venta libre" tipo="suave" compacto onPress={() => setModalVentaLibre(true)} />
      </View>

      {vista === 'Vender' ? (
        <>
          <ScrollView contentContainerStyle={styles.contenido} keyboardShouldPersistTaps="handled">
            <TextInput
              value={buscar}
              onChangeText={setBuscar}
              placeholder="Buscar producto..."
              placeholderTextColor="#9E948C"
              style={styles.buscar}
            />

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categorias}>
              {categorias.map((c) => (
                <Chip key={c} label={c} activo={categoria === c} onPress={() => setCategoria(c)} />
              ))}
            </ScrollView>

            {productosVisibles.length === 0 ? (
              <View style={styles.vacio}>
                <Text style={styles.vacioTitulo}>No hay productos en esta vista</Text>
                <Text style={styles.vacioTexto}>Puedes crearlos desde Productos / recetas.</Text>
              </View>
            ) : (
              <View style={styles.gridProductos}>
                {productosVisibles.map((p) => (
                  <ProductoCard key={p.id} producto={p} onPress={() => abrirProducto(p)} />
                ))}
              </View>
            )}
          </ScrollView>

          <Pressable style={styles.barraCarrito} onPress={() => setModalCarrito(true)}>
            <View style={styles.carritoBurbuja}><Text style={styles.carritoBurbujaTxt}>{articulosCarrito}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.carritoTitulo}>Carrito</Text>
              <Text style={styles.carritoMeta}>{carrito.length} partida(s)</Text>
            </View>
            <Text style={styles.carritoTotal}>{dinero(totalCarrito)}</Text>
          </Pressable>
        </>
      ) : (
        <ScrollView contentContainerStyle={styles.contenido}>
          {ventas.length === 0 ? (
            <View style={styles.vacio}><Text style={styles.vacioTitulo}>Todavía no hay ventas</Text></View>
          ) : (
            ventas.slice(0, 50).map((venta) => (
              <View key={venta.id} style={styles.historialCard}>
                <View style={styles.historialTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.historialTitulo}>{venta.producto || venta.concepto || 'Venta'}</Text>
                    <Text style={styles.historialMeta}>{venta.fecha} · {venta.hora || ''} · {venta.metodoPago || ''}</Text>
                  </View>
                  <Text style={styles.historialMonto}>{dinero(venta.monto)}</Text>
                </View>

                {Array.isArray(venta.partidas) && venta.partidas.length > 0 && (
                  <View style={styles.partidasHistorial}>
                    {venta.partidas.map((p) => (
                      <Text key={p.id || `${p.productoId}_${Math.random()}`} style={styles.partidaHistorialTxt}>
                        {p.cantidad} × {p.producto}{p.presentacionNombre ? ` · ${p.presentacionNombre}` : ''}{p.tamanoNombre ? ` · ${p.tamanoNombre}` : ''}
                      </Text>
                    ))}
                  </View>
                )}

                <View style={styles.estadoFila}>
                  <Text style={[styles.badge, venta.pendienteCostear ? styles.badgeAviso : styles.badgeOk]}>
                    {venta.pendienteCostear ? 'Costo pendiente' : 'Costeada'}
                  </Text>
                  <Text style={styles.historialMeta}>
                    Utilidad {venta.pendienteCostear ? 'provisional' : ''}: {dinero(venta.utilidadProvisional ?? venta.utilidadBruta)}
                  </Text>
                </View>

                <View style={styles.filaBotones}>
                  {venta.pendienteCostear && !venta.pendienteClasificar && (
                    <Boton titulo="Costear ahora" compacto onPress={() => intentarCostear(venta)} />
                  )}
                  <Boton titulo="Cancelar" tipo="peligro" compacto onPress={() => confirmarCancelar(venta)} />
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}

      <ModalBase
        visible={modalProducto}
        titulo={productoActual?.nombre || 'Producto'}
        onCerrar={() => setModalProducto(false)}
      >
        {productoActual && draft && (
          <>
            <View style={styles.resumenProducto}>
              <View style={styles.resumenIcono}><Text style={styles.resumenEmoji}>{iconoProducto(productoActual)}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.resumenNombre}>{productoActual.nombre}</Text>
                <Text style={styles.resumenMeta}>{productoActual.categoria || 'General'} · {productoActual.tipoProducto || 'Fijo'}</Text>
              </View>
              <Text style={styles.resumenPrecio}>{dinero(precioActual)}</Text>
            </View>

            {!!productoActual.descripcionPreparacion && (
              <View style={styles.preparacionCaja}>
                <Pressable onPress={() => setVerPreparacion((x) => !x)}>
                  <Text style={styles.linkVer}>{verPreparacion ? 'Ocultar preparación' : 'Ver preparación'}</Text>
                </Pressable>
                {verPreparacion && <Text style={styles.preparacionTexto}>{productoActual.descripcionPreparacion}</Text>}
              </View>
            )}

            {productoActual.tipoProducto === 'Bebida configurable' && preparacionesActivas.length > 0 && (
              <>
                <Text style={styles.seccionLabel}>Preparación</Text>
                <View style={styles.opcionesCuadros}>
                  {preparacionesActivas.map((p) => (
                    <Chip
                      key={p.id}
                      label={p.nombre}
                      activo={draft.preparacionId === p.id}
                      onPress={() => setDraft((d) => ({ ...d, preparacionId: p.id, presentacionId: null }))}
                    />
                  ))}
                </View>
              </>
            )}

            {puedeElegirPresentacion &&
              (productoActual.tipoProducto === 'Bebida configurable' || (productoActual.tipoProducto === 'Fijo' && presentacionesActivas.length > 0)) &&
              presentacionesDisponibles.length > 0 && (
                <>
                  <Text style={styles.seccionLabel}>Presentación</Text>
                  <View style={styles.opcionesCuadros}>
                    {presentacionesDisponibles.map((p) => (
                      <Chip
                        key={p.id}
                        label={p.nombre}
                        detalle={dinero(p.precio)}
                        activo={draft.presentacionId === p.id}
                        onPress={() => setDraft((d) => ({ ...d, presentacionId: p.id }))}
                      />
                    ))}
                  </View>
                </>
              )}

            {productoActual.tipoProducto === 'Arma el tuyo' && tamanosActivos.length > 0 && (
              <>
                <Text style={styles.seccionLabel}>Tamaño</Text>
                <View style={styles.opcionesCuadros}>
                  {tamanosActivos.map((t) => (
                    <Chip
                      key={t.id}
                      label={t.nombre}
                      detalle={dinero(t.precio)}
                      activo={draft.tamanoId === t.id}
                      onPress={() => setDraft((d) => ({ ...d, tamanoId: t.id, selecciones: [] }))}
                    />
                  ))}
                </View>
              </>
            )}

            {listoParaPersonalizar && seccionesActivas.map((s) => {
              const ids = idsSeleccionados(s.id);
              const regla = reglaTamano(s.id);
              const descripcionLimite = productoActual.tipoProducto === 'Arma el tuyo' && regla
                ? `Incluye ${numero(regla.incluidas)}${regla.permiteExtras ? ` · extras ${dinero(regla.precioExtra)} c/u` : ''}`
                : s.tipoSeleccion === 'Única'
                ? 'Elige 1'
                : `Hasta ${limiteSeccion(s)}`;

              return (
                <View key={s.id} style={styles.seccionConfig}>
                  <View style={styles.seccionTituloFila}>
                    <Text style={styles.seccionLabel}>{s.nombre}</Text>
                    <Text style={styles.seccionAyuda}>{descripcionLimite}</Text>
                  </View>
                  <View style={styles.opcionesCuadros}>
                    {(s.opciones || []).filter((o) => o.activa !== false).map((o) => {
                      const agotada = opcionAgotada(o);
                      const seleccionada = ids.includes(o.id);
                      const extrasAhora = regla && ids.length >= numero(regla.incluidas) && !seleccionada && regla.permiteExtras;
                      const valoresOpcion = resolverValoresOpcionV2(productoActual, draft, o);
                      const adicional = numero(valoresOpcion.ajustePrecio) + (extrasAhora ? numero(regla.precioExtra) : 0);
                      return (
                        <Chip
                          key={o.id}
                          label={o.nombre}
                          detalle={agotada ? 'AGOTADO' : adicional ? `+${dinero(adicional)}` : 'Sin costo extra'}
                          activo={seleccionada}
                          disabled={agotada}
                          onPress={() => toggleOpcion(s, o)}
                        />
                      );
                    })}
                  </View>
                </View>
              );
            })}

            {listoParaPersonalizar && productoActual.permiteModificarIngredientes !== false && recetaBaseVisible.length > 0 && (
              <View style={styles.seccionConfig}>
                <Text style={styles.seccionLabel}>Quitar ingredientes</Text>
                <Text style={styles.seccionAyuda}>Solo afecta este producto y no se descuenta del inventario.</Text>
                <View style={styles.opcionesCuadros}>
                  {recetaBaseVisible.map((r) => {
                    const ins = insumos.find((i) => i.id === r.insumoId);
                    const quitado = (draft.quitarInsumoIds || []).includes(r.insumoId);
                    return (
                      <Chip
                        key={r.insumoId}
                        label={ins?.nombre || r.insumoNombre || 'Ingrediente'}
                        detalle={quitado ? 'QUITAR' : ''}
                        activo={quitado}
                        onPress={() => toggleQuitarIngrediente(r.insumoId)}
                      />
                    );
                  })}
                </View>
              </View>
            )}

            {listoParaPersonalizar && productoActual.permiteNotas !== false && (
              <View style={styles.campoGrupo}>
                <Text style={styles.seccionLabel}>Nota para este producto</Text>
                <TextInput
                  value={draft.nota}
                  onChangeText={(v) => setDraft((d) => ({ ...d, nota: v }))}
                  placeholder="Ej. poco hielo, aderezo aparte, bien tostado..."
                  placeholderTextColor="#9E948C"
                  multiline
                  style={[styles.input, styles.inputNota]}
                />
              </View>
            )}

            <View style={styles.cantidadFila}>
              <Text style={styles.seccionLabel}>Cantidad</Text>
              <View style={styles.cantidadControl}>
                <Pressable onPress={() => setDraft((d) => ({ ...d, cantidad: Math.max(1, numero(d.cantidad) - 1) }))} style={styles.cantidadBtn}><Text style={styles.cantidadBtnTxt}>−</Text></Pressable>
                <Text style={styles.cantidadNumero}>{draft.cantidad}</Text>
                <Pressable onPress={() => setDraft((d) => ({ ...d, cantidad: numero(d.cantidad) + 1 }))} style={styles.cantidadBtn}><Text style={styles.cantidadBtnTxt}>+</Text></Pressable>
              </View>
            </View>

            <View style={styles.totalConfig}>
              <Text style={styles.totalConfigLabel}>Subtotal</Text>
              <Text style={styles.totalConfigMonto}>{dinero(subtotalActual)}</Text>
            </View>

            <Boton titulo={editandoId ? 'Guardar cambios' : 'Agregar al carrito'} onPress={guardarEnCarrito} />
          </>
        )}
      </ModalBase>

      <ModalBase visible={modalCarrito} titulo="Carrito" onCerrar={() => setModalCarrito(false)}>
        {carrito.length === 0 ? (
          <View style={styles.vacio}><Text style={styles.vacioTitulo}>El carrito está vacío</Text></View>
        ) : (
          <>
            {carrito.map((p) => {
              const producto = productos.find((x) => x.id === p.productoId);
              return (
                <View key={p.id} style={styles.carritoPartida}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.carritoPartidaNombre}>{p.producto}</Text>
                    {!!p.preparacionNombre && <Text style={styles.carritoPartidaMeta}>{p.preparacionNombre}</Text>}
                    {!!p.presentacionNombre && <Text style={styles.carritoPartidaMeta}>{p.presentacionNombre}</Text>}
                    {!!p.tamanoNombre && <Text style={styles.carritoPartidaMeta}>{p.tamanoNombre}</Text>}
                    {(p.selecciones || []).map((g) => (
                      <Text key={g.seccionId} style={styles.carritoPartidaMeta}>
                        {g.seccionNombre}: {(g.opciones || []).map((o) => o.nombre).join(', ') || '—'}
                      </Text>
                    ))}
                    {!!p.nota && <Text style={styles.carritoNota}>Nota: {p.nota}</Text>}
                  </View>
                  <Text style={styles.carritoPartidaPrecio}>{dinero(p.subtotal)}</Text>

                  <View style={styles.cantidadMini}>
                    <Pressable onPress={() => cambiarCantidadCarrito(p.id, -1)}><Text style={styles.miniControl}>−</Text></Pressable>
                    <Text style={styles.miniCantidad}>{p.cantidad}</Text>
                    <Pressable onPress={() => cambiarCantidadCarrito(p.id, 1)}><Text style={styles.miniControl}>+</Text></Pressable>
                  </View>

                  <View style={styles.filaBotones}>
                    <Boton titulo="Editar" tipo="suave" compacto onPress={() => producto && abrirProducto(producto, p)} />
                    <Boton titulo="Quitar" tipo="peligro" compacto onPress={() => setCarrito((a) => a.filter((x) => x.id !== p.id))} />
                  </View>
                </View>
              );
            })}

            <View style={styles.totalTicket}>
              <Text style={styles.totalTicketLabel}>TOTAL</Text>
              <Text style={styles.totalTicketMonto}>{dinero(totalCarrito)}</Text>
            </View>

            <Text style={styles.seccionLabel}>Método de pago</Text>
            <View style={styles.opcionesCuadros}>
              {['Efectivo', 'Transferencia', 'Tarjeta'].map((m) => (
                <Chip key={m} label={m} activo={metodoPago === m} onPress={() => setMetodoPago(m)} />
              ))}
            </View>

            <Text style={styles.seccionLabel}>Nota general del pedido</Text>
            <TextInput
              value={notaTicket}
              onChangeText={setNotaTicket}
              placeholder="Opcional"
              placeholderTextColor="#9E948C"
              multiline
              style={[styles.input, styles.inputNota]}
            />

            <Boton titulo={`Cobrar ${dinero(totalCarrito)}`} onPress={cobrar} />
          </>
        )}
      </ModalBase>

      <ModalBase visible={modalVentaLibre} titulo="Venta libre" onCerrar={() => setModalVentaLibre(false)} alto="75%">
        <Text style={styles.seccionLabel}>Concepto</Text>
        <TextInput value={libreConcepto} onChangeText={setLibreConcepto} placeholder="Ej. venta sin clasificar" placeholderTextColor="#9E948C" style={styles.input} />
        <Text style={styles.seccionLabel}>Monto</Text>
        <TextInput value={libreMonto} onChangeText={setLibreMonto} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor="#9E948C" style={styles.input} />
        <Text style={styles.seccionLabel}>Método de pago</Text>
        <View style={styles.opcionesCuadros}>
          {['Efectivo', 'Transferencia', 'Tarjeta'].map((m) => (
            <Chip key={m} label={m} activo={libreMetodo === m} onPress={() => setLibreMetodo(m)} />
          ))}
        </View>
        <Text style={styles.seccionLabel}>Nota</Text>
        <TextInput value={libreNota} onChangeText={setLibreNota} placeholder="Opcional" placeholderTextColor="#9E948C" multiline style={[styles.input, styles.inputNota]} />
        <Boton titulo="Registrar venta libre" onPress={guardarVentaLibre} />
      </ModalBase>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: C.fondo },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.verde, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12 },
  titulo: { color: '#FFF', fontSize: 24, fontWeight: '900' },
  subtitulo: { color: '#E7EFEA', fontSize: 12, marginTop: 2 },
  tabs: { flexDirection: 'row', gap: 7, alignItems: 'center', padding: 10, borderBottomWidth: 1, borderBottomColor: C.linea, backgroundColor: '#F3ECE2' },
  contenido: { padding: 12, paddingBottom: 100 },
  buscar: { backgroundColor: '#FFF', borderWidth: 1, borderColor: C.linea, borderRadius: 14, minHeight: 46, paddingHorizontal: 13, fontSize: 15, color: C.texto },
  categorias: { gap: 7, paddingVertical: 10 },
  gridProductos: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 10 },
  productoCard: { width: '48.4%', backgroundColor: '#FFF', borderRadius: 16, padding: 10, borderWidth: 1, borderColor: C.linea, minHeight: 190 },
  productoImagenCaja: { height: 94, borderRadius: 13, overflow: 'hidden', backgroundColor: C.crema, alignItems: 'center', justifyContent: 'center', marginBottom: 9 },
  productoImagen: { width: '100%', height: '100%' },
  productoEmoji: { fontSize: 42 },
  productoNombre: { fontSize: 15, fontWeight: '900', color: C.texto, lineHeight: 19 },
  productoMeta: { fontSize: 10, color: C.secundario, marginTop: 3 },
  productoPrecio: { fontSize: 14, color: C.verde, fontWeight: '900', marginTop: 6 },
  barraCarrito: { position: 'absolute', bottom: 10, left: 12, right: 12, minHeight: 62, borderRadius: 18, backgroundColor: C.verde, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 10, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 4 },
  carritoBurbuja: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center' },
  carritoBurbujaTxt: { color: C.verde, fontWeight: '900' },
  carritoTitulo: { color: '#FFF', fontWeight: '900', fontSize: 14 },
  carritoMeta: { color: '#DCE9E1', fontSize: 10, marginTop: 2 },
  carritoTotal: { color: '#FFF', fontWeight: '900', fontSize: 18 },
  chip: { minHeight: 39, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: C.linea, backgroundColor: '#FFF', justifyContent: 'center' },
  chipActivo: { backgroundColor: C.verde, borderColor: C.verde },
  chipTexto: { color: C.texto, fontSize: 12, fontWeight: '800' },
  chipTextoActivo: { color: '#FFF' },
  chipDetalle: { color: C.secundario, fontSize: 9, marginTop: 2 },
  boton: { minHeight: 44, borderRadius: 12, paddingHorizontal: 15, paddingVertical: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: C.verde, marginVertical: 3 },
  botonCompacto: { minHeight: 36, paddingHorizontal: 10, paddingVertical: 7 },
  botonSecundario: { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#D7CCC0' },
  botonSuave: { backgroundColor: C.crema },
  botonPeligro: { backgroundColor: '#F9EAE7', borderWidth: 1, borderColor: '#ECCAC4' },
  botonTexto: { color: '#FFF', fontWeight: '900', fontSize: 12 },
  botonTextoOscuro: { color: C.texto },
  botonTextoPeligro: { color: C.peligro },
  disabled: { opacity: 0.38 },
  modalFondo: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.40)' },
  modalCaja: { backgroundColor: C.fondo, borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: C.linea, padding: 15 },
  modalTitulo: { flex: 1, color: C.texto, fontSize: 18, fontWeight: '900' },
  cerrar: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.crema, alignItems: 'center', justifyContent: 'center' },
  cerrarTxt: { color: C.texto, fontSize: 16, fontWeight: '900' },
  modalContenido: { padding: 15, paddingBottom: 45 },
  resumenProducto: { flexDirection: 'row', gap: 10, alignItems: 'center', backgroundColor: '#FFF', borderRadius: 15, padding: 12, borderWidth: 1, borderColor: C.linea, marginBottom: 12 },
  resumenIcono: { width: 48, height: 48, borderRadius: 14, backgroundColor: C.crema, alignItems: 'center', justifyContent: 'center' },
  resumenEmoji: { fontSize: 26 },
  resumenNombre: { fontSize: 17, fontWeight: '900', color: C.texto },
  resumenMeta: { color: C.secundario, fontSize: 11, marginTop: 2 },
  resumenPrecio: { color: C.verde, fontSize: 17, fontWeight: '900' },
  preparacionCaja: { backgroundColor: '#EEF3EF', borderRadius: 12, padding: 11, marginBottom: 12 },
  linkVer: { color: C.verde, fontWeight: '900', fontSize: 12 },
  preparacionTexto: { color: C.texto, fontSize: 12, lineHeight: 18, marginTop: 8 },
  seccionConfig: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: C.linea },
  seccionTituloFila: { flexDirection: 'row', alignItems: 'baseline', gap: 8, justifyContent: 'space-between' },
  seccionLabel: { color: C.texto, fontSize: 13, fontWeight: '900', marginTop: 10, marginBottom: 7 },
  seccionAyuda: { color: C.secundario, fontSize: 10, marginBottom: 7 },
  opcionesCuadros: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 8 },
  campoGrupo: { marginTop: 8 },
  input: { minHeight: 46, borderRadius: 12, borderWidth: 1, borderColor: C.linea, backgroundColor: '#FFF', paddingHorizontal: 12, color: C.texto, fontSize: 14, marginBottom: 10 },
  inputNota: { minHeight: 82, paddingTop: 10, textAlignVertical: 'top' },
  cantidadFila: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
  cantidadControl: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cantidadBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: C.crema, alignItems: 'center', justifyContent: 'center' },
  cantidadBtnTxt: { fontSize: 22, fontWeight: '900', color: C.verde },
  cantidadNumero: { minWidth: 26, textAlign: 'center', color: C.texto, fontWeight: '900', fontSize: 16 },
  totalConfig: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 14, padding: 13, marginVertical: 12, borderWidth: 1, borderColor: C.linea },
  totalConfigLabel: { fontWeight: '900', color: C.texto },
  totalConfigMonto: { fontSize: 19, fontWeight: '900', color: C.verde },
  vacio: { backgroundColor: '#FFF', borderWidth: 1, borderColor: C.linea, borderRadius: 15, padding: 22, alignItems: 'center' },
  vacioTitulo: { color: C.texto, fontWeight: '900', fontSize: 15 },
  vacioTexto: { color: C.secundario, fontSize: 11, marginTop: 5 },
  carritoPartida: { backgroundColor: '#FFF', borderWidth: 1, borderColor: C.linea, borderRadius: 14, padding: 12, marginBottom: 9 },
  carritoPartidaNombre: { fontSize: 15, color: C.texto, fontWeight: '900' },
  carritoPartidaMeta: { fontSize: 11, color: C.secundario, marginTop: 2 },
  carritoNota: { fontSize: 11, color: C.terracota, fontWeight: '700', marginTop: 5 },
  carritoPartidaPrecio: { position: 'absolute', right: 12, top: 12, color: C.verde, fontWeight: '900' },
  cantidadMini: { flexDirection: 'row', gap: 10, alignItems: 'center', marginTop: 10 },
  miniControl: { width: 28, height: 28, textAlign: 'center', lineHeight: 28, backgroundColor: C.crema, borderRadius: 9, color: C.verde, fontWeight: '900', fontSize: 17 },
  miniCantidad: { color: C.texto, fontWeight: '900' },
  filaBotones: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  totalTicket: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderTopWidth: 2, borderTopColor: C.verde, marginTop: 8 },
  totalTicketLabel: { color: C.texto, fontWeight: '900', fontSize: 15 },
  totalTicketMonto: { color: C.verde, fontWeight: '900', fontSize: 23 },
  historialCard: { backgroundColor: '#FFF', borderWidth: 1, borderColor: C.linea, borderRadius: 15, padding: 12, marginBottom: 9 },
  historialTop: { flexDirection: 'row', gap: 8 },
  historialTitulo: { color: C.texto, fontSize: 15, fontWeight: '900' },
  historialMeta: { color: C.secundario, fontSize: 10, marginTop: 3 },
  historialMonto: { color: C.verde, fontSize: 16, fontWeight: '900' },
  partidasHistorial: { marginTop: 8, paddingTop: 7, borderTopWidth: 1, borderTopColor: '#EEE6DC' },
  partidaHistorialTxt: { color: C.secundario, fontSize: 11, marginTop: 2 },
  estadoFila: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 9 },
  badge: { overflow: 'hidden', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 9, fontSize: 10, fontWeight: '900' },
  badgeAviso: { backgroundColor: '#F8EBCF', color: C.aviso },
  badgeOk: { backgroundColor: '#E2EFE6', color: C.ok },
});
