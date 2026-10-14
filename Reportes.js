import React, { useMemo, useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Pressable,
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
  aviso: '#9A6B22',
};

const dinero = (v) =>
  `$${Number(v || 0).toLocaleString('es-MX', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const numero = (v) => {
  const n = Number(v || 0);
  return Number.isFinite(n) ? n : 0;
};

const fechaKey = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dia}`;
};

function Boton({ titulo, onPress, activo = false }) {
  return (
    <Pressable onPress={onPress} style={[styles.boton, activo && styles.botonActivo]}>
      <Text style={[styles.botonTexto, activo && styles.botonTextoActivo]}>{titulo}</Text>
    </Pressable>
  );
}

function Metrica({ titulo, valor, detalle }) {
  return (
    <View style={styles.metrica}>
      <Text style={styles.metricaTitulo}>{titulo}</Text>
      <Text style={styles.metricaValor}>{valor}</Text>
      {!!detalle && <Text style={styles.metricaDetalle}>{detalle}</Text>}
    </View>
  );
}

function Barra({ nombre, valor, maximo, detalle }) {
  const pct = maximo > 0 ? Math.max(4, Math.min(100, (valor / maximo) * 100)) : 0;
  return (
    <View style={styles.barraBloque}>
      <View style={styles.barraFila}>
        <Text style={styles.barraNombre}>{nombre}</Text>
        <Text style={styles.barraDato}>{detalle}</Text>
      </View>
      <View style={styles.barraFondo}>
        <View style={[styles.barraRelleno, { width: `${pct}%` }]} />
      </View>
    </View>
  );
}

export default function Reportes({ onVolver }) {
  const {
    ventas,
    gastos,
    movimientos,
    productos,
    comprasPendientes,
    gastosPendientes,
    ventasPendientes,
    valorInventario,
    obtenerResumenFlujo,
  } = useNegocio();

  const [periodo, setPeriodo] = useState('Hoy');

  const rango = useMemo(() => {
    const fin = new Date();
    fin.setHours(23, 59, 59, 999);
    const inicio = new Date(fin);
    inicio.setHours(0, 0, 0, 0);
    if (periodo === '7 días') inicio.setDate(inicio.getDate() - 6);
    if (periodo === '30 días') inicio.setDate(inicio.getDate() - 29);
    if (periodo === 'Todo') return { inicio: null, fin: null };
    return { inicio: fechaKey(inicio), fin: fechaKey(fin) };
  }, [periodo]);

  const dentro = (key) => {
    if (periodo === 'Todo') return true;
    if (!key) return false;
    return key >= rango.inicio && key <= rango.fin;
  };

  const datos = useMemo(() => {
    const vs = ventas.filter((v) => dentro(v.fechaKey));
    const gs = gastos.filter((g) => dentro(g.fechaKey));
    const ms = movimientos.filter((m) => dentro(m.fechaKey));

    const totalVentas = vs.reduce((s, v) => s + numero(v.monto), 0);
    const costoConocido = vs.reduce((s, v) => s + numero(v.costoConocido), 0);
    const utilidadVentasProvisional = vs.reduce((s, v) => {
      if (v.utilidadProvisional !== null && v.utilidadProvisional !== undefined) {
        return s + numero(v.utilidadProvisional);
      }
      return s + numero(v.monto) - numero(v.costoConocido);
    }, 0);
    const totalGastos = gs.reduce((s, g) => s + numero(g.monto), 0);
    const mermas = ms.filter((m) => m.tipo === 'Merma');
    const totalMerma = mermas.reduce((s, m) => s + numero(m.costo), 0);
    const utilidadProvisional = utilidadVentasProvisional - totalGastos - totalMerma;
    const pendientes = vs.filter((v) => v.pendienteCostear || v.costoTotal === null);
    const montoPendiente = pendientes.reduce((s, v) => s + numero(v.monto), 0);
    const ticketPromedio = vs.length ? totalVentas / vs.length : 0;

    const productosMap = {};
    vs.forEach((venta) => {
      const partidas = Array.isArray(venta.partidas) && venta.partidas.length
        ? venta.partidas
        : Array.isArray(venta.clasificacionProductos) && venta.clasificacionProductos.length
        ? venta.clasificacionProductos
        : venta.productoId
        ? [{ productoId: venta.productoId, producto: venta.producto, cantidad: venta.cantidad || 1, subtotal: venta.monto }]
        : [];

      partidas.forEach((p) => {
        const id = p.productoId || p.producto || 'Producto';
        if (!productosMap[id]) {
          productosMap[id] = { nombre: p.producto || productos.find((x) => x.id === p.productoId)?.nombre || 'Producto', cantidad: 0, monto: 0 };
        }
        productosMap[id].cantidad += numero(p.cantidad || 1);
        productosMap[id].monto += numero(p.subtotal ?? (numero(p.precioCatalogo) * numero(p.cantidad || 1)));
      });
    });

    const ranking = Object.values(productosMap)
      .sort((a, b) => b.cantidad - a.cantidad || b.monto - a.monto)
      .slice(0, 10);

    const horas = {};
    vs.forEach((v) => {
      const h = String(v.hora || '').slice(0, 2);
      if (!h) return;
      if (!horas[h]) horas[h] = { hora: h, tickets: 0, monto: 0 };
      horas[h].tickets += 1;
      horas[h].monto += numero(v.monto);
    });
    const horasRanking = Object.values(horas).sort((a, b) => b.monto - a.monto || b.tickets - a.tickets);

    const metodos = {};
    vs.forEach((v) => {
      const m = v.metodoPago || 'Sin método';
      metodos[m] = numero(metodos[m]) + numero(v.monto);
    });

    return {
      vs,
      gs,
      totalVentas,
      costoConocido,
      totalGastos,
      totalMerma,
      utilidadProvisional,
      pendientes,
      montoPendiente,
      ticketPromedio,
      ranking,
      horasRanking,
      metodos,
    };
  }, [ventas, gastos, movimientos, productos, periodo, rango.inicio, rango.fin]);

  const flujo = obtenerResumenFlujo();
  const maxProducto = datos.ranking[0]?.cantidad || 0;
  const maxHora = datos.horasRanking[0]?.monto || 0;

  return (
    <SafeAreaView style={styles.pantalla}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.titulo}>Reportes</Text>
          <Text style={styles.subtitulo}>Ventas, utilidad provisional y comportamiento del negocio</Text>
        </View>
        {!!onVolver && <Pressable onPress={onVolver} style={styles.volver}><Text style={styles.volverTxt}>Volver</Text></Pressable>}
      </View>

      <ScrollView contentContainerStyle={styles.contenido}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.periodos}>
          {['Hoy', '7 días', '30 días', 'Todo'].map((p) => (
            <Boton key={p} titulo={p} activo={periodo === p} onPress={() => setPeriodo(p)} />
          ))}
        </ScrollView>

        <Text style={styles.seccion}>Resumen</Text>
        <View style={styles.grid}>
          <Metrica titulo="Ventas" valor={dinero(datos.totalVentas)} detalle={`${datos.vs.length} ticket(s)`} />
          <Metrica titulo="Utilidad provisional" valor={dinero(datos.utilidadProvisional)} detalle="Ventas - costos conocidos - gastos - merma" />
          <Metrica titulo="Ticket promedio" valor={dinero(datos.ticketPromedio)} detalle="Promedio por ticket" />
          <Metrica titulo="Gastos" valor={dinero(datos.totalGastos)} detalle={`${datos.gs.length} registro(s)`} />
          <Metrica titulo="Costo conocido vendido" valor={dinero(datos.costoConocido)} detalle="Solo costos ya resueltos" />
          <Metrica titulo="Merma" valor={dinero(datos.totalMerma)} detalle="Costo de merma registrada" />
        </View>

        {datos.pendientes.length > 0 && (
          <View style={styles.aviso}>
            <Text style={styles.avisoTitulo}>La utilidad todavía es provisional</Text>
            <Text style={styles.avisoTexto}>
              {datos.pendientes.length} ticket(s), por {dinero(datos.montoPendiente)} en ventas, todavía tienen al menos un costo pendiente. No se está inventando un costo de $0.
            </Text>
          </View>
        )}

        <Text style={styles.seccion}>Productos más vendidos</Text>
        <View style={styles.tarjeta}>
          {datos.ranking.length === 0 ? (
            <Text style={styles.vacio}>Todavía no hay productos clasificados en este periodo.</Text>
          ) : datos.ranking.map((p, i) => (
            <Barra key={`${p.nombre}_${i}`} nombre={`${i + 1}. ${p.nombre}`} valor={p.cantidad} maximo={maxProducto} detalle={`${p.cantidad} ud. · ${dinero(p.monto)}`} />
          ))}
        </View>

        <Text style={styles.seccion}>Horario de venta</Text>
        <View style={styles.tarjeta}>
          {datos.horasRanking.length === 0 ? (
            <Text style={styles.vacio}>Aún no hay suficientes datos de horario.</Text>
          ) : datos.horasRanking.slice(0, 8).map((h) => (
            <Barra key={h.hora} nombre={`${h.hora}:00`} valor={h.monto} maximo={maxHora} detalle={`${dinero(h.monto)} · ${h.tickets} ticket(s)`} />
          ))}
        </View>

        <Text style={styles.seccion}>Ventas por método de pago</Text>
        <View style={styles.tarjeta}>
          {Object.keys(datos.metodos).length === 0 ? <Text style={styles.vacio}>Sin ventas en este periodo.</Text> : Object.entries(datos.metodos).map(([m, total]) => (
            <View key={m} style={styles.fila}><Text style={styles.filaNombre}>{m}</Text><Text style={styles.filaValor}>{dinero(total)}</Text></View>
          ))}
        </View>

        <Text style={styles.seccion}>Flujo actual</Text>
        <View style={styles.grid}>
          <Metrica titulo="Efectivo" valor={dinero(flujo.efectivo)} />
          <Metrica titulo="Banco" valor={dinero(flujo.banco)} />
          <Metrica titulo="Tarjeta" valor={dinero(flujo.tarjeta)} />
          <Metrica titulo="Total" valor={dinero(flujo.total)} />
        </View>

        <Text style={styles.seccion}>Pendientes operativos</Text>
        <View style={styles.tarjeta}>
          <View style={styles.fila}><Text style={styles.filaNombre}>Ventas por costear/clasificar</Text><Text style={styles.filaValor}>{ventasPendientes.length}</Text></View>
          <View style={styles.fila}><Text style={styles.filaNombre}>Gastos por asignar</Text><Text style={styles.filaValor}>{gastosPendientes.length}</Text></View>
          <View style={styles.fila}><Text style={styles.filaNombre}>Compras por asignar</Text><Text style={styles.filaValor}>{comprasPendientes.length}</Text></View>
          <View style={styles.fila}><Text style={styles.filaNombre}>Inventario con costo conocido</Text><Text style={styles.filaValor}>{dinero(valorInventario)}</Text></View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: C.fondo },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 18, paddingTop: 14, paddingBottom: 13, backgroundColor: C.verde },
  titulo: { color: '#FFF', fontSize: 24, fontWeight: '900' },
  subtitulo: { color: '#E7EFEA', fontSize: 12, marginTop: 3 },
  volver: { backgroundColor: '#FFF', paddingHorizontal: 12, paddingVertical: 9, borderRadius: 11 },
  volverTxt: { color: C.verde, fontWeight: '800' },
  contenido: { padding: 14, paddingBottom: 70 },
  periodos: { gap: 7, paddingBottom: 8 },
  boton: { paddingHorizontal: 14, paddingVertical: 9, backgroundColor: '#FFF', borderRadius: 14, borderWidth: 1, borderColor: C.linea },
  botonActivo: { backgroundColor: C.verde, borderColor: C.verde },
  botonTexto: { color: C.texto, fontWeight: '800', fontSize: 12 },
  botonTextoActivo: { color: '#FFF' },
  seccion: { fontSize: 16, fontWeight: '900', color: C.texto, marginTop: 14, marginBottom: 9 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  metrica: { width: '48%', minHeight: 104, backgroundColor: '#FFF', borderRadius: 15, padding: 12, borderWidth: 1, borderColor: C.linea },
  metricaTitulo: { color: C.secundario, fontSize: 11, fontWeight: '800' },
  metricaValor: { color: C.verde, fontSize: 19, fontWeight: '900', marginTop: 7 },
  metricaDetalle: { color: C.secundario, fontSize: 10, lineHeight: 14, marginTop: 5 },
  aviso: { backgroundColor: '#F6EDD8', borderRadius: 14, padding: 13, marginTop: 12, borderWidth: 1, borderColor: '#EAD7A8' },
  avisoTitulo: { color: C.aviso, fontSize: 13, fontWeight: '900' },
  avisoTexto: { color: '#6B562C', fontSize: 11, lineHeight: 17, marginTop: 4 },
  tarjeta: { backgroundColor: '#FFF', borderRadius: 15, padding: 13, borderWidth: 1, borderColor: C.linea },
  vacio: { color: C.secundario, fontSize: 12, paddingVertical: 10 },
  barraBloque: { marginBottom: 13 },
  barraFila: { flexDirection: 'row', gap: 10, alignItems: 'center', marginBottom: 5 },
  barraNombre: { flex: 1, color: C.texto, fontWeight: '800', fontSize: 12 },
  barraDato: { color: C.secundario, fontSize: 10, fontWeight: '700' },
  barraFondo: { height: 8, borderRadius: 4, backgroundColor: C.crema, overflow: 'hidden' },
  barraRelleno: { height: 8, borderRadius: 4, backgroundColor: C.terracota },
  fila: { flexDirection: 'row', gap: 10, alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#EEE7DF' },
  filaNombre: { flex: 1, color: C.texto, fontSize: 12, fontWeight: '700' },
  filaValor: { color: C.verde, fontSize: 12, fontWeight: '900' },
});
