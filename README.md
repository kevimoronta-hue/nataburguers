# Nata Burger's — sitio de pedidos

Página única, mobile-first, para armar un pedido y enviarlo por WhatsApp. No hay pago en línea, cuentas, autenticación ni back-end.

## Arrancar

```bash
npm install
npm run dev     # http://localhost:3000
npm run build   # build de producción
npm run start
```

Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS 3.4. Listo para Vercel sin configuración extra.

## Antes de desplegar

1. **Dominio.** Cambia `SITE_URL` en `lib/config.ts`. Alimenta el canonical, Open Graph, `sitemap.xml` y `robots.txt`.
2. **Favicon.** `app/icon.png` y `app/apple-icon.png` son provisionales: la hamburguesa recortada del logotipo oficial. Sustitúyelos cuando el cliente entregue el suyo.
3. **Fotos pendientes.** Cinco productos reutilizan la foto de un producto vecino, marcados con un comentario en `data/menu.ts`: Fresa + Guineo, Lechosa, Agua de Jamaica, Fresa con Piña y Avena con Limón.
4. **Analítica.** `lib/analytics.ts` empuja los eventos a `window.dataLayer`. Conecta GTM, Plausible o lo que uses; el tipo `AnalyticsPayload` impide enviar datos personales.

## Dónde está cada cosa

| Archivo | Qué decide |
| --- | --- |
| `lib/config.ts` | Nombre, dirección, teléfono, número de WhatsApp, envío, límites de campos, dominio |
| `data/menu.ts` | Catálogo completo: categorías, productos, precios, imágenes, `available`, `featured` |
| `lib/cart.ts` | Estado del carrito, persistencia en `localStorage`, totales, `formatPrice` |
| `lib/whatsapp.ts` | Cuerpo del mensaje, enlace `wa.me` y validación del formulario |
| `tailwind.config.ts` | Los tokens del design system Nata Burger's |
| `app/layout.tsx` | Fuentes locales, metadata, Open Graph |
| `app/page.tsx` | Composición de la página y datos estructurados `Restaurant` |

Para cambiar un precio o añadir un producto, solo se toca `data/menu.ts`. Ningún componente escribe precios ni nombres a mano.

## Reglas que el código mantiene

- **El envío se suma una sola vez por pedido**, no por producto (`lib/cart.ts`).
- **El pedido nunca se declara confirmado.** El sitio dice que WhatsApp se abrirá y que el restaurante confirmará disponibilidad y tiempo.
- **El carrito se guarda; los datos personales no.** Nombre, teléfono, dirección, referencia y nota viven en memoria de React hasta que se abre WhatsApp. `localStorage` solo guarda `[{id, quantity}]`, y al restaurar descarta cualquier id que ya no esté en el menú.
- **El carrito no se vacía al enviar**, porque el pedido aún no está confirmado.
- **Respaldo si WhatsApp no abre**: se muestra el mensaje completo, un botón «Copiar pedido» y el número 809-685-9204.
- **Nada inventado**: sin horarios, sin zona de cobertura, sin tiempo de entrega, sin mapa, sin reseñas, sin promociones. Los datos estructurados solo declaran lo confirmado.
- **Sin datos bancarios** en ningún campo.

## Accesibilidad y movimiento

HTML semántico con un solo `h1`; anillo de foco único (2px `brand-bright`); objetivos táctiles de 44px mínimo; el drawer atrapa el foco, cierra con `Escape` y devuelve el foco al elemento que lo abrió; los cambios de cantidad y el producto agregado se anuncian con `aria-live`; `env(safe-area-inset-*)` en navbar, barra del carrito, drawer y footer.

El hero se arma al cargar y se asienta al hacer scroll leyendo `window.scrollY` con `requestAnimationFrame` — nunca secuestra el scroll ni bloquea el acceso al menú. Bajo `prefers-reduced-motion: reduce` se desactivan el asentamiento, el barrido de luz y las brasas.

> Nota sobre el hero: la composición usa la foto completa de la Clásica, no capas separadas. Para la apertura en capas (pan, lechuga, tomate, queso, carne, pan base) hacen falta seis imágenes con transparencia; cuando existan, se montan en `components/Hero.tsx` sustituyendo el bloque de la imagen única.

## Design system

Los colores, la tipografía, los radios, las sombras y las reglas de uso vienen del design system Nata Burger's. `tailwind.config.ts` es su reflejo; si un token cambia allí, se cambia aquí.
