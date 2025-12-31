import module from 'module';
import $ from './jquery';
import page_loader from './ajaxify';
import UniversalSearch from './search';
import {Url} from './spacesLib';
import {L, extend, tick, ce} from './utils';

import './form_controls';
import './search_form';

var tpl = {
	notFound: function (name) {
		return '' + 
		'<div class="dropdown-menu_text oh content-bl__sep no-shadow">' + 
			'<table class="table__wrap table__wrap-layout"><tr>' + 
				'<td class="table__cell table__cell_large-ico">' + 
					'<div class="ico_large ico_large_no_results"></div>' + 
				'</td>' + 
				'<td class="table__cell">' + L("Пользователь не найден.") + '</td>' + 
			'</tr></table>' + 
		'</div>';
	}
};

var last_search_result;
UniversalSearch.register("groups_list", {
	apiMethod: 'user_groups.selector_autocomplete',
	apiData: {},
	param: "sq",
	results: "found",
	hideEmpty: true,
	render: {
		activeClass: 'list-link__wrap_hover',
		showOnFocus: true,
		hideEmpty: true,
		inputActiveClass: 'triangle-show js-clicked'
	},
	onBeforeSend: function (sq, params) {
		$('[name$="_psq"]').val(sq);
		
		var self = this,
			form = Url.serializeForm(self.el.parents('form')[0]);
		
		params.GlS_u = form.GlS_u;
		params.GlS_e = form.GlS_e;
		params.s = form.s;
	},
	onRender: function (list, data, sq) {
		var result = [];
		if (data.found.length) {
			for (var i = 0; i < data.found.length; ++i)
				result.push('<div>', data.found[i], '</div>');
		} else {
			result.push(tpl.notFound());
		}
		list.html(result.join(''));
	},
	onResult: function (data, sq) {
		last_search_result = data;
	}
});

UniversalSearch.register("groups_list_search", {
	apiMethod: function () {
		var self = this,
			url = new Url(self.el.parents('form').attr("action"));
		url.path = '/ajax' + Date.now() + url.path;
		return url.url();
	},
	apiData: {},
	param: "sq",
	noapi: true,
	results: "found",
	onBeforeSend: function (sq, params) {
		var self = this;
		$('[name$="_psq"]').val(sq);
		extend(params, Url.serializeForm(self.el.parents('form')[0]));
	},
	onRender: function (list, data, sq) {
		var self = this,
			pgn = $('.js-groups_pgn');
		
		pgn.empty(); list.empty();
		if (data.content) {
			var $node = $('<div>').html(data.content);
			$('.js-groups_remove_wrap').replaceWith($node.find('.js-groups_remove_wrap'));
			pgn.empty().append($node.find('.js-groups_pgn').children());
			list.empty().append($node.find('.js-usearch_list').children());
		}
	}
});


module.on("componentpage", function () {
	page_loader.push('shutdown', function () {
		last_search_result = null;
	});
	
	UniversalSearch.recheck();
	
	$('#main')
	// Выбор результатов виджета
	.on('click', '.js-groups_list .js-usearch_list > *', function (e) {
		if (!last_search_result)
			return;
		
		e.preventDefault();
		var el = $(this),
			index = el.index(),
			result = last_search_result && last_search_result.found[index];
		
		if (el.find('.error__item').length)
			return;
		
		if (last_search_result && result) {
			var parent = $(e.target).parents('.js-groups_list'),
				item_params = last_search_result.params[index],
				selected_list = parent.find('.js-groups_remove'),
				removable = last_search_result.removables[index];
			
			selected_list.show().append(removable);
			for (var i = 0; i < item_params.length; ++i) {
				var param = item_params[i];
				
				set_hidden(parent, param.name, param.value, true);
				
				mark_group_contact(parent, param.name, param.value, true);
			}
			parent.find('.js-search__input').focus().val('').trigger('input').blur();
		}
	})
	
	// Клик по чекбоксу
	.on('addremove', function (e, data) {
		e.preventDefault();
		var el = $(e.target),
			parent = el.parents('.js-groups_list');
		mark_group_contact(parent, el.data('hidden_name'), el.data('hidden_value'), data.state);
		toggle_removebles(parent);
		
		// Обновляем список
		tick(function () {
			let usearch = $('.js-usearch_parent').usearch();
			usearch && usearch.refreshSearch();
		});
	})
	
	// Удаление ремоваблы
	.on('click', '.js-removable_remove', function (e) {
		var el = $(this),
			removable = parseId(this.name),
			parent = el.parents('.js-groups_list');
		
		var hidden = find_hidden(parent, removable.type, removable.id),
			checkbox = find_checkbox(parent, removable.type, removable.id);
		
		if (checkbox.data("checked")) {
			e.preventDefault();
			checkbox.click();
		} else if (hidden.length) {
			e.preventDefault();
			hidden.remove();
			toggle_removebles(parent, el.parents('.s-property'), false);
		}
		
		// Обновляем список
		tick(function () {
			let usearch = $('.js-usearch_parent').usearch();
			usearch && usearch.refreshSearch();
		});
	});
	
	function toggle_removebles(parent, removable, state) {
		var wrap = parent.find('.js-groups_remove_wrap'),
			selected_list = wrap.find('.js-groups_remove'),
			removed_list = wrap.find('.js-groups_removed');
		
		if (removable) {
			// Добавляем ремоваблу в нужный список
			!state ? removed_list.append(removable[0]) : selected_list.append(removable[0]);
			for (var i = 1; i < removable.length; ++i)
				$(removable[i]).remove();
		}
		var cnt = selected_list.children().length,
			emails = 0;
		selected_list.children().each(function () {
			var el = $(this);
			if (el.text().indexOf('@') != -1)
				++emails;
		});
		
		$('.js-groups_show').each(function () {
			var el = $(this),
				min = el.data('min') || 1;
			el.toggleClass('hide', cnt < min && !(el.data('email') && emails > 0));
		});
		wrap.toggleClass('hide', !cnt);
		
		var data = parent.data(),
			selected_cnt = parent.find('.js-groups_remove .s-property').length,
			input = parent.find('.js-search__input[data-type="groups_list"]');
		
		if (data.max_cnt)
			input.toggleClass('hide', selected_cnt >= data.max_cnt);
	}
	
	function set_hidden(parent, name, value, checked) {
		var name_parsed = parseId(name),
			hidden = find_hidden(parent, name_parsed.type, value);
		if (hidden.length && !checked)
			hidden.remove();
		if (!hidden.length && checked) {
			parent.append(ce('input', {
				name: name,
				value: value,
				type: 'hidden'
			}));
		}
	}
	
	function mark_group_contact(parent, name, value, checked) {
		var params = parseId(name);
		if (params) {
			set_hidden(parent, name, value, checked);
			var removable = find_removable(parent, params.type, value);
			toggle_removebles(parent, removable, checked);
		}
	}
	
	function find_hidden(form, type, id) {
		return form.find('input[type="hidden"]').filter(function () {
			var hidden = parseId(this.name);
			return hidden && hidden.type == type && id == this.value;
		});
	}
	
	function find_removable(form, type, id) {
		return form.find('input[type="submit"]').filter(function () {
			var hidden = parseId(this.name);
			return hidden && hidden.type == type && id == hidden.id && hidden.place == 'removable';
		}).parents('.s-property');
	}
	
	function find_checkbox(form, type, id) {
		return form.find('input[type="submit"]').filter(function () {
			var hidden = parseId(this.name);
			return hidden && hidden.type == type && id == hidden.id && hidden.place == 'button';
		}).parents('.js-addremove');
	}
});

// FIXME: Чё за дичь?
function parseId(id) {
	var m;
	if ((m = id.match(/(\w)d_(\d+)$/))) { // removable id
		return {
			place: 'removable',
			id: m[2],
			type: m[1]
		};
	} else if ((m = id.match(/^gl(\w+)$/))) { // gl*
		return {
			place: 'checbox',
			prefix: m[1],
			type: m[1]
		};
	} else if ((m = id.match(/^GlS(.*?)_(\w)$/))) { // GlS
		return {
			place: 'checbox',
			prefix: m[1],
			type: m[2]
		};
	} else if ((m = id.match(/^Gl([SRA])(.*?)_(\w)(\d+)?$/))) { // Gl[RA]
		return {
			place: 'button',
			id: m[4],
			prefix: m[2],
			type: m[3]
		};
	}
	return null;
}

