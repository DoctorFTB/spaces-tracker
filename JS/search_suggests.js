import module from 'module';
import $ from './jquery';
import Device from './device';
import Spaces from './spacesLib';
import page_loader from './ajaxify';
import fixPageHeight from './min_height';
import DdMenu from './dd_menu';

import './select_item';
import {html_wrap} from './utils';

var CHECK_INTERVAL = 300;
/*
	имя_типа: {
		method     | Имя метода API или URL, в урл может быть макрос {query}
		paramType  | Шлёт GET запрос, если установить в GET
		results    | Ключ ответа с результатом
		noApi      | Костыль для запрос к старому API, где нет code
		length     | Мнимальная длина поискового запроса
		data       | Дополнительные параметры, можно юзать как дефолтные параеметры для bindParams
		bindParams | Проброс параметров через data-*, формат: {параметр: имя_в_data}
		render     | Функция из tpl для рендера подсказки
		opts       | Дефолтные опции
	}
*/
var TYPES = {
	users: {
		method: "/selector/?onlyFriends=1&ajaxUsers={query}",
		paramType: 'GET',
		length: 2,
		render: "usersApiResult",
		noApi: true
	},
	/* users: {
		method: "friends.search",
		param: "q",
		results: "result",
		stdApi: true,
		length: 3
	}, */
	search: {
		method: "search.getSuggestions",
		param: "q",
		results: "result",
		length: 2
	},
	music: {
		method: "search.getSuggestions",
		param: "q",
		results: "result",
		length: 2,
		data: {
			stype: 'music'
		},
	},
	mail_contacts: {
		method: "users.search",
		param: "q",
		results: "users",
		length: 3,
		data: {
			M: 1
		},
		render: "usersApiResult"
	},
	blog_channels: {
		method: "blogs.findChannel",
		param: "name",
		results: "channels",
		length: 1,
		data: {
			CK: null
		},
		render: "blogChannels"
	},
	interests: {
		method: "anketa.dictSuggestions",
		param: "q",
		results: "suggestions",
		length: 1,
		bindParams: {
			T: 'dict_type'
		},
		render: "usersTagObject",
		opts: {
			tags: true,
			no_submit: true,
			no_select: true
		}
	},
	groups: {
		method: 'user_groups.selector_autocomplete',
		param: "sq",
		results: "found",
		length: 1,
		bindParams: {
			pp: 'pp'
		},
		onSelect: function (idx, res) {
			return {
				contact: res.found[idx],
				removable: res.removables[idx],
				param: res.params[idx]
			};
		}
	}
};
var tpl = {
	suggest: function (text, hidden) {
		return '<div class="suggest__item' + (hidden ? ' hide' : '') + '" data-value="' + text + '">' + text + '</div>';
	},
	usersApiResult: function (data) {
		return tpl.suggest(data.name);
	},
	usersTagObject: function (data) {
		return '<div class="suggest__item" data-value="' + data.value + '">' + data.value + 
			' <span class="right grey">' + data.popularity + '</span></div>';
	},
	blogChannels: function (data) {
		return '<div class="suggest__item" data-value="' + data.name + '">' + data.name + '</div>';
	}
};

var state;
var SearchSuggests = {
	init: function () {
		var self = this;
		$('#main').on('focus', '.search_suggest', function (e) {
			var el = $(this),
				parent = el.parents('.suggest_parent'),
				data = $.extend(parent.data(), el.data()),
				type = data.type || 'search',
				cfg = TYPES[type];
			
			if (cfg.opts)
				data = $.extend(cfg.opts, data);
			
			self.free();
			state = {
				id: Date.now(),
				input: el,
				type: type,
				list: (data.list ? $(data.list) : parent.find('.suggest__list')),
				autoSelect: !data.no_select,
				autoSubmit: !data.no_submit,
				tags: data.tags,
				apiData: {},
				cfg: cfg
			};
			state.timer = setInterval(function () {
				self.getSuggests();
			}, CHECK_INTERVAL);
			
			const minlength = el.prop("minLength");
			if (minlength && minlength > 0)
				cfg.length = minlength;

			// Бинд параметров
			var binds = cfg.bindParams;
			if (binds) {
				for (var k in binds) {
					if (binds[k] in data)
						state.apiData[k] = data[binds[k]];
				}
			}
			state.last_value = self.getQuery(el.val());
		}).on('blur', '.search_suggest', function (e) {
			if (state) {
				var clean_id = state.id;
				setTimeout(function () {
					if (state && state.id == clean_id)
						self.free();
				}, 300);
			}
		}).on('mouseenter', '.suggest__item', function() {
			self.highlightItem($(this), false);
		}).on('mouseleave', '.suggest__item', function() {
			self.highlightItem(false, false);
		}).on('click', '.suggest__item', function(e) {
			e.preventDefault(); e.stopPropagation();
			e.stopImmediatePropagation();
			
			var el = $(this);
			self.selectItem(el, true);
			self.hideSuggests();
		}).on('keydown', '.search_suggest', function(e) {
			if (!state)
				return;
			
			var key = e.keyCode, enter = key == Spaces.KEYS.ENTER || key == Spaces.KEYS.MAC_ENTER;
			if (key == Spaces.KEYS.RIGHT) {
				if (!state.autoSelect)
					self.selectActive();
			} else if (key == Spaces.KEYS.UP || key == Spaces.KEYS.DOWN) {
				e.preventDefault();
				
				// Провоцируем ручной запрос за подсказками
				if (self.noSuggests()) {
					state.last_value = '';
					self.getSuggests();
				}
				
				self.moveSelectedItem(key == Spaces.KEYS.UP ? -1 : 1);
			} else if (enter || key == Spaces.KEYS.ESC) {
				if (enter) {
					e.preventDefault();
					e.stopPropagation();
					if (!state.autoSelect) {
						self.selectActive();
					} else
						self.submitForm();
				}
				self.hideSuggests();
			}
		});
		
		page_loader.push('shutdown', function () {
			self.free();
		});
	},
	noSuggests: function () {
		return !state.list.hasClass('suggest__list_on') && !state.last_req_id;
	},
	highlightItem: function (el, select) {
		var self = this;
		state.list.find('.suggest__item_active').removeClass('suggest__item_active');
		if (el) {
			el.addClass('suggest__item_active');
			select && self.selectItem(el, false, true);
		}
	},
	selectActive: function (el, submit, hover) {
		state.list.find('.suggest__item_active').click();
	},
	selectItem: function (el, submit, hover) {
		var self = this;
		state.input.data("suggest_index", el.index());
		if (!hover || state.autoSelect) {
			var item = $.trim(el.data('value'));
			if (state.tags) {
				var text = $.trim(state.input.val()),
					parts = text.split(',');
				parts.pop();
				parts.push(item);
				var text = parts.map(function (v) {
					return $.trim(v);
				}).join(', ');
				
				state.input.val(text);
			} else {
				state.input.val(el.text());
			}
			state.last_value = self.getQuery(state.input.val());
		}
		
		submit && self.submitForm();
	},
	getQuery: function (value) {
		var self = this;
		if (state.tags) {
			var parts = value.split(',');
			value = parts[parts.length - 1];
		}
		return $.trim(value);
	},
	hideSuggests: function () {
		var self = this;
		state.list.empty().removeClass('suggest__list_on');
		fixPageHeight();
		self._restoreTriangles();
		self.cancelRequest();
	},
	_restoreTriangles: function () {
		if (state.triangles) {
			$.each(state.triangles, function () {
				this.removeClass('triangle-hide');
			});
			delete state.triangles;
		}
	},
	submitForm: function () {
		if (state.autoSubmit) {
			var form = state.input.parents('form'),
				cfms = form.find('input[name="cfms"]');
			
			if (Device.type == 'touch') {
				setTimeout(() => {
					cfms.length ? cfms.click() : form.submit();
				}, 500);
			} else {
				cfms.length ? cfms.click() : form.submit();
			}
		}
		
		var idx = state.input.data('suggest_index'),
			data = idx !== undefined ? 
				(state.cfg.onSelect && state.cfg.onSelect(idx, state.last_api_result)) || state.last_result[idx] : undefined;
		state.input.trigger('suggestSelect', data);
		state.input.trigger('suggestSelect:' + state.type, data);
	},
	moveSelectedItem: function (dir) {
		var self = this,
			list = state.list,
			items = list.find('.suggest__item'),
			active = list.find('.suggest__item_active');
		
		var current;
		if (!active.length) {
			current = (dir > 0 ? (state.tags ? items.first() : items.first().next()) : items.last());
		} else {
			var index = active.index();
			if (dir > 0) {
				// вниз
				index = index + 1 < items.length ? index + 1 : 0;
			} else {
				// вверх
				index = index - 1 >= 0 ? index - 1 : items.length - 1;
			}
			current = $(items[index]);
		}
		
		if (current[0] != active[0])
			self.highlightItem($(current), true);
	},
	getSuggests: function () {
		var self = this,
			value = self.getQuery(state.input.val());
		
		if (state.last_value !== value) {
			state.last_value = value;
			if (value.length >= state.cfg.length) {
				var api_data = {}, method = state.cfg.method;
				if (!state.cfg.param) {
					method = method.replace(/\{query\}/g, encodeURIComponent(value));
				} else {
					api_data[state.cfg.param] = value;
				}
				
				self.cancelRequest();
				api_data = $.extend(api_data, state.cfg.data, state.apiData);
				state.last_req_id = Spaces.api(method, api_data, function (res) {
					if (!state)
						return;
						
					if (state.cfg.noApi || res.code == 0) {
						var results = res, renderer = state.cfg.render ? tpl[state.cfg.render] : null;
						if (state.cfg.results)
							results = res[state.cfg.results];
						var html = state.tags ? "" : tpl.suggest(html_wrap(state.input.val()), true);
						for (var i = 0; i < results.length; ++i) {
							html += renderer ? renderer(results[i]) : 
								tpl.suggest(results[i]);
						}
						
						if (results.length > 0) {
							state.list.html(html).addClass('suggest__list_on');
							fixPageHeight(state.list);
						} else {
							self.hideSuggests();
						}
						
						// Костыли для ddmenu
						var menu = state.list.parents('.dropdown-menu__wrap');
						if (menu.length) {
							self._restoreTriangles();
							var links = DdMenu.findOpeners(menu.attr("id"));
							for (var i = 0; i < links.length; ++i) {
								var link = $(links[i]);
								if (link.hasClass('triangle-show_top')) {
									var max_y = state.list.offset().top + state.list.outerHeight();
									if (link.offset().top <= max_y) {
										if (!link.hasClass('triangle-hide')) {
											if (!state.triangles)
												state.triangles = [];
											state.triangles.push(link);
											link.addClass('triangle-hide');
										}
									}
									// link.addClass('triangle-hide');
								}
							}
						}
						state.last_api_result = res;
						state.last_result = results;
					}
				});
			} else {
				self.hideSuggests();
			}
		}
	},
	cancelRequest: function () {
		if (state && state.last_req_id) {
			Spaces.cancelApi(state.last_req_id);
			state.last_req_id = null;
		}
	},
	free: function () {
		var self = this;
		if (state) {
			clearInterval(state.timer);
			self.cancelRequest();
			state.input.removeData('suggest_index');
			state.list.removeClass('suggest__list_on').empty();
			state = null;
		}
	}
};

module.on("componentpage", function () {
	SearchSuggests.init();
});
