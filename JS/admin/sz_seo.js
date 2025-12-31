import module from 'module';
import {Spaces, Url} from '../spacesLib';
import {L} from '../utils';

module.on('component', () => {
	$('#main').on('ajax-form-saved', '.js-sz_seo_form', function (e, {response}) {
		e.preventDefault();
		let parent = $(this).parents('.js-seo_moder_item');
		let tabs = $(this).parents('.js-legacy_tabs');
		let current_tab = tabs.find('.tab_active');
		current_tab.html($.trim(current_tab.html().replace(/\*/g, '')) + (response.id ? '*' : ''));
		
		let uniq_lt_el = parent.find('.list-link .js-sub_text');
		let current_tab_name = $.trim(current_tab.text().replace(/\*/g, ''));
		
		let uniq_lt = parent.data('uniqLt').filter((name) => {
			return name != current_tab_name || response.uniq;
		});
		
		if (response.uniq && $.inArray(current_tab_name, uniq_lt) < 0)
			uniq_lt.push(current_tab_name);
		
		uniq_lt_el.text(L('Уникальные: {0}', uniq_lt.join(', ') || '-'));
		
		parent.data('uniqLt', uniq_lt);
	});
});
