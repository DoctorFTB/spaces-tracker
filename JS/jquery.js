import {executeScripts} from 'loader';
import $ from './vendor/jquery';
import Device from './device';

// For debug
window.$ = $;

$.each2 = function (val, func) {
	var last, first = true;
	if (val instanceof Array) {
		last = val.length - 1;
	} else if (val) {
		for (var k in val) {
			if (Object.prototype.hasOwnProperty.call(val, k))
				last = k;
		}
	}
	return $.each(val, function (k, v) {
		var meta = {
			first: first,
			last: k === last,
			middle: !first && k !== last
		};
		if (first)
			first = false;
		return func.call(val, k, v, meta);
	});
};

$.queryClassAll = function (class_name, context) {
	context = context || document;
	
	if (context.getElementsByClassName) {
		return context.getElementsByClassName(class_name);
	} else {
		return $.find('.' + class_name, context);
	}
};

$.querySelector = function (selector, context) {
	context = context || document;
	
	if (context.querySelector) {
		return context.querySelector(selector);
	} else {
		return $.find(selector, context)[0];
	}
};

$.querySelectorAll = function (selector, context) {
	context = context || document;
	
	if (context.querySelectorAll) {
		return context.querySelectorAll(selector);
	} else {
		return $.find(selector, context);
	}
};

$.fn.isVisible = function () {
	if (this.length) {
		let elem = this[0];
		return !!(elem.offsetWidth || elem.offsetHeight || elem.getClientRects().length);
	}
	return false;
}

// innerHTML с правильной очисткой jQuery
$.fn.fastHtml = function (html) {
	var el, i = 0;
	while (el = this[i++]) {
		if (el.nodeType === 1) {
			// Очищаем память jQuery
			$.cleanData(el.getElementsByTagName('*'));
			
			// Заменяет HTML
			el.innerHTML = html;
			
			// Выполняем скрипты
			executeScripts(el.getElementsByTagName('script'));
		}
	}
	return this;
};

// Проскроллить до элемента
$.fn.scrollTo = function (el, opts) {
	opts = $.extend({
		position: "top"
	}, opts);
	el = $(el);
	
	var self = this,
		is_global_scroll = (self[0] == window || self[0] == document.body || 
			self[0] == document.documentElement),
		scroll_getter = is_global_scroll ? $(window) : self,
		self_offset = self.offset(),
		el_offset = el.offset();
	
	if (self_offset && el_offset) {
		var scroll = is_global_scroll ? el_offset.top : el_offset.top + scroll_getter.scrollTop() - self_offset.top,
			scroll_dir = opts.position;
		if (scroll_dir == "visible") {
			var x = is_global_scroll ? scroll_getter.scrollTop() : el_offset.top,
				x2 = is_global_scroll ? x + $(window).innerHeight() : self_offset.top + self.innerHeight();
			
			if (el_offset.top < x) {
				scroll_dir = "top";
			} else if (el_offset.top + el.outerHeight() > x2) {
				scroll_dir = "bottom";
			} else {
				return;
			}
		}
		
		if (is_global_scroll) {
			if (scroll_dir == "center") {
				scroll -= $(window).innerHeight() / 2 - el.outerHeight() / 2;
			} else if (scroll_dir == "bottom") {
				scroll -= $(window).innerHeight() - el.outerHeight();
			}
		} else {
			if (scroll_dir == "center") {
				scroll -= self.innerHeight() / 2 - el.outerHeight() / 2;
			} else if (scroll_dir == "bottom") {
				scroll -= self.innerHeight() - el.outerHeight();
			}
		}
		self.scrollTop(scroll);
	}
	return self;
};


$.remap = function (map, params, ignore) {
	var out = {};
	$.each(params, function (k, v) {
		if (ignore && !(k in map))
			return;
		out[k in map ? map[k] : k] = v;
	});
	return out;
};

$.fn.findClass = function (clazz) {
	var el = this;
	if (!el.hasClass(clazz)) {
		var new_el = el.find('.' + clazz);
		if (!new_el.length)
			new_el = el.parents('.' + clazz).first();
		return new_el;
	}
	return el;
}

$.fn.findAttr = function (attr) {
	var el = this;
	if (!el.attr(attr)) {
		var new_el = el.find('[' + attr + ']');
		if (!new_el.length)
			new_el = el.parents('[' + attr + ']').first();
		return new_el;
	}
	return el;
}

// Быстрая реализация вместо show/hide
$.fn.visible = function (flag) {
	if (flag === undefined)
		return this.length > 0 && this[0].style.display !== 'none';
	for (var i = 0; i < this.length; ++i)
		this[i].style.display = !flag ? 'none' : 'block';
	return this;
};

// Размеры шрифта
$.fn.fontMetrics = function (word) {
	var self = this;
	word = word || 'W';
	var span = $('<span>').css({
		fontFamily: self.css("font-family"),
		fontSize: self.css("font-size"),
		padding: 0, margin: 0,
		opacity: 0, visiblity: "hidden",
		wordWrap: 'normal',
		whiteSpace: 'pre',
		letterSpacing: '0'
	}).text(word);
	$(document.body).append(span);
	var res = {w: span.innerWidth(), h: span.innerHeight()};
	span.empty().remove();
	return res;
};

$.fn.action = function (actions, callback) {
	var el = this;
	actions = $.trim(actions).split(/\s+/);
	el.on('click', '.js-action_link', function (e) {
		var args = arguments,
			link = $(this),
			action = link.data('action');
		if ($.inArray(action, actions) >= 0) {
			e.linkAction = action;
			return callback.apply(this, args);
		}
	});
	return el;
};

$.fn.findByPos = function (cur_pos, dir) {
	var childrens = this,
		before = false,
		only_x = dir == 'x',
		only_y = dir == 'y';
	
	var match_line = function (x, x2, w) {
		if (!w)
			return false;
		return x2 <= x && x <= x2 + w;
	};
	
	for (var i = 0, l = childrens.length; i < l; ++i) {
		var el = $(childrens[i]), pos = el.offset(),
			w = el.outerWidth(true), h = el.outerHeight(true);
		var match_by_x = only_y || match_line(cur_pos.x, pos.left, w) || match_line(pos.left, cur_pos.x, cur_pos.w),
			match_by_y = only_x || match_line(cur_pos.y, pos.top, h) || match_line(pos.top, cur_pos.y, cur_pos.h);
		if (match_by_x && match_by_y && (!cur_pos.target || el[0] != cur_pos.target[0]))
			return el;
	}
	return null;
};

// Определение моментов, когда юзер проскроллил в конец или начало скролла
$.fn.scrollMonitor = function (opts) {
	if (opts !== false) {
		opts = $.extend({
			up: 0,   // Мнимальная дельта сверху до срабатывания ивента
			down: 0, // Мнимальная дельта снизу до срабатывания ивента
			eventStart: "scrollStart",
			eventEnd: "scrollEnd",
			mainScroll: false
		}, opts);
	}
	var $w = $(window);
	return this.each(function() {
		var el = $(this), scroll_el = (opts.mainScroll ? $w : el),
			last_scroll = scroll_el.scrollTop();
		if (opts === false) {
			scroll_el.off('.scrollMonitor');
		} else {
			scroll_el.on("scroll.scrollMonitor", function (e) {
				var cur_scroll = scroll_el.scrollTop(),
					direction = last_scroll - cur_scroll > 0,
					min_scroll = opts.mainScroll ? el.offset().top : 0,
					max_scroll = opts.mainScroll ? min_scroll + el.outerHeight() - $w.innerHeight() : 
						el[0].scrollHeight - el.outerHeight();
				if (!direction && cur_scroll / max_scroll >= opts.down) {
					el.trigger(opts.eventEnd, {maxScroll: max_scroll, curScroll: cur_scroll});
				} else if (direction && 1 - ((cur_scroll - min_scroll) / (max_scroll - min_scroll)) >= opts.up) {
					el.trigger(opts.eventStart, {maxScroll: max_scroll, curScroll: cur_scroll});
				}
				last_scroll = cur_scroll;
			});
		}
	});
};

// Кросс-браузерное определение печатает ли юзер
$.fn.typingDetect = function (enabled) {
	var el = this.first(), k = ".typing_detector",
		data = el.prop(k);
	
	if (enabled) {
		if (!data) {
			el.on('focus' + k, function () {
				var data = el.prop(k), last_length = el[0].value.length;
				if (data && data.timer)
					clearInterval(data.timer);
				var typings_monitor = function () {
					if (!el[0].parentNode) {
						el.typingDetect(false);
					} else {
						var len = el[0].value.length;
						if (last_length != len) {
							last_length = len;
							el.trigger('typing');
						}
					}
				};
				data.timer = setInterval(typings_monitor, 300);
			});
			el.on('blur' + k, function () {
				var data = el.prop(k);
				if (data.timer) {
					clearInterval(data.timer);
					data.timer = null;
				}
			});
			el.prop(k, {});
			if (el.is(':focus'))
				el.trigger('focus');
		}
	} else {
		if (data) {
			if (data.timer)
				clearInterval(data.timer);
			el.removeProp(k)
			el.off(k);
		}
	}
	return this;
};

// Костыль для блокирования mousewheel в родительских элементах
$.fn.mousewheel = function (opts) {
	opts = $.extend({
		allowTextarea: false
	}, opts);
	
	var mustdie = /(trident|msie)/i.test(navigator.userAgent),
		doc = document.documentElement,
		event_name, events = {
			onmousewheel: 'mousewheel',
			onwheel: 'wheel',
			DOMMouseScroll: 'DOMMouseScroll'
		};
	for (var k in events) {
		if (k in doc) {
			event_name = events[k];
			break;
		}
	}
	if (!event_name)
		return this;
	
	function prevent_scroll(e) {
		e.preventDefault();
		e.stopPropagation();
	}
	
	return this.each(function() {
		var el = $(this).on(event_name, function (e) {
			var orig_event = e.originalEvent,
				cur_scroll = el[0].scrollTop,
				max_scroll = el[0].scrollHeight - el.outerHeight(),
				delta = -orig_event.wheelDelta;
			
			if (opts.allowTextarea) {
				var focused = document.activeElement;
				if (focused && focused.tagName.toUpperCase() == "TEXTAREA")
					return;
			}
			
			if (isNaN(delta))
				delta = orig_event.deltaY;
			var direction = delta < 0;
			if ((direction && cur_scroll <= 0) || (!direction && cur_scroll >= max_scroll)) {
				prevent_scroll(e);
			} else if (mustdie) {
				if (direction && -delta > cur_scroll) {
					el[0].scrollTop = 0;
					prevent_scroll(e);
				} else if (!direction && delta > max_scroll - cur_scroll) {
					el[0].scrollTop = max_scroll;
					prevent_scroll(e);
				}
			}
		});
	});
};

export default $;
