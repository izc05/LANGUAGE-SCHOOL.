# FASE 8C.7 · Banco real y diversidad

## Decisión de producto

`cefr-v1` mantiene un blueprint fijo y auditable. En esta fase no se introduce un algoritmo adaptativo que cambie de dificultad durante el intento: sin una calibración psicométrica real, hacerlo añadiría opacidad sin demostrar mayor precisión.

La mejora se concentra en dos puntos medibles:

1. **Banco suficiente y equilibrado.**
   - 72 preguntas originales de Language School.
   - 3 competencias: Grammar, Vocabulary y Reading.
   - 6 niveles MCER: A1, A2, B1, B2, C1 y C2.
   - 4 variantes activas por cada una de las 18 combinaciones competencia × nivel.
   - 4 opciones por pregunta y answer key privado.
   - En cada celda, los IDs internos de respuesta correcta quedan equilibrados A/B/C/D.

2. **Diversidad reproducible sin alterar la dificultad.**
   - PUBLIC mantiene selección y orden pseudoaleatorios derivados de una semilla opaca por intento.
   - CAMPUS mantiene el mismo blueprint de 30 preguntas.
   - Cuando existe un intento Campus completado de la misma versión, se priorizan preguntas no utilizadas en ese intento anterior, pero siempre dentro de la misma competencia y nivel MCER.
   - Si el banco no dispone de alternativa suficiente, el sistema conserva la selección original en vez de alterar el blueprint.

## Trazabilidad

Cada intento conserva `selection_snapshot` con los IDs exactos y el orden de opciones utilizados. La puntuación continúa calculándose exclusivamente al finalizar mediante `cefr-v1`; la política de diversidad no cambia umbrales, guardias de evidencia ni el resultado matemático.

## Banco inicial

El banco base se instala como versión `DRAFT` (`ls-cefr-2026-v1`) al disponer del primer usuario ADMIN en una instalación sin versiones de placement existentes. Administración debe revisarlo y publicarlo mediante el flujo seguro de 8C.6; nunca se sobrescribe una versión existente.

## Fuera de alcance de 8C.7

- Listening (8C.8).
- Speaking automático.
- Computer-adaptive testing / IRT.
- Recalibración estadística automática de dificultad sin datos reales.
- Cambiar `cefr-v1` o sus umbrales.
