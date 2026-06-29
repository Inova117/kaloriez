# App Store — checklist para publicar y vender (Kaloriez)

> Auditoría (jun-2026) de los requisitos de Apple cruzada contra el estado real del repo.
> No es asesoría legal. Las páginas legales viven en https://kaloriez.dev/legal/ (HTTP 200).

## Veredicto

- **Lanzar como app GRATIS:** casi listo (faltan formularios de App Store Connect + 3 arreglos de código menores).
- **Vender SUSCRIPCIÓN:** **NO** listo — 7 blockers (no hay IAP integrado y el paywall enseña precios pero no cobra).

---

## 🔴 Blockers para VENDER suscripción

| # | Qué falta | Guideline | Acción |
|---|---|---|---|
| 1 | **No hay IAP/StoreKit.** Ningún SDK (RevenueCat / react-native-iap / expo-in-app-purchases). El botón "Empezar Premium" solo muestra "Muy pronto" y entra gratis. | 3.1.1 | Integrar StoreKit auto-renovable (recomendado: **RevenueCat**). Conectar la compra real a `PremiumContext` y recién entonces poner `PREMIUM_ENABLED=true`. |
| 2 | **No hay "Restaurar compras".** | 3.1.1 | Botón "Restaurar compras" en PremiumPanel y en Profile > Plan → `restorePurchases()`. |
| 3 | **No existen el Subscription Group ni los productos** anual/mensual en App Store Connect. | 3.1.2 | Crear grupo + productos (`...premium.annual` / `.monthly`), precio y localización es-MX. |
| 4 | **Paywall incompleto:** botón de compra que no compra. | 2.1 | Decisión: (A) quitar precios/CTA y lanzar gratis, **o** (B) integrar IAP real. No enviar el estado intermedio. |
| 5 | **Paid Applications Agreement** sin firmar. | App Store Connect | Business > Agreements → firmar (persona física, Martín García, Ecuador). |
| 6 | **W-8BEN + datos bancarios** sin completar. | App Store Connect | W-8BEN (Ecuador, sin Tax ID de EE.UU.; sin tratado fiscal → retención por defecto) + banco/moneda. Campos difíciles de corregir: con cuidado. |
| 7 | **Cuestionario App Privacy** (nutrition labels) sin llenar. | 5.1.1(i) | Ver tabla de etiquetas abajo. Obligatorio antes de enviar. |

## 🟠 Arreglos de código (ayudan tanto en gratis como en pago)

| Qué | Guideline | Acción |
|---|---|---|
| **Consentimiento en el registro:** AuthScreen no enlaza Términos/Privacidad. | 5.1.1(i) | Bajo "Crear cuenta": "Al crear tu cuenta aceptas los Términos y el Aviso de Privacidad" con enlaces tappables a `TERMS_URL`/`PRIVACY_POLICY_URL`. |
| **Export compliance** no declarado. | 5.1 / Export | En `app.json` → `ios.infoPlist: { "ITSAppUsesNonExemptEncryption": false }`. |
| **Permiso de micrófono en inglés.** | 5.1.1 | Traducir a español: "Kaloriez usa el micrófono solo para dictar por voz lo que comiste y estimar sus calorías." |
| **Disclaimer de trastornos alimentarios solo en web.** | 1.4.1 | Línea in-app cerca de metas agresivas remitiendo a ayuda profesional (el aviso completo ya está enlazado). |
| **Metadata/paywall inconsistente:** anuncia como "Premium con precio" cosas hoy gratis. | 2.3 | Mientras sea gratis, no presentarlas como "desbloqueables con Premium" con precio. |
| **Entitlement premium falso** (AsyncStorage local). | 3.1.1 | Solo al activar venta: `refresh()` debe leer la entitlement de StoreKit/RevenueCat y pasar el tier real al server. |

## 🟢 Lo que YA cumplimos

- 6 páginas legales **publicadas y vivas** (HTTP 200): privacidad, términos, reembolsos, eliminar-datos, aviso-médico, soporte.
- Aviso de Privacidad completo y coherente con el código (Supabase, Gemini, USDA, Sentry sin PII, voz).
- EULA propio con **Anexo Apple** (Apple no es parte, terceros beneficiarios, reembolso vía Apple).
- Privacidad y Términos **enlazados dentro de la app** (Profile y PremiumPanel) + disclosure de auto-renovación en el punto de compra.
- **Borrado de cuenta in-app** real e inmediato (5.1.1(v)) — borra `profiles` en cascada + auth user.
- **Sign in with Apple (4.8) NO aplica** (solo email/contraseña, sin login social).
- **Anti-steering OK** (sin Stripe/"fundador"/pagos externos en la app iOS).
- Minimización de datos (solo micrófono on-demand; sin cámara/ubicación/IDFA), audio temporal borrado, notificaciones locales (sin push token).
- Funcionalidad nativa sustancial (4.2) y piso de seguridad de calorías.

## App Store Connect — formularios y cuenta (solo tú)

- **Apple Developer Program** activo a nombre de Martín García (persona física, Ecuador).
- Firmar **Paid Applications Agreement**; completar **W-8BEN** + banca.
- Crear **Subscription Group** + productos (cuando integres IAP).
- **App Privacy** (etiquetas):
  - Contact Info (Email; Name opcional) → *Linked*, App Functionality.
  - Health & Fitness (comidas, peso, meta) → *Linked*, App Functionality.
  - User Content > Audio Data (voz → Gemini) → *Not Linked*, efímero, App Functionality.
  - Identifiers (User ID) → *Linked*. Diagnostics (Crash/Sentry) → *Not Linked*.
  - **Tracking = No** en todo. Añadir Purchases cuando haya IAP.
- **Age Rating:** app de salud/fitness con seguimiento de peso; "Medical/Treatment: None" (es informativa); edad mínima 13.
- **Metadata URLs:** Privacy Policy `https://kaloriez.dev/legal/privacidad.html`, Support `https://kaloriez.dev/legal/soporte.html`, License Agreement (si EULA propio) `https://kaloriez.dev/legal/terminos.html`, Marketing (opcional) `https://kaloriez.dev`.
- **App Review Notes:** indicar la ruta de borrado (Perfil > Eliminar cuenta) y por qué hay cuenta (respaldo/sincronización de datos de salud).

## Top riesgos de rechazo (si se envía tal cual hoy)

1. **3.1.1 / 2.1** — paywall con precios y botón que no cobra ("Muy pronto").
2. **3.1.1** — falta "Restaurar compras" cuando exista IAP.
3. **2.3** — anunciar como "Premium" funciones hoy gratis.
4. **5.1.1(i)** — registro sin aceptación visible de Términos/Privacidad.
5. **1.4.1** — mitigación de trastornos alimentarios solo en web.
6. **Export compliance** — falta `ITSAppUsesNonExemptEncryption`.
