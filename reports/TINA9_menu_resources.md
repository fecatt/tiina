# Подменю TINA-TI 9 из собственной русской справки

Источник: `work/tina/DesignSoft/Tina 9 - TI/TINA.chm`, извлечён как архив CHM без запуска TINA и без разбора защищённого `tina.exe`. Получено 364 файла, включая русские HTML в Windows-1251. Отдельная справка компонентов `TCH.CHM` тоже извлечена: 406 файлов. Для извлечения использована портативная копия 7-Zip 23.01 из официального дистрибутива https://www.7-zip.org/download.html ; системная установка не выполнялась.

Важно: ниже точные тексты и порядок ссылок **справки**, а не непосредственно RT_MENU исходного приложения. Названия в справке могут отличаться от работающего меню и содержат опечатки. Наличие темы не доказывает, что функция доступна данной редакции TI: сравнивать с readme9.3.150 и живым интерфейсом. Самостоятельный пункт TI Utilities в этой справке не найден.

Машиночитаемый результат: `TINA9_menu_resources.json`; у каждой команды указан исходный HTML helpTopic и полное описание. Имена `IDH_*` — идентификаторы тем справки, их нельзя выдавать за численные ID команд Windows.

## File

Источник: `work\tina_ui_deep_help\TINA\IDH_File.htm`.

| № | Текст ссылки в справке | Тема |
|---|---|---|
| 1 | Новый | `IDH_New.htm` |
| 2 | Открыть | `IDH_Open.htm` |
| 3 | Сохранить | `IDH_Save.htm` |
| 4 | Сохранить как | `IDH_Save_As.htm` |
| 5 | Сохранить все | `IDH_Save_All.htm` |
| 6 | Закрыть | `IDH_Close.htm` |
| 7 | Закрыть все | `IDH_Close_All.htm` |
| 8 | Экспорт | `IDH_Export.htm` |
| 9 | Импорт | `IDH_Import.htm` |
| 10 | Список материалов | `IDH_File_Bill_of_Materials.htm` |
| 11 | Ввод макроса | `IDH_Enter_Macro.htm` |
| 12 | Настройка страницы | `IDH_Page_Setup.htm` |
| 13 | Предпросмотр печати | `IDH_Print_Preview.htm` |
| 14 | Печать | `IDH_Print.htm` |
| 15 | Выход | `IDH_Exit.htm` |

## Edit

Источник: `work\tina_ui_deep_help\TINA\IDH_Edit.htm`.

| № | Текст ссылки в справке | Тема |
|---|---|---|
| 1 | Отмена | `IDH_Undo.htm` |
| 2 | Вернуть | `IDH_Redo.htm` |
| 3 | Вырезать | `IDH_Cut.htm` |
| 4 | Копировать | `IDH_Copy.htm` |
| 5 | Вставить | `IDH_Paste.htm` |
| 6 | Удалить | `IDH_Clear.htm` |
| 7 | Выделить все | `IDH_Select_All.htm` |
| 8 | Поворот налево | `IDH_Rotate_Left.htm` |
| 9 | Поворот направо | `IDH_Rotate_Right.htm` |
| 10 | Зеркало | `IDH_Mirror.htm` |
| 11 | Свойства | `IDH_Edit_Attributes.htm` |
| 12 | Символ... | `IDH_Edit_Symbol.htm` |
| 13 | Скрыть/Соединить | `IDH_Hide_Reconnect.htm` |

## Insert

Источник: `work\tina_ui_deep_help\TINA\IDH_Insert.htm`.

| № | Текст ссылки в справке | Тема |
|---|---|---|
| 1 | Последний компонент | `IDH_Last_Component.htm` |
| 2 | Провод | `IDH_Wire.htm` |
| 3 | Ввод | `IDH_Input.htm` |
| 4 | Вывод | `IDH_Output.htm` |
| 5 | Текст | `IDH_Text.htm` |
| 6 | Графики... | `IDH_Graphics.htm` |
| 7 | Блок названия... | `IDH_Title_Block.htm` |
| 8 | Автофигуры | `IDH_Shape.htm` |
| 9 | Макроэлемент... | `IDH_Macro.htm` |
| 10 | Блок... | `IDH_Insert_Block.htm` |
| 11 | Автоповтор | `IDH_Auto_Repeat.htm` |
| 12 | Автопровод | `IDH_Auto_Wire.htm` |

## View

Источник: `work\tina_ui_deep_help\TINA\IDH_View.htm`.

| № | Текст ссылки в справке | Тема |
|---|---|---|
| 1 | Нормальный вид | `IDH_Normal_View.htm` |
| 2 | Макет страницы | `IDH_Page_Layout_View.htm` |
| 3 | Масштаб | `IDH_Zoom.htm` |
| 4 | Сетка | `IDH_Grid.htm` |
| 5 | Отметки выводов | `IDH_Pin_Markers.htm` |
| 6 | Значения | `IDH_Values.htm` |
| 7 | Элементы | `IDH_Units.htm` |
| 8 | Метки | `IDH_Labels.htm` |
| 9 | Номера блоков | `IDH_Package_Numbers.htm` |
| 10 | Обновить | `IDH_Redraw.htm` |
| 11 | Панель инструментов | `IDH_Tool_Bar.htm` |
| 12 | Панель компонентов | `IDH_Component_Bar.htm` |
| 13 | Опции | `IDH_Schematic_Editor_View_Options.htm` |

## Analysis

Источник: `work\tina_ui_deep_help\TINA\IDH_Analysis.htm`.

| № | Текст ссылки в справке | Тема |
|---|---|---|
| 1 | ERC... | `IDH_Analysis_ERC.htm` |
| 2 | Режим | `IDH_Mode.htm` |
| 3 | Control Object | `IDH_Control_Object.htm` |
| 4 | Установиьт параметры анализа | `IDH_Set_Parameters.htm` |
| 5 | Анализ постоянного тока | `IDH_DC_Analysis.htm` |
| 6 | Анализ переменного тока | `IDH_AC_Analysis.htm` |
| 7 | Анализ переходных процессов | `IDH_Transient_Analysis.htm` |
| 8 | Анализ Фурье | `IDH_Fourier_Analysis.htm` |
| 9 | Анализ шума | `IDH_Noise_analysis.htm` |
| 10 | Опции | `IDH_Option_Analysis.htm` |

## DC_Analysis

Источник: `work\tina_ui_deep_help\TINA\IDH_DC_Analysis.htm`.

| № | Текст ссылки в справке | Тема |
|---|---|---|
| 1 | Расчитать узловые напряжения | `IDH_Calculate_Nodal_Voltages.htm` |
| 2 | Таблица результатов DC | `IDH_DC_Table.htm` |
| 3 | Передаточная характеристика | `IDH_Transfer_Characteristic.htm` |
| 4 | Температурный анализ | `IDH_Temperature_Analysis.htm` |

## AC_Analysis

Источник: `work\tina_ui_deep_help\TINA\IDH_AC_Analysis.htm`.

| № | Текст ссылки в справке | Тема |
|---|---|---|
| 1 | Ответ на данной частоте | `IDH_Response_at_a_given_frequency.htm` |
| 2 | Таблица результатов Переменного Тока | `IDH_AC_Table.htm` |
| 3 | Передаточная характеристика Переменного Тока | `IDH_AC_Transfer.htm` |

## TM

Источник: `work\tina_ui_deep_help\TINA\IDH_TM.htm`.

| № | Текст ссылки в справке | Тема |
|---|---|---|
| 1 | Генератор функций | `../FUNCGEN/IDH_Function_generator.htm` |
| 2 | Мультиметр | `../DMM/IDH_Multimeter.htm` |
| 3 | Записывающее устройство | `../XYRECORD/IDH_XYRecorder.htm` |
| 4 | Осциллограф> | `../SCOPE/IDH_Oscilloscope.htm` |
| 5 | Анализатор сигналов | `../SIGANAL/IDH_Signal_Analyzer.htm` |

## Tools

Источник: `work\tina_ui_deep_help\TINA\IDH_Tools.htm`.

| № | Текст ссылки в справке | Тема |
|---|---|---|
| 1 | Окно диаграммы | `../DRAWWIND/IDH_The_Diagram_Window.htm` |
| 2 | Редактор списка соединений | `../NETEDHLP/IDH_Netlist_Editor.htm` |
| 3 | Найти компонент | `IDH_Tools_Find_Component.htm` |
| 4 | Прочитать базу компонентов | `IDH_Tools_Reread_symbol_database.htm` |
| 5 | Перекомпилировать библиотеку | `IDH_Tools_Recompile_Library.htm` |
| 6 | Пересобрать библиотеку | `IDH_Tools_Rebuild_Library.htm` |
| 7 | Мастер новых макросов... | `IDH_New_Macro_Wizard.htm` |
| 8 | Редактор свойств макроса... | `IDH_Edit_Macro_Properties.htm` |
| 9 | Экспортировать макрос... | `IDH_Export_Macro.htm` |
| 10 | Заблокировать редактор схем | `IDH_Tools_Lock_Schematic_Editor.htm` |
| 11 | Закрепить редактор соединений | `IDH_Tools_Dock_Netlist_Editor.htm` |

## Help

Источник: `work\tina_ui_deep_help\TINA\IDH_Help.htm`.

| № | Текст ссылки в справке | Тема |
|---|---|---|
| 1 | Содержание | `IDH_Help_Contents.htm` |
| 2 | Справка по компонентам | `IDH_Component_Help.htm` |
| 3 | Check for updates | `IDH_Help_Check_for_updates.htm` |
| 4 | Upgrade | `IDH_Help_Upgrade.htm` |
| 5 | DesignSoft в интернете | `IDH_DesignSoft_on_the_Web.htm` |
| 6 | О программе | `IDH_About.htm` |

В теле HTML между Upgrade и DesignSoft в интернете дополнительно написано «Обучение», но ссылки на тему у этого слова нет; JSON выше перечисляет именно ссылки.

## Отдельные ресурсы DLL

`tinaintf.dll` — PE-модуль с OriginalFilename `MeasIntf.dll`, FileDescription `TINALab II Interface DLL`, FileVersion 1.1.3.0, ProductVersion 1.4.0.0. Его ресурсы извлечены как данные; код DLL не запускался. Это не ресурсная DLL главного русского меню редактора.

В `.rsrc/0/` найдены CURSOR, BITMAP, STRING, RCDATA, GROUP_CURSOR. RT_MENU и RT_DIALOG в этом модуле не найдены. Все строки RT_STRING разобраны по стандартному формату: 16 UTF-16LE строк в блоке; stringId = (blockId−1)×16 + позиция. Полный результат: `work/tina_ui_deep_resource_strings.json`.

Примеры проверяемых ресурсов: RT_STRING ID2090 «Open Tina diagram»; ID2091 «Save Tina diagram»; ID416 «Multiple Analysis - Range Setting»; ID588 «DC absolute current error [A]»; ID589 «DC absolute base-current error [A]»; ID590 «DC absolute voltage error [V]». Это английские служебные подписи/ошибки, не источник русской иерархии меню.

У `Roboex32.dll` в списке ресурсов есть MENU128 и DIALOG30721, но это вспомогательный RoboHelp-модуль; их нельзя использовать как меню главного редактора TINA. Файлы `3D Viewer.str` бинарные, не текстовый русский словарь. Отдельные `AnaComps.dll`, на которые ссылается реестр компонентов, в исследованной папке не найдены. Не предпринимать разбор защищённого EXE, чтобы заполнить эти пробелы.

## Подтверждённые уточнения к прежней матрице

- «Вставить» используется для специальных объектов, основные компоненты размещаются через панель компонентов. Добавленные в прототип меню «Вставить → Резистор» и подобные не повторяют исходную структуру.
- «Вид» имеет отдельные переключатели значений, единиц/элементов, меток и номеров блоков. Точный runtime-перевод «Элементы» и «Номера блоков» требует визуальной сверки.
- «Анализ» имеет DC и AC подменю, темы Fourier и Noise присутствуют в TI-справке; это не основания включать excluded full-TINA symbolic/digital/RF функции.
- Окно диаграмм имеет собственное меню File/Edit/View/Help, отдельные темы курсоров, осей, графиков и postprocessor; простая вкладка общего SVG не воспроизводит все эти действия.
- T&M имеет документированный список пяти инструментов, но возможная связь с реальным аппаратным TINALab и доступность конкретных функций требуют отдельной проверки.
- TI Utilities остаётся подтверждённым только заголовком на снимке и ссылками TI Design Center/FAQ/Sample part request из readme; порядок и русские captions его пунктов не восстановлены.
