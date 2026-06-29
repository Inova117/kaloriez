# Cumplimiento y protección legal — Kaloriez (notas internas)

> **Esto NO es asesoría legal.** Soy un asistente, no abogado. Estos documentos son una
> base sólida y honesta, pero **un abogado y un contador mexicanos deben revisarlos**
> antes de lanzar — sobre todo el Aviso de Privacidad (LFPDPPP), los Términos, la
> facturación (CFDI) y las reglas de suscripción de Apple/Google.

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

## 2. ⚠️ Lo que SOLO tú puedes completar (busca el resaltado amarillo `[COMPLETAR: …]`)

1. **Responsable**: nombre legal / razón social (¿persona física “Martín García” o sociedad?).
2. **RFC** del responsable.
3. **Domicilio fiscal/legal** completo.
4. **Ciudad y entidad de jurisdicción** para los Términos (ej. “Ciudad de México”).
5. **Precio de renovación** de la suscripción fundador de Stripe (hoy dice “precio normal” sin cifra).
6. Crea y atiende los correos: **soporte@kaloriez.dev** y **privacidad@kaloriez.dev**.
7. Confirma la **fecha de vigencia** (puse 28 de junio de 2026 en todas).

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

---
_Generado como borrador de trabajo. Revisión profesional obligatoria antes de publicar/lanzar._
