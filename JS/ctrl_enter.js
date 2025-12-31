import $ from './jquery';
import Spaces from './spacesLib';
import {set_caret_pos, get_caret_pos} from './utils';

function form_submit(el) {
	el.parents('form')
		.find('#cfms, #mainSubmitForm, [name*="cfms"], .js-form_submit, .js-search__submit')
		.each(function () {
			var btn = $(this);
			if (!btn.attr("disabled") && btn.isVisible()) {
				btn.click();
				return false;
			}
		});
}

$(document).on('keypress', 'input', function (e) {
	var el = this;
	if (el.type == 'text' && (e.keyCode == 13 || e.keyCode == 10) && !e.isDefaultPrevented()) {
		e.preventDefault();
		form_submit($(el));
	}
}).on('keypress', '.form_submit', function (e) {
	if ((e.keyCode == 13 || e.keyCode == 10) && ((!e.ctrlKey && Spaces.params.form_submit_key == 'ENTER') || (e.ctrlKey && Spaces.params.form_submit_key == 'CTRL_ENTER'))) {
		e.stopPropagation();
		e.preventDefault();
		e.stopImmediatePropagation();
		
		var el = $(this);
		el.trigger('hotkey_form_submit');
		form_submit(el);
	}
	
	if (e.ctrlKey && Spaces.params.form_submit_key == 'ENTER' && (e.keyCode == 13 || e.keyCode == 10)) {
		var pos = get_caret_pos(this);
		if (document.selection) {
			this.focus();
			document.selection.createRange().text = "\r\n";
		} else if (this.selectionStart !== undefined) {
			this.value = this.value.substr(0, this.selectionStart) + "\r\n" + 
				this.value.substr(this.selectionStart + (this.selectionEnd - this.selectionStart));
		} else {
			this.value += "\r\n";
		}
		set_caret_pos(this, pos + 1, pos + 1);
	}
});
