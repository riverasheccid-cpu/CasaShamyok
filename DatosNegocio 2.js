import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const CLAVE_DATOS = '@CasaShamy_Datos_v1';
const DatosNegocioContext = createContext(null);

const numero = (valor) => {
  if (valor === null || valor === undefined || valor === '') return 0;
  const n = Number(String(valor).replace(/,/g, '').replace('$', '').trim());
  return Number.isFinite(n) ? n : 0;
};

const redondear = (valor) => Math.round((numero(valor) + Number.EPSILON) * 10000) / 10000;

const crearId = (prefijo = 'ID') =>
  `${prefijo}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const fechaKeyActual = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dia}`;
};

const fechaActual = () => new Date().toLocaleDateString('es-MX');
const horaActual = () => new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });

const normalizarEstadoReceta = (producto) => {
  if (producto?.estadoReceta) return producto.estadoReceta;
  const receta = Array.isArray(producto?.receta) ? producto.receta : [];
  return receta.length > 0 ? 'En proceso' : 'Sin receta';
};

const normalizarLote = (lote = {}) => {
  const cantidadInicial = numero(
    lote.cantidadInicial ?? lote.cantidad ?? lote.cantidadDisponible
  );
  const cantidadDisponible = numero(
    lote.cantidadDisponible ?? lote.cantidad ?? cantidadInicial
  );

  const costoUnidadRaw = lote.costoUnidadBase ?? lote.costoUnitario ?? null;
  const costoTotalRaw = lote.costoTotal ?? lote.costo ?? null;

  let costoUnidadBase =
    costoUnidadRaw === null || costoUnidadRaw === undefined || costoUnidadRaw === ''
      ? null
      : numero(costoUnidadRaw);

  let costoTotal =
    costoTotalRaw === null || costoTotalRaw === undefined || costoTotalRaw === ''
      ? null
      : numero(costoTotalRaw);

  if (costoUnidadBase === null && costoTotal !== null && cantidadInicial > 0) {
    costoUnidadBase = costoTotal / cantidadInicial;
  }

  if (costoTotal === null && costoUnidadBase !== null) {
    costoTotal = costoUnidadBase * cantidadInicial;
  }

  const costoPendiente =
    lote.costoPendiente === true || costoUnidadBase === null || costoTotal === null;

  return {
    ...lote,
    id: lote.id || crearId('LOT'),
    cantidadInicial,
    cantidadDisponible,
    costoTotal: costoPendiente ? null : redondear(costoTotal),
    costoUnidadBase: costoPendiente ? null : redondear(costoUnidadBase),
    costoPendiente,
    fechaKey: lote.fechaKey || fechaKeyActual(),
    fecha: lote.fecha || fechaActual(),
  };
};

const normalizarInsumo = (insumo = {}) => ({
  ...insumo,
  id: insumo.id || crearId('INS'),
  nombre: String(insumo.nombre || '').trim(),
  categoria: insumo.categoria || 'General',
  presentacionCompra: insumo.presentacionCompra || insumo.presentacion || '',
  presentacion: insumo.presentacion || insumo.presentacionCompra || '',
  contenidoPresentacion: numero(insumo.contenidoPresentacion),
  unidadBase: insumo.unidadBase || 'unidad',
  stockMinimo: numero(insumo.stockMinimo),
  lotes: Array.isArray(insumo.lotes) ? insumo.lotes.map(normalizarLote) : [],
});

const normalizarProducto = (producto = {}) => ({
  ...producto,
  id: producto.id || crearId('PROD'),
  nombre: String(producto.nombre || '').trim(),
  categoria: producto.categoria || 'General',
  precio: numero(producto.precio),

  // V2: estructura flexible. Los productos existentes siguen funcionando
  // porque, si no tienen estos campos, se completan con valores seguros.
  tipoProducto: producto.tipoProducto || 'Fijo',
  descripcionPreparacion: String(producto.descripcionPreparacion || '').trim(),
  imagenUri: producto.imagenUri || null,
  activo: producto.activo !== false,
  permiteNotas: producto.permiteNotas !== false,
  permiteModificarIngredientes: producto.permiteModificarIngredientes !== false,
  preparaciones: Array.isArray(producto.preparaciones) ? producto.preparaciones : [],
  presentaciones: Array.isArray(producto.presentaciones) ? producto.presentaciones : [],
  tamanos: Array.isArray(producto.tamanos) ? producto.tamanos : [],
  seccionesPersonalizacion: Array.isArray(producto.seccionesPersonalizacion)
    ? producto.seccionesPersonalizacion
    : [],

  receta: Array.isArray(producto.receta)
    ? producto.receta.map((item) => ({
        ...item,
        id: item.id || crearId('REC'),
        cantidad: numero(item.cantidad),
      }))
    : [],
  estadoReceta: normalizarEstadoReceta(producto),
});

export function DatosNegocioProvider({ children }) {
  const [insumos, setInsumos] = useState([]);
  const [movimientos, setMovimientos] = useState([]);
  const [productos, setProductos] = useState([]);
  const [ventas, setVentas] = useState([]);
  const [gastos, setGastos] = useState([]);
  const [inversiones, setInversiones] = useState([]);
  const [pagosInversion, setPagosInversion] = useState([]);
  const [movimientosFlujo, setMovimientosFlujo] = useState([]);
  const [comprasLibres, setComprasLibres] = useState([]);
  const [creditosProveedores, setCreditosProveedores] = useState([]);
  const [pagosCreditos, setPagosCreditos] = useState([]);
  const [datosCargados, setDatosCargados] = useState(false);

  useEffect(() => {
    const cargar = async () => {
      try {
        const guardado = await AsyncStorage.getItem(CLAVE_DATOS);
        if (guardado) {
          const datos = JSON.parse(guardado);
          setInsumos((datos.insumos || []).map(normalizarInsumo));
          setMovimientos(Array.isArray(datos.movimientos) ? datos.movimientos : []);
          setProductos((datos.productos || []).map(normalizarProducto));
          setVentas(Array.isArray(datos.ventas) ? datos.ventas : []);
          setGastos(Array.isArray(datos.gastos) ? datos.gastos : []);
          setInversiones(Array.isArray(datos.inversiones) ? datos.inversiones : []);
          setPagosInversion(Array.isArray(datos.pagosInversion) ? datos.pagosInversion : []);
          setMovimientosFlujo(
            Array.isArray(datos.movimientosFlujo) ? datos.movimientosFlujo : []
          );
          setComprasLibres(Array.isArray(datos.comprasLibres) ? datos.comprasLibres : []);
          setCreditosProveedores(
            Array.isArray(datos.creditosProveedores) ? datos.creditosProveedores : []
          );
          setPagosCreditos(Array.isArray(datos.pagosCreditos) ? datos.pagosCreditos : []);
        }
      } catch (error) {
        console.log('Error cargando datos Casa Shamy:', error);
      } finally {
        setDatosCargados(true);
      }
    };

    cargar();
  }, []);

  useEffect(() => {
    if (!datosCargados) return;

    const guardar = async () => {
      try {
        await AsyncStorage.setItem(
          CLAVE_DATOS,
          JSON.stringify({
            insumos,
            movimientos,
            productos,
            ventas,
            gastos,
            inversiones,
            pagosInversion,
            movimientosFlujo,
            comprasLibres,
            creditosProveedores,
            pagosCreditos,
          })
        );
      } catch (error) {
        console.log('Error guardando datos Casa Shamy:', error);
      }
    };

    guardar();
  }, [
    datosCargados,
    insumos,
    movimientos,
    productos,
    ventas,
    gastos,
    inversiones,
    pagosInversion,
    movimientosFlujo,
    comprasLibres,
    creditosProveedores,
    pagosCreditos,
  ]);

  // =====================================================
  // FLUJO
  // =====================================================

  const registrarMovimientoFlujo = ({
    tipo,
    monto,
    concepto,
    categoria = 'General',
    metodoPago = 'Efectivo',
    referenciaId = null,
    origen = 'Manual',
    fechaKey = null,
    fecha = null,
    hora = null,
  }) => {
    const cantidad = numero(monto);
    if (!cantidad || cantidad <= 0) return null;

    const movimiento = {
      id: crearId('FLU'),
      tipo,
      monto: cantidad,
      concepto: String(concepto || '').trim() || 'Movimiento',
      categoria,
      metodoPago,
      referenciaId,
      origen,
      fechaKey: fechaKey || fechaKeyActual(),
      fecha: fecha || fechaActual(),
      hora: hora || horaActual(),
    };

    setMovimientosFlujo((actuales) => [movimiento, ...actuales]);
    return movimiento;
  };

  const saldoFlujo = () =>
    movimientosFlujo.reduce((total, item) => {
      const monto = numero(item.monto);
      return item.tipo === 'Entrada' ? total + monto : total - monto;
    }, 0);

  // =====================================================
  // INVERSIONES
  // =====================================================

  const agregarInversion = ({
    concepto,
    monto,
    pagadoPor,
    perteneceA,
    formaAportacion = 'Pago directo',
    metodoPago = 'Transferencia',
    origen = 'Registro manual',
    referenciaId = null,
    nota = '',
  }) => {
    const cantidad = numero(monto);
    if (!cantidad || cantidad <= 0) {
      return { ok: false, mensaje: 'El monto de la inversión debe ser mayor a 0.' };
    }

    const inversion = {
      id: crearId('INV'),
      concepto: String(concepto || '').trim() || 'Inversión',
      monto: cantidad,
      pagadoPor: String(pagadoPor || '').trim() || 'Socio',
      perteneceA: String(perteneceA || pagadoPor || '').trim() || 'Socio',
      formaAportacion,
      metodoPago,
      origen,
      referenciaId,
      nota: String(nota || '').trim(),
      fechaKey: fechaKeyActual(),
      fecha: fechaActual(),
      hora: horaActual(),
    };

    setInversiones((actuales) => [inversion, ...actuales]);

    if (formaAportacion === 'Efectivo a Casa Shamy') {
      registrarMovimientoFlujo({
        tipo: 'Entrada',
        monto: cantidad,
        concepto: inversion.concepto,
        categoria: 'Inversión',
        metodoPago,
        referenciaId: inversion.id,
        origen: 'Inversión',
      });
    }

    return { ok: true, inversion };
  };

  const obtenerResumenInversionistas = () => {
    const mapa = {};

    inversiones.forEach((inv) => {
      const nombre = inv.perteneceA || inv.pagadoPor || 'Socio';
      if (!mapa[nombre]) mapa[nombre] = { nombre, aportado: 0, recuperado: 0, pendiente: 0 };
      mapa[nombre].aportado += numero(inv.monto);
    });

    pagosInversion.forEach((pago) => {
      const nombre = pago.inversionista || 'Socio';
      if (!mapa[nombre]) mapa[nombre] = { nombre, aportado: 0, recuperado: 0, pendiente: 0 };
      mapa[nombre].recuperado += numero(pago.monto);
    });

    return Object.values(mapa)
      .map((item) => {
        const pendiente = Math.max(0, item.aportado - item.recuperado);
        const porcentaje = item.aportado > 0 ? (item.recuperado / item.aportado) * 100 : 0;
        return { ...item, pendiente, porcentaje };
      })
      .sort((a, b) => b.pendiente - a.pendiente);
  };

  const pagarInversion = ({
    inversionista,
    monto,
    metodoPago = 'Transferencia',
    nota = '',
    desde = 'Casa Shamy',
  }) => {
    const cantidad = numero(monto);
    const resumen = obtenerResumenInversionistas().find((i) => i.nombre === inversionista);

    if (!resumen) return { ok: false, mensaje: 'No se encontró al inversionista.' };
    if (!cantidad || cantidad <= 0) return { ok: false, mensaje: 'El monto debe ser mayor a 0.' };
    if (cantidad > resumen.pendiente + 0.0001) {
      return { ok: false, mensaje: 'El pago supera la inversión pendiente.' };
    }

    const pago = {
      id: crearId('PINV'),
      inversionista,
      monto: cantidad,
      metodoPago,
      nota: String(nota || '').trim(),
      desde,
      fechaKey: fechaKeyActual(),
      fecha: fechaActual(),
      hora: horaActual(),
    };

    setPagosInversion((actuales) => [pago, ...actuales]);

    if (desde === 'Casa Shamy') {
      registrarMovimientoFlujo({
        tipo: 'Salida',
        monto: cantidad,
        concepto: `Pago de inversión a ${inversionista}`,
        categoria: 'Pago inversión',
        metodoPago,
        referenciaId: pago.id,
        origen: 'Pago inversión',
      });
    }

    return { ok: true, pago };
  };

  const cancelarPagoInversion = (pagoId) => {
    const pago = pagosInversion.find((item) => item.id === pagoId);
    if (!pago) return { ok: false, mensaje: 'No se encontró el pago.' };

    setPagosInversion((actuales) => actuales.filter((item) => item.id !== pagoId));

    if (pago.desde === 'Casa Shamy') {
      registrarMovimientoFlujo({
        tipo: 'Entrada',
        monto: pago.monto,
        concepto: `Cancelación pago inversión ${pago.inversionista}`,
        categoria: 'Cancelación',
        metodoPago: pago.metodoPago,
        referenciaId: pago.id,
        origen: 'Cancelación pago inversión',
      });
    }

    return { ok: true };
  };

  const cancelarInversion = (inversionId) => {
    const inversion = inversiones.find((item) => item.id === inversionId);
    if (!inversion) return { ok: false, mensaje: 'No se encontró la inversión.' };

    const nombre = inversion.perteneceA || inversion.pagadoPor || 'Socio';
    const resumen = obtenerResumenInversionistas().find((item) => item.nombre === nombre);
    const aportadoRestante = numero(resumen?.aportado) - numero(inversion.monto);
    if (numero(resumen?.recuperado) > aportadoRestante + 0.0001) {
      return {
        ok: false,
        mensaje: 'No se puede cancelar porque ya existen pagos asociados a ese capital.',
      };
    }

    setInversiones((actuales) => actuales.filter((item) => item.id !== inversionId));

    if (inversion.formaAportacion === 'Efectivo a Casa Shamy') {
      registrarMovimientoFlujo({
        tipo: 'Salida',
        monto: inversion.monto,
        concepto: `Cancelación: ${inversion.concepto}`,
        categoria: 'Cancelación inversión',
        metodoPago: inversion.metodoPago,
        referenciaId: inversion.id,
        origen: 'Cancelación inversión',
      });
    }

    return { ok: true };
  };

  // =====================================================
  // INSUMOS / INVENTARIO
  // =====================================================

  const existenciaDe = (insumo) =>
    (insumo?.lotes || []).reduce((total, lote) => total + numero(lote.cantidadDisponible), 0);

  const valorDe = (insumo) =>
    (insumo?.lotes || []).reduce((total, lote) => {
      if (lote.costoPendiente || lote.costoUnidadBase === null || lote.costoUnidadBase === undefined) {
        return total;
      }
      return total + numero(lote.cantidadDisponible) * numero(lote.costoUnidadBase);
    }, 0);

  const valorInventario = insumos.reduce((total, insumo) => total + valorDe(insumo), 0);

  const inventarioConCostoPendiente = insumos.reduce(
    (total, insumo) =>
      total +
      (insumo.lotes || []).reduce(
        (sub, lote) => sub + (lote.costoPendiente ? numero(lote.cantidadDisponible) : 0),
        0
      ),
    0
  );

  const agregarInsumo = (datos = {}) => {
    const nombre = String(datos.nombre || '').trim();
    if (!nombre) return { ok: false, mensaje: 'Escribe el nombre del insumo.' };

    const id = crearId('INS');
    const insumo = normalizarInsumo({ ...datos, id, lotes: [] });

    const cantidadPresentaciones = numero(datos.cantidadInicial ?? datos.cantidadPresentaciones);
    const contenido = numero(datos.contenidoPresentacion);
    const cantidadBase =
      cantidadPresentaciones > 0
        ? contenido > 0
          ? contenido * cantidadPresentaciones
          : cantidadPresentaciones
        : 0;

    const costoPresentacionRaw = datos.costoPresentacion;
    const tieneCosto = !(
      costoPresentacionRaw === null ||
      costoPresentacionRaw === undefined ||
      costoPresentacionRaw === '' ||
      datos.costoPendiente === true
    );

    let loteInicial = null;
    let totalLote = null;

    if (cantidadBase > 0) {
      const costoPorPresentacion = tieneCosto ? numero(costoPresentacionRaw) : null;
      totalLote = tieneCosto ? costoPorPresentacion * cantidadPresentaciones : null;

      const lote = normalizarLote({
        id: crearId('LOT'),
        tipo: datos.esApertura === 'Sí' ? 'Apertura' : 'Entrada inicial',
        cantidadPresentaciones,
        cantidadInicial: cantidadBase,
        cantidadDisponible: cantidadBase,
        costoPresentacion: costoPorPresentacion,
        costoTotal: totalLote,
        costoUnidadBase: tieneCosto
          ? contenido > 0
            ? costoPorPresentacion / contenido
            : totalLote / cantidadBase
          : null,
        costoPendiente: !tieneCosto,
        origen: datos.esApertura === 'Sí' ? 'Inventario apertura' : 'Alta de insumo',
        origenDinero: datos.origenInsumo || datos.fuenteDinero || 'Casa Shamy',
        pagadoPor:
          (datos.origenInsumo || datos.fuenteDinero) === 'Aportación nueva'
            ? datos.pagadoPorInsumo || datos.pagadoPor || null
            : 'Casa Shamy',
        inversionDe:
          (datos.origenInsumo || datos.fuenteDinero) === 'Aportación nueva'
            ? datos.inversionDeInsumo || datos.perteneceA || datos.pagadoPorInsumo || datos.pagadoPor || null
            : null,
        fechaKey: fechaKeyActual(),
        fecha: fechaActual(),
      });
      insumo.lotes = [lote];
      loteInicial = lote;
    }

    setInsumos((actuales) => [insumo, ...actuales]);

    if (loteInicial) {
      const movimientoId = crearId('MOV');
      setMovimientos((actuales) => [
        {
          id: movimientoId,
          tipo: loteInicial.tipo || 'Entrada',
          insumoId: id,
          insumoNombre: nombre,
          cantidad: cantidadBase,
          cantidadPresentaciones,
          unidadBase: insumo.unidadBase,
          costo: loteInicial.costoTotal,
          costoPendiente: loteInicial.costoPendiente,
          loteId: loteInicial.id,
          origen: loteInicial.origen,
          fechaKey: fechaKeyActual(),
          fecha: fechaActual(),
          hora: horaActual(),
        },
        ...actuales,
      ]);

      if (tieneCosto && totalLote > 0) {
        const fuente = datos.origenInsumo || datos.fuenteDinero || 'Casa Shamy';
        const metodoPago = datos.metodoPago || 'Efectivo';

        if (fuente === 'Aportación nueva') {
          agregarInversion({
            concepto: `Inventario inicial: ${nombre}`,
            monto: totalLote,
            pagadoPor: datos.pagadoPorInsumo || datos.pagadoPor || 'Socio',
            perteneceA:
              datos.inversionDeInsumo ||
              datos.perteneceA ||
              datos.pagadoPorInsumo ||
              datos.pagadoPor ||
              'Socio',
            formaAportacion: 'Pago directo',
            metodoPago,
            origen: 'Inventario inicial',
            referenciaId: movimientoId,
          });
        } else if (fuente === 'Casa Shamy') {
          registrarMovimientoFlujo({
            tipo: 'Salida',
            monto: totalLote,
            concepto: `Inventario inicial: ${nombre}`,
            categoria: 'Inventario',
            metodoPago,
            referenciaId: movimientoId,
            origen: 'Inventario inicial',
          });
        }
      }
    }

    return { ok: true, insumo };
  };

  const editarInsumo = (insumoId, cambios = {}) => {
    const actual = insumos.find((item) => item.id === insumoId);
    if (!actual) return { ok: false, mensaje: 'No se encontró el insumo.' };

    const nombre = cambios.nombre !== undefined ? String(cambios.nombre).trim() : actual.nombre;
    if (!nombre) return { ok: false, mensaje: 'El insumo debe tener nombre.' };

    setInsumos((lista) =>
      lista.map((item) =>
        item.id === insumoId
          ? {
              ...item,
              nombre,
              categoria: cambios.categoria ?? item.categoria,
              presentacionCompra: cambios.presentacionCompra ?? item.presentacionCompra,
              contenidoPresentacion:
                cambios.contenidoPresentacion !== undefined
                  ? numero(cambios.contenidoPresentacion)
                  : item.contenidoPresentacion,
              unidadBase: cambios.unidadBase ?? item.unidadBase,
              stockMinimo:
                cambios.stockMinimo !== undefined ? numero(cambios.stockMinimo) : item.stockMinimo,
            }
          : item
      )
    );

    setMovimientos((lista) =>
      lista.map((mov) => (mov.insumoId === insumoId ? { ...mov, insumoNombre: nombre } : mov))
    );

    return { ok: true };
  };

  const eliminarInsumo = (insumoId) => {
    const insumo = insumos.find((item) => item.id === insumoId);
    if (!insumo) return { ok: false, mensaje: 'No se encontró el insumo.' };

    if (existenciaDe(insumo) > 0.000001) {
      return { ok: false, mensaje: 'No puedes eliminar un insumo que todavía tiene existencia.' };
    }

    const usadoEnReceta = productos.some((p) =>
      (p.receta || []).some((r) => r.insumoId === insumoId)
    );
    if (usadoEnReceta) {
      return { ok: false, mensaje: 'Este insumo está usado en una receta. Primero quítalo de la receta.' };
    }

    const usadoEnVenta = ventas.some((v) =>
      (v.detalleCosto || []).some((d) => d.insumoId === insumoId)
    );
    if (usadoEnVenta) {
      return { ok: false, mensaje: 'No se puede eliminar porque existe historial de ventas con este insumo.' };
    }

    setInsumos((lista) => lista.filter((item) => item.id !== insumoId));
    return { ok: true };
  };

  const agregarLoteInsumo = ({
    insumoId,
    cantidad,
    costoTotal = null,
    costoPresentacion = null,
    costoPendiente = false,
    origen = 'Compra inventario',
    referenciaId = null,
    nota = '',
  }) => {
    const insumo = insumos.find((item) => item.id === insumoId);
    if (!insumo) return { ok: false, mensaje: 'No se encontró el insumo.' };

    const cant = numero(cantidad);
    if (!cant || cant <= 0) return { ok: false, mensaje: 'La cantidad debe ser mayor a 0.' };

    const costoRaw = costoTotal ?? costoPresentacion;
    const sinCosto =
      costoPendiente === true || costoRaw === null || costoRaw === undefined || costoRaw === '';
    const costo = sinCosto ? null : numero(costoRaw);

    const lote = normalizarLote({
      id: crearId('LOT'),
      cantidadInicial: cant,
      cantidadDisponible: cant,
      costoTotal: costo,
      costoUnidadBase: sinCosto ? null : costo / cant,
      costoPendiente: sinCosto,
      origen,
      referenciaId,
      nota: String(nota || '').trim(),
      fechaKey: fechaKeyActual(),
      fecha: fechaActual(),
    });

    setInsumos((lista) =>
      lista.map((item) =>
        item.id === insumoId ? { ...item, lotes: [...(item.lotes || []), lote] } : item
      )
    );

    const movimiento = {
      id: crearId('MOV'),
      tipo: 'Entrada',
      insumoId,
      insumoNombre: insumo.nombre,
      cantidad: cant,
      unidadBase: insumo.unidadBase,
      costo: lote.costoTotal,
      costoPendiente: lote.costoPendiente,
      loteId: lote.id,
      referenciaId,
      origen,
      nota: String(nota || '').trim(),
      fechaKey: fechaKeyActual(),
      fecha: fechaActual(),
      hora: horaActual(),
    };

    setMovimientos((actuales) => [movimiento, ...actuales]);
    return { ok: true, lote, movimiento };
  };

  const agregarInventarioSinCosto = ({ insumoId, cantidad, nota = '', referenciaId = null }) =>
    agregarLoteInsumo({
      insumoId,
      cantidad,
      costoTotal: null,
      costoPendiente: true,
      origen: 'Inventario sin costo',
      referenciaId,
      nota,
    });

  const registrarCompraInsumo = (datos = {}) => {
    const insumo = insumos.find((item) => item.id === datos.insumoId);
    if (!insumo) return { ok: false, mensaje: 'No se encontró el insumo.' };

    const cantidadPresentaciones = numero(
      datos.cantidadPresentaciones ?? datos.cantidadCompra ?? datos.cantidad
    );
    const contenido = numero(insumo.contenidoPresentacion);
    const cantidadBase =
      datos.cantidadBase !== undefined
        ? numero(datos.cantidadBase)
        : contenido > 0
        ? contenido * cantidadPresentaciones
        : cantidadPresentaciones;

    const costoTotalExplicito =
      datos.costoTotal !== undefined &&
      datos.costoTotal !== null &&
      datos.costoTotal !== '';
    const costoPorPresentacion = numero(datos.costoPresentacion ?? datos.costoCompra);
    const costo = costoTotalExplicito
      ? numero(datos.costoTotal)
      : costoPorPresentacion * cantidadPresentaciones;

    if (!cantidadBase || cantidadBase <= 0) {
      return { ok: false, mensaje: 'La cantidad debe ser mayor a 0.' };
    }
    if (!costo || costo <= 0) return { ok: false, mensaje: 'El costo debe ser mayor a 0.' };

    const resultado = agregarLoteInsumo({
      insumoId: datos.insumoId,
      cantidad: cantidadBase,
      costoTotal: costo,
      origen: 'Compra inventario',
      nota: datos.nota || '',
    });
    if (!resultado.ok) return resultado;

    setInsumos((lista) =>
      lista.map((item) =>
        item.id !== datos.insumoId
          ? item
          : {
              ...item,
              lotes: (item.lotes || []).map((lote) =>
                lote.id !== resultado.lote.id
                  ? lote
                  : {
                      ...lote,
                      cantidadPresentaciones,
                      costoPresentacion:
                        costoPorPresentacion > 0
                          ? costoPorPresentacion
                          : cantidadPresentaciones > 0
                          ? costo / cantidadPresentaciones
                          : costo,
                      origenDinero:
                        datos.origenCompra || datos.fuenteDinero || 'Casa Shamy',
                      pagadoPor:
                        (datos.origenCompra || datos.fuenteDinero) === 'Aportación nueva'
                          ? datos.pagadoPorCompra || datos.pagadoPor || null
                          : 'Casa Shamy',
                      inversionDe:
                        (datos.origenCompra || datos.fuenteDinero) === 'Aportación nueva'
                          ? datos.inversionDeCompra || datos.perteneceA || datos.pagadoPorCompra || datos.pagadoPor || null
                          : null,
                    },
              ),
            }
      )
    );

    let inversion = null;
    const fuente = datos.origenCompra || datos.fuenteDinero || 'Casa Shamy';
    const metodoPago = datos.metodoPago || 'Efectivo';

    if (fuente === 'Aportación nueva') {
      const inv = agregarInversion({
        concepto: `Compra de inventario: ${resultado.movimiento.insumoNombre}`,
        monto: costo,
        pagadoPor: datos.pagadoPorCompra || datos.pagadoPor || 'Socio',
        perteneceA:
          datos.inversionDeCompra ||
          datos.perteneceA ||
          datos.pagadoPorCompra ||
          datos.pagadoPor ||
          'Socio',
        formaAportacion: 'Pago directo',
        metodoPago,
        origen: 'Compra inventario',
        referenciaId: resultado.movimiento.id,
      });
      inversion = inv.inversion || null;
    } else if (fuente === 'Casa Shamy') {
      registrarMovimientoFlujo({
        tipo: 'Salida',
        monto: costo,
        concepto: `Compra inventario: ${resultado.movimiento.insumoNombre}`,
        categoria: 'Inventario',
        metodoPago,
        referenciaId: resultado.movimiento.id,
        origen: 'Compra inventario',
      });
    }

    return { ...resultado, inversion };
  };

  // Alias para compatibilidad con pantallas anteriores.
  const agregarCompra = registrarCompraInsumo;
  const registrarCompra = registrarCompraInsumo;

  const planificarFIFO = (listaInsumos, insumoId, cantidad) => {
    const requerido = numero(cantidad);
    const insumo = listaInsumos.find((item) => item.id === insumoId);
    if (!insumo) return { ok: false, mensaje: 'No se encontró el insumo.' };
    if (!requerido || requerido <= 0) return { ok: false, mensaje: 'Cantidad inválida.' };

    const lotes = [...(insumo.lotes || [])];
    const disponible = lotes.reduce((total, lote) => total + numero(lote.cantidadDisponible), 0);
    if (disponible + 0.000001 < requerido) {
      return {
        ok: false,
        mensaje: `Inventario insuficiente de ${insumo.nombre}.`,
        disponible,
        requerido,
      };
    }

    let faltante = requerido;
    let costo = 0;
    let costoPendiente = false;
    const detalle = [];

    for (const lote of lotes) {
      if (faltante <= 0) break;
      const disponibleLote = numero(lote.cantidadDisponible);
      if (disponibleLote <= 0) continue;

      const usar = Math.min(disponibleLote, faltante);
      const costoUnidad =
        lote.costoPendiente || lote.costoUnidadBase === null || lote.costoUnidadBase === undefined
          ? null
          : numero(lote.costoUnidadBase);
      const costoDetalle = costoUnidad === null ? null : usar * costoUnidad;
      if (costoDetalle === null) costoPendiente = true;
      else costo += costoDetalle;

      detalle.push({
        loteId: lote.id,
        insumoId,
        insumoNombre: insumo.nombre,
        cantidad: usar,
        costoUnidad,
        costo: costoDetalle,
      });
      faltante -= usar;
    }

    return {
      ok: true,
      costo: costoPendiente ? null : redondear(costo),
      costoConocido: redondear(costo),
      costoPendiente,
      detalle,
      requerido,
    };
  };

  const calcularCostoFIFO = (insumoId, cantidad) => {
    const plan = planificarFIFO(insumos, insumoId, cantidad);
    if (!plan.ok) return plan;
    if (plan.costoPendiente) {
      return {
        ...plan,
        ok: false,
        mensaje: 'Hay inventario suficiente, pero una parte todavía no tiene costo asignado.',
        inventarioDisponible: true,
      };
    }
    return plan;
  };

  const aplicarConsumoFIFOEnLista = (lista, detalle) =>
    lista.map((insumo) => {
      const detalles = detalle.filter((d) => d.insumoId === insumo.id);
      if (detalles.length === 0) return insumo;
      return {
        ...insumo,
        lotes: (insumo.lotes || []).map((lote) => {
          const usado = detalles
            .filter((d) => d.loteId === lote.id)
            .reduce((sum, d) => sum + numero(d.cantidad), 0);
          if (!usado) return lote;
          return {
            ...lote,
            cantidadDisponible: Math.max(0, numero(lote.cantidadDisponible) - usado),
          };
        }),
      };
    });

  const restaurarFIFOEnLista = (lista, detalle) =>
    lista.map((insumo) => {
      const detalles = detalle.filter((d) => d.insumoId === insumo.id);
      if (detalles.length === 0) return insumo;
      return {
        ...insumo,
        lotes: (insumo.lotes || []).map((lote) => {
          const restaurar = detalles
            .filter((d) => d.loteId === lote.id)
            .reduce((sum, d) => sum + numero(d.cantidad), 0);
          if (!restaurar) return lote;
          return { ...lote, cantidadDisponible: numero(lote.cantidadDisponible) + restaurar };
        }),
      };
    });

  const registrarMerma = ({ insumoId, cantidad, motivo = 'Merma', observacion = '' }) => {
    const plan = planificarFIFO(insumos, insumoId, cantidad);
    if (!plan.ok) return plan;
    if (plan.costoPendiente) {
      return {
        ok: false,
        mensaje: 'No se puede costear la merma porque parte del inventario todavía no tiene costo.',
      };
    }

    const insumo = insumos.find((item) => item.id === insumoId);
    setInsumos((actuales) => aplicarConsumoFIFOEnLista(actuales, plan.detalle));

    const movimiento = {
      id: crearId('MOV'),
      tipo: 'Merma',
      insumoId,
      insumoNombre: insumo?.nombre || 'Insumo',
      cantidad: -numero(cantidad),
      cantidadAbs: numero(cantidad),
      unidadBase: insumo?.unidadBase || '',
      costo: plan.costo,
      detalleCosto: plan.detalle,
      motivo,
      observacion: String(observacion || '').trim(),
      fechaKey: fechaKeyActual(),
      fecha: fechaActual(),
      hora: horaActual(),
    };

    setMovimientos((actuales) => [movimiento, ...actuales]);
    return { ok: true, movimiento };
  };

  const agregarMerma = registrarMerma;

  const asignarCostoPendienteLote = ({
    insumoId,
    loteId,
    monto,
    compraLibreId = null,
    nota = '',
  }) => {
    const insumo = insumos.find((item) => item.id === insumoId);
    const lote = insumo?.lotes?.find((item) => item.id === loteId);
    const costo = numero(monto);

    if (!insumo || !lote) return { ok: false, mensaje: 'No se encontró el lote.' };
    if (!lote.costoPendiente) return { ok: false, mensaje: 'Este lote ya tiene costo asignado.' };
    if (!costo || costo <= 0) return { ok: false, mensaje: 'El costo debe ser mayor a 0.' };
    if (numero(lote.cantidadInicial) <= 0) return { ok: false, mensaje: 'El lote no tiene cantidad válida.' };

    let compra = null;
    if (compraLibreId) {
      compra = comprasLibres.find((item) => item.id === compraLibreId);
      if (!compra) return { ok: false, mensaje: 'No se encontró la compra pendiente.' };
      if (costo > numero(compra.montoPendiente) + 0.0001) {
        return { ok: false, mensaje: 'El monto supera el saldo pendiente de la compra.' };
      }
    }

    setInsumos((lista) =>
      lista.map((item) =>
        item.id !== insumoId
          ? item
          : {
              ...item,
              lotes: (item.lotes || []).map((l) =>
                l.id !== loteId
                  ? l
                  : {
                      ...l,
                      costoTotal: costo,
                      costoUnidadBase: costo / numero(l.cantidadInicial),
                      costoPendiente: false,
                      costoAsignadoDesde: compraLibreId,
                    }
              ),
            }
      )
    );

    setMovimientos((lista) =>
      lista.map((mov) =>
        mov.loteId === loteId
          ? { ...mov, costo, costoPendiente: false, notaCosto: String(nota || '').trim() }
          : mov
      )
    );

    if (compra) {
      const clasificacion = {
        id: crearId('CLA'),
        tipo: 'Costo de lote existente',
        insumoId,
        insumoNombre: insumo.nombre,
        loteId,
        cantidad: numero(lote.cantidadInicial),
        monto: costo,
        fechaKey: fechaKeyActual(),
        fecha: fechaActual(),
      };
      setComprasLibres((lista) =>
        lista.map((item) => {
          if (item.id !== compraLibreId) return item;
          const clasificado = numero(item.montoClasificado) + costo;
          const pendiente = Math.max(0, numero(item.monto) - clasificado);
          return {
            ...item,
            montoClasificado: clasificado,
            montoPendiente: pendiente,
            pendienteClasificar: pendiente > 0.0001,
            estadoClasificacion: pendiente > 0.0001 ? 'Parcial' : 'Clasificada',
            clasificaciones: [...(item.clasificaciones || []), clasificacion],
          };
        })
      );
    }

    return { ok: true };
  };

  const cancelarMovimientoInventario = (movimientoId) => {
    const mov = movimientos.find((item) => item.id === movimientoId);
    if (!mov) return { ok: false, mensaje: 'No se encontró el movimiento.' };

    if (mov.tipo === 'Merma' && Array.isArray(mov.detalleCosto)) {
      setInsumos((lista) => restaurarFIFOEnLista(lista, mov.detalleCosto));
      setMovimientos((lista) => lista.filter((item) => item.id !== movimientoId));
      return { ok: true };
    }

    if (mov.tipo === 'Entrada' && mov.loteId) {
      const insumo = insumos.find((i) => i.id === mov.insumoId);
      const lote = insumo?.lotes?.find((l) => l.id === mov.loteId);
      if (!lote) return { ok: false, mensaje: 'No se encontró el lote.' };
      if (numero(lote.cantidadDisponible) < numero(lote.cantidadInicial) - 0.0001) {
        return { ok: false, mensaje: 'No se puede cancelar porque ya se consumió parte de este lote.' };
      }

      setInsumos((lista) =>
        lista.map((i) =>
          i.id === mov.insumoId
            ? { ...i, lotes: (i.lotes || []).filter((l) => l.id !== mov.loteId) }
            : i
        )
      );
      setMovimientos((lista) => lista.filter((item) => item.id !== movimientoId));
      return { ok: true };
    }

    return { ok: false, mensaje: 'Este movimiento no se puede cancelar directamente.' };
  };

  // =====================================================
  // COMPRAS DE INVENTARIO PENDIENTES DE ASIGNAR
  // =====================================================

  const agregarCompraLibre = ({
    concepto,
    monto,
    metodoPago = 'Efectivo',
    fuenteDinero = 'Casa Shamy',
    pagadoPor = null,
    perteneceA = null,
    nota = '',
    creditoId = null,
  }) => {
    const cantidad = numero(monto);
    if (!cantidad || cantidad <= 0) {
      return { ok: false, mensaje: 'El monto debe ser mayor a 0.' };
    }

    const compraId = crearId('COMLIB');
    let inversionId = null;

    if (fuenteDinero === 'Aportación nueva') {
      const inv = agregarInversion({
        concepto: String(concepto || '').trim() || 'Compra rápida de inventario',
        monto: cantidad,
        pagadoPor: pagadoPor || 'Socio',
        perteneceA: perteneceA || pagadoPor || 'Socio',
        formaAportacion: 'Pago directo',
        metodoPago,
        origen: 'Compra libre inventario',
        referenciaId: compraId,
      });
      inversionId = inv.inversion?.id || null;
    } else if (fuenteDinero === 'Casa Shamy') {
      registrarMovimientoFlujo({
        tipo: 'Salida',
        monto: cantidad,
        concepto: String(concepto || '').trim() || 'Compra rápida de inventario',
        categoria: 'Compra libre inventario',
        metodoPago,
        referenciaId: compraId,
        origen: 'Compra libre inventario',
      });
    }

    const compra = {
      id: compraId,
      concepto: String(concepto || '').trim() || 'Compra rápida de inventario',
      monto: cantidad,
      montoPendiente: cantidad,
      montoClasificado: 0,
      pendienteClasificar: true,
      estadoClasificacion: 'Pendiente',
      clasificaciones: [],
      metodoPago,
      fuenteDinero,
      pagadoPor: fuenteDinero === 'Aportación nueva' ? pagadoPor : null,
      perteneceA: fuenteDinero === 'Aportación nueva' ? perteneceA || pagadoPor : null,
      inversionId,
      creditoId,
      nota: String(nota || '').trim(),
      fechaKey: fechaKeyActual(),
      fecha: fechaActual(),
      hora: horaActual(),
    };

    setComprasLibres((actuales) => [compra, ...actuales]);
    return { ok: true, compra };
  };

  const asignarCompraLibre = ({ compraId, insumoId, montoAsignado, cantidad, nota = '' }) => {
    const compra = comprasLibres.find((item) => item.id === compraId);
    const insumo = insumos.find((item) => item.id === insumoId);
    const monto = numero(montoAsignado);
    const cant = numero(cantidad);

    if (!compra) return { ok: false, mensaje: 'No se encontró la compra pendiente.' };
    if (!insumo) return { ok: false, mensaje: 'No se encontró el insumo.' };
    if (!monto || monto <= 0) return { ok: false, mensaje: 'El monto a asignar debe ser mayor a 0.' };
    if (!cant || cant <= 0) return { ok: false, mensaje: 'La cantidad del insumo debe ser mayor a 0.' };
    if (monto > numero(compra.montoPendiente) + 0.0001) {
      return { ok: false, mensaje: 'El monto supera el saldo pendiente de esta compra.' };
    }

    const resultado = agregarLoteInsumo({
      insumoId,
      cantidad: cant,
      costoTotal: monto,
      origen: 'Clasificación compra libre',
      referenciaId: compraId,
      nota,
    });
    if (!resultado.ok) return resultado;

    const clasificacion = {
      id: crearId('CLA'),
      tipo: 'Nuevo lote',
      insumoId,
      insumoNombre: insumo.nombre,
      loteId: resultado.lote.id,
      cantidad: cant,
      monto,
      nota: String(nota || '').trim(),
      fechaKey: fechaKeyActual(),
      fecha: fechaActual(),
    };

    setComprasLibres((lista) =>
      lista.map((item) => {
        if (item.id !== compraId) return item;
        const clasificado = numero(item.montoClasificado) + monto;
        const pendiente = Math.max(0, numero(item.monto) - clasificado);
        return {
          ...item,
          montoClasificado: clasificado,
          montoPendiente: pendiente,
          pendienteClasificar: pendiente > 0.0001,
          estadoClasificacion: pendiente > 0.0001 ? 'Parcial' : 'Clasificada',
          clasificaciones: [...(item.clasificaciones || []), clasificacion],
        };
      })
    );

    return { ok: true, clasificacion, lote: resultado.lote };
  };

  const cancelarAsignacionCompraLibre = ({ compraId, clasificacionId }) => {
    const compra = comprasLibres.find((item) => item.id === compraId);
    const clasificacion = compra?.clasificaciones?.find((item) => item.id === clasificacionId);
    if (!compra || !clasificacion) return { ok: false, mensaje: 'No se encontró la asignación.' };

    if (clasificacion.loteId) {
      const insumo = insumos.find((item) => item.id === clasificacion.insumoId);
      const lote = insumo?.lotes?.find((item) => item.id === clasificacion.loteId);
      if (!lote) return { ok: false, mensaje: 'No se encontró el lote asociado.' };
      if (numero(lote.cantidadDisponible) < numero(lote.cantidadInicial) - 0.0001) {
        return { ok: false, mensaje: 'No se puede desasignar porque ya se consumió parte de ese inventario.' };
      }

      if (clasificacion.tipo === 'Nuevo lote') {
        setInsumos((lista) =>
          lista.map((item) =>
            item.id === clasificacion.insumoId
              ? { ...item, lotes: (item.lotes || []).filter((l) => l.id !== clasificacion.loteId) }
              : item
          )
        );
        setMovimientos((lista) =>
          lista.filter(
            (mov) => !(mov.referenciaId === compraId && mov.loteId === clasificacion.loteId)
          )
        );
      } else if (clasificacion.tipo === 'Costo de lote existente') {
        setInsumos((lista) =>
          lista.map((item) =>
            item.id !== clasificacion.insumoId
              ? item
              : {
                  ...item,
                  lotes: (item.lotes || []).map((l) =>
                    l.id !== clasificacion.loteId
                      ? l
                      : {
                          ...l,
                          costoTotal: null,
                          costoUnidadBase: null,
                          costoPendiente: true,
                          costoAsignadoDesde: null,
                        }
                  ),
                }
          )
        );
        setMovimientos((lista) =>
          lista.map((mov) =>
            mov.loteId === clasificacion.loteId
              ? { ...mov, costo: null, costoPendiente: true }
              : mov
          )
        );
      }
    }

    const monto = numero(clasificacion.monto);
    setComprasLibres((lista) =>
      lista.map((item) => {
        if (item.id !== compraId) return item;
        const clasificado = Math.max(0, numero(item.montoClasificado) - monto);
        const pendiente = Math.max(0, numero(item.monto) - clasificado);
        return {
          ...item,
          montoClasificado: clasificado,
          montoPendiente: pendiente,
          pendienteClasificar: pendiente > 0.0001,
          estadoClasificacion: clasificado <= 0.0001 ? 'Pendiente' : pendiente > 0.0001 ? 'Parcial' : 'Clasificada',
          clasificaciones: (item.clasificaciones || []).filter((c) => c.id !== clasificacionId),
        };
      })
    );

    return { ok: true };
  };

  const cancelarCompraLibre = (compraId) => {
    const compra = comprasLibres.find((item) => item.id === compraId);
    if (!compra) return { ok: false, mensaje: 'No se encontró la compra.' };
    if (numero(compra.montoClasificado) > 0.0001) {
      return {
        ok: false,
        mensaje: 'Primero desasigna los artículos ya clasificados antes de cancelar la compra.',
      };
    }

    setComprasLibres((lista) => lista.filter((item) => item.id !== compraId));

    if (compra.fuenteDinero === 'Aportación nueva' && compra.inversionId) {
      setInversiones((lista) => lista.filter((item) => item.id !== compra.inversionId));
    } else if (compra.fuenteDinero === 'Casa Shamy') {
      registrarMovimientoFlujo({
        tipo: 'Entrada',
        monto: compra.monto,
        concepto: `Cancelación: ${compra.concepto}`,
        categoria: 'Cancelación compra inventario',
        metodoPago: compra.metodoPago,
        referenciaId: compra.id,
        origen: 'Cancelación compra libre',
      });
    }

    return { ok: true };
  };

  const valorInventarioPendiente = () =>
    comprasLibres.reduce((total, compra) => total + numero(compra.montoPendiente), 0);

  // =====================================================
  // PRODUCTOS / RECETAS
  // =====================================================

  const agregarProducto = ({
    nombre,
    categoria = 'General',
    precio = 0,
    receta = [],
    estadoReceta = null,
    tipoProducto = 'Fijo',
    descripcionPreparacion = '',
    imagenUri = null,
    activo = true,
    permiteNotas = true,
    permiteModificarIngredientes = true,
    preparaciones = [],
    presentaciones = [],
    tamanos = [],
    seccionesPersonalizacion = [],
  }) => {
    const limpio = String(nombre || '').trim();
    if (!limpio) return { ok: false, mensaje: 'Escribe el nombre del producto.' };

    const producto = normalizarProducto({
      id: crearId('PROD'),
      nombre: limpio,
      categoria,
      precio,
      receta,
      estadoReceta: estadoReceta || (receta.length ? 'En proceso' : 'Sin receta'),
      tipoProducto,
      descripcionPreparacion,
      imagenUri,
      activo,
      permiteNotas,
      permiteModificarIngredientes,
      preparaciones,
      presentaciones,
      tamanos,
      seccionesPersonalizacion,
    });

    setProductos((lista) => [producto, ...lista]);
    return { ok: true, producto };
  };

  const editarProducto = (productoId, cambios = {}) => {
    const actual = productos.find((item) => item.id === productoId);
    if (!actual) return { ok: false, mensaje: 'No se encontró el producto.' };

    const nombre = cambios.nombre !== undefined ? String(cambios.nombre).trim() : actual.nombre;
    if (!nombre) return { ok: false, mensaje: 'El producto debe tener nombre.' };

    setProductos((lista) =>
      lista.map((item) =>
        item.id === productoId
          ? normalizarProducto({
              ...item,
              nombre,
              categoria: cambios.categoria ?? item.categoria,
              precio: cambios.precio !== undefined ? numero(cambios.precio) : item.precio,
              tipoProducto: cambios.tipoProducto ?? item.tipoProducto,
              descripcionPreparacion:
                cambios.descripcionPreparacion ?? item.descripcionPreparacion,
              imagenUri: cambios.imagenUri !== undefined ? cambios.imagenUri : item.imagenUri,
              activo: cambios.activo !== undefined ? cambios.activo : item.activo,
              permiteNotas:
                cambios.permiteNotas !== undefined ? cambios.permiteNotas : item.permiteNotas,
              permiteModificarIngredientes:
                cambios.permiteModificarIngredientes !== undefined
                  ? cambios.permiteModificarIngredientes
                  : item.permiteModificarIngredientes,
              preparaciones: cambios.preparaciones ?? item.preparaciones,
              presentaciones: cambios.presentaciones ?? item.presentaciones,
              tamanos: cambios.tamanos ?? item.tamanos,
              seccionesPersonalizacion:
                cambios.seccionesPersonalizacion ?? item.seccionesPersonalizacion,
            })
          : item
      )
    );

    return { ok: true };
  };

  const guardarRecetaProducto = ({ productoId, receta, estadoReceta = null }) => {
    const producto = productos.find((item) => item.id === productoId);
    if (!producto) return { ok: false, mensaje: 'No se encontró el producto.' };

    const limpia = (Array.isArray(receta) ? receta : [])
      .map((item) => ({
        ...item,
        id: item.id || crearId('REC'),
        cantidad: numero(item.cantidad),
      }))
      .filter((item) => item.insumoId && item.cantidad > 0);

    const estado = estadoReceta || (limpia.length ? 'En proceso' : 'Sin receta');

    setProductos((lista) =>
      lista.map((item) =>
        item.id === productoId ? { ...item, receta: limpia, estadoReceta: estado } : item
      )
    );

    return { ok: true };
  };

  const editarRecetaProducto = guardarRecetaProducto;

  const cambiarEstadoReceta = (productoId, estadoReceta) => {
    const permitidos = ['Sin receta', 'En proceso', 'Completa'];
    if (!permitidos.includes(estadoReceta)) {
      return { ok: false, mensaje: 'Estado de receta no válido.' };
    }

    const producto = productos.find((item) => item.id === productoId);
    if (!producto) return { ok: false, mensaje: 'No se encontró el producto.' };
    if (estadoReceta === 'Completa' && (!producto.receta || producto.receta.length === 0)) {
      return { ok: false, mensaje: 'Agrega al menos un ingrediente antes de marcar la receta como completa.' };
    }

    setProductos((lista) =>
      lista.map((item) => (item.id === productoId ? { ...item, estadoReceta } : item))
    );
    return { ok: true };
  };

  const eliminarProducto = (productoId) => {
    const producto = productos.find((item) => item.id === productoId);
    if (!producto) return { ok: false, mensaje: 'No se encontró el producto.' };

    const vendido = ventas.some(
      (venta) =>
        venta.productoId === productoId ||
        (venta.clasificacionProductos || []).some((p) => p.productoId === productoId)
    );
    if (vendido) {
      return {
        ok: false,
        mensaje: 'No se puede eliminar porque existe historial de ventas. Puedes editarlo en su lugar.',
      };
    }

    setProductos((lista) => lista.filter((item) => item.id !== productoId));
    return { ok: true };
  };

  // =====================================================
  // VENTAS
  // =====================================================

  const registrarVentaLibre = ({ concepto, monto, metodoPago = 'Efectivo', nota = '' }) => {
    const cantidad = numero(monto);
    if (!cantidad || cantidad <= 0) {
      return { ok: false, mensaje: 'El monto de la venta debe ser mayor a 0.' };
    }

    const venta = {
      id: crearId('VENLIB'),
      tipoVenta: 'Libre',
      concepto: String(concepto || '').trim() || 'Venta libre',
      producto: String(concepto || '').trim() || 'Venta libre',
      cantidad: 1,
      monto: cantidad,
      metodoPago,
      nota: String(nota || '').trim(),
      costoTotal: null,
      costoConocido: 0,
      utilidadBruta: null,
      utilidadProvisional: cantidad,
      margen: null,
      pendienteClasificar: true,
      pendienteCostear: true,
      estadoClasificacion: 'Pendiente de clasificar y costear',
      detalleCosto: [],
      clasificacionProductos: [],
      fechaKey: fechaKeyActual(),
      fecha: fechaActual(),
      hora: horaActual(),
    };

    setVentas((actuales) => [venta, ...actuales]);
    registrarMovimientoFlujo({
      tipo: 'Entrada',
      monto: cantidad,
      concepto: venta.concepto,
      categoria: 'Venta libre',
      metodoPago,
      referenciaId: venta.id,
      origen: 'Venta libre',
    });
    return { ok: true, venta };
  };

  const registrarVentaProductoPendiente = ({
    productoId,
    cantidad = 1,
    metodoPago = 'Efectivo',
    nota = '',
  }) => {
    const producto = productos.find((item) => item.id === productoId);
    const unidades = numero(cantidad);
    if (!producto) return { ok: false, mensaje: 'No se encontró el producto.' };
    if (!unidades || unidades <= 0) return { ok: false, mensaje: 'La cantidad debe ser mayor a 0.' };

    const monto = numero(producto.precio) * unidades;
    const venta = {
      id: crearId('VENPEN'),
      tipoVenta: 'Producto con costo pendiente',
      productoId,
      producto: producto.nombre,
      concepto: producto.nombre,
      cantidad: unidades,
      monto,
      metodoPago,
      nota: String(nota || '').trim(),
      estadoRecetaAlVender: normalizarEstadoReceta(producto),
      costoTotal: null,
      costoConocido: 0,
      utilidadBruta: null,
      utilidadProvisional: monto,
      margen: null,
      pendienteClasificar: false,
      pendienteCostear: true,
      estadoClasificacion: 'Clasificada - costo pendiente',
      detalleCosto: [],
      clasificacionProductos: [
        {
          productoId,
          producto: producto.nombre,
          cantidad: unidades,
          precioCatalogo: numero(producto.precio),
          costo: null,
          costoPendiente: true,
        },
      ],
      fechaKey: fechaKeyActual(),
      fecha: fechaActual(),
      hora: horaActual(),
    };

    setVentas((lista) => [venta, ...lista]);
    registrarMovimientoFlujo({
      tipo: 'Entrada',
      monto,
      concepto: producto.nombre,
      categoria: 'Venta',
      metodoPago,
      referenciaId: venta.id,
      origen: 'Venta producto con costo pendiente',
      fechaKey: venta.fechaKey,
      fecha: venta.fecha,
      hora: venta.hora,
    });

    return { ok: true, venta };
  };

  const registrarVentaProducto = ({ productoId, cantidad = 1, metodoPago = 'Efectivo', nota = '' }) => {
    const producto = productos.find((item) => item.id === productoId);
    const unidades = numero(cantidad);

    if (!producto) return { ok: false, mensaje: 'No se encontró el producto.' };
    if (!unidades || unidades <= 0) return { ok: false, mensaje: 'La cantidad debe ser mayor a 0.' };

    // La falta de receta nunca bloquea la venta. Se registra el ingreso y
    // el costo queda pendiente hasta que la receta pueda costearse.
    if (normalizarEstadoReceta(producto) !== 'Completa' || !producto.receta?.length) {
      return registrarVentaProductoPendiente({ productoId, cantidad: unidades, metodoPago, nota });
    }

    let listaTrabajo = insumos.map((i) => ({ ...i, lotes: (i.lotes || []).map((l) => ({ ...l })) }));
    let costoTotal = 0;
    const detalleCosto = [];

    for (const ingrediente of producto.receta) {
      const requerido = numero(ingrediente.cantidad) * unidades;
      const plan = planificarFIFO(listaTrabajo, ingrediente.insumoId, requerido);

      // Si físicamente no hay inventario suficiente, sí bloqueamos la venta
      // de un producto cuya receta ya conocemos.
      if (!plan.ok) return plan;

      // Si existe el inventario pero su costo todavía no está resuelto,
      // permitimos vender y dejamos el costo pendiente.
      if (plan.costoPendiente) {
        return registrarVentaProductoPendiente({ productoId, cantidad: unidades, metodoPago, nota });
      }

      costoTotal += numero(plan.costo);
      detalleCosto.push(...plan.detalle);
      listaTrabajo = aplicarConsumoFIFOEnLista(listaTrabajo, plan.detalle);
    }

    const monto = numero(producto.precio) * unidades;
    const utilidadBruta = monto - costoTotal;
    const margen = monto > 0 ? (utilidadBruta / monto) * 100 : 0;

    const venta = {
      id: crearId('VEN'),
      tipoVenta: 'Normal',
      productoId,
      producto: producto.nombre,
      concepto: producto.nombre,
      cantidad: unidades,
      monto,
      metodoPago,
      nota: String(nota || '').trim(),
      costoTotal: redondear(costoTotal),
      costoConocido: redondear(costoTotal),
      utilidadBruta: redondear(utilidadBruta),
      utilidadProvisional: redondear(utilidadBruta),
      margen,
      pendienteClasificar: false,
      pendienteCostear: false,
      estadoClasificacion: 'Clasificada',
      detalleCosto,
      clasificacionProductos: [
        {
          productoId,
          producto: producto.nombre,
          cantidad: unidades,
          precioCatalogo: numero(producto.precio),
          costo: redondear(costoTotal),
          costoPendiente: false,
        },
      ],
      fechaKey: fechaKeyActual(),
      fecha: fechaActual(),
      hora: horaActual(),
    };

    setInsumos(listaTrabajo);
    setVentas((lista) => [venta, ...lista]);

    const movimientosVenta = detalleCosto.map((detalle) => ({
      id: crearId('MOV'),
      tipo: 'Venta',
      insumoId: detalle.insumoId,
      insumoNombre: detalle.insumoNombre,
      cantidad: -numero(detalle.cantidad),
      unidadBase: insumos.find((i) => i.id === detalle.insumoId)?.unidadBase || '',
      costo: detalle.costo,
      loteId: detalle.loteId,
      ventaId: venta.id,
      referenciaId: venta.id,
      fechaKey: venta.fechaKey,
      fecha: venta.fecha,
      hora: venta.hora,
    }));
    setMovimientos((lista) => [...movimientosVenta, ...lista]);

    registrarMovimientoFlujo({
      tipo: 'Entrada',
      monto,
      concepto: producto.nombre,
      categoria: 'Venta',
      metodoPago,
      referenciaId: venta.id,
      origen: 'Venta',
      fechaKey: venta.fechaKey,
      fecha: venta.fecha,
      hora: venta.hora,
    });

    return { ok: true, venta, utilidadBruta: venta.utilidadBruta };
  };

  const clasificarVentaLibre = ({ ventaId, partidas }) => {
    const venta = ventas.find((item) => item.id === ventaId);
    if (!venta) return { ok: false, mensaje: 'No se encontró la venta.' };
    if (!venta.pendienteClasificar) return { ok: false, mensaje: 'La venta ya está clasificada.' };

    const listaPartidas = (Array.isArray(partidas) ? partidas : []).filter(
      (p) => p.productoId && numero(p.cantidad) > 0
    );
    if (listaPartidas.length === 0) {
      return { ok: false, mensaje: 'Agrega al menos un producto para clasificar la venta.' };
    }

    let listaTrabajo = insumos.map((i) => ({ ...i, lotes: (i.lotes || []).map((l) => ({ ...l })) }));
    let costoConocido = 0;
    const detalleCosto = [];
    const clasificacionProductos = [];
    let hayPendientes = false;

    for (const partida of listaPartidas) {
      const producto = productos.find((p) => p.id === partida.productoId);
      const unidades = numero(partida.cantidad);
      if (!producto) return { ok: false, mensaje: 'Uno de los productos ya no existe.' };

      // Clasificar y costear son cosas diferentes. Si todavía no conocemos
      // la receta, guardamos la clasificación sin inventar un costo.
      if (normalizarEstadoReceta(producto) !== 'Completa' || !producto.receta?.length) {
        hayPendientes = true;
        clasificacionProductos.push({
          productoId: producto.id,
          producto: producto.nombre,
          cantidad: unidades,
          precioCatalogo: numero(producto.precio),
          costo: null,
          costoPendiente: true,
        });
        continue;
      }

      let trabajoProducto = listaTrabajo.map((i) => ({
        ...i,
        lotes: (i.lotes || []).map((l) => ({ ...l })),
      }));
      let costoProducto = 0;
      const detalleProducto = [];
      let productoCosteable = true;

      for (const ingrediente of producto.receta) {
        const requerido = numero(ingrediente.cantidad) * unidades;
        const plan = planificarFIFO(trabajoProducto, ingrediente.insumoId, requerido);

        if (!plan.ok || plan.costoPendiente) {
          productoCosteable = false;
          break;
        }

        costoProducto += numero(plan.costo);
        detalleProducto.push(...plan.detalle);
        trabajoProducto = aplicarConsumoFIFOEnLista(trabajoProducto, plan.detalle);
      }

      if (!productoCosteable) {
        hayPendientes = true;
        clasificacionProductos.push({
          productoId: producto.id,
          producto: producto.nombre,
          cantidad: unidades,
          precioCatalogo: numero(producto.precio),
          costo: null,
          costoPendiente: true,
        });
        continue;
      }

      listaTrabajo = trabajoProducto;
      costoConocido += costoProducto;
      detalleCosto.push(...detalleProducto);
      clasificacionProductos.push({
        productoId: producto.id,
        producto: producto.nombre,
        cantidad: unidades,
        precioCatalogo: numero(producto.precio),
        costo: redondear(costoProducto),
        costoPendiente: false,
      });
    }

    const utilidadProvisional = numero(venta.monto) - costoConocido;
    const totalmenteCosteada = !hayPendientes;
    const utilidadBruta = totalmenteCosteada ? utilidadProvisional : null;
    const margen = totalmenteCosteada && numero(venta.monto) > 0
      ? (utilidadProvisional / numero(venta.monto)) * 100
      : null;

    setInsumos(listaTrabajo);
    setVentas((lista) =>
      lista.map((item) =>
        item.id === ventaId
          ? {
              ...item,
              costoTotal: totalmenteCosteada ? redondear(costoConocido) : null,
              costoConocido: redondear(costoConocido),
              utilidadBruta: utilidadBruta === null ? null : redondear(utilidadBruta),
              utilidadProvisional: redondear(utilidadProvisional),
              margen,
              pendienteClasificar: false,
              pendienteCostear: hayPendientes,
              estadoClasificacion: hayPendientes
                ? 'Clasificada - costo pendiente'
                : 'Clasificada',
              detalleCosto,
              clasificacionProductos,
            }
          : item
      )
    );

    const movs = detalleCosto.map((detalle) => ({
      id: crearId('MOV'),
      tipo: 'Venta',
      insumoId: detalle.insumoId,
      insumoNombre: detalle.insumoNombre,
      cantidad: -numero(detalle.cantidad),
      unidadBase: insumos.find((i) => i.id === detalle.insumoId)?.unidadBase || '',
      costo: detalle.costo,
      loteId: detalle.loteId,
      ventaId,
      referenciaId: ventaId,
      fechaKey: venta.fechaKey,
      fecha: venta.fecha,
      hora: venta.hora,
      origen: 'Clasificación venta pendiente',
    }));
    if (movs.length) setMovimientos((lista) => [...movs, ...lista]);

    return {
      ok: true,
      costoTotal: totalmenteCosteada ? redondear(costoConocido) : null,
      costoConocido: redondear(costoConocido),
      utilidadBruta: utilidadBruta === null ? null : redondear(utilidadBruta),
      utilidadProvisional: redondear(utilidadProvisional),
      pendienteCostear: hayPendientes,
      clasificacionProductos,
    };
  };

  const costearVentaProductoPendiente = (ventaId) => {
    const venta = ventas.find((item) => item.id === ventaId);
    if (!venta) return { ok: false, mensaje: 'No se encontró la venta.' };
    if (venta.pendienteClasificar) {
      return { ok: false, mensaje: 'Primero clasifica esta venta.' };
    }
    if (!venta.pendienteCostear) {
      return { ok: false, mensaje: 'Esta venta ya está costeada.' };
    }

    const partidasActuales = Array.isArray(venta.clasificacionProductos)
      ? venta.clasificacionProductos
      : [];

    if (!partidasActuales.length && venta.productoId) {
      partidasActuales.push({
        productoId: venta.productoId,
        producto: venta.producto,
        cantidad: venta.cantidad || 1,
        precioCatalogo: 0,
        costo: null,
        costoPendiente: true,
      });
    }

    if (!partidasActuales.length) {
      return { ok: false, mensaje: 'Esta venta no tiene productos clasificados para costear.' };
    }

    let listaTrabajo = insumos.map((i) => ({ ...i, lotes: (i.lotes || []).map((l) => ({ ...l })) }));
    const nuevasPartidas = [];
    const nuevoDetalle = [];
    let costoConocido = 0;
    let pendientes = 0;
    let costeadosAhora = 0;

    for (const partida of partidasActuales) {
      // Nunca volvemos a consumir una partida que ya fue costeada.
      if (partida.costo !== null && partida.costo !== undefined) {
        const costoPrevio = numero(partida.costo);
        costoConocido += costoPrevio;
        nuevasPartidas.push({ ...partida, costoPendiente: false });
        continue;
      }

      const producto = productos.find((p) => p.id === partida.productoId);
      const unidades = numero(partida.cantidad);

      if (!producto || normalizarEstadoReceta(producto) !== 'Completa' || !producto.receta?.length) {
        pendientes += 1;
        nuevasPartidas.push({ ...partida, costo: null, costoPendiente: true });
        continue;
      }

      let trabajoProducto = listaTrabajo.map((i) => ({
        ...i,
        lotes: (i.lotes || []).map((l) => ({ ...l })),
      }));
      let costoProducto = 0;
      const detalleProducto = [];
      let productoCosteable = true;

      for (const ingrediente of producto.receta) {
        const requerido = numero(ingrediente.cantidad) * unidades;
        const plan = planificarFIFO(trabajoProducto, ingrediente.insumoId, requerido);

        if (!plan.ok || plan.costoPendiente) {
          productoCosteable = false;
          break;
        }

        costoProducto += numero(plan.costo);
        detalleProducto.push(...plan.detalle);
        trabajoProducto = aplicarConsumoFIFOEnLista(trabajoProducto, plan.detalle);
      }

      if (!productoCosteable) {
        pendientes += 1;
        nuevasPartidas.push({ ...partida, costo: null, costoPendiente: true });
        continue;
      }

      listaTrabajo = trabajoProducto;
      costoConocido += costoProducto;
      costeadosAhora += 1;
      nuevoDetalle.push(...detalleProducto);
      nuevasPartidas.push({
        ...partida,
        producto: producto.nombre,
        costo: redondear(costoProducto),
        costoPendiente: false,
      });
    }

    const detalleAcumulado = [...(venta.detalleCosto || []), ...nuevoDetalle];
    const totalmenteCosteada = pendientes === 0;
    const utilidadProvisional = numero(venta.monto) - costoConocido;
    const utilidadBruta = totalmenteCosteada ? utilidadProvisional : null;
    const margen = totalmenteCosteada && numero(venta.monto) > 0
      ? (utilidadProvisional / numero(venta.monto)) * 100
      : null;

    setInsumos(listaTrabajo);
    setVentas((lista) =>
      lista.map((item) =>
        item.id === ventaId
          ? {
              ...item,
              costoTotal: totalmenteCosteada ? redondear(costoConocido) : null,
              costoConocido: redondear(costoConocido),
              utilidadBruta: utilidadBruta === null ? null : redondear(utilidadBruta),
              utilidadProvisional: redondear(utilidadProvisional),
              margen,
              pendienteCostear: !totalmenteCosteada,
              estadoClasificacion: totalmenteCosteada
                ? 'Clasificada'
                : 'Clasificada - costo pendiente',
              detalleCosto: detalleAcumulado,
              clasificacionProductos: nuevasPartidas,
            }
          : item
      )
    );

    const movs = nuevoDetalle.map((detalle) => ({
      id: crearId('MOV'),
      tipo: 'Venta',
      insumoId: detalle.insumoId,
      insumoNombre: detalle.insumoNombre,
      cantidad: -numero(detalle.cantidad),
      unidadBase: insumos.find((i) => i.id === detalle.insumoId)?.unidadBase || '',
      costo: detalle.costo,
      loteId: detalle.loteId,
      ventaId,
      referenciaId: ventaId,
      fechaKey: venta.fechaKey,
      fecha: venta.fecha,
      hora: venta.hora,
      origen: 'Costeo posterior de venta',
    }));
    if (movs.length) setMovimientos((lista) => [...movs, ...lista]);

    if (costeadosAhora === 0 && !totalmenteCosteada) {
      return {
        ok: false,
        mensaje: 'Todavía hay productos sin receta completa, sin inventario suficiente o con costo pendiente.',
      };
    }

    return {
      ok: true,
      costoTotal: totalmenteCosteada ? redondear(costoConocido) : null,
      costoConocido: redondear(costoConocido),
      utilidadBruta: utilidadBruta === null ? null : redondear(utilidadBruta),
      utilidadProvisional: redondear(utilidadProvisional),
      pendienteCostear: !totalmenteCosteada,
      costeadosAhora,
    };
  };

  const cancelarVenta = (ventaId) => {
    const venta = ventas.find((item) => item.id === ventaId);
    if (!venta) return { ok: false, mensaje: 'No se encontró la venta.' };

    if (Array.isArray(venta.detalleCosto) && venta.detalleCosto.length > 0) {
      setInsumos((lista) => restaurarFIFOEnLista(lista, venta.detalleCosto));
      setMovimientos((lista) => lista.filter((mov) => mov.ventaId !== ventaId));
    }

    setVentas((lista) => lista.filter((item) => item.id !== ventaId));
    registrarMovimientoFlujo({
      tipo: 'Salida',
      monto: venta.monto,
      concepto: `Cancelación: ${venta.producto || venta.concepto || 'Venta'}`,
      categoria: 'Cancelación venta',
      metodoPago: venta.metodoPago,
      referenciaId: venta.id,
      origen: 'Cancelación venta',
    });
    return { ok: true };
  };

  // =====================================================
  // GASTOS
  // =====================================================

  const agregarGasto = ({
    concepto,
    monto,
    categoria = 'Operación',
    tipo = 'Variable',
    frecuencia = 'Único',
    metodoPago = 'Efectivo',
    fuenteDinero = 'Casa Shamy',
    pagadoDesde = null,
    pagadoPor = null,
    perteneceA = null,
    pendienteAsignar = false,
    nota = '',
    creditoId = null,
  }) => {
    const cantidad = numero(monto);
    if (!cantidad || cantidad <= 0) return { ok: false, mensaje: 'El monto debe ser mayor a 0.' };

    const gastoId = crearId('GAS');
    const fuente = pagadoDesde || fuenteDinero || 'Casa Shamy';
    let inversionId = null;

    if (fuente === 'Aportación nueva') {
      const inv = agregarInversion({
        concepto: `Gasto: ${String(concepto || '').trim() || 'Gasto'}`,
        monto: cantidad,
        pagadoPor: pagadoPor || 'Socio',
        perteneceA: perteneceA || pagadoPor || 'Socio',
        formaAportacion: 'Pago directo',
        metodoPago,
        origen: 'Gasto pagado por socio',
        referenciaId: gastoId,
      });
      inversionId = inv.inversion?.id || null;
    } else if (fuente === 'Casa Shamy') {
      registrarMovimientoFlujo({
        tipo: 'Salida',
        monto: cantidad,
        concepto: String(concepto || '').trim() || 'Gasto',
        categoria: 'Gasto',
        metodoPago,
        referenciaId: gastoId,
        origen: 'Gasto',
      });
    }

    const gasto = {
      id: gastoId,
      concepto: String(concepto || '').trim() || 'Gasto',
      monto: cantidad,
      categoria,
      tipo,
      frecuencia,
      metodoPago,
      fuenteDinero: fuente,
      pagadoDesde: fuente,
      pagadoPor: fuente === 'Aportación nueva' ? pagadoPor : fuente === 'Casa Shamy' ? 'Casa Shamy' : pagadoPor,
      perteneceA: fuente === 'Aportación nueva' ? perteneceA || pagadoPor : null,
      inversionId,
      creditoId,
      pendienteAsignar: pendienteAsignar === true,
      montoClasificado: pendienteAsignar ? 0 : cantidad,
      montoPendiente: pendienteAsignar ? cantidad : 0,
      estadoClasificacion: pendienteAsignar ? 'Pendiente' : 'Clasificado',
      clasificaciones: [],
      nota: String(nota || '').trim(),
      fechaKey: fechaKeyActual(),
      fecha: fechaActual(),
      hora: horaActual(),
    };

    setGastos((lista) => [gasto, ...lista]);
    return { ok: true, gasto };
  };

  const agregarGastoPendiente = (datos) => agregarGasto({ ...datos, pendienteAsignar: true });

  const asignarGastoPendiente = ({ gastoId, montoAsignado, concepto, categoria, nota = '' }) => {
    const gasto = gastos.find((item) => item.id === gastoId);
    const monto = numero(montoAsignado);
    if (!gasto) return { ok: false, mensaje: 'No se encontró el gasto.' };
    if (!gasto.pendienteAsignar) return { ok: false, mensaje: 'Este gasto no tiene saldo pendiente de asignar.' };
    if (!monto || monto <= 0) return { ok: false, mensaje: 'El monto debe ser mayor a 0.' };
    if (monto > numero(gasto.montoPendiente) + 0.0001) {
      return { ok: false, mensaje: 'El monto supera el saldo pendiente del gasto.' };
    }

    const clasificacion = {
      id: crearId('CLAGAS'),
      concepto: String(concepto || '').trim() || gasto.concepto,
      categoria: categoria || gasto.categoria,
      monto,
      nota: String(nota || '').trim(),
      fechaKey: fechaKeyActual(),
      fecha: fechaActual(),
    };

    setGastos((lista) =>
      lista.map((item) => {
        if (item.id !== gastoId) return item;
        const clasificado = numero(item.montoClasificado) + monto;
        const pendiente = Math.max(0, numero(item.monto) - clasificado);
        return {
          ...item,
          montoClasificado: clasificado,
          montoPendiente: pendiente,
          pendienteAsignar: pendiente > 0.0001,
          estadoClasificacion: pendiente > 0.0001 ? 'Parcial' : 'Clasificado',
          clasificaciones: [...(item.clasificaciones || []), clasificacion],
        };
      })
    );

    return { ok: true, clasificacion };
  };

  const editarGasto = (gastoId, cambios = {}) => {
    const gasto = gastos.find((item) => item.id === gastoId);
    if (!gasto) return { ok: false, mensaje: 'No se encontró el gasto.' };

    const nuevoMonto = cambios.monto !== undefined ? numero(cambios.monto) : numero(gasto.monto);
    if (Math.abs(nuevoMonto - numero(gasto.monto)) > 0.0001) {
      return {
        ok: false,
        mensaje: 'Para cambiar el monto de un gasto ya registrado, cancélalo y vuelve a registrarlo. Así no se rompe el flujo.',
      };
    }

    setGastos((lista) =>
      lista.map((item) =>
        item.id === gastoId
          ? {
              ...item,
              concepto: cambios.concepto ?? item.concepto,
              categoria: cambios.categoria ?? item.categoria,
              tipo: cambios.tipo ?? item.tipo,
              frecuencia: cambios.frecuencia ?? item.frecuencia,
              nota: cambios.nota ?? item.nota,
            }
          : item
      )
    );
    return { ok: true };
  };

  const cancelarGasto = (gastoId) => {
    const gasto = gastos.find((item) => item.id === gastoId);
    if (!gasto) return { ok: false, mensaje: 'No se encontró el gasto.' };
    if (gasto.creditoId) {
      return { ok: false, mensaje: 'Este gasto pertenece a un crédito. Cancélalo desde Créditos.' };
    }

    setGastos((lista) => lista.filter((item) => item.id !== gastoId));

    if (gasto.fuenteDinero === 'Aportación nueva' && gasto.inversionId) {
      setInversiones((lista) => lista.filter((item) => item.id !== gasto.inversionId));
    } else if (gasto.fuenteDinero === 'Casa Shamy') {
      registrarMovimientoFlujo({
        tipo: 'Entrada',
        monto: gasto.monto,
        concepto: `Cancelación: ${gasto.concepto}`,
        categoria: 'Cancelación gasto',
        metodoPago: gasto.metodoPago,
        referenciaId: gasto.id,
        origen: 'Cancelación gasto',
      });
    }

    return { ok: true };
  };

  // =====================================================
  // CRÉDITOS CON PROVEEDORES
  // =====================================================

  const agregarCreditoProveedor = ({
    proveedor,
    concepto,
    monto,
    tipo = 'Inventario',
    categoriaGasto = 'Operación',
    tipoGasto = 'Variable',
    fechaVencimiento = null,
    plazoDias = null,
    nota = '',
    pendienteAsignar = true,
  }) => {
    const cantidad = numero(monto);
    const nombreProveedor = String(proveedor || '').trim();
    if (!nombreProveedor) return { ok: false, mensaje: 'Escribe el proveedor.' };
    if (!cantidad || cantidad <= 0) return { ok: false, mensaje: 'El monto debe ser mayor a 0.' };

    const creditoId = crearId('CRE');
    let referenciaId = null;

    if (tipo === 'Inventario') {
      const compra = {
        id: crearId('COMLIB'),
        concepto: String(concepto || '').trim() || `Compra a crédito - ${nombreProveedor}`,
        monto: cantidad,
        montoPendiente: cantidad,
        montoClasificado: 0,
        pendienteClasificar: true,
        estadoClasificacion: 'Pendiente',
        clasificaciones: [],
        metodoPago: 'Crédito proveedor',
        fuenteDinero: 'Crédito proveedor',
        pagadoPor: null,
        perteneceA: null,
        inversionId: null,
        creditoId,
        nota: String(nota || '').trim(),
        fechaKey: fechaKeyActual(),
        fecha: fechaActual(),
        hora: horaActual(),
      };
      referenciaId = compra.id;
      setComprasLibres((lista) => [compra, ...lista]);
    } else {
      const gastoId = crearId('GAS');
      const gasto = {
        id: gastoId,
        concepto: String(concepto || '').trim() || `Gasto a crédito - ${nombreProveedor}`,
        monto: cantidad,
        categoria: categoriaGasto,
        tipo: tipoGasto,
        frecuencia: 'Único',
        metodoPago: 'Crédito proveedor',
        fuenteDinero: 'Crédito proveedor',
        pagadoDesde: 'Crédito proveedor',
        pagadoPor: nombreProveedor,
        perteneceA: null,
        inversionId: null,
        creditoId,
        pendienteAsignar: pendienteAsignar === true,
        montoClasificado: pendienteAsignar ? 0 : cantidad,
        montoPendiente: pendienteAsignar ? cantidad : 0,
        estadoClasificacion: pendienteAsignar ? 'Pendiente' : 'Clasificado',
        clasificaciones: [],
        nota: String(nota || '').trim(),
        fechaKey: fechaKeyActual(),
        fecha: fechaActual(),
        hora: horaActual(),
      };
      referenciaId = gasto.id;
      setGastos((lista) => [gasto, ...lista]);
    }

    let vencimiento = fechaVencimiento || null;
    if (!vencimiento && numero(plazoDias) > 0) {
      const d = new Date();
      d.setDate(d.getDate() + numero(plazoDias));
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const dia = String(d.getDate()).padStart(2, '0');
      vencimiento = `${y}-${m}-${dia}`;
    }

    const credito = {
      id: creditoId,
      proveedor: nombreProveedor,
      concepto: String(concepto || '').trim() || (tipo === 'Inventario' ? 'Compra de inventario' : 'Gasto'),
      tipo,
      montoOriginal: cantidad,
      fechaVencimiento: vencimiento,
      plazoDias: plazoDias ? numero(plazoDias) : null,
      referenciaId,
      nota: String(nota || '').trim(),
      fechaKey: fechaKeyActual(),
      fecha: fechaActual(),
      hora: horaActual(),
    };

    setCreditosProveedores((lista) => [credito, ...lista]);
    return { ok: true, credito };
  };

  const obtenerResumenCreditos = () => {
    const hoy = fechaKeyActual();
    return creditosProveedores.map((credito) => {
      const pagos = pagosCreditos.filter((p) => p.creditoId === credito.id);
      const pagado = pagos.reduce((sum, p) => sum + numero(p.monto), 0);
      const saldo = Math.max(0, numero(credito.montoOriginal) - pagado);
      let estado = 'Pendiente';
      if (saldo <= 0.0001) estado = 'Pagado';
      else if (pagado > 0.0001) estado = 'Parcial';
      if (saldo > 0.0001 && credito.fechaVencimiento && credito.fechaVencimiento < hoy) estado = 'Vencido';
      return { ...credito, pagado, saldo, estado, pagos };
    });
  };

  const pagarCreditoProveedor = ({
    creditoId,
    monto,
    metodoPago = 'Transferencia',
    fuenteDinero = 'Casa Shamy',
    pagadoPor = null,
    perteneceA = null,
    nota = '',
  }) => {
    const resumen = obtenerResumenCreditos().find((item) => item.id === creditoId);
    const cantidad = numero(monto);
    if (!resumen) return { ok: false, mensaje: 'No se encontró el crédito.' };
    if (!cantidad || cantidad <= 0) return { ok: false, mensaje: 'El monto debe ser mayor a 0.' };
    if (cantidad > numero(resumen.saldo) + 0.0001) {
      return { ok: false, mensaje: 'El pago supera el saldo pendiente del crédito.' };
    }

    const pagoId = crearId('PCRE');
    let inversionId = null;

    if (fuenteDinero === 'Aportación nueva') {
      const inv = agregarInversion({
        concepto: `Pago a proveedor ${resumen.proveedor}`,
        monto: cantidad,
        pagadoPor: pagadoPor || 'Socio',
        perteneceA: perteneceA || pagadoPor || 'Socio',
        formaAportacion: 'Pago directo',
        metodoPago,
        origen: 'Pago crédito proveedor',
        referenciaId: pagoId,
      });
      inversionId = inv.inversion?.id || null;
    } else {
      registrarMovimientoFlujo({
        tipo: 'Salida',
        monto: cantidad,
        concepto: `Pago a proveedor ${resumen.proveedor}`,
        categoria: 'Pago crédito proveedor',
        metodoPago,
        referenciaId: pagoId,
        origen: 'Pago crédito proveedor',
      });
    }

    const pago = {
      id: pagoId,
      creditoId,
      proveedor: resumen.proveedor,
      monto: cantidad,
      metodoPago,
      fuenteDinero,
      pagadoPor: fuenteDinero === 'Aportación nueva' ? pagadoPor : 'Casa Shamy',
      perteneceA: fuenteDinero === 'Aportación nueva' ? perteneceA || pagadoPor : null,
      inversionId,
      nota: String(nota || '').trim(),
      fechaKey: fechaKeyActual(),
      fecha: fechaActual(),
      hora: horaActual(),
    };

    setPagosCreditos((lista) => [pago, ...lista]);
    return { ok: true, pago };
  };

  const cancelarPagoCredito = (pagoId) => {
    const pago = pagosCreditos.find((item) => item.id === pagoId);
    if (!pago) return { ok: false, mensaje: 'No se encontró el pago.' };

    setPagosCreditos((lista) => lista.filter((item) => item.id !== pagoId));

    if (pago.fuenteDinero === 'Aportación nueva' && pago.inversionId) {
      setInversiones((lista) => lista.filter((item) => item.id !== pago.inversionId));
    } else if (pago.fuenteDinero === 'Casa Shamy') {
      registrarMovimientoFlujo({
        tipo: 'Entrada',
        monto: pago.monto,
        concepto: `Cancelación pago a ${pago.proveedor}`,
        categoria: 'Cancelación crédito',
        metodoPago: pago.metodoPago,
        referenciaId: pago.id,
        origen: 'Cancelación pago crédito',
      });
    }

    return { ok: true };
  };

  const editarCreditoProveedor = (creditoId, cambios = {}) => {
    const credito = creditosProveedores.find((item) => item.id === creditoId);
    if (!credito) return { ok: false, mensaje: 'No se encontró el crédito.' };
    if (cambios.montoOriginal !== undefined && numero(cambios.montoOriginal) !== numero(credito.montoOriginal)) {
      return {
        ok: false,
        mensaje: 'Para cambiar el monto original del crédito, cancélalo y vuelve a registrarlo.',
      };
    }

    setCreditosProveedores((lista) =>
      lista.map((item) =>
        item.id === creditoId
          ? {
              ...item,
              proveedor: cambios.proveedor ?? item.proveedor,
              concepto: cambios.concepto ?? item.concepto,
              fechaVencimiento: cambios.fechaVencimiento ?? item.fechaVencimiento,
              nota: cambios.nota ?? item.nota,
            }
          : item
      )
    );
    return { ok: true };
  };

  const cancelarCreditoProveedor = (creditoId) => {
    const credito = creditosProveedores.find((item) => item.id === creditoId);
    if (!credito) return { ok: false, mensaje: 'No se encontró el crédito.' };
    const pagos = pagosCreditos.filter((p) => p.creditoId === creditoId);
    if (pagos.length > 0) {
      return { ok: false, mensaje: 'Primero cancela los pagos registrados de este crédito.' };
    }

    if (credito.tipo === 'Inventario') {
      const compra = comprasLibres.find((c) => c.id === credito.referenciaId);
      if (compra && numero(compra.montoClasificado) > 0.0001) {
        return { ok: false, mensaje: 'Primero desasigna el inventario clasificado de este crédito.' };
      }
      setComprasLibres((lista) => lista.filter((c) => c.id !== credito.referenciaId));
    } else {
      setGastos((lista) => lista.filter((g) => g.id !== credito.referenciaId));
    }

    setCreditosProveedores((lista) => lista.filter((item) => item.id !== creditoId));
    return { ok: true };
  };

  // =====================================================
  // VALORES DERIVADOS
  // =====================================================

  const comprasPendientes = useMemo(
    () => comprasLibres.filter((item) => numero(item.montoPendiente) > 0.0001),
    [comprasLibres]
  );

  const gastosPendientes = useMemo(
    () => gastos.filter((item) => item.pendienteAsignar && numero(item.montoPendiente) > 0.0001),
    [gastos]
  );

  const ventasPendientes = useMemo(
    () => ventas.filter((item) => item.pendienteClasificar || item.pendienteCostear),
    [ventas]
  );

  const actualizarInsumo = editarInsumo;
  const actualizarProducto = editarProducto;
  const guardarProducto = agregarProducto;
  const agregarReceta = guardarRecetaProducto;
  const actualizarReceta = guardarRecetaProducto;
  const registrarEntradaInventario = agregarLoteInsumo;

  const valorContexto = {
    datosCargados,

    insumos,
    movimientos,
    productos,
    ventas,
    gastos,
    inversiones,
    pagosInversion,
    movimientosFlujo,
    comprasLibres,
    creditosProveedores,
    pagosCreditos,

    comprasPendientes,
    gastosPendientes,
    ventasPendientes,

    numero,
    existenciaDe,
    valorDe,
    valorInventario,
    inventarioConCostoPendiente,

    registrarMovimientoFlujo,
    saldoFlujo,

    agregarInversion,
    cancelarInversion,
    pagarInversion,
    cancelarPagoInversion,
    obtenerResumenInversionistas,

    agregarInsumo,
    editarInsumo,
    actualizarInsumo,
    eliminarInsumo,
    agregarLoteInsumo,
    registrarEntradaInventario,
    agregarInventarioSinCosto,
    registrarCompraInsumo,
    agregarCompra,
    registrarCompra,
    calcularCostoFIFO,
    registrarMerma,
    agregarMerma,
    asignarCostoPendienteLote,
    cancelarMovimientoInventario,

    agregarCompraLibre,
    asignarCompraLibre,
    cancelarAsignacionCompraLibre,
    cancelarCompraLibre,
    valorInventarioPendiente,

    agregarProducto,
    guardarProducto,
    editarProducto,
    actualizarProducto,
    eliminarProducto,
    guardarRecetaProducto,
    agregarReceta,
    actualizarReceta,
    editarRecetaProducto,
    cambiarEstadoReceta,

    registrarVentaProducto,
    registrarVentaProductoPendiente,
    registrarVentaLibre,
    clasificarVentaLibre,
    costearVentaProductoPendiente,
    cancelarVenta,

    agregarGasto,
    agregarGastoPendiente,
    asignarGastoPendiente,
    editarGasto,
    cancelarGasto,

    agregarCreditoProveedor,
    obtenerResumenCreditos,
    pagarCreditoProveedor,
    cancelarPagoCredito,
    editarCreditoProveedor,
    cancelarCreditoProveedor,
  };

  return React.createElement(
    DatosNegocioContext.Provider,
    { value: valorContexto },
    children
  );
}

export function useNegocio() {
  const contexto = useContext(DatosNegocioContext);
  if (!contexto) {
    throw new Error('useNegocio debe usarse dentro de DatosNegocioProvider.');
  }
  return contexto;
}
