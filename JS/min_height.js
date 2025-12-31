import module from 'module';
import $ from './jquery';
import './spacesLib';

var has_min_height;

export function fixPageHeight(el) {
	if (el)
		el.addClass('js-fix_height');
	
	var main_content = $('#main_content'),
		main_content_top = main_content.offset().top,
		need_height = 0;
	
	has_min_height = 0;
	$('.js-fix_height').each(function () {
		var el = $(this);
		if (el.isVisible()) {
			if (el.css("position") == 'fixed') {
				need_height = Math.max(need_height, el.outerHeight(true));
			} else {
				need_height = Math.max(need_height, el.outerHeight(true) + (el.offset().top - main_content_top) + (el.data('ypad') || 0));
			}
			++has_min_height;
		}
	});
	main_content.css('min-height', need_height + 15);
};

module.on("componentpage", function () {
	fixPageHeight();
});

export default fixPageHeight;
