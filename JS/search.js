import module from 'module';
import $ from './jquery';
import Device from './device';
import {Class} from './class';
import Spaces from './spacesLib';
import fixPageHeight from './min_height';
import require from 'require';
import {debounce} from './utils';
import './search_form';
import './select_item';

var expando = 'usearch' + Date.now();
var TYPES = {
	/*
		apiMethod	метод API
		apiData		данные API
		param		параметр поиска
		results		ключ с массивом результатов
		noapi		не-API запрос
		skipDefault	игнорировать изначально введённый текст
		onToggleList({listEmpty, valueEmpty})
		onBeforeSend(search_value, api_data)
		onResult(result, search_value)
	*/
};
var INPUT_DELAY = 300;

var RENDER = {
	suggests: {
		activeClass: 'suggest__item_active',
		showOnFocus: true,
		hideEmpty: true,
		inputActiveClass: false
	},
	/*ddmenu: {
		activeClass: 's-city__item_hovered',
		showOnFocus: true,
		hideEmpty: true,
		inputActiveClass: 'triangle-show js-clicked'
	},
	*/'default': {
		activeClass: false,
		showOnFocus: false,
		hideEmpty: false,
		inputActiveClass: false
	}
};

/*
	Главный враппер:
	<div class="js-usearch_parent" data-type="sometype">
		Поле для поиска:
		<div>
			<input class="js-usearch" />
			
			или
			
			<div class="js-usearch_input_wrap">
				<input class="text-input" />
			</div>
			
			или
			
			<div class="js-usearch_input_wrap">
				<input class="js-search__input" />
			</div>
		</div>
		
		<div class="js-usearch_list_wrap"> <-- Опциональный враппер результатов поиска
			<div class="js-usearch_list">
				Результаты поиска
			</div>
		</div>
		
		<div class="js-usearch_empty">
			Ничего не найдено
		</div>
		
		<a href="#" class="js-usearch_result_val" data-value="хуй">
			Установит в поле значение Хуй
		</a>
	</div>
*/

var recheck_timeout;
var UniversalSearch = Class({
	Static: {
		recheck: function () {
			$('.js-usearch_parent').each(function () {
				UniversalSearch.init($(this));
			});
		},
		init: function (wrap) {
			require.component(import.meta.id('./search_form'));
			
			if (!wrap.data(expando)) {
				var el = wrap.findClass('js-usearch');
				if (!el.length)
					el = wrap.find('.js-usearch_input_wrap .text-input');
				if (!el.length)
					el = wrap.find('.js-usearch_input_wrap .js-search__input');
				var type = el.data('type') || wrap.data('type');
				if (TYPES[type])
					wrap.data(expando, new UniversalSearch(el));
			}
			return wrap.data(expando);
		},
		register: function (type, cfg) {
			TYPES[type] = cfg;
		}
	},
	Constructor: function (el) {
		var self = this;
		
		self.el = el;
		self.parent = el.findClass('js-usearch_parent');
		
		var data = $.extend({
			selEmpty: '.js-usearch_empty'
		}, self.parent.data(), el.data());
		
	//	self.initial = $.trim(el.val());
	//	if (self.initial == "")
	//		self.backup = self.list.children();
		
		self.cfg = $.extend({
			length: 0
		}, TYPES[data.type], {
			apiMethod: data.apiMethod,
			apiData: data.apiData
		});
		self.type = data.type;
		
		self.list = self.parent.find('.js-usearch_list');
		self.wrap = self.parent.find('.js-usearch_list_wrap');
		self.empty = self.parent.find('.js-usearch_empty');
		
		if (!self.wrap.length)
			self.wrap = self.list;
		
		if (typeof self.cfg.render == "object") {
			self.render = $.extend(RENDER[data.type || 'default'], self.cfg.render);
		} else if (typeof self.cfg.render == "string") {
			self.render = RENDER[data.render || self.cfg.render || 'default'];
		}
		
		self.render = typeof self.cfg.render == "object" ? self.cfg.render : RENDER[self.cfg.render || 'default'];
		
		var value_monitor = function (force, refresh) {
			var value = $.trim(self.el.val());
			if (!changed)
				changed = old_value != value;
			
			old_value = value;
			
			if (changed)
				self.cancelApi();
			
			var is_empty = (!value.length || value.length < self.cfg.length);
			
			if (changed && self.cfg.onInput)
				self.cfg.onInput({value: value, empty: is_empty});
			
			self.valueEmpty = is_empty;
			self.value = value;
			
			if (changed || refresh) {
				self.search(value, refresh);
				old_value = value;
				changed = false;
			}
		};
		
		let _last = Date.now();
		
		let on_input = debounce(() => {
			let elapsed = Date.now() - _last;
			_last = Date.now();
			value_monitor(true);
		}, INPUT_DELAY);
		
		self.list.on('click', '.js-usearch_result_val', function (e) {
			e.preventDefault();
			var el = $(this);
			self.el.val(el.data('value')).trigger('change').trigger('usearch:change', {item: el});
			if (el.data('hide'))
				el.trigger('closeSearch');
		});
		
		var old_value = self.cfg.skipDefault ? $.trim(self.el.val()) : "",
			last_input = 0, changed = false,
			hide_timeout, last_hover_element,
			prevent_click = false, first = true;
		
		self.focused = false;
		
		el.on('focus', function () {
			self.focused = true;
			
			if (first) {
				value_monitor(true);
				first = false;
			}
			
			self.toggleList();
			hide_timeout && clearTimeout(hide_timeout);
			last_hover_element = null;
		}).on('blur', function () {
			self.focused = false;
			
			value_monitor(true);
			if (last_hover_element && Date.now() - last_hover_element.time < 100)
				$(last_hover_element.el).click();
			if (self.render.showOnFocus)
				self.showList(false);
			last_hover_element = null;
		}).on('input', function () {
			on_input();
		}).on('keydown', function (e) {
			if ((e.keyCode == Spaces.KEYS.ENTER || e.keyCode == Spaces.KEYS.MAC_ENTER)) {
				e.preventDefault();
				value_monitor(true);
			} else if (e.keyCode == Spaces.KEYS.ESC) {
				if (self.render.showOnFocus)
					self.showList(false);
			} else if (e.keyCode == Spaces.KEYS.UP || e.keyCode == Spaces.KEYS.DOWN) {
				self.toggleList();
			}
		});
		
		self.parent.on('clearSearchForm', function () {
			value_monitor(true);
			self.el.trigger('usearch:change', {item: false});
		}).on('closeSearch', function () {
			if (self.cfg.hideEmpty) {
				self.list.html('');
				self.toggleList();
			}
		}).on('click', '.js-search__submit', function (e) {
			e.preventDefault();
			value_monitor(true);
			self.el.focus();
		});
		
		self._valueMonitor = value_monitor;
		
		if (self.render.activeClass && self.list.length) {
			self.list.itemsSelector({
				activeClass: self.render.activeClass,
				keydownArea: self.el
			});
			self.list.on('click', ':scope > *', function (e) {
				e.preventDefault();
			});
			self.list.on('highlight', ':scope > *', function () {
				last_hover_element = {el: this, time: Date.now()};
			});
		}
		if (self.el.is(':focus'))
			self.el.blur().focus();
	},
	search: function (value, refresh) {
		var self = this,
			cfg = self.cfg;
		self.cancelApi();
		
		if (cfg.hideEmpty && self.valueEmpty) {
			self.list.html('');
			self.toggleList();
			return;
		}
		
		if (self.cfg.length && self.cfg.length > value.length) {
			if (!self.cfg.allowEmpty || value.length)
				return;
		}
		
		var api_data = $.extend({}, cfg.apiData),
			api_method = typeof cfg.apiMethod == 'function' ? cfg.apiMethod.call(self, []) : cfg.apiMethod;
		
		cfg.onBeforeSend && cfg.onBeforeSend.call(self, value, api_data);
		api_data[cfg.param] = value;
		
		// Кастомный метод запросов
		if (cfg.doSearch) {
			self.toggleLoading(true);
			self.last_api_request = cfg.doSearch({
				query: value,
				refresh: refresh,
				method: api_method,
				api_data: api_data,
				onSuccess: function () {
					self.toggleLoading(false);
				},
				onError: function (err) {
					self.toggleLoading(false);
					Spaces.showError(err);
				},
				list: self.list
			});
			return;
		} else {
			self.toggleLoading(true);
			self.last_api_request = Spaces.api(api_method, api_data, function (res) {
				self.toggleLoading(false);
				if (cfg.noapi || res.code == 0) {
					cfg.onResult && cfg.onResult.call(self, res, value);
					if (cfg.onRender) {
						cfg.onRender.call(self, self.list, res, value);
					} else {
						var results = res[cfg.results];
						if (results.join)
							results = results.join('');
						self.list.html(results);
					}
					
					if (!refresh || !self.render.showOnFocus || self.focused)
						self.toggleList();
				} else {
					Spaces.showApiError(res);
				}
			}, {
				retry: 10,
				onError: function (err) {
					self.toggleLoading(false);
					Spaces.showError(err);
				}
			});
		}
	},
	cancelApi: function () {
		var self = this;
		Spaces.cancelApi(self.last_api_request);
		self.parent.removeClass('search__loading');
	},
	toggleLoading: function (flag) {
		var self = this;
		self.parent.toggleClass('search__loading', flag);
	},
	showList: function (show) {
		var self = this;
		
		if (!self.list.length)
			return;
		
		self.wrap.toggle(!!show);
		if (self.render.inputActiveClass)
			self.el.parent().toggleClass(self.render.inputActiveClass, !!show);
		fixPageHeight(self.wrap);
	},
	toggleList: function () {
		var self = this;
		
		if (!self.list.length)
			return;
		
		var empty = !self.list.children().length;
		
		if (self.cfg.onToggleList) {
			self.cfg.onToggleList({
				listEmpty: empty,
				valueEmpty: self.valueEmpty
			});
		}
		
		if (self.render.showOnFocus || !self.empty.length) {
			fixPageHeight(self.wrap);
			self.showList(!empty);
		} else {
			if (empty) {
				self.empty.show();
				self.list.hide();
			} else {
				self.empty.hide();
				self.list.show();
			}
		}
	},
	refreshSearch: function () {
		this._valueMonitor(true, true);
	}
});

$.fn.usearch = function (cfg) {
	var el = this.first();
	
	if (cfg) {
		var uniq = 'usearch_' + Date.now();
		TYPES[uniq] = cfg;
		el.data("type", uniq);
	}
	
	return UniversalSearch.init(el);
}

module.on("component", function () {
	UniversalSearch.recheck();
});

export default UniversalSearch;
