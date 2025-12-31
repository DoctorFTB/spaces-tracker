import $ from './jquery';
import Device from './device';
import Spaces from './spacesLib';
import DdMenu from './dd_menu';
import './anim';
import './draggable';
import {L, pad, tick} from './utils';

var crop_window,
	MIN_CROP_SIZE = 100,
	is_device_touch = Device.type == 'touch',
	can_box_shadow = Device.css('box-shadow', true);

var tpl = {
	cropWindow: function (thumb_url) {
		var html =
			'<div class="content-bl content-bl__sep oh">' + 
				'<center class="' + (!is_device_touch ? 'hide' : '') + '">' + 
					'<a href="#" class="js-ava_crop_zoom_btn left" data-dir="-5">' + 
						'<span class="ico ico_minus"></span>' + 
					'</a>' + 
					'<span class="grey small js-ava_crop_zoom">100%</span>' + 
					'<a href="#" class="js-ava_crop_zoom_btn right" data-dir="5">' + 
						'<span class="ico ico_plus"></span>' + 
					'</a>' + 
				'</center>' + 
				'<table class="pad_t_a">' + 
					'<tr style="vertical-align: top">' + 
						'<td>' + 
							'<div class="ava_crop js-ava_crop_wrap">' + 
								'<div class="ava_crop-shadow_wrap">' + 
								(!can_box_shadow ? 
									'<div class="ava_crop-shadow"></div>' + 
									'<div class="ava_crop-shadow"></div>' + 
									'<div class="ava_crop-shadow"></div>' + 
									'<div class="ava_crop-shadow"></div>' : 
									'<div class="ava_crop-shadow_frame"></div>') + 
								'</div>' + 
								'<div class="ava_crop-frame">' + 
									'<div class="ava_crop-arrow_wrap">' + 
										'<div class="ava_crop-arrow se" data-dir="se"></div>' + 
										'<div class="ava_crop-arrow sw" data-dir="sw"></div>' + 
										'<div class="ava_crop-arrow ne" data-dir="ne"></div>' + 
										'<div class="ava_crop-arrow nw" data-dir="nw"></div>' + 
									'</div>' + 
								'</div>' + 
								'<div style="overflow:hidden"><img src="' + thumb_url + '" alt="" class="ava_crop-img" /></div>' + 
								'<div class="ava_crop-cursor"></div>' + 
							'</div>' + 
						'</td>' + 
						'<td class="js-ava_crop_thumbs' + (is_device_touch ? ' hide' : '') + '">' + 
							'<div class="ava_crop-thumb ava_crop-thumb_large">' + 
								'<img src="' + thumb_url + '" alt="" class="preview s129_128">' + 
							'</div><br />' + 
							'<div class="ava_crop-thumb ava_crop-thumb_small">' + 
								'<img src="' + thumb_url + '" alt="" class="preview s129_128">' + 
							'</div>' + 
						'</td>' + 
					'</tr>' + 
				'</table>' + 
			'</div>' + 
			'<div class="dropdown-menu default_txt">' + 
				'<table class="table__wrap">' + 
					'<tr>' + 
						'<td class="table__cell links-group links-group_grey table__cell_border" width="50%">' + 
							'<a href="#" class="list-link list-link-blue js-ava_crop_save">' + 
								'<span class="ico ico_ok_blue"></span>' + 
								'<span class="t">' + L('Сохранить') + '</span>' + 
							'</a>' + 
						'</td>' + 
						'<td class="table__cell links-group links-group_grey table__cell_last" width="50%">' + 
							'<a href="#" class="list-link js-dd_menu_close">' + 
								'<span class="t">' + L('Отмена') + '</span>' + 
							'</a>' + 
						'</td>' + 
					'</tr>' + 
				'</table>' + 
			'</div>';
		
		return html;
	}
};

var AvatarCrop = {
	destroy: function (content) {
		content.find('.ava_crop-thumbs .preview, .js-ava_crop_wrap').draggable(false);
		content.off().empty().removeData();
	},
	
	setup: function (content, params, callback) {
		var tmp_img = new Image();
		tmp_img.onload = function () {
			callback && callback(true);
			
			tick(() => {
				AvatarCrop.initCrop(content, tmp_img, params);
				tmp_img.onload = null;
				tmp_img = null;
			});
		};
		tmp_img.onerror = function () {
			tmp_img.onload = null;
			tmp_img = null;
			callback && callback(false);
		};
		tmp_img.src = params.image;
		tmp_img.srcset = params.image_2x ? `${params.image}, ${params.image_2x} 1.5x` : '';
	},
	initCrop: function (content, image, params) {
		content.html(tpl.cropWindow(image.src));
		$(window).on('resize.oneRequest', function () {
			on_resize();
		});
		
		var wrap = content.find('.js-ava_crop_wrap'),
			img = content.find('.ava_crop-img'),
			frame = content.find('.ava_crop-frame'),
			shadow_frame = content.find('.ava_crop-shadow_frame'),
			shadows = content.find('.ava_crop-shadow'),
			shadows_jq = [],
			arrows = content.find('.ava_crop-arrow'),
			thumbs_wrap = content.find('.js-ava_crop_thumbs'),
			zoom_info = content.find('.js-ava_crop_zoom'),
			cursor_wrap = content.find('.ava_crop-cursor'),
			
			// thumbs
			thumb_large = content.find('.ava_crop-thumb_large .preview'),
			thumb_small = content.find('.ava_crop-thumb_small .preview'),
			
			base_pos, pad_x, pad_y,
			state,
			STATE = {
				NONE: 0,
				MOVING: 1,
				RESIZE: 2
			},
			image_size,
			current_area = {};
		
		var $image = $(image).attr("class", img.attr("class"));
		img.replaceWith($image);
		img = $image;
		
		init_image(image);
		
		var move_state = {},
			max_w = wrap.width(),
			max_h = wrap.height(),
			events = {};
		
		// Зум кнопками
		content.on('click', '.js-ava_crop_zoom_btn', function (e) {
			e.preventDefault();
			e.stopPropagation();
			var dir = $(this).data('dir') / 100;
			current_area.w += dir;
			set_area(current_area.x, current_area.y, current_area.w);
		});
		
		// Сохранение
		content.on('click', '.js-ava_crop_save', function (e) {
			e.preventDefault();
			e.stopPropagation();
			
			var el = $(this);
			if (el.data('busy'))
				return;
			el.data('busy', true).find('.ico').addClass('ico_spinner');
			
			var zero_area = $.extend({}, current_area);
			unrotate_area(params.rotate, zero_area);
			
			var x = Math.min(999, (zero_area.x.toFixed(2) * 1000)),
				y = Math.min(999, (zero_area.y.toFixed(2) * 1000)),
				w = Math.min(999, (zero_area.w.toFixed(2) * 1000)),
				value = pad(x, 3) + pad(y, 3) + pad(w, 3);
			
		//	if (!x && !y && w == 999) {
		//		// Полный выбор!
		//		value = 0;
		//	}
			
			Spaces.api("anketa.photoAreaEdit", {
				CK: null,
				Pa: value
			}, function (res) {
				if (res.code != 0)
					Spaces.showApiError(res);
				params.onAvatarCrop(res.avatar, res.avatar_2x, value);
				DdMenu.close();
			});
		});
		
		events.dragStart = function (e) {
			base_pos = wrap.offset();
			
			for (var i = 0; i < arrows.length; ++i) {
				var arrow = $(arrows[i]),
					pos = arrow.offset(),
					xpad = 10;
				
				if ((e.x >= pos.left - xpad && e.x <= pos.left + arrow.width() + xpad) && 
						(e.y >= pos.top - xpad && e.y <= pos.top + arrow.height() + xpad)) {
					state = STATE.RESIZE;
					move_state = {
						bw: frame.width(),
						bh: frame.height(),
						bx: frame.position().left,
						by: frame.position().top,
						dir: arrow.data('dir'),
						maxH: wrap.height(),
						maxW: wrap.width(),
						dX: 0,
						dY: 0
					};
					frame.addClass('ava_crop-resize');
					cursor_wrap.show().css("cursor", move_state.dir + '-resize');
					return;
				}
			}
			
			var frame_pos = frame.offset(),
				vertical = e.y < frame_pos.top ? -1 : (e.y > frame_pos.top + frame.height() ? 1 : 0),
				horizontal = e.x < frame_pos.left ? -1 : (e.x > frame_pos.left + frame.width() ? 1 : 0);
			
			if (!vertical && !horizontal) {
				state = STATE.MOVING;
				frame.addClass('ava_crop-move');
				cursor_wrap.show().css("cursor", "pointer");
				
				pad_x = e.x - frame_pos.left;
				pad_y = e.y - frame_pos.top;
			} else {
				var x = e.x - base_pos.left, y = e.y - base_pos.top;
				move_rect(x - frame.width() / 2, y - frame.height() / 2);
			}
		};
		events.dragMove = function (e) {
			if (state == STATE.MOVING) {
				move_rect(e.x - base_pos.left - pad_x, e.y - base_pos.top - pad_y);
				fix_thumb_size();
			} else if (state == STATE.RESIZE) {
				var vmap = {s: 1, n: -1}, hmap = {e: 1, w: -1},
					vertical = vmap[move_state.dir[0]],
					horizontal = hmap[move_state.dir[1]],
					dx = (e.dX + move_state.dX) * horizontal,
					dy = (e.dY + move_state.dY) * vertical;
				
				var change_hor = move_state.bw + dx < current_area.realW / 2,
					change_ver = move_state.bh + dy < current_area.realH / 2;
				if (change_hor || change_ver) {
					if (change_ver)
						vertical = -vertical;
					if (change_hor)
						horizontal = -horizontal;
					
					var rect_x = base_pos.left + current_area.realX,
						rect_y = base_pos.top + current_area.realY,
						new_start_x = rect_x + (horizontal < 0 ? 0 : current_area.realW),
						new_start_y = rect_y + (vertical < 0 ? 0 : current_area.realH);
					
					move_state.bx = current_area.realX;
					move_state.by = current_area.realY;
					move_state.bw = current_area.realW;
					move_state.bh = current_area.realH;
					move_state.dX = (e.x - e.dX) - new_start_x;
					move_state.dY = (e.y - e.dY) - new_start_y;
					
					dx = (e.x - new_start_x) * horizontal;
					dy = (e.y - new_start_y) * vertical;
				}
				
				var new_dir = (vertical > 0 ? 's' : 'n') + (horizontal > 0 ? 'e' : 'w');
				if (new_dir != move_state.dir) {
					cursor_wrap.css("cursor", new_dir + '-resize');
					move_state.dir = new_dir;
				}
				
				var new_x = move_state.bx,
					new_y = move_state.by,
					new_w = move_state.bw,
					new_h = move_state.bh;
				
				// fix min size
				if (new_h + dy < image_size.minSize)
					dy += image_size.minSize - (new_h + dy);
				if (new_w + dx < image_size.minSize)
					dx += image_size.minSize - (new_w + dx);
				
				// fix aspect
				if (dy > dx) {
					dx = new_h + dy - new_w;
				} else {
					dy = new_w + dx - new_h;
				}
				
				// move horizontal
				new_w += dy;
				if (horizontal < 0)
					new_x -= dx;
				
				// move vertical
				new_h += dy;
				if (vertical < 0)
					new_y -= dy;
				
				// fix x & w
				if (new_x < 0) {
					new_w += new_x;
					new_x = 0;
				} else if (new_w > move_state.maxW - new_x) {
					new_w += image_size.maxW - new_x - new_w;
				}
				if (new_w < new_h) {
					var diff = new_w - new_h;
					new_h += diff;
					if (vertical < 0)
						new_y -= diff;
				}
				
				// fix y & h
				if (new_y < 0) {
					new_h += new_y;
					new_y = 0;
				} else if (new_h > image_size.maxH - new_y) {
					new_h += image_size.maxH - new_y - new_h;
				}
				if (new_h < new_w) {
					var diff = new_h - new_w;
					new_w += diff;
					if (horizontal < 0)
						new_x -= diff;
				}
				
				set_size(new_w, new_w);
				move_rect(new_x, new_y);
				fix_thumb_size();
			}
		};
		events.dragEnd = function () {
			state = STATE.NONE;
			frame.removeClass('ava_crop-move ava_crop-resize');
			cursor_wrap.hide();
			fix_thumb_size();
		};
		wrap.draggable({
			fastEvents: true,
			realtime: true,
			forceStart: true,
			preventStart: Device.browser.name == 'ucbrowser' || (Device.browser.name == 'firefox' && Device.type != 'desktop'),
			scroll: true,
			disableContextMenu: false,
			events: events
		});
		
		// Передвижение через тумбы
		var frame_rel_pos;
		$([thumb_small[0], thumb_large[0]]).parent().draggable({
			fastEvents: true,
			calcRelative: true,
			disableContextMenu: false,
			forceStart: true,
			scroll: true,
			events: {
				dragStart: function (e) {
					frame_rel_pos = frame.position();
				},
				dragMove: function (e) {
					move_rect(frame_rel_pos.left + -e.dX, frame_rel_pos.top + -e.dY);
					fix_thumb_size();
				},
				dragEnd: function () {
					// nothing!
				}
			}
		});
		
		DdMenu.fixSize();
		
		function init_image(tmp_img) {
			for (var i = 0; i < shadows.length; ++i)
				shadows_jq.push($(shadows[i]));
			
			image_size = {
				originalWidth: tmp_img.width,
				originalHeight: tmp_img.height,
				width: tmp_img.width,
				height: tmp_img.height,
				wide: tmp_img.width > tmp_img.height
			};
			
			var parts = params.area && pad(params.area.toString(), 9).match(/^(\d{3})(\d{3})(\d{3})$/);
			if (parts) {
				current_area = {
					x: parseInt(parts[1], 10) / 1000,
					y: parseInt(parts[2], 10) / 1000,
					w: parseInt(parts[3] > 998 ? 1000 : parts[3], 10) / 1000
				}
				rotate_area(params.rotate, current_area);
			};
			on_resize();
			
			if (!current_area.w) {
				// Позиция по-умолчанию
				set_area(-1, 0, 1);
			}
		}
		
		function on_resize() {
			image_size.width = image_size.originalWidth;
			image_size.height = image_size.originalHeight;
			
			// Исправляем кривой аспект
			if (image_size.width / image_size.height > 3 && 0) {
				var aspect = image_size.width / image_size.height,
					pct = (image_size.height * 3) / (image_size.height * (aspect - 3)) * 100;
				// img.css({maxWidth: (100 + pct) + '%'});
				image_size.width = image_size.height * 3;
			
				var crop_aspect = image_size.width / image_size.originalWidth,
					max_width = Math.min(wrap.parents('.js-ddmenu_content').innerWidth() - thumbs_wrap.width(), image_size.width),
					new_aspect = (max_width / crop_aspect) / image_size.originalWidth;
				
				wrap.css({
					width: max_width + 'px'
				});
				img.css({
					width: image_size.originalWidth * new_aspect
				});
				image_size.minSize = Math.min(image_size.width, image_size.height, MIN_CROP_SIZE) * (max_width / image_size.width);
			} else {
				wrap.css({
					maxHeight: '',
					maxWidth: ''
				});
				img.css({
					width: 'auto'
				});
				wrap.css({
					maxHeight: img.height() + "px",
					maxWidth: img.width() + "px"
				});
				image_size.minSize = Math.min(image_size.width, image_size.height, MIN_CROP_SIZE) * (img.width() / image_size.originalWidth);
			}
			image_size.maxW = wrap.width();
			image_size.maxH = wrap.height();
			
			// Обновляем минимальный размер
			frame.css({
				minWidth: image_size.minSize + 'px',
				minHeight: image_size.minSize + 'px'
			});
			if (can_box_shadow) {
				shadow_frame.css(can_box_shadow, 'rgba(0, 0, 0, 0.75) 0px 0px 0px ' + Math.max(image_size.maxH, image_size.maxW) + 'px');
			} else {
				for (var i = 0; i < shadows_jq.length; ++i)
					shadows_jq[i].width(image_size.maxW).height(image_size.maxH);
			}
			if (current_area.w)
				set_area(current_area.x, current_area.y, current_area.w);
		}
		
		function set_area(x, y, w) {
			var wrap_w = wrap.width(), wrap_h = wrap.height(),
				min_size = Math.min(wrap_h, wrap_w),
				new_x = wrap_w * x,
				new_y = wrap_h * y,
				new_w = Math.max(Math.min(min_size, min_size * w), image_size.minSize);
			
			if (x < 0) {
				// Центрируем
				new_x = wrap_w > wrap_h ? (wrap_w - new_w) / 2 : 0;
			}
			
			set_size(new_w, new_w);
			move_rect(new_x, new_y);
			fix_thumb_size();
		}
		
		function set_size(new_w, new_h) {
			if (can_box_shadow)
				shadow_frame.width(new_w).height(new_w);
			frame.width(new_w).height(new_w);
		}
		
		function fix_thumb_size() {
			if (image_size && !is_device_touch) {
				var pos = frame.position(),
					fw = frame.width(), fh = frame.height(),
					w = img.width(), h = img.height();
				$.each([thumb_small, thumb_large], function () {
					var thumb = this,
						x_aspect = (thumb.parent().innerWidth() / fw),
						y_aspect = (thumb.parent().innerHeight() / fh);
					thumb.css({
						marginLeft: -Math.round(pos.left * x_aspect, 2),
						marginTop: -Math.round(pos.top * y_aspect, 2),
						width: Math.round(x_aspect * w, 2),
						height: Math.round(y_aspect * h, 2)
					});
				});
			}
		}
		
		function move_rect(x, y) {
			var frame_w = frame.width(), frame_h = frame.height(),
				wrap_w = wrap.width(), wrap_h = wrap.height(),
				style = frame[0].style;
			
			x = Math.round(Math.min(Math.max(0, x), wrap_w - frame_w));
			y = Math.round(Math.min(Math.max(0, y), wrap_h - frame_h));
			
			frame.move(x, y);
			if (can_box_shadow) {
				shadow_frame.move(x, y);
			} else {
				shadows_jq[0].move(x - wrap_w, y - (wrap_h - frame_h));
				shadows_jq[1].move(x, y - wrap_h);
				shadows_jq[2].move(x - (wrap_w - frame_w), y + frame_h);
				shadows_jq[3].move(x + frame_w, y);
			}
			
			var min_side = image_size.wide ? wrap_h : wrap_w;
			
			current_area.realX = x;
			current_area.realY = y;
			current_area.realW = frame_w;
			current_area.realH = frame_h;
			
			current_area.x = x / wrap_w;
			current_area.y = y / wrap_h;
			current_area.w = frame_h / min_side;
			
			var old_w = Math.round(current_area.oldW * 100),
				new_w = Math.round(current_area.w * 100);
			if (new_w != old_w) {
				current_area.oldW = current_area.w;
				zoom_info.html(Math.round((frame_w / min_side) * 100) + '%');
			}
		}
		
		function rotate_area(rotate, area) {
			if (rotate == 1) { // 90
				/*
					       y
					+--------+
					|        | x
					+--------|
				*/
				var tmp = area.x;
				area.x = +(1 - area.y - area.w).toFixed(2);
				area.y = tmp;
			} else if (rotate == 2) { // 180
				/* 
					+---+
					|   |
					|   | y
					+---+
					   X
				*/
				area.x = +(1 - area.x - area.w).toFixed(2);
				area.y = +(1 - area.y - area.w).toFixed(2);
			} else if (rotate == 3) { // 270
				/*
					   +--------+
					 x |        |
					   +--------+
						 y
				*/
				var tmp = area.y;
				area.y = +(1 - area.x - area.w).toFixed(2);
				area.x = tmp;
			}
		}
		
		function unrotate_area(rotate, area) {
			if (rotate >= 1 && rotate <= 3)
				rotate_area(4 - rotate, area);
		}
	}
};

export default AvatarCrop;
