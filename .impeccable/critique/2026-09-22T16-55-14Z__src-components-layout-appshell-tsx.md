---
target: Noa PWA escritorio (AppShell)
total_score: 23
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
timestamp: 2026-09-22T16-55-14Z
slug: src-components-layout-appshell-tsx
---
# Critique — Noa PWA (chat.koai360.com), foco escritorio — 2026-09-22 (S332)

Method: dual-agent (A: design review · B: detector + evidencia de capturas de producción 1440/1920/430).

## Design Health Score — 23/40 (Aceptable)
| # | Heurística | Score | Key issue |
|---|---|---|---|
| 1 | Visibilidad del estado | 3 | sin indicador persistente de ubicación |
| 2 | Match mundo real | 3 | jargon interno ("sin_dato") |
| 3 | Control y libertad | 3 | el sidebar expandido no se puede anclar |
| 4 | Consistencia | 2 | `window.confirm/prompt` vs chips inline |
| 5 | Prevención de errores | 3 | — |
| 6 | Reconocimiento | 2 | nav primaria oculta en el rail de 60 px |
| 7 | Flexibilidad/eficiencia | 1 | cero atajos de teclado |
| 8 | Estética minimalista | 2 | vacío no intencional 65-90 % en escritorio |
| 9 | Recuperación de errores | 3 | patrón error+Reintentar consistente |
| 10 | Ayuda | 1 | tab "Conocimiento" es un stub |

## Especificidad
Conversación y Bandeja: autoradas para Noa/KOAI. Layout de escritorio: genérico, "teléfono estirado".
Detector: 0 hallazgos en 49 .tsx. Responsive: md 31 · sm 6 · lg 2 · xl 1 · 2xl 0; sin @media min-width; 0 clamp().

## Priority Issues
- [P1] Lienzo de escritorio 60-90 % vacío sin motivo (Chat ~90 %, Bandeja 65 %, Historial 74→81 %, Config 85→90 %) → /impeccable adapt
- [P1] Navegación primaria invisible por defecto en escritorio (rail 60 px sólo ☰/✎/avatar) → /impeccable layout
- [P2] Dos patrones de confirmación para la misma acción (nativo vs inline) → /impeccable harden
- [P2] Cero afordancias de teclado (⌘K, ⌘N, foco) → /impeccable overdrive
- [P2] Settings: 8 tabs planos + stub "Conocimiento" → /impeccable clarify
- [P3] Historial busca sólo por título (565 conversaciones) → /impeccable optimize

## Personas
Alex/Jesús: sin atajos; overlay se colapsa en cada navegación; 5 recientes visibles de 565; sin bulk en Historial.
Sasha: Bandeja exige abrir el menú primero; sin camino de 1 paso; vocabulario de etapas de ventas.

## Menores
`ChatEmpty.tsx:146` hex `#C8DD4A` en vez de token · badge de Bandeja invisible en el rail · aurora del fondo subutilizada · toasts + inline + alert conviven.

## Preguntas
¿El gutter derecho debe ser panel de contexto o aire? ¿Sidebar expandido por defecto en ≥1440? ¿Modo "Bandeja rápida" de 1 paso para Sasha?
