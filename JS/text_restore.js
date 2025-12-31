import module from 'module';
import $ from './jquery';
import {hasClass, addClass, tick} from './utils';

var restore_called = false,
	CLASS_RESTORED = 'js-text_restored',
	LS_PREFIX = 'saved_text:';

function restore_texts() {
	restore_called = false;
	
	var textareas = document.getElementsByTagName('textarea');
	for (var i = 0, l = textareas.length; i < l; ++i) {
		var ta = textareas[i],
			text_id = ta.getAttribute('data-text_id');
		if (text_id && !hasClass(ta, CLASS_RESTORED)) {
			text_id += ":" + SPACES_PARAMS.nid;
			try {
				var text = localStorage.getItem(LS_PREFIX + text_id);
				if (typeof text == 'string') {
					if (ta.value.length > 0 && ta.value != text) { // Если в поле уже есть текст
						// Метим чтобы вывести подтверждение
						addClass(ta, 'js-has_saved_text');
						localStorage.setItem(LS_PREFIX + text_id + ':tmp', text);
					} else {
						// Иначе сразу восстанавливаем
						ta.value = text;
						ta.dispatchEvent(new Event('change', { bubbles: true }));
					}
					addClass(ta, CLASS_RESTORED);
				}
			} catch (e) { console.log(e); }
		}
	}
	
	tick(function () {
		$(window).trigger('text_restore');
	});
}

module.on("component", restore_texts);
