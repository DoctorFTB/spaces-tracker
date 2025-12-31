import module from 'module';
import $ from './jquery';
import Device from './device';
import Spaces from './spacesLib';
import page_loader from './ajaxify';
import fixPageHeight from './min_height';
import './anim';

var SHOW_TIMEOUT = 1000,
	HIDE_TIMEOUT = 50,
	ANIM_TIME_SHOW = 150,
	ANIM_TIME_HIDE = 150,
	TRIANGLE_SIZE = 20,
	EVT_NAMESPACE = '.sp_hot_info';

var in_queue = {},
	loaded = {},
	show_timeout,
	hide_timeout,
	current_item;

var CONFIG = {
	user: {
		method: 'users.popupWidget',
		param: 'User',
		typeName: 'u'
	},
	comm: {
		method: 'comm.popupWidget',
		param: 'Comm',
		typeName: 'c'
	}
};

var tpl = {
	wrap(data) {
		var html = '' + 
			'<div id="hot_info__' + data.type + '_' + data.nid + '" class="inner__dropdown-menu dropdown-menu__wrap js-fix_height">' + 
				data.content + 
				'<div class="triangle js-hot_info_triangle"></div>' + 
			'</div>';
		return html;
	}
};

module.on("componentpagedone", () => {
	in_queue = {};
	loaded = {};
	destroyHint();
});

module.on("component", () => {
	var hovered = document.querySelector(".mysite-link[onmouseover]:hover");
	if (!hovered)
		return;

	var el = $(hovered),
		data = el.data(),
		nid, type, cfg, rnd = data.rnd;

	if (!data.rnd)
		data.rnd = Date.now();

	$.each(CONFIG, function (k, v) {
		if (v.typeName in data) {
			cfg = v;
			type = k;
			nid = data[v.typeName];
			return false;
		}
	});
	var object_id = type + '_' + nid,
		id = object_id + '_' + data.rnd;

	if (current_item) {
		if (current_item.id == id) {
			stopHideHint();
			return;
		}
		destroyHint();
	}

	current_item = {
		oId: object_id,
		id: id,
		nid: nid,
		type: type,
		el: el,
		time: Date.now()
	};

	el.on('mouseout' + EVT_NAMESPACE, function (e) {
		startHideHint();
	});

	if (in_queue[object_id])
		return;

	if (loaded[object_id]) {
		show_timeout = setTimeout(showHint, SHOW_TIMEOUT);
	} else {
		in_queue[object_id] = true;

		var api_data = {Link_id: Spaces.params.link_id};
		api_data[cfg.param] = nid;
		Spaces.api(cfg.method, api_data, function (res) {
			delete in_queue[object_id];
			if (res.code == 0) {
				loaded[object_id] = true;

				$('#main').append(tpl.wrap({
					nid: nid,
					type: type,
					content: res.widget
				}));

				if (current_item)
					show_timeout = setTimeout(showHint, Math.max(0, SHOW_TIMEOUT - (Date.now() - current_item.time)));
			} else {
				console.error('[HOT_INFO:' + id + '] ' + Spaces.apiError(res));
			}
		}, {
			onError: function (err) {
				delete in_queue[object_id];
				console.error('[HOT_INFO:' + id + '] ' + err);
			}
		});
	}
});

function stopHideHint() {
	if (!current_item)
		return;
	if (hide_timeout) {
		clearTimeout(hide_timeout);
		hide_timeout = null;
	}
}

function startHideHint() {
	if (!hide_timeout)
		hide_timeout = setTimeout(destroyHint, HIDE_TIMEOUT);
}

function destroyHint() {
	if (current_item) {
		var popup = $('#hot_info__' + current_item.oId);
		
		if ($.support.nativeAnim) {
			popup.off(EVT_NAMESPACE).cssAnim('opacity', 'ease-in-out', ANIM_TIME_HIDE, function () {
				popup.hide();
			}).css("opacity", 0);
		} else {
			popup.hide();
		}
		current_item.el.off(EVT_NAMESPACE);
		
		$(window).off(EVT_NAMESPACE);
		
		clearTimeout(hide_timeout);
		clearTimeout(show_timeout);
		current_item = hide_timeout = show_timeout = null;
	}
}

function showHint() {
	if (!current_item)
		return;
	
	var el = current_item.el,
		popup = $('#hot_info__' + current_item.oId),
		triangle = popup.find('.js-hot_info_triangle');
	
	var menu_position = el.offset().top - (popup.height() + TRIANGLE_SIZE + el.height()),
		header_pos = $('#siteContent').offset().top;
	if (Math.max(header_pos, $(window).scrollTop()) > menu_position) {
		// Рисуем попап снизу, если сверху не влазит
		triangle.removeClass('triangle-bottom');
		menu_position = el.offset().top + el.height() + TRIANGLE_SIZE;
	} else {
		// Рисуем попап сверху, т.к. снизу мы может расширять страницу бесконечно
		triangle.addClass('triangle-bottom');
	}
	
	if (!current_item.inited) {
		if ($.support.nativeAnim && popup.hasAnim())
			popup.cssAnim(false);
		
		popup.css("opacity", 0).show().offset({top: menu_position});
		
		if ($.support.nativeAnim) {
			popup.cssAnim('opacity', 'ease-in-out', ANIM_TIME_SHOW).css("opacity", 1);
		} else {
			popup.show();
		}
		
		popup.on('mouseover' + EVT_NAMESPACE, function () {
			if (!current_item)
				return;
			stopHideHint();
		}).on('mouseout' + EVT_NAMESPACE, function () {
			if (!current_item)
				return;
			startHideHint();
		});
		
		$(window).on('scroll' + EVT_NAMESPACE + ' resize' + EVT_NAMESPACE, showHint);
		current_item.inited = true;
	} else {
		popup.offset({top: menu_position});
	}
	
	triangle.offset({
		left: el.offset().left + (el.width() - TRIANGLE_SIZE) / 2
	})
	
	fixPageHeight();
}
