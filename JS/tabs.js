import $ from './jquery';
import Device from './device';

const TABS_MODES = {
	solid:	{
		selectedClass: 'switch__item_current',
		unselectedClass: 'hover-item'
	},
	tabs:	{
		selectedClass: 'clicked',
		unselectedClass: ''
	}
};

$('body').on('click', '.js-tab', function (e) {
	let el = $(this);
	let id = el.data('tabId');
	let parent = el.parents('.js-tabs_parent').first();
	let config = TABS_MODES[parent.data('mode') || 'solid'];
	
	if (el.hasClass(config.selectedClass))
		return;
	
	e.preventDefault();
	
	parent.find('.js-tab').each(function () {
		let tab = $(this);
		tab.toggleClass(config.selectedClass, tab.data('tabId') == id)
		config.unselectedClass && tab.toggleClass(config.unselectedClass, tab.data('tabId') != id);
	});
	parent.find('.js-tab_content').each(function () {
		let tab = $(this);
		tab.toggle(tab.data('tabId') == id);
	});
});
