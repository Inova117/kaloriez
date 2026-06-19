# 🔐 Sistema de Autenticación - Guía Completa

## 📋 Resumen

Se ha implementado un sistema completo de autenticación con Supabase que incluye:

- ✅ Login y Registro de usuarios
- ✅ Gestión de sesiones persistentes
- ✅ Migración automática de datos locales a la nube
- ✅ Sincronización en tiempo real
- ✅ Logout con confirmación
- ✅ Row Level Security (RLS) en Supabase

---

## 🚀 Configuración de Supabase

### 1. Crear proyecto en Supabase

1. Ve a [supabase.com](https://supabase.com)
2. Crea un nuevo proyecto
3. Guarda las credenciales:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`

### 2. Ejecutar el schema SQL

1. Abre el SQL Editor en tu proyecto de Supabase
2. Copia y pega el contenido de `supabase_schema.sql`
3. Ejecuta el script

Esto creará:
- Tablas: `profiles`, `food_entries`, `quick_add_items`, `ai_suggestions`
- Políticas de seguridad (RLS)
- Índices para optimización
- Triggers automáticos

### 3. Configurar variables de entorno

Actualiza tu archivo `.env`:

```env
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_ANON_KEY=tu-anon-key-aqui
```

---

## 🔄 Flujo de Autenticación

### Primera vez (Usuario nuevo)

```
1. Usuario abre la app
2. Ve AuthScreen (Login/Registro)
3. Se registra con email y contraseña
4. Recibe email de verificación (opcional)
5. Completa OnboardingScreen (perfil)
6. Datos se guardan en Supabase
7. Accede a TodayScreen
```

### Usuario existente

```
1. Usuario abre la app
2. Sesión se restaura automáticamente
3. Accede directamente a TodayScreen
4. Datos se sincronizan desde Supabase
```

### Migración de datos locales

```
1. Usuario con datos locales se registra/login
2. App detecta datos en AsyncStorage
3. Migra automáticamente a Supabase
4. Datos quedan sincronizados
```

---

## 📁 Archivos Creados/Modificados

### Nuevos archivos:

1. **`src/contexts/AuthContext.tsx`**
   - Contexto de autenticación
   - Funciones: `signUp`, `signIn`, `signOut`
   - Gestión de sesión

2. **`src/screens/AuthScreen.tsx`**
   - Pantalla de Login/Registro
   - Validación de formularios
   - Toggle entre modos

3. **`src/services/dataMigration.ts`**
   - Migración de datos locales → Supabase
   - Funciones CRUD para Supabase
   - Sincronización bidireccional

4. **`supabase_schema.sql`**
   - Schema completo de la base de datos
   - Políticas RLS
   - Triggers y funciones

### Archivos modificados:

1. **`App.tsx`**
   - Integra `AuthProvider`
   - Maneja flujo: Auth → Onboarding → App
   - Migración automática de datos

2. **`src/screens/TodayScreen.tsx`**
   - Botón de logout
   - Hook `useAuth()`

3. **`src/screens/OnboardingScreen.tsx`**
   - Guarda objetivo en Supabase
   - Sincroniza con perfil del usuario

4. **`src/components/Header.tsx`**
   - Botón de logout agregado
   - Prop `onLogoutPress`

---

## 🔒 Seguridad (RLS)

Todas las tablas tienen Row Level Security habilitado:

- Los usuarios solo pueden ver/editar sus propios datos
- Las políticas se aplican automáticamente
- No se requiere lógica adicional en el cliente

### Ejemplo de política:

```sql
CREATE POLICY "Users can view own food entries" ON food_entries
    FOR SELECT USING (auth.uid() = user_id);
```

---

## 🧪 Pruebas

### Probar registro:

1. Abre la app
2. Tap en "Sign Up"
3. Ingresa email, contraseña y nombre
4. Verifica que se cree el perfil en Supabase

### Probar login:

1. Cierra la app
2. Ábrela nuevamente
3. Verifica que la sesión se restaure automáticamente

### Probar migración:

1. Instala versión anterior (sin auth)
2. Agrega algunos alimentos
3. Actualiza a versión con auth
4. Regístrate/Login
5. Verifica que los datos migren a Supabase

### Probar logout:

1. En TodayScreen, tap el ícono de logout
2. Confirma
3. Verifica que vuelva a AuthScreen

---

## 📊 Estructura de Datos

### Tabla `profiles`

```typescript
{
  id: UUID (user_id de auth.users)
  email: string
  full_name: string | null
  daily_calorie_goal: number
  created_at: timestamp
  updated_at: timestamp
}
```

### Tabla `food_entries`

```typescript
{
  id: UUID
  user_id: UUID
  name: string
  calories: number
  meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snacks'
  is_favorite: boolean
  timestamp: timestamp
  created_at: timestamp
}
```

---

## 🐛 Troubleshooting

### Error: "Auth token is required"

- Verifica que `SUPABASE_URL` y `SUPABASE_ANON_KEY` estén en `.env`
- Reinicia el servidor de desarrollo

### Error: "Row Level Security policy violation"

- Verifica que las políticas RLS estén creadas
- Ejecuta el script SQL completo

### Los datos no se sincronizan

- Verifica la conexión a internet
- Revisa la consola para errores
- Verifica que el usuario esté autenticado: `user !== null`

### La sesión no persiste

- Verifica que AsyncStorage esté configurado correctamente
- Revisa la configuración del cliente Supabase

---

## 🔄 Próximos pasos (opcional)

1. **Email verification**: Habilitar verificación de email en Supabase
2. **Password reset**: Implementar recuperación de contraseña
3. **Social auth**: Agregar login con Google/Apple
4. **Realtime sync**: Sincronización en tiempo real con Supabase Realtime
5. **Offline mode**: Mejorar soporte offline con queue de sincronización

---

## 📝 Notas importantes

- Los datos locales se mantienen como backup
- La migración solo ocurre una vez por usuario
- El logout limpia AsyncStorage completamente
- Las sesiones expiran automáticamente según configuración de Supabase
- RLS protege todos los datos a nivel de base de datos

---

## ✅ Checklist de implementación

- [x] AuthContext creado
- [x] AuthScreen (Login/Registro)
- [x] Servicio de migración de datos
- [x] App.tsx actualizado con flujo de auth
- [x] TodayScreen con logout
- [x] OnboardingScreen sincroniza con Supabase
- [x] Schema SQL completo
- [x] Políticas RLS configuradas
- [x] Documentación completa

---

**¡El sistema de autenticación está listo para usar!** 🎉
