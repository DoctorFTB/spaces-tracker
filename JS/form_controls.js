import module from 'module';
import $ from './jquery';
import Device from './device';
import {Spaces, Codes} from './spacesLib';
import DdMenu from './dd_menu';
import './form_tools';
import {L} from './utils';

var $body = $('body');

$body.on('click', '.js-check_all', function (e) {
	var el = $(this);
	e.preventDefault();

	var global_trigger = !el.data('global_trigger');
	$('#' + el.data('parent')).find('.js-checkbox').each(function () {
		var chb = $(this);
		if (chb.hasClass('form-checkbox_checked') != global_trigger)
			chb.click();
	});

	el.text(!global_trigger ? L('Отметить все') : L('Снять все'))
		.data('global_trigger', global_trigger);
});

$body.on('click', '.js-input_suggestion', function (e) {
	e.preventDefault();
	$(this).parents('.text-input__wrap').find('.text-input').val(this.dataset.value);
})
.on('focus blur', '.js-input_with_suffix', function (e) {
	$(this).parent().find('.js-input_suffix').toggleClass('hide', e.type == 'focus' || e.type == 'focusin');
}).on('focus blur', '.text-input-wrapper_inline', function (e) {
	if (e.target && ((e.target.nodeName == 'INPUT' && e.target.type == 'submit') || e.target.nodeName == 'BUTTON'))
		return;

	$(this).toggleClass('focus', e.type == 'focus' || e.type == 'focusin');
}).on('click', '.js-checkbox', function(e) {
	if (e.target && ($(e.target).parents('a').length || e.target.nodeName == 'A')) // нажали на ссылку
		return;

	e.preventDefault();
	e.stopPropagation();

	var el = $(this),
	chb = el.find('input[type=checkbox]').get(0);

	if ($(chb).attr("disabled"))
		return;

	let last_value = chb.checked;
	chb.checked = !el.hasClass('form-checkbox_checked');

	var evt = $.Event('change');
	$(chb).trigger(evt);
	if (evt.isDefaultPrevented()) {
		chb.checked = last_value;
		return;
	}

	el.toggleClass('form-checkbox_checked');

	if (el.data('chb_group')){
		var groupChecked = chb.checked;

		$('#'+el.data('chb_group')).find('.js-checkbox').each(function(){
			var el = $(this),
				chb = el.find('input[type=checkbox]').get(0);
			el.toggleClass('form-checkbox_checked', groupChecked);
		});
	}

	$(chb).trigger($.Event('changed'));
});

$body.on('change', '.js-select', function() {
	var el = $(this),
		selected = el.find('option').filter(function () {
			return this.selected;
		}),
		value = selected.text(),
		parent = el.parent();

	if (selected.hasClass('select_default')) {
		parent.addClass('select_custom_noactive');
		value = el.data('default');
	} else {
		parent.removeClass('select_custom_noactive');
	}

	el.parent().find('.select__label').text(value);
	Spaces.view.setInputError(el, false);
});

$body.on('click', '.js-radio', function(e) {
	// e.preventDefault();
	// e.stopPropagation();

	var el = $(this),
		chb = el.find('input[type=radio]'),
		radioName = chb.attr('name'),
		label_id = el.data('label_id'),
		noclose = el.data('noclose'),
		change_ico = el.data('change_ico'),
		checked_class = el.data('checked_class') || 'form-checkbox_checked';

	chb.get(0).checked = true;
	chb.trigger('change');

	$('.js-radio-' + radioName).each(function () {
		var radio = $(this);
		radio.removeClass(radio.data('checked_class') || 'form-checkbox_checked');
	});
	el.addClass(checked_class);

	// смена иконки (на иконку того элемента по которому кликнули)
	if (change_ico) {
		$('#'+change_ico).get(0).className = el.find('[data-icon]').data('icon');
	} else {

		/*
		var ,
			icoClassName = ico.data('current_ico') || ico.prop("className");
		console.log(ico);
		$('#'+change_ico).get(0).className = 'ico ' +icoClassName;
		*/
	}

	// смена текста (на текст элемента по которому кликнули)
	if (label_id && (noclose != 1)) {
		var label = $('#label_' + radioName),
			label_ico = label.find('.js-ico'),
			label_text = label.find('.js-text');

		if (label_text.length || label_ico.length) {
			label_text.html(el.find('.js-text').html());
			label_ico.prop("className", el.find('.js-ico').prop("className"));
			console.log('label_ico', label_ico);
		} else {
			$('#'+label_id+ ' .drop-down-label_text').text(el.text());
		}

		$body.trigger('click');
	}
});

$body.on('click', '.js-toggle', function(e){
	e.preventDefault();
	e.stopPropagation();

	var el = $(this),
		infoMess = el.data('mess_id'),
		parent = el.parents('.label-toggle');

	if (parent.data('disabled'))
		return;

	if (el.hasClass('form-toggle__wrap_off')) {
		el.find('label.form-toggle-1 input').get(0).checked = true;
		parent.addClass('label-toggle_on');

		if (infoMess)
			$('#'+infoMess).hide();
	 } else {
		el.find('label.form-toggle-0 input').get(0).checked = true;
		parent.removeClass('label-toggle_on');

		if (infoMess)
			$('#'+infoMess).show();
	}

	el.toggleClass('form-toggle__wrap_off');

});

$body.on('click', '.js-horiz_mode', function(e){
	e.preventDefault();
	e.stopPropagation();

	const el = $(this);
	const chb = el.find('input[type=radio]');
	const radioName = chb.attr('name');
	const wrap = el.parents('.js-input_error_wrap');

	chb.trigger('change');

	chb.get(0).checked = true;

	const descriptionBlock = wrap.find('.js-input_description');
	descriptionBlock
		.html(chb.data("description") ?? "")
		.toggleClass('hide', !chb.data("description"));

	// Сбрасываем ошибку
	wrap.removeClass('error__item')
		.find('.js-input_error').addClass('hide');

	$('.js-horiz_mode-'+radioName).removeClass('clicked');
	el.addClass('clicked');
});

var SWITCHER_GENERIC_TYPES = {
	dating: {
		method: "anketa.datingEdit",
		data: {CK: null},
		param: "Dating",
		onResult: function (res, state) {
			if (res.premod && res.code == Codes.COMMON.ERR_UNKNOWN_ERROR)
				res.code = 0;
		}
	},
	ghost: {
		method: "services.switchGhost",
		data: {CK: null},
		param: "On",
		updateState: function (state) {
			var $btn = $('.js-switcher_ghost');
			$btn.toggleClass('on', !state).html(!state ? $btn.data('value_on') : $btn.data('value_off'));
			DdMenu.close();
		},
		onResult: function (res, state) {
			if (res.code == Codes.SERVICES.ERR_GHOST_UNCHANGED)
				res.code = 0;
		}
	}
};
$body.on('click', '.js-switcher', function (e) {
	e.preventDefault(); e.stopPropagation();

	var el = $(this),
		switcher = el.find('.form-toggle__wrap'),
		data = el.data(),
		spinner = $('#' + data.spinner),
		state = 'state' in data ? !data.state : !el.hasClass(data.mode == 'light' ? 'on' : 'label-toggle_on'),
		last_state = !state;

	if (data.disabled || data.busy)
		return;

	var messages = {};
	$.each(data, function (k, v) {
		if (k.indexOf('msg_') == 0)
			messages[k.replace(/^msg_/, '')] = $('#' + v);
	});

	var show_msg = function (k, text) {
		$.each(messages, function () {
			this.hide();
		});
		if (!messages[k])
			k = state ? 'enabled' : 'disabled';
		var msg = messages[k];
		if (msg) {
			if (text)
				msg.html(text);
			msg.show();
		}
		el.toggleClass('js-has_mess', !!(msg && msg.length));
	};
	var show_error = function (error) {
		if (data.mode != 'light')
			show_msg(error ? 'failed' : false, error);
	};
	var api = {
		showMessage: show_msg,
		showError: show_error
	};

	var meta;
	if (data.type) {
		meta = SWITCHER_GENERIC_TYPES[data.type];
	} else if (data.apiMethod) {
		meta = {
			method: data.apiMethod,
			data: data.apiData,
			param: data.param
		};
	}
	var update_state = function (flag) {
		state = flag;
		data.state = flag;

		if (data.mode == 'light') {
			el.html(state ? data.value_on : data.value_off);
			el.toggleClass('on', !!state);
		} else {
			el.toggleClass('label-toggle_on', state);
			switcher.toggleClass('form-toggle__wrap_off', !state);
			show_error(false);
		}

		if (state && data.urlOff) {
			el.prop("href", data.urlOff);
		} else if (!state && data.urlOn) {
			el.prop("href", data.urlOn);
		}

		el.find('.js-switcher_on').toggleClass('hide', !state);
		el.find('.js-switcher_off').toggleClass('hide', state);

		if (meta && meta.updateState)
			meta.updateState.call(api, flag);
	};

	if (meta) {
		var api_data = $.extend({}, meta.data);
		api_data[meta.param] = meta.invert ? !state : !!state;

		var set_busy = function (flag) {
			data.busy = flag;
			spinner.toggleClass('hide', !flag);
		};

		update_state(state);
		set_busy(true);
		Spaces.api(meta.method, api_data, function (res) {
			set_busy(false);
			meta.onResult && meta.onResult.call(api, res, !!state);
			if (res.code != 0) {
				update_state(last_state);
				if (messages.failed) {
					show_error(Spaces.apiError(res));
				} else {
					Spaces.showApiError(res);
				}
			} else {
				meta.callback && meta.callback();
			}
		}, {
			onError: function (error) {
				set_busy(false);
				show_error(error);
				spinner.addClass('hide');
			}
		});
	} else {
		update_state(state);
	}
}).on('click', '.js-addremove', function (e) {
	var el = $(this),
		input = el.find('input')[0],
		state = !el.hasClass('form-checkbox_checked');
	var evt = new $.Event('addremove');
	el.trigger(evt, {
		state: state,
		name: input.name,
		value: input.value
	});
	if (evt.isDefaultPrevented()) {
		e.preventDefault();
		e.stopPropagation();
		el.toggleClass('form-checkbox_checked', state);
		el.data('checked', state);
	}
});

$body.on('change', '.js-years_selector', function(e){
	var el = $(this),
	types = {
		CAREER: 4,
		SCHOOLS: 1,
		SERVICE: 3,
		SITES: 6,
		UNIVERSITIES:2
	},
	fromValue = '',
	toValue = '';

	if (el.hasClass('js-year_from')){
	fromValue = el.val();
	toValue = el.parent().find('.js-year_to').val();
	} else {
	fromValue = el.parent().find('.js-year_from').val();
	toValue = el.val();
	}

	if (fromValue && toValue){
	if (toValue > 0 && fromValue > 0 && fromValue > toValue){
		var type = el.data('type'),
		text = '';

		if (type == types.CAREER){
		text = L('Год окончания работы не может быть меньше года начала');
		} else if (type == types.SCHOOLS){
		text = L('Год окончания обучения не может быть меньше года начала');
		} else if (type == types.SERVICE){
		text = L('Год окончания службы не может быть меньше года начала');
		} else if (type == types.UNIVERSITIES){
		text = L('Год окончания обучения не может быть меньше года начала');
		}

		Spaces.showError(text);
	}
	}
});


$body.on('click', '.js-submit-btn', function(e){
	var el = $(this),
	ico = el.find('.ico').get(0).className = 'ico ico_spinner';

	el.addClass('clicked');
}).on('click', '.js-reset_value', function (e) {
	e.preventDefault(); e.stopPropagation();

	$(this).visible(false);

	var parent = $(this).parents('.js-parent');
	resetForm(parent);

//	parent.trigger('resetValues');
});

$body.on('focus', '.js-text-input', function(e){
	$(this).parent().addClass('input_focused');
}).on('blur', '.js-text-input', function(e){
	$(this).parent().removeClass('input_focused');
});

var get_all_radios = function (el) {
	var inputs = el.find('.js-radio'), inputs_group = {};
	for (var i = 0; i < inputs.length; ++i) {
		var id = inputs[i].getAttribute('data-label_id');
		if (!inputs_group[id])
			inputs_group[id] = [];
		inputs_group[id].push(inputs[i]);
	}
	return inputs_group;
};

function resetForm(parent) {
	parent.find('select, input[type="text"]').val('').trigger('resetValues');

	var selectors = parent.find('.js-objsel');
	selectors.each(function () {
		$(this).objectSelector().reset();
	});

	// Сброс гео селекторов
	parent.find('.js-geosel').each(function () {
		$(this).geoSelector().reset();
	});

	// выбираем самый первый вариант при сборсе (костыль)
	var inputs_group = get_all_radios(parent);
	for (var k in inputs_group)
		$(inputs_group[k][0]).click();
};

/* жуткие костыли, пока не будет переписано вот что-то с нормальной архитектурой */
module.on("componentpage", function () {
	var mousedowned = false;

	// TODO: Адовые костыли!
	$('.ac-settings_inline_bottom_fix').each(function () {
		var el = $(this);
		el.removeClass('ac-settings_inline_bottom_fix');
		el.find('.text-input__wrap').append(el.find('.drop-down-list_inner'));
	});

	var check_is_filled = function (el, ignore_city) {
		var inputs_group = get_all_radios(el); // Получаем радио баттоны
		for (var k in inputs_group) {
			if (!$(inputs_group[k][0]).hasClass('form-checkbox_checked'))
				return true;
		}
		if (!ignore_city) {
			// Сброс гео селекторов
			var geo_filled = false;
			el.find('.js-geosel').each(function () {
				var selector = $(this).geoSelector();
				geo_filled = !selector.isEmpty();
				if (geo_filled)
					return false;
			});

			if (geo_filled)
				return true;
		}

		var inputs = el.find('input[type="text"]');
		for (var i = 0; i < inputs.length; ++i) {
			if (inputs[i].className.indexOf('js-geosel_input') < 0 && inputs[i].value !== '')
				return true;
		}
		return false;
	};

	$('#main').on('mousedown touchstart', function () {
		mousedowned = true;
	}).on('mouseup touchcancel touchend', function () {
		mousedowned = false;
	}).on('focus', '.text-input', function (e) {
		$(this).parents('.form__item').find('.js-acl').hide();
	}).on('blur', '.text-input', function (e) {
		var el = $(this), callback = function () {
			el.parents('.form__item').find('.js-acl').show();
		};
		if (mousedowned) {
			$('body').one('mouseup touchcancel touchend', callback);
		} else {
			setTimeout(callback, Device.type == "touch" ? 250 : 0);
		}
	}).on('focus blur change', '.js-parent select, .js-parent input, .js-parent textarea', function (e) {
		var parent = $(this).parents('.js-parent');
		setTimeout(function () {
			var el = parent.find('.js-reset_value');
			el.toggle(check_is_filled(parent, el.data('ignore_city')));
		}, 0);
	}).on('valuechanged', '.js-parent', function (e) {
		var parent = $(this);
		setTimeout(function () {
			var el = parent.find('.js-reset_value');
			el.toggle(check_is_filled(parent, el.data('ignore_city')));
		}, 0);
	});
});

export {resetForm};
