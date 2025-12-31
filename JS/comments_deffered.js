import module from 'module';
import $ from './jquery';
import page_loader from './ajaxify';
import Spaces from './spacesLib';
import {windowReady} from './utils';

var CHECKER_INTERVAL = 130;

var deffer_load_link,
	max_scroll,
	check_timeout,
	inited;

function init() {
	inited = true;
	deffer_load_link = $('.js-load_comments_deffered');
	
	if (!deffer_load_link.length)
		return;
	
	deffer_load_link.on('click', function (e) {
		e.preventDefault();
		
		var el = $(this),
			spinner = el.find('.js-ico'),
			data = el.data('params');
		
		if (!spinner.hasClass('hide'))
			return;
		
		destroy();
		
		spinner.removeClass("hide");
		
		data.Type = el.data('type');
		
		delete data.CK; // чтобы не было XSRF
		
		Spaces.api("comments.getContainer", data, function (res) {
			spinner.addClass("hide");
			if (res.code == 0) {
				el.parents('.js-comments_container').fastHtml(res.container);
			} else {
				Spaces.showApiError(res);
			}
		}, {
			onError: function (err) {
				spinner.addClass("hide");
				Spaces.showError(err);
			}
		});
	});
	
	let scroll_handler = () => {
		if (inited) {
			max_scroll = 0;
			onScroll();
			
			if (window.addEventListener) {
				// Ускоряем, без оверхэда jquery
				window.addEventListener('scroll', onScroll, false);
			} else {
				$(window).on('scroll.view_tracker', onScroll);
			}
		}
	};
	
	if (!Spaces.params.nid) {
		windowReady(scroll_handler);
	} else {
		scroll_handler();
	}
}

function onScroll() {
	var scrolled = window.pageYOffset || (document.documentElement || document.body || {}).scrollTop,
		height = Math.max(window.innerHeight, (document.documentElement || {}).clientHeight || 0);
	
	max_scroll = Math.max(max_scroll, scrolled + height);
	
	if (!check_timeout)
		check_timeout = setTimeout(checkButtonVisibility, CHECKER_INTERVAL);
}

function checkButtonVisibility() {
	if (max_scroll - deffer_load_link.offset().top > deffer_load_link.height())
		deffer_load_link.click();
	check_timeout = false;
}

function destroy() {
	if (!inited)
		return;
	inited = false;
	
	if (check_timeout)
		clearTimeout(check_timeout);
	
	check_timeout = deffer_load_link = null;
	
	if (window.removeEventListener) {
		window.removeEventListener('scroll', onScroll, false);
	} else {
		$(window).off('.view_tracker');
	}
}

module.on("componentpage", init);
module.on("componentpagedone", destroy);
