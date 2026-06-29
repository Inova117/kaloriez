# Cumplimiento y protección legal — Kaloriez (notas internas)

> **Esto NO es asesoría legal ni fiscal.** Soy un asistente, no abogado. Estos documentos son una
> base sólida y honesta, pero **un abogado y un contador deben revisarlos** antes de lanzar —
> en **Ecuador** (domicilio del responsable) y en tus mercados de venta (**México** primero).
> Ojo con protección de datos, suscripciones e impuestos digitales (ver el **mapa LATAM** abajo).

## 1. Qué se creó (en `landing/legal/`)

| Página | URL pública | Para qué |
|---|---|---|
| `index.html` | `/legal/` | Hub de todos los documentos |
| `privacidad.html` | `/legal/privacidad.html` | Aviso de Privacidad (LFPDPPP + GDPR/CCPA) |
| `terminos.html` | `/legal/terminos.html` | Términos y Condiciones / EULA (incluye anexo Apple) |
| `reembolsos.html` | `/legal/reembolsos.html` | Reembolsos (3 días mensual / 7 días anual en Stripe) |
| `eliminar-datos.html` | `/legal/eliminar-datos.html` | Borrado de cuenta/datos (lo exige Google) |
| `aviso-medico.html` | `/legal/aviso-medico.html` | Disclaimer médico (escudo clave para app de salud) |
| `soporte.html` | `/legal/soporte.html` | Support URL (lo exigen Apple y Google) |

Se publican solos en Netlify (están dentro de `landing/`, que es el publish dir).

## 2. Datos del responsable — ya completados, y lo que falta

**Ya completado en todos los documentos:** responsable = **Martín García** (persona física),
domicilio **Calle B, Cumbayá, Quito, Ecuador**; ley y foro de los Términos = **México** (reconociendo
los derechos irrenunciables del consumidor/usuario de cada país); renovación de la suscripción
fundador = **$49.99 USD/año**; vigencia 28-jun-2026.

**Falta de tu lado:**
1. *(Opcional)* Tu **cédula o RUC** y su número, si quieres publicarlo como identificación del
   responsable (queda un `[OPCIONAL: …]` en `privacidad.html`). Si no, se queda con nombre +
   domicilio + correo, que es aceptable.
2. Crear y atender los correos **soporte@kaloriez.dev** y **privacidad@kaloriez.dev**.
3. Conectar el dominio **kaloriez.dev** al sitio de Netlify (para que `/legal/…` y los enlaces de la
   app abran).

## 3. Escudos de responsabilidad incluidos (lo que te protege)

- **Aviso médico** prominente + “no es dispositivo médico” + estimaciones aproximadas + nota de
  trastornos alimentarios (clave para Apple 1.4.1 y para reducir demandas por daño a la salud).
- **Exclusión de garantías** (“tal cual / según disponibilidad”).
- **Límite de responsabilidad** (tope: lo pagado en 12 meses o 50 USD; sin daños indirectos).
- **Indemnización** del usuario hacia ti.
- **Exactitud de la IA**: claro que los números pueden estar mal y que no te demanden por eso.
- **Anexo Apple** con las renuncias mínimas que Apple exige (Apple no es responsable, etc.).
- **Ley y jurisdicción** mexicanas.

**Límite honesto:** ninguna cláusula “quita toda” la responsabilidad. La ley mexicana de consumidor
(LFPC) y la de datos (LFPDPPP) tienen **derechos irrenunciables**; tampoco se puede excluir el dolo o
la negligencia grave. Los documentos limitan tu riesgo **al máximo que la ley permite**, no más.

## 4. Para llenar el formulario de las tiendas

**Apple — App Privacy (App Store Connect):** declara estas categorías (vinculadas al usuario salvo
nota): Contact Info (correo, nombre) → App Functionality/Account; Health & Fitness (calorías, comidas,
peso) → App Functionality; Identifiers (User ID); Diagnostics/Crash Data (Sentry) → **no vinculado**;
Purchases (suscripción); User Content/Audio (voz al dictar; aclara que es efímera, no se almacena).
**“Used to track you” = No.**

**Google — Data Safety (Play Console):** Personal info (correo, nombre); Health & fitness (calorías,
comidas, peso); App activity; Audio (voz: se procesa, no se almacena); Crash logs/Diagnostics (Sentry);
Purchase history. Marca: **cifrado en tránsito = Sí**, **el usuario puede pedir eliminación = Sí**
(apunta a `/legal/eliminar-datos.html`), **no se venden datos**. Lista como receptores: Google (Gemini),
Sentry, Stripe.

## 5. 🚩 Acciones críticas en el CÓDIGO/tienda (sin esto te rechazan o te expones)

1. **NO cobres suscripción con Stripe dentro de las apps iOS/Android.** Apple (3.1.1) y Google exigen
   IAP / Play Billing para suscripciones digitales; Stripe **solo en la web**. (En el repo, premium
   está desactivado, así que aún estás a tiempo de hacerlo bien.)
2. **Pantalla de suscripción (PremiumPanel.tsx):** antes de comprar debe mostrar nombre del plan,
   precio por periodo, que es **auto-renovable**, cómo cancelar, y **enlaces a Términos y Privacidad**.
   Hoy no los muestra → Apple 3.1.2 y Google lo rechazarían.
3. **Publica las URLs** y ponlas en App Store Connect y Play Console: Privacidad, Soporte, y (Google)
   **eliminación de datos**. Hoy `PRIVACY_POLICY_URL` en `ProfileScreen.tsx` es placeholder
   `https://kaloriez.dev/privacy` → cámbialo a la URL real publicada y agrega el enlace a Términos.
4. **Disclaimer médico dentro de la app** (no solo en la web): un aviso breve visible (onboarding o
   ajustes) que enlace a `/legal/aviso-medico.html`. Apple 1.4.1. **Es el escudo más importante de una
   app de salud:** un aviso que el usuario nunca vio tiene poco peso ante una demanda. Prioridad alta.
4-bis. **Aceptación verificable (clickwrap):** en el alta de cuenta y en la compra, pide un acto
   afirmativo (checkbox/botón "Acepto") con enlaces visibles a Términos y Privacidad, y registra
   versión + fecha del consentimiento. Refuerza la exigibilidad de las renuncias (límite de
   responsabilidad, indemnización) frente a un contrato de adhesión.
5. **Verifica el borrado de cuenta**: que `deleteAccount` borre de verdad los datos del servidor
   (perfil, comidas, peso), no solo cierre sesión. (Está implementado; confírmalo.)
6. **Edad mínima 13+** en el cuestionario de rating de ambas tiendas; no inscribir en categorías
   infantiles.
7. **Cumple lo que promete la landing**: activa en Stripe el **portal de cliente** (cancelar en un
   toque) y los **correos de aviso previo a la renovación**.
8. **Sesión web sin cifrar**: en web la sesión se guarda en localStorage sin cifrar (por diseño actual).
   No es bloqueante para lanzar las apps nativas, pero conviene endurecerlo si promueves la versión web.

## 6. México (revisar con abogado/contador)

- El **Aviso de Privacidad** ya trae estructura LFPDPPP (responsable, ARCO, transferencias, datos
  sensibles). Falta: datos del responsable y validación legal.
- **CFDI / facturación**: si vendes a consumidores mexicanos por Stripe, valora la obligación de
  emitir factura a quien la pida y el cumplimiento fiscal del RFC.
- **PROFECO / LFPC**: precio total claro, condiciones de renovación con cifra, cancelación sencilla y
  comprobante. Ya está reflejado en Reembolsos y Términos.

## 7. Internacional

- Si no quieres asumir GDPR completo, puedes **limitar la disponibilidad** a México/LatAm/EE. UU. en
  App Store Connect y Play Console. La web sí es global; por eso el Aviso ya incluye secciones UE/CCPA.

## 8. Mapa de cumplimiento LATAM (investigado con fuentes, jun-2026)

Vendes en toda LatAm desde Ecuador. Aplican **dos vías a la vez**: (1) por **establecimiento**, la ley
**ecuatoriana** te aplica directo por residir ahí (datos: LOPDP; consumo: LODC; impuestos: SRI), sea
cual sea el mercado; (2) por **alcance**, la ley de **cada país donde tengas usuarios/ventas**.

> **Regla de oro de impuestos:** el **canal** decide quién cobra el IVA.
> **App Store / Google Play (IAP):** Apple/Google actúan como *marketplace facilitator*, cobran y
> **remiten** el IVA del consumidor por ti (y te pagan tu reparto). **Stripe directo (web):** la
> obligación es **100% tuya** (registro propio o cobertura por retención de tarjeta según país).

### 8.1 Protección de datos (datos de salud = sensibles en todos → consentimiento expreso)

| País | Ley | Autoridad | Notas |
|---|---|---|---|
| **México** (mercado 1) | **Nueva LFPDPPP 2025** (vigente 21-mar-2025, abroga la de 2010) | En consolidación (desapareció el INAI) | Salud sensible: consentimiento **expreso y por escrito** (firma/e-firma). ARCO. ⚠️ regulador/reglamento aún cambiando. |
| **Ecuador** (domicilio) | **LOPDP** 2021 + Reglamento 2023 | **SPDP** (ya sanciona) | Aplica por residencia. Derechos tipo RGPD. |
| Colombia | Ley 1581/2012 (habeas data) | **SIC** | Inscribir bases en el **RNBD**. |
| Chile | **Ley 21.719** (2024; vigencia plena ~dic-2026; hoy rige 19.628) | Nueva Agencia (APDP) | Diseñar ya conforme a la 21.719. |
| Perú | Ley 29733 + Reglamento D.S. 016-2024-JUS (vig. 30-mar-2025) | ANPD | Notificación de brechas **48 h**. |
| Argentina | Ley 25.326 (reforma en proyecto, no sancionada) | AAIP | No citar "ley nueva"; monitorear. |
| Brasil | **LGPD** | **ANPD** | Cláusulas-padrão ANPD (Res. 19/2024) obligatorias desde ago-2025. |

### 8.2 Consumo — suscripción auto-renovable + derecho de retracto

| País | Aviso de renovación / cancelación | Retracto/desistimiento | Autoridad |
|---|---|---|---|
| **México** | Reforma LFPC (DOF dic-2025): consentimiento expreso del cobro, **aviso ≥5 días**, cancelar sin penalización | — | PROFECO |
| Ecuador | Aviso **15 días**; cancelar por el mismo medio | — | Defensoría del Pueblo |
| Colombia | Información clara | **5 días hábiles** | SIC |
| Chile | Informar y cancelación fácil | **10 días** (90 si no hay confirmación escrita) | SERNAC |
| Perú | **Aviso ≥30 días** o se considera abusivo | — | INDECOPI |
| Argentina | **Botón de Arrepentimiento + Botón de Baja** en la web (Disp. 954/2025) | **10 días hábiles** | Subsec. Defensa del Consumidor |
| Brasil | — | **7 días** (arrependimiento) | SENACON / PROCONs |
| UE | **Botón de desistimiento** web (oblig. 19-jun-2026) | **14 días** | Autoridades nacionales |
| EE.UU. | California **ARL** (click-to-cancel); regla FTC anulada jul-2025 | varía por estado | FTC / AG estatales |

→ Implementa el flujo con el **estándar más estricto**: consentimiento expreso del cobro recurrente,
**aviso de renovación ~30 días**, cancelación por el mismo medio sin fricción, reembolso voluntario.
En la **web** (Stripe) agrega el **doble botón** argentino (arrepentimiento + baja).

### 8.3 Impuestos a servicios digitales (IVA/IGV) — venta directa por Stripe

| País | Régimen | Proveedor extranjero | Tasa |
|---|---|---|---|
| México | IVA servicios digitales (arts. 18-B…) | **Registrar RFC ante SAT** + representante + e.firma, declarar mensual | 16% |
| Ecuador | IVA importación servicios digitales (SRI) | Eres **residente**: formaliza **RUC** + facturación SRI (renta + IVA local) | 15% |
| Colombia | IVA prestadores del exterior (DIAN) | Régimen simplificado (NIT) **o** retención por tarjeta | 19% |
| Chile | Régimen simplificado IVA digital (SII) | **Registro SII**, cobrar y declarar mensual | 19% |
| Perú | IGV servicios digitales (D.Leg. 1623) | **Registro SUNAT**, retención/percepción | 18% |
| Argentina | IVA servicios digitales | **No te registras**: lo percibe el **intermediario de pago** | 21% |
| Brasil | CBS/IBS (reforma; 2026 prueba, pleno 2027) | A futuro: **CNPJ** + registro | en transición |

> En **IAP no haces nada** de esto: Apple/Google ya cobran y remiten. Para **Stripe**, valora un
> **Merchant of Record** (Paddle, Lemon Squeezy, Stripe Managed Payments) que asuma los impuestos
> multipaís por ti. Y configura bien tu **información fiscal en App Store Connect / Play Console**.

### 8.4 Acciones de cumplimiento (prioridad)

1. **Ecuador (base obligatoria):** RUC + facturación SRI; cumplir **LOPDP** + Reglamento (la SPDP ya multa).
2. **Consentimiento de salud:** checkbox **expreso y separado** antes de capturar peso/comidas/**voz**
   (en México, por escrito/e-firma). Trata la **voz** como dato potencialmente biométrico.
3. **Suscripción:** consentimiento del cobro + aviso ~30 días + cancelación fácil + doble botón (web/Argentina).
4. **Transferencias internacionales:** cláusulas con encargados (Stripe, hosting, IA de voz); Brasil = cláusulas-padrão ANPD.
5. **Registro de bases:** Colombia (RNBD/SIC), Uruguay (URCDP), Perú (ANPD) según umbrales.
6. **Impuestos Stripe:** registrarte donde se exige (SAT/SII/SUNAT/DIAN/DGI) **o** usar un Merchant of Record.
7. **UE/EE.UU.:** decide si admites usuarios (asumes RGPD/OSS y CCPA/ARL) o **geobloqueas** el registro/venta.
8. **Brechas:** procedimiento de notificación con plazos cortos (Perú 48 h).

### 8.5 Banderas de "verifícalo con tu abogado/contador" (marcos muy recientes)

- **México datos:** LFPDPPP 2025 con regulador/reglamento aún consolidándose (mercado #1 → confirma con abogado MX).
- **México consumo:** reforma LFPC dic-2025 (aviso 5 días, sin penalización) — muy reciente.
- **Chile datos:** Ley 21.719 con sanciones plenas ~dic-2026.
- **Perú:** Reglamento de datos y IGV digital (2024-2025) recientes.
- **Brasil:** reforma tributaria CBS/IBS en implementación gradual.
- **Argentina:** reforma de datos no sancionada; Disp. 954/2025 siguió ajustándose.
- **Centroamérica / Rep. Dominicana:** nombres/años de leyes **no verificados** país por país.
- **EE.UU.:** la regla "click-to-cancel" de la FTC fue **anulada** (jul-2025); rige derecho estatal.

> Fuente: investigación con verificación web (jun-2026). Marcos en evolución — no es asesoría legal.

---
_Generado como borrador de trabajo. Revisión profesional obligatoria antes de publicar/lanzar._
