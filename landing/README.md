# Landing — Kaloriez (smoke test)

Página de aterrizaje autocontenida para el smoke test de *founder access*. Un solo
archivo (`index.html`), sin build, sin dependencias, sin imágenes (todo es HTML/SVG).

**La única métrica:** de cada 100 visitas, cuántas tarjetas.

La página describe el cobro como **suscripción anual en USD** con **precio de
fundador el primer año** ($20 USD), que luego renueva al precio normal. Para que
las promesas de la página sean verdad, configura Stripe así:

1. **Crea el Payment Link como suscripción** (Stripe → Payment Links → New →
   *Recurring*, intervalo anual, **moneda USD**).
   - Producto: "Kaloriez — Acceso fundador". Primer año $20 USD (usa un cupón /
     precio de lanzamiento si la renovación normal es mayor).
   - Define el **precio de renovación** (año 2 en adelante). Si quieres congelar
     el precio de fundador, deja la renovación también en $20 USD.
2. **Activa el portal de cliente de Stripe** (Settings → Billing → Customer
   portal) para que "cancelas en un toque" sea real (cancelación self-serve).
3. **Activa los correos de renovación** ("Upcoming renewal" / recordatorios) para
   que "te avisamos antes de cada cargo" sea verdad.
4. **Pega el link** en `index.html`, en la constante del `<script>`:
   ```js
   const STRIPE_PAYMENT_LINK = "https://buy.stripe.com/tu_link_real";
   ```
   Mientras quede el placeholder `REEMPLAZA_CON_TU_LINK`, los botones no cobran
   (el del cierre cae a un `mailto:` para no perder al interesado).

## Publicar en Netlify

Es un sitio **separado** de la app (la app usa `expo export -p web` → `dist`;
esto es estático). Opciones:

- **Dashboard:** New site → conecta el repo → **Base directory:** `landing` →
  Build command: *(vacío)* → Publish directory: `landing`. El `netlify.toml` de
  esta carpeta ya deja eso configurado.
- **Deploy manual:** arrastra la carpeta `landing/` a Netlify Drop
  (app.netlify.com/drop).
- **CLI:** `netlify deploy --dir=landing --prod`

## Después de publicar

Manda $50–80 de tráfico mexicano (Meta/Google) y mide las tarjetas en Stripe.
Solo prometemos lo que el prototipo ya hace: día completo de un vistazo, registro
en segundos, precio claro sin cargos sorpresa.
