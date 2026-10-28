# Документация и технические отчёты

Начинайте с [актуального статуса](STATUS.md): в нём сведены проверенные границы готовности и отличие локального дерева от исходников HostedTina. Он не утверждает, что публичный сайт был проверен.

## Отчёты по темам

Все перечисленные ниже файлы в `reports/` сохранены на прежних местах. Датированные заметки фиксируют отдельное исследование или приёмку на дату заголовка; они не являются текущей общей оценкой готовности.

| Тема | Документы | Как читать |
|---|---|---|
| Меню, палитра и готовность | [site-readiness-2026-10-28.md](../reports/site-readiness-2026-10-28.md), [native-ui-catalog-2026-10-25.md](../reports/native-ui-catalog-2026-10-25.md), [TINA9_menu_resources.md](../reports/TINA9_menu_resources.md), [native_component_inference.md](../reports/native_component_inference.md), [component-families.md](../reports/component-families.md) | Инвентаризация и исследовательские материалы. Актуальный сводный вывод — только в `STATUS.md`; каталог не доказывает поддержку расчётов. |
| Движок и расчёты | [Проверка_расчетного_движка.md](../reports/Проверка_расчетного_движка.md), [laboratory-progress.md](../reports/laboratory-progress.md), [graphical-method-2026-10-28.md](../reports/graphical-method-2026-10-28.md), [runtime-parity-2026-10-23.md](../reports/runtime-parity-2026-10-23.md), [results-screen-only-2026-10-24.md](../reports/results-screen-only-2026-10-24.md) | Отдельные схемы, сравнения и состояние исследованных лабораторных. Не экстраполировать численную проверку на другие схемы. |
| Совместимость и перенос | [TINA9_compatibility_matrix.md](../reports/TINA9_compatibility_matrix.md), [browser-port-2026-10-24.md](../reports/browser-port-2026-10-24.md), [port-progress-2026-10-24.md](../reports/port-progress-2026-10-24.md), [generator-writeback-2026-10-23.md](../reports/generator-writeback-2026-10-23.md) | Матрицы и отчёты по конкретным этапам. Внутренние отметки и версии являются историческими, если их явно не перепроверили для текущей сборки. |
| Редактор и документы | [editor-v08-2026-10-24.md](../reports/editor-v08-2026-10-24.md), [editor-workflow-2026-10-24.md](../reports/editor-workflow-2026-10-24.md), [editor-documents-pages-2026-10-24.md](../reports/editor-documents-pages-2026-10-24.md), [editor-properties-2026-10-24.md](../reports/editor-properties-2026-10-24.md), [editor-integrity-2026-10-24.md](../reports/editor-integrity-2026-10-24.md), [editor-export-2026-10-24.md](../reports/editor-export-2026-10-24.md), [editor-groups-general-2026-10-24.md](../reports/editor-groups-general-2026-10-24.md) | Исторические срезы интерфейса и отдельных операций; перечень доказательств ограничен описанными сценариями. |
| Проводники и геометрия | [wires-2026-10-24.md](../reports/wires-2026-10-24.md), [wire-draft-implementation-2026-10-24.md](../reports/wire-draft-implementation-2026-10-24.md), [wire-draft-oracle-2026-10-24.md](../reports/wire-draft-oracle-2026-10-24.md), [junction-native-oracle-2026-10-24.md](../reports/junction-native-oracle-2026-10-24.md), [junction-toggle-2026-10-24.md](../reports/junction-toggle-2026-10-24.md), [group-rotation-2026-10-24.md](../reports/group-rotation-2026-10-24.md) | Частные реализации и наблюдения нативного приложения; не общий сертификат редактора проводов. |
| Семейства компонентов | `legacy-passive-*`, `diode-variant-native-acceptance-*`, `family-stage-native-acceptance-*`, `native-connector-family-*`, `native-led-profile-*`, `macro-*`, `property-grids-*`, `symbol-shapes-*` в `reports/` | Датированные приёмки, профили и исследовательские заметки для отдельных семейств. Они не означают, что весь каталог поддержан. |
| Исходники и рабочая среда | [workspace-recovery.md](../reports/workspace-recovery.md), [original-runtime-attempt.md](../reports/original-runtime-attempt.md) и [PORTING_WORKFLOW.md](../PORTING_WORKFLOW.md) | Восстановление среды, попытки и рабочий процесс. Не статус готовности функций. |

## Архив чек-листа

[PORTING_CHECKLIST.md](archive/PORTING_CHECKLIST-2026-10-24.md) — полная неизменённая копия документа от 24.10.2026. Его пункты отражают старый план и старые отметки; для текущего статуса используйте `STATUS.md`.

## Сырые материалы

Остальные файлы `reports/` — изображения, логи, JSON-дампы и другие доказательства. Они оставлены на прежних путях, чтобы не ломать ссылки и происхождение материалов. Смотрите на них как на свидетельства конкретных прогонов, а не как на самостоятельную оценку текущей версии.
