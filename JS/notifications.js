import require from 'require';
import $ from './jquery';
import cookie from './cookie';
import Device from './device';
import {Class} from './class';
import * as pushstream from './core/lp';
import Spaces from './spacesLib';
import fixPageHeight from './min_height';
import { base_domain, L, extend, tick, updateUrl } from './utils';

var BEACON_INTERVAL = 1000 * 60 * 4; // Интервал маячка

var interactive = Spaces.params.nid,
	css_has_fixed = Device.css('position', 'fixed', /fixed/i),
	beacon_extra = {},
	notif_sound,
	blinker_timeout;

var tpl = {
	notif: function (data) {
		var SEVERITY = {1: "system-message_service", 2: "", 3: "system-message_alert"};
		
		var html =
			'<div data-ypad="10" id="notif_' + data.id + '" class="oh system-message notification_item js-fix_height ' + 
					(data.n || data.delayed ? 'hide ' : '') + 
					(data.delayed ? 'js-notif_to_show ' : '') + 
					SEVERITY[data.severity] + 
			'">' + 
				'<span class="notif_text">' + 
					'<span class="ico ico_remove js-notif_close pointer right"></span>' + 
				'</span>' + 
				'<span class="notification_counter ' + (!data.n ? 'hide ' : '') + '">' + (data.n + 1) + '</span> ' + 
				Spaces.prepareLink(data.text) + 
			'</div>';
		return html;
	}
};

var Notifications = Class({
	Constructor: function () {
		var self = this;
		
		self.lock = false;
		self.deffered = [];
		self.blinker = {interval: null, old_title: null};
		self.ncounter = 0;
		
		self.top_notif_queue = [];
		self.top_notif_queue_lock = false;
		self.page_load_time = (new Date).getTime();
		
		self.oncounterchange = null;
		
		var hidden = "hidden", visibility_event = "", visibility_el = document;
		if (hidden in document) {
			visibility_event = "visibilitychange";
		} else if ((hidden = "mozHidden") in document) {
			visibility_event = "mozvisibilitychange";
		} else if ((hidden = "webkitHidden") in document) {
			visibility_event = "webkitvisibilitychange";
		} else if ((hidden = "msHidden") in document) {
			visibility_event = "msvisibilitychange";
		} else if ("onfocusin" in document) {
			visibility_event = "focusin focusout";
		} else {
			visibility_event = "pageshow pagehide focus blur";
			visibility_el = window;
		}
		
		self.window_active = cookie.get('spacesactive') != 'true';
		if (document[hidden] !== undefined)
			self.checkWindow(!document[hidden]);
		$(visibility_el).on(visibility_event, {hidden: hidden}, self.checkWindow.bind(self));
		cookie.set('spacesactive', 'true', {expires: 7 * 24 * 3600});
		
		import("./ajaxify").then(function ({default: page_loader}) {
			if (page_loader.ok()) {
				page_loader.onRequestStart("notifications", function() {
					self.lock = true;
				});
				page_loader.onRequestEnd("notifications", function() {
					$('#top_notif_place').find('.js-notif_close').click();
					$('.lp_notif_message').click();
					self.lock = false;
					
					$.each(self.deffered, function (k, v) {
						self.pushNotification(v);
					});
					self.deffered = [];
				});
				page_loader.on("shutdown", "notifications", function() {
					self.setPlace(false);
				}, true);
			}
		});
		
		$(function () {
			var window_key = 'spaces:tab' + self.page_load_time + ':alive';
			var on_storage = function () {
				if (Spaces.LocalStorage.get(window_key))
					Spaces.LocalStorage.remove(window_key);
			};
			$.each([document, window, document.body], function (k, v) {
				v.addEventListener && v.addEventListener('storage', on_storage, false);
			});
		});
		
		if (interactive) {
			if (Spaces.params.play_sound) {
				import("./sound").then(({SpacesSound}) => {
					notif_sound = new SpacesSound();
					notif_sound.load(ICONS_BASEURL + 'sounds/newMessage.mp3');
				});
			}
			pushstream.on("message", "notifications", self.onLongPolling.bind(self));
			self.beacon_interval = setInterval(function() {
				Spaces.api("common.beacon", beacon_extra);
			}, BEACON_INTERVAL);
		}
		
		var events = "touchmove.activity_detect touchstart.activity_detect keydown.activity_detect click.activity_detect " + 
			"MozMousePixelScroll.activity_detect mousewheel.activity_detect wheel.activity_detect scroll.activity_detect " + 
			"mousemove.activity_detect";
		$(window).on(events, function (e) {
			if (!e.originalEvent)
				return; // не нужны нам синтетические
			
			self.window_active = true;
			$(window).off('.activity_detect');
		});
	},
	Static: {
		COUNTER: {
			JOURNAL: 1,
			LENTA: 2,
			MAIL: 3
		},
		counters: {
			1: {
				title: L("Журнал"),
				id: "jour_notif_cnt",
				key: "journal"
			},
			2: {
				title: L("Лента"),
				id: "lent_notif_cnt",
				key: "lenta",
				limit_to_99: true
			},
			3: {
				title: L("Почта"),
				id: "mail_notif_cnt",
				key: "mail"
			}
		},
		_instance: null,
		instance: function () {
			if (!Notifications._instance)
				Notifications._instance = new Notifications();
			return Notifications._instance;
		}
	},
	onLongPolling: function (data) {
		var self = this;
		
		if (data.act == pushstream.TYPES.KARMA_CHANGED)
			$('.js-karma_value').text((+data.value).toFixed(2));
		
		if (self.needIgnore(data))
			return;
		
		if (data.act == pushstream.TYPES.NOTIFICATION_SEND) {
			if ($.inArray(Spaces.params.sid, data.sessions_ctimes) >= 0) {
				data.lp = true;
				if (self.pushNotification(data))
					self.showNewEvent(L('Новое событие'));
			}
		} else if (data.act == pushstream.TYPES.TOP_COUNTER_UPDATE) {
			self.updateCounter(data.type, data.cnt, {important: !!data.important});
		} else if (data.act == pushstream.TYPES.COMM_COUNTER_UPDATE) {
			var comm_link = $('#cc' + data.com_id);
			if (comm_link.length) {
				comm_link.find('.js-cnt').text(data.cnt);
				data.cnt > 0 ? comm_link.show() : comm_link.hide();
			}
		} else if (data.act == pushstream.TYPES.FRIENDS_ONLINE_COUNTER_UPDATE) {
			$('#friends_cnt').toggle(data.cnt > 0).find('.js-cnt').text(data.cnt);
		}
		
	},
	autohideTopNotif: function (flag) {
		var self = this, $window = $(window);
		if (!flag && !$('.lp_notif_wrapper').length) {
			$window.off('.autohideTopNotif');
			return this;
		}
		$window.on("scroll.autohideTopNotif", function () {
			var scroll = $window.scrollTop();
			if (scroll <= 50) {
				self.closeTopNotif();
			} else {
				if (!css_has_fixed)
					$('.lp_notif_wrapper').css({top: scroll + "px"});
			}
		});
		return this;
	},
	checkWindow: function (e) {
		var self = this, state = null,
			event_map = {
				focus: true, focusin: true, pageshow: true,
				blur: false, focusout: false, pagehide: false
			};
		if ((typeof e) == "boolean") {
			state = e;
		} else {
			if (event_map[e.type] !== undefined) {
				state = event_map[e.type];
			} else if (document[e.data.hidden] !== undefined) {
				state = !document[e.data.hidden];
			} else {
				throw "Unknown event: " + e.type;
			}
		}
		
		if (self.window_active !== state) {
			self.window_active = state;
			if (!state) {
				self.onBlurWindow();
			} else {
				self.onFocusWindow();
			}
		}
	},
	
	isAliveTab: function (id, callback) {
		var rnd = Date.now(), window_key = 'spaces:tab' + id + ':alive';
		Spaces.LocalStorage.set(window_key, rnd);
		setTimeout(function () {
			if (!Spaces.LocalStorage.get(window_key)) {
				callback(true);
			} else {
				Spaces.LocalStorage.remove(window_key);
				callback(false);
			}
		}, 100);
	},
	
	getTabId: function () {
		return this.page_load_time;
	},
	
	onBlurWindow: function () {
		var self = this;
		cookie.set('spacesactive', 'false', {expires: 7 * 24 * 3600});
		$('.lp_notif_wrapper').remove();
		$('#main').trigger("blurwindow");
	},
	
	onFocusWindow: function () {
		var self = this;
		self.titleBlink(false);
		cookie.set('spacesactive', 'true', {expires: 7 * 24 * 3600});
		self.showBackgroundNotifications();
		$('#main').trigger("focuswindow");
	},
	
	// Счётчики
	getCounter: function (type) {
		return parseInt($('#' + Notifications.counters[type].id).data('cnt'));
	},
	
	// Счётчики
	setNotifFilter: function (filter) {
		var self = this;
		self.re_filter = filter;
		return self;
	},
	
	setPlace: function (type, id, object_type) {
		if (type !== false) {
			beacon_extra.objectType = object_type;
			beacon_extra.Type = type;
			beacon_extra.Id = id;
		} else {
			delete beacon_extra.objectType;
			delete beacon_extra.Type;
			delete beacon_extra.Id;
		}
	},
	
	needIgnore: function (data) {
		return data.Oid && beacon_extra.Id && data.Oid == beacon_extra.Id && data.Ot == beacon_extra.objectType;
	},
	
	updateCounter: function (type, cnt, opts) {
		var self = this;
		opts = extend({
			blink: true,
			important: false
		}, opts || {});
		
		var counter = Notifications.counters[type];
		if (!counter) {
			console.error("Unknown counter type: ", type);
			return self;
		}
		
		var el = $('#' + counter.id);
		if (!el.length) {
			console.warn(`Counter ${counter.id} not found!`);
			return self;
		}
		
		let old_cnt = el.data('cnt');
		old_cnt = old_cnt.length < 1 ? 0 : +old_cnt;
		
		if (old_cnt == cnt)
			return self;
		
		var event = $.Event("counterchange");
		event.counterType = type;
		event.counterValue = cnt;
		$('#main').trigger(event);
		
		if (event.isDefaultPrevented())
			return this;
		if (event.counterValue != cnt)
			cnt = event.counterValue;
		
		if (blinker_timeout) {
			clearTimeout(blinker_timeout);
			blinker_timeout = false;
		}
		
		el.data('cnt', cnt);
		
		if (cnt > 0) {
			let counter_text = (counter.limit_to_99 ? (cnt > 99 ? '99' : cnt) : cnt);
			let title_text = counter.title + ' ' + (counter.limit_to_99 && cnt > 99 ? '99' : '+' + cnt);
			
			el.text(counter_text).visible(true);
			
			if (opts.blink) {
				if (old_cnt) {
					counterBlinker(el, [0.2, 1, 0.2, 1, 0.2, 1]);
				} else {
					counterBlinker(el, [1, 0.2, 1, 0.2, 1, 0.2, 1]);
				}
			} else {
				el.css("opacity", 1);
			}
			
			self.showNewEvent(title_text);
		} else {
			el.css("opacity", 0);
			
			blinker_timeout = setTimeout(() => {
				el.text('').visible(false);
			}, 500);
		}
		
		return self;
	},
	
	// Уведомление о нвом событии
	showNewEvent: function (title, opts) {
		var self = this,
			spacesactive = cookie.get('spacesactive');
		
		opts = $.extend({
			oneTab: false,
			notif: true
		}, opts);
		
		cookie.set('pageLoadTime', self.page_load_time, {expires: 7 * 24 * 3600});
		
		if (spacesactive == 'true') {
			if (self.window_active) {
				if (opts.opts)
					self.pushTopNotification({text: title});
			} else if (opts.oneTab) {
				self._bgNotif(title, opts.oneTab);
			}
		} else {
			self._bgNotif(title, opts.oneTab);
		}
		return this;
	},
	
	_bgNotif: function (title, force_sound) {
		var self = this;
		setTimeout(function() {
			self.titleBlink(title);
			self.playSoundInBg(force_sound);
		}, 300);
	},
	
	// Обычные нотификации
	showNotification: function (text, severity, opts) {
		opts = extend({silent: true}, opts || {});
		severity = severity || "info";
		
		var severities = {"error": 3, "warning": 2, "info": 1};
		this.renderNotification({
			id: 'user_' + (new Date().getTime()),
			generic: true,
			text: text,
			severity: severities[severity]
		});
		if (!opts.silent)
			this.showNewEvent(L('Новое событие'));
		return this;
	},
	
	pushNotifications: function (data) {
		for (var i = 0; i < data.length; ++i)
			this.pushNotification(data[i]);
		return this;
	},
	
	pushNotification: function (data) {
		var self = this;
		
		if (!data.text) {
			console.error('Invalid notification!', data);
			return false;
		}
		
		if (data.lp) {
			var qnotid = parseInt(cookie.get('qnotid')) || 0;
			if (qnotid >= data.id) {
				console.error("Старая нотификация", data, new Date);
				return false;
			}
			if (this.window_active)
				cookie.set('qnotid', data.id, {expires: 7 * 24 * 3600});
			if (this.lock) {
				data.lp = false;
				self.deffered.push(data);
				return false;
			}
		}
		
		if (self.re_filter && self.re_filter.test(data.text))
			return true;
		
		this.renderNotification(data);
		return true;
	},
	
	closeNotification: function (id) {
		var self = this;
		
		var notif = $('#notif_' + id);
		if (notif.length) {
			notif.remove();
			--this.ncounter;
		}
		
		var element = $('#top_notif_place .notification_item').first();
		if (element) {
			element.find('.notification_counter').text(this.ncounter).toggle(this.ncounter != 1);
			element.show();
		}
		
		self.fixLocationBar();
		
		return this;
	},
	
	renderNotification: function (data) {
		var self = this;
		
		var notif_place = $('#top_notif_place');
		
		var $notif = $(tpl.notif({
			id: data.id,
			n: self.ncounter,
			delayed: data.lp && !self.window_active,
			severity: data.severity,
			text: data.text
		}));
		
		$notif.find('a').each(function () {
			this.href = updateUrl(this.href);
		});
		
		var n = $notif.find('.js-comments_notif').each(function () {
			var el = $(this);
			if (el.data('id') == beacon_extra.Id && el.data('type') == beacon_extra.Type) {
				// Удаляем
				el.remove();
			}
		}).length;
		if (n && !$.trim($notif.find('.notif_text').text()).length) {
			// Не добавляем 
			return this;
		}
		
		if (this.ncounter > 0) {
			notif_place.find('.notification_item').first().find('.notification_counter')
				.text(this.ncounter + 1).removeClass('hide');
		}
		
		$notif.prop("nid", data.id).prop("generic", !data.lp);
		
		$notif.find('.js-notif_close').on('click', function (e) {
			e.preventDefault();
			if (data.close_link)
				Spaces.api(data.close_link, {});
			self.closeNotification(data.id);
		});
		
		++self.ncounter;
		notif_place.append($notif);
		
		self.fixLocationBar();
		
		return self;
	},
	
	fixLocationBar: function () {
		var has_notif = $('#top_notif_place .notification_item').filter(function () {
			return $(this).isVisible();
		}).length > 0;
		$('#header_path').toggleClass('no-shadow', has_notif);
		
		fixPageHeight();
	},
	
	showBackgroundNotifications: function (data) {
		var notif_place = $('#top_notif_place'),
			qnotid = parseInt(cookie.get('qnotid') || 0);
		var to_show = notif_place.find('.js-notif_to_show');
		for (var i = 0; i < to_show.length; ++i) {
			if (to_show[i].nid <= qnotid) {
				this.closeNotification(to_show[i].nid);
			} else {
				var qnotid = parseInt(cookie.get('qnotid') || 0);
				if (qnotid < to_show[i].nid)
					cookie.set('qnotid', to_show[i].nid, {expires: 7 * 24 * 3600});
				$(to_show[i]).removeClass('js-notif_to_show hide');
			}
		}
		return this;
	},
	
	// Мелкие нотификации
	pushTopNotification: function (data) {
		var scroll = $(window).scrollTop();
		if (scroll <= 50) {
			return this;
		}
		
		data.id = data.id || (new Date).getTime();
		this.top_notif_queue.push(data);
		return this.topNotifQueue();
	},
	
	topNotifQueue: function (from_queue) {
		var self = this;
		if (!from_queue && self.top_notif_queue_lock)
			return;
		
		if (!self.top_notif_queue.length) {
			self.top_notif_queue_lock = false;
			return;
		}
		if (!self.top_notif_queue_lock) {
			self.autohideTopNotif(true);
			self.top_notif_queue_lock = true;
		}
		
		var notif = self.top_notif_queue.shift();
		
		var delete_top_notif = function() {
			$(this).remove();
			self.topNotifQueue(true);
		};
		var render_top_notif = function () {
			var el = self.renderTopNotif(notif);
			el.css("margin-left", -(el.width() / 2) + "px");
			
			if (self.top_notif_queue.length > 0) {
				setTimeout(() => {
					el.remove();
					self.topNotifQueue(true);
				}, 2000);
			} else {
				var msg = el.find('.lp_notif_message');
				setTimeout(() => {
					msg.addClass('lp_notif_message-fade');
				}, 5000);
				self.topNotifQueue(true);
			}
		};
		
		var old_notifs = $('.lp_notif_wrapper');
		old_notifs.first().remove();
		render_top_notif();
		
		return self;
	},
	
	renderTopNotif: function (data) {
		var self = this;
		var message = $(
			'<div id="top_notif_id_' + data.id + '" class="lp_notif_wrapper' + 
					(css_has_fixed ? ' lp_notif_wrapper_fixed' : '') + '">' + 
				'<div class="lp_notif_message">' + data.text + '</div>' + 
			'</div>'
		);
		if (!css_has_fixed)
			message.css({top: $(window).scrollTop()});
		message.find('.lp_notif_message').on('click', {id: data.id}, function (e) {
			e.preventDefault();
			$('html, body').scrollTop(0);
			self.closeTopNotif();
		});
		$(document.body).append(message);
		
		return message;
	},
	
	closeTopNotif: function () {
		var self = this;
		self.top_notif_queue = [];
		$('.lp_notif_wrapper').remove();
		self.autohideTopNotif(false);
		return this;
	},
	
	// Звуковые оповещения
	playSound: function () {
		if (!interactive)
			return;
		import("./sound").then(({SpacesSound}) => {
			let can_play = true;

			if (notif_sound.isSingle()) {
				require.loaded(import.meta.id('./music'), ({MusicPlayer}) => {
					if (MusicPlayer.playing())
						can_play = false;
				});
			}

			if (can_play) {
				notif_sound.setVolume(100);
				notif_sound.stop();
				tick(() => notif_sound.play());
			}
		});
		return this;
	},
	
	playSoundInBg: function (force_sound) {
		var winner = parseInt(cookie.get('pageLoadTime') || 0);
		if ((this.page_load_time == winner || force_sound) && Spaces.params.play_sound)
			this.playSound();
		return this;
	},
	
	// Мигание тайтлом
	titleBlink: function (title) {
		var self = this, state = true;
		
		if (self.blinker.interval) {
			document.title = self.blinker.old_title;
			clearInterval(self.blinker.interval);
			self.blinker.interval = null;
		}
		
		if (title) {
			var blinker = function () {
				if (state) {
					self.blinker.old_title = document.title;
					document.title = title;
					state = false;
				} else {
					document.title = self.blinker.old_title;
					state = true;
				}
				
				if (cookie.get('spacesactive') == 'true')
					self.titleBlink(false);
			};
			blinker();
			self.blinker.interval = setInterval(blinker, 1000);
		}
		return this;
	},
	isWindowActive: function () {
		var self = this;
		return self.window_active;
	}
});

function counterBlinker(el, states, next_timeout) {
	if (states.length) {
		blinker_timeout = setTimeout(() => {
			blinker_timeout = false;
			el.css("opacity", states.shift());
			counterBlinker(el, states, 499);
		}, next_timeout || 0);
	}
}

export {Notifications};
export default new Notifications();

