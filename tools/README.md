# Инструменты разработки

Рабочий код сайта находится в `../src`. Здесь — отдельные воспроизводимые операции; старые датированные сценарии сохраняются для своих эталонов, а не считаются текущей проверкой всего сайта.

| Задача | Файлы |
|---|---|
| Извлечь локальные ресурсы оригинала | `extract_assets.py`, `extract_symbol_vectors.py`; порядок в `../NATIVE_ASSETS.md` |
| Подключить установленный локальный каталог BJT | `import-local-bjt-catalog.py`; результат не копировать в публичный Git-каталог |
| Инвентаризация семейств TSC | `catalog-families.ts`, `inspect-*`, `profile-macro-symbols.ts` |
| Подготовить нативные эталоны | `prepare-*-oracles.ts`, `prepare-oracle-cases.ts`, `create-*-oracle.ts`, `native-oracle.py` |
| Проверить сохранённые эталоны | `verify-*-oracles.ts`, связанные тесты в `../tests` |
| Проверить интерфейс | `check-*.mjs`; конкретные команды указаны в `../package.json` |
| Просмотреть символы и свойства | `review-native-symbols.mjs`, `review-property-grids.mjs`, `preview-interface.mjs` |
| Учебные сценарии | `run-homework-variants.mjs`, `capture-homework-native.py`, `import-native-methodology-graphs.py` |

Эксперименты одной сессии и их выводы складывать в `../work/<задача>/`, а доказательства завершённого изменения — в `../reports/` с датой и описанием ограничений. Не добавлять временные копии исходников в `src/`.
