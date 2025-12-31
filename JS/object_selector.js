import module from 'module';
import $ from './jquery';
import {Class} from './class';
import Spaces from './spacesLib';
import DdMenu from './dd_menu';
import {L, html_wrap, tick} from './utils';
import './select_item';
import './search';

var RENDER_INPUT	= 1, // Выглядит, как поле ввода
	RENDER_DROPDOWN	= 2, // Выглядит, как выпадающее меню
	
	ITEMS_PER_PAGE	= 5; // Результатов на страницу

var TYPES = {
	SCHOOLS:		1,
	UNIVERSITIES:	2,
	MIL_UNIT:		3,
	EMPLOYER:		4,
	SITE:			6,
	FACULTY:		7,
	CHAIR:			8,
	MOBILE:			90
};

var CONFIG = {
	[TYPES.SCHOOLS]: {
		method:		"services.searchSchool",
		cityParam:	"C",
		result:		"schools",
		notfound:	L('Школа не найдена, попробуйте найти другую.')
	},
	[TYPES.UNIVERSITIES]: {
		method:		"services.searchUniversity",
		cityParam:	"C",
		result:		"universities",
		notfound:	L("ВУЗ не найден, попробуйте найти другой.")
	},
	[TYPES.FACULTY]: {
		method:		"services.searchFaculty",
		cityParam:	"C",
		result:		"faculties",
		notfound:	L("Факультет не найден, попробуйте найти другой.")
	},
	[TYPES.CHAIR]: {
		method:		"services.searchFaculty",
		cityParam:	"C",
		result:		"chairs",
		notfound:	L("Кафедра не найдена, попробуйте найти другую.")
	},
	[TYPES.EMPLOYER]: {
		method:		"services.searchEmployer",
		cityParam:	"C",
		result:		"employers",
		notfound:	L("Компания не найдена, попробуйте найти другую.")
	},
	[TYPES.MIL_UNIT]: {
		method:			"services.searchMilUnit",
		result:			"mil_units",
		countryParam:	"C",
		notfound:		L('Военная часть не найдена, попробуйте найти другую.')
	},
	[TYPES.SITE]: {
		method:		"services.searchSite",
		result:		"sites",
		notfound:	L("Сайт не найден, попробуйте найти другой.")
	},
	[TYPES.MOBILE]: {
		method:		"devices.searchModel",
		result:		"models",
		notfound:	L("Телефон не найден, попробуйте найти другой.")
	}
};

var last_api_request;

var tpl = {
	item: function (data, type) {
		var html;
		
		if (type == TYPES.MOBILE) {
			if (!data.title)
				data.title = data.brand + ' ' + data.name;
			
			html = 
				'<div class="js-objsel_item s-city__item s-city__item_mobile s-city__item_light s-chb ' + (data.hidden ? ' hide ' : '') + (data.selected ? ' clicked ' : '') + '" ' + 
					'data-id="' + data.id + '" ' + 
					'data-title="' + data.title + '" ' + 
				'>' + 
					'<div class="s-city__wrap-mobile-pic">' + 
						'<img src="' + THUMBS_BASEURL + '/devices/device_' + data.id + '_small.jpg" alt="" /> ' + 
					'</div>' + 
					data.title + 
				'</div>';
		} else {
			html = 
				'<div class="js-objsel_item s-city__item  s-city__item_light s-chb ' + (data.hidden ? ' hide ' : '') + (data.selected ? ' clicked ' : '') + '" ' + 
					'data-id="' + data.id + '" ' + 
					'data-title="' + data.title + '" ' + 
				'>' + 
					data.title + 
				'</div>';
		}
		return html;
	},
	notFound: function (error) {
		var html =
			'<div class="s-city__stnd s-city__item_light content-bl__sep oh">' +
				'<table class="table__wrap table__wrap-layout">' +
					'<tr>' +
						'<td class="table__cell table__cell_large-ico">' +
							'<span class="ico_large ico_large_compass left"></span>' +
						'</td>' +
						'<td>' +
							'<div class="oh">' + error + '</div>' +
						'</td>' +
					'</tr>' +
				'</table>' +
			'</div>';
		return html;
	},
	pagination: function (data) {
		let prev_disabled = data.page <= 1;
		let next_disabled = data.page >= data.total;
		
		return `
			<div class="pgn-wrapper js-objsel_pagenav">
				<div class="pgn">
					<table class="table__wrap pgn__table">
						<tr>
							<td class="table__cell" width="35%">
								<button type="submit" name="_"
									class="js-objsel_pagenav_link pgn__button pgn__link_prev pgn__link_hover ${prev_disabled ? 'pgn__link_disabled' : ''}"
									${prev_disabled ? 'disabled="disabled"' : ''} data-p="${data.page - 1}"
								>
									<span class="ico ico_arr_left"></span> ${L('Назад')}
								</button>
							</td>
							<td class="table__cell" style="cursor: pointer;">
								<div class="js-objsel_pagenav_cnt pgn__counter pgn__range pgn__link_hover">
									${L('{0} из {1}', data.page , data.total)}
								</div>
							</td>
							<td class="table__cell table__cell_last" width="35%">
								<button type="submit" name="_"
									class="js-objsel_pagenav_link pgn__button pgn__link_next pgn__link_hover ${next_disabled ? 'pgn__link_disabled' : ''}"
									${next_disabled ? 'disabled="disabled"' : ''} data-p="${data.page + 1}"
								>
									${L('Вперёд')} <span class="ico ico_arr_right"></span>
								</button>
							</td>
						</tr>
					</table>
				</div>
			</div>
		`;
	},
	spinner: function () {
		return '<span class="ico ico_spinner"></span>';
	},
	message: function (text) {
		return '<div class="s-city__stnd s-city__item_light t_center pad_t_a">' + text + '</div>';
	},
	createOffer: function (data) {
		var html = 
			'<a href="#" class="list-link stnd-link_arr stnd-link_profile js-objsel_item" data-id="0" data-title="' + html_wrap(data.word) + '">' + 
				L('Создать ') + '&laquo;<b>' + html_wrap(data.word) + '</b>&raquo;' + 
			'</a>';
		return html;
	}
};

var ObjectSelector = Class({
	Constructor: function (wrap) {
		var self = this;
		
		self.wrap = wrap;
		
		self.opts = wrap.data();
		self.input = wrap.find('.js-objsel_input');
		self.inputWrap = wrap.find('.js-usearch_parent');
		self.result = wrap.find('.js-objsel_result');
		self.offers = wrap.find('.js-objsel_offers');
		self.current = wrap.find('.js-objsel_current');
		
		self.empty = wrap.find('.js-objsel_item[data-empty]');
		self.label = wrap.find('.js-objsel_label');
		
		self.object_id = wrap.find('.js-hidden_value');
		
		self.adapter = CONFIG[self.opts.type];
		
		self.wrap.on('click', '.js-objsel_item', function (e) {
			e.preventDefault();
			e.stopPropagation();
			
			var el = $(this), data = el.data();
			// Если data-title="null" то будет null вместо строки "null" и тестеры бесконечно репортят это как баг. 
			data.title = el.attr("data-title");
			self.select(data, true);
		})
		.on('click', '.js-objsel_pagenav_link', function (e) {
			e.preventDefault();
			e.stopPropagation();
			
			let el = $(this);
			if (el.attr('disabled'))
				return;
			
			el.parents('.js-objsel_pagenav')
				.find('.js-objsel_pagenav_cnt').html(tpl.spinner());
			
			self.search_offset = ITEMS_PER_PAGE * ($(this).data("p") - 1);
			self.usearch.refreshSearch();
		})
		.itemsSelector({
			selector:		'.js-objsel_item',
			activeClass:	's-city__item_hovered',
			keydownArea: 	self.input,
			external:		true
		});
		
		if (self.opts.render == RENDER_INPUT) {
			self.input.on('blur', function () {
				// Костыли костылики
				var menu_id = DdMenu.currentId();
				tick(function () {
					if (document.activeElement) {
						var $focused = $(document.activeElement);
						if ($focused.parents('#search_selector__menu_' + self.opts.uniq).length || !$focused.parents('body').length) {
							// костыль для <tab>
							return;
						}
						DdMenu.close(menu_id);
					}
				});
			});
		}
		
		// Поиск
		var last_empty = self.input.val().length < 1;
		self.usearch = wrap.find('.js-usearch_parent').usearch({
			length: 1,
			allowEmpty: true,
			skipDefault: true,
			onInput: function (e) {
				var empty = e.value.length < 1;
				if (last_empty != empty) {
					if (self.opts.render == RENDER_DROPDOWN) {
						// В режиме выпадающего окна:
						// 1. Сразу после очистки поля ввода скрываем результаты поиска
						// 2. Сразу после ввода поискового слова показывает результаты поиска (скрывая офферы и текущий гео), не дожидаясь их загрузки
						self.empty.toggle(empty);
						self.offers.toggle(empty);
						self.current.toggle(empty);
						self.result.toggle(!empty);
					} else {
						// В режиме поля ввода:
						// 1. Сразу после очистки поля ввода скрываем результаты поиска
						// 2. Показывает результаты поиска (скрывая офферы и текущий гео) только после их загрузки
						if (empty) {
							self.empty.show();
							self.offers.show();
							self.current.show();
							self.result.hide();
						}
					}
					
					if (empty)
						self.result.html('');
					
					DdMenu.fixSize();
					
					last_empty = empty;
				}
			},
			doSearch: function (e) {
				if (self.stop_search) {
					e.onSuccess();
					return;
				}
				
				if (!e.refresh)
					self.search_offset = 0;
				self.search(e.query, e.onSuccess);
			}
		});
		
		wrap.on('dd_menu_open', function () {
			self.stop_search = false;
			self.original_value = self.input.val();
			if (self.opts.render == RENDER_INPUT) {
				self.skip_search = true;
				self.inputWrap.addClass('search__results-show');
			}
			
			// Фильтруем офферы по ГЕО, если нужно
			var geo = self.getGeo();
			if (geo) {
				self.offers.find('[data-city_id]').each(function () {
					var el = $(this),
						offer_city = el.data("city_id"),
						offer_country = el.data("country_id");
					
					var hide = (offer_city && offer_city != geo.city) || (offer_country && offer_country != geo.country);
					el.toggle(!hide);
				});
			}
		}).on('dd_menu_closed', function () {
			self.stop_search = true;
			
			self.empty.show();
			self.offers.show();
			self.current.show();
			self.result.hide().html('');
			
			if (self.original_value !== false) {
				var value = $.trim(self.input.val());
				if (self.opts.create && value.length) {
					self.select({
						id:		0,
						title:	value
					});
				} else {
					self.input.val(self.original_value).trigger('input');
				}
			}
			
			if (self.opts.render == RENDER_INPUT)
				self.inputWrap.removeClass('search__results-show');
		}).on('clearSearchForm', function () {
			if (self.opts.render == RENDER_INPUT) {
				// Сброс выбранного города
				self.reset();
			}
		});
		
		self.last_input_value = $.trim(self.input.val());
		
		var selected = self.current.find('.js-objsel_item');
		if (selected.length)
			selected.data('id', self.object_id.val());
		
		// Разрешаем открывать выпадающее меню
		$('#search_selector__menu_' + self.opts.uniq).data('disabled', false);
	},
	select: function (data, manual) {
		var self = this;
		
		self.stop_search = true;
		
		self.empty.removeClass('clicked');
		
		if (self.opts.render == RENDER_DROPDOWN)
			self.input.val('').trigger('input');
		
		var old_values = self.value();
		if (data.empty) { // Выбрали "Не выбрано"
			self.object_id.val(0);
			
			if (self.opts.render == RENDER_INPUT)
				self.input.val('').trigger('input');
			
			self.empty.addClass('clicked');
			self.current.find('.js-objsel_item').removeClass('clicked');
		} else { // Выбрали объект
			self.object_id.val(data.id);
			
			self.current.html(tpl.item({
				id:				data.id,
				title:			html_wrap(data.title),
				selected:		1
			}));
			
			if (self.opts.render == RENDER_INPUT)
				self.input.val(data.title).trigger('input');
		}
		
		self.label.find('.js-btn_val').text(data.title);
		
		// Скрываем дубли
		var current = self.current.find('.js-objsel_item');
		self.offers.children().each(function () {
			var offer = $(this);
			offer.toggle(offer.data('id') != current.data('id'));
		});
		
		self.original_value = false;
		
		if (manual) {
			// Закрываем окно после выбора
			DdMenu.close();
			
			self.input.blur();
		}
		
		self.last_input_value = $.trim(self.input.val());
		
		var is_empty = self.isEmpty(),
			new_values = self.value();
		
		var event = {
			selector:	self,
			uniq:		self.opts.uniq,
			id:			new_values.id,
			text:		new_values.text,
			raw:		data,
			changed:	new_values.id != old_values.id || new_values.text != old_values.text,
			empty:		is_empty
		};
		
		self.wrap.trigger('objectSelected', event);
		
		self.wrap.find('.js-toggle_attention').toggleClass('attention', is_empty);
		self.wrap.find('.js-fill_error').toggleClass('hide', !is_empty);
	},
	search: function (q, callback) {
		var self = this,
			api_method,
			api_data = {O: self.search_offset, L: ITEMS_PER_PAGE, q: q};
		
		var geo = self.getGeo(),
			force_not_found = false,
			error;
		
		if (self.adapter.countryParam) {
			api_data[self.adapter.countryParam] = geo.country;
			if (!geo.country)
				error = L("Выберите сначала страну.");
		}
		
		if (self.adapter.cityParam) {
			api_data[self.adapter.cityParam] = geo.city;
			if (!geo.city)
				error = L("Выберите сначала город.");
		}
		
		if (!error && (self.opts.type == TYPES.FACULTY || self.opts.type == TYPES.CHAIR)) {
			var universities = $('#form-item_universities').objectSelector();
			if (universities) {
				var value = universities.value();
				if (!(self.opts.create && value.text.length > 0) && !value.id) {
					error = L("Выберите сначала университет.");
				} else {
					api_data.U = value.id;
					
					if (!api_data.U)
						force_not_found = true;
				}
			}
		}
		
		if (!error && self.opts.type == TYPES.CHAIR) {
			var faculty = $('#form-item_faculty').objectSelector();
			if (faculty) {
				var value = faculty.value();
				if (!(self.opts.create && value.text.length > 0) && !value.id) {
					error = L("Выберите сначала факультет.");
				} else if (!api_data.U) {
					api_data.F = value.id;
					
					if (!api_data.F)
						force_not_found = true;
				}
			}
		}
		
		var ui_change_on_results = function () {
			if (self.opts.render == RENDER_INPUT) {
				self.empty.hide();
				self.offers.hide();
				self.current.hide();
				self.result.show();
			}
			
			if (self.opts.create) {
				self.result.append(tpl.createOffer({
					word: q
				}));
			}
		};
		
		var show_not_found = function () {
			self.result.html(tpl.notFound(self.adapter.notfound));
		};
		
		if (q.length < 1) {
			callback();
			return;
		} else if (error) {
			self.result.html(tpl.message(error));
			DdMenu.fixSize();
			ui_change_on_results();
			callback();
			return;
		} else if (force_not_found) {
			show_not_found();
			ui_change_on_results();
			DdMenu.fixSize();
			callback();
			return;
		}
		
		Spaces.cancelApi(last_api_request);
		last_api_request = Spaces.api(self.adapter.method, api_data, function (res) {
			callback();
			if (res.code == 0) {
				var results = res[self.adapter.result];
				
				if (!res.count)
					res.count = results.length;
				
				if (res.count) {
					var html = '';
					for (var i = 0; i < results.length; ++i)
						html += tpl.item(results[i], self.opts.type);
					self.result.html(html);
				} else {
					show_not_found();
				}
				
				ui_change_on_results();
				
				if (res.count > ITEMS_PER_PAGE) {
					self.result.append(tpl.pagination({
						page: self.search_offset / ITEMS_PER_PAGE + 1,
						total: Math.ceil(res.count / ITEMS_PER_PAGE)
					}));
				}
			}
			
			DdMenu.fixSize();
		}, {
			onError: function () {
				callback();
			}
		});
	},
	reset: function () {
		this.empty.click();
	},
	isEmpty: function () {
		return this.empty.hasClass('clicked');
	},
	uniq: function () {
		var self = this;
		return self.opts.uniq;
	},
	value: function () {
		var self = this;
		return {
			id:		+self.object_id.val() || 0,
			text:	self.last_input_value
		};
	},
	getGeo: function () {
		let self = this,
			parent = self.wrap.parents('.js-parent');
		if (!parent.length)
			parent = $('body');
		let geosel = parent.find('.js-geosel');
		let selector = geosel.geoSelector && geosel.geoSelector();
		return selector && selector.value();
	}
});

$.fn.objectSelector = function () {
	var el = this,
		data = el.data();
	
	if (el.length) {
		if (!data.objsel)
			data.objsel = new ObjectSelector(this);
		return data.objsel;
	}
	
	return;
};

module.on("component", function () {
	$('.js-objsel').each(function () {
		$(this).objectSelector();
	});
});


