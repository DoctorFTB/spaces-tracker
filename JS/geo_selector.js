import module from 'module';
import $ from './jquery';
import {Class} from './class';
import Spaces from './spacesLib';
import DdMenu from './dd_menu';

import './form_controls';
import './search';
import {L, tick} from './utils';

var MODE_REQUIRED	= 1, // Требовать указание этого
	MODE_OPTIONAL	= 2, // Не требовать указания этого, но давать возможность
	MODE_NOT_ASK	= 3, // Не спрашивать это
	MODE_WITH_CITY	= 4, // Только вместе с городом
	
	RENDER_INPUT	= 1, // Выглядит, как поле ввода
	RENDER_DROPDOWN	= 2, // Выглядит, как выпадающее меню
	
	ITEMS_PER_PAGE	= 5; // Результатов на страницу

var last_api_request;

var tpl = {
	city: function (data) {
		var html = 
			'<div class="js-geosel_item s-city__item s-chb ' + (data.hidden ? ' hide ' : '') + (data.selected ? ' clicked s-city__item_light ' : ' s-city__item_city ') + '" ' + 
				'data-type="city" ' + 
				'data-name="' + data.name + '" ' + 
				'data-country_name="' + data.country_name + '" ' + 
				'data-country_id="' + data.country_id + '" ' + 
				'data-id="' + data.id + '" ' + 
			'>' + 
				(data.short_name ? '<span class="ico_flags ico_flags_' + data.short_name + 'p s-city__country-flag"></span>' : '') + 
				'<div class="s-city__item-content">' + 
					'<div class="s-city__item-title">' + (data.selected && data.country_name ? data.name + ', ' + data.country_name : data.name) + '</div>' + 
				'</div>' + 
				'<div class="s-city__item-region">' + 
					(data.region_name || '') + 
					(data.area_name && data.region_name ? ', ' : '') + 
					(data.area_name || '') + 
				'</div>' + 
			'</div>'
		return html;
	},
	region: function (data) {
		var html = 
			'<div class="js-geosel_item s-city__item s-chb ' + (data.hidden ? ' hide ' : '') + (data.selected ? ' clicked s-city__item_light ' : ' s-city__item_city ') + '" ' + 
				'data-type="region" ' + 
				'data-name="' + data.name + '" ' + 
				'data-country_name="' + data.country_name + '" ' + 
				'data-country_id="' + data.country_id + '" ' + 
				'data-id="' + data.id + '" ' + 
			'>' + 
				(data.short_name ? '<span class="ico_flags ico_flags_' + data.short_name + 'p s-city__country-flag"></span>' : '') + 
				'<div class="s-city__item-title">' + (data.selected && data.country_name ? data.name + ', ' + data.country_name : data.name) + '</div>' + 
			'</div>'
		return html;
	},
	country: function (data) {
		var html = 
			'<div class="js-geosel_item s-city__item s-chb ' + (data.hidden ? ' hide ' : '') + (data.selected ? ' clicked s-city__item_light ' : ' s-city__item_city ') + '" ' + 
				'data-type="country" ' + 
				'data-name="' + data.name + '" ' + 
				'data-short_name="' + data.short_name + '" ' + 
				'data-id="' + data.id + '" ' + 
			'>' + 
				(data.short_name ? '<span class="ico_flags ico_flags_' + data.short_name + 'p s-city__country-flag"></span>' : '') + 
				'<div class="s-city__item-title">' + data.name + '</div>' + 
			'</div>';
		return html;
	},
	notFound: function (error) {
		var html =
				'<div class="s-city__stnd s-city__item_light oh">' +
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
			<div class="pgn-wrapper js-geosel_pagenav">
				<div class="pgn">
					<table class="table__wrap pgn__table">
						<tr>
							<td class="table__cell" width="35%">
								<button type="submit" name="_"
									class="js-geosel_pagenav_link pgn__button pgn__link_prev pgn__link_hover ${prev_disabled ? 'pgn__link_disabled' : ''}"
									${prev_disabled ? 'disabled="disabled"' : ''} data-p="${data.page - 1}"
								>
									<span class="ico ico_arr_left"></span> ${L('Назад')}
								</button>
							</td>
							<td class="table__cell" style="cursor: pointer;">
								<div class="js-geosel_pagenav_cnt pgn__counter pgn__range pgn__link_hover">
									${L('{0} из {1}', data.page , data.total)}
								</div>
							</td>
							<td class="table__cell table__cell_last" width="35%">
								<button type="submit" name="_"
									class="js-geosel_pagenav_link pgn__button pgn__link_next pgn__link_hover ${next_disabled ? 'pgn__link_disabled' : ''}"
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
	}
};

var GeoSelector = Class({
	Constructor: function (wrap) {
		var self = this;
		
		self.wrap = wrap;
		self.opts = wrap.data();
		self.input = wrap.find('.js-geosel_input');
		self.inputWrap = wrap.find('.js-usearch_parent');
		self.result = wrap.find('.js-geosel_result');
		self.offers = wrap.find('.js-geosel_offers');
		self.current = wrap.find('.js-geosel_current');
		
		self.empty = wrap.find('.js-geosel_item[data-id="0"]');
		self.label = wrap.find('.js-geosel_label');
		
		self.country_id = wrap.find('.js-geosel_country_id');
		self.city_id = wrap.find('.js-geosel_city_id');
		self.region_id = wrap.find('.js-geosel_region_id');
		
		self.wrap.on('click', '.js-geosel_item', function (e) {
			e.preventDefault();
			e.stopPropagation();
			
			var el = $(this), data = el.data();
			self.select(data, true);
		})
		.on('click', '.js-geosel_pagenav_link', function (e) {
			e.preventDefault();
			e.stopPropagation();
			
			let el = $(this);
			if (el.attr('disabled'))
				return;
			
			el.parents('.js-geosel_pagenav').find('.js-geosel_pagenav_cnt').html(tpl.spinner());
			
			self.search_offset = ITEMS_PER_PAGE * ($(this).data("p") - 1);
			self.usearch.refreshSearch();
		})
		.itemsSelector({
			selector:		'.js-geosel_item',
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
						if ($focused.parents('#city_fw__form' + self.opts.uniq).length || !$focused.parents('body').length) {
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
						self.empty.toggle(self.allowEmpty() && empty);
						self.offers.toggle(empty);
						self.current.toggle(empty);
						self.result.toggle(!empty);
					} else {
						// В режиме поля ввода:
						// 1. Сразу после очистки поля ввода скрываем результаты поиска
						// 2. Показывает результаты поиска (скрывая офферы и текущий гео) только после их загрузки
						if (empty) {
							if (self.allowEmpty())
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
		
		/*
		var modes = ["???", "required", "optional", "not_ask", "with_city"];
		console.log("city: " + modes[self.opts.city]);
		console.log("country: " + modes[self.opts.country]);
		console.log("region: " + modes[self.opts.region]);
		*/
		
		wrap.on('dd_menu_open', function () {
			self.stop_search = false;
			
			if (!self.allowEmpty())
				self.empty.hide();
			
			self.original_value = self.input.val();
			if (self.opts.render == RENDER_INPUT) {
				self.skip_search = true;
				self.inputWrap.addClass('search__results-show');
			}
			
			$('.js-geo_sel_warn').hide();
		}).on('dd_menu_closed', function () {
			self.stop_search = true;
			
			if (self.allowEmpty())
				self.empty.show();
			self.offers.show();
			self.current.show();
			self.result.hide().html('');
			
			if (self.original_value)
				self.input.val(self.original_value).trigger('input');
			
			if (self.opts.render == RENDER_INPUT)
				self.inputWrap.removeClass('search__results-show');
			
			$('.js-geo_sel_warn').show();
		}).on('clearSearchForm', function () {
			if (self.opts.render == RENDER_INPUT) {
				// Сброс выбранного города
				self.reset();
			}
		});
		
		// Значение установлено сервером
		if (!self.isEmpty())
			self.wrap.data('manual', true);
		
		// Разрешаем открывать выпадающее меню
		$('#city_fw__form' + self.opts.uniq).data('disabled', false);
	},
	select: function (data, manual) {
		var self = this;
		
		// Конвертируем выбранный город в выбранную страну, если этот селектор принимает только страну
		if (data.type == 'city' && self.opts.city == MODE_NOT_ASK) {
			data = $.extend({}, data, {
				type:	'country',
				id:		data.country_id,
				name:	data.country_name
			});
		}
		
		// Если пытаются засетать невалидные данные, сбрасываем выбранное гео
		if ((data.type in self.opts) && self.opts[data.type] == MODE_NOT_ASK) {
			self.reset();
			return;
		}
		
		self.stop_search = true;
		
		var name = data.name, ico = 'ico_place';
		
		self.empty.removeClass('clicked');
		
		if (self.opts.render == RENDER_DROPDOWN)
			self.input.val('').trigger('input');
		
		var old_values = [+self.country_id.val(), +self.city_id.val(), +self.region_id.val()];
		if (data.type == 'empty') { // Выбрали "Не выбрано"
			if (self.opts.region == MODE_NOT_ASK || self.opts.country == MODE_NOT_ASK)
				self.country_id.val(0);
			self.city_id.val(0);
			self.region_id.val(0);
			
			if (self.opts.render == RENDER_INPUT)
				self.input.val('').trigger('input');
			
			self.empty.addClass('clicked');
			self.current.find('[data-id]').removeClass('clicked');
			
			ico = self.opts.geoFilter ? 'ico_acl_all_grey' : 'ico_place';
		} else if (data.type == 'country') { // Выбрали страну
			self.country_id.val(data.id);
			self.city_id.val(0);
			self.region_id.val(0);
			
			self.current.html(tpl.country({
				id:			data.id,
				name:		data.name,
				selected:	1
			}));
			
			if (self.opts.render == RENDER_INPUT)
				self.input.val(name).trigger('input');
		} else if (data.type == 'city') { // Выбрали город
			self.country_id.val(data.country_id);
			self.city_id.val(data.id);
			self.region_id.val(0);
			
			self.current.html(tpl.city({
				id:				data.id,
				name:			data.name,
				country_id:		data.country_id,
				country_name:	data.country_name,
				selected:		1
			}));
			
			name = data.country_name ? data.name + ', ' + data.country_name : data.name;
			
			if (self.opts.render == RENDER_INPUT)
				self.input.val(name).trigger('input');
		} else if (data.type == 'region') { // Выбрали регион
			self.country_id.val(data.country_id);
			self.city_id.val(0);
			self.region_id.val(data.id);
			
			self.current.html(tpl.region({
				id:				data.id,
				name:			data.name,
				country_id:		data.country_id,
				country_name:	data.country_name,
				selected:		1
			}));
			
			name = data.country_name ? data.name + ', ' + data.country_name : data.name;
			
			if (self.opts.render == RENDER_INPUT)
				self.input.val(name).trigger('input');
		}
		
		self.label.find('.js-ico').removeClass('ico_place ico_acl_all_grey').addClass(ico);
		self.label.find('.js-btn_val').text(name);
		
		// Скрываем дубли
		var current = self.current.find('[data-id]');
		self.offers.children().each(function () {
			var offer = $(this);
			offer.toggle(!(offer.data('id') == current.data('id') && offer.data('country_id') == current.data('country_id')));
		});
		
		self.original_value = false;
		
		if (manual) {
			// Закрываем окно после выбора
			DdMenu.close();
			
			self.input.blur();
			self.wrap.data("manual", true);
		}
		
		var new_values = [+self.country_id.val(), +self.city_id.val(), +self.region_id.val()];
		
		var event = {
			selector:	self,
			id:			self.opts.uniq,
			city:		+self.city_id.val(),
			region:		+self.region_id.val(),
			country:	+self.country_id.val(),
			manual:		!!self.wrap.data("manual"),
			type:		data.type,
			raw:		data,
			valid:		true,
			changed:	false
		};
		
		// Проверяем, изменилось ли гео?
		for (var i = 0; i < old_values.length; ++i) {
			if (new_values[i] != old_values[i])
				event.changed = true;
		}
		
		if (self.opts.city == MODE_REQUIRED && !event.city)
			event.valid = false;
		
		if ((self.opts.country == MODE_REQUIRED || self.opts.country == MODE_WITH_CITY) && !event.country)
			event.valid = false;
		
		if (self.opts.region == MODE_REQUIRED && !event.region)
			event.valid = false;
		
		self.wrap.trigger('geoSelected', event);
	},
	search: function (query, callback) {
		var self = this,
			q = query.split(', ')[0], // Удаляем страну из поиска
			api_method,
			api_data = {O: self.search_offset, L: ITEMS_PER_PAGE, q: q};
		
		if (self.opts.weather)
			api_data.W = 1;
		
		if (self.opts.region != MODE_NOT_ASK) {
			api_method = 'services.searchRegion';
			api_data.С = self.country_id.val();
			if (self.opts.country != MODE_NOT_ASK) {
				api_data.M = 1;
			}
		} else if (self.opts.city == MODE_NOT_ASK) {
			api_method = 'services.searchCountry';
		} else if (self.opts.city == MODE_OPTIONAL) {
			api_method = 'services.searchCity';
			if (self.opts.country != MODE_WITH_CITY) {
				api_data.M = 1;
			}
		} else {
			api_method = 'services.searchCity';
		}
		
		if (q.length < 1) {
			callback();
			return;
		}
		
		Spaces.cancelApi(last_api_request);
		last_api_request = Spaces.api(api_method, api_data, function (res) {
			callback();
			if (res.code == 0) {
				if (self.opts.render == RENDER_INPUT) {
					self.empty.hide();
					self.offers.hide();
					self.current.hide();
					self.result.show();
				}
				
				if (res.count) {
					var html = '';
					
					if (res.countries) {
						for (var i = 0; i < res.countries.length; ++i)
							html += tpl.country(res.countries[i]);
					}
					
					if (res.regions) {
						for (var i = 0; i < res.regions.length; ++i)
							html += tpl.region(res.regions[i]);
					}
					
					if (res.cities) {
						for (var i = 0; i < res.cities.length; ++i)
							html += tpl.city(res.cities[i]);
					}
					
					if (res.count > ITEMS_PER_PAGE && (self.opts.city != MODE_NOT_ASK || self.opts.region != MODE_NOT_ASK)) {
						html += tpl.pagination({
							page: self.search_offset / ITEMS_PER_PAGE + 1,
							total: Math.ceil(res.count / ITEMS_PER_PAGE)
						});
					}
					
					self.result.html(html);
				} else {
					var error;
					if (self.opts.region != MODE_NOT_ASK) {
						error = L("К сожалению, мы не нашли такой регион. Попробуйте ещё раз.");
					} else if (self.opts.city == MODE_OPTIONAL) {
						error = L("К сожалению, мы не нашли такого города. Пожалуйста, проверьте правильность или введите вместо него название страны.");
					} else if (self.opts.city == MODE_NOT_ASK) {
						error = L("К сожалению, мы не нашли такой страны. Попробуйте ещё раз.");
					} else {
						error = L("К сожалению, мы не нашли такого города. Пожалуйста, проверьте правильность.");
					}
					self.result.html(tpl.notFound(error));
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
	isManual: function () {
		return !!this.wrap.data('manual');
	},
	value: function () {
		var self = this;
		return {
			city: +self.city_id.val(),
			region: +self.region_id.val(),
			country: +self.country_id.val()
		};
	},
	allowEmpty: function () {
		var self = this;
		return (self.isEmpty() || self.opts.render == RENDER_INPUT || (self.opts.country != MODE_REQUIRED && self.opts.city != MODE_REQUIRED && self.opts.region != MODE_REQUIRED));
	}
});

$.fn.geoSelector = function () {
	var el = this,
		data = el.data();
	
	if (el.length) {
		if (!data.geosel)
			data.geosel = new GeoSelector(this);
		return data.geosel;
	}
	
	return;
};

module.on("component", function () {
	$('.js-geosel').each(function () {
		$(this).geoSelector();
	});
});


