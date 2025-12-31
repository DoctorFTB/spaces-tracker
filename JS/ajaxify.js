import {loadPageStyles, onPageDone} from 'loader';
import $ from './jquery';
import cookie from './cookie';
import Device from './device';
import {Class} from './class';
import {Spaces, Url} from './spacesLib';
import SpacesApp from './android/api';
import * as pushstream from './core/lp';
import { switchTheme, getCurrentTheme } from './core/theme';
import {trackHit} from './metrics/track';
import {extend, ge, html_unwrap, find_var, tick} from './utils';
import * as sidebar from './widgets/swiper';
import {default as notifications, Notifications} from './notifications';

var RE_SKIP_AJAX = /^\/(p\/|m\/|f\/|v\/|advertise|neoapi|beta|sbox|api|capcha\/|captcha\/|i\/|js\/|css\/|\w{2}\/[a-f0-9]{32})/i,
	RE_NO_AJAX = /(\s|^)(no_ajax)(\s|$)/,
	RE_GAMES_DOMAINS = /^br|aquatika|bratva|bt|drako|farma|ferma|gbn|generals|gfarm|gonki|hata|heroes|li|looters|mdog|millioner-online|mt|naemniki|nazone|nebomobi|redline|sb|vi|vkletke|voindorog|voyna|wartank|wekings$/;

var ADS_BLOCKS = ['reklama', 'sidebar_reklama', 'rightbar_reklama', 'rightbar_app', 'widgets.partners'];

var tpl = {
	ajaxLoader: function () {
		var html = 
			'<div id="ajax_loader" style="display: none">' + 
				'<div class="ajax-loader__cancel" id="ajax_cancel"><span class="ico ico_remove"></span></div>' + 
			'</div>';
		return html;
	}
};

var old_css_rev = window.REVISION,
	css_update_timeout,
	tmp_link = document.createElement('a'),
	ajax_request_id = 0;

// Класс сохранения и восстановления состояния формы
var FormState = {
	save: function (p) {
		var state = [];
		/* TODO: юзать ID для точной идентификации, если есть. */
		var skip_nodes = {hidden: 1, reset: 1, file: 1, image: 1, buttom: 1, submit: 1};
		var forms = p.getElementsByTagName('form');
		for (var i = 0; i < forms.length; ++i) {
			var f = {id: forms[i].getAttribute('id'), name: forms[i].getAttribute('name'), radios: {}, texts: {}, checkboxes: {}, selects: {}},
				form = forms[i];
			
			for (var j = 0; j < form.elements.length; ++j) {
				var e = form.elements[j], type = (e.tagName != "INPUT" ?  e.tagName : e.type.toLowerCase());
				if (e.tagName == "INPUT" && (skip_nodes[type]))
					continue;
				
				if (type == "SELECT") {
					if (f.selects[e.name] === undefined)
						f.selects[e.name] = [];
					
					if (e.multiple) {
						var v = {}, options = e.getElementsByTagName('option');
						for (var k = 0; k < options.length; ++k)
							v[options[k].value] = options[k].selected;
						f.selects[e.name].push(v);
					} else {
						f.selects[e.name].push(e.value);
					}
				} else if (type == "radio") {
					if (e.checked)
						f.radios[e.name] = e.value;
				} else if (type == "checkbox") {
					if (f.checkboxes[e.name] === undefined)
						f.checkboxes[e.name] = {};
					f.checkboxes[e.name][e.value] = e.checked;
				} else {
					if (f.texts[e.name] === undefined)
						f.texts[e.name] = [];
					f.texts[e.name].push(e.value);
				}
			}
			
			state.push(f);
		}
		
		return state;
	},
	
	restore: function (p, state) {
		var forms = p.getElementsByTagName('form');
		var forms_list = {};
		var fid = 0;
		for (var i = 0; i < forms.length; ++i) {
			var f = forms[i], f_id = f.getAttribute('id'), f_name = f.getAttribute('name'),
				key = (f_id ? "#" + f_id : (f_name ? ":" + f_name : fid++));
			forms_list[key] = f;
		}
		
		var find_element = function (a, type, value, callback) {
			if (a === undefined)
				return;
			if (a.length === undefined)
				a = [a];
			var skip_nodes = {hidden: 1, reset: 1, file: 1, image: 1, buttom: 1, submit: 1, radio: 1, checkbox: 1};
			for (var i = 0; i < a.length; ++i) {
				var el_type = (a[i].tagName != "INPUT" ?  a[i].tagName : a[i].type.toLowerCase());
				if (((type == ":text" && !skip_nodes[el_type]) || el_type == type) && 
						(value === undefined || value === null || value == a[i].value)) {
					callback(a[i]);
				}
			}
		};
		
		fid = 0;
		for (var i = 0; i < state.length; ++i) {
			var s = state[i],
				key = (s.id ? "#" + s.id : (s.name ? ":" + s.name : fid++)),
				f = forms_list[key];
			
			if (!f)
				continue;
			
			// SELECT
			for (var k in s.selects) {
				var select_id = 0,
					selects = f.getElementsByTagName("select");
				for (var z = 0; z < selects.length; ++z) {
					var el = selects[z];
					if (s.selects[k][select_id] === undefined)
						break;
					
					if (typeof s.selects[k][select_id] == 'object') {
						var options = el.getElementsByTagName('option');
						for (var op = 0; op < options.length; ++op)
							options[op].selected = !!s.selects[k][select_id][options[op].value];
						select_id++;
					} else {
						var options = el.getElementsByTagName('option'), selected = false;
						for (var op = 0; op < options.length; ++op) {
							if ((options[op].selected = !selected && options[op].value == el.value))
								selected = false;
						}
					}
				}
			}
			
			// radios
			for (var k in s.radios) {
				find_element(f.elements[k], "radio", null, function (el) {
					el.checked = el.value == s.radios[k];
				});
			}
			
			// checkboxes
			for (var k in s.checkboxes) {
				find_element(f.elements[k], "checkbox", null, function (el) {
					el.checked = !!(s.checkboxes[k][el.value]);
				});
			}
			
			// texts
			for (var k in s.texts) {
				var text_id = 0;
				find_element(f.elements[k], ":text", null, function (el) {
					
					if (s.texts[k][text_id] !== undefined)
						el.value = s.texts[k][text_id++];
				});
			}
		}
	}
};

var HistoryManager = {
	default_id: null,
	callbacks: {},
	old_url: null,
	cur_url: null,
	state: null, // Замена history.state
	_startup_url: null,
	
	init: function () {
		HistoryManager.old_url = location.href;
		HistoryManager.cur_url = location.href;
		window.onpopstate = HistoryManager.handler;
		HistoryManager._startup_url = location.href;
	},
	setDefault: function (id) {
		HistoryManager.default_id = id;
	},
	add: function (id, callback) {
		HistoryManager.callbacks[id] = callback;
	},
	remove: function (id) {
		delete HistoryManager.callbacks[id];
	},
	clean: function () {
		for (var k in HistoryManager.callbacks) {
			if (HistoryManager.default_id != k)
				delete HistoryManager.callbacks[k];
		}
	},
	handler: function (e) {
		if (!e.state && history.state)
			e.state = history.state;
		
		HistoryManager.state = e.state;
		
		if (HistoryManager._startup_url == location.href) {
			console.error("prevent html5 history bug");
			HistoryManager._startup_url = null;
			return false;
		}
		HistoryManager._startup_url && (HistoryManager._startup_url = null);
		
		HistoryManager.old_url = HistoryManager.cur_url;
		HistoryManager.cur_url = document.location.href;
		
		if (!Url.onlyHashChanged(HistoryManager.cur_url, HistoryManager.old_url)) {
			Spaces.referer = HistoryManager.old_url;
			trackHit(document.location.href, document.title, HistoryManager.old_url);
		}
		
		var id = HistoryManager.default_id;
		if (e.state && e.state.route && HistoryManager.callbacks[e.state.route] !== undefined)
			id = e.state.route;
		if (id)
			HistoryManager.callbacks[id](e);
		
		e.preventDefault();
		return false;
	},
	pushState: function (data, title, url) {
		HistoryManager.state = data || {};
		
		HistoryManager._startup_url && (HistoryManager._startup_url = null);
		data = data || {};
		HistoryManager.old_url = document.location.href;
		window.history.pushState(data, title, url);
		HistoryManager.cur_url = document.location.href;
		
		if (!Url.onlyHashChanged(HistoryManager.cur_url, HistoryManager.old_url)) {
			Spaces.referer = HistoryManager.old_url;
			trackHit(document.location.href, document.title, HistoryManager.old_url);
		}
	},
	replaceState: function (data, title, url) {
		if (data !== undefined)
			HistoryManager.state = data;
		
		HistoryManager.old_url = document.location.href;
		window.history.replaceState(data, title, url);
		HistoryManager.cur_url = document.location.href;
		
		if (HistoryManager._startup_url && HistoryManager._startup_url != document.location.href)
			HistoryManager._startup_url = null;
	},
	updateState: function (callback) {
		var curr_state;
		try { curr_state = history.state; } catch (e) {
			/* IE10 тут падает чёто, если нет state */
		}
		if (!curr_state)
			curr_state = HistoryManager.state || {};
		callback(curr_state);
		HistoryManager.replaceState(curr_state, null, null);
	}
};

var PageLoader = Class({
	Constructor: function () {
		var self = this;
		
		$.extend(self, {
			page_no_cache: false,
			active_reqs: 0,
			refresh_url: null,
			refresh_interval: null,
			pages_id: {},
			page_cache_time: 60 * 30 * 1000,
			disabled: false,
			prev_url: null,
			last: {
				link_id: 0,
				sid: "0"
			},
			callbacks: {},
			user_id: Spaces.params.nid,
			_rnd: 0
		});
		
		self.opts = {
			loading_indicator: true
		};
		
		if (self.ok()) {
			HistoryManager.setDefault("common");
			HistoryManager.add("common", function (e) {
				if (!self.loadPage({url: document.location.href, state: e.state, history: false, scroll: false, from_history: true}))
					location.assign(document.location.href);
			});
			
			self.on('shutdown', 'page_no_cache', function () {
				self.page_no_cache = false;
			}, {persist: true});
		}
		
		tick(() => self.setup());
	},
	handlers: {
		onLinkClick: function (e, self) {
			var query = this.getAttribute('data-url-params');
			if (query) {
				this.setAttribute('href', this.getAttribute('href') + "?" + query);
				this.removeAttribute('data-url-params');
			}
			
			// Для ссылок с классом no_ajax ничего не делаем
			if (RE_NO_AJAX.test(this.className))
				return true;
			
			// Открытие в новом окне
			if (this.getAttribute('target') == '_blank')
				return true;
			
			// Открытие в новом окне через зажатый ctrl или клик колёсиком
			if (e.ctrlKey || e.type == 'auxclick')
				return true;
			
			var android_app = this.getAttribute('data-android-app');
			if (android_app)
				android_app = JSON.parse(android_app);
			
			// uc-click fix
			if (!this.href) {
				tmp_link.href = this.getAttribute('href');
				this.href = tmp_link.href;
			}
			
			if (self.loadPage({url: this.href, app: android_app, el: this})) {
				e.stopImmediatePropagation();
				e.preventDefault();
				e.stopPropagation();
				return false;
			}
			
			if (this.nodeName.toUpperCase() == 'UC-CLICK')
				location.href = this.href;
			
			return true;
		},
		onFormSubmit: function (e, self) {
			var query = this.getAttribute('data-url-params');
			if (query) {
				this.action += "?" + query;
				this.removeAttribute('data-url-params');
			}
			
			// Для форм с классом no_ajax ничего не делаем
			if (RE_NO_AJAX.test(this.className))
				return true;
			
			if (self.loadPage({url: this.action, form: this, el: this})) {
				e.stopImmediatePropagation();
				e.preventDefault();
				e.stopPropagation();
				return false;
			}
			
			return true;
		}
	},
	
	setup: function () {
		var self = this;
		
		self.invalid_page = !(ge('#main_page_footer') || ge('#footer') || ge('#navi_footer') || ge('#navi'));
		
		if (!$.event.special.click)
			$.event.special.click = { postDispatch: null };
		if (!$.event.special.submit)
			$.event.special.submit = { postDispatch: null, trigger: null };
		if (!$.event.special.auxclick)
			$.event.special.auxclick = { postDispatch: null, trigger: null };
		
		$.event.special.click.postDispatch = function (e) {
			var target = e.ajaxify && e.ajaxify.el;
			if (!e.ajaxify && (!e.isPropagationStopped() && !e.isImmediatePropagationStopped())) {
				// Если не дошли до <body> или это не stop propagatioon - игнорим такой ивент
				return;
			}

			// Не обрабатываем переход при клике на <a> без href
			if (target && target.nodeName == 'A' && !target.getAttribute('href'))
				return;
			
			// На некоторых браузерах мнение isDefaultPrevented() и returnValue + defaultPrevented различалось o_O
			if ((!e.originalEvent || (e.originalEvent.returnValue !== false && !e.originalEvent.defaultPrevented))
					&& !e.isDefaultPrevented()) {
				if (!target) {
					target = e.target;
					while (target && target.nodeName.toUpperCase() != 'A' && target.nodeName.toUpperCase() != 'UC-CLICK')
						target = target.parentNode;
				}
				
				if (target) {
					if (self.handlers.onLinkClick.call(target, e, self) === false)
						e.preventDefault();
				}
			}
		};
		$.event.special.auxclick.postDispatch = function (e) {
			if (e.button == 1)
				return $.event.special.click.postDispatch(e);
		};
		$.event.special.submit.postDispatch = function (e) {
			var target = e.ajaxify && e.ajaxify.el;
			if (!e.ajaxify && (!e.isPropagationStopped() && !e.isImmediatePropagationStopped())) {
				// Если не дошли до <body> или это не stop propagatioon - игнорим такой ивент
				return;
			}
			
			// На некоторых браузерах мнение isDefaultPrevented() и returnValue + defaultPrevented различалось o_O
			if ((!e.originalEvent || (e.originalEvent.returnValue !== false && !e.originalEvent.defaultPrevented))
					&& !e.isDefaultPrevented()) {
				if (!target) {
					target = e.target;
					while (target && target.nodeName.toUpperCase() != 'FORM')
						target = target.parentNode;
				}
				
				if (target) {
					if (self.handlers.onFormSubmit.call(target, e, self) === false)
						e.preventDefault();
				}
			}
		};
		
		$('body').on('click', 'a, uc-click', function (e) {
			e.ajaxify = {el: this};
		}).on('submit', 'form', function (e) {
			e.ajaxify = {el: this};
		}).on('auxclick', 'a, uc-click', function (e) {
			e.ajaxify = {el: this};
		});
		
		if (pushstream) {
			pushstream.on("message", "ajaxify", function (data) {
				// Обновление виджетов
				if (data.act == pushstream.TYPES.REFRESH_WIDGETS) {
					if (!self.current_tab_widgets_updated)
						self.refreshWidgets(data.widgets & ~Spaces.WIDGETS.FOOTER);
					self.current_tab_widgets_updated = false;
				}
				
				// Обновление настроек
				if (data.act == pushstream.TYPES.SETTINGS) {
					if (!data.tab_id || data.tab_id != Spaces.tabId())
						self.updateSettings(data.newSettings);
				}
				
				// Смена версии или разлогин
				var target_sid = data.session_ctime || (data.data && data.data.session_ctime);
				if ((data.act == pushstream.TYPES.DEVICE_TYPE_CHANGE || data.act == pushstream.TYPES.LOGOUT) && target_sid == Spaces.params.sid)
					self.disable(data.device_type != Device.id);
					
			});
		}
		
		if (self.ok()) {
			// TODO: вынести в SPACES_PARAMS
			var meta_refresh = window.PAGE_REFRESH;
			if (meta_refresh) {
				var m = meta_refresh.params.match(/^(\d+);\s*url=(.*?)$/i);
				if (m) {
					self.setRefresh(m[2], m[1]);
					if (meta_refresh.timer)
						clearTimeout(meta_refresh.timer);
				}
			}
			
		//	self._proccessInternalCb(location.hash.substr(1));
			$('#main_shadow').prepend(tpl.ajaxLoader());
			$('#ajax_cancel').click(function (e) {
				e.preventDefault();
				self.cancel();
			});
		}
	},
	
	onShutdown: function (id, callback, persist) {
		return this.on('shutdown', id, callback, persist);
	},
	onRequestStart: function (id, callback) {
		return this.on('requeststart', id, callback, true);
	},
	onRequestEnd: function (id, callback) {
		return this.on('requestend', id, callback, true);
	},
	
	setRefresh: function (url, interval) {
		var self = this;
		if (self.refresh_interval) {
			clearInterval(self.refresh_interval);
			self.refresh_interval = null;
			self.refresh_url = null
		}
		if (url) {
			self.refresh_url = url;
			console.error("set refresh: " + url + ", " + interval);
			self.refresh_interval = setInterval(function () {
				self.loadPage({url: self.refresh_url});
			}, interval * 1000);
		}
	},
	
	loadPage: function (params) {
		var self = this;
		params = $.extend({
			url: "",
			form: null,
			history: true,
			state: null,
			scroll: true,
			from_history: false,
			app: false
		}, params);
		
		var $body = $(document.body);
		
		var is_multipart;
		if (params.form) {
			var enctype = params.form.getAttribute('enctype'),
				is_multipart = enctype && enctype.toLowerCase() == "multipart/form-data";
			if (is_multipart && $(params.form).find('input[type="file"]').length)
				return false;
		}
		
		if (!self._trigger('beforerequest', [params]))
			return true;
		
		if (!self.ok()) {
			if (params.form && !self._trigger('formsubmit', [{form: params.form}]))
				return true;
			return false;
		}
		
		var history_location_url;
		var req_url = new Url(params.url, true);
		var cur_url = new Url(document.location.href, true);
		
		if (req_url.scheme != cur_url.scheme) {
			req_url.scheme = cur_url.scheme;
			console.warn("Protocol mismatch: " + req_url.url());
		}
		
		var serialized_form = null;
		if (params.form) {
			if (!self._trigger('formsubmit', [{form: params.form}]))
				return true;
			if (params.form.method.toLowerCase() == "get") {
				// в GET формах не юзаются GET параметры из action!!!
				req_url.query = Url.serializeForm(params.form);
				params.form = null;
			} else {
				serialized_form = Url.serializeForm(params.form);
			}
		}
		
		if (!self._trigger('router', [req_url, params])) {
			if (params.history)
				HistoryManager.pushState({
					noCache: self.page_no_cache // Не кэшируем запросы роутера
				}, document.title, req_url.url());
			return true;
		}
		
		// Костыли для древнющих разделов
		if (RE_SKIP_AJAX.test(req_url.path))
			return false;
		
		if (req_url.domain != cur_url.domain) {
			var cd = cur_url.parseDomain(),
				d = req_url.parseDomain();
			if (d.sub_domains.length > 0) {
				var last_part = d.sub_domains[d.sub_domains.length - 1];
				if (RE_GAMES_DOMAINS.test(last_part.toLowerCase()) || last_part.length <= 2) {
					// Субдомен игры!
					return false;
				}
			}
			
			return false;
		}
		
		var on_request_end = function (f) {
			self.setRefresh(false);
			self._trigger('requestend', [f]);
			if (!f) {
				self._trigger('shutdown');
				self._resetHandlers();
			} else {
				self._proccessInternalCb(location.hash.substr(1));
			}
			Spaces.clearErrors();
		};
		
		var on_page_loading_end = function () {
			self._trigger('pageloaded');
		};
		
		// Изменился только хэш?
		var url_hash = req_url.hash;
		var _old_url = params.history ? new Url(HistoryManager.cur_url) : new Url(HistoryManager.old_url);
		
		if (!params.form && (_old_url.hash.length > 0 || req_url.hash.length > 0) && req_url.isSame(_old_url)) {
			self._trigger('requeststart');
			on_request_end(true);
			
			if (self.page_no_cache) {
				HistoryManager.updateState(function (s) {
					s.noCache = true;
				});
			}
			
			return params.from_history ? true : false;
		}
		
		if (self.disabled)
			return false;
		
	//	delete req_url.query._;
		delete req_url.query.sid;
		history_location_url = req_url.url();
		req_url.hash = "";
		var normal_url = req_url.url();
		
		if (params.app && Device.android_app) {
			if (SpacesApp.exec("go", params.app))
				return false;
		}
		
		var page_state = self.pages_id[normal_url];
		
		// Используется для кэша браузера. 
		// Если взят из state истории - скорее всего, страница возьмётся из кэша. Иначе всегда запрашивается с сервера. 
		var page_id = params.from_history && page_state ? page_state.rnd : new Date().getTime();
		if (params.state && params.state.noCache)
			page_id = new Date().getTime();
		
		if (!self.pages_id[normal_url])
			self.pages_id[normal_url] = {};
		self.pages_id[normal_url].time = new Date().getTime();
		self.pages_id[normal_url].rnd = page_id;
		
		if (params.state && params.state.post_data) {
			serialized_form = params.state.post_data;
			is_multipart = params.state.multipart;
		}
		
		var sid = cookie.get('sid');
		var xhr_callback = function (res) {
			if (res.reklama_id && res.reklama_id != Spaces.params.ac) {
				$('.' + Spaces.params.ac)
					.removeClass(Spaces.params.ac)
					.addClass(res.reklama_id);
				
				$.each(ADS_BLOCKS, function (k, v) {
					$('.' + Spaces.params.ac + k)
						.removeClass(Spaces.params.ac + k)
						.addClass(res.reklama_id + k);
				});
				
				window.SPACES_PARAMS.ac = res.reklama_id;
				Spaces.params.ac = res.reklama_id;
			}
			
			if (res.app && Device.android_app) {
				SpacesApp.exec("go", res.app);
				return false;
			}
			
			if (res.http_error !== undefined) {
				self.showLoadingError(Spaces.getHttpError(res.http_error), params);
				return;
			}
			
			onPageDone(() => {
				var is_old_data = false;
				if (res.copy_link_id) {
					is_old_data = params.from_history && self.last.link_id > res.copy_link_id && self.last.sid == sid;
					self.last.sid = sid;
					if (self.last.link_id < res.copy_link_id)
						self.last.link_id = res.copy_link_id;
					Spaces.params.link_id = res.copy_link_id;
				}
				
				var scroll_top = $(window).scrollTop();
				on_request_end();
				
				sidebar.toggle(false);
				
				if (!is_old_data) { // Обновляем данные только если они не старые (переход из истории, например)
					if (res.newSettings)
						self.updateSettings(res.newSettings);
					
					if (res.refreshWidgets) {
						self.current_tab_widgets_updated = true;
						self.updateWidgets(res.refreshWidgets, true);
					}
					
					if (res.friends) {
						$('#friends_cnt').toggle(res.friends[0] > 0).find('.js-cnt').text(res.friends[0]);
						$('#friends_tort').toggle(res.friends[1] > 0);
					}
				}
				
				if (res.redirect) { // Обнаружен редирект
					var url = (new Url(res.redirect.replace(/&amp;/gi, '&'))).merge(new Url(history_location_url));
					console.error("redirect: " + url.url(), "(" + res.redirect + ")");
					if (url.domain != location.hostname.toLowerCase()
							|| res.user_id != self.user_id || !self.loadPage({url: url.url()})) {
						location.assign(html_unwrap(res.redirect));
					}
					on_page_loading_end();
					return;
				}
				
				if (res.revision) {
					if (res.revision[1] > window.SPACES_REV) {
						console.log('new ajax rev: ' + res.revision[1]);
						self.disable(true);
					}
					
					if (res.revision[0] != old_css_rev) {
						old_css_rev = res.revision[0];
						self.refreshWidgets(Spaces.WIDGETS.CSS);
					}
				}
				
				$('head [data-meta-tags]').remove();
				$('head').append(res.meta_tags);
				$('#main_search_input, #header_elements .js-search__input').val('').blur();
				
				if (res.refresh) {
					var url = new Url(res.refresh.link);
					res.refresh.link = res.refresh.link.replace(/&amp;/gi, '&');
					if (url.domain != cur_url.domain) {
						location.assign(res.refresh.link);
						on_page_loading_end();
						return;
					}
					self.setRefresh(res.refresh.link, res.refresh.time);
				}
				
				if (res.user_id != self.user_id) {
					// Юзер поменялся!!!
					location.assign(history_location_url);
					on_page_loading_end();
					return;
				}
				
				if (!params.from_history) {
					if (self.pages_id[normal_url])
						delete self.pages_id[normal_url].forms;
					
					HistoryManager.updateState(function (s) {
						s.scroll = scroll_top;
						s.forms = FormState.save(document.getElementById('main_content'));
					});
				} else {
					if (self.prev_url)
						self.pages_id[self.prev_url].forms = FormState.save(document.getElementById('main_content'));
				}
				
				self.prev_url = normal_url;
				
				var current_time = (new Date).getTime();
				for (var k in self.pages_id) {
					if (self.pages_id[k].time + self.page_cache_time >= current_time)
						break;
					delete self.pages_id[k];
				}
				
				++ajax_request_id;
				
				$('#main').off();
				$('body').off('.oneRequest');
				$(window).off('.oneRequest');
				
				document.title = html_unwrap(res.title);
				
				if ('hits' in res)
					Spaces.hits = res.hits;
				
				if (res.css_files && res.css_files.length)
					loadPageStyles(res.css_files);
				
				var is_main_page = !!res.main_footer;
				var content_map = {
					'debug':			'debug',
					'sidebar':			'widgets.sidebar',
					'section_tabs':		'widgets.section_tabs',
					'location_header':	'location', // Верхний локейшн
					'location_footer':	res.locationBottom ? 'locationBottom' : 'location', // Нижний локейшн
					'coins_gift':		'coins_gift', // Бонусные монетки
					'sharings':			'shareButtons', // Кнопки шаринга
					'page_counters':	'counters', // Счётчики на странице
					'seo_text':			'widgets.seo_text', // Текст для SEO
					'index_counters':	'index_counters', // Счётчики на главной
					'main_footer':		'main_footer', // Главный футер
					'top_info_block':	'top_info_block',  // Нотификация сверху
					'moder_block':		'moder_block',
					'apps_widget':		'apps_widget',
					'footer_info':		'footer_info'
				};
				
				var content_map_cfg = {
					hide_if_empty:		{
						seo_text:	1
					},
					skip_if_empty:		{
						debug:		1
					}
				};
				
				$.each(ADS_BLOCKS, function (k, v) {
					if (res.refreshWidgets) {
						// Игнорируем рекламу правой панели, если обновляем панель целиком
						if (res.refreshWidgets[Spaces.WIDGETS.RIGHTBAR] && v == 'rightbar_reklama')
							return;
						
						// Игнорируем рекламу левой панели, если обновляем панель целиком
						if ((res.refreshWidgets[Spaces.SIDEBAR.SIDEBAR] || find_var(res, "widgets.sidebar")) && v == 'sidebar_reklama')
							return;
					}
					
					content_map["." + Spaces.params.ac + k] = v;
				});
				
				$.each(content_map, function (k, v) {
					var value = v && find_var(res, v);
					
					if (content_map_cfg.skip_if_empty[k] && !value)
						return;
					
					var div = $(k[0] == '.' ? k : '#' + k);
					div.fastHtml(value || '');
					
					if (content_map_cfg.hide_if_empty[k])
						div.visible(!!value);
				});
				
				var $main_content = $('#main_content').fastHtml('<div id="main">' + (res.game_motivator ? res.game_motivator : "") + res.content + '</div>');
				$main_content.css('min-height', 0);
				
				// Ноги
				$('#main_page_footer, #bottom_tools_main, #main_page_footer, #index_counters').visible(is_main_page);
				$('#navi_footer_wrap, #bottom_tools_wrap').visible(!is_main_page);
				
				$('#version_selector').visible(res.showVersionSelector);
				
				// Нотификации
				if (res.notifications && !is_old_data)
					notifications.pushNotifications(res.notifications);
				
				// Обновляем счётчики верхней панели
				if (res.topCounters && !is_old_data) {
					var cnt = res.topCounters;
					notifications
						.updateCounter(Notifications.COUNTER.MAIL, cnt.mail_new, {blink: false})
						.updateCounter(Notifications.COUNTER.LENTA, cnt.lenta, {blink: false})
						.updateCounter(Notifications.COUNTER.JOURNAL, cnt.journal_imp + cnt.journal,
								{important: cnt.journal_imp > 0, blink: false});
				}
				
				tick(function () {
					if (!Device.android_app) {
						if (res.theme && res.theme != getCurrentTheme())
							switchTheme(getCurrentTheme());
					}
					
					var form_state;
					if (params.state && params.state.forms)
						form_state = params.state.forms;
					if (self.pages_id[normal_url] && self.pages_id[normal_url].forms)
						form_state = self.pages_id[normal_url].forms;
					
					if (form_state) {
						// Восстанавливаем состояние форм
						FormState.restore($main_content[0], form_state);
					}
					
					// Ссылка на страницу и link_id
					if (res.copy_link_id) {
						var to_update = $([
							'#bottom_tools_wrap a',
							'#bottomToolsBlock a',
							'#navi_footer_wrap a',
							'#header_elements a',
							'#page_sidebar a',
							'#bottom_tools_main a',
							'#rightbar a'
						].join(', '));
						to_update.each(function () {
							this.href = this.href.replace(/(link_id=)(\d+)/ig, '$1' + res.copy_link_id);
							
							let url_params = this.getAttribute('data-url-params');
							if (url_params) {
								url_params = url_params.replace(/(link_id=)(\d+)/ig, '$1' + res.copy_link_id);
								this.setAttribute('data-url-params', url_params);
							}
						});
						$('#page_sidebar, #rightbar')
							.find('input[name="link_id"], input[name="Link_id"]')
							.val(res.copy_link_id);
					}
					
					$('#copy_url').visible(!!res.copy_link_show);
					if (params.scroll && (!params.state || !params.state.scroll)) {
						// Скроллим по хэшу
						self.scrollDocument(url_hash);
					}
					
					on_page_loading_end();
				});
				
				// Если нужно добавить историю
				if (params.history) {
					HistoryManager.pushState({
						rnd: page_id,
						post_data: serialized_form,
						multipart: is_multipart
					}, res.title, history_location_url);
				}
				
				if (params.state && params.state.scroll) {
					// Скроллим
					self.scrollDocument(params.state.scroll);
				}
			});
		};
		
		// Eval я ваш мобильный FireFox
		if (Device.browser.name == "firefox" && Device.type != 'desktop') {
			var old_xhr_callback = xhr_callback;
			xhr_callback = function (res) {
				if (params.scroll && (!params.state || !params.state.scroll))
					self.scrollDocument();
				setTimeout(function () {
					old_xhr_callback(res);
				}, 0);
			};
		}
		
		self._trigger('requeststart');
		
		self.request(page_id, req_url, serialized_form, xhr_callback, function (e) {
			on_page_loading_end(e.manual);
			self._trigger('requestend');
			if (!e.manual) {
				self.scrollDocument();
				self.showLoadingError(e.error, params);
			}
		}, {multipart: is_multipart});
		return true;
	},
	
	request: function (page_id, req_url, serialized_form, onsuccess, onerror, opts) {
		var self = this;
		
		opts = $.extend({
			multipart: false
		}, opts);
		
		Spaces.clearError("ajax_error");
		self.opts.loading_indicator && self.showLoading();
		++self.active_reqs;
		
		var done = function (res) {
			--self.active_reqs;
			self.opts.loading_indicator && self.hideLoading();
			onsuccess && onsuccess(res);
		};
		
		req_url.path = "/ajax" + page_id + req_url.path;

		var use_multipart = window.FormData && opts.multipart;

		self.cancel();
		self._last_xhr_request = $.ajax({
			url:			req_url.url(true),
			processData:	false,
			contentType:	use_multipart ? false : "application/x-www-form-urlencoded; charset=UTF-8",
			data:			use_multipart ? getFormData(serialized_form) : Url.buildQuery(serialized_form),
			method:			serialized_form ? "POST" : "GET",
			dataType:		"json",
			cache:			true
		})
		.success(done)
		.fail(function (xhr) {
			let json;
			try { json = JSON.parse(xhr.responseText); } catch (e) { }

			if (json) {
				done(json);
				return;
			}

			--self.active_reqs;
			self.opts.loading_indicator && self.hideLoading();
			onerror && onerror({
				xhr: xhr,
				manual: xhr.__manual_abort,
				error: Spaces.getHttpError(xhr.status)
			});
		})
		.always(function () {
			self._last_xhr_request = null;
		});
	},
	
	cancel: function () {
		var self = this;
		if (self._last_xhr_request && self._last_xhr_request.readyState != 4) {
			// Отменяем предыдущий запрос
			self._last_xhr_request.__manual_abort = true;
			self._last_xhr_request.abort();
		}
	},
	
	getRequestId: function () {
		return ajax_request_id;
	},
	
	disable: function (flag) {
		this.disabled = flag;
	},
	
	reload: function () {
		var self = this;
		if (!self.ok() || !self.loadPage({url: location.href, state: HistoryManager.state}))
			location.reload();
	},
	
	showLoadingError: function (error, params) {
		var self = this;
		Spaces.showError(error, "ajax_error", {
			onRetry: function () {
				self.loadPage(params);
			}
		});
	},
	
	documentAutoScroller: function (el, interval, timeout) {
		var self = this,
			htmlbody = $('html, body'),
			$window = $(window),
			scroll_time = (new Date).getTime(),
			scroll_interval,
			old_scroll_top = 0,
			abs_value = typeof el != "object" && $.isNumeric(el) ? parseInt(el) : null;
		
		interval = interval || 200;
		timeout = timeout || 30000;
		
		var events = "touchmove.auto_scroller touchstart.auto_scroller keydown.auto_scroller click.auto_scroller " + 
			"MozMousePixelScroll.auto_scroller mousewheel.auto_scroller wheel.auto_scroller scroll.auto_scroller";
		var disable_scroll = function (e) {
			if (e && !e.originalEvent)
				return;
			if (e && e.type == "scroll" && e.originalEvent && old_scroll_top == $window.scrollTop())
				return;
			
			clearInterval(scroll_interval);
			scroll_interval = null;
			
			$window.off('.auto_scroller');
		};
		var scroller = function () {
			htmlbody.scrollTop(abs_value !== null ? abs_value : parseInt(el.offset().top));
			old_scroll_top = $window.scrollTop();
			
			if ((new Date).getTime() - scroll_time > timeout)
				disable_scroll();
		};
		scroll_interval = setInterval(scroller, interval);
		scroller();
		
		$window.on(events, disable_scroll);
		
		self.onRequestStart("auto_scroller", disable_scroll);
	},
	
	scrollDocument: function (hash) {
		var self = this, scroll_val = parseInt(hash);
		if (isNaN(scroll_val) && hash && (typeof hash == "object" || hash.length > 0)) {
			if (typeof hash == "string" && hash.substr(0, 1) == '/')
				return;
			// Эмуляция скролла по якорю
			try {
				var el = typeof hash == "object" ? $(hash) : $('#' + hash + ', a[name="' + hash + '"]');
				if (el.length > 0) {
					self.documentAutoScroller(el, 200, 30000);
					return;
				}
			} catch (e) { console.error(e.toString()); }
		}
		if (Device.browser.name == "firefox") {
			// Mobile FireFox не нужен >_<
			$('html, body').scrollTop(scroll_val || 0);
			setTimeout(function () { $('html, body').scrollTop(scroll_val || 0); }, 15);
		} else {
			$('html, body').scrollTop(scroll_val || 0);
		}
	},
	
	refreshWidgets: function (widgets, callback) {
		var self = this;
		if (widgets) {
			Spaces.api("common.refreshWidget", {widgets: widgets}, function (res) {
				if (res.code == 0 && res.widgets) {
					self.updateWidgets(res.widgets);
					callback && callback();
				}
			});
		}
	},
	
	updateWidgets: function (res, from_load_page) {
		var self = this,
			elements = [], type_to_container = {}, names = {};
		type_to_container[Spaces.WIDGETS.HEADER] = 'header_elements';
		type_to_container[Spaces.WIDGETS.SIDEBAR] = 'page_sidebar';
		type_to_container[Spaces.WIDGETS.RIGHTBAR] = 'rightbar';
		
		names[Spaces.WIDGETS.FOOTER] = 'footer';
		names[Spaces.WIDGETS.HEADER] = 'header';
		names[Spaces.WIDGETS.SIDEBAR] = 'sidebar';
		names[Spaces.WIDGETS.CSS] = 'css';
		names[Spaces.WIDGETS.RIGHTBAR] = 'rightbar';
		
		sidebar.toggle(false);
		
		var updated = {};
		
		for (var id in res) {
			updated[id] = true;
			console.error("Обновляем: " + names[id]);
			
			if (type_to_container[id] !== undefined) {
				var el = $('#' + type_to_container[id])
				el.fastHtml(res[id]);
			} else if (id == Spaces.WIDGETS.FOOTER) {
				import('./footer').then(function ({default: Footer}) {
					Footer.update(res[id]);
				});
			} else if (id == Spaces.WIDGETS.CSS) {
				// Обновляем главный CSS
				var head = $('head');
				
				if (css_update_timeout) {
					head.find('link[data-main-css]').each(function (k, v) {
						var el = $(this);
						if (el.data("loading"))
							el.prop("disabled", true).remove();
					});
					clearTimeout(css_update_timeout);
				}
				
				var old_css = head.find('link[data-main-css]'),
					new_css = $('<div>').html(res[id]).find('link[data-main-css]').data("loading", true);
				
				if (old_css.length != new_css.length) {
					old_css.first().before(new_css);
					old_css.prop("disabled", true).remove();
				} else {
					var start_time = Date.now();
					
					// Выбираем только те css, которые изменили свой URL
					var changed_css = new_css.map(function (k, v) {
						if (new_css[k].href != old_css[k].href) {
							// Каждый новый CSS добавляем после старого
							$(old_css[k]).after(new_css[k]);
							return {
								"old": old_css[k],
								"cur": new_css[k],
								"secure": new_css[k].href.indexOf('://' + location.host + "/") >= 0
							};
						}
					});
					
					var CHECK_TIMEOUT = 1000;
					if (changed_css.length) {
						// Загрузка нового CSS без дёргания страницы
						var check_css_load = function () {
							var new_changed_css = [],
								elapsed = Date.now() - start_time;
							$.each(changed_css, function (k, v) {
								var ok = false;
								if (!v.secure || !('sheet' in v.cur)) {
									// Если это старый браузер или url не секьюрный, то старый CSS удаляем через 20 сек
									ok = elapsed >= 20000;
								} else {
									try {
										// Пытаемся магией определить, что новый css загрузился
										if (v.cur.sheet && ('cssRules' in v.cur.sheet))
											ok = !v.cur.sheet.cssRules || v.cur.sheet.cssRules.length > 0;
									} catch (e) {
										// На случай неочевидных багов, через 60 секунд удаляем старый CSS
										ok = elapsed >= 60000;
									}
								}
								
								if (ok) {
									// Если новый CSS загружен - удаляем старый
									$(v.cur).data("loading", false);
									v.old.disabled = true;
									$(v.old).remove();
								} else {
									new_changed_css.push(v);
								}
							});
							changed_css = new_changed_css;
							
							css_update_timeout = false;
							if (changed_css.length)
								css_update_timeout = setTimeout(check_css_load, elapsed <= 8000 ? CHECK_TIMEOUT : CHECK_TIMEOUT * 2);
						};
						css_update_timeout = setTimeout(check_css_load, CHECK_TIMEOUT);
					}
				}
			}
		}
		$('body').trigger('spUpdatePart', updated);
	},
	
	updateSettings: function (settings) {
		for (var k in settings) {
			var v = settings[k];
			if (k == Spaces.SettingsTypes.AVATAR) {
				Spaces.view.updateAvatars(v);
			} else if (k == Spaces.SettingsTypes.USER_NAME) {
				Spaces.params.name = v;
			} else if (k == Spaces.SettingsTypes.FORM_SUBMIT_KEY) {
				Spaces.params.form_submit_key = !v ? 'CTRL_ENTER' : 'ENTER';
			} else if (k == Spaces.SettingsTypes.SOUND_NOTIFY_BLOCK) {
				Spaces.params.play_sound = !v;
			} else if (k == Spaces.SettingsTypes.THEME) {
				if (!Device.android_app && Spaces.params.CK == v[1]) {
					import('./core/theme').then(({switchTheme}) => {
						switchTheme(v[0]);
					});
				}
			}
		}
	},
	
	back: function () {
		history.back();
		return false;
	},
	
	showLoading: function () {
		var self = this;
		if (!self.active_reqs) {
			var $main_shadow = $('#main_shadow');
			$('#ajax_loader').css({top: 0, left: $main_shadow.offset().left,
					width: $main_shadow.outerWidth()}).visible(true);
			$('#top_info_block img.right').css('opacity', 0);
		}
	},
	
	hideLoading: function () {
		var self = this;
		if (!self.active_reqs) {
			$('#ajax_loader').visible(false);
			$('#top_info_block img.right').css('opacity', '');
		}
	},
	
	/* JSC костыли */
	isJSC: function () {
		if (!this.ok())
			return false;
		let hash = location.hash.substr(1);
		let m = hash.match(/^([^\/]+)\/?(.*?)$/i);
		return m && m[1];
	},
	onJSC: function (id, func, persist) {
		if (!this.ok())
			return this;
		return this.on("js_cb_" + id, 'js_cb_' + id, func, persist)
			._proccessInternalCb(location.hash.substr(1), id);
	},
	setJSC: function (ev, params, replace) {
		if (!this.ok())
			return;
		var url = new Url(location.href), hash = location.hash.substr(1);
		if (ev) {
			url.hash = ev + '/' + params;
			HistoryManager[replace ? 'replaceState' : 'pushState'](null, null, url.url());
		} else {
			if (hash.match(/^([^\/]+)\/?(.*?)$/i)) {
				url.hash = "";
				HistoryManager.replaceState(null, null, url.url());
			}
		}
	},
	_proccessInternalCb: function (hash, ev) {
		if (!this.ok())
			return;
		var url = new Url(location.href), self = this, m;
		if (hash) {
			if ((m = hash.match(/^([^\/]+)\/?(.*?)$/i)) && (!ev || ev == m[1]))
				self._trigger('js_cb_' + m[1], [m[2]]);
		}
	},
	noCache: function (flag) {
		var self = this;
		if (!self.ok())
			return;
		self.page_no_cache = flag === undefined || !!flag;
		HistoryManager.updateState(function (s) {
			s.noCache = self.page_no_cache;
		});
		return self;
	},
	
	/* Ивенты */
	one: function (ev, func) {
		return this.on(ev, '__signle__', func, true);
	},
	push: function (ev, func) {
		return this.on(ev, 'shd' + (++this._rnd), func, false);
	},
	// Устанавливает роутер, если persist == true, то устанавливается навечно. Иначе 0 до очередного запроса. 
	router: function (func, persist) {
		var self = this;
		return self.on('router', 'router' + (++self._rnd), func, {
			persistOnRequest: !persist,
			persist: !!persist
		});
	},
	on: function (event, id, func, opts) {
		var self = this;
		opts = extend({
			persist: typeof opts === "boolean" ? opts : false,
			persistOnRequest: false
		}, opts);
		if (!func)
			return self.off(event, id);
		
		self.callbacks[event] = self.callbacks[event] || {};
		self.callbacks[event][id] = {func: func, opts: opts};
		return this;
	},
	off: function (event, id) {
		var self = this;
		if (id && self.callbacks[event])
			delete self.callbacks[event][id];
		else
			self.callbacks[event] = {};
		return self;
	},
	_trigger: function (event, params) {
		var self = this, canceled = false;
		if (!self.callbacks[event])
			return true;
		for (var id in self.callbacks[event]) {
			var c = self.callbacks[event][id];
			if (c.func) {
				try {
					if (c.func.apply(self, params) === false)
						canceled = true;
				} catch (e) {
					console.error("Handler (" + event + ", " + id + ") error:", e.stack ? "\n" + e.stack : e);
				}
			}
			if (!c.func || (!c.opts.persist && !c.opts.persistOnRequest))
				self.off(event, id);
		}
		return !canceled;
	},
	_resetHandlers: function () {
		var self = this;
		for (var event in self.callbacks) {
			for (var id in self.callbacks[event]) {
				var h = self.callbacks[event][id];
				if (h.opts.persistOnRequest)
					self.off(event, id);
			}
		}
	},
	ok: function () {
		var self = this;
		if (!('_ok' in self)) {
			self._ok = cookie.enabled() && history.pushState && 
				!/ajaxify=0/i.test(document.cookie) && Device.browser.name != "operamini" && !Spaces.params.no_ajaxify;
			
			// Отключаем аяксификацию на Android 2.3 внутри приложения, т.к. там это создаёт неприятные проблемы
			if (Device.android_app && Device.webkit() <= 533.1)
				self._ok = false;
			
			if (Device.android_app)
				window.SpacesApp.exec("ajaxify", {enable: self._ok});
		}
		return !self.invalid_page && self._ok;
	}
});
HistoryManager.init();

function getFormData(data) {
	var form = new window.FormData();
	for (var key in data) {
		if (!Object.prototype.hasOwnProperty.call(data, key))
			continue;
		if (data[key] instanceof Array) {
			for (var i = 0, l = data[key].length; i < l; ++i)
				form.append(key, data[key][i]);
		} else {
			form.append(key, data[key]);
		}
	}
	return form;
}

export default new PageLoader();
export {HistoryManager};
