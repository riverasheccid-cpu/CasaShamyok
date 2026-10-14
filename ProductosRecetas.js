import React, { useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Pressable,
  TextInput,
  Modal,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';

import { useNegocio } from './DatosNegocio.js';

const ESTADOS = ['Sin receta', 'En proceso', 'Completa'];
const FILTROS_PRODUCTOS = ['Todos', 'Sin receta', 'En proceso', 'Receta completa'];

const dinero = (valor) =>
  `$${Number(valor || 0).toLocaleString('es-MX', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const texto = (valor) => String(valor ?? '').trim();

function Boton({ titulo, onPress, tipo = 'principal', disabled = false, compacto = false }) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.boton,
        tipo === 'secundario' && styles.botonSecundario,
        tipo === 'peligro' && styles.botonPeligro,
        tipo === 'suave' && styles.botonSuave,
        compacto && styles.botonCompacto,
        disabled && styles.botonDeshabilitado,
        pressed && !disabled && styles.presionado,
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

function Campo({ etiqueta, value, onChangeText, placeholder = '', keyboardType = 'default' }) {
  return (
    <View style={styles.campoGrupo}>
      <Text style={styles.campoEtiqueta}>{etiqueta}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        keyboardType={keyboardType}
        style={styles.input}
        placeholderTextColor="#9A9A9A"
      />
    </View>
  );
}

function Chip({ texto: label, activo, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        activo && styles.chipActivo,
        pressed && styles.presionado,
      ]}
    >
      <Text style={[styles.chipTexto, activo && styles.chipTextoActivo]}>{label}</Text>
    </Pressable>
  );
}

function ModalBase({ visible, titulo, onCerrar, children }) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onCerrar}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalFondo}
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

export default function ProductosRecetas(props = {}) {
  const volver = props.onVolver || props.volver || props.onBack || null;

  const {
    productos,
    insumos,
    agregarProducto,
    editarProducto,
    eliminarProducto,
    guardarRecetaProducto,
    cambiarEstadoReceta,
    agregarInsumo,
    editarInsumo,
    eliminarInsumo,
    existenciaDe,
    calcularCostoFIFO,
    numero,
  } = useNegocio();

  const [seccion, setSeccion] = useState('Productos');
  const [filtroProducto, setFiltroProducto] = useState('Todos');
  const [busquedaProducto, setBusquedaProducto] = useState('');
  const [busquedaInsumo, setBusquedaInsumo] = useState('');

  const [modalProducto, setModalProducto] = useState(false);
  const [productoEditando, setProductoEditando] = useState(null);
  const [nombreProducto, setNombreProducto] = useState('');
  const [categoriaProducto, setCategoriaProducto] = useState('');
  const [precioProducto, setPrecioProducto] = useState('');

  const [modalReceta, setModalReceta] = useState(false);
  const [productoReceta, setProductoReceta] = useState(null);
  const [recetaDraft, setRecetaDraft] = useState([]);
  const [estadoRecetaDraft, setEstadoRecetaDraft] = useState('Sin receta');
  const [insumoSeleccionadoId, setInsumoSeleccionadoId] = useState(null);
  const [cantidadIngrediente, setCantidadIngrediente] = useState('');
  const [busquedaIngrediente, setBusquedaIngrediente] = useState('');
  const [ingredienteEditandoId, setIngredienteEditandoId] = useState(null);

  const [modalInsumo, setModalInsumo] = useState(false);
  const [insumoEditando, setInsumoEditando] = useState(null);
  const [nombreInsumo, setNombreInsumo] = useState('');
  const [categoriaInsumo, setCategoriaInsumo] = useState('');
  const [presentacionInsumo, setPresentacionInsumo] = useState('');
  const [contenidoInsumo, setContenidoInsumo] = useState('');
  const [unidadInsumo, setUnidadInsumo] = useState('unidad');
  const [stockMinimoInsumo, setStockMinimoInsumo] = useState('');

  const estadoVisible = (producto) => {
    const estado = producto?.estadoReceta || ((producto?.receta || []).length ? 'En proceso' : 'Sin receta');
    return estado === 'Completa' ? 'Receta completa' : estado;
  };

  const productosVisibles = productos
    .filter((producto) => {
      if (filtroProducto === 'Todos') return true;
      return estadoVisible(producto) === filtroProducto;
    })
    .filter((producto) => {
      const q = busquedaProducto.toLowerCase().trim();
      if (!q) return true;
      return `${producto.nombre || ''} ${producto.categoria || ''}`.toLowerCase().includes(q);
    })
    .sort((a, b) => String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es'));

  const insumosVisibles = insumos
    .filter((insumo) => {
      const q = busquedaInsumo.toLowerCase().trim();
      if (!q) return true;
      return `${insumo.nombre || ''} ${insumo.categoria || ''}`.toLowerCase().includes(q);
    })
    .sort((a, b) => String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es'));

  const insumosParaReceta = insumos
    .filter((insumo) => {
      const q = busquedaIngrediente.toLowerCase().trim();
      if (!q) return true;
      return `${insumo.nombre || ''} ${insumo.categoria || ''}`.toLowerCase().includes(q);
    })
    .sort((a, b) => String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es'));

  const costoReceta = (producto) => {
    const receta = Array.isArray(producto?.receta) ? producto.receta : [];

    if (!receta.length) {
      return {
        estado: 'sin-receta',
        total: null,
        texto: 'Sin receta',
      };
    }

    let total = 0;

    for (const ingrediente of receta) {
      const resultado = calcularCostoFIFO(ingrediente.insumoId, numero(ingrediente.cantidad));

      if (!resultado?.ok) {
        if (resultado?.inventarioDisponible || resultado?.costoPendiente) {
          return {
            estado: 'pendiente',
            total: null,
            texto: 'Costo pendiente',
          };
        }

        return {
          estado: 'sin-stock',
          total: null,
          texto: 'Sin inventario suficiente',
        };
      }

      total += numero(resultado.costo);
    }

    return {
      estado: 'ok',
      total,
      texto: dinero(total),
    };
  };

  const abrirNuevoProducto = () => {
    setProductoEditando(null);
    setNombreProducto('');
    setCategoriaProducto('General');
    setPrecioProducto('');
    setModalProducto(true);
  };

  const abrirEditarProducto = (producto) => {
    setProductoEditando(producto);
    setNombreProducto(producto.nombre || '');
    setCategoriaProducto(producto.categoria || 'General');
    setPrecioProducto(String(producto.precio ?? ''));
    setModalProducto(true);
  };

  const guardarProductoActual = () => {
    const nombre = texto(nombreProducto);

    if (!nombre) {
      Alert.alert('Falta información', 'Escribe el nombre del producto.');
      return;
    }

    const precio = numero(precioProducto);

    let resultado;

    if (productoEditando) {
      resultado = editarProducto(productoEditando.id, {
        nombre,
        categoria: texto(categoriaProducto) || 'General',
        precio,
      });
    } else {
      resultado = agregarProducto({
        nombre,
        categoria: texto(categoriaProducto) || 'General',
        precio,
        receta: [],
        estadoReceta: 'Sin receta',
      });
    }

    if (!resultado?.ok) {
      Alert.alert('No se pudo guardar', resultado?.mensaje || 'Revisa los datos.');
      return;
    }

    setModalProducto(false);
  };

  const confirmarEliminarProducto = (producto) => {
    Alert.alert(
      'Eliminar producto',
      `¿Eliminar ${producto.nombre}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => {
            const resultado = eliminarProducto(producto.id);
            if (!resultado?.ok) {
              Alert.alert('No se puede eliminar', resultado?.mensaje || 'No fue posible eliminarlo.');
            }
          },
        },
      ]
    );
  };

  const abrirReceta = (producto) => {
    const receta = (producto.receta || []).map((item) => ({ ...item }));
    let estado = producto.estadoReceta || (receta.length ? 'En proceso' : 'Sin receta');

    if (receta.length && estado === 'Sin receta') estado = 'En proceso';
    if (!receta.length) estado = 'Sin receta';

    setProductoReceta(producto);
    setRecetaDraft(receta);
    setEstadoRecetaDraft(estado);
    setInsumoSeleccionadoId(null);
    setCantidadIngrediente('');
    setBusquedaIngrediente('');
    setIngredienteEditandoId(null);
    setModalReceta(true);
  };

  const seleccionarEstadoReceta = (estado) => {
    if (estado === 'Sin receta' && recetaDraft.length > 0) {
      Alert.alert(
        'La receta tiene ingredientes',
        'Para marcarla como “Sin receta”, primero quita los ingredientes.'
      );
      return;
    }

    if (estado === 'Completa' && recetaDraft.length === 0) {
      Alert.alert('Receta vacía', 'Agrega al menos un ingrediente antes de marcarla como completa.');
      return;
    }

    setEstadoRecetaDraft(estado);
  };

  const limpiarEditorIngrediente = () => {
    setInsumoSeleccionadoId(null);
    setCantidadIngrediente('');
    setIngredienteEditandoId(null);
  };

  const agregarOActualizarIngrediente = () => {
    if (!insumoSeleccionadoId) {
      Alert.alert('Selecciona un insumo', 'Elige el ingrediente que quieres agregar.');
      return;
    }

    const cantidad = numero(cantidadIngrediente);

    if (!cantidad || cantidad <= 0) {
      Alert.alert('Cantidad inválida', 'Escribe una cantidad mayor a 0.');
      return;
    }

    const insumo = insumos.find((item) => item.id === insumoSeleccionadoId);

    if (!insumo) {
      Alert.alert('Insumo no encontrado', 'Ese insumo ya no está disponible.');
      return;
    }

    if (ingredienteEditandoId) {
      setRecetaDraft((actual) =>
        actual.map((item) =>
          item.id === ingredienteEditandoId
            ? {
                ...item,
                insumoId: insumo.id,
                insumoNombre: insumo.nombre,
                cantidad,
                unidadBase: insumo.unidadBase || '',
              }
            : item
        )
      );
    } else {
      const existente = recetaDraft.find((item) => item.insumoId === insumo.id);

      if (existente) {
        setRecetaDraft((actual) =>
          actual.map((item) =>
            item.id === existente.id
              ? {
                  ...item,
                  cantidad: numero(item.cantidad) + cantidad,
                  insumoNombre: insumo.nombre,
                  unidadBase: insumo.unidadBase || '',
                }
              : item
          )
        );
      } else {
        setRecetaDraft((actual) => [
          ...actual,
          {
            id: `REC_TMP_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            insumoId: insumo.id,
            insumoNombre: insumo.nombre,
            cantidad,
            unidadBase: insumo.unidadBase || '',
          },
        ]);
      }
    }

    if (estadoRecetaDraft === 'Sin receta') {
      setEstadoRecetaDraft('En proceso');
    }

    limpiarEditorIngrediente();
  };

  const editarIngrediente = (ingrediente) => {
    setIngredienteEditandoId(ingrediente.id);
    setInsumoSeleccionadoId(ingrediente.insumoId);
    setCantidadIngrediente(String(ingrediente.cantidad ?? ''));
  };

  const quitarIngrediente = (ingredienteId) => {
    const nueva = recetaDraft.filter((item) => item.id !== ingredienteId);
    setRecetaDraft(nueva);

    if (ingredienteEditandoId === ingredienteId) {
      limpiarEditorIngrediente();
    }

    if (nueva.length === 0) {
      setEstadoRecetaDraft('Sin receta');
    } else if (estadoRecetaDraft === 'Completa') {
      setEstadoRecetaDraft('En proceso');
    }
  };

  const guardarRecetaActual = () => {
    if (!productoReceta) return;

    let estado = estadoRecetaDraft;

    if (recetaDraft.length === 0) estado = 'Sin receta';
    if (recetaDraft.length > 0 && estado === 'Sin receta') estado = 'En proceso';

    if (estado === 'Completa' && recetaDraft.length === 0) {
      Alert.alert('Receta vacía', 'Agrega al menos un ingrediente.');
      return;
    }

    const resultado = guardarRecetaProducto({
      productoId: productoReceta.id,
      receta: recetaDraft.map((item) => ({
        id: item.id,
        insumoId: item.insumoId,
        insumoNombre:
          insumos.find((i) => i.id === item.insumoId)?.nombre || item.insumoNombre || '',
        cantidad: numero(item.cantidad),
        unidadBase:
          insumos.find((i) => i.id === item.insumoId)?.unidadBase || item.unidadBase || '',
      })),
      estadoReceta: estado,
    });

    if (!resultado?.ok) {
      Alert.alert('No se pudo guardar', resultado?.mensaje || 'Revisa la receta.');
      return;
    }

    if (estado === 'Completa') {
      const estadoResultado = cambiarEstadoReceta(productoReceta.id, 'Completa');
      if (!estadoResultado?.ok) {
        Alert.alert('No se pudo completar', estadoResultado?.mensaje || 'Revisa la receta.');
        return;
      }
    }

    setModalReceta(false);
  };

  const abrirNuevoInsumo = () => {
    setInsumoEditando(null);
    setNombreInsumo('');
    setCategoriaInsumo('General');
    setPresentacionInsumo('');
    setContenidoInsumo('');
    setUnidadInsumo('unidad');
    setStockMinimoInsumo('');
    setModalInsumo(true);
  };

  const abrirEditarInsumo = (insumo) => {
    setInsumoEditando(insumo);
    setNombreInsumo(insumo.nombre || '');
    setCategoriaInsumo(insumo.categoria || 'General');
    setPresentacionInsumo(insumo.presentacionCompra || insumo.presentacion || '');
    setContenidoInsumo(String(insumo.contenidoPresentacion ?? ''));
    setUnidadInsumo(insumo.unidadBase || 'unidad');
    setStockMinimoInsumo(String(insumo.stockMinimo ?? ''));
    setModalInsumo(true);
  };

  const guardarInsumoActual = () => {
    const nombre = texto(nombreInsumo);

    if (!nombre) {
      Alert.alert('Falta información', 'Escribe el nombre del insumo.');
      return;
    }

    let resultado;

    if (insumoEditando) {
      resultado = editarInsumo(insumoEditando.id, {
        nombre,
        categoria: texto(categoriaInsumo) || 'General',
        presentacionCompra: texto(presentacionInsumo),
        contenidoPresentacion: numero(contenidoInsumo),
        unidadBase: texto(unidadInsumo) || 'unidad',
        stockMinimo: numero(stockMinimoInsumo),
      });
    } else {
      resultado = agregarInsumo({
        nombre,
        categoria: texto(categoriaInsumo) || 'General',
        presentacionCompra: texto(presentacionInsumo),
        presentacion: texto(presentacionInsumo),
        contenidoPresentacion: numero(contenidoInsumo),
        unidadBase: texto(unidadInsumo) || 'unidad',
        stockMinimo: numero(stockMinimoInsumo),
      });
    }

    if (!resultado?.ok) {
      Alert.alert('No se pudo guardar', resultado?.mensaje || 'Revisa los datos.');
      return;
    }

    setModalInsumo(false);
  };

  const confirmarEliminarInsumo = (insumo) => {
    Alert.alert(
      'Eliminar insumo',
      `¿Eliminar ${insumo.nombre}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => {
            const resultado = eliminarInsumo(insumo.id);
            if (!resultado?.ok) {
              Alert.alert('No se puede eliminar', resultado?.mensaje || 'No fue posible eliminarlo.');
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.pantalla}>
      <View style={styles.header}>
        <View style={styles.headerTexto}>
          <Text style={styles.titulo}>Productos y recetas</Text>
          <Text style={styles.subtitulo}>Catálogo, recetas e insumos de Casa Shamy</Text>
        </View>

        {volver ? (
          <Boton titulo="Volver" tipo="secundario" compacto onPress={volver} />
        ) : null}
      </View>

      <View style={styles.tabsPrincipales}>
        <Chip texto="Productos" activo={seccion === 'Productos'} onPress={() => setSeccion('Productos')} />
        <Chip texto="Insumos" activo={seccion === 'Insumos'} onPress={() => setSeccion('Insumos')} />
      </View>

      {seccion === 'Productos' ? (
        <ScrollView contentContainerStyle={styles.contenido} keyboardShouldPersistTaps="handled">
          <View style={styles.accionesArriba}>
            <View style={styles.flex1}>
              <TextInput
                value={busquedaProducto}
                onChangeText={setBusquedaProducto}
                placeholder="Buscar producto..."
                style={styles.inputBusqueda}
                placeholderTextColor="#9A9A9A"
              />
            </View>
            <Boton titulo="+ Producto" onPress={abrirNuevoProducto} compacto />
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtrosFila}>
            {FILTROS_PRODUCTOS.map((filtro) => (
              <Chip
                key={filtro}
                texto={filtro}
                activo={filtroProducto === filtro}
                onPress={() => setFiltroProducto(filtro)}
              />
            ))}
          </ScrollView>

          <Text style={styles.resumenTexto}>
            {productosVisibles.length} producto{productosVisibles.length === 1 ? '' : 's'}
          </Text>

          {productosVisibles.length === 0 ? (
            <View style={styles.vacio}>
              <Text style={styles.vacioTitulo}>No hay productos en este filtro</Text>
              <Text style={styles.vacioTexto}>Puedes crear uno nuevo o cambiar el filtro.</Text>
            </View>
          ) : (
            productosVisibles.map((producto) => {
              const estado = estadoVisible(producto);
              const costo = costoReceta(producto);
              const utilidad = costo.total === null ? null : numero(producto.precio) - costo.total;

              return (
                <View key={producto.id} style={styles.card}>
                  <View style={styles.cardFilaSuperior}>
                    <View style={styles.flex1}>
                      <Text style={styles.cardTitulo}>{producto.nombre}</Text>
                      <Text style={styles.cardMeta}>{producto.categoria || 'General'}</Text>
                    </View>
                    <View style={styles.precioCaja}>
                      <Text style={styles.precioEtiqueta}>Precio</Text>
                      <Text style={styles.precioTexto}>{dinero(producto.precio)}</Text>
                    </View>
                  </View>

                  <View style={styles.estadoFila}>
                    <View
                      style={[
                        styles.estadoBadge,
                        estado === 'Receta completa' && styles.estadoCompleto,
                        estado === 'En proceso' && styles.estadoProceso,
                        estado === 'Sin receta' && styles.estadoSin,
                      ]}
                    >
                      <Text style={styles.estadoTexto}>{estado}</Text>
                    </View>
                    <Text style={styles.ingredientesTexto}>
                      {(producto.receta || []).length} ingrediente{(producto.receta || []).length === 1 ? '' : 's'}
                    </Text>
                  </View>

                  <View style={styles.metricasFila}>
                    <View style={styles.metrica}>
                      <Text style={styles.metricaEtiqueta}>Costo actual</Text>
                      <Text style={styles.metricaValor}>{costo.texto}</Text>
                    </View>
                    <View style={styles.metrica}>
                      <Text style={styles.metricaEtiqueta}>Utilidad bruta</Text>
                      <Text style={styles.metricaValor}>
                        {utilidad === null ? 'Pendiente' : dinero(utilidad)}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.botonesCard}>
                    <Boton titulo="Receta" onPress={() => abrirReceta(producto)} compacto />
                    <Boton
                      titulo="Editar"
                      tipo="secundario"
                      onPress={() => abrirEditarProducto(producto)}
                      compacto
                    />
                    <Boton
                      titulo="Eliminar"
                      tipo="peligro"
                      onPress={() => confirmarEliminarProducto(producto)}
                      compacto
                    />
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={styles.contenido} keyboardShouldPersistTaps="handled">
          <View style={styles.accionesArriba}>
            <View style={styles.flex1}>
              <TextInput
                value={busquedaInsumo}
                onChangeText={setBusquedaInsumo}
                placeholder="Buscar insumo..."
                style={styles.inputBusqueda}
                placeholderTextColor="#9A9A9A"
              />
            </View>
            <Boton titulo="+ Insumo" onPress={abrirNuevoInsumo} compacto />
          </View>

          <Text style={styles.resumenTexto}>
            {insumosVisibles.length} insumo{insumosVisibles.length === 1 ? '' : 's'}
          </Text>

          {insumosVisibles.length === 0 ? (
            <View style={styles.vacio}>
              <Text style={styles.vacioTitulo}>No hay insumos</Text>
              <Text style={styles.vacioTexto}>Agrega el primero para comenzar a construir recetas.</Text>
            </View>
          ) : (
            insumosVisibles.map((insumo) => {
              const existencia = existenciaDe(insumo);
              const pendienteCosto = (insumo.lotes || []).some(
                (lote) => lote.costoPendiente && numero(lote.cantidadDisponible) > 0
              );

              return (
                <View key={insumo.id} style={styles.card}>
                  <View style={styles.cardFilaSuperior}>
                    <View style={styles.flex1}>
                      <Text style={styles.cardTitulo}>{insumo.nombre}</Text>
                      <Text style={styles.cardMeta}>{insumo.categoria || 'General'}</Text>
                    </View>
                    <View style={styles.stockCaja}>
                      <Text style={styles.precioEtiqueta}>Existencia</Text>
                      <Text style={styles.stockTexto}>
                        {Number(existencia || 0).toLocaleString('es-MX', { maximumFractionDigits: 3 })}{' '}
                        {insumo.unidadBase || ''}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.detalleTexto}>
                    Presentación: {insumo.presentacionCompra || insumo.presentacion || 'Sin definir'}
                  </Text>
                  <Text style={styles.detalleTexto}>
                    Contenido por presentación:{' '}
                    {Number(insumo.contenidoPresentacion || 0).toLocaleString('es-MX', {
                      maximumFractionDigits: 3,
                    })}{' '}
                    {insumo.unidadBase || ''}
                  </Text>

                  {pendienteCosto ? (
                    <View style={styles.avisoPendiente}>
                      <Text style={styles.avisoPendienteTexto}>Hay inventario con costo pendiente</Text>
                    </View>
                  ) : null}

                  <View style={styles.botonesCard}>
                    <Boton
                      titulo="Editar"
                      tipo="secundario"
                      onPress={() => abrirEditarInsumo(insumo)}
                      compacto
                    />
                    <Boton
                      titulo="Eliminar"
                      tipo="peligro"
                      onPress={() => confirmarEliminarInsumo(insumo)}
                      compacto
                    />
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      )}

      <ModalBase
        visible={modalProducto}
        titulo={productoEditando ? 'Editar producto' : 'Nuevo producto'}
        onCerrar={() => setModalProducto(false)}
      >
        <Campo etiqueta="Nombre" value={nombreProducto} onChangeText={setNombreProducto} placeholder="Ej. Latte" />
        <Campo
          etiqueta="Categoría"
          value={categoriaProducto}
          onChangeText={setCategoriaProducto}
          placeholder="Ej. Bebidas calientes"
        />
        <Campo
          etiqueta="Precio de venta"
          value={precioProducto}
          onChangeText={setPrecioProducto}
          placeholder="0.00"
          keyboardType="decimal-pad"
        />

        <Boton titulo={productoEditando ? 'Guardar cambios' : 'Crear producto'} onPress={guardarProductoActual} />
      </ModalBase>

      <ModalBase
        visible={modalReceta}
        titulo={productoReceta ? `Receta · ${productoReceta.nombre}` : 'Receta'}
        onCerrar={() => setModalReceta(false)}
      >
        <Text style={styles.seccionTitulo}>Estado de la receta</Text>
        <View style={styles.chipsWrap}>
          {ESTADOS.map((estado) => (
            <Chip
              key={estado}
              texto={estado === 'Completa' ? 'Receta completa' : estado}
              activo={estadoRecetaDraft === estado}
              onPress={() => seleccionarEstadoReceta(estado)}
            />
          ))}
        </View>

        <View style={styles.separador} />

        <Text style={styles.seccionTitulo}>Ingredientes actuales</Text>

        {recetaDraft.length === 0 ? (
          <Text style={styles.ayudaTexto}>Todavía no hay ingredientes.</Text>
        ) : (
          recetaDraft.map((ingrediente) => {
            const insumo = insumos.find((item) => item.id === ingrediente.insumoId);
            return (
              <View key={ingrediente.id} style={styles.ingredienteCard}>
                <View style={styles.flex1}>
                  <Text style={styles.ingredienteNombre}>
                    {insumo?.nombre || ingrediente.insumoNombre || 'Insumo'}
                  </Text>
                  <Text style={styles.ingredienteCantidad}>
                    {Number(ingrediente.cantidad || 0).toLocaleString('es-MX', {
                      maximumFractionDigits: 4,
                    })}{' '}
                    {insumo?.unidadBase || ingrediente.unidadBase || ''}
                  </Text>
                </View>
                <Boton titulo="Editar" tipo="secundario" compacto onPress={() => editarIngrediente(ingrediente)} />
                <Boton titulo="Quitar" tipo="peligro" compacto onPress={() => quitarIngrediente(ingrediente.id)} />
              </View>
            );
          })
        )}

        <View style={styles.separador} />

        <Text style={styles.seccionTitulo}>
          {ingredienteEditandoId ? 'Editar ingrediente' : 'Agregar ingrediente'}
        </Text>

        <TextInput
          value={busquedaIngrediente}
          onChangeText={setBusquedaIngrediente}
          placeholder="Buscar insumo..."
          style={styles.inputBusqueda}
          placeholderTextColor="#9A9A9A"
        />

        <View style={styles.listaInsumosReceta}>
          {insumosParaReceta.length === 0 ? (
            <Text style={styles.ayudaTexto}>No hay insumos que coincidan.</Text>
          ) : (
            insumosParaReceta.map((insumo) => (
              <Pressable
                key={insumo.id}
                onPress={() => setInsumoSeleccionadoId(insumo.id)}
                style={[
                  styles.insumoOpcion,
                  insumoSeleccionadoId === insumo.id && styles.insumoOpcionActiva,
                ]}
              >
                <Text
                  style={[
                    styles.insumoOpcionTexto,
                    insumoSeleccionadoId === insumo.id && styles.insumoOpcionTextoActivo,
                  ]}
                >
                  {insumo.nombre} · {insumo.unidadBase || 'unidad'}
                </Text>
              </Pressable>
            ))
          )}
        </View>

        <Campo
          etiqueta="Cantidad usada por producto"
          value={cantidadIngrediente}
          onChangeText={setCantidadIngrediente}
          placeholder="Ej. 250"
          keyboardType="decimal-pad"
        />

        <View style={styles.botonesModalFila}>
          {ingredienteEditandoId ? (
            <Boton titulo="Cancelar edición" tipo="secundario" onPress={limpiarEditorIngrediente} />
          ) : null}
          <Boton
            titulo={ingredienteEditandoId ? 'Actualizar ingrediente' : 'Agregar ingrediente'}
            onPress={agregarOActualizarIngrediente}
          />
        </View>

        <View style={styles.separador} />

        <Boton titulo="Guardar receta" onPress={guardarRecetaActual} />
      </ModalBase>

      <ModalBase
        visible={modalInsumo}
        titulo={insumoEditando ? 'Editar insumo' : 'Nuevo insumo'}
        onCerrar={() => setModalInsumo(false)}
      >
        <Campo etiqueta="Nombre" value={nombreInsumo} onChangeText={setNombreInsumo} placeholder="Ej. Leche entera" />
        <Campo
          etiqueta="Categoría"
          value={categoriaInsumo}
          onChangeText={setCategoriaInsumo}
          placeholder="Ej. Lácteos"
        />
        <Campo
          etiqueta="Presentación de compra"
          value={presentacionInsumo}
          onChangeText={setPresentacionInsumo}
          placeholder="Ej. Galón, bolsa, caja"
        />
        <Campo
          etiqueta="Contenido por presentación"
          value={contenidoInsumo}
          onChangeText={setContenidoInsumo}
          placeholder="Ej. 3785"
          keyboardType="decimal-pad"
        />
        <Campo
          etiqueta="Unidad base"
          value={unidadInsumo}
          onChangeText={setUnidadInsumo}
          placeholder="ml, g, pieza..."
        />
        <Campo
          etiqueta="Stock mínimo"
          value={stockMinimoInsumo}
          onChangeText={setStockMinimoInsumo}
          placeholder="0"
          keyboardType="decimal-pad"
        />

        <Text style={styles.ayudaTexto}>
          Aquí solo editas la ficha del insumo. Existencias y costos se manejan desde Inventario.
        </Text>

        <Boton titulo={insumoEditando ? 'Guardar cambios' : 'Crear insumo'} onPress={guardarInsumoActual} />
      </ModalBase>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  pantalla: {
    flex: 1,
    backgroundColor: '#F7F8F7',
  },
  header: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E7E8E7',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerTexto: {
    flex: 1,
  },
  titulo: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1D2D28',
  },
  subtitulo: {
    marginTop: 3,
    fontSize: 13,
    color: '#69736F',
  },
  tabsPrincipales: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    gap: 8,
  },
  contenido: {
    padding: 16,
    paddingBottom: 40,
  },
  accionesArriba: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  flex1: {
    flex: 1,
  },
  inputBusqueda: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: '#D9DDDB',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 13,
    color: '#1F2724',
    fontSize: 15,
  },
  filtrosFila: {
    gap: 8,
    paddingBottom: 6,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 20,
    backgroundColor: '#EEF1EF',
    borderWidth: 1,
    borderColor: '#E0E4E2',
  },
  chipActivo: {
    backgroundColor: '#2E5A4F',
    borderColor: '#2E5A4F',
  },
  chipTexto: {
    color: '#3D4945',
    fontSize: 13,
    fontWeight: '700',
  },
  chipTextoActivo: {
    color: '#FFFFFF',
  },
  resumenTexto: {
    marginTop: 8,
    marginBottom: 10,
    color: '#6C7571',
    fontSize: 13,
    fontWeight: '600',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E4E7E5',
    padding: 15,
    marginBottom: 12,
  },
  cardFilaSuperior: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  cardTitulo: {
    color: '#1D2925',
    fontSize: 18,
    fontWeight: '800',
  },
  cardMeta: {
    color: '#78817E',
    marginTop: 3,
    fontSize: 13,
  },
  precioCaja: {
    alignItems: 'flex-end',
  },
  precioEtiqueta: {
    color: '#8A928F',
    fontSize: 11,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  precioTexto: {
    marginTop: 2,
    color: '#2E5A4F',
    fontSize: 17,
    fontWeight: '800',
  },
  stockCaja: {
    alignItems: 'flex-end',
    maxWidth: '45%',
  },
  stockTexto: {
    marginTop: 2,
    color: '#2E5A4F',
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'right',
  },
  estadoFila: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 13,
  },
  estadoBadge: {
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 10,
  },
  estadoCompleto: {
    backgroundColor: '#DDEEE8',
  },
  estadoProceso: {
    backgroundColor: '#FFF1D5',
  },
  estadoSin: {
    backgroundColor: '#EFEFEF',
  },
  estadoTexto: {
    color: '#34413D',
    fontWeight: '800',
    fontSize: 12,
  },
  ingredientesTexto: {
    color: '#7A8380',
    fontSize: 12,
  },
  metricasFila: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 13,
  },
  metrica: {
    flex: 1,
    backgroundColor: '#F6F8F7',
    borderRadius: 12,
    padding: 10,
  },
  metricaEtiqueta: {
    color: '#89918E',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  metricaValor: {
    color: '#26342F',
    fontSize: 14,
    fontWeight: '800',
    marginTop: 4,
  },
  botonesCard: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
  },
  boton: {
    minHeight: 42,
    borderRadius: 11,
    paddingHorizontal: 15,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2E5A4F',
  },
  botonCompacto: {
    minHeight: 38,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  botonSecundario: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CCD3D0',
  },
  botonSuave: {
    backgroundColor: '#EEF3F1',
  },
  botonPeligro: {
    backgroundColor: '#FFF2F0',
    borderWidth: 1,
    borderColor: '#F2C9C3',
  },
  botonDeshabilitado: {
    opacity: 0.45,
  },
  botonTexto: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },
  botonTextoOscuro: {
    color: '#33413C',
  },
  botonTextoPeligro: {
    color: '#A4483A',
  },
  presionado: {
    opacity: 0.72,
  },
  vacio: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E4E7E5',
    padding: 24,
    alignItems: 'center',
  },
  vacioTitulo: {
    color: '#26322E',
    fontSize: 16,
    fontWeight: '800',
  },
  vacioTexto: {
    marginTop: 5,
    color: '#78817E',
    textAlign: 'center',
  },
  detalleTexto: {
    color: '#65706C',
    marginTop: 7,
    fontSize: 13,
  },
  avisoPendiente: {
    backgroundColor: '#FFF3D8',
    borderRadius: 10,
    padding: 9,
    marginTop: 11,
  },
  avisoPendienteTexto: {
    color: '#745715',
    fontWeight: '700',
    fontSize: 12,
  },
  modalFondo: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  modalCaja: {
    maxHeight: '92%',
    backgroundColor: '#F8F9F8',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 15,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E4E7E5',
  },
  modalTitulo: {
    flex: 1,
    color: '#1D2A25',
    fontSize: 19,
    fontWeight: '800',
  },
  cerrar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFF2F0',
  },
  cerrarTexto: {
    color: '#3E4A46',
    fontSize: 18,
    fontWeight: '700',
  },
  modalContenido: {
    padding: 18,
    paddingBottom: 36,
  },
  campoGrupo: {
    marginBottom: 13,
  },
  campoEtiqueta: {
    color: '#44504C',
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 6,
  },
  input: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: '#D4DAD7',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 13,
    fontSize: 15,
    color: '#1F2724',
  },
  seccionTitulo: {
    color: '#26332F',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 10,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  separador: {
    height: 1,
    backgroundColor: '#E1E5E3',
    marginVertical: 18,
  },
  ayudaTexto: {
    color: '#737D79',
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 12,
  },
  ingredienteCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    padding: 11,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E6E4',
    marginBottom: 8,
  },
  ingredienteNombre: {
    color: '#26322E',
    fontSize: 14,
    fontWeight: '800',
  },
  ingredienteCantidad: {
    color: '#737C79',
    fontSize: 12,
    marginTop: 2,
  },
  listaInsumosReceta: {
    marginTop: 10,
    marginBottom: 14,
    maxHeight: 230,
  },
  insumoOpcion: {
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#DDE2DF',
    backgroundColor: '#FFFFFF',
    marginBottom: 7,
  },
  insumoOpcionActiva: {
    backgroundColor: '#DCEBE6',
    borderColor: '#2E5A4F',
  },
  insumoOpcionTexto: {
    color: '#3D4945',
    fontSize: 13,
    fontWeight: '700',
  },
  insumoOpcionTextoActivo: {
    color: '#23483F',
  },
  botonesModalFila: {
    gap: 9,
  },
});
