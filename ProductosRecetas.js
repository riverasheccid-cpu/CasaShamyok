import React, { useMemo, useState } from 'react';
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

const TIPOS_PRODUCTO = ['Fijo', 'Bebida configurable', 'Arma el tuyo'];
const ESTADOS_RECETA = ['Sin receta', 'En proceso', 'Completa'];
const FILTROS = ['Todos', 'Fijo', 'Bebida configurable', 'Arma el tuyo'];
const MODOS_SELECCION = ['Única', 'Múltiple'];
const ACCIONES_INVENTARIO = ['Agregar', 'Sustituir', 'Ninguno'];

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
  exito: '#3E7651',
  aviso: '#9A6B22',
};

const numero = (v) => {
  const n = Number(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};

const texto = (v) => String(v ?? '').trim();
const uid = (p = 'TMP') => `${p}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const dinero = (v) =>
  `$${numero(v).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const copia = (obj) => JSON.parse(JSON.stringify(obj ?? null));

function Boton({ titulo, onPress, tipo = 'principal', disabled = false, compacto = false }) {
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
        pressed && !disabled && { opacity: 0.78 },
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

function Chip({ label, activo, onPress, disabled = false }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.chip,
        activo && styles.chipActivo,
        disabled && styles.chipDisabled,
        pressed && !disabled && { opacity: 0.78 },
      ]}
    >
      <Text style={[styles.chipTexto, activo && styles.chipTextoActivo]}>{label}</Text>
    </Pressable>
  );
}

function Campo({
  etiqueta,
  value,
  onChangeText,
  placeholder = '',
  keyboardType = 'default',
  multiline = false,
  ayuda = '',
}) {
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
      {!!ayuda && <Text style={styles.ayuda}>{ayuda}</Text>}
    </View>
  );
}

function Toggle({ label, value, onChange, ayuda = '' }) {
  return (
    <Pressable style={styles.toggleFila} onPress={() => onChange(!value)}>
      <View style={{ flex: 1 }}>
        <Text style={styles.toggleLabel}>{label}</Text>
        {!!ayuda && <Text style={styles.ayuda}>{ayuda}</Text>}
      </View>
      <View style={[styles.switchBase, value && styles.switchOn]}>
        <View style={[styles.switchPunto, value && styles.switchPuntoOn]} />
      </View>
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
            <Pressable onPress={onCerrar} style={styles.cerrarBtn}>
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

function EncabezadoSeccion({ titulo, texto: descripcion }) {
  return (
    <View style={styles.encabezadoSeccion}>
      <Text style={styles.seccionTitulo}>{titulo}</Text>
      {!!descripcion && <Text style={styles.seccionTexto}>{descripcion}</Text>}
    </View>
  );
}

function Estado({ children, tipo = 'normal' }) {
  return (
    <View
      style={[
        styles.estado,
        tipo === 'ok' && styles.estadoOk,
        tipo === 'aviso' && styles.estadoAviso,
        tipo === 'peligro' && styles.estadoPeligro,
      ]}
    >
      <Text style={styles.estadoTexto}>{children}</Text>
    </View>
  );
}

function RecetaEditor({ receta, onChange, insumos, estado, onEstadoChange }) {
  const [buscar, setBuscar] = useState('');
  const [insumoId, setInsumoId] = useState(null);
  const [cantidad, setCantidad] = useState('');

  const opciones = useMemo(() => {
    const q = buscar.toLowerCase().trim();
    return [...insumos]
      .filter((i) => !q || `${i.nombre || ''} ${i.categoria || ''}`.toLowerCase().includes(q))
      .sort((a, b) => String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es'));
  }, [insumos, buscar]);

  const agregar = () => {
    if (!insumoId) return Alert.alert('Selecciona un insumo');
    const cant = numero(cantidad);
    if (cant <= 0) return Alert.alert('Cantidad inválida', 'Escribe una cantidad mayor a 0.');
    const ins = insumos.find((i) => i.id === insumoId);
    if (!ins) return;

    const existente = receta.find((r) => r.insumoId === insumoId);
    let nueva;
    if (existente) {
      nueva = receta.map((r) =>
        r.insumoId === insumoId ? { ...r, cantidad: numero(r.cantidad) + cant } : r
      );
    } else {
      nueva = [
        ...receta,
        {
          id: uid('REC'),
          insumoId,
          insumoNombre: ins.nombre,
          cantidad: cant,
          unidadBase: ins.unidadBase || '',
        },
      ];
    }
    onChange(nueva);
    if (estado === 'Sin receta') onEstadoChange?.('En proceso');
    setInsumoId(null);
    setCantidad('');
  };

  return (
    <View>
      {!!onEstadoChange && (
        <>
          <Text style={styles.etiqueta}>Estado de receta</Text>
          <View style={styles.chipsWrap}>
            {ESTADOS_RECETA.map((e) => (
              <Chip key={e} label={e} activo={estado === e} onPress={() => onEstadoChange(e)} />
            ))}
          </View>
        </>
      )}

      <Campo etiqueta="Buscar insumo" value={buscar} onChangeText={setBuscar} placeholder="Ej. leche, café..." />

      <Text style={styles.etiqueta}>Selecciona ingrediente</Text>
      <View style={styles.listaSeleccion}>
        {opciones.slice(0, 18).map((ins) => (
          <Pressable
            key={ins.id}
            onPress={() => setInsumoId(ins.id)}
            style={[styles.opcionFila, insumoId === ins.id && styles.opcionFilaActiva]}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.opcionTitulo}>{ins.nombre}</Text>
              <Text style={styles.opcionMeta}>{ins.unidadBase || 'unidad'} · {ins.categoria || 'General'}</Text>
            </View>
            {insumoId === ins.id && <Text style={styles.check}>✓</Text>}
          </Pressable>
        ))}
      </View>

      <Campo
        etiqueta="Cantidad usada"
        value={cantidad}
        onChangeText={setCantidad}
        keyboardType="decimal-pad"
        placeholder="Ej. 250"
      />
      <Boton titulo="Agregar ingrediente" onPress={agregar} />

      <View style={{ height: 14 }} />
      <Text style={styles.etiqueta}>Ingredientes de esta receta</Text>
      {receta.length === 0 ? (
        <Text style={styles.vacioTexto}>Todavía no hay ingredientes. Esto no impide vender el producto.</Text>
      ) : (
        receta.map((r) => (
          <View key={r.id || `${r.insumoId}_${r.cantidad}`} style={styles.recetaFila}>
            <View style={{ flex: 1 }}>
              <Text style={styles.recetaNombre}>{r.insumoNombre || insumos.find((i) => i.id === r.insumoId)?.nombre || 'Insumo'}</Text>
              <Text style={styles.recetaCantidad}>{r.cantidad} {r.unidadBase || insumos.find((i) => i.id === r.insumoId)?.unidadBase || ''}</Text>
            </View>
            <Pressable
              onPress={() => onChange(receta.filter((x) => (x.id || x.insumoId) !== (r.id || r.insumoId)))}
              style={styles.miniPeligro}
            >
              <Text style={styles.miniPeligroTxt}>Quitar</Text>
            </Pressable>
          </View>
        ))
      )}
    </View>
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
    agregarInsumo,
    editarInsumo,
    eliminarInsumo,
    calcularCostoFIFO,
  } = useNegocio();

  const [seccion, setSeccion] = useState('Productos');
  const [filtro, setFiltro] = useState('Todos');
  const [buscarProducto, setBuscarProducto] = useState('');
  const [buscarInsumo, setBuscarInsumo] = useState('');

  const [modalProducto, setModalProducto] = useState(false);
  const [productoEditando, setProductoEditando] = useState(null);
  const [productoDraft, setProductoDraft] = useState(null);

  const [modalReceta, setModalReceta] = useState(false);
  const [productoReceta, setProductoReceta] = useState(null);
  const [recetaDraft, setRecetaDraft] = useState([]);
  const [estadoRecetaDraft, setEstadoRecetaDraft] = useState('Sin receta');

  const [modalConfig, setModalConfig] = useState(false);
  const [configDraft, setConfigDraft] = useState(null);
  const [configTab, setConfigTab] = useState('Estructura');

  const [modalPresentacion, setModalPresentacion] = useState(false);
  const [presentacionEditandoId, setPresentacionEditandoId] = useState(null);
  const [presentacionDraft, setPresentacionDraft] = useState(null);

  const [modalTamano, setModalTamano] = useState(false);
  const [tamanoEditandoId, setTamanoEditandoId] = useState(null);
  const [tamanoDraft, setTamanoDraft] = useState(null);

  const [modalReglasTamano, setModalReglasTamano] = useState(false);
  const [tamanoReglasId, setTamanoReglasId] = useState(null);
  const [reglasDraft, setReglasDraft] = useState([]);

  const [modalSeccion, setModalSeccion] = useState(false);
  const [seccionEditandoId, setSeccionEditandoId] = useState(null);
  const [seccionDraft, setSeccionDraft] = useState(null);

  const [modalOpcion, setModalOpcion] = useState(false);
  const [seccionOpcionId, setSeccionOpcionId] = useState(null);
  const [opcionEditandoId, setOpcionEditandoId] = useState(null);
  const [opcionDraft, setOpcionDraft] = useState(null);

  const [modalRecetaPresentacion, setModalRecetaPresentacion] = useState(false);
  const [presentacionRecetaId, setPresentacionRecetaId] = useState(null);
  const [recetaPresentacionDraft, setRecetaPresentacionDraft] = useState([]);
  const [estadoRecetaPresentacion, setEstadoRecetaPresentacion] = useState('Sin receta');

  const [modalInsumo, setModalInsumo] = useState(false);
  const [insumoEditando, setInsumoEditando] = useState(null);
  const [insumoDraft, setInsumoDraft] = useState(null);

  const productosVisibles = useMemo(() => {
    const q = buscarProducto.toLowerCase().trim();
    return [...productos]
      .filter((p) => filtro === 'Todos' || (p.tipoProducto || 'Fijo') === filtro)
      .filter((p) => !q || `${p.nombre || ''} ${p.categoria || ''}`.toLowerCase().includes(q))
      .sort((a, b) => String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es'));
  }, [productos, filtro, buscarProducto]);

  const insumosVisibles = useMemo(() => {
    const q = buscarInsumo.toLowerCase().trim();
    return [...insumos]
      .filter((i) => !q || `${i.nombre || ''} ${i.categoria || ''}`.toLowerCase().includes(q))
      .sort((a, b) => String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es'));
  }, [insumos, buscarInsumo]);

  const costoReceta = (receta = []) => {
    if (!receta.length) return { total: null, texto: 'Costo pendiente', estado: 'pendiente' };
    let total = 0;
    for (const ing of receta) {
      const r = calcularCostoFIFO(ing.insumoId, numero(ing.cantidad));
      if (!r?.ok || r?.costoPendiente) return { total: null, texto: 'Costo pendiente', estado: 'pendiente' };
      total += numero(r.costo);
    }
    return { total, texto: dinero(total), estado: 'ok' };
  };

  const abrirNuevoProducto = () => {
    setProductoEditando(null);
    setProductoDraft({
      nombre: '', categoria: 'General', precio: '', tipoProducto: 'Fijo',
      descripcionPreparacion: '', imagenUri: '', activo: true,
      permiteNotas: true, permiteModificarIngredientes: true,
    });
    setModalProducto(true);
  };

  const abrirEditarProducto = (p) => {
    setProductoEditando(p);
    setProductoDraft({
      nombre: p.nombre || '', categoria: p.categoria || 'General', precio: String(p.precio ?? ''),
      tipoProducto: p.tipoProducto || 'Fijo', descripcionPreparacion: p.descripcionPreparacion || '',
      imagenUri: p.imagenUri || '', activo: p.activo !== false,
      permiteNotas: p.permiteNotas !== false,
      permiteModificarIngredientes: p.permiteModificarIngredientes !== false,
    });
    setModalProducto(true);
  };

  const guardarProductoActual = () => {
    const d = productoDraft || {};
    if (!texto(d.nombre)) return Alert.alert('Falta nombre', 'Escribe el nombre del producto.');
    const payload = {
      nombre: texto(d.nombre), categoria: texto(d.categoria) || 'General', precio: numero(d.precio),
      tipoProducto: d.tipoProducto || 'Fijo', descripcionPreparacion: texto(d.descripcionPreparacion),
      imagenUri: texto(d.imagenUri) || null, activo: d.activo !== false,
      permiteNotas: d.permiteNotas !== false,
      permiteModificarIngredientes: d.permiteModificarIngredientes !== false,
    };
    const r = productoEditando
      ? editarProducto(productoEditando.id, payload)
      : agregarProducto({ ...payload, receta: [], estadoReceta: 'Sin receta' });
    if (!r?.ok) return Alert.alert('No se pudo guardar', r?.mensaje || 'Revisa los datos.');
    setModalProducto(false);
  };

  const abrirReceta = (p) => {
    setProductoReceta(p);
    setRecetaDraft(copia(p.receta || []) || []);
    setEstadoRecetaDraft(p.estadoReceta || ((p.receta || []).length ? 'En proceso' : 'Sin receta'));
    setModalReceta(true);
  };

  const guardarReceta = () => {
    if (!productoReceta) return;
    let estado = estadoRecetaDraft;
    if (!recetaDraft.length) estado = 'Sin receta';
    if (recetaDraft.length && estado === 'Sin receta') estado = 'En proceso';
    const r = guardarRecetaProducto({ productoId: productoReceta.id, receta: recetaDraft, estadoReceta: estado });
    if (!r?.ok) return Alert.alert('No se pudo guardar', r?.mensaje || 'Revisa la receta.');
    setModalReceta(false);
  };

  const abrirConfig = (p) => {
    setConfigDraft({
      ...copia(p),
      preparaciones: copia(p.preparaciones || []) || [],
      presentaciones: copia(p.presentaciones || []) || [],
      tamanos: copia(p.tamanos || []) || [],
      seccionesPersonalizacion: copia(p.seccionesPersonalizacion || []) || [],
    });
    setConfigTab('Estructura');
    setModalConfig(true);
  };

  const guardarConfig = () => {
    if (!configDraft?.id) return;
    const r = editarProducto(configDraft.id, {
      preparaciones: configDraft.preparaciones || [],
      presentaciones: configDraft.presentaciones || [],
      tamanos: configDraft.tamanos || [],
      seccionesPersonalizacion: configDraft.seccionesPersonalizacion || [],
    });
    if (!r?.ok) return Alert.alert('No se pudo guardar', r?.mensaje || 'Revisa la configuración.');
    setModalConfig(false);
  };

  const agregarPreparacion = () => {
    Alert.prompt(
      'Nueva preparación',
      'Escribe el nombre, por ejemplo Caliente o Fría.',
      (valor) => {
        const nombre = texto(valor);
        if (!nombre) return;
        if ((configDraft.preparaciones || []).some((x) => x.nombre.toLowerCase() === nombre.toLowerCase())) return;
        setConfigDraft((d) => ({ ...d, preparaciones: [...(d.preparaciones || []), { id: uid('PREP'), nombre, activo: true }] }));
      }
    );
  };

  const quitarPreparacion = (id) => {
    const usada = (configDraft.presentaciones || []).some((p) => p.preparacionId === id);
    if (usada) return Alert.alert('Preparación en uso', 'Primero elimina o edita las presentaciones que usan esta preparación.');
    setConfigDraft((d) => ({ ...d, preparaciones: (d.preparaciones || []).filter((x) => x.id !== id) }));
  };

  const abrirNuevaPresentacion = () => {
    setPresentacionEditandoId(null);
    setPresentacionDraft({ nombre: '', precio: '', preparacionId: null, receta: [], estadoReceta: 'Sin receta', activa: true });
    setModalConfig(false);
    setTimeout(() => setModalPresentacion(true), 400);
  };

  const abrirEditarPresentacion = (p) => {
    setPresentacionEditandoId(p.id);
    setPresentacionDraft({ ...copia(p), precio: String(p.precio ?? '') });
    setModalConfig(false);
    setTimeout(() => setModalPresentacion(true), 400);
  };

  const guardarPresentacion = () => {
    const d = presentacionDraft || {};
    if (!texto(d.nombre)) return Alert.alert('Falta nombre');
    if (configDraft.tipoProducto === 'Bebida configurable' && !d.preparacionId) {
      return Alert.alert('Falta preparación', 'Selecciona a qué preparación pertenece esta presentación.');
    }
    const item = {
      ...d,
      id: presentacionEditandoId || uid('PRES'),
      nombre: texto(d.nombre), precio: numero(d.precio),
      receta: Array.isArray(d.receta) ? d.receta : [],
      estadoReceta: d.estadoReceta || ((d.receta || []).length ? 'En proceso' : 'Sin receta'),
    };
    setConfigDraft((x) => ({
      ...x,
      presentaciones: presentacionEditandoId
        ? (x.presentaciones || []).map((p) => p.id === presentacionEditandoId ? item : p)
        : [...(x.presentaciones || []), item],
    }));
    setModalPresentacion(false);
    setTimeout(() => setModalConfig(true), 400);
  };

  const abrirRecetaPresentacion = (p) => {
    setPresentacionRecetaId(p.id);
    setRecetaPresentacionDraft(copia(p.receta || []) || []);
    setEstadoRecetaPresentacion(p.estadoReceta || ((p.receta || []).length ? 'En proceso' : 'Sin receta'));
    setModalConfig(false);
    setTimeout(() => setModalRecetaPresentacion(true), 400);
  };

  const guardarRecetaPresentacion = () => {
    let estado = estadoRecetaPresentacion;
    if (!recetaPresentacionDraft.length) estado = 'Sin receta';
    if (recetaPresentacionDraft.length && estado === 'Sin receta') estado = 'En proceso';
    setConfigDraft((d) => ({
      ...d,
      presentaciones: (d.presentaciones || []).map((p) =>
        p.id === presentacionRecetaId ? { ...p, receta: recetaPresentacionDraft, estadoReceta: estado } : p
      ),
    }));
    setModalRecetaPresentacion(false);
    setTimeout(() => setModalConfig(true), 400);
  };

  const abrirNuevoTamano = () => {
    setTamanoEditandoId(null);
    setTamanoDraft({ nombre: '', precio: '', activo: true, reglasSecciones: [] });
    setModalConfig(false);
    setTimeout(() => setModalTamano(true), 400);
  };

  const abrirEditarTamano = (t) => {
    setTamanoEditandoId(t.id);
    setTamanoDraft({ ...copia(t), precio: String(t.precio ?? '') });
    setModalConfig(false);
    setTimeout(() => setModalTamano(true), 400);
  };

  const guardarTamano = () => {
    const d = tamanoDraft || {};
    if (!texto(d.nombre)) return Alert.alert('Falta nombre');
    const item = { ...d, id: tamanoEditandoId || uid('TAM'), nombre: texto(d.nombre), precio: numero(d.precio), reglasSecciones: d.reglasSecciones || [] };
    setConfigDraft((x) => ({
      ...x,
      tamanos: tamanoEditandoId
        ? (x.tamanos || []).map((t) => t.id === tamanoEditandoId ? item : t)
        : [...(x.tamanos || []), item],
    }));
    setModalTamano(false);
    setTimeout(() => setModalConfig(true), 400);
  };

  const abrirReglasTamano = (t) => {
    setModalConfig(false);
    const secciones = configDraft.seccionesPersonalizacion || [];
    const existentes = t.reglasSecciones || [];
    setTamanoReglasId(t.id);
    setReglasDraft(secciones.map((s) => {
      const r = existentes.find((x) => x.seccionId === s.id);
      return {
        seccionId: s.id,
        nombre: s.nombre,
        incluidas: String(r?.incluidas ?? 0),
        permiteExtras: r?.permiteExtras === true,
        precioExtra: String(r?.precioExtra ?? 0),
      };
    }));
    setTimeout(() => setModalReglasTamano(true), 400);
  };

  const guardarReglasTamano = () => {
    const reglas = reglasDraft.map((r) => ({
      seccionId: r.seccionId,
      incluidas: Math.max(0, Math.floor(numero(r.incluidas))),
      permiteExtras: r.permiteExtras === true,
      precioExtra: Math.max(0, numero(r.precioExtra)),
    }));
    setConfigDraft((d) => ({
      ...d,
      tamanos: (d.tamanos || []).map((t) => t.id === tamanoReglasId ? { ...t, reglasSecciones: reglas } : t),
    }));
    setModalReglasTamano(false);
    setTimeout(() => setModalConfig(true), 400);
  };

  const abrirNuevaSeccion = () => {
    setSeccionEditandoId(null);
    setSeccionDraft({ nombre: '', tipoSeleccion: 'Única', obligatoria: false, min: '0', max: '1', activa: true, opciones: [] });
    setModalConfig(false);
    setTimeout(() => setModalSeccion(true), 400);
  };

  const abrirEditarSeccion = (s) => {
    setSeccionEditandoId(s.id);
    setSeccionDraft({ ...copia(s), min: String(s.min ?? 0), max: String(s.max ?? 1) });
    setModalConfig(false);
    setTimeout(() => setModalSeccion(true), 400);
  };

  const guardarSeccion = () => {
    const d = seccionDraft || {};
    if (!texto(d.nombre)) return Alert.alert('Falta nombre de la sección');
    const item = {
      ...d,
      id: seccionEditandoId || uid('SEC'),
      nombre: texto(d.nombre),
      min: Math.max(0, Math.floor(numero(d.min))),
      max: Math.max(1, Math.floor(numero(d.max) || 1)),
      opciones: Array.isArray(d.opciones) ? d.opciones : [],
    };
    if (item.tipoSeleccion === 'Única') item.max = 1;
    setConfigDraft((x) => ({
      ...x,
      seccionesPersonalizacion: seccionEditandoId
        ? (x.seccionesPersonalizacion || []).map((s) => s.id === seccionEditandoId ? item : s)
        : [...(x.seccionesPersonalizacion || []), item],
    }));
    setModalSeccion(false);
    setTimeout(() => setModalConfig(true), 400);
  };

  const abrirNuevaOpcion = (seccionId) => {
    setSeccionOpcionId(seccionId);
    setOpcionEditandoId(null);
    setOpcionDraft({
      nombre: '', ajustePrecio: '0', accionInventario: 'Agregar', insumoId: null,
      cantidad: '', reemplazaInsumoId: null, activa: true,
      valoresPorPresentacion: [], valoresPorTamano: [],
    });
    setModalConfig(false);
    setTimeout(() => setModalOpcion(true), 400);
  };

  const abrirEditarOpcion = (seccionId, op) => {
    setSeccionOpcionId(seccionId);
    setOpcionEditandoId(op.id);
    setOpcionDraft({
      ...copia(op),
      ajustePrecio: String(op.ajustePrecio ?? 0),
      cantidad: String(op.cantidad ?? ''),
      valoresPorPresentacion: (op.valoresPorPresentacion || []).map((v) => ({
        ...v,
        cantidad: String(v.cantidad ?? ''),
        ajustePrecio: String(v.ajustePrecio ?? 0),
      })),
      valoresPorTamano: (op.valoresPorTamano || []).map((v) => ({
        ...v,
        cantidad: String(v.cantidad ?? ''),
        ajustePrecio: String(v.ajustePrecio ?? 0),
      })),
    });
    setModalConfig(false);
    setTimeout(() => setModalOpcion(true), 400);
  };

  const guardarOpcion = () => {
    const d = opcionDraft || {};
    if (!texto(d.nombre)) return Alert.alert('Falta nombre de la opción');
    if (d.accionInventario !== 'Ninguno' && !d.insumoId) {
      return Alert.alert('Falta insumo', 'Selecciona el insumo que consume esta opción o elige “Ninguno”.');
    }
    if (d.accionInventario === 'Sustituir' && !d.reemplazaInsumoId) {
      return Alert.alert('Falta sustitución', 'Selecciona qué insumo de la receta base sustituye esta opción.');
    }

    const presentacionesActivas = (configDraft?.presentaciones || []).filter((p) => p.activa !== false);
    const tamanosActivos = (configDraft?.tamanos || []).filter((t) => t.activo !== false);
    const requierePresentaciones = configDraft?.tipoProducto === 'Bebida configurable';
    const requiereTamanos = configDraft?.tipoProducto === 'Arma el tuyo';

    if (requierePresentaciones && presentacionesActivas.length === 0) {
      return Alert.alert('Faltan presentaciones', 'Primero crea las presentaciones de esta bebida. Después podrás indicar cuánto consume cada personalización en cada presentación.');
    }
    if (requiereTamanos && tamanosActivos.length === 0) {
      return Alert.alert('Faltan tamaños', 'Primero crea los tamaños. Después podrás indicar cuánto consume cada personalización en cada tamaño.');
    }

    const usaPresentaciones = presentacionesActivas.length > 0;
    const usaTamanos = !usaPresentaciones && tamanosActivos.length > 0;

    const valoresPorPresentacion = presentacionesActivas.map((p) => {
      const valor = (d.valoresPorPresentacion || []).find((v) => v.presentacionId === p.id) || {};
      return {
        presentacionId: p.id,
        presentacionNombre: p.nombre,
        cantidad: d.accionInventario === 'Ninguno' ? 0 : numero(valor.cantidad),
        ajustePrecio: numero(valor.ajustePrecio),
      };
    });

    const valoresPorTamano = tamanosActivos.map((t) => {
      const valor = (d.valoresPorTamano || []).find((v) => v.tamanoId === t.id) || {};
      return {
        tamanoId: t.id,
        tamanoNombre: t.nombre,
        cantidad: d.accionInventario === 'Ninguno' ? 0 : numero(valor.cantidad),
        ajustePrecio: numero(valor.ajustePrecio),
      };
    });

    if (d.accionInventario !== 'Ninguno') {
      if (usaPresentaciones) {
        const falta = valoresPorPresentacion.find((v) => numero(v.cantidad) <= 0);
        if (falta) return Alert.alert('Cantidad inválida', 'Indica cuánto inventario consume esta opción en ' + falta.presentacionNombre + '.');
      } else if (usaTamanos) {
        const falta = valoresPorTamano.find((v) => numero(v.cantidad) <= 0);
        if (falta) return Alert.alert('Cantidad inválida', 'Indica cuánto inventario consume esta opción en ' + falta.tamanoNombre + '.');
      } else if (numero(d.cantidad) <= 0) {
        return Alert.alert('Cantidad inválida', 'Indica cuánto inventario consume esta opción.');
      }
    }

    const ins = insumos.find((i) => i.id === d.insumoId);
    const rep = insumos.find((i) => i.id === d.reemplazaInsumoId);
    const item = {
      ...d,
      id: opcionEditandoId || uid('OP'),
      nombre: texto(d.nombre),
      ajustePrecio: usaPresentaciones || usaTamanos ? 0 : numero(d.ajustePrecio),
      cantidad: d.accionInventario === 'Ninguno' || usaPresentaciones || usaTamanos ? 0 : numero(d.cantidad),
      valoresPorPresentacion: usaPresentaciones ? valoresPorPresentacion : [],
      valoresPorTamano: usaTamanos ? valoresPorTamano : [],
      insumoNombre: ins?.nombre || '',
      reemplazaInsumoNombre: rep?.nombre || '',
      insumoId: d.accionInventario === 'Ninguno' ? null : d.insumoId,
      reemplazaInsumoId: d.accionInventario === 'Sustituir' ? d.reemplazaInsumoId : null,
    };

    setConfigDraft((x) => ({
      ...x,
      seccionesPersonalizacion: (x.seccionesPersonalizacion || []).map((s) => {
        if (s.id !== seccionOpcionId) return s;
        return {
          ...s,
          opciones: opcionEditandoId
            ? (s.opciones || []).map((o) => o.id === opcionEditandoId ? item : o)
            : [...(s.opciones || []), item],
        };
      }),
    }));
    setModalOpcion(false);
    setTimeout(() => setModalConfig(true), Platform.OS === 'ios' ? 350 : 50);
  };

  const abrirNuevoInsumo = () => {
    setInsumoEditando(null);
    setInsumoDraft({ nombre: '', categoria: 'General', presentacionCompra: '', contenidoPresentacion: '', unidadBase: 'unidad', stockMinimo: '' });
    setModalInsumo(true);
  };

  const abrirEditarInsumo = (i) => {
    setInsumoEditando(i);
    setInsumoDraft({
      nombre: i.nombre || '', categoria: i.categoria || 'General',
      presentacionCompra: i.presentacionCompra || i.presentacion || '',
      contenidoPresentacion: String(i.contenidoPresentacion ?? ''), unidadBase: i.unidadBase || 'unidad',
      stockMinimo: String(i.stockMinimo ?? ''),
    });
    setModalInsumo(true);
  };

  const guardarInsumo = () => {
    const d = insumoDraft || {};
    if (!texto(d.nombre)) return Alert.alert('Falta nombre');
    const payload = {
      nombre: texto(d.nombre), categoria: texto(d.categoria) || 'General',
      presentacionCompra: texto(d.presentacionCompra), presentacion: texto(d.presentacionCompra),
      contenidoPresentacion: numero(d.contenidoPresentacion), unidadBase: texto(d.unidadBase) || 'unidad',
      stockMinimo: numero(d.stockMinimo),
    };
    const r = insumoEditando ? editarInsumo(insumoEditando.id, payload) : agregarInsumo(payload);
    if (!r?.ok) return Alert.alert('No se pudo guardar', r?.mensaje || 'Revisa los datos.');
    setModalInsumo(false);
  };

  const confirmarEliminarProducto = (p) => {
    Alert.alert('Eliminar producto', `¿Eliminar ${p.nombre}?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: () => {
        const r = eliminarProducto(p.id);
        if (!r?.ok) Alert.alert('No se puede eliminar', r?.mensaje || 'No fue posible.');
      } },
    ]);
  };

  return (
    <SafeAreaView style={styles.pantalla}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.titulo}>Productos y recetas</Text>
          <Text style={styles.subtitulo}>Catálogo flexible para vender desde hoy, aun sin receta completa.</Text>
        </View>
        {volver ? <Boton titulo="Volver" tipo="secundario" compacto onPress={volver} /> : null}
      </View>

      <View style={styles.tabsTop}>
        <Chip label="Productos" activo={seccion === 'Productos'} onPress={() => setSeccion('Productos')} />
        <Chip label="Insumos" activo={seccion === 'Insumos'} onPress={() => setSeccion('Insumos')} />
      </View>

      {seccion === 'Productos' ? (
        <ScrollView contentContainerStyle={styles.contenido} keyboardShouldPersistTaps="handled">
          <View style={styles.filaAcciones}>
            <TextInput
              value={buscarProducto}
              onChangeText={setBuscarProducto}
              placeholder="Buscar producto..."
              placeholderTextColor="#A39A92"
              style={[styles.input, { flex: 1 }]}
            />
            <Boton titulo="+ Producto" compacto onPress={abrirNuevoProducto} />
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsFila}>
            {FILTROS.map((f) => <Chip key={f} label={f} activo={filtro === f} onPress={() => setFiltro(f)} />)}
          </ScrollView>

          {productosVisibles.length === 0 ? (
            <View style={styles.vacio}><Text style={styles.vacioTitulo}>No hay productos</Text><Text style={styles.vacioTexto}>Crea el primero para empezar a registrar ventas.</Text></View>
          ) : productosVisibles.map((p) => {
            const costo = costoReceta(p.receta || []);
            const estado = p.estadoReceta || ((p.receta || []).length ? 'En proceso' : 'Sin receta');
            return (
              <View key={p.id} style={styles.card}>
                <View style={styles.cardTop}>
                  <View style={styles.iconoProducto}><Text style={styles.iconoProductoTxt}>{p.tipoProducto === 'Bebida configurable' ? '☕' : p.tipoProducto === 'Arma el tuyo' ? '🥗' : '▣'}</Text></View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitulo}>{p.nombre}</Text>
                    <Text style={styles.cardMeta}>{p.categoria || 'General'} · {p.tipoProducto || 'Fijo'}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.precio}>{dinero(p.precio)}</Text>
                    {p.activo === false && <Estado tipo="peligro">Inactivo</Estado>}
                  </View>
                </View>

                <View style={styles.estadosFila}>
                  <Estado tipo={estado === 'Completa' ? 'ok' : 'aviso'}>{estado}</Estado>
                  <Estado tipo={costo.estado === 'ok' ? 'ok' : 'aviso'}>{costo.texto}</Estado>
                </View>

                {!!p.descripcionPreparacion && <Text style={styles.preparacionResumen}>Preparación: {p.descripcionPreparacion}</Text>}

                <View style={styles.botonesCard}>
                  <Boton titulo="Editar" tipo="suave" compacto onPress={() => abrirEditarProducto(p)} />
                  <Boton titulo="Receta" tipo="suave" compacto onPress={() => abrirReceta(p)} />
                  <Boton titulo="Configurar" compacto onPress={() => abrirConfig(p)} />
                  <Boton titulo="Eliminar" tipo="peligro" compacto onPress={() => confirmarEliminarProducto(p)} />
                </View>
              </View>
            );
          })}
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={styles.contenido} keyboardShouldPersistTaps="handled">
          <View style={styles.filaAcciones}>
            <TextInput
              value={buscarInsumo}
              onChangeText={setBuscarInsumo}
              placeholder="Buscar insumo..."
              placeholderTextColor="#A39A92"
              style={[styles.input, { flex: 1 }]}
            />
            <Boton titulo="+ Insumo" compacto onPress={abrirNuevoInsumo} />
          </View>
          {insumosVisibles.length === 0 ? (
            <View style={styles.vacio}><Text style={styles.vacioTitulo}>No hay insumos</Text></View>
          ) : insumosVisibles.map((i) => (
            <View key={i.id} style={styles.card}>
              <View style={styles.cardTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitulo}>{i.nombre}</Text>
                  <Text style={styles.cardMeta}>{i.categoria || 'General'} · {i.unidadBase || 'unidad'}</Text>
                </View>
              </View>
              <View style={styles.botonesCard}>
                <Boton titulo="Editar" tipo="suave" compacto onPress={() => abrirEditarInsumo(i)} />
                <Boton titulo="Eliminar" tipo="peligro" compacto onPress={() => {
                  Alert.alert('Eliminar insumo', `¿Eliminar ${i.nombre}?`, [
                    { text: 'Cancelar', style: 'cancel' },
                    { text: 'Eliminar', style: 'destructive', onPress: () => {
                      const r = eliminarInsumo(i.id);
                      if (!r?.ok) Alert.alert('No se puede eliminar', r?.mensaje || 'No fue posible.');
                    } },
                  ]);
                }} />
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      <ModalBase visible={modalProducto} titulo={productoEditando ? 'Editar producto' : 'Nuevo producto'} onCerrar={() => setModalProducto(false)}>
        {productoDraft && <>
          <Campo etiqueta="Nombre" value={productoDraft.nombre} onChangeText={(v) => setProductoDraft({ ...productoDraft, nombre: v })} placeholder="Ej. Latte" />
          <Campo etiqueta="Categoría" value={productoDraft.categoria} onChangeText={(v) => setProductoDraft({ ...productoDraft, categoria: v })} placeholder="Ej. Bebidas" />
          <Campo etiqueta="Precio base" value={productoDraft.precio} onChangeText={(v) => setProductoDraft({ ...productoDraft, precio: v })} keyboardType="decimal-pad" ayuda="Las variantes o personalizaciones pueden modificar este precio." />

          <Text style={styles.etiqueta}>Tipo de producto</Text>
          <View style={styles.chipsWrap}>
            {TIPOS_PRODUCTO.map((t) => <Chip key={t} label={t} activo={productoDraft.tipoProducto === t} onPress={() => setProductoDraft({ ...productoDraft, tipoProducto: t })} />)}
          </View>

          <Campo
            etiqueta="Descripción / preparación"
            value={productoDraft.descripcionPreparacion}
            onChangeText={(v) => setProductoDraft({ ...productoDraft, descripcionPreparacion: v })}
            multiline
            placeholder="Instrucciones que el personal puede consultar durante la preparación."
          />
          <Campo etiqueta="Imagen (opcional)" value={productoDraft.imagenUri} onChangeText={(v) => setProductoDraft({ ...productoDraft, imagenUri: v })} placeholder="Se conectará al selector visual de ventas." />

          <Toggle label="Producto activo" value={productoDraft.activo} onChange={(v) => setProductoDraft({ ...productoDraft, activo: v })} />
          <Toggle label="Permitir notas del cliente" value={productoDraft.permiteNotas} onChange={(v) => setProductoDraft({ ...productoDraft, permiteNotas: v })} />
          <Toggle label="Permitir agregar o quitar ingredientes" value={productoDraft.permiteModificarIngredientes} onChange={(v) => setProductoDraft({ ...productoDraft, permiteModificarIngredientes: v })} />

          <Boton titulo="Guardar producto" onPress={guardarProductoActual} />
        </>}
      </ModalBase>

      <ModalBase visible={modalReceta} titulo={`Receta${productoReceta ? ` · ${productoReceta.nombre}` : ''}`} onCerrar={() => setModalReceta(false)}>
        <Text style={styles.infoCaja}>Puedes dejar la receta vacía o en proceso. El producto seguirá pudiéndose vender y su costo quedará pendiente.</Text>
        <RecetaEditor receta={recetaDraft} onChange={setRecetaDraft} insumos={insumos} estado={estadoRecetaDraft} onEstadoChange={setEstadoRecetaDraft} />
        <View style={{ height: 16 }} />
        <Boton titulo="Guardar receta" onPress={guardarReceta} />
      </ModalBase>

      <ModalBase visible={modalConfig} titulo={`Configurar${configDraft ? ` · ${configDraft.nombre}` : ''}`} onCerrar={() => setModalConfig(false)}>
        {configDraft && <>
          <View style={styles.chipsWrap}>
            <Chip label="Estructura" activo={configTab === 'Estructura'} onPress={() => setConfigTab('Estructura')} />
            <Chip label="Personalizaciones" activo={configTab === 'Personalizaciones'} onPress={() => setConfigTab('Personalizaciones')} />
          </View>

          {configTab === 'Estructura' ? <>
            {configDraft.tipoProducto === 'Bebida configurable' && <>
              <EncabezadoSeccion titulo="Preparaciones" texto="La base es el producto. Después el cliente elige preparación y presentación." />
              <View style={styles.chipsWrap}>
                {(configDraft.preparaciones || []).map((p) => (
                  <Pressable key={p.id} onLongPress={() => quitarPreparacion(p.id)} style={styles.chipGestion}><Text style={styles.chipGestionTxt}>{p.nombre}</Text><Text style={styles.chipGestionX}> ×</Text></Pressable>
                ))}
              </View>
              <Boton titulo="+ Preparación" tipo="suave" onPress={agregarPreparacion} />
            </>}

            {(configDraft.tipoProducto === 'Bebida configurable' || configDraft.tipoProducto === 'Fijo') && <>
              <EncabezadoSeccion titulo={configDraft.tipoProducto === 'Bebida configurable' ? 'Presentaciones' : 'Variantes / presentaciones'} texto="Cada una puede tener precio y receta propios." />
              {(configDraft.presentaciones || []).length === 0 && <Text style={styles.vacioTexto}>No has creado presentaciones.</Text>}
              {(configDraft.presentaciones || []).map((p) => {
                const prep = (configDraft.preparaciones || []).find((x) => x.id === p.preparacionId);
                return <View key={p.id} style={styles.subCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.subCardTitulo}>{p.nombre}</Text>
                    <Text style={styles.subCardMeta}>{prep ? `${prep.nombre} · ` : ''}{dinero(p.precio)}</Text>
                    <Text style={styles.subCardMeta}>{p.estadoReceta || 'Sin receta'}</Text>
                  </View>
                  <View style={styles.subCardBotones}>
                    <Boton titulo="Receta" tipo="suave" compacto onPress={() => abrirRecetaPresentacion(p)} />
                    <Boton titulo="Editar" tipo="suave" compacto onPress={() => abrirEditarPresentacion(p)} />
                    <Boton titulo="Quitar" tipo="peligro" compacto onPress={() => setConfigDraft((d) => ({ ...d, presentaciones: (d.presentaciones || []).filter((x) => x.id !== p.id) }))} />
                  </View>
                </View>;
              })}
              <Boton titulo="+ Presentación" onPress={abrirNuevaPresentacion} />
            </>}

            {configDraft.tipoProducto === 'Arma el tuyo' && <>
              <EncabezadoSeccion titulo="Tamaños" texto="Cada tamaño tendrá precio y distintas cantidades incluidas por sección." />
              {(configDraft.tamanos || []).length === 0 && <Text style={styles.vacioTexto}>No has creado tamaños.</Text>}
              {(configDraft.tamanos || []).map((t) => <View key={t.id} style={styles.subCard}>
                <View style={{ flex: 1 }}><Text style={styles.subCardTitulo}>{t.nombre}</Text><Text style={styles.subCardMeta}>{dinero(t.precio)}</Text></View>
                <View style={styles.subCardBotones}>
                  <Boton titulo="Límites" tipo="suave" compacto onPress={() => abrirReglasTamano(t)} />
                  <Boton titulo="Editar" tipo="suave" compacto onPress={() => abrirEditarTamano(t)} />
                  <Boton titulo="Quitar" tipo="peligro" compacto onPress={() => setConfigDraft((d) => ({ ...d, tamanos: (d.tamanos || []).filter((x) => x.id !== t.id) }))} />
                </View>
              </View>)}
              <Boton titulo="+ Tamaño" onPress={abrirNuevoTamano} />
              {(configDraft.seccionesPersonalizacion || []).length === 0 && <Text style={styles.infoCaja}>Primero crea las secciones en “Personalizaciones”; después vuelve aquí y configura los límites de cada tamaño.</Text>}
            </>}
          </> : <>
            <EncabezadoSeccion titulo="Secciones de personalización" texto="Tú decides los nombres: leche, esencia, foam, base, proteína, ingredientes, aderezo o cualquier otra." />
            {(configDraft.seccionesPersonalizacion || []).length === 0 && <Text style={styles.vacioTexto}>No hay secciones todavía.</Text>}
            {(configDraft.seccionesPersonalizacion || []).map((s) => <View key={s.id} style={styles.subCardCol}>
              <View style={styles.subCardTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.subCardTitulo}>{s.nombre}</Text>
                  <Text style={styles.subCardMeta}>{s.tipoSeleccion || 'Única'} · {s.obligatoria ? 'Obligatoria' : 'Opcional'} · {s.opciones?.length || 0} opciones</Text>
                </View>
                <Boton titulo="Editar" tipo="suave" compacto onPress={() => abrirEditarSeccion(s)} />
              </View>
              {(s.opciones || []).map((o) => <Pressable key={o.id} onPress={() => abrirEditarOpcion(s.id, o)} style={styles.opcionConfig}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.opcionTitulo}>{o.nombre}</Text>
                  <Text style={styles.opcionMeta}>{(o.valoresPorPresentacion || []).length ? 'Valores por presentación' : (o.valoresPorTamano || []).length ? 'Valores por tamaño' : numero(o.ajustePrecio) ? `${numero(o.ajustePrecio) > 0 ? '+' : ''}${dinero(o.ajustePrecio)}` : 'Sin costo extra'} · {o.accionInventario || 'Ninguno'}{o.insumoNombre ? ` · ${o.insumoNombre}` : ''}</Text>
                </View>
                <Text style={styles.editarMini}>Editar</Text>
              </Pressable>)}
              <Boton titulo="+ Opción" tipo="suave" compacto onPress={() => abrirNuevaOpcion(s.id)} />
              <Boton titulo="Eliminar sección" tipo="peligro" compacto onPress={() => setConfigDraft((d) => ({ ...d, seccionesPersonalizacion: (d.seccionesPersonalizacion || []).filter((x) => x.id !== s.id) }))} />
            </View>)}
            <Boton titulo="+ Sección" onPress={abrirNuevaSeccion} />
          </>}

          <View style={{ height: 18 }} />
          <Boton titulo="Guardar configuración" onPress={guardarConfig} />
        </>}
      </ModalBase>

      <ModalBase visible={modalPresentacion} titulo={presentacionEditandoId ? 'Editar presentación' : 'Nueva presentación'} onCerrar={() => { setModalPresentacion(false); setTimeout(() => setModalConfig(true), 400); }} alto="78%">
        {presentacionDraft && <>
          <Campo etiqueta="Nombre" value={presentacionDraft.nombre} onChangeText={(v) => setPresentacionDraft({ ...presentacionDraft, nombre: v })} placeholder="Ej. 16 oz" />
          <Campo etiqueta="Precio de esta presentación" value={presentacionDraft.precio} onChangeText={(v) => setPresentacionDraft({ ...presentacionDraft, precio: v })} keyboardType="decimal-pad" />
          {configDraft?.tipoProducto === 'Bebida configurable' && <>
            <Text style={styles.etiqueta}>Preparación</Text>
            <View style={styles.chipsWrap}>{(configDraft.preparaciones || []).map((p) => <Chip key={p.id} label={p.nombre} activo={presentacionDraft.preparacionId === p.id} onPress={() => setPresentacionDraft({ ...presentacionDraft, preparacionId: p.id })} />)}</View>
          </>}
          <Toggle label="Activa" value={presentacionDraft.activa !== false} onChange={(v) => setPresentacionDraft({ ...presentacionDraft, activa: v })} />
          <Boton titulo="Guardar presentación" onPress={guardarPresentacion} />
        </>}
      </ModalBase>

      <ModalBase visible={modalRecetaPresentacion} titulo="Receta de presentación" onCerrar={() => { setModalRecetaPresentacion(false); setTimeout(() => setModalConfig(true), 400); }}>
        <Text style={styles.infoCaja}>Esta receta permite que 16 oz, 24 oz, taza u otra variante consuman cantidades diferentes.</Text>
        <RecetaEditor receta={recetaPresentacionDraft} onChange={setRecetaPresentacionDraft} insumos={insumos} estado={estadoRecetaPresentacion} onEstadoChange={setEstadoRecetaPresentacion} />
        <View style={{ height: 16 }} />
        <Boton titulo="Guardar receta de presentación" onPress={guardarRecetaPresentacion} />
      </ModalBase>

      <ModalBase visible={modalTamano} titulo={tamanoEditandoId ? 'Editar tamaño' : 'Nuevo tamaño'} onCerrar={() => { setModalTamano(false); setTimeout(() => setModalConfig(true), 400); }} alto="68%">
        {tamanoDraft && <>
          <Campo etiqueta="Nombre" value={tamanoDraft.nombre} onChangeText={(v) => setTamanoDraft({ ...tamanoDraft, nombre: v })} placeholder="Ej. Grande" />
          <Campo etiqueta="Precio" value={tamanoDraft.precio} onChangeText={(v) => setTamanoDraft({ ...tamanoDraft, precio: v })} keyboardType="decimal-pad" />
          <Toggle label="Activo" value={tamanoDraft.activo !== false} onChange={(v) => setTamanoDraft({ ...tamanoDraft, activo: v })} />
          <Boton titulo="Guardar tamaño" onPress={guardarTamano} />
        </>}
      </ModalBase>

      <ModalBase visible={modalReglasTamano} titulo="Límites del tamaño" onCerrar={() => { setModalReglasTamano(false); setTimeout(() => setModalConfig(true), 400); }}>
        {reglasDraft.length === 0 ? <Text style={styles.infoCaja}>No hay secciones creadas todavía.</Text> : reglasDraft.map((r, idx) => <View key={r.seccionId} style={styles.reglaCard}>
          <Text style={styles.subCardTitulo}>{r.nombre}</Text>
          <Campo etiqueta="Opciones incluidas" value={r.incluidas} onChangeText={(v) => setReglasDraft((arr) => arr.map((x, i) => i === idx ? { ...x, incluidas: v } : x))} keyboardType="number-pad" />
          <Toggle label="Permitir opciones extra" value={r.permiteExtras} onChange={(v) => setReglasDraft((arr) => arr.map((x, i) => i === idx ? { ...x, permiteExtras: v } : x))} />
          {r.permiteExtras && <Campo etiqueta="Precio por cada extra" value={r.precioExtra} onChangeText={(v) => setReglasDraft((arr) => arr.map((x, i) => i === idx ? { ...x, precioExtra: v } : x))} keyboardType="decimal-pad" />}
        </View>)}
        <Boton titulo="Guardar límites" onPress={guardarReglasTamano} />
      </ModalBase>

      <ModalBase visible={modalSeccion} titulo={seccionEditandoId ? 'Editar sección' : 'Nueva sección'} onCerrar={() => { setModalSeccion(false); setTimeout(() => setModalConfig(true), 400); }} alto="80%">
        {seccionDraft && <>
          <Campo etiqueta="Nombre de la sección" value={seccionDraft.nombre} onChangeText={(v) => setSeccionDraft({ ...seccionDraft, nombre: v })} placeholder="Ej. Leche" />
          <Text style={styles.etiqueta}>Tipo de selección</Text>
          <View style={styles.chipsWrap}>{MODOS_SELECCION.map((m) => <Chip key={m} label={m} activo={seccionDraft.tipoSeleccion === m} onPress={() => setSeccionDraft({ ...seccionDraft, tipoSeleccion: m, max: m === 'Única' ? '1' : seccionDraft.max })} />)}</View>
          <Toggle label="Obligatoria" value={seccionDraft.obligatoria === true} onChange={(v) => setSeccionDraft({ ...seccionDraft, obligatoria: v })} />
          {seccionDraft.tipoSeleccion === 'Múltiple' && <>
            <Campo etiqueta="Mínimo de selecciones" value={seccionDraft.min} onChangeText={(v) => setSeccionDraft({ ...seccionDraft, min: v })} keyboardType="number-pad" />
            <Campo etiqueta="Máximo de selecciones" value={seccionDraft.max} onChangeText={(v) => setSeccionDraft({ ...seccionDraft, max: v })} keyboardType="number-pad" />
          </>}
          <Toggle label="Activa" value={seccionDraft.activa !== false} onChange={(v) => setSeccionDraft({ ...seccionDraft, activa: v })} />
          <Boton titulo="Guardar sección" onPress={guardarSeccion} />
        </>}
      </ModalBase>
      <ModalBase
        visible={modalOpcion}
        titulo={opcionEditandoId ? 'Editar opción' : 'Nueva opción'}
        onCerrar={() => {
          setModalOpcion(false);
          setTimeout(() => setModalConfig(true), Platform.OS === 'ios' ? 350 : 50);
        }}
      >
        {opcionDraft && <>
          <Campo etiqueta="Nombre" value={opcionDraft.nombre} onChangeText={(v) => setOpcionDraft({ ...opcionDraft, nombre: v })} placeholder="Nombre que verá quien cobra" />

          <Text style={styles.etiqueta}>Efecto en inventario</Text>
          <View style={styles.chipsWrap}>{ACCIONES_INVENTARIO.map((a) => <Chip key={a} label={a} activo={opcionDraft.accionInventario === a} onPress={() => setOpcionDraft({ ...opcionDraft, accionInventario: a })} />)}</View>

          {(configDraft?.presentaciones || []).filter((p) => p.activa !== false).length > 0 ? <>
            <Text style={styles.etiqueta}>Valores por presentación</Text>
            <Text style={styles.infoCaja}>Aquí defines por separado cuánto consume y cuánto aumenta el precio en cada presentación.</Text>
            {(configDraft.presentaciones || []).filter((p) => p.activa !== false).map((p) => {
              const prep = (configDraft.preparaciones || []).find((x) => x.id === p.preparacionId);
              const actual = (opcionDraft.valoresPorPresentacion || []).find((v) => v.presentacionId === p.id) || {};
              const actualizar = (campo, valor) => setOpcionDraft((d) => ({
                ...d,
                valoresPorPresentacion: [
                  ...(d.valoresPorPresentacion || []).filter((v) => v.presentacionId !== p.id),
                  { presentacionId: p.id, presentacionNombre: p.nombre, cantidad: actual.cantidad ?? '', ajustePrecio: actual.ajustePrecio ?? '0', [campo]: valor },
                ],
              }));
              return <View key={p.id} style={styles.reglaCard}>
                <Text style={styles.subCardTitulo}>{p.nombre}{prep ? ' · ' + prep.nombre : ''}</Text>
                {opcionDraft.accionInventario !== 'Ninguno' && <Campo etiqueta="Cantidad consumida" value={String(actual.cantidad ?? '')} onChangeText={(v) => actualizar('cantidad', v)} keyboardType="decimal-pad" />}
                <Campo etiqueta="Ajuste de precio" value={String(actual.ajustePrecio ?? '0')} onChangeText={(v) => actualizar('ajustePrecio', v)} keyboardType="numbers-and-punctuation" ayuda="Usa 0 si no tiene cargo extra." />
              </View>;
            })}
          </> : configDraft?.tipoProducto === 'Bebida configurable' ? <>
            <Text style={styles.etiqueta}>Valores por presentación</Text>
            <Text style={styles.infoCaja}>Primero crea las presentaciones de esta bebida. No se usará una cantidad única porque el consumo depende de la presentación.</Text>
          </> : (configDraft?.tamanos || []).filter((t) => t.activo !== false).length > 0 ? <>
            <Text style={styles.etiqueta}>Valores por tamaño</Text>
            <Text style={styles.infoCaja}>Aquí defines por separado cuánto consume y cuánto aumenta el precio en cada tamaño.</Text>
            {(configDraft.tamanos || []).filter((t) => t.activo !== false).map((t) => {
              const actual = (opcionDraft.valoresPorTamano || []).find((v) => v.tamanoId === t.id) || {};
              const actualizar = (campo, valor) => setOpcionDraft((d) => ({
                ...d,
                valoresPorTamano: [
                  ...(d.valoresPorTamano || []).filter((v) => v.tamanoId !== t.id),
                  { tamanoId: t.id, tamanoNombre: t.nombre, cantidad: actual.cantidad ?? '', ajustePrecio: actual.ajustePrecio ?? '0', [campo]: valor },
                ],
              }));
              return <View key={t.id} style={styles.reglaCard}>
                <Text style={styles.subCardTitulo}>{t.nombre}</Text>
                {opcionDraft.accionInventario !== 'Ninguno' && <Campo etiqueta="Cantidad consumida" value={String(actual.cantidad ?? '')} onChangeText={(v) => actualizar('cantidad', v)} keyboardType="decimal-pad" />}
                <Campo etiqueta="Ajuste de precio" value={String(actual.ajustePrecio ?? '0')} onChangeText={(v) => actualizar('ajustePrecio', v)} keyboardType="numbers-and-punctuation" ayuda="Usa 0 si no tiene cargo extra." />
              </View>;
            })}
          </> : configDraft?.tipoProducto === 'Arma el tuyo' ? <>
            <Text style={styles.etiqueta}>Valores por tamaño</Text>
            <Text style={styles.infoCaja}>Primero crea los tamaños. No se usará una cantidad única porque el consumo depende del tamaño.</Text>
          </> : <>
            <Campo etiqueta="Ajuste de precio" value={opcionDraft.ajustePrecio} onChangeText={(v) => setOpcionDraft({ ...opcionDraft, ajustePrecio: v })} keyboardType="numbers-and-punctuation" ayuda="Usa 0 si no tiene costo extra." />
            {opcionDraft.accionInventario !== 'Ninguno' && <Campo etiqueta="Cantidad consumida" value={opcionDraft.cantidad} onChangeText={(v) => setOpcionDraft({ ...opcionDraft, cantidad: v })} keyboardType="decimal-pad" />}
          </>}

          {opcionDraft.accionInventario !== 'Ninguno' && <>
            <Text style={styles.etiqueta}>Insumo que se consume</Text>
            <View style={styles.listaSeleccion}>{insumos.map((i) => <Pressable key={i.id} onPress={() => setOpcionDraft({ ...opcionDraft, insumoId: i.id })} style={[styles.opcionFila, opcionDraft.insumoId === i.id && styles.opcionFilaActiva]}><Text style={styles.opcionTitulo}>{i.nombre}</Text>{opcionDraft.insumoId === i.id && <Text style={styles.check}>✓</Text>}</Pressable>)}</View>
          </>}

          {opcionDraft.accionInventario === 'Sustituir' && <>
            <Text style={styles.etiqueta}>Sustituye este insumo de la receta base</Text>
            <View style={styles.listaSeleccion}>{insumos.map((i) => <Pressable key={i.id} onPress={() => setOpcionDraft({ ...opcionDraft, reemplazaInsumoId: i.id })} style={[styles.opcionFila, opcionDraft.reemplazaInsumoId === i.id && styles.opcionFilaActiva]}><Text style={styles.opcionTitulo}>{i.nombre}</Text>{opcionDraft.reemplazaInsumoId === i.id && <Text style={styles.check}>✓</Text>}</Pressable>)}</View>
          </>}

          <Toggle label="Opción activa" value={opcionDraft.activa !== false} onChange={(v) => setOpcionDraft({ ...opcionDraft, activa: v })} />
          <Boton titulo="Guardar opción" onPress={guardarOpcion} />
          {opcionEditandoId && <Boton titulo="Eliminar opción" tipo="peligro" onPress={() => {
            setConfigDraft((x) => ({ ...x, seccionesPersonalizacion: (x.seccionesPersonalizacion || []).map((s) => s.id === seccionOpcionId ? { ...s, opciones: (s.opciones || []).filter((o) => o.id !== opcionEditandoId) } : s) }));
            setModalOpcion(false);
            setTimeout(() => setModalConfig(true), Platform.OS === 'ios' ? 350 : 50);
          }} />}
        </>}
      </ModalBase>


      <ModalBase visible={modalInsumo} titulo={insumoEditando ? 'Editar insumo' : 'Nuevo insumo'} onCerrar={() => setModalInsumo(false)}>
        {insumoDraft && <>
          <Campo etiqueta="Nombre" value={insumoDraft.nombre} onChangeText={(v) => setInsumoDraft({ ...insumoDraft, nombre: v })} />
          <Campo etiqueta="Categoría" value={insumoDraft.categoria} onChangeText={(v) => setInsumoDraft({ ...insumoDraft, categoria: v })} />
          <Campo etiqueta="Presentación de compra" value={insumoDraft.presentacionCompra} onChangeText={(v) => setInsumoDraft({ ...insumoDraft, presentacionCompra: v })} placeholder="Ej. botella 1 L" />
          <Campo etiqueta="Contenido de la presentación" value={insumoDraft.contenidoPresentacion} onChangeText={(v) => setInsumoDraft({ ...insumoDraft, contenidoPresentacion: v })} keyboardType="decimal-pad" />
          <Campo etiqueta="Unidad base" value={insumoDraft.unidadBase} onChangeText={(v) => setInsumoDraft({ ...insumoDraft, unidadBase: v })} placeholder="ml, g, unidad..." />
          <Campo etiqueta="Stock mínimo" value={insumoDraft.stockMinimo} onChangeText={(v) => setInsumoDraft({ ...insumoDraft, stockMinimo: v })} keyboardType="decimal-pad" />
          <Boton titulo="Guardar insumo" onPress={guardarInsumo} />
        </>}
      </ModalBase>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: C.fondo },
  header: { flexDirection: 'row', gap: 12, alignItems: 'center', paddingHorizontal: 18, paddingTop: 14, paddingBottom: 12, backgroundColor: C.verde },
  titulo: { color: '#FFF', fontSize: 24, fontWeight: '800' },
  subtitulo: { color: '#E7EFEA', marginTop: 3, fontSize: 12, lineHeight: 17 },
  tabsTop: { flexDirection: 'row', gap: 8, padding: 12, backgroundColor: '#F2ECE2', borderBottomWidth: 1, borderBottomColor: C.linea },
  contenido: { padding: 14, paddingBottom: 80 },
  filaAcciones: { flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 10 },
  chipsFila: { gap: 7, paddingVertical: 4, paddingBottom: 12 },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 12 },
  chip: { paddingHorizontal: 13, paddingVertical: 9, borderRadius: 14, borderWidth: 1, borderColor: C.linea, backgroundColor: '#FFF' },
  chipActivo: { backgroundColor: C.verde, borderColor: C.verde },
  chipDisabled: { opacity: 0.45 },
  chipTexto: { fontSize: 13, fontWeight: '700', color: C.texto },
  chipTextoActivo: { color: '#FFF' },
  boton: { backgroundColor: C.verde, minHeight: 44, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 11, justifyContent: 'center', alignItems: 'center', marginVertical: 4 },
  botonCompacto: { minHeight: 36, paddingHorizontal: 11, paddingVertical: 8 },
  botonSecundario: { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#D4C7BA' },
  botonSuave: { backgroundColor: C.crema },
  botonPeligro: { backgroundColor: '#F8E9E6', borderWidth: 1, borderColor: '#E9C7C0' },
  botonDisabled: { opacity: 0.4 },
  botonTexto: { color: '#FFF', fontSize: 13, fontWeight: '800' },
  botonTextoOscuro: { color: C.texto },
  botonTextoPeligro: { color: C.peligro },
  campoGrupo: { marginBottom: 13 },
  etiqueta: { fontSize: 13, fontWeight: '800', color: C.texto, marginBottom: 7 },
  input: { minHeight: 46, borderRadius: 12, borderWidth: 1, borderColor: C.linea, backgroundColor: '#FFF', paddingHorizontal: 13, color: C.texto, fontSize: 15 },
  inputMultiline: { minHeight: 105, paddingTop: 12 },
  ayuda: { marginTop: 5, color: C.secundario, fontSize: 11, lineHeight: 15 },
  card: { backgroundColor: '#FFF', borderRadius: 17, padding: 14, marginBottom: 11, borderWidth: 1, borderColor: C.linea },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardTitulo: { fontSize: 17, fontWeight: '800', color: C.texto },
  cardMeta: { color: C.secundario, marginTop: 3, fontSize: 12 },
  precio: { fontSize: 16, fontWeight: '900', color: C.verde },
  iconoProducto: { width: 44, height: 44, borderRadius: 13, backgroundColor: C.crema, alignItems: 'center', justifyContent: 'center' },
  iconoProductoTxt: { fontSize: 22 },
  estadosFila: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 12 },
  estado: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 10, backgroundColor: '#ECE8E4' },
  estadoOk: { backgroundColor: '#E2F0E6' },
  estadoAviso: { backgroundColor: '#F6EDD8' },
  estadoPeligro: { backgroundColor: '#F7E4E1' },
  estadoTexto: { fontSize: 11, fontWeight: '800', color: C.texto },
  preparacionResumen: { marginTop: 10, fontSize: 12, color: C.secundario, lineHeight: 17 },
  botonesCard: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  vacio: { backgroundColor: '#FFF', borderRadius: 16, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: C.linea },
  vacioTitulo: { fontSize: 16, fontWeight: '800', color: C.texto },
  vacioTexto: { color: C.secundario, marginTop: 5, lineHeight: 18 },
  modalFondo: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.38)' },
  modalCaja: { backgroundColor: C.fondo, borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: C.linea },
  modalTitulo: { flex: 1, fontSize: 18, fontWeight: '900', color: C.texto },
  cerrarBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.crema, alignItems: 'center', justifyContent: 'center' },
  cerrarTxt: { fontSize: 16, fontWeight: '900', color: C.texto },
  modalContenido: { padding: 16, paddingBottom: 50 },
  toggleFila: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFF', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: C.linea, marginBottom: 9 },
  toggleLabel: { fontSize: 14, fontWeight: '800', color: C.texto },
  switchBase: { width: 46, height: 26, borderRadius: 13, backgroundColor: '#D7D0C8', padding: 3 },
  switchOn: { backgroundColor: C.verde2 },
  switchPunto: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#FFF' },
  switchPuntoOn: { alignSelf: 'flex-end' },
  infoCaja: { backgroundColor: '#EEF3EF', color: C.verde, borderRadius: 12, padding: 12, lineHeight: 18, marginBottom: 14, fontSize: 12 },
  listaSeleccion: { maxHeight: 250, borderWidth: 1, borderColor: C.linea, borderRadius: 12, overflow: 'hidden', backgroundColor: '#FFF', marginBottom: 12 },
  opcionFila: { flexDirection: 'row', alignItems: 'center', padding: 11, borderBottomWidth: 1, borderBottomColor: '#EEE7DF' },
  opcionFilaActiva: { backgroundColor: '#EAF1EC' },
  opcionTitulo: { fontSize: 13, fontWeight: '800', color: C.texto },
  opcionMeta: { color: C.secundario, fontSize: 11, marginTop: 2 },
  check: { fontSize: 18, color: C.verde, fontWeight: '900' },
  recetaFila: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FFF', borderRadius: 12, padding: 11, marginBottom: 7, borderWidth: 1, borderColor: C.linea },
  recetaNombre: { fontSize: 13, fontWeight: '800', color: C.texto },
  recetaCantidad: { fontSize: 11, color: C.secundario, marginTop: 3 },
  miniPeligro: { paddingHorizontal: 9, paddingVertical: 7, borderRadius: 9, backgroundColor: '#F8E9E6' },
  miniPeligroTxt: { fontSize: 11, color: C.peligro, fontWeight: '800' },
  encabezadoSeccion: { marginTop: 14, marginBottom: 10 },
  seccionTitulo: { fontSize: 16, fontWeight: '900', color: C.texto },
  seccionTexto: { color: C.secundario, fontSize: 12, marginTop: 3, lineHeight: 17 },
  chipGestion: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.crema, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9 },
  chipGestionTxt: { fontWeight: '800', color: C.texto },
  chipGestionX: { fontWeight: '900', color: C.peligro },
  subCard: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFF', borderRadius: 13, borderWidth: 1, borderColor: C.linea, padding: 11, marginBottom: 8 },
  subCardCol: { backgroundColor: '#FFF', borderRadius: 13, borderWidth: 1, borderColor: C.linea, padding: 11, marginBottom: 9 },
  subCardTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  subCardTitulo: { fontSize: 14, fontWeight: '900', color: C.texto },
  subCardMeta: { color: C.secundario, fontSize: 11, marginTop: 2 },
  subCardBotones: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 4 },
  opcionConfig: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 9, borderTopWidth: 1, borderTopColor: '#EEE7DF' },
  editarMini: { color: C.verde, fontWeight: '800', fontSize: 11 },
  reglaCard: { backgroundColor: '#FFF', borderRadius: 13, borderWidth: 1, borderColor: C.linea, padding: 12, marginBottom: 10 },
});
