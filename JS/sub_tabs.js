import module from 'module';
import $ from './jquery';

module.on("componentpage", function () {
	var handler = function (e) {
		e.preventDefault();
		$(this).toggleClass('js-clicked').parents('.js-sub_tabs').toggleClass('sub-tabs_open');
	};
	
	$('#main').on('click', '.js-sub_tabs_toggle', handler);
});
