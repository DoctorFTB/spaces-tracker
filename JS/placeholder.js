import module from 'module';
import $ from './jquery';

function fixPlaceholders() {
	$('.js-fake_placeholder').each(function () {
		var el = $(this),
			input = el.parent().find('input');
		
		var toggle_fake = function () {
			el.toggleClass('hide', input.val().length > 0);
		};
		
		input.removeAttr('placeholder');
		toggle_fake();
		
		el.on('click', function () {
			input.focus();
		});
		
		input.on('focus', function () {
			el.addClass('hide');
		}).on('blur', toggle_fake);
	}).removeClass('js-fake_placeholder');
}

module.on("component", fixPlaceholders);
