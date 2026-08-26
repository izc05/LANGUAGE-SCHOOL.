# FASE 10.0 · Auditoría Campus Alumno

Checkpoint auditado: `d14d72108896a9a9263bb81c1e29f6d98760e75e`

## Conclusión

El Campus no necesita una reconstrucción. La base funcional es amplia y ya trabaja con datos reales. La deuda principal está en la experiencia: cada área funciona de forma bastante independiente y el alumno no recibe todavía una narrativa académica continua de **qué tengo ahora → qué debo hacer → con qué material → qué feedback recibí → cómo evoluciono**.

La estrategia aprobada para FASE 10 es mejorar por capas, conservar contratos y backend existentes y validar cada microfase antes de avanzar.

## Inventario actual

### Inicio `/alumno`

Ya muestra:
- próxima clase;
- modalidad presencial/online/híbrida;
- tareas;
- material;
- avisos;
- curso/grupo/matrícula;
- nivel del curso;
- archivos privados.

Hallazgos:
- la bienvenida ocupa demasiado peso frente a la siguiente acción real;
- próxima clase, tarea pendiente y material reciente compiten entre sí en vez de formar una secuencia;
- el Inicio conectado usa todavía `online_join_url` externo, aunque `Mis clases` ya entra por `/alumno/aula/:classId`;
- el nivel mostrado en la franja de curso es el nivel del curso, no el nivel académico validado/estimado del alumno;
- faltan señales más claras de “ahora”, “después” y “al día”.

Prioridad: **P0 experiencia / P1 coherencia funcional**.

### Mi nivel `/alumno/nivel`

Fortalezas:
- estimación automática A1–C2;
- nivel validado por la academia diferenciado;
- histórico real;
- competencias;
- retake controlado;
- evaluación reanudable;
- Listening diagnóstico cuando aplica.

Mejora posterior:
- simplificar lectura de progreso;
- conectar nivel con curso y siguiente objetivo académico.

Prioridad: **P2 visual/continuidad**, no backend.

### Mis clases `/alumno/clases`

Fortalezas:
- próximas e historial;
- presencial/online/híbrida;
- asistencia;
- aula interna para ONLINE/HYBRID;
- estados vacíos.

Mejora posterior:
- jerarquía hoy/próxima/resto;
- estado temporal previo/en curso/finalizada;
- acceso al aula más contextual;
- relación con material/tareas cuando exista vínculo de datos.

Prioridad: **P1**.

### Aula online `/alumno/aula/:classId`

Fortalezas:
- Meeting SDK bajo demanda;
- autorización server-side role 0;
- secretos fuera del navegador;
- matrícula activa obligatoria;
- fallback Zoom externo;
- vuelta a Mis clases al salir.

Mejora posterior:
- integrar visualmente mejor el estado previo de la sesión;
- distinguir “aún no empieza / disponible / finalizada” cuando el contrato de horarios lo permita;
- reducir texto técnico visible al alumno y moverlo a una capa de confianza más discreta.

Prioridad: **P1 UX**, sin cambiar seguridad.

### Tareas `/alumno/tareas`

Fortalezas:
- pendientes/entregadas/revisadas/devueltas;
- texto y archivo;
- adjuntos;
- 20 MB;
- feedback y calificación textual;
- protección frente a doble entrega/cierre.

Mejora posterior:
- ordenar primero por acción requerida;
- hacer más visible feedback nuevo;
- relacionar tarea con material/clase si el modelo lo soporta.

Prioridad: **P2**.

### Material `/alumno/material`

Fortalezas:
- búsqueda;
- filtros alumno/grupo/curso;
- descarga protegida;
- tipos de archivo visibles.

Mejora posterior:
- fecha/novedad;
- agrupación por unidad/tema cuando exista dato fiable;
- acceso contextual desde Inicio/clase/tarea.

Prioridad: **P2**.

### Avisos `/alumno/avisos`

Fortalezas:
- todos/sin leer;
- tipos de aviso;
- persistencia de leído.

Hallazgo:
- actualmente toda la tarjeta marca leído mediante `onClick`, sin acción semántica explícita ni destino contextual.

Prioridad: **P2 accesibilidad/UX**.

### Mis archivos `/alumno/archivos`

Fortalezas:
- espacio privado;
- subida/descarga;
- categorías;
- búsqueda;
- archivado;
- límite 20 MB.

Prioridad: **P3 pulido visual**.

### Mi perfil `/alumno/perfil`

Comparte `AccountProfilePage` con Profesor y mantiene la edición de cuenta fuera de la lógica académica. No requiere una pantalla paralela específica de alumno.

Prioridad: **P3 coherencia visual**.

## Shell y navegación

- `DashboardShell` resuelve nombre real, rol, marca, estado backend, logout y navegación por `NavLink`.
- Las ocho áreas del alumno viven en sidebar.
- El shell ya incluye skip link y `main-content` enfocable.
- Hay estilos de rol y estilos históricos superpuestos; no conviene una limpieza global durante 10.1.

Decisión: crear capas CSS específicas de FASE 10 para evitar regresiones en Profesor/Admin.

## Responsive y accesibilidad

Contratos existentes:
- breakpoints aproximados 1180 / 820 / 560-600;
- grids del Inicio pasan a una columna;
- `prefers-reduced-motion` elimina transiciones principales;
- formularios usan labels y estados `role=status/alert` en la mayoría de flujos.

Pendiente transversal para 10.7:
- inspección real 1440 / 1180 / 820 / 390;
- navegación del sidebar en móvil;
- foco visible de todos los nuevos CTAs;
- targets táctiles;
- overflow horizontal;
- orden lógico de teclado.

## Orden aprobado

1. **10.1 Inicio Alumno**: hacer dominante la siguiente acción, unificar entrada al aula interna y reducir ruido.
2. **10.2 Mis clases + Aula online**.
3. **10.3 Tareas + correcciones**.
4. **10.4 Material**.
5. **10.5 Mi nivel + progreso**.
6. **10.6 Avisos + archivos + perfil**.
7. **10.7 Responsive y accesibilidad**.
8. **10.8 Validación transversal**.

## Invariantes

- no tocar `main`;
- no fusionar PR #11;
- no degradar la entrada oficial de esfera/Tierra rosa + avión 3D;
- no exponer secretos Zoom;
- no sustituir el aula interna por un link directo externo;
- no reabrir backend estable sin una necesidad demostrada;
- cada microfase termina con CI/E2E antes de continuar.
