import module from 'module';
import $ from './jquery';
import Device from './device';
import Spaces from './spacesLib';
import page_loader from './ajaxify';
import DdMenu from './dd_menu';
import {L, numeral, set_caret_pos, html_wrap} from './utils';

var AUTOSAVE_INTERVAL = 2000,
	TEXTAREA_SIZE = {
		MAX: 6,
		MIN: 3
	};


var in_text_area = false,
	last_text_save,
	last_submit_called = 0;
var FormToolsModule = {
	init: function () {
		in_text_area = false;
		var self = this,
			text_save_idle,
			$main = $('body'),
			$window = $(window);
		$main
			.on('click', 'select', function (e) {
				var el = $(this);
				Spaces.view.setInputError(el, false);
			})
			.on('focus', 'textarea, input[type="text"], input[type="password"]', function (e) {
				var el = $(this);
				in_text_area = true;
				if (!el.data('saveError'))
					Spaces.view.setInputError(el, false);
				self.saveTextareaText(el);
				last_text_save = Date.now();
				
				if (el.data('copy')) {
					this.focus && this.focus();
					this.select && this.select();
				}
			})
			.on('blur', 'textarea, input[type="text"]', function (e) {
				var el = $(this);
				in_text_area = false;
				// Spaces.view.setInputError(el, false);
				self.saveTextareaText(el);
				if (text_save_idle)
					clearTimeout(text_save_idle);
			})
			.on('click', '.js-temp_text', function (e) {
				e.preventDefault();
				var el = $(this),
					textarea = el.parents().find('textarea').first(),
					text_id = textarea.data('text_id') + ":" + SPACES_PARAMS.nid,
					tmp_ls_key = 'saved_text:' + text_id + ':tmp';
				if (el.data('action') != 'delete')
					textarea.val(Spaces.LocalStorage.get(tmp_ls_key));
				Spaces.LocalStorage.remove(tmp_ls_key);
				self.saveTextareaText(textarea);
				el.parents('.js-temp_text_parent').remove();
			})
			// Валидация формы
			.on('submit', 'form', function (e) {
				var form = $(this),
					btn = Spaces.view.getFormSubmitter(form),
					ret = self.checkForm(form);
				
				if (ret !== false && btn && (btn.attr("name") == 'cfms')) {
					var to_delete = form.find('textarea');
					page_loader.one('shutdown', function () {
						to_delete.each(function () {
							// Удаляем сохранённый текст
							self.saveTextareaText($(this), true);
						});
					});
				}
				return ret;
			});
		
		var toggle_password = function (el, state) {
			var input = el.parent().find('input[type="password"], input[type="text"]');
			input.prop("type", state ? 'text' : 'password');
			el.data('showPasword', state)
				.prop("title", state ? L("Спрятать пароль") : L("Показать пароль"))
				.toggleClass("disabled", !state);
		};
		
		if (Device.type == 'desktop') {
			$main.on('mousedown', '.js-input_show_password', function (e) {
				var el = $(this);
				toggle_password(el, true);
				$('body').on('mouseup.oneRequest', function () {
					toggle_password(el, false);
				});
			});
		} else {
			$main.on('click', '.js-input_show_password', function (e) {
				e.preventDefault();
				var el = $(this);
				toggle_password(el, !el.data('showPasword'));
			});
		}
		
		module.on("componentpage", function () {
			in_text_area = false;
			$main.find('form.js-no_enter_submit').on('keypress', 'input[type="text"]', function (e) {
				if (e.keyCode == Spaces.KEYS.ENTER || e.keyCode == Spaces.KEYS.MAC_ENTER)
					e.preventDefault();
			});
		});

		var validate_timeout;
		var password_validator = function (self) {
			var input = $(self),
				error = false, v;

			if (input.data('twice')) {
				var parent = input.parents('.js-input_error_wrap').first();
				input = parent.find('input[type="password"]');

				if (input[0].value.length && input[1].value.length && input[0].value != input[1].value)
					error = L("Пароли не совпадают.");

				v = input[0].value;
			} else {
				v = input.val();
			}

			if (v.match(/[ а-я]/i) && input.data('new')) {
				error = L("В пароле допускаются только латинские буквы, цифры, дефисы и символ подчёркивания.");
			} else if (v.length > input.data("maxlength")) {
				error = L("Пароль слишком длинный. Максимальная длина пароля - {0}.",
					numeral(input.data("maxlength"), [L('$n символ'), L('$n символа'), L('$n символов')]));
			}

			Spaces.view.setInputError(input.data('saveError', !!error), error);
			validate_timeout = false;
		};

		// Валидация password
		$main.on('input keypress paste change blur', 'input[type="password"]', function (e) {
			var self = this;
			if (!validate_timeout) {
				validate_timeout = setTimeout(function () {
					password_validator(self);
				}, 50);
			}
		});

		$main.on('input keypress paste change', 'textarea, input[type="text"]', (e) => {
			let $el = $(e.target);
			if (Date.now() - last_text_save > AUTOSAVE_INTERVAL || !in_text_area) {
				self.saveTextareaText($el, false, true);

				if (in_text_area) {
					if (text_save_idle)
						clearTimeout(text_save_idle);
					text_save_idle = setTimeout(function () {
						text_save_idle = false;
						self.saveTextareaText($el);
					}, AUTOSAVE_INTERVAL + 100);
				}
				last_text_save = Date.now();
			}
		});
		
		if (Device.type == 'desktop') {
			var last_keydown;
			var onkey_handler = function (e, manual_insert) {
				var key = e.which || e.keyCode || e.charCode; // странный FF шлёт which вместо keyCode
				
				var input_active = (in_text_area || e.target.tagName == 'INPUT' || e.target.tagName == 'TEXTAREA'),
					current_focus = document.activeElement;
				
				if (current_focus && (current_focus.tagName == 'INPUT' || current_focus.tagName == 'TEXTAREA'))
					input_active = true;
				
				if (!input_active && (key > 40) && !e.ctrlKey && !e.metaKey && !(key > 165 && key < 184) && !(key >= 112 && key <= 123)) {
					var autofocus = $('.js-autofocus');
					if (autofocus.length) {
						var scroll = $(window).scrollTop(),
							wh = $(window).innerWidth(),
							y = autofocus.offset().top,
							h = autofocus.outerHeight();
						
						if ((y >= scroll && y <= scroll + wh) || (y + h >= scroll && y + h <= scroll + wh)) {
							// Делаем автофокус только если поле ввода видно
							autofocus.focus();
							
							// Закроем меню, если наше поле не находится в этом меню
							var cmenu = DdMenu.current();
							if (cmenu && !$.contains(cmenu, autofocus))
								DdMenu.close(cmenu.attr("id"));
							
							if (manual_insert === true) {
								var el = autofocus[0],
									chr = String.fromCharCode(key);
								if (el.selectionStart !== undefined) {
									var pos = el.selectionStart;
									el.value = el.value.substr(0, pos) + chr + 
										el.value.substr(pos + (el.selectionEnd - pos));
									set_caret_pos(el, pos + 1, pos + 1);
								} else {
									el.value += chr;
								}
							}
						}
					}
				}
				last_keydown = key;
			};
			$(document).on('keydown', onkey_handler);
			
			// https://bugzilla.mozilla.org/show_bug.cgi?id=1036008
			if (Device.browser.name == 'firefox') {
				$(document).on('keypress', function (e) {
					var key = e.which || e.keyCode || e.charCode;
					if (!last_keydown && key)
						onkey_handler(e, true);
				});
			}
		}
	},
	saveTextareaText: function (el, flag, is_typing) {
		var self = this,
			text_id = el.data('text_id');
		
		if (!flag && Date.now() - last_submit_called < 500)
			return;
		
		if (!flag && (el.data('disabled') || el.data('readonly')))
			return;
		
		el.trigger('text_save', {typing: !!is_typing});
		
		if (!text_id)
			return;
		
		text_id += ":" + SPACES_PARAMS.nid;
		
		var saved_texts;
		try {
			saved_texts = JSON.parse(Spaces.LocalStorage.get('saved_texts'));
		} catch (e) {
			saved_texts = {};
		}
		
		// Удаляем старые тексты из БД
		if (!(text_id in saved_texts) && !flag) {
			var texts = [];
			$.each(saved_texts, function (k, v) {
				texts.push([k, v]);
			});
			texts.sort(function (a, b) {
				return b[1] - a[1];
			});
			for (var i = 4; i < texts.length; ++i) {
				Spaces.LocalStorage.remove('saved_text:' + texts[i][0]);
				Spaces.LocalStorage.remove('saved_text:' + texts[i][0] + ':tmp');
				delete saved_texts[texts[i][0]];
			}
		}
		
		if (!flag && el[0].value.length) {
			saved_texts[text_id] = Date.now();
			Spaces.LocalStorage.set('saved_text:' + text_id, el[0].value);
		} else {
			Spaces.LocalStorage.remove('saved_text:' + text_id);
			Spaces.LocalStorage.remove('saved_text:' + text_id + ':tmp');
			delete saved_texts[text_id];
		}
		Spaces.LocalStorage.set('saved_texts', JSON.stringify(saved_texts));
	},
	checkForm: function (form) {
		var self = this, has_errors = 0,
			submit_btn = $(form.prop("submit_btn") || []);
		
		if (!(submit_btn.prop("name") == "cfms" || submit_btn.data("main_submit"))) {
			// Это не главный сабмит!
			return;
		}
		
		form.find('.text-input').each(function () {
			var el = $(this),
				maxlength = el.attr('maxlength') || el.data('maxlength'),
				required = el.attr('required') || el.data('required');
			
			if (!el.data('validate'))
				return;
			
			if (maxlength) {
				var current_len = el[0].value.length;
				if (current_len > maxlength) {
					Spaces.view.setInputError(el, L('Длина текста не должна превышать {0} (сейчас {1})',
						numeral(maxlength, [L('$n символ'), L('$n символа'), L('$n символов')]), numeral(current_len, [L('$n символ'), L('$n символа'), L('$n символов')])));
					++has_errors;
				}
			} else if (required && !$.trim(el[0].value).length) {
				Spaces.view.setInputError(el, L('Поле должно быть заполнено.'));
				++has_errors;
			} else {
				Spaces.view.setInputError(el, false);
			}
		});
		return !has_errors;
	}
};

FormToolsModule.init();
