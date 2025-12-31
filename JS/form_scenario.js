import module from 'module';
import $ from './jquery';
import Spaces from './spacesLib';
import {resetForm} from './form_controls';
import {L} from './utils';

/*
	Gcoc Общее
	Gcoe Карьера
	Gcom Военная служба
	Gcop Родной город
*/
var GEO_SYNC = {
	'Gcoc': [ // Общее
		'Gcoe', // Карьера
		'Gcom'  // Военная служба
	],
	'Gcoe': [ // Карьера
		'Gcom'  // Военная служба
	]
};

var GEO_FORM_DEPS = {
	"#form-item_schools": {
		need: 'city',
		placeholder: [L('Начните вводить название школы'), L('Сначала выберите страну и город')],
		hide: '.school_selector #form-item_graduation_year',
	},
	"#form-item_universities": {
		need: 'city',
		placeholder: [L('Начните вводить название ВУЗа'), L('Сначала выберите страну и город')],
		hide: '.university_selector #form-item_graduation_year',
	},
	'#form-item_mil_unit': {
		need: 'country'
	},
	'#form-item_career': {
		need: 'country'
	}
};

var SELECTOR_DEPS = {
	'schools': {
		deps: '#form-item_class-selector, #form-item_years, .school_selector #form-item_graduation_year, #form-item_specialization, #form-item_access-read',
		hide: true
	},
	'universities': {
		deps: '#form-item_years, .university_selector #form-item_graduation_year, #form-item_faculty, #form-item_group, #form-item_group, #form-item_chair, #form-item_Form, #form-item_Status, #form-item_chair, #form-item_access-read',
		hide: true
	},
	'faculty': {
		deps: '#form-item_chair',
		hide: false
	},
	'career': {
		deps: '#form-item_years, #form-item_position, #form-item_description, #form-item_access-read, #form-item_new_mil_unit',
		hide: true
	},
	'mil_unit': {
		deps: '#form-item_years, #form-item_rank, #form-item_description, #form-item_access-read, #form-item_new_mil_unit',
		hide: true
	}
};

module.on("componentpage", function () {
	$('#main')
	.on('objectSelected', function (e, object) {
		if (!object.changed)
			return;
		
		var deps_config = SELECTOR_DEPS[object.uniq];
		if (deps_config) {
			$(deps_config.deps).each(function () {
				var el = $(this);
				if (el.hasClass('js-objsel')) {
					var selector = el.objectSelector();
					if (selector.value().id || object.id || object.empty)
						selector.reset()
				} else {
					el.find('select').val('');
				}
				
				el.toggleClass('hide', deps_config.hide && object.empty);
			});
		}
	})
	.on('geoSelected', function (e, geo) {
		// Какая-то ёбанная магия из-за говнокода Серёги, когда нибудь перепишу -_-
		var group = geo.selector.wrap.parents('.js-group, .js-parent').first(),
			parent = group.length ? group : geo.selector.wrap.parents('form'),
			global_has_value = !!(geo.country && geo.valid);
		
		$.each(GEO_FORM_DEPS, function (k, dep) {
			var el = parent.find(k).show(),
				el_group = el.parents('.js-group, .js-parent').first();
			
			if (!(!el_group.length == !group.length && el_group[0] == group[0]))
				return;
			
			var fill_error = !!el.data('fill_error'),
				fill_error_place = el.find('.js-fill_error'),
				has_value = !fill_error && !!geo[dep.need];
			
			// Скрытие зависимого поля
			var can_be_hidden = el.data('can_be_hidden');
			if ((can_be_hidden || can_be_hidden === null || can_be_hidden === undefined))
				el.toggle(has_value);
			el.find('.js-search_btn').toggle(has_value);
			
			// Показ ошибки требования заполнения ГЕО
			fill_error_place.toggleClass('hide', has_value);
			
			var city_error = el.find('.js-city_error');
			if (city_error.length || fill_error) {
				// Cброс .attention
				el.find('.js-toggle_attention').toggleClass('attention', !has_value);
				
				// Eдаляем ошибку выбора города
				city_error.toggle(!has_value);
			}
			
			// Cбрасываем поля ввода
			if (dep.hide) {
				var reset_list = parent.find(dep.hide);
				reset_list.hide().find('input[type="text"], select').val('');
				resetForm(reset_list);
			}
			
			el.each(function () {
				var el = $(this);
				
				if (el.hasClass('js-objsel')) {
					// Сбрасываем селекторы при смене ГЕО
					if (geo.changed)
						el.objectSelector().reset();
					
					// Меняем плейсхолдеры
					if (dep.placeholder && !fill_error)
						el.find('.js-objsel_input').attr("placeholder", dep.placeholder[has_value ? 0 : 1])
				}
			});
			
			// Блокируем все инпуты
			var inputs = el.find('[type="text"]');
			has_value ? inputs.removeAttr("disabled") : inputs.attr("disabled", "disabled");
		});
		
		// Синхронизация гео-селекторов, пока юзер их не изменял вручную
		var slaves = GEO_SYNC[geo.id];
		if (slaves) {
			$.each(slaves, function (_, slave_id) {
				var slave = $('#city_fw__' + slave_id).geoSelector();
				if (!slave.isManual())
					slave.select(geo.raw);
			});
		}
	});
});


