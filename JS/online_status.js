import $ from './jquery';
import * as pushstream from './core/lp';
import Spaces from './spacesLib';
import page_loader from './ajaxify';
import notifications from './notifications';
import {toggleClass} from './utils';

/*
	Глобальное автоматическое обновление иконок онлайновости. 
	Для сброса таймера обновления - checkOnline()
*/

var ONLINE_CHECK_INTERVAL = 40000; // Интервал обновления онлайновости

var TYPES = {
	ICON: 0,
	STATUS_WIDGET: 1
};

var last_request_done = true, online_check_interval,
	check_on_window_focus = false,
	recheck_own_online = false,
	static_online = {};

var icons_updater = function (only_nid) {
	if (!only_nid) {
		// Не будем срать запросами, пока старый не выполнился
		if (!last_request_done)
			return;
		
		// Не делаем запросы, если таб неактивен
		if (notifications && !notifications.isWindowActive()) {
			check_on_window_focus = true;
			return;
		}
		check_on_window_focus = false;
	}
	
	var users = [],
		widgets = {},
		main = $('#main_content');
	
	var icons = main.find('img.online_status_ico');
	for (var i = 0; i < icons.length; ++i) {
		var icon = icons[i],
			data = icon.getAttribute('data-u');
		if (data) {
			data = data.split(":");
			var uid = data[0];
			if (only_nid && uid != only_nid)
				continue;
			_addIndicator(uid, icon, TYPES.ICON);
		}
	}
	
	var user_widgets = main.find('.js-online_status');
	for (var i = 0; i < user_widgets.length; ++i) {
		var w = user_widgets[i],
			uid = +w.getAttribute('data-user');
		if (only_nid && uid != only_nid)
			continue;
		_addIndicator(uid, w, TYPES.STATUS_WIDGET);
	}
	
	if (users.length > 0) {
		last_request_done = false;
		Spaces.api("users.isOnline", {UsErs: users}, function (res) {
			last_request_done = true;
			if (res.code != 0)
				return;
			
			for (var id in res.status) {
				var entry = widgets[id],
					state = !!res.status[id].is_online;
				if (!entry)
					continue;
				
				for (var type in entry.widgets) {
					for (var i in entry.widgets[type]) {
						var item = entry.widgets[type][i];
						if (type == TYPES.ICON) {
							toggleOnlineIcon(item.el, state);
						} else if (type == TYPES.STATUS_WIDGET) {
							var $el = $(item.el),
								toggle = $el.data('toggle');
							
							$el.toggle((toggle == 'online' && state) || (toggle == 'offline' && !state));
							if (toggle == 'offline') {
								var inner = $el.data('inner'),
									$time = (inner ? ($el.find(inner == 1 ? '.js-online_status_time' : inner)) : $el);
								$time.text(res.status[id].human_last_time);
							}
						}
					}
				}
			}
		}, {
			onError: function () {
				last_request_done = true;
			}
		});
	}
	
	function toggleOnlineIcon(el, state) {
		if (el.parentNode) {
			el.src = el.src.replace(/(_off)?(_2x)?(\.png)/ig, (state ? '' : '_off') + '$2$3');
			if (el.srcset)
				el.srcset = el.srcset.replace(/(_off)?(_2x)?(\.png)/ig, (state ? '' : '_off') + '$2$3');
		}
	}
	
	function _addIndicator(uid, el, type, data) {
		// Свою иконку обновлять нет смысла
		if (uid in static_online && type == TYPES.ICON) {
			toggleOnlineIcon(el, static_online[uid]);
			return;
		}
		
		if (Spaces.params.nid && Spaces.params.nid == uid) {
			if (!recheck_own_online)
				return;
			recheck_own_online = false;
		}
		
		var entry = widgets[uid];
		if (!entry) {
			users.push(uid);
			entry = widgets[uid] = {uid: uid, widgets: {}};
		}
		
		if (!entry.widgets[type])
			entry.widgets[type] = [];
		entry.widgets[type].push({
			el: el
		});
		return entry;
	}
};

export function checkOnline(force, only_nid) {
	if (!Spaces.params.nid) // Обновляем только для юзеров
		return;
	
	if (online_check_interval) {
		clearInterval(online_check_interval);
		online_check_interval = null;
	}
	online_check_interval = setInterval(icons_updater, ONLINE_CHECK_INTERVAL);
	if (force)
		icons_updater(only_nid);
};

if (pushstream) {
	pushstream.on('message', 'online_status', function (data) {
		if (data.act == pushstream.TYPES.STATUS_CHANGE) {
			static_online[Spaces.params.nid] = data.Online;
			recheck_own_online = true;
			checkOnline(true, Spaces.params.nid);
		}
	});
}

if (Spaces.params.nid) {
	checkOnline();
	
	page_loader.on('pageloaded', "online_status", function () {
		checkOnline();
	}, true);
	
	$('#main').on('focuswindow', function (e) {
		if (check_on_window_focus)
			checkOnline(true);
	});
}
