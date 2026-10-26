/** Layout follows the supplied TINA-TI editor screenshot; names match its commands.
 * A null action keeps a visible, grey slot until the corresponding operation exists. */
export const editorToolbar:[string,string|null][]=[
 ['Открыть...','open'],['Open from the Web...',null],['Сохранить','save'],['Печать...','print-preview'],
 ['Копировать','copy'],['Вставить','paste'],['|',null],['Выбор','select'],['Провод','wire'],
 ['Свойства','properties'],['Текст','text'],['Спрятать/Соединить','junction'],['|',null],['Удалить','delete'],
 ['Отменить','undo'],['Повторить','redo'],['|',null],['Поворот налево','rotate'],['Поворот направо','rotate-right'],['Зеркало','mirror'],['|',null],['Сетка','grid'],['Масштаб рамкой','zoom-window'],
];
