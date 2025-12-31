import module from 'module';
import $ from './jquery';
import * as pushstream from './core/lp';
import {Spaces, Codes} from './spacesLib';
import page_loader from './ajaxify';
import DdMenu from './dd_menu';
import notifications from './notifications';
import {L, tick} from './utils';

var queue, ns = '.recomendations',
	buttons = {
		'default': {
			icon: 'ico_ok_blue',
			active: false,
			title: L('Получить список контактов')
		},
		'spinner': {
			icon: 'ico_spinner',
			active: true,
			title: L('Получаем контакты...')
		},
		'refresh': {
			icon: 'ico_reload_blue',
			active: false,
			title: L('Обновить страницу')
		}
	};

var main;

module.on("componentpage", function () {
	main = $('#siteContent');
	
	if (pushstream) {
		pushstream.on('message', 'recomendations', function (res) {
			if (res.act == pushstream.TYPES.BIND_EMAIL_RESULT) {
				if (!queue)
					return;
				
				_setButtonStyle(queue.el, "default");
				if (res.res_fail) { // Ошибка
					Spaces.view.setInputError(queue.email.password, res.msg);
					DdMenu.fixSize();
					$('#js-auth-message_' + queue.type).remove();
				} else if (res.res_ok) { // Успешно прибиндили
					page_loader.on('pageloaded', 'recomendations', function () {
						notifications.showNotification(res.msg);
						page_loader.off('pageloaded', 'recomendations');
					})
					Spaces.services.pageReload(true);
				}
				
				queue = null;
			}
		});
	}
	
	$(window).on('resize' + ns, _onResize);
	
	main.on('dd_menu_close' + ns, '.social__dropdown-menu', function (e) {
		if (queue) {
			// Запрещаю открывать и закрывать новые ddmenu до завершения запроса
			return false;
		}
	}).on('click' + ns, '.js-user-tile__similarity', function (e) {
		e.preventDefault();
		e.stopPropagation();
		$(this).parent().find('.user-tile__similarity-wrapper').toggle();
	}).on('click' + ns, '.js-auth-email_btn', function (e) {
		e.preventDefault();
		e.stopPropagation();
		
		var el = $(this);
		if (el.attr("type") == "refresh") {
			Spaces.services.pageReload(true);
			return;
		}
		
		if (queue)
			return;
		
		var type = el.data('type'),
			error = false,
			email = {
				login: $('#js-auth-login_' + type),
				domain: $('#js-auth-domen_' + type),
				password: $('#js-auth-password_' + type)
			};
		
		Spaces.view.setInputError(email.login, false);
		Spaces.view.setInputError(email.password, false);
		
		if (!email.login.val()) {
			Spaces.view.setInputError(email.login, L('Нужно ввести e-mail'));
			error = true;
		}
		
		if (!email.password.val()) {
			Spaces.view.setInputError(email.password, L('Нужно ввести пароль'));
			error = true;
		}
		
		if (!error) {
			_setButtonStyle(el, "spinner");
			
			Spaces.api("mysite.extsite.bindEmail", {
				email: email.login.val() + email.domain.val(),
				passwd: email.password.val(),
				CK: null
			}, function (res) {
				if (res.code == 0) {
					email.password.parents('.content-bl').append($(
						'<div class="grey t_center pad_t_a" id="js-auth-message_' + type + '">' + 
							L('Мы пытаемся получить список контактов из вашего почтового аккаунта. ' + 
								'Обычно на это уходит не более 5 секунд, после чего вы можете попробовать обновить страницу. ') + 
						'</div>'
					));
					_setButtonStyle(el, "refresh");
					DdMenu.fixSize();
					queue = {el: el, email: email, type: type};
				} else {
					if (res.code == Codes.COMMON.ERR_BAD_REQUEST && res.errors) {
						var error2field = {
							login: email.login,
							password: email.password
						};
						
						var unknown_errors = [];
						$.each(res.errors, function (field, error) {
							if (error2field[field])
								Spaces.view.setInputError(error2field[field], error);
							else
								unknown_errors.push(field + ": " + error);
						});
						if (unknown_errors.length > 0)
							Spaces.showError(unknown_errors.join('<br />'));
					} else {
						Spaces.view.setInputError(email.login, Spaces.services.processingCodes(res));
					}
					_setButtonStyle(el, "default");
				}
			});
		} else {
			DdMenu.fixSize();
		}
	}).on('focus' + ns, '.text-input', function () {
		var el = $(this);
		if (el.hasClass('js-auth-login_input'))
			_fixInputWidth(el);
		Spaces.view.setInputError(el, false);
	}).on('change' + ns, '.js-auth-email_selector', function (e) {
		var el = $(this);
		el.parentsUntil('.js-dd_menu_item').find('.js-auth-selector-label').html(el.val());
	});
});

module.on("componentpagedone", function () {
	main.off(ns);
	$(window).off(ns);
	pushstream.off('message', 'recomendations');
	queue = null;
});

function _setButtonStyle(el, button_id) {
	var button = buttons[button_id],
		icons = [];
	for (var i in buttons)
		icons.push(buttons[i].icon);
	
	var btn = el.find('.js-auth-text_email_btn');
	el.find("." + icons.join(", .")).
		removeClass(icons.join(" ")).addClass(button.icon);
	el[button.active ? 'addClass' : 'removeClass']('stnd-link_active');
	btn.text(button.title);
	el.attr("type", button_id);
}

function _onResize() {
	$('.js-auth-login_input').each(function () {
		_fixInputWidth($(this));
	});
}

function _fixInputWidth(input) {
	var parent = input.parent('.text-input__wrap'),
		label = parent.find('.js-auth-selector-label'),
		parent_padd = label.width() + 40;
	parent.css({'padding-right': parent_padd + 'px'});
	input.css({'padding-right': (parent_padd - 11) + 'px'});
}
