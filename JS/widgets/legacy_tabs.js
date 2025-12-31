import module from 'module';
import {Spaces, Url} from '../spacesLib';
import {L} from '../utils';

module.on('component', () => {
	$('#main').on('click', '.js-legacy_tab', function (e) {
		e.preventDefault();
		
		let el = $(this);
		let wrap = el.parents('.js-legacy_tabs');
		let tab_id = el.data('tabId');
		let mode = el.data('mode');
		let class_name = (mode == 'ssi' ? 'sub-tabs__item-selected' : 'tab_active black');
		
		wrap.find('.js-legacy_tab').removeClass(class_name);
		wrap.find('.js-legacy_tab_content').addClass('hide');
		
		el.addClass(class_name);
		wrap.find(`.js-legacy_tab_content[data-tab-id="${tab_id}"]`).removeClass('hide');
	});
});
