import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { supabase } from './lib/supabase.js';
import { useNegocio } from './DatosNegocio.js';

const NOMBRE_NEGOCIO = 'Casa Shamy';
const NOMBRE_SUCURSAL = 'San Quintín';

const estadoVacio = () => ({
  insumos: [],
  movimientos: [],
  productos: [],
  ventas: [],
  gastos: [],
  inversiones: [],
  pagosInversion: [],
  movimientosFlujo: [],
  saldosInicialesFlujo: { Efectivo: 0, Banco: 0, Tarjeta: 0 },
  comprasLibres: [],
  creditosProveedores: [],
  pagosCreditos: [],
});

const tieneDatos = (estado) => {
  if (!estado || typeof estado !== 'object') return false;

  const listas = [
    'insumos',
    'movimientos',
    'productos',
    'ventas',
    'gastos',
    'inversiones',
    'pagosInversion',
    'movimientosFlujo',
    'comprasLibres',
    'creditosProveedores',
    'pagosCreditos',
  ];

  if (listas.some((clave) => Array.isArray(estado[clave]) && estado[clave].length > 0)) {
    return true;
  }

  const saldos = estado.saldosInicialesFlujo || {};
  return ['Efectivo', 'Banco', 'Tarjeta'].some(
    (cuenta) => Number(saldos[cuenta] || 0) !== 0
  );
};

const estadoDesdeRespaldo = (crearRespaldoDatos) => {
  const respaldo = JSON.parse(crearRespaldoDatos());
  return respaldo?.datos || estadoVacio();
};

const preguntarDatosLocales = () =>
  new Promise((resolve) => {
    Alert.alert(
      'Encontré datos en este dispositivo',
      '¿Quieres conservarlos y subirlos a Supabase o empezar Casa Shamy limpia?',
      [
        {
          text: 'Empezar limpio',
          style: 'destructive',
          onPress: () => resolve('limpio'),
        },
        {
          text: 'Conservar estos datos',
          onPress: () => resolve('conservar'),
        },
      ],
      { cancelable: false }
    );
  });

export default function SupabaseSync({ session, children }) {
  const negocio = useNegocio();

  const {
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
    crearRespaldoDatos,
    importarRespaldoDatos,
  } = negocio;

  const [listo, setListo] = useState(false);
  const [errorTexto, setErrorTexto] = useState('');
  const [reintento, setReintento] = useState(0);
  const [branchId, setBranchId] = useState(null);
  const [estadoSync, setEstadoSync] = useState('Sincronizado');
  const [saliendo, setSaliendo] = useState(false);

  const ultimoSubidoRef = useRef('');
  const inicioLanzadoRef = useRef(false);

  useEffect(() => {
    if (!datosCargados || !session?.user?.id || inicioLanzadoRef.current) return;

    inicioLanzadoRef.current = true;

    const preparar = async () => {
      try {
        setErrorTexto('');
        setListo(false);

        const userId = session.user.id;

        let { data: negocioExistente, error: errorNegocio } = await supabase
          .from('businesses')
          .select('id, name, created_by')
          .eq('name', NOMBRE_NEGOCIO)
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle();

        if (errorNegocio) throw errorNegocio;

        if (!negocioExistente) {
          const { data, error } = await supabase
            .from('businesses')
            .insert({ name: NOMBRE_NEGOCIO, created_by: userId })
            .select('id, name, created_by')
            .single();

          if (error) throw error;
          negocioExistente = data;
        }

        let { data: sucursal, error: errorSucursal } = await supabase
          .from('branches')
          .select('id, business_id, name')
          .eq('business_id', negocioExistente.id)
          .eq('name', NOMBRE_SUCURSAL)
          .limit(1)
          .maybeSingle();

        if (errorSucursal) throw errorSucursal;

        if (!sucursal) {
          const { data, error } = await supabase
            .from('branches')
            .insert({
              business_id: negocioExistente.id,
              name: NOMBRE_SUCURSAL,
              active: true,
            })
            .select('id, business_id, name')
            .single();

          if (error) throw error;
          sucursal = data;
        }

        setBranchId(sucursal.id);

        const estadoLocal = estadoDesdeRespaldo(crearRespaldoDatos);

        const { data: remoto, error: errorRemoto } = await supabase
          .from('branch_state')
          .select('branch_id, state, revision, updated_at')
          .eq('branch_id', sucursal.id)
          .maybeSingle();

        if (errorRemoto) throw errorRemoto;

        if (!remoto) {
          let estadoInicial = estadoLocal;

          if (tieneDatos(estadoLocal)) {
            const decision = await preguntarDatosLocales();
            if (decision === 'limpio') {
              estadoInicial = estadoVacio();
              const resultado = await importarRespaldoDatos(estadoInicial);
              if (!resultado?.ok) throw new Error(resultado?.mensaje || 'No se pudo limpiar la información local.');
            }
          }

          const { error } = await supabase
            .from('branch_state')
            .insert({
              branch_id: sucursal.id,
              state: estadoInicial,
              updated_by: userId,
            });

          if (error) throw error;
          ultimoSubidoRef.current = JSON.stringify(estadoInicial);
        } else if (tieneDatos(remoto.state)) {
          const resultado = await importarRespaldoDatos(remoto.state);

          if (!resultado?.ok) {
            throw new Error(
              resultado?.mensaje || 'No se pudieron cargar los datos guardados en Supabase.'
            );
          }

          ultimoSubidoRef.current = JSON.stringify(remoto.state || estadoVacio());
        } else if (tieneDatos(estadoLocal)) {
          const decision = await preguntarDatosLocales();
          const estadoElegido = decision === 'conservar' ? estadoLocal : estadoVacio();

          if (decision === 'limpio') {
            const resultado = await importarRespaldoDatos(estadoElegido);
            if (!resultado?.ok) throw new Error(resultado?.mensaje || 'No se pudo limpiar la información local.');
          }

          const { error } = await supabase
            .from('branch_state')
            .update({ state: estadoElegido, updated_by: userId })
            .eq('branch_id', sucursal.id);

          if (error) throw error;
          ultimoSubidoRef.current = JSON.stringify(estadoElegido);
        } else {
          const vacio = estadoVacio();
          const { error } = await supabase
            .from('branch_state')
            .update({ state: vacio, updated_by: userId })
            .eq('branch_id', sucursal.id);

          if (error) throw error;
          ultimoSubidoRef.current = JSON.stringify(vacio);
        }

        setListo(true);
      } catch (error) {
        console.log('Error preparando Supabase Casa Shamy:', error);
        inicioLanzadoRef.current = false;
        setErrorTexto(error?.message || 'No se pudo conectar Casa Shamy con Supabase.');
      }
    };

    preparar();
  }, [datosCargados, session?.user?.id, reintento]);

  useEffect(() => {
    if (!listo || !branchId || !session?.user?.id) return;

    setEstadoSync('Guardando…');

    const temporizador = setTimeout(async () => {
      try {
        const estado = estadoDesdeRespaldo(crearRespaldoDatos);
        const serial = JSON.stringify(estado);

        if (serial === ultimoSubidoRef.current) {
          setEstadoSync('Sincronizado');
          return;
        }

        const { error } = await supabase
          .from('branch_state')
          .upsert(
            {
              branch_id: branchId,
              state: estado,
              updated_by: session.user.id,
            },
            { onConflict: 'branch_id' }
          );

        if (error) throw error;
        ultimoSubidoRef.current = serial;
        setEstadoSync('Sincronizado');
      } catch (error) {
        console.log('Error sincronizando Casa Shamy:', error);
        setEstadoSync('Sin sincronizar');
      }
    }, 900);

    return () => clearTimeout(temporizador);
  }, [
    listo,
    branchId,
    session?.user?.id,
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

  const cerrarSesion = () => {
    if (estadoSync === 'Guardando…' || saliendo) return;
    Alert.alert('Cerrar sesión','¿Quieres cerrar tu sesión de Casa Shamy?',[{ text:'Cancelar',style:'cancel' },{ text:'Cerrar sesión',style:'destructive',onPress:async()=>{try{setSaliendo(true);const {error}=await supabase.auth.signOut();if(error)throw error;}catch(error){setSaliendo(false);Alert.alert('No se pudo cerrar sesión',error?.message||'Inténtalo nuevamente.');}}}]);
  };

  if (errorTexto) {
    return (
      <SafeAreaView style={styles.pantalla}>
        <View style={styles.centro}>
          <Text style={styles.titulo}>No se pudo sincronizar</Text>
          <Text style={styles.detalle}>{errorTexto}</Text>
          <Pressable
            style={styles.boton}
            onPress={() => {
              inicioLanzadoRef.current = false;
              setErrorTexto('');
              setReintento((n) => n + 1);
            }}
          >
            <Text style={styles.botonTexto}>Reintentar</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (!listo) {
    return (
      <SafeAreaView style={styles.pantalla}>
        <View style={styles.centro}>
          <ActivityIndicator size="large" color="#2E5A4F" />
          <Text style={styles.titulo}>Preparando Casa Shamy</Text>
          <Text style={styles.detalle}>Conectando la sucursal San Quintín con Supabase…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.app}>
      <View style={styles.barraSync}>
        <View style={styles.estadoGrupo}>
          <View style={[styles.puntoEstado,estadoSync === 'Sin sincronizar' ? styles.puntoError : estadoSync === 'Guardando…' ? styles.puntoGuardando : styles.puntoOk]} />
          <Text style={styles.estadoTexto}>{estadoSync}</Text>
        </View>
        <Pressable onPress={cerrarSesion} disabled={estadoSync === 'Guardando…' || saliendo} style={({pressed})=>[styles.botonSalir,(estadoSync === 'Guardando…' || saliendo)&&styles.botonSalirDeshabilitado,pressed&&styles.presionado]}>
          <Text style={styles.botonSalirTexto}>{saliendo ? 'Saliendo…' : 'Cerrar sesión'}</Text>
        </Pressable>
      </View>
      <View style={styles.contenidoApp}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  app:{flex:1,backgroundColor:'#F6F7F6'},
  contenidoApp:{flex:1},
  barraSync:{minHeight:40,paddingHorizontal:12,paddingVertical:6,backgroundColor:'#FFFFFF',borderBottomWidth:1,borderBottomColor:'#E3E7E5',flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
  estadoGrupo:{flexDirection:'row',alignItems:'center',gap:7},
  puntoEstado:{width:8,height:8,borderRadius:4},
  puntoOk:{backgroundColor:'#2E8B57'},
  puntoGuardando:{backgroundColor:'#C58A22'},
  puntoError:{backgroundColor:'#C14B3C'},
  estadoTexto:{color:'#52605B',fontSize:12,fontWeight:'800'},
  botonSalir:{minHeight:28,paddingHorizontal:10,borderRadius:8,borderWidth:1,borderColor:'#D7DDDA',backgroundColor:'#F7F8F7',alignItems:'center',justifyContent:'center'},
  botonSalirDeshabilitado:{opacity:.45},
  botonSalirTexto:{color:'#4E5B56',fontSize:11,fontWeight:'800'},
  presionado:{opacity:.65},
  pantalla: { flex: 1, backgroundColor: '#F6F7F6' },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  titulo: {
    marginTop: 16,
    fontSize: 22,
    fontWeight: '900',
    color: '#244B40',
    textAlign: 'center',
  },
  detalle: {
    marginTop: 8,
    maxWidth: 330,
    fontSize: 14,
    lineHeight: 20,
    color: '#7A8380',
    textAlign: 'center',
  },
  boton: {
    marginTop: 22,
    minHeight: 46,
    paddingHorizontal: 22,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2E5A4F',
  },
  botonTexto: { color: '#FFFFFF', fontWeight: '900' },
});
