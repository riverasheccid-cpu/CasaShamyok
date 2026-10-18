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


const CUENTAS_FLUJO = ['Efectivo', 'Banco', 'Tarjeta'];

const normalizarCuentaFlujo = (valor) => {
  const limpio = String(valor || '').trim().toLowerCase();
  if (!limpio) return null;
  if (limpio.includes('efectivo')) return 'Efectivo';
  if (limpio.includes('tarjeta')) return 'Tarjeta';
  if (limpio.includes('transfer') || limpio.includes('banco')) return 'Banco';
  return null;
};

const metodoPagoDesdeCuenta = (cuenta) => {
  if (cuenta === 'Banco') return 'Transferencia';
  if (cuenta === 'Tarjeta') return 'Tarjeta';
  return 'Efectivo';
};

export function DatosNegocioProvider({ children }) {
  const [insumos, setInsumos] = useState([]);
  const [movimientos, setMovimientos] = useState([]);
  const [productos, setProductos] = useState([]);
  const [ventas, setVentas] = useState([]);
  const [gastos, setGastos] = useState([]);
  const [inversiones, setInversiones] = useState([]);
  const [pagosInversion, setPagosInversion] = useState([]);
  const [movimientosFlujo, setMovimientosFlujo] = useState([]);
  const [saldosInicialesFlujo, setSaldosInicialesFlujo] = useState({ Efectivo: 0, Banco: 0, Tarjeta: 0 });
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
          const saldosGuardados = datos.saldosInicialesFlujo || {};
          setSaldosInicialesFlujo({
            Efectivo: numero(saldosGuardados.Efectivo),
            Banco: numero(saldosGuardados.Banco),
            Tarjeta: numero(saldosGuardados.Tarjeta),
          });
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
            saldosInicialesFlujo,
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
    saldosInicialesFlujo,
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
    cuentaFlujo = null,
    transferenciaId = null,
    cuentaOrigen = null,
    cuentaDestino = null,
    referenciaId = null,
    origen = 'Manual',
    fechaKey = null,
    fecha = null,
    hora = null,
  }) => {
    const cantidad = numero(monto);
    if (!cantidad || cantidad <= 0) return null;

    const cuenta = normalizarCuentaFlujo(cuentaFlujo || metodoPago);
    const movimiento = {
      id: crearId('FLU'),
      tipo,
      monto: cantidad,
      concepto: String(concepto || '').trim() || 'Movimiento',
      categoria,
      metodoPago,
      cuentaFlujo: cuenta,
      transferenciaId,
      cuentaOrigen,
      cuentaDestino,
      referenciaId,
      origen,
      fechaKey: fechaKey || fechaKeyActual(),
      fecha: fecha || fechaActual(),
      hora: hora || horaActual(),
    };

    setMovimientosFlujo((actuales) => [movimiento, ...actuales]);
    return movimiento;
  };

  const establecerSaldoInicialFlujo = ({ cuenta, monto }) => {
    const cuentaNormalizada = normalizarCuentaFlujo(cuenta);
    if (!cuentaNormalizada || !CUENTAS_FLUJO.includes(cuentaNormalizada)) {
      return { ok: false, mensaje: 'Selecciona una cuenta válida.' };
    }

    const cantidad = numero(monto);
    if (cantidad < 0) {
      return { ok: false, mensaje: 'El saldo inicial no puede ser negativo.' };
    }

    setSaldosInicialesFlujo((actual) => ({
      ...actual,
      [cuentaNormalizada]: redondear(cantidad),
    }));

    return { ok: true, cuenta: cuentaNormalizada, saldoInicial: redondear(cantidad) };
  };

  const saldoCuentaFlujo = (cuenta) => {
    const cuentaNormalizada = normalizarCuentaFlujo(cuenta);
    if (!cuentaNormalizada) return 0;

    const inicial = numero(saldosInicialesFlujo[cuentaNormalizada]);
    return redondear(
      movimientosFlujo.reduce((total, item) => {
        const cuentaMovimiento = normalizarCuentaFlujo(item.cuentaFlujo || item.metodoPago);
        if (cuentaMovimiento !== cuentaNormalizada) return total;
        const monto = numero(item.monto);
        return item.tipo === 'Entrada' ? total + monto : total - monto;
      }, inicial)
    );
  };

  const obtenerResumenFlujo = () => {
    const cuentas = {};
    CUENTAS_FLUJO.forEach((cuenta) => {
      cuentas[cuenta] = {
        cuenta,
        saldoInicial: redondear(numero(saldosInicialesFlujo[cuenta])),
        saldo: saldoCuentaFlujo(cuenta),
      };
    });

    const total = CUENTAS_FLUJO.reduce((suma, cuenta) => suma + numero(cuentas[cuenta].saldo), 0);
    return {
      cuentas,
      efectivo: cuentas.Efectivo.saldo,
      banco: cuentas.Banco.saldo,
      tarjeta: cuentas.Tarjeta.saldo,
      total: redondear(total),
    };
  };

  const saldoFlujo = (cuenta = null) => {
    if (cuenta) return saldoCuentaFlujo(cuenta);
    return obtenerResumenFlujo().total;
  };

  const registrarTransferenciaInterna = ({ desde, hacia, monto, nota = '' }) => {
    const origenCuenta = normalizarCuentaFlujo(desde);
    const destinoCuenta = normalizarCuentaFlujo(hacia);
    const cantidad = numero(monto);

    if (!origenCuenta || !destinoCuenta) {
      return { ok: false, mensaje: 'Selecciona la cuenta de origen y destino.' };
    }
    if (origenCuenta === destinoCuenta) {
      return { ok: false, mensaje: 'La cuenta de origen y destino deben ser diferentes.' };
    }
    if (!cantidad || cantidad <= 0) {
      return { ok: false, mensaje: 'El monto debe ser mayor a 0.' };
    }
    if (cantidad > saldoCuentaFlujo(origenCuenta) + 0.0001) {
      return { ok: false, mensaje: `No hay saldo suficiente en ${origenCuenta}.` };
    }

    const transferenciaId = crearId('TRF');
    const fechaKey = fechaKeyActual();
    const fecha = fechaActual();
    const hora = horaActual();
    const detalleNota = String(nota || '').trim();

    const salida = registrarMovimientoFlujo({
      tipo: 'Salida',
      monto: cantidad,
      concepto: `Transferencia a ${destinoCuenta}${detalleNota ? ` · ${detalleNota}` : ''}`,
      categoria: 'Transferencia interna',
      metodoPago: metodoPagoDesdeCuenta(origenCuenta),
      cuentaFlujo: origenCuenta,
      transferenciaId,
      cuentaOrigen: origenCuenta,
      cuentaDestino: destinoCuenta,
      referenciaId: transferenciaId,
      origen: 'Transferencia interna',
      fechaKey,
      fecha,
      hora,
    });

    const entrada = registrarMovimientoFlujo({
      tipo: 'Entrada',
      monto: cantidad,
      concepto: `Transferencia desde ${origenCuenta}${detalleNota ? ` · ${detalleNota}` : ''}`,
      categoria: 'Transferencia interna',
      metodoPago: metodoPagoDesdeCuenta(destinoCuenta),
      cuentaFlujo: destinoCuenta,
      transferenciaId,
      cuentaOrigen: origenCuenta,
      cuentaDestino: destinoCuenta,
      referenciaId: transferenciaId,
      origen: 'Transferencia interna',
      fechaKey,
      fecha,
      hora,
    });

    return {
      ok: true,
      transferencia: {
        id: transferenciaId,
        desde: origenCuenta,
        hacia: destinoCuenta,
        monto: redondear(cantidad),
        nota: detalleNota,
        fechaKey,
        fecha,
        hora,
      },
      salida,
      entrada,
    };
  };

  const cancelarTransferenciaInterna = (transferenciaId) => {
    const relacionados = movimientosFlujo.filter((item) => item.transferenciaId === transferenciaId);
    if (!relacionados.length) {
      return { ok: false, mensaje: 'No se encontró la transferencia.' };
    }

    const entrada = relacionados.find((item) => item.tipo === 'Entrada');
    if (entrada) {
      const cuentaDestino = normalizarCuentaFlujo(entrada.cuentaFlujo || entrada.metodoPago);
      const monto = numero(entrada.monto);
      if (saldoCuentaFlujo(cuentaDestino) + 0.0001 < monto) {
        return {
          ok: false,
          mensaje: `No se puede cancelar porque ${cuentaDestino} ya no tiene saldo suficiente para revertir la transferencia.`,
        };
      }
    }

    setMovimientosFlujo((actuales) =>
      actuales.filter((item) => item.transferenciaId !== transferenciaId)
    );
    return { ok: true };
  };

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

  const actualizarReferenciaInsumoEnProducto = (producto, insumoId, nombre, unidadBase) => ({
    ...producto,
    receta: (producto.receta || []).map((r) =>
      r.insumoId === insumoId ? { ...r, insumoNombre: nombre, unidadBase } : r
    ),
    presentaciones: (producto.presentaciones || []).map((presentacion) => ({
      ...presentacion,
      receta: (presentacion.receta || []).map((r) =>
        r.insumoId === insumoId ? { ...r, insumoNombre: nombre, unidadBase } : r
      ),
    })),
    seccionesPersonalizacion: (producto.seccionesPersonalizacion || []).map((seccion) => ({
      ...seccion,
      opciones: (seccion.opciones || []).map((opcion) =>
        opcion.insumoId === insumoId
          ? { ...opcion, insumoNombre: nombre, unidadBase }
          : opcion
      ),
    })),
  });

  const productoUsaInsumo = (producto, insumoId) => {
    if ((producto.receta || []).some((r) => r.insumoId === insumoId)) return true;

    if (
      (producto.presentaciones || []).some((presentacion) =>
        (presentacion.receta || []).some((r) => r.insumoId === insumoId)
      )
    ) {
      return true;
    }

    return (producto.seccionesPersonalizacion || []).some((seccion) =>
      (seccion.opciones || []).some(
        (opcion) =>
          opcion.insumoId === insumoId || opcion.reemplazaInsumoId === insumoId
      )
    );
  };

  const editarInsumo = (insumoId, cambios = {}) => {
    const actual = insumos.find((item) => item.id === insumoId);
    if (!actual) return { ok: false, mensaje: 'No se encontró el insumo.' };

    const nombre = cambios.nombre !== undefined ? String(cambios.nombre).trim() : actual.nombre;
    if (!nombre) return { ok: false, mensaje: 'El insumo debe tener nombre.' };

    const unidadBase = cambios.unidadBase ?? actual.unidadBase;

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
              unidadBase,
              stockMinimo:
                cambios.stockMinimo !== undefined ? numero(cambios.stockMinimo) : item.stockMinimo,
            }
          : item
      )
    );

    setMovimientos((lista) =>
      lista.map((mov) =>
        mov.insumoId === insumoId
          ? { ...mov, insumoNombre: nombre, unidadBase }
          : mov
      )
    );

    // V2.07: si cambia el nombre o la unidad, mantenemos sincronizadas
    // todas las recetas, presentaciones y personalizaciones que lo referencian.
    setProductos((lista) =>
      lista.map((producto) =>
        productoUsaInsumo(producto, insumoId)
          ? actualizarReferenciaInsumoEnProducto(producto, insumoId, nombre, unidadBase)
          : producto
      )
    );

    return { ok: true };
  };

  const eliminarInsumo = (insumoId) => {
    const insumo = insumos.find((item) => item.id === insumoId);
    if (!insumo) return { ok: false, mensaje: 'No se encontró el insumo.' };

    if (existenciaDe(insumo) > 0.000001) {
      return { ok: false, mensaje: 'No puedes eliminar un insumo que todavía tiene existencia.' };
    }

    const usadoEnProducto = productos.some((p) => productoUsaInsumo(p, insumoId));
    if (usadoEnProducto) {
      return {
        ok: false,
        mensaje:
          'Este insumo está usado en una receta, presentación o personalización. Primero quítalo de Productos / recetas.',
      };
    }

    const usadoEnVenta = ventas.some((v) =>
      (v.detalleCosto || []).some((d) => d.insumoId === insumoId) ||
      (v.partidas || []).some((p) =>
        (p.detalleCostoPartida || []).some((d) => d.insumoId === insumoId)
      )
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

      const inversionesLigadas = inversiones.filter((inv) => inv.referenciaId === movimientoId);

      for (const inv of inversionesLigadas) {
        const nombre = inv.perteneceA || inv.pagadoPor || 'Socio';
        const resumen = obtenerResumenInversionistas().find((item) => item.nombre === nombre);
        const aportadoSinEsta = numero(resumen?.aportado) - numero(inv.monto);
        if (numero(resumen?.recuperado) > aportadoSinEsta + 0.0001) {
          return {
            ok: false,
            mensaje: 'No se puede cancelar esta compra porque ya existen pagos de recuperación asociados al capital del socio.',
          };
        }
      }

      setInsumos((lista) =>
        lista.map((i) =>
          i.id === mov.insumoId
            ? { ...i, lotes: (i.lotes || []).filter((l) => l.id !== mov.loteId) }
            : i
        )
      );

      setMovimientos((lista) => lista.filter((item) => item.id !== movimientoId));

      if (inversionesLigadas.length) {
        const ids = new Set(inversionesLigadas.map((inv) => inv.id));
        setInversiones((lista) => lista.filter((inv) => !ids.has(inv.id)));
      }

      // Una compra eliminada no debe seguir afectando Caja/Flujo.
      setMovimientosFlujo((lista) =>
        lista.filter((flujo) =>
          !(flujo.referenciaId === movimientoId && flujo.origen === 'Compra inventario')
        )
      );

      return { ok: true, inversionesCanceladas: inversionesLigadas.length };
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


  // =====================================================
  // VENTAS V2 / CARRITO
  // =====================================================

  const obtenerPresentacionPartida = (producto, partida = {}) =>
    (producto?.presentaciones || []).find((p) => p.id === partida.presentacionId) || null;

  const obtenerTamanoPartida = (producto, partida = {}) =>
    (producto?.tamanos || []).find((t) => t.id === partida.tamanoId) || null;

  const obtenerSeccionProducto = (producto, seccionId) =>
    (producto?.seccionesPersonalizacion || []).find((s) => s.id === seccionId) || null;

  const obtenerOpcionProducto = (producto, seccionId, opcionId) => {
    const seccion = obtenerSeccionProducto(producto, seccionId);
    return (seccion?.opciones || []).find((o) => o.id === opcionId) || null;
  };

  const normalizarRecetaVenta = (receta = []) => {
    const mapa = new Map();
    for (const item of Array.isArray(receta) ? receta : []) {
      if (!item?.insumoId) continue;
      const cantidad = numero(item.cantidad);
      if (cantidad <= 0) continue;
      const anterior = mapa.get(item.insumoId);
      mapa.set(item.insumoId, {
        ...item,
        insumoId: item.insumoId,
        insumoNombre:
          item.insumoNombre || insumos.find((i) => i.id === item.insumoId)?.nombre || '',
        unidadBase:
          item.unidadBase || insumos.find((i) => i.id === item.insumoId)?.unidadBase || '',
        cantidad: numero(anterior?.cantidad) + cantidad,
      });
    }
    return [...mapa.values()];
  };

  const resolverValoresOpcionV2 = (producto, partida = {}, opcion = {}) => {
    let cantidad = numero(opcion.cantidad);
    let ajustePrecio = numero(opcion.ajustePrecio);

    if (partida?.presentacionId && Array.isArray(opcion.valoresPorPresentacion)) {
      const valor = opcion.valoresPorPresentacion.find((v) => v.presentacionId === partida.presentacionId);
      if (valor) {
        cantidad = numero(valor.cantidad);
        ajustePrecio = numero(valor.ajustePrecio);
      }
    }

    if (partida?.tamanoId && Array.isArray(opcion.valoresPorTamano)) {
      const valor = opcion.valoresPorTamano.find((v) => v.tamanoId === partida.tamanoId);
      if (valor) {
        cantidad = numero(valor.cantidad);
        ajustePrecio = numero(valor.ajustePrecio);
      }
    }

    return { cantidad, ajustePrecio };
  };

  const resolverRecetaPartidaV2 = (producto, partida = {}) => {
    if (!producto) return { receta: [], completa: false, estado: 'Sin receta' };

    const presentacion = obtenerPresentacionPartida(producto, partida);
    let recetaBase = [];
    let estado = normalizarEstadoReceta(producto);

    if (presentacion && Array.isArray(presentacion.receta) && presentacion.receta.length > 0) {
      recetaBase = presentacion.receta.map((x) => ({ ...x }));
      estado = presentacion.estadoReceta || 'En proceso';
    } else {
      recetaBase = Array.isArray(producto.receta) ? producto.receta.map((x) => ({ ...x })) : [];
    }

    let receta = normalizarRecetaVenta(recetaBase);

    const quitar = new Set(Array.isArray(partida.quitarInsumoIds) ? partida.quitarInsumoIds : []);
    receta = receta.filter((r) => !quitar.has(r.insumoId));

    const selecciones = Array.isArray(partida.selecciones) ? partida.selecciones : [];
    for (const grupo of selecciones) {
      const ids = Array.isArray(grupo.opcionIds)
        ? grupo.opcionIds
        : Array.isArray(grupo.opciones)
        ? grupo.opciones.map((o) => (typeof o === 'string' ? o : o?.id)).filter(Boolean)
        : [];

      for (const opcionId of ids) {
        const opcion = obtenerOpcionProducto(producto, grupo.seccionId, opcionId);
        if (!opcion || opcion.activa === false || opcion.accionInventario === 'Ninguno') continue;

        const valoresOpcion = resolverValoresOpcionV2(producto, partida, opcion);

        if (opcion.accionInventario === 'Sustituir' && opcion.reemplazaInsumoId) {
          receta = receta.filter((r) => r.insumoId !== opcion.reemplazaInsumoId);
        }

        if (opcion.insumoId && numero(valoresOpcion.cantidad) > 0) {
          receta.push({
            id: crearId('RECV2'),
            insumoId: opcion.insumoId,
            insumoNombre:
              opcion.insumoNombre || insumos.find((i) => i.id === opcion.insumoId)?.nombre || '',
            cantidad: numero(valoresOpcion.cantidad),
            unidadBase: insumos.find((i) => i.id === opcion.insumoId)?.unidadBase || '',
          });
        }
      }
    }

    receta = normalizarRecetaVenta(receta);
    const completa = estado === 'Completa' && receta.length > 0;
    return { receta, completa, estado, presentacion };
  };

  const precioPartidaV2 = (producto, partida = {}) => {
    if (!producto) return 0;
    const presentacion = obtenerPresentacionPartida(producto, partida);
    const tamano = obtenerTamanoPartida(producto, partida);

    let precio = numero(producto.precio);
    if (presentacion) precio = numero(presentacion.precio);
    if (tamano) precio = numero(tamano.precio);

    const selecciones = Array.isArray(partida.selecciones) ? partida.selecciones : [];
    for (const grupo of selecciones) {
      const ids = Array.isArray(grupo.opcionIds)
        ? grupo.opcionIds
        : Array.isArray(grupo.opciones)
        ? grupo.opciones.map((o) => (typeof o === 'string' ? o : o?.id)).filter(Boolean)
        : [];
      for (const opcionId of ids) {
        const opcion = obtenerOpcionProducto(producto, grupo.seccionId, opcionId);
        if (opcion) {
          const valoresOpcion = resolverValoresOpcionV2(producto, partida, opcion);
          precio += numero(valoresOpcion.ajustePrecio);
        }
      }

      if (tamano) {
        const regla = (tamano.reglasSecciones || []).find((r) => r.seccionId === grupo.seccionId);
        if (regla?.permiteExtras) {
          const extras = Math.max(0, ids.length - numero(regla.incluidas));
          precio += extras * numero(regla.precioExtra);
        }
      }
    }

    return Math.max(0, redondear(precio));
  };

  const validarPartidaConfiguradaV2 = (producto, partida = {}) => {
    if (!producto) return { ok: false, mensaje: 'Uno de los productos ya no existe.' };
    if (producto.activo === false) {
      return { ok: false, mensaje: `${producto.nombre} está inactivo.` };
    }

    if (producto.tipoProducto === 'Bebida configurable') {
      const preparaciones = (producto.preparaciones || []).filter((p) => p.activo !== false);
      if (preparaciones.length && !partida.preparacionId) {
        return { ok: false, mensaje: `Selecciona la preparación de ${producto.nombre}.` };
      }
      const presentaciones = (producto.presentaciones || []).filter((p) => p.activa !== false);
      if (presentaciones.length && !partida.presentacionId) {
        return { ok: false, mensaje: `Selecciona la presentación de ${producto.nombre}.` };
      }
    }

    if (producto.tipoProducto === 'Arma el tuyo') {
      const tamanos = (producto.tamanos || []).filter((t) => t.activo !== false);
      if (tamanos.length && !partida.tamanoId) {
        return { ok: false, mensaje: `Selecciona el tamaño de ${producto.nombre}.` };
      }
    }

    const tamano = obtenerTamanoPartida(producto, partida);
    const selecciones = Array.isArray(partida.selecciones) ? partida.selecciones : [];

    for (const seccion of (producto.seccionesPersonalizacion || []).filter((s) => s.activa !== false)) {
      const grupo = selecciones.find((g) => g.seccionId === seccion.id);
      const ids = Array.isArray(grupo?.opcionIds)
        ? grupo.opcionIds
        : Array.isArray(grupo?.opciones)
        ? grupo.opciones.map((o) => (typeof o === 'string' ? o : o?.id)).filter(Boolean)
        : [];

      const regla = tamano
        ? (tamano.reglasSecciones || []).find((r) => r.seccionId === seccion.id)
        : null;

      const minimo = seccion.obligatoria ? Math.max(1, numero(seccion.min)) : numero(seccion.min);
      if (ids.length < minimo) {
        return { ok: false, mensaje: `Falta seleccionar ${seccion.nombre} en ${producto.nombre}.` };
      }

      if (seccion.tipoSeleccion === 'Única' && ids.length > 1) {
        return { ok: false, mensaje: `Solo puedes elegir una opción en ${seccion.nombre}.` };
      }

      if (seccion.tipoSeleccion === 'Múltiple') {
        const maxSeccion = Math.max(1, numero(seccion.max));
        let maxPermitido = maxSeccion;
        if (regla && !regla.permiteExtras) {
          maxPermitido = Math.min(maxSeccion, numero(regla.incluidas));
        }
        if (ids.length > maxPermitido) {
          return { ok: false, mensaje: `Hay demasiadas selecciones en ${seccion.nombre}.` };
        }
      }
    }

    return { ok: true };
  };

  const registrarVentaCarrito = ({ partidas, metodoPago = 'Efectivo', nota = '' }) => {
    const listaPartidas = (Array.isArray(partidas) ? partidas : []).filter(
      (p) => p?.productoId && numero(p.cantidad || 1) > 0
    );
    if (!listaPartidas.length) {
      return { ok: false, mensaje: 'El carrito está vacío.' };
    }

    let listaTrabajo = insumos.map((i) => ({
      ...i,
      lotes: (i.lotes || []).map((l) => ({ ...l })),
    }));

    const ticketId = crearId('TICKET');
    const detalleCosto = [];
    const clasificacionProductos = [];
    const partidasGuardadas = [];
    let totalVenta = 0;
    let costoConocido = 0;
    let hayCostoPendiente = false;

    for (const partidaEntrada of listaPartidas) {
      const producto = productos.find((p) => p.id === partidaEntrada.productoId);
      const valida = validarPartidaConfiguradaV2(producto, partidaEntrada);
      if (!valida.ok) return valida;

      const unidades = numero(partidaEntrada.cantidad || 1);
      const precioUnitario = precioPartidaV2(producto, partidaEntrada);
      const subtotal = redondear(precioUnitario * unidades);
      totalVenta += subtotal;

      const recetaResuelta = resolverRecetaPartidaV2(producto, partidaEntrada);
      let costoPartidaConocido = 0;
      let costoPartida = null;
      let costoPendientePartida = !recetaResuelta.completa;
      let inventarioConsumido = false;
      const detallePartida = [];

      // AJUSTE 3 CASA SHAMY: RECETA PARCIAL
      // Aunque la receta esté "En proceso", los ingredientes ya capturados
      // sí salen físicamente del inventario y su costo conocido se reconoce.
      if ((recetaResuelta.receta || []).length > 0) {
        let todosLosCostosConocidos = true;

        for (const ingrediente of recetaResuelta.receta) {
          const requerido = numero(ingrediente.cantidad) * unidades;
          const plan = planificarFIFO(listaTrabajo, ingrediente.insumoId, requerido);
          if (!plan.ok) {
            return {
              ...plan,
              mensaje: `${producto.nombre}: ${plan.mensaje || 'Inventario insuficiente.'}`,
            };
          }

          costoPartidaConocido += numero(plan.costoConocido);
          if (plan.costoPendiente) todosLosCostosConocidos = false;
          detallePartida.push(...plan.detalle);
          listaTrabajo = aplicarConsumoFIFOEnLista(listaTrabajo, plan.detalle);
        }

        inventarioConsumido = detallePartida.length > 0;
        costoPendientePartida = !recetaResuelta.completa || !todosLosCostosConocidos;
        costoPartida = costoPendientePartida ? null : redondear(costoPartidaConocido);
        detalleCosto.push(...detallePartida);
      }

      if (costoPendientePartida) hayCostoPendiente = true;
      costoConocido += costoPartidaConocido;

      const presentacion = obtenerPresentacionPartida(producto, partidaEntrada);
      const tamano = obtenerTamanoPartida(producto, partidaEntrada);
      const preparacion = (producto.preparaciones || []).find((p) => p.id === partidaEntrada.preparacionId);

      const guardada = {
        id: partidaEntrada.id || crearId('PART'),
        productoId: producto.id,
        producto: producto.nombre,
        tipoProducto: producto.tipoProducto || 'Fijo',
        cantidad: unidades,
        precioUnitario,
        subtotal,
        preparacionId: partidaEntrada.preparacionId || null,
        preparacionNombre: preparacion?.nombre || partidaEntrada.preparacionNombre || '',
        presentacionId: partidaEntrada.presentacionId || null,
        presentacionNombre: presentacion?.nombre || partidaEntrada.presentacionNombre || '',
        tamanoId: partidaEntrada.tamanoId || null,
        tamanoNombre: tamano?.nombre || partidaEntrada.tamanoNombre || '',
        selecciones: Array.isArray(partidaEntrada.selecciones) ? partidaEntrada.selecciones : [],
        quitarInsumoIds: Array.isArray(partidaEntrada.quitarInsumoIds)
          ? partidaEntrada.quitarInsumoIds
          : [],
        nota: String(partidaEntrada.nota || '').trim(),
        recetaVenta: (recetaResuelta.receta || []).length ? recetaResuelta.receta : null,
        recetaCompletaAlVender: recetaResuelta.completa,
        estadoRecetaAlVender: recetaResuelta.estado,
        inventarioConsumido,
        detalleCostoPartida: detallePartida,
        costoConocido: redondear(costoPartidaConocido),
        costo: costoPartida,
        costoPendiente: costoPendientePartida,
      };
      partidasGuardadas.push(guardada);
      clasificacionProductos.push({ ...guardada });
    }

    totalVenta = redondear(totalVenta);
    costoConocido = redondear(costoConocido);
    const utilidadProvisional = redondear(totalVenta - costoConocido);
    const utilidadBruta = hayCostoPendiente ? null : utilidadProvisional;
    const margen = !hayCostoPendiente && totalVenta > 0
      ? (utilidadProvisional / totalVenta) * 100
      : null;

    const totalUnidades = partidasGuardadas.reduce((s, p) => s + numero(p.cantidad), 0);
    const venta = {
      id: ticketId,
      tipoVenta: 'Carrito',
      producto: `Ticket · ${totalUnidades} artículo${totalUnidades === 1 ? '' : 's'}`,
      concepto: `Ticket · ${partidasGuardadas.length} partida${partidasGuardadas.length === 1 ? '' : 's'}`,
      cantidad: totalUnidades,
      monto: totalVenta,
      metodoPago,
      nota: String(nota || '').trim(),
      partidas: partidasGuardadas,
      costoTotal: hayCostoPendiente ? null : costoConocido,
      costoConocido,
      utilidadBruta,
      utilidadProvisional,
      margen,
      pendienteClasificar: false,
      pendienteCostear: hayCostoPendiente,
      estadoClasificacion: hayCostoPendiente ? 'Clasificada - costo pendiente' : 'Clasificada',
      detalleCosto,
      clasificacionProductos,
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
      origen: 'Venta carrito',
    }));
    if (movimientosVenta.length) setMovimientos((lista) => [...movimientosVenta, ...lista]);

    registrarMovimientoFlujo({
      tipo: 'Entrada',
      monto: totalVenta,
      concepto: venta.concepto,
      categoria: 'Venta',
      metodoPago,
      referenciaId: venta.id,
      origen: 'Venta carrito',
      fechaKey: venta.fechaKey,
      fecha: venta.fecha,
      hora: venta.hora,
    });

    return { ok: true, venta };
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
      ? venta.clasificacionProductos.map((p) => ({ ...p }))
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

    let listaTrabajo = insumos.map((i) => ({
      ...i,
      lotes: (i.lotes || []).map((l) => ({ ...l })),
    }));
    const nuevasPartidas = [];
    const nuevoDetalle = [];
    let costoConocido = 0;
    let pendientes = 0;
    let costeadosAhora = 0;

    const costoActualDeDetalle = (detalle) => {
      const ins = insumos.find((i) => i.id === detalle.insumoId);
      const lote = (ins?.lotes || []).find((l) => l.id === detalle.loteId);
      if (!lote || lote.costoPendiente || lote.costoUnidadBase === null || lote.costoUnidadBase === undefined) {
        return { conocido: false, costoUnidad: null, costo: null };
      }
      const costoUnidad = numero(lote.costoUnidadBase);
      return {
        conocido: true,
        costoUnidad,
        costo: redondear(numero(detalle.cantidad) * costoUnidad),
      };
    };

    for (const partida of partidasActuales) {
      if (partida.costo !== null && partida.costo !== undefined) {
        const costoPrevio = numero(partida.costo);
        costoConocido += costoPrevio;
        nuevasPartidas.push({ ...partida, costoConocido: costoPrevio, costoPendiente: false });
        continue;
      }

      const producto = productos.find((p) => p.id === partida.productoId);
      const unidades = numero(partida.cantidad || 1);
      if (!producto) {
        pendientes += 1;
        nuevasPartidas.push({ ...partida, costo: null, costoPendiente: true });
        continue;
      }

      const recetaInfo = resolverRecetaPartidaV2(producto, partida);
      const recetaActual = Array.isArray(recetaInfo.receta) ? recetaInfo.receta : [];
      const recetaYaConsumida = Array.isArray(partida.recetaVenta) ? partida.recetaVenta : [];

      // Recalcula el costo de todo lo que ya salió físicamente del inventario.
      let costoPartidaConocido = 0;
      let todosLosCostosConocidos = true;
      let detalleActualizado = [];

      if (Array.isArray(partida.detalleCostoPartida) && partida.detalleCostoPartida.length) {
        detalleActualizado = partida.detalleCostoPartida.map((det) => {
          const actual = costoActualDeDetalle(det);
          if (!actual.conocido) todosLosCostosConocidos = false;
          else costoPartidaConocido += numero(actual.costo);
          return { ...det, costoUnidad: actual.costoUnidad, costo: actual.costo };
        });
      }

      // Si después de la venta completamos más ingredientes de la receta,
      // consume únicamente la diferencia positiva; nunca vuelve a descontar
      // lo que la venta ya consumió.
      const cantidadesConsumidas = {};
      for (const ing of recetaYaConsumida) {
        cantidadesConsumidas[ing.insumoId] =
          numero(cantidadesConsumidas[ing.insumoId]) + numero(ing.cantidad) * unidades;
      }

      const cantidadesActuales = {};
      for (const ing of recetaActual) {
        cantidadesActuales[ing.insumoId] =
          numero(cantidadesActuales[ing.insumoId]) + numero(ing.cantidad) * unidades;
      }

      let trabajoProducto = listaTrabajo.map((i) => ({
        ...i,
        lotes: (i.lotes || []).map((l) => ({ ...l })),
      }));
      const detalleNuevoPartida = [];
      let inventarioDisponible = true;

      for (const [insumoId, requeridoActual] of Object.entries(cantidadesActuales)) {
        const yaConsumido = numero(cantidadesConsumidas[insumoId]);
        const faltante = Math.max(0, numero(requeridoActual) - yaConsumido);
        if (faltante <= 0.000001) continue;

        const plan = planificarFIFO(trabajoProducto, insumoId, faltante);
        if (!plan.ok) {
          inventarioDisponible = false;
          break;
        }

        costoPartidaConocido += numero(plan.costoConocido);
        if (plan.costoPendiente) todosLosCostosConocidos = false;
        detalleNuevoPartida.push(...plan.detalle);
        trabajoProducto = aplicarConsumoFIFOEnLista(trabajoProducto, plan.detalle);
      }

      if (!inventarioDisponible) {
        costoConocido += costoPartidaConocido;
        pendientes += 1;
        nuevasPartidas.push({
          ...partida,
          detalleCostoPartida: detalleActualizado,
          costoConocido: redondear(costoPartidaConocido),
          costo: null,
          costoPendiente: true,
        });
        continue;
      }

      listaTrabajo = trabajoProducto;
      if (detalleNuevoPartida.length) {
        detalleActualizado = [...detalleActualizado, ...detalleNuevoPartida];
        nuevoDetalle.push(...detalleNuevoPartida);
      }

      costoConocido += costoPartidaConocido;

      const recetaCompletaAhora = recetaInfo.completa === true;
      const costoCompletoAhora = recetaCompletaAhora && todosLosCostosConocidos;

      if (!costoCompletoAhora) {
        pendientes += 1;
        nuevasPartidas.push({
          ...partida,
          producto: producto.nombre,
          recetaVenta: recetaActual.length ? recetaActual : recetaYaConsumida,
          recetaCompletaAlVender: recetaCompletaAhora,
          inventarioConsumido: detalleActualizado.length > 0,
          detalleCostoPartida: detalleActualizado,
          costoConocido: redondear(costoPartidaConocido),
          costo: null,
          costoPendiente: true,
        });
      } else {
        costeadosAhora += 1;
        nuevasPartidas.push({
          ...partida,
          producto: producto.nombre,
          recetaVenta: recetaActual,
          recetaCompletaAlVender: true,
          inventarioConsumido: detalleActualizado.length > 0,
          detalleCostoPartida: detalleActualizado,
          costoConocido: redondear(costoPartidaConocido),
          costo: redondear(costoPartidaConocido),
          costoPendiente: false,
        });
      }
    }
    const detallePrevioResuelto = (venta.detalleCosto || []).map((d) => {
      const actual = costoActualDeDetalle(d);
      return actual.conocido ? { ...d, costoUnidad: actual.costoUnidad, costo: actual.costo } : d;
    });
    const detalleAcumulado = [...detallePrevioResuelto, ...nuevoDetalle];
    const totalmenteCosteada = pendientes === 0;
    const utilidadProvisional = numero(venta.monto) - costoConocido;
    const utilidadBruta = totalmenteCosteada ? utilidadProvisional : null;
    const margen = totalmenteCosteada && numero(venta.monto) > 0
      ? (utilidadProvisional / numero(venta.monto)) * 100
      : null;

    const partidasVentaActualizadas = Array.isArray(venta.partidas)
      ? venta.partidas.map((p) => {
          const n = nuevasPartidas.find((x) => x.id && p.id && x.id === p.id);
          if (n) return { ...p, ...n };
          const porProducto = nuevasPartidas.find(
            (x) => !x.id && x.productoId === p.productoId && numero(x.cantidad) === numero(p.cantidad)
          );
          return porProducto ? { ...p, ...porProducto } : p;
        })
      : venta.partidas;

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
              partidas: partidasVentaActualizadas,
            }
          : item
      )
    );

    // Actualiza costos de movimientos ya consumidos y agrega solo los nuevos.
    setMovimientos((lista) => {
      const actualizados = lista.map((mov) => {
        if (mov.ventaId !== ventaId) return mov;
        const det = detalleAcumulado.find(
          (d) => d.insumoId === mov.insumoId && d.loteId === mov.loteId
        );
        return det ? { ...mov, costo: det.costo } : mov;
      });
      const movsNuevos = nuevoDetalle.map((detalle) => ({
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
      return movsNuevos.length ? [...movsNuevos, ...actualizados] : actualizados;
    });

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
  // RESPALDO / RESTAURACIÓN DE DATOS
  // =====================================================

  const crearRespaldoDatos = () => {
    const respaldo = {
      app: 'Casa Shamy',
      versionRespaldo: 2,
      exportadoEn: new Date().toISOString(),
      datos: {
        insumos,
        movimientos,
        productos,
        ventas,
        gastos,
        inversiones,
        pagosInversion,
        movimientosFlujo,
        saldosInicialesFlujo,
        comprasLibres,
        creditosProveedores,
        pagosCreditos,
      },
    };

    return JSON.stringify(respaldo, null, 2);
  };

  const importarRespaldoDatos = async (textoRespaldo) => {
    try {
      const parsed =
        typeof textoRespaldo === 'string'
          ? JSON.parse(textoRespaldo)
          : textoRespaldo;

      const origen = parsed?.datos || parsed;
      if (!origen || typeof origen !== 'object') {
        return { ok: false, mensaje: 'El respaldo no tiene un formato válido.' };
      }

      const clavesEsperadas = [
        'insumos',
        'productos',
        'ventas',
        'gastos',
        'movimientosFlujo',
      ];
      const tieneContenidoReconocible = clavesEsperadas.some((clave) =>
        Array.isArray(origen[clave])
      );
      if (!tieneContenidoReconocible) {
        return { ok: false, mensaje: 'No se reconocen datos de Casa Shamy en este respaldo.' };
      }

      const saldos = origen.saldosInicialesFlujo || {};
      const datosNormalizados = {
        insumos: (Array.isArray(origen.insumos) ? origen.insumos : []).map(normalizarInsumo),
        movimientos: Array.isArray(origen.movimientos) ? origen.movimientos : [],
        productos: (Array.isArray(origen.productos) ? origen.productos : []).map(normalizarProducto),
        ventas: Array.isArray(origen.ventas) ? origen.ventas : [],
        gastos: Array.isArray(origen.gastos) ? origen.gastos : [],
        inversiones: Array.isArray(origen.inversiones) ? origen.inversiones : [],
        pagosInversion: Array.isArray(origen.pagosInversion) ? origen.pagosInversion : [],
        movimientosFlujo: Array.isArray(origen.movimientosFlujo) ? origen.movimientosFlujo : [],
        saldosInicialesFlujo: {
          Efectivo: numero(saldos.Efectivo),
          Banco: numero(saldos.Banco),
          Tarjeta: numero(saldos.Tarjeta),
        },
        comprasLibres: Array.isArray(origen.comprasLibres) ? origen.comprasLibres : [],
        creditosProveedores: Array.isArray(origen.creditosProveedores) ? origen.creditosProveedores : [],
        pagosCreditos: Array.isArray(origen.pagosCreditos) ? origen.pagosCreditos : [],
      };

      setDatosCargados(false);
      await AsyncStorage.setItem(CLAVE_DATOS, JSON.stringify(datosNormalizados));

      setInsumos(datosNormalizados.insumos);
      setMovimientos(datosNormalizados.movimientos);
      setProductos(datosNormalizados.productos);
      setVentas(datosNormalizados.ventas);
      setGastos(datosNormalizados.gastos);
      setInversiones(datosNormalizados.inversiones);
      setPagosInversion(datosNormalizados.pagosInversion);
      setMovimientosFlujo(datosNormalizados.movimientosFlujo);
      setSaldosInicialesFlujo(datosNormalizados.saldosInicialesFlujo);
      setComprasLibres(datosNormalizados.comprasLibres);
      setCreditosProveedores(datosNormalizados.creditosProveedores);
      setPagosCreditos(datosNormalizados.pagosCreditos);
      setDatosCargados(true);

      return {
        ok: true,
        resumen: {
          insumos: datosNormalizados.insumos.length,
          productos: datosNormalizados.productos.length,
          ventas: datosNormalizados.ventas.length,
          gastos: datosNormalizados.gastos.length,
        },
      };
    } catch (error) {
      setDatosCargados(true);
      return {
        ok: false,
        mensaje: 'No se pudo leer el respaldo. Verifica que hayas pegado el contenido completo.',
      };
    }
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
    saldosInicialesFlujo,
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
    saldoCuentaFlujo,
    obtenerResumenFlujo,
    establecerSaldoInicialFlujo,
    registrarTransferenciaInterna,
    cancelarTransferenciaInterna,
    normalizarCuentaFlujo,

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
    registrarVentaCarrito,
    resolverRecetaPartidaV2,
    resolverValoresOpcionV2,
    precioPartidaV2,
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

    crearRespaldoDatos,
    importarRespaldoDatos,
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
