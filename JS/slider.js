import require from 'require';
import module from 'module';
import $ from './jquery';
import Device from './device';
import {Class, TSimpleEvents} from './class';
import {Spaces, Url, Codes} from './spacesLib';
import page_loader from './ajaxify';
import {tick, L, extend} from './utils';
import * as sidebar from './widgets/swiper';
import GALLERY from './gallery';

var last_frame_time = 0;

/*
	Горизонтальная карусель
*/
var Carousel = Class({
	MAX_OVERSCROLL: 0.2,
	SCROLL_MODE: {
		POSITIONAL: 0,
		NATIVE_SCROLL: 1
	},
	STATE: {
		START: 0,
		MOVE: 1,
		END: 2
	},
	SELECT_SIZE: 30,
	
	Static: {className: 'Carousel'},
	
	Implements: [TSimpleEvents],
	Constructor: function (element) {
		var self = this;
		self.operations = {};
		self.el = element;
		self._animate_queue = [];
		self.markSelectionFix = false;
		
		/* TODO: вынести в Device */
		var m = navigator.userAgent.match(/AppleWebKit\/([\d\.]+)/);
		self.dev = {
			touch: 'ontouchstart' in window || navigator.msMaxTouchPoints > 0,
			transition: Device.css('transition'),
			transform: Device.css('transform', 'translatez(0)', /translate/i),
			webkit: m ? m[1] : 0,
			support3d: false
		};
		
		self.dev.nativeScrollAccel = Device.type != 'desktop';
		self.dev.svg = document.implementation && document.implementation.hasFeature("http://www.w3.org/TR/SVG11/feature#Image", "1.1");
		
		if (self.dev.transition) {
			var trans_end = {
				'webkitTransition': 'webkitTransitionEnd',
				'msTransition': 'MSTransitionEnd',
				'mozTransition': 'mozTransitionEnd',
				'oTransition': 'oTransitionEnd otransitionend'
			};
			self.dev.transitionEnd = trans_end[self.dev.transition] || 'transitionend';
			self.dev.support3d = self.dev.transitionEnd && self.dev.transform;
		}
		self._last_state = this.STATE.START;
		self._pos = [];
		self.cur_scroll = 0;
		
		self.scroll_mode = (Device.type == 'touch' && (self.dev.nativeScrollAccel || !self.dev.support3d)) ?
			self.SCROLL_MODE.NATIVE_SCROLL : self.SCROLL_MODE.POSITIONAL;
		self.check();
	},
	
	_setup: function () {
		var self = this;
		
		if (!self.cb_on_resize) {
			self.cb_on_resize = function () {
				self.check();
			};
			$(window).on('resize', self.cb_on_resize);
			page_loader.push('shutdown', function () {
				if (self.cb_on_mousedown)
					$(document).off('mousedown', self.cb_on_mousedown);
				$(window).off('resize', self.cb_on_resize);
			});
		}
		
		self.el.addClass('hide');
		self.el.addClass('carousel');
		self.el.toggleClass('carousel-bg', !!self.el.data('bg') || self.el.data('bg') === undefined);
		
		if (self.scroll_mode == self.SCROLL_MODE.NATIVE_SCROLL)
			self.el.addClass('carousel-native_scroll');
		else if (self.scroll_mode == self.SCROLL_MODE.POSITIONAL)
			self.el.addClass('carousel-positional');
		
		self.wrap = self.el.find('.carousel-wrap');
		self.screen = self.el.find('.carousel-screen');
		
		var first_init = false;
		if (!self.el.hasClass('carousel-inited')) {
			if (!self.screen.length) {
				var childs = self.el.children(),
					wrap_code = '<div class="carousel-wrap"></div>';
				childs.length > 0 ? childs.wrapAll(wrap_code) : self.el.append(wrap_code);
				self.wrap = self.el.find('.carousel-wrap');
				self._setupHandlers(self.wrap);
				
				self.wrap.wrap('<div class="carousel-screen"></div>');
				self.screen = self.el.find('.carousel-screen');
				
				self.wrap.children().each(function () {
					$(this).wrap('<div class="carousel-item">');
				});
			}
			
			// на FF какие-то странные баги с mask :(
			var css_mask = (self.screen.css("-webkit-mask-image"));
			if (css_mask)
				self.screen.addClass('carousel-mask');
			
			var $shadow = $('<div class="carousel-shadow"></div>');
			self.el.append($shadow);
			
			self.prev = $('<div class="carousel-prev"><div class="ico_buttons ico_buttons_prev"></div>' +
				(!css_mask ? '<img src="' + ICONS_BASEURL + 'carousel-shadow_prev.' + (self.dev.svg ? 'svg' : 'png') + 
						'" class="carousel-edges_shadow" />' : '') + 
			'</div>');
			self.next = $('<div class="carousel-next"><div class="ico_buttons ico_buttons_next"></div>' +
				(!css_mask ? '<img src="' + ICONS_BASEURL + 'carousel-shadow_next.' + (self.dev.svg ? 'svg' : 'png') + 
						'" class="carousel-edges_shadow" />' : '') + 
			'</div>');
			
			self.screen.append(self.prev).append(self.next);
			
			self.prev.on('click', function (e) {
				e.preventDefault();
				if (self.markSelectionFix) {
					var evt = e.originalEvent || e,
						cur_x = evt.touches ? evt.touches[0].clientX : e.pageX,
						cur_y = evt.touches ? evt.touches[0].clientY : e.pageY;
					var i;
					if ((i = self._isMarkClick(cur_x, cur_y, -1)) !== false) {
						self.get(i).click();
						return;
					}
				}
				self.move(-(self.screen.innerWidth() * 0.9), {fixEdges: true, fixEdgesByDir: true});
			});
			self.next.on('click', function (e) {
				e.preventDefault();
				if (self.markSelectionFix) {
					var evt = e.originalEvent || e,
						cur_x = evt.touches ? evt.touches[0].clientX : e.pageX,
						cur_y = evt.touches ? evt.touches[0].clientY : e.pageY;
					var i;
					if ((i = self._isMarkClick(cur_x, cur_y, 1)) !== false) {
						self.get(i).click();
						return;
					}
				}
				self.move(self.screen.innerWidth() * 0.9, {fixEdges: true, fixEdgesByDir: true});
			});
			
			self.wrap.on('click', '.carousel-item', function (e) {
				if (self._slider_in_drag) {
					e.preventDefault();
					e.stopPropagation();
					e.stopImmediatePropagation();
					return;
				}
				
				if (!self._trigger('selectSlide', [this])) {
					e.preventDefault(); e.stopPropagation();
					e.stopImmediatePropagation();
				}
			});
			
			if (self.scroll_mode == self.SCROLL_MODE.POSITIONAL || !self.dev.nativeScrollAccel) {
				if (self.scroll_mode == self.SCROLL_MODE.NATIVE_SCROLL)
					self.wrap.css('overflow', 'hidden');
				
				self.screen.on("dragstart", function() {
					 return false;
				});
				var on_mouse_down = function (e) {
					var touches = e.originalEvent.touches;
					if ((e.type == 'mousedown' && e.which != 1) || (touches && touches.length > 1))
						return;
					
					if (self._in_animation)
						self._in_animation = false;
					
					// Очень странная магия для расчёта ускорения
					var velocity = 0, last_velocity_time = Date.now(), last_velocity_x = self.cur_scroll;
					var calc_velocity = function (x, force) {
						var now = Date.now(), elapsed = now - last_velocity_time;
						if (force || elapsed >= 100) {
							var delta = Math.abs(x - last_velocity_x);
							if (elapsed > 200) {
								// Остановились на долго? Значит это обычное предвижение, а не бросок. 
								velocity = 0;
							} else {
								var v = delta * 1000 / (1 + elapsed);
								velocity = 0.8 * v + 0.2 * velocity; // расчитываем скорость с учётом ускорения
								last_velocity_time = Date.now();
								last_velocity_x = x;
							}
						}
					};
					var on_move = function (e) {
						
						e.stopPropagation && e.stopPropagation();
						e.preventDefault && e.preventDefault();
						
						var evt = e.originalEvent || e,
							x = evt.touches ? evt.touches[0].clientX : e.pageX;
						
						if (self.last_x - x == 0 && !self._slider_in_drag) {
							// IE11 и тут отличился
							return;
						}
						
						self.move(self.last_scroll + (self.last_x - x), {abs: true, noAnimate: true});
						if (self.scroll_mode == self.SCROLL_MODE.POSITIONAL)
							calc_velocity(self.cur_scroll);
						
						if (!self._slider_in_drag) {
							self._slider_in_drag = true;
							$shadow.show();
						}
						
						return false;
					};
					var on_end = function (e) {
						if (self.screen[0].removeEventListener)
							self.screen[0].removeEventListener('touchmove', on_move);
						
						if (self.scroll_mode == self.SCROLL_MODE.POSITIONAL)
							calc_velocity(self.cur_scroll, true);
						
						$(window).off('.spCarouselDrag');
						$(document).off('.spCarouselDrag');
						
						tick(function () { $shadow.hide(); });
						
						if (self._slider_in_drag) {
							self._slider_in_drag = false;
							var cur_pos = self.cur_scroll,
								dir = self.last_scroll == cur_pos ? 0 : (self.last_scroll < cur_pos ? 1 : -1);
							
							if (self.scroll_mode == self.SCROLL_MODE.POSITIONAL) {
								var new_distance = velocity / 1000 * 400;
								if (new_distance > 10) {
									self.move(new_distance * dir, {fixEdges: true, fixEdgesByDir: true, delay: 250, inertia: true});
								} else {
									self._fixPosition(dir);
								}
							} else {
								self._fixPosition(dir);
							}
						}
					};
					
					$(document).on('mousemove.spCarouselDrag', on_move);
					if (self.screen[0].addEventListener) {
						self.screen[0].addEventListener('touchmove', on_move, false);
					} else {
						self.screen.on('touchmove.spCarouselDrag', on_move);
					}
					
					$(document).one('mouseup', on_end);
					self.screen.one('touchcancel touchend', on_end);
					
					self.last_x = touches ? touches[0].clientX : e.pageX;
					self.last_scroll = self.cur_scroll;
					self.last_scroll_time = new Date;
				};
				self.screen.on('mousedown touchstart', on_mouse_down);
			} else if (self.scroll_mode == self.SCROLL_MODE.NATIVE_SCROLL) {
				self.screen.on('touchstart', function (e) {
					var touches = e.originalEvent.touches,
						pos = {
							x: touches ? touches[0].clientX : e.pageX,
							y: touches ? touches[0].clientY : e.pageY
						};
					
					self.screen.removeProp("_sliderOnClick");
					
					var btns = [self.prev, self.next];
					for (var i = 0; i < btns.length; ++i) {
						var btn = btns[i], ico = btn.find('.ico_buttons');
						if (btn.css("display") != "none") {
							
							var p = ico.offset(), w = ico.outerWidth(),
								min_x = p.left - parseInt(btn.css("width").replace("px", "")),
								max_x = p.left + parseInt(btn.css("width").replace("px", ""));
							if (i == 0) {
								min_x = self.screen.offset().left;
							} else {
								max_x = self.screen.offset().left + self.screen.outerWidth();
							}
							if (min_x <= pos.x && pos.x <= max_x) {
								self.screen.prop("_sliderOnClick", ico);
								
							}
						}
					}
					
					var touch_moved = false;
					self.screen.one('touchmove', function (e) {
						touch_moved = true;
					});
					
					sidebar.lock(true);
					self.screen.one('touchcancel touchend', function () {
						sidebar.lock(false);
						if (!touch_moved) {
							var override_onclick = self.screen.prop("_sliderOnClick")
							if (override_onclick) {
								self.screen.removeProp("_sliderOnClick");
								override_onclick.click();
								return false;
							}
						}
					});
				});
				
				self.wrap.scroll(function (e) {
					if (!self._in_jquery_animation)
						self._onresize(self.cur_scroll = self.wrap.scrollLeft());
				});
			}
			self.el.addClass('carousel-inited');
			
			var start_time = Date.now(), tries = 0;
			var wait_init = function () {
				var now = Date.now();
				if (self.el[0]) {
					if (self.el.css("display") == "none") {
						if (now - start_time > 30000) {
							setTimeout(wait_init, 10000);
						} else if (now - start_time > 5000) {
							setTimeout(wait_init, 1200);
						} else {
							setTimeout(wait_init, 500);
						}
					} else {
						self.update(true);
						self.check();
					}
				}
			};
			setTimeout(wait_init, 0);
			
			//	if (self.dev.support3d) {
			//		self.wrap.on(self.dev.transitionEnd, function (e) {
			//			return self._transitionEnd(e);
			//		});
			//	}
			
			first_init = true;
		}
		
		if (first_init)
			self._trigger('sliderInit', []);
	},
	
	move: function (pos, opts) {
		opts = opts || {};
		var self = this;
		if (!self.overflow || !self._pos.length)
			return self;
		
		if (self._in_animation)
			self._in_animation = false;
		
		while (true) {
			var old_scroll = self.cur_scroll,
				new_scroll = Math.floor(opts.abs ? pos : old_scroll + pos),
				max_scroll = self.max_width - self.screen.innerWidth(),
				min_scroll = 0;
			
			if (opts.abs && self._slider_in_drag ) {
				max_scroll += self.MAX_OVERSCROLL * self.screen.innerWidth();
				min_scroll -= self.MAX_OVERSCROLL * self.screen.innerWidth();
			}
			
			if (new_scroll > max_scroll)
				new_scroll = max_scroll;
			if (new_scroll < min_scroll)
				new_scroll = min_scroll;
			
			if (opts.fixEdges) {
				/*
				var rect = self._getRect(-new_scroll),
					direction = opts.direction || pos;
				
				if (!opts.fixEdgesByDir || direction < 0) {
					var left = self._findItem(-new_scroll);
					if (left > -1)
						new_scroll = -self._pos[left].x;
					opts.time = 100;
				}
				
				if (!opts.fixEdgesByDir || direction > 0) {
					var right = self._findItem(rect.x + rect.w);
					if (right > -1)
						new_scroll = -(self._pos[right].x - rect.w + self._pos[right].w);
					opts.time = 100;
				}
				*/
				if (self._pos.length > 0) {
					var direction = opts.direction || pos,
						first = self._pos[0], last = self._pos[self._pos.length - 1];
					if (first && last) {
						if ((!opts.fixEdgesByDir || direction < 0) && first.x + first.w * 0.5 >= new_scroll)
							new_scroll = 0;
						if ((!opts.fixEdgesByDir || direction > 0) && max_scroll - last.w <= new_scroll)
							new_scroll = max_scroll;
					}
				}
			}
			
			if (!self._onresize(new_scroll))
				continue;
			self._animate(new_scroll, !!opts.noAnimate, opts.time, !!opts.inertia);
			
			break;
		}
		return self;
	},
	_fixPosition: function (dir) {
		var self = this;
		return self.move(0, {fixEdges: true, direction: dir || 0, fixEdgesByDir: !!dir});
	},
	_isMarkClick: function (cur_x, cur_y) {
		var self = this, base = self.wrap.offset();
		if (base) {
			var part = self.SELECT_SIZE / 2,
				y = self.padding.top + base.top - part;
			if (cur_y >= y && cur_y <= y + self.SELECT_SIZE) {
				for (var i = 0; i < self._pos.length; ++i) {
					var p = self._pos[i],
						x = base.left + p.x + p.w - part;
					if (cur_x >= x && cur_x <= x + self.SELECT_SIZE)
						return i;
				}
			}
		}
		return false;
	},
	
	_animate: function (x, no_animate, time, inertia_simulate) {
		time = time || 500;
		
		var self = this;
		
		if (self.scroll_mode == self.SCROLL_MODE.NATIVE_SCROLL) {
			time = time || 250;
			
			var distance = (x - self.cur_scroll);
			self.cur_scroll = self.wrap.scrollLeft() + distance;
			if (inertia_simulate)
				throw "Inertia not supported in native scroll!";
				
			if (self._in_jquery_animation) {
				cancelAF(self._in_jquery_animation);
				self._in_jquery_animation = false;
			}
			
			if (no_animate) {
				self.cur_scroll = self.wrap.scrollLeft(x).scrollLeft();
			} else {
				var last_time = Date.now(), start = self.cur_scroll - distance;
				var scroll = function () {
					var elapsed = Date.now() - last_time;
					if (elapsed >= time) {
						self._in_jquery_animation = false;
						self.wrap[0].scrollLeft = start + distance;
						self.cur_scroll = self.wrap[0].scrollLeft;
					} else {
						var cur = distance * (elapsed / time);
						self.wrap[0].scrollLeft = start + cur;
						requestAF(scroll);
					}
				};
				self._in_jquery_animation = requestAF(scroll);
			}
		} else if (self.scroll_mode == self.SCROLL_MODE.POSITIONAL) {
			if (inertia_simulate) {
				time = 200;
				
				var last_time = Date.now(), distance = x - self.cur_scroll,
					style = self.wrap.prop("style");
				
				self._in_animation = true;
				var inertia = function () {
					if (!self._in_animation)
						return;
					
					var elapsed = Date.now() - last_time,
						delta = -distance * Math.exp(-elapsed / time);
					if (delta > 4 || delta < -4) {
						self.cur_scroll = Math.floor(x + delta);
						if (self.dev.support3d) {
							style[self.dev.transform] = 'translate3d(' + -self.cur_scroll + 'px' + ', 0px, 0px)';
							style[self.dev.transition] = '';
						} else {
							style.left = -self.cur_scroll + 'px';
						}
						requestAF(inertia);
					} else {
						self._in_animation = false;
						self._fixPosition(distance == 0 ? 0 : (distance < 0 ? -1 : 1));
					}
				};
				requestAF(inertia);
				return self;
			}
			
			if (self.dev.support3d) {
			//	if (self._in_transition) {
			//		self._animate_queue.push([x, no_animate]);
			//		return;
			//	}
			//	self._in_transition = true;
				if (self.cur_scroll != x) {
					var style = self.wrap[0].style;
					if (no_animate || !self.wrap.isVisible()) {
						style[self.dev.transform] = 'translate3d(' + -x + 'px' + ', 0px, 0px)';
						style[self.dev.transition] = '';
				//		self._transitionEnd();
					} else {
						style[self.dev.transform] = 'translate3d(' + -x + 'px' + ', 0px, 0px)';
						style[self.dev.transition] = (time / 1000) + 's';
					}
				} else {
				//	self._transitionEnd();
				}
			} else {
				var style = self.wrap[0].style;
				if (no_animate) {
					if (self.dev.transition)
						style[self.dev.transition] = '';
					style.left = -x + 'px';
				} else {
					if (self.dev.transition) {
						style.left = -x + 'px';
						style[self.dev.transition] = (time / 1000) + 's';
					} else {
						self.wrap.animate({left: -x + 'px'}, time);
					}
				}
			}
			self.cur_scroll = x;
		}
		return self;
	},
	_getMetricts: function (required) {
		var self = this;
		
		if (!self.wrap[0].offsetWidth) { // типа :visible
			self._dirty_metrics = true;
			return self;
		}
		
		if (self._upd_start === null || !self._pos.length) {
			self.max_width = 0;
			self.max_inner_width = 0;
			self._pos = [];
			
			self.wrap.css({width: "auto"});
			self.padding = {
				left:   parseInt(self.wrap.css('padding-left')),
				right:  parseInt(self.wrap.css('padding-right')),
				top:    parseInt(self.wrap.css('padding-top')),
				bottom: parseInt(self.wrap.css('padding-bottom'))
			};
			
			var childs = self.wrap.children();
			self.max_width = self.padding.left;
			for (var i = 0, x = 0; i < childs.length; ++i) {
				var w = $(childs[i]).outerWidth(true);
				self._pos.push({x: self.max_width - self.padding.left, locX: self.max_width, w: w});
				self.max_width += w; self.max_inner_width += w;
			}
			self.max_width += self.padding.right;
			
			self._upd_start = null;
		} else {
			var total = self.total(),
				childs = self.wrap.children(),
				first = self._pos[self._upd_start - 1];
			
			self.max_width = first ? first.locX + first.w : self.padding.left;
			self.max_inner_width = first ? first.x + first.w : 0;
			
			for (var i = self._upd_start; i < total; ++i) {
				var p = self._pos[i], w;
				if (p) {
					w = p.w;
					p.x = self.max_width - self.padding.left;
					p.locX = self.max_width;
				} else {
					w = $(childs[i]).outerWidth(true);
					var pos = {
						w: w,
						x: self.max_width - self.padding.left,
						locX: self.max_width
					};
					if (p === undefined) {
						self._pos.push(pos);
					} else {
						self._pos[i] = pos;
					}
				}
				self.max_width += w; self.max_inner_width += w;
			}
			self.max_width += self.padding.right;
			
			if (self._pos.length > total) {
				self._pos = self._pos.splice(0, total);
				if (!total) {
					self._pos = [];
					self.max_width = self.max_inner_width = 0;
				}
			}
			
			self._upd_start = null;
		}
		
		
		if (self.scroll_mode == self.SCROLL_MODE.POSITIONAL) {
			var style = self.wrap[0].style, w = (self.max_inner_width + 2) + 'px';
			if (style.width != w)
				style.width = w;
		} else if (self.scroll_mode == self.SCROLL_MODE.NATIVE_SCROLL) {
			self.cur_scroll = self.wrap.position().left;
		}
		
		return self;
	},
	_getRect: function (x) {
		var self = this;
		x = x || 0;
		return {x: x + self.padding.left, w: self.screen.innerWidth() - self.padding.left - self.padding.right};
	},
	isVisible: function (n) {
		var self = this;
		if (n >= 0 && n < self.total() && self._pos.length) {
			var m = self._pos[n], sw = self.screen.innerWidth(),
				rect = self._getRect(self.cur_scroll);
			if (m.locX >= rect.x && m.locX + m.w <= rect.x + rect.w)
				return 0;
			if (m.locX <= rect.x && m.locX + m.w >= rect.x)
				return -1;
			if (m.locX <= rect.x + rect.w && m.locX + m.w >= rect.x + rect.w)
				return 1;
		}
		return false;
	},
	_findItem: function (x) {
		var self = this;
		for (var i = 0; i < self._pos.length; ++i) {
			var p = self._pos[i];
			if ((i == 0 || p.x <= x) && (i == self._pos.length - 1 || x <= p.x + p.w))
				return i;
		}
		return -1;
	},
	_onresize: function (current_pos) {
		var self = this;
		
		if (!self.max_width || self._dirty_metrics) {
			self._dirty_metrics = false;
			self._getMetricts();
		}
		
		if (typeof current_pos != "number")
			current_pos = self.cur_scroll;
		
		if (self._pos.length > 0) {
			self.overflow = self.max_width > self.screen.innerWidth();
			var show_prev = self.overflow && current_pos > 0,
				show_next = self.overflow && current_pos < self.max_width - self.screen.innerWidth();
			self.prev.visible(show_prev);
			self.next.visible(show_next);
			
			var state;
			if (!show_prev)
				state = self.STATE.START;
			else if (!show_next && show_prev)
				state = self.STATE.END;
			else
				state = self.STATE.MOVE;
			
			if (self._last_state != state) {
				self._last_state = state;
				if (state == self.STATE.END) {
					var old_total = self.total();
					var ret = self._trigger('sliderEnd', []);
					if (old_total != self.total()) {
						self._onresize(current_pos);
						return false;
					}
					return true;
				}
			}
		} else {
			if (self.overflow) {
				self.overflow = false;
				self.prev.visible(false);
				self.next.visible(false);
			}
		}
		return true;
	},
	_setupHandlers: function (el) {
		var self = this;
	//	el.find('img').on('load', function () {
	//		self._onresize();
	//	});
	},
	replace: function (pos, el) {
		var self = this;
		if (pos < 0 || pos >= self.total())
			return;
		self._setupHandlers(el);
		$(self.wrap.children()[pos]).empty().append(el);
		self._recalc(pos);
		self.operations.replace = 1;
		return self;
	},
	_recalc: function (offset, n) {
		var self = this;
		if (self._upd_start === null)
			self._upd_start = self.total();
		if (offset < self._pos.length)
			self._pos[offset] = null;
		self._upd_start = Math.min(self._upd_start, offset);
		return self;
	},
	
	insertSpinners: function (n) {
		var self = this, html = '', total = self.total();
		for (var i = 0; i < n; ++i) {
			html += `
				<div class="carousel-item">
					<div
						${self._gallery_gid ? ' g="0|0|' + self._gallery_gid + '"' : ''}
						style="width:${self.stub_size.width}px;height:${self.stub_size.height}px"
						class="spinner preview ${(self._gallery_gid ? 'gview_link' : '')}"
						data-preloader="1"
					>
						<span class="carousel-plc"></span>
						<span class="carousel-plcd">
							<span class="carousel-preloader"></span>
						</span>
					</div>
				</div>
			`;
			self._recalc(total - 1 + n);
		}
		self.operations.insert = 1;
		self.wrap.append(html);
		return self;
	},
	insert: function (el, place, pos) {
		var self = this, wrap = self._wrap(el), total = self.total();
		self._setupHandlers(el);
		
		var places_normal = {
			start: "prepend",
			end: "append"
		};
		var places_positional = {
			after: "insertAfter",
			before: "insertBefore"
		};
		
		place = place || 'end';
		
		if (place == "after" && pos == total - 1)
			place = "end";
		if (place == "before" && pos == 0)
			place = "start";
		
		if (places_normal[place]) {
			self.wrap[places_normal[place]](wrap);
			if (place == 'start') {
				self._recalc(0);
			} else if (place == 'end') {
				self._recalc(total - 1);
			}
			self.operations.insert = 1;
		} else if (places_positional[place]) {
			if (pos < 0 || pos >= self.total())
				return;
			self.operations.insert = 1;
			// TODO: юзануть правильно _recalc
			wrap[places_positional[place]](self.wrap.children()[pos]);
		}
		return self;
	},
	removeAll: function () {
		var self = this;
		while (self.total())
			self.pop();
		return self;
	},
	remove: function (n) {
		var self = this;
		if (n < 0 || n >= self.total())
			return;
		self.operations.remove = 1;
		$(self.wrap.children()[n]).remove();
		self._recalc(n);
		return self;
	},
	_wrap: function (el) {
		var wrap = $('<div class="carousel-item">');
		wrap.append(el);
		return wrap;
	},
	pop: function () {
		var self = this;
		return self.remove(self.total() - 1);
	},
	get: function (n, limit, children) {
		var self = this;
		if (n < 0 || n >= self.total())
			return null;
		limit = limit || 1;
		if (limit <= 1) {
			return $(self.wrap.children()[n]);
		} else {
			var res = [];
			for (var i = n, l = Math.min(n + limit, self.total()); i < l; ++i) {
				var el = $(self.wrap.children()[i]);
				res.push(children ? el.children()[0] : el);
			}
			return res;
		}
	},
	scroll: function (id, no_animate, direction) {
		var self = this,
			pos = self._pos[id];
		
		if (self._slider_in_drag || !pos)
			return self;
		
		direction = direction || 0;
		var x, fix_edges = direction == 0;
		if (direction > 0) {
			var rect = self._getRect(self.cur_scroll);
			x = pos.x + pos.w - rect.w;
		} else {
			x = pos.x;
		}
		return self.move(x, {fixEdges: fix_edges, abs: true, noAnimate: !!no_animate});
	},
	scrollEnd: function (no_animate) {
		return this.scroll(this.total() - 1, no_animate);
	},
	scrollStart: function (no_animate) {
		return this.scroll(0, no_animate);
	},
	update: function (force) {
		var self = this, op = self.operations;
		if (force || op.remove || op.insert || op.replace)
			self._getMetricts(true).check();
		if (op.remove)
			self._fixPosition();
		self.operations = {};
		return self;
	},
	isOverflowed: function () {
		var self = this;
		return !!self.overflow;
	},
	check: function () {
		var self = this;
		if (!self.wrap || !self.wrap.parent().length)
			self._setup();
		if (self.scroll_mode == self.SCROLL_MODE.NATIVE_SCROLL)
			self.cur_scroll = self.wrap.scrollLeft();
		self._onresize();
		return self;
	},
	total: function () {
		return this.wrap.children().length;
	}
});
window.Carousel = Carousel;

/*
	Слайдер с подгрузкой на основе Carousel
*/
var LoadableCarousel = Class({
	Extends: Carousel,
	Static: {
		FILES: 0,
		DATING: 1,
		className: 'LoadableCarousel'
	},
	Constructor: function (el, opts) {
		var self = this;
		
		el = $(el);
		Carousel.apply(self, [el]);
		
		if (!opts.adapter)
			throw "Adapter is not set!";
		self._adapter = new opts.adapter(self, opts.adapterOpts);
		self.size_class = "";
		
		// Общие опции
		self.lc_opts = $.extend(true, {
			total: 0,
			select: false,
			firstLoad: true,
			gallery: true,
			apiData: {},
			hasMore: !self.total(),
			limit: self.total()
		}, self._adapter.params(), opts);
		self.markSelectionFix = self.lc_opts.select;
		
		self.check();
		self._setupLoader();
	},
	resetItems: function (load_next) {
		var self = this;
		self.removeAll();
		self._adapter.reset();
		self.update();
		return self;
	},
	_setupGallery: function (gid) {
		var self = this;
		
		if (self._gallery_gid)
			return self;
		
		self._gallery_gid = gid;
		
		var last_scroll = null;
		if (self.lc_opts.gallery) {
			GALLERY.onGroup(gid, 'load', function (e) {
				self._go_next = e.dir;
				GALLERY.addPhoto(); // invalidate
				GALLERY.update(true);
			});
			GALLERY.onGroup(gid, 'list', function (e) {
				last_scroll = e.current;
				var pct = e.current / self.total() * 100;
				if (pct > 69) {
					// if (e.current == e.total - 1)
						// GALLERY.setLoading(true);
					self.loadNextPhotos(function () {
						GALLERY.setLoading(false);
					//	if (self._go_next) {
					//		GALLERY.move(self._go_next);
					//		self._go_next = false;
					//	}
					});
					GALLERY.addPhoto(); // invalidate
					GALLERY.update(true);
				}
			});
			if (self._adapter.avail())
				GALLERY.setGroupVisibleCount(gid, self._adapter.total());
			GALLERY.onGroup(gid, 'exit', function (e) {
				self.update(true);
				if (last_scroll !== null) {
					var visible = self.isVisible(last_scroll);
					if (visible !== 0)
						self.scroll(last_scroll, true, visible);
				}
				last_scroll = null;
			});
			
			GALLERY.reopen();
		}
		
		return self;
	},
	_setupLoader: function () {
		var self = this;
		
		self._adapter.setup();
		
		self.on('sliderEnd', function () {
			self.loadNextPhotos();
		});
		
		if (self.lc_opts.select) {
			self.on('selectSlide', function (slide) {
				slide = $(slide);
				if (slide.data('preloader'))
					return false;
				var slide = $(slide), data_wrap = slide.children().first(),
					file_meta = Spaces.core.extractFile(data_wrap);
				
				self.toggleSelected(file_meta.nid);
				return self._trigger('selectFile', [data_wrap, file_meta]);
			});
		}
		
		if (self.lc_opts.gallery) {
			var etalon_slider = self.get(0);
			if (etalon_slider) {
				var meta = Spaces.File.getMeta(etalon_slider.children().first());
				if (meta)
					self._setupGallery(meta.gid);
			}
		}
		
		if (!self.total() && self.lc_opts.firstLoad) {
			self.firstLoad();
		} else {
			if (self.lc_opts.gallery)
				require.component("gallery");
		}
	},
	firstLoad: function () {
		var self = this;
		if (!self.total() && self.lc_opts.firstLoad) {
			self.loadNextPhotos(function () {
				self._trigger('firstPhotosLoad', []);
			});
		}
		return self;
	},
	_findSizeClass: function () {
		var self = this;
		if (self.total() > 0) {
			let first_item = self.get(0);
			self.stub_size = {
				width:	first_item.outerWidth(),
				height:	first_item.outerHeight()
			};
		} else {
			self.stub_size = {
				width:	80,
				height:	80
			};
		}
	},
	loadNextPhotos: function (callback) {
		var self = this, has_spinner;
		
		if (!self._adapter.avail()) {
			callback && callback();
			return;
		}
		
		if (!self._first_load)
			self._findSizeClass();
		
		var cur_offset = self.total(), total = self._adapter.total();
		var preload_cnt = total > 0 ? Math.min(total, self.lc_opts.limit) : self.lc_opts.limit;
		self.insertSpinners(preload_cnt);
		self.update();
		
		self._adapter.loadData(function (res) {
			var rendered = self._adapter.render(res, cur_offset);
			
			if (rendered < preload_cnt) {
				var overhead = preload_cnt - rendered;
				for (var i = 0; i < overhead; i++)
					self.remove(self.total() - 1);
			}
			
			if (!self._first_load) {
				self._findSizeClass();
				self._first_load = true;
			}
			
			self.update();
			if (self.lc_opts.gallery) {
				import("./gallery").then(({default: GALLERY}) => {
					if (self._gallery_gid)
						GALLERY.setGroupVisibleCount(self._gallery_gid, self._adapter.avail() ? self._adapter.total() : null);
					
					GALLERY.addPhoto();
					GALLERY.update(true);
					
					if (res.viewerInfo)
						GALLERY.setViewerInfo(self._gallery_gid, res.viewerInfo);
				});
			} else {
				self.el.find('.gview_link').removeClass('gview_link');
			}
			
			callback && callback();
			self._trigger('photosLoadChunk', [cur_offset, self.lc_opts.limit]);
		}, function (e) {
			if (self.lc_opts.gallery) {
				import("./gallery").then(({default: GALLERY}) => {
					GALLERY.setGroupError(self._gallery_gid, e.message ? e.message : L("Ошибка загрузки. "), function () {
						e.retry();
					});
				});
			}
			
			self._trigger('loadError', [e]);
			
			callback && callback();
		}, cur_offset, self.lc_opts.limit);
	},
	totalItems: function () {
		return this._adapter.total();
	},
	markSelected: function (file_id) {
		return this.toggleSelected(file_id, true);
	},
	isSelected: function (file_id) {
		var self = this;
		var el = self.el.find('[G^="' + file_id + '|"]')
			.parents('.carousel-item').find('.ico_buttons_select, .ico_buttons_selected').first();
		return el.hasClass('ico_buttons_selected');
	},
	toggleSelected: function (file_id, flag) {
		var self = this;
		var el = self.el.find('[G^="' + file_id + '|"]')
			.parents('.carousel-item').find('.ico_buttons_select, .ico_buttons_selected').first();
		
		if (!self.lc_opts.multiple) {
			self.el.find('.ico_buttons_selected')
				.removeClass('ico_buttons_selected')
				.addClass('ico_buttons_select');
		}
		
		var old_state = el.hasClass('ico_buttons_select');
		if (flag !== undefined ? flag : old_state) {
			el.removeClass('ico_buttons_select');
			el.addClass('ico_buttons_selected');
		} else {
			el.removeClass('ico_buttons_selected');
			el.addClass('ico_buttons_select');
		}
		return !old_state;
	},
	getSelected: function (file_id, flag) {
		var self = this, ret = [];
		self.el.find('.ico_buttons_selected').each(function () {
			ret.push($(this).parent().children().first());
		});
		return ret;
	},
	hasSelected: function (file_id, flag) {
		return this.el.find('.ico_buttons_selected').length > 0;
	}
});
window.LoadableCarousel = LoadableCarousel;

/*
	Базовый адаптер данных для слайдера с подгрузкой
*/
var CarouselDataAdapter = Class({
	Constructor: function (slider, opts) {
		var self = this;
		self.opts = $.extend({}, opts);
		self.slider = slider;
		self.default_opitons = {};
		self.initialize && self.initialize();
	},
	setup: function () {
		var self = this, opts = self.slider.lc_opts;
		self._total = opts.total;
		self._avail = opts.hasMore;
	},
	loadData: function (callback, onerror, offset, limit) { },
	render: function () { return ""; },
	params: function () { return this.default_options; },
	total: function () { return this._total; },
	avail: function () { return !!this._avail; },
	reset: function () {
		var self = this;
		self._total = 0;
		self._avail = true;
		return self;
	}
});
window.CarouselDataAdapter = CarouselDataAdapter;

/*
	Адаптер API абстрактного слайдера
*/
var AbstractCarouselAdapter = Class({
	Extends: CarouselDataAdapter,
	initialize: function () {
		var self = this;
		self.default_options = {
			apiMethod: 'files.getFiles',
			apiResult: "widgets"
		};
	},
	render: function (data, cur_offset) {
		var self = this,
			objects = data[self.slider.lc_opts.apiResult],
			slider = self.slider;
		for (var i = 0, item; i < objects.length; ++i) {
			if (objects[i] === null) {
				slider.get(i).children().first().attr('data-not-found', 1);
			} else {
				slider.replace(cur_offset + i, objects[i] + 
					(self.slider.lc_opts.select ? '<span class="ico_buttons ico_buttons_select"></span>' : ''));
			}
		}
		
		if (cur_offset == 0 && self.slider.lc_opts.gallery) {
			var item = slider.get(0).children().first(),
				meta = Spaces.File.getMeta(item);
			if (!meta)
				throw "Gallery group not found!";
			slider._setupGallery(meta.gid);
		}
		
		return objects.length;
	},
	setup: function () {
		CarouselDataAdapter.prototype.setup.apply(this, arguments);
		var self = this;
		self.slider.lc_opts.metric = self.slider.lc_opts.metric || self.getCarouselType();
	},
	getCarouselType: function () {
		var self = this,
			url = new Url(location.href),
			path = url.path.replace(/\/+/g, '/'),
			api_data = self.slider.lc_opts.apiData || {},
			method = self.slider.lc_opts.apiMethod;
		
		if (path == "/" || path.indexOf('/index') > -1) { // Главная
			if (api_data.Dir == 1690) { // Порнослайдер Фото
				return "main_photo";
			} else if (api_data.Dir == 4) { // Видео
				return "main_video";
			}
		} else if (path.indexOf("/anketa") > -1) { // Порнослайдер в анкете
			return "anketa_photo";
		} else if (path.indexOf("/sections") > -1) {
			if (method == "dating" && api_data.method == "search") {
				return "sections_datings";
			}
		}
		
		return path + "-" + (api_data.method || "") + "-" + method;
	},
	loadData: function (callback, onerror, offset, limit) {
		var self = this,
			api_data = extend({}, self.slider.lc_opts.apiData, {O: offset, L: limit});
		
		var self_callback = function () {
			return self.loadData(callback, onerror, offset, limit);
		};
		
		api_data.Defer_fetch = 0;
		api_data.Viewer = !!self.slider.lc_opts.gallery;
		
		Spaces.api(self.slider.lc_opts.apiMethod, api_data, function (res) {
			self.slider._trigger('apiResult', [res]);
			if (res.code == 0) {
				var widgets = res[self.slider.lc_opts.apiResult];
				
				if (offset + widgets.length >= res.count)
					self._avail = false;
				
				if (!widgets.length) {
					self._avail = false;
					self._total = offset + widgets.length;
					console.error("WTF??? Пришло неожиданное кол-во!", limit, "!=", widgets.length, " (offset: " + offset + ")");
				} else {
					self._total = res.count;
				}
				
				callback(res);
			} else {
				if (res.code == Codes.COMMON.ERR_FREQ_LIMITER || (res.code == Codes.AUTH.ERR_AUTH_ERROR && (res.auth_errror == 3 || res.auth_errror == 7))) {
					console.error(":(");
					setTimeout(function () {
						self_callback();
					}, 3000);
				} else {
					onerror && onerror({
						type: 'api',
						res: res,
						message: Spaces.services.processingCodes(res),
						retry: self_callback
					});
				}
			}
		}, {
			onError: function (error) {
				onerror && onerror({
					type: 'network',
					message: error,
					retry: self_callback
				});
			},
			GET: {
				carousel: self.slider.lc_opts.metric || null
			}
		});
	}
});

window.AbstractCarouselAdapter = AbstractCarouselAdapter;

var adapters = {
	'abstract': {
		adapter: AbstractCarouselAdapter
	}
};
$.fn.carousel = function (opts, carousel_type) {
	var el = this.first(), slider;
	if (!this.length)
		throw "Элемент карусели не найден!";
	carousel_type = carousel_type || 'abstract';
	if (!(slider = el.prop("__slider"))) {
		opts = opts || {};
		var type = carousel_type || el.data('type'), slider,
			adapter = adapters[type];
		el.removeData('type');
		if (adapter) {
			slider = new LoadableCarousel(el, $.extend(true, {}, adapter, el.data(), opts));
		} else {
			slider = new Carousel(el, opts);
		}
		el.prop("__slider", slider);
	}
	return slider;
};
$.fn.slider = function (opts) {
	return $.fn.carousel.apply(this, [opts, 'default']);
}

// Костыль для инерции в IE8
function requestAF(func) {
	if (window.requestAnimationFrame)
		return window.requestAnimationFrame(func);
	var now = Date.now(),
		timeout = 16 - Math.max(0, 16 - (now - last_frame_time));
	var id = setTimeout(func, timeout);
	last_frame_time = now + timeout;
	return id;
}

function cancelAF(id) {
	if (window.cancelAnimationFrame) {
		window.cancelAnimationFrame(id);
	} else {
		clearTimeout(id);
	}
}

function initCarousel(el) {
	tick(() => {
		if (el.className.indexOf('carousel-static') < 0)
			$(el).carousel();
	});
}

module.on("componentpage", function () {
	let carousels = $.queryClassAll('carousel');
	for (let i = 0, l = carousels.length; i < l; ++i)
		initCarousel(carousels[i]);
});
