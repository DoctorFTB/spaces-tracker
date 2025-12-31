import require from 'require';
import module from 'module';
import $ from './jquery';
import Device from './device';
import Spaces from './spacesLib';
import fixPageHeight from './min_height';
import {Class} from './class';
import {tick} from './utils';

// В идеале только одно меню должно быть открыто
var custom_class = '', on_shutdown = [];

var tpl = {
	ddmenu: function (data) {
		return '' + 
		'<div class="js-dd_menu_item" id="' + data.id + '">' + 
			'<div class="widgets-group' + (data.flat ? ' dropdown-menu' : '') + ' js-ddmenu_content">' + 
				
			'</div>' + 
		'</div>';
	}
};

module.on("componentpage", function() {
	$('body').off('.ddmenu');
	$(window).off('.ddmenu').off('.fix_scroll_ddmenu');
});

$('body').on('focus click', '.js-dd_menu_link_focus', function (e) {
	if (e.type == 'click') {
		e.stopPropagation();
		e.preventDefault();
		return;
	}
	_openMenu.apply(this, arguments);
});

$('body').on('click', '.js-dd_menu_link, .js-delete-confirm', _openMenu);

$('body').action("dropdown", _openMenu);

$('body').on('click', '.js-dd_menu_item', function(e) {
	if (!e.ajaxify) {
		e.stopPropagation();
		e.stopImmediatePropagation();
	}
});
$('body').on('click', '.js-dd_menu_close, .js-cancel, .js-cancel a, a[data-action="cancel"]', function(e) {
	e.stopPropagation();
	e.preventDefault();
	_ddMenuClose();
});

$('body').on('click', '.js-confirm_yes', function(e) {
	e.stopPropagation();
	e.preventDefault();
	$('#' + $(this).data('id')).trigger('confirm');
	_ddMenuClose();
});

$('body').on('click', '.js-confirm_cancel', function(e) {
	e.stopPropagation();
	e.preventDefault();
	$('#' + $(this).data('id')).trigger('cancel');
	_ddMenuClose();
});

var DdMenu = Class({
	Constructor: function (opts) {
		var self = this;
		self.opts = $.extend({
			id: 'ddmenu_' + Date.now(),
			data: {},
			persist: false,
			flat: true
		}, opts);
		
		self.id = self.opts.id;
		self.menu = $(tpl.ddmenu({
			id: self.opts.id,
			flat: self.opts.flat
		}));
		self.menu.toggleClass('user__dropdown-menu dropdown-menu__wrap', !self.opts.data.spoiler).hide();
		if (self.opts.data)
			self.menu.data(self.opts.data);
		self.menu_content = self.menu.find('.js-ddmenu_content');
		
		if (!self.opts.data.spoiler)
			Spaces.view.pushWidget(self.menu, self.persist);
	},
	Static: {
		fixSize: function () {
			var cur_menu = _getCurrent();
			if (cur_menu) {
				DdMenu.fixPos();
				/*
				var ypad = 0;
				cur_menu.find('textarea').each(function () {
					var el = this, $el = $(el), max_h, h = $el.height();
					if (!(max_h = $el.data("max_textarea_h"))) {
						var ih = $el.innerHeight();
						max_h = ih / el.rows * 6 + (h - ih);
						el.style.maxHeight = max_h + "px";
						$el.data("max_textarea_h", max_h)
					}
					ypad += $el.data("max_textarea_h") - h;
				});
				fixPageHeight(cur_menu.data('ypad', ypad));
				*/
				fixPageHeight(cur_menu.data('ypad', 0));
			}
		},
		fixPos: function () {
			$(window).trigger('fixDdMenuPos');
		},
		findOpeners: function (menu_id) {
			return $('.js-dd_menu_link[data-menu_id="' + menu_id + '"]');
		},
		currentId: function () {
			var c = _getCurrent();
			if (c)
				return c.attr("id");
			return null;
		},
		current: function () {
			return _getCurrent();
		},
		close: function (id) {
			_ddMenuClose(id);
		},
		isOpen: function (id) {
			var current_menu = _getCurrent();
			return (current_menu && (!id || current_menu.attr("id") == id));
		}
	},
	content: function () {
		var self = this;
		return self.menu_content;
	},
	element: function () {
		var self = this;
		return self.menu;
	},
	opener: function () {
		var self = this;
		return self.menu.data("menu_opener");
	},
	on: function (event, func) {
		var self = this;
		self.menu.on('dd_menu_' + event, func);
		return self;
	},
	link: function (el, opts) {
		var self = this;
		opts = opts || {};
		opts.menu_id = self.id;
		el.data($.extend({
			position: true,
			noclass: true
		}, el.data(), opts));
		el.attr('data-menu_id', self.id).addClass('js-dd_menu_link');
		if (!el.data('no_label')) {
			if (el.data('menu_pos') == 'before')
				el.addClass('triangle-show').addClass('triangle-show_top');
			else
				el.addClass('drop-down-label');
		}
		return self;
	},
	openAs: function (el, opts) {
		var self = this;
		if (!self.dummy_link) {
			self.dummy_link = $('<a>', {
				'class': 'js-dd_menu_link hide'
			});
			self.menu.parent().append(self.dummy_link);
		}
		self.dummy_link.removeData().data($.extend({
			menu_id: self.id,
			position: true,
			noclass: true,
			position_rel: el
		}, opts));
		tick(function () {
			self.dummy_link.click();
		});
		return self;
	},
	destroy() {
		let self = this;
		self.element().removeData().empty().remove();
	},
	open: function (opts) {
		var self = this,
			openers = DdMenu.findOpeners(self.id);
		openers.first().click();
		return self;
	},
	close: function () {
		var self = this;
		_ddMenuClose(self.id);
		return self;
	}
});

function _openMenu(e, extra) {
	var el = $(this);
	
	let menu_id = $.trim(el.data('menu_id')),
		menu = $('#' + menu_id);
	
	if (!menu.length) {
		console.error(`Menu ${menu_id} not found!`);
		return;
	}
	
	if (extra && extra.ignoreEvent)
		return;
	if (el.data('disabled'))
		return;
	
	var current = DdMenu.current();
	if (current && $.contains(el[0], current[0]) && e.ajaxify) {
		console.warn("dd_menu in dd_menu link!");
		return;
	}
	
	if (!el.data('nocancel')) {
		e.preventDefault();
		//e.stopPropagation();
	}
	
	var is_delete_confirm = el.hasClass('js-delete-confirm'), // костыль
		el_id = el.attr('id'),
		inner_id = el.data('inner'),
		city_prefix = el.data('city_prefix') || false,
		no_bottom_fix = el.data('no_bottom_fix') || false,
		allow_only = el.data('allow_only') || false,
		add_friend_link = el.hasClass('js-add-friend'),
		all_menu_buttons = $('.js-dd_menu_link'),
		om_margin = $(el.data('om_margin') ? el.data('om_margin') : []),
		override_opener = el.data('position_rel') ? $(el.data('position_rel')) : el;
	
	if (menu.data('disabled') || el.hasClass('disabled'))
		return;
	
	if (el.data('global'))
		Spaces.view.pushWidget(menu, el.data('globalPersist'));
	
	custom_class = el.data('custom_class');
	
	menu.prop("menuOpener", el);
	
	var current_menu = _getCurrent();
	
	var last_menu_pos;
	if (current_menu)
		last_menu_pos = current_menu.position();
	
	var menu_opener = is_delete_confirm ? menu_opener || override_opener : override_opener;
	
	// Хак
	if (!menu_opener)
		menu_opener = $('data-menu_id="' + menu_id + '"');
	
	var is_toggle = current_menu && current_menu.attr('id') == menu_id;
	
	if (is_toggle) {
		var event = $.Event("dd_menu_toggle");
		menu.trigger(event, {
			link: menu_opener,
			sameLink: menu.data("menu_opener") && menu_opener[0] == menu.data("menu_opener")[0]
		});
		if (event.isDefaultPrevented())
			return;
	}
	
	if (is_toggle && el.data('notoggle'))
		return;
	
	if (!_ddMenuClose() || is_toggle) // закроем текущее
		return;
	
	menu.data("menu_opener", menu_opener);
	
	var event = $.Event("dd_menu_open");
	menu.trigger(event);
	if (event.isDefaultPrevented()) {
		menu.removeData("menu_opener");
		return;
	}
	
	menu.data('menu_opened', true);
	current_menu = menu;
	
	if (inDdMenu(menu))
		Spaces.view.pushWidget(menu.data('position', 1));
	
	if (inDdMenu(el))
		menu_opener = current.data('menu_opener');
	
	if (custom_class)
		el.addClass(custom_class);
	if (inner_id)
		$('#' + inner_id).addClass('drop-down-list_inner_open');
	
	var dd_spoiler = current_menu.parents('.js-dd_spoiler');
	if (dd_spoiler.length) {
		current_menu.removeClass('user__dropdown-menu dropdown-menu__wrap');
		current_menu.addClass(dd_spoiler.data('class'));
		menu.data('spoiler', true);
		menu_opener.addClass('drop-down-label_spoiler');
		dd_spoiler.removeClass('js-dd_spoiler');
	}
	
	menu_opener.addClass('js-clicked ' + (menu_opener.data('noclass') ? '' : 'clicked'));
	
	var position = el.data('position') || menu.data('position'),
		position_method = el.data('position_method') || menu.data('position_method'),
		fix_position = +(menu_opener.data('fix_position') || el.data('fix_position') || menu.data('fix_position') || 0),
		menu_calculated = false,
		menu_before = el.data('menu_pos') == 'before',
		content = menu.find('.js-ddmenu_content'),
		site_content = $('#siteContent'),
		alt_place = menu.data('place');
	
	if (alt_place) {
		var place = $(alt_place);
		if (!place.length)
			alert(alt_place + ' not found');
		place.append(menu);
	}
	
	if (menu.data('spoiler'))
		position = null;
	
	if (position == "page_top") {
		on_shutdown.push(function () {
			content.css("height", "");
		});
	}
	
	if (position_method == "fixed") {
		on_shutdown.push(function () {
			menu.css({
				position: '', height: '',
				left: '', width: ''
			});
		});
	}
	
	var menu_padding;
	function calc_menu_position() {
		_calc_menu_position();
		if (menu.data('events'))
			menu.trigger('dd_menu_resize');
	}
	
	function _calc_menu_position() {
		if (!position)
			return;
					
		var pad = 30,
			gallery = $('#Gallery');
		if (gallery.length && menu.data('in_gallery')) {
			let {Gallery} = require.loaded(import.meta.id('./gallery'));
			
			var rect = Gallery.getGalleryRect(),
				small_screen = menu.data('small_screen');
			
			if (!menu_calculated) {
				small_screen = Math.min($(window).height(), $(window).width()) < 360;
				menu.data('small_screen', small_screen);
				
				Gallery.lock(true);
				menu.data('gallery_state', {
					fullscreen: Gallery.isFullscreen(),
					small: small_screen
				});
				if (small_screen) {
					gallery.hide();
					gallery.before(menu);
				} else {
					gallery.append(menu);
				}
				menu_calculated = true;
			}
			
			if (small_screen) {
				menu.css({
					marginTop: 0,
					position: "static",
					minHeight: rect.rh + "px",
					boxSizing: 'border-box'
				}).show();
			} else {
				// Устанавливаем фуллскрин в зависимости от высоты экрана
				var state = menu.data('gallery_state'),
					new_fullscreen = $(window).height() < 400 ? true : state.fullscreen;
				if (Gallery.isFullscreen() != new_fullscreen)
					Gallery.toggleFullscreen(new_fullscreen);
				
				menu.css({
					position: "absolute",
					left: 0, right: 0,
					bottom: rect.rh - (rect.h + rect.y),
					marginTop: 0, maxHeight: rect.h + "px",
					minHeight: 0, boxSizing: 'border-box',
					top: "auto"
				}).show();
			}
			return;
		} else if (position == "bottom") {
			var curr_x = menu.css({top: 0}).show().offset().top,
				top;
			top = menu_opener.offset().top - curr_x + menu_opener.height() - pad;
			menu.css({bottom: top + 'px', top: '', 'margin-bottom': 0});
			return;
		} else if (position == "page_top" || position == "fullpage_top") {
			if (!menu_calculated) {
				menu_padding = menu.show().outerHeight() - content.outerHeight();
				menu_calculated = true;
			}
			var max_height = $(window).height() - menu_padding;
			menu.show().css({top: menu.css("margin-top")});
			
			if (position == "page_top")
				content.css("height", max_height + "px");
			return;
		}/* else if (position == "header") {
			var navi = $('#navi');
			if (!menu_calculated) {
				menu_padding = menu.show().outerHeight() - content.outerHeight();
				menu_calculated = true;
			}
			menu.offset({top: navi.offset().top + navi.outerHeight() + $(window).scrollTop()});
			content.css("max-height", $(window).height() - navi.outerHeight() - menu_padding + "px");
			return;
		}*/ else if (position == "opener_top") {
			pad = -menu_opener.height();
		} else if (position == "top") {
			pad = 0;
		} else if (position == "abs_val") {
			pad = 0;
		}
		
		if (menu_before) { // Меню выше кнопки
			var top = menu_opener.offset().top - pad - fix_position;
			if (!menu_calculated) {
				menu.css({ // Костыли, чтобы меню не "прыгало"
					visibility: 'visible',
					opacity: 0,
					filter: 'alpha(opacity=0)'
				}).show();
				tick(function () { // height() не доступен сразу после show()
					menu.offset({top: top - menu.outerHeight()}).css({
						visibility: '',
						opacity: '',
						filter: ''
					});
					menu_calculated = true;
				});
			} else {
				menu.offset({top: top - menu.outerHeight()});
			}
		} else { // Меню ниже кнопки
			if (position_method == 'fixed') {
				if (!menu_calculated) {
					menu.show();
					menu_padding = menu.innerWidth() - menu.width(); // o_O
					menu_calculated = true;
				}
				menu.css({
					position: 'fixed',
					height: '',
					left: site_content.offset().left + 'px',
					width: menu.parent().parent().innerWidth() - menu_padding
				}).show().offset({
					top: 
						position == "abs_val" ? menu_opener.data('position_top_val') : 
							menu_opener.offset().top + menu_opener.height() + fix_position + pad
				});
			} else {
				if (el.data('global')) {
					var pad = 20;
					if (menu_opener.hasClass('btn-tools_centered'))
						pad = 8;
					
					var need_y = menu_opener.offset().top + menu_opener.outerHeight() + pad;
					menu.show().offset({top: need_y});
					
					// Какой-то баг jquery
					if (need_y > menu.offset().top)
						menu.offset({top: need_y + (need_y - menu.offset().top)});
				} else {
					var pad = 20;
					if (window.getComputedStyle && menu_opener[0].getBoundingClientRect) {
						var rect = menu_opener[0].getBoundingClientRect(),
							padding_top = parseFloat(window.getComputedStyle(menu_opener[0], null).getPropertyValue("padding-top")),
							padding_bottom = parseFloat(window.getComputedStyle(menu_opener[0], null).getPropertyValue("padding-bottom")),
							opener_h = (rect.bottom - rect.top) - (padding_bottom + padding_top);
						
						menu.show().offset({
							top:	menu_opener.offset().top + padding_top + opener_h + fix_position + pad
						});
					} else {
						var menu_opener_pad = (menu_opener.innerHeight() - menu_opener.height()) / 2,
							padding_top = menu_opener.css("padding-top"),
							padding_bottom = menu_opener.css("padding-bottom");
						
						menu.show().offset({
							top:	menu_opener.offset().top + padding_top + menu_opener.height() + fix_position + pad
						});
					}
				}
			}
		}
	}
	
	var $win = $(window),
		last_scroll = $win.scrollTop();
	$win.on((menu.data('scroll') ? 'scroll.fix_scroll_ddmenu ' : '') + 'resize.fix_scroll_ddmenu', function (e) {
		if (menu.data("menu_opened")) {
			calc_menu_position();
			DdMenu.fixSize();
		}
	});
	$win.on('fixDdMenuPos.fix_scroll_ddmenu', function (e) {
		if (menu.data("menu_opened"))
			calc_menu_position();
	});
	
	// Тут идут костыли
	if (is_delete_confirm) {
		if (!el.data('noposition'))
			menu.css({top: last_menu_pos.top + 'px'});
		menu.show();
	} else if (el_id == 'new_status_btn') {
	//	$(window).on('resize.ddmenu', function () {
	//		menu.css({'margin-top': '-' + menu_opener.position().top + 'px'});
	//	});
	//	$(window).trigger('resize.ddmenu');
		$('#new_status_ta').select();
		menu.show();
	} else {
		if (position) {
			calc_menu_position();
		} else {
			menu.show();
		}
		
		if ((add_friend_link === true)&&(Device.type == 'desktop')){
			menu.find('.text-input').first().focus();
		}
	}
	
	/*
	if (no_bottom_fix === false){
		var $main_content = $('#main_content');
		$main_content.css('min-height', $main_content.height() + 150 + 'px');
	}
	*/
	
	current_menu.trigger($.Event("dd_menu_opened"));
	menu_opener.trigger('dd_menu_opened');
	
	_openerState(current_menu, true);
	
	$('body').on('click.ddmenu', function (e) {
		if (menu.data("menu_opened")) {
			if (e && e.target && e.target.ajax_upload_button)
				return;
			if ($.draggableNoClick && $.draggableNoClick())
				return;
			
			var current_menu = _getCurrent();
			if (current_menu.data('preventCloseByClick'))
				return;
			
			_ddMenuClose();
		}
	});
	DdMenu.fixSize();
	
	if (menu.data('spoiler')) {
		position = null;
		// Костыль когда два спойлера идут рядом... пока не знаю как сделать лучше :(
		var spoilers = menu.parents('.js-multi_spoiler_inject'),
			prev;
		spoilers.find('.spoiler_inject').removeClass('spoiler_inject-chain').each(function () {
			var spoiler = $(this);
			if (prev)
				prev.toggleClass('spoiler_inject-chain', !!(prev.isVisible() && spoiler.isVisible()));
			prev = spoiler;
		});
	}
};

function _openerState(menu, flag) {
	var opener = menu.prop("menuOpener");
	if (opener) {
		opener.find('.js-dd_menu_state_open').toggleClass('hide', !flag);
		opener.find('.js-dd_menu_state_close').toggleClass('hide', !!flag);
	}
}

function _ddMenuClose(id) {
	var current_menu = _getCurrent();
	if (!current_menu || (id && id != current_menu.attr("id")))
		return true;
	
	_openerState(current_menu, false);
	
	$('#main_content').css('min-height', 0);
	
	var event = $.Event("dd_menu_close");
	current_menu.trigger(event);
	if (event.isDefaultPrevented())
		return false;
	
	// Возвращаем состояние просмотрщика как до открытия dd_menu
	var gallery_state = current_menu.data('gallery_state');
	if (gallery_state) {
		let {Gallery} = require.loaded(import.meta.id('./gallery'));
		
		Gallery.lock(false);
		if (gallery_state.small) {
			$('#Gallery').show();
			Gallery.onResize();
		} else {
			if (!gallery_state.fullscreen)
				Gallery.toggleFullscreen(false);
		}
	}
	
	current_menu.prop("menuOpener", null);
	current_menu.data('menu_opened', false);
	$('.drop-down-list_inner').removeClass('drop-down-list_inner_open');
	$('.js-dd_menu_link').removeClass('js-clicked clicked ' + custom_class);
	current_menu.hide();
	custom_class = '';
	
	$('body').off('.ddmenu');
	$(window).off('.ddmenu').off('.fix_scroll_ddmenu');
	
	current_menu.trigger('dd_menu_closed');
	var menu_opener = current_menu.data('menu_opener');
	if (menu_opener)
		menu_opener.trigger('dd_menu_closed');
	
	for (var i = 0; i < on_shutdown.length; ++i)
		on_shutdown[i]();
	on_shutdown = [];
	
	current_menu = null;

	fixPageHeight();
	
	return true;
}

function _getCurrent() {
	var current_menus = $('.dropdown-menu__wrap, .js-dd_menu_item'), current_menu;
	for (var i = 0; i < current_menus.length; ++i) {
		if (!current_menus[i].getAttribute('skip') && $(current_menus[i]).isVisible())
			current_menu = $(current_menus[i]);
	}
	if (!current_menu || !current_menu.length)
		return null;
	current_menu.data('menu_opened', true);
	return current_menu;
}

function inDdMenu(el) {
	return el.parents('.dropdown-menu__wrap, .js-dd_menu_item').length > 0;
}

export default DdMenu;
