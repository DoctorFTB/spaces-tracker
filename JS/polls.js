import module from 'module';
import $ from './jquery';
import Device from './device';
import {Spaces, Url, Codes} from './spacesLib';
import page_loader from './ajaxify';
import {HistoryManager} from './ajaxify';
import DdMenu from './dd_menu';

import './form_tools';
import {tick, L, numeral} from './utils';

let form, params, poll_id, menu_opened, flag = false;

function init() {
	form = $('#polls_form');
	params = form.data();
	
	menu_opened = false;
	poll_id = form.find('[name="poll_id"]');
	
	form
	.on('keypress', 'input', function (e) {
		if (e.keyCode == Spaces.KEYS.ENTER || e.keyCode == Spaces.KEYS.MAC_ENTER) {
			e.stopPropagation();
			e.preventDefault();
		}
	})
	// Скрытие и показ кнопки при открытии или закрытии окна создания опроса
	.on('dd_menu_opened', '#polls_form_dd', function () {
		menu_opened = true;
		updateState();
	})
	.on('dd_menu_closed', '#polls_form_dd', function () {
		menu_opened = false;
		updateState();
	})
	// Добавление нового варианта
	.on('click', '.js-poll_row_add', function (e) {
		e.preventDefault();
		let variants = form.find('.js-poll_variants');
		let new_variant = variants.children().last().clone();
		let new_variant_id = variants.children().length + 1;
		let new_variant_input = new_variant.find('input[type="text"]');
		
		new_variant_input
			.val('')
			.attr("name", 'variant' + (new_variant_id - 1))
			.attr("aria-label", L("Вариант ответа #{0}", new_variant_id))
			.attr("placeholder", L("Вариант ответа #{0}", new_variant_id));
		variants.append(new_variant);
		
		Spaces.view.setInputError(new_variant_input, false);
		
		updateState();
	})
	// Удаление варианта
	.on('click', '.js-poll_row_del', function (e) {
		e.preventDefault();
		form.find('.js-poll_variants').children().last().remove();
		updateState();
	})
	// Удаление опроса
	.on('click', '.js-poll_del', function (e) {
		if (!form.data('widget'))
			return;
		
		e.preventDefault();
		
		let el = $(this);
		Spaces.api("polls.delete", {CK: null, Pid: poll_id.val()});
		setPollId(0);
		updateState();
		DdMenu.close();
	})
	// Сохранение опроса
	.on('click', '.js-poll_save', function (e) {
		if (form.data('widget'))
			e.preventDefault();
		
		if (form.data('busy'))
			return;
		
		let errors = 0,
			el = $(this);
		
		let descr = form.find('[name="description"]'),
			variants = form.find('.js-poll_variants input');
		
		Spaces.view.setInputError(descr, false);
		Spaces.view.setInputError(variants, false);
		
		if (!$.trim(descr.val()).length) {
			Spaces.view.setInputError(descr, L("Вы не ввели тему опроса."));
			++errors;
		}
		
		let valid_variants = 0,
			not_valid = [];
		variants.each(function () {
			if ($.trim($(this).val()).length) {
				++valid_variants;
				return;
			}
			not_valid.push(this);
		});
		
		if (valid_variants < params.min) {
			let fields = $(not_valid.slice(0, params.min - valid_variants));
			Spaces.view.setInputError(fields, L("Необходимо заполнить не менее {0}.",
				numeral(params.min, [L("$n варианта"), L("$n вариантов"), L("$n вариантов")])));
			++errors;
		}
		
		if (!errors) {
			if (!form.data('widget'))
				return;
			
			form.data('busy', true);
			el.find('.ico').addClass('ico_spinner');
			
			let on_done = function () {
				form.data('busy', false);
				el.find('.ico').removeClass('ico_spinner');
			};
			
			let data = Url.serializeForm(form);
			if (+poll_id.val())
				data.edit = 1;
			data.object_id = data.object_id || 0;
			Spaces.api("polls.create", data, function (res) {
				on_done();
				if (res.code != 0) {
					let field = descr;
					if (res.code == Codes.POLLS.ERR_WRONG_VARIANT)
						field = $(variants[res.number]);
					Spaces.view.setInputError(field, Spaces.apiError(res));
				} else {
					form.find('.js-poll_subject').text(descr.val());
					form.find('.js-poll_variants_cnt').text(res.variantsCntString);
					setPollId(res.pollId);
					updateState();
					DdMenu.close();
				}
			}, {
				onError: function (err) {
					on_done();
					Spaces.view.setInputError(descr, err);
				}
			});
		}
		e.preventDefault();
	});
}

function setPollId(id) {
	poll_id.val(id);
	
	if (page_loader.ok()) {
		let curl = new Url(location.href);
		curl.query.poll_id = id;
		HistoryManager.replaceState(HistoryManager.state, document.title, curl.url());
	}
}

function updateState() {
	let state = !!+poll_id.val(),
		in_process = state && !!+form.find('input[name="object_id"]').val();
	
	form.find('.js-poll_del').toggleClass('hide', !state);
	form.find('.js-poll_btn_wrap').toggleClass('hide', menu_opened || !state);
	
	form.find('.js-poll_state_new').toggleClass('hide', in_process);
	form.find('.js-poll_state_in_process').toggleClass('hide', !in_process);
	
	$('#create_poll_btn').toggleClass('hide', state);
	
	let variants = form.find('.js-poll_variants').children().length;
	form.find('.js-poll_row_add').toggleClass('hide', variants >= params.max);
	form.find('.js-poll_row_del').toggleClass('hide', variants <= params.min);
}

function destroy() {
	form = params = poll_id = null;
}

module.on("componentpage", function () {
	init();
	
	page_loader.onShutdown("polls", function () {
		destroy();
	});
});
