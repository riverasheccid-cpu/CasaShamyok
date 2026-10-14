# Casa Shamy V2.08 — paquete final

Este paquete consolida la V2 del proyecto:

- `App.js`: navegación, dashboard y módulos principales.
- `DatosNegocio.js`: almacenamiento, FIFO, ventas, carrito, flujo, gastos, inversiones, créditos y respaldo/importación.
- `VentasPOS.js`: punto de venta visual y carrito.
- `ProductosRecetas.js`: productos fijos, bebidas configurables, arma el tuyo, recetas y personalizaciones.
- `InventarioFIFO.js`: inventario FIFO, compras, compras libres, lotes, costos pendientes y merma.
- `FlujoEfectivo.js`: efectivo, banco, tarjeta, saldos iniciales y transferencias internas.
- `Reportes.js`: utilidad provisional, ventas, rankings, horarios, flujo y respaldo/importación.

## Respaldo de datos

En Reportes aparece la sección **Respaldo de datos**. El respaldo contiene inventario, productos, ventas, gastos, inversiones, flujo, compras y créditos.

La importación reemplaza los datos locales de la instalación actual, por lo que debe hacerse únicamente con un respaldo completo.

## Importante para migrar desde el Snack actual

El código de GitHub y los datos guardados dentro de Expo Go son cosas distintas. Subir estos archivos a GitHub no copia automáticamente los registros que ya existen en el Snack del iPhone.

Antes de dejar de usar el Snack actual, hay que generar un respaldo desde la instalación que todavía contiene esos datos. Cuando llegue el momento de pasar a la app instalada/TestFlight, no borrar Expo Go ni el Snack hasta comprobar que el respaldo fue importado correctamente en la nueva instalación.
