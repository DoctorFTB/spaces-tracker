import module from 'module';
import $ from './jquery';
import Device from './device';
import Spaces from './spacesLib';
import page_loader from './ajaxify';
import {L, tick} from './utils';

import "Common/GlobalCaptcha.css";

var css_has_fixed = Device.css('position', 'fixed', /fixed/i),
	current_captcha_id,
	captchas = {},
	captcha_queue = [];

var tpl = {
	window: function (data) {
		var html = 
			'<div class="gcaptcha__shadow" id="gcaptcha">' + 
				'<a id="gcaptcha_close_bg"></a>' + 
				'<div id="gcaptcha_window">' + 
					'<form>' + 
						'<span class="ico_buttons ico_buttons_close block-btn cursor" id="gcaptcha_close_btn"></span>' + 
						'<div class="widgets-group dropdown-menu">' + 
							'<div class="content-item3 wbg content-bl__sep error__item_wrapper">' + 
								'<div class="t_center">' + 
									'<img src="' + data.url + '" alt="" />' + 
								'</div>' + 
								'<div class="pad_t_a">' + 
									'<div class="js-input_error_wrap">' + 
										'<div class="text-input__wrap">' + 
											'<input class="text-input form_submit" name="code" value="" id="gcaptcha_input"' + 
												'placeholder="' + L("Код с картинки") + '" />' + 
										'</div>' + 
									'</div>' + 
								'</div>' + 
								'<div class="pad_t_a">' + 
									'<button class="btn btn_green btn_full btn_full_fix js-form_submit" id="gcaptcha_btn" disabled="disabled">' + 
										'<span class="ico ico_spinner_white js-spinner hide"></span> ' + 
										'Подтвердить' + 
									'</button>' + 
								'</div>' + 
							'</div>' + 
						'</div>' + 
					'<form>' + 
				'</div>' + 
			'</div>';
		return html;
	}
};

function showGlobalCaptcha(captcha_id, url, callback, error) {
	if (current_captcha_id && current_captcha_id != captcha_id) {
		if (!captchas[captcha_id]) {
			captchas[captcha_id] = [captcha_id, url, callback, error];
			captcha_queue.push(captcha_id);
		}
		return;
	}
	
	// Закрываем старое окно капчи
	destroyCaptcha();
	
	current_captcha_id = captcha_id;
	
	// Выводим окно с капчей
	$('body').append(tpl.window({
		url: url
	}));
	
	var input = $('#gcaptcha_input'),
		btn = $('#gcaptcha_btn');
	
	$('#gcaptcha_window').css({
		position: css_has_fixed ? 'fixed' : 'absolute'
	});
	
	if (error)
		Spaces.view.setInputError(input, error);
	
	input.focus(function () {
		Spaces.view.setInputError(input, false);
	});
	
	centerCaptcha();
	tick(centerCaptcha);
	$(window).on(css_has_fixed ? 'resize.gcaptcha' : 'resize.gcaptcha scroll.gcaptcha', centerCaptcha);
	
	// Разблокируем кнопку только если ввели код
	input.on('keyup changed input blur', function (e) {
		var fillded = $.trim(input.val()).length;
		if (fillded)
			btn.removeAttr("disabled")
		else
			btn.attr("disabled", "disabled");
	});
	
	// Ввод капчи
	btn.click(function (e) {
		e.preventDefault();
		
		// Блокируем все поля ввода
		input.attr("disabled", "disabled").attr("readonly", "readonly");
		btn.attr("disabled", "disabled");
		btn.find('.js-spinner').removeClass('hide');
		
		// Ждём окончания запроса, что бы закрыть капчу
		callback($.trim(input.val()), function () {
			if (current_captcha_id && current_captcha_id == captcha_id)
				destroyCaptcha();
				processQueue();
		});
	});
	
	var close = function () {
		destroyCaptcha();
		processQueue();
		callback(false);
	};
	
	// Отмена ввода капчи по клику на крестик или серый фон
	$('#gcaptcha_close_btn, #gcaptcha_close_bg').click(function (e) {
		e.preventDefault();
		close();
	});
	
	// Отмена ввода капчи по ESC
	$(window).on('keydown.gcaptcha', function (e) {
		if (e.keyCode == Spaces.KEYS.ESC)
			close();
	});
	
	module.on("componentpagedone", function () {
		captcha_queue = [];
		captchas = {};
		destroyCaptcha();
		processQueue();
	});
}

function destroyCaptcha() {
	if (current_captcha_id) {
		delete captchas[current_captcha_id];
		current_captcha_id = false;
		
		$('#gcaptcha').remove();
		$(window).off('.gcaptcha');
	}
}

function processQueue(queue_process) {
	setTimeout(function () {
		if (!current_captcha_id && captcha_queue.length)
			showGlobalCaptcha.apply(this, captchas[captcha_queue.pop()]);
	}, 700);
}

function centerCaptcha() {
	var gcaptcha_window = $('#gcaptcha_window'),
		$window = $(window),
		scroll = css_has_fixed ? 0 : $window.scrollTop();
	gcaptcha_window.css({
		top: scroll + ($window.height() - gcaptcha_window.height()) / 2,
		left: ($window.width() - gcaptcha_window.width()) / 2
	});
}

export {showGlobalCaptcha};
