import module from 'module';
import $ from './jquery';
import './form_controls';

module.on("componentpage", function () {
	var $body = $('#main');
	
	$body.on('click', '#js-c-letter__btn', function (e) {
		e.preventDefault();
		e.stopPropagation();
		
		var el = $(this),
			chb = $('#js-c-letter__custom'),
			radioName = chb.attr('name');
		
		chb.val($('#js-c-letter__input').val());
		chb.get(0).checked = true;
		
		$('.js-horiz_mode-'+radioName).removeClass('clicked');
		$('#select_letter_btn').addClass('c-letter__more-btn');
		$body.trigger('click');
	});
	
	$body.on('click', '.js-c-letter__none', function (e) {
		$body.trigger('click');
		$('#select_letter_btn').addClass('c-letter__more-btn');
	});
	
	$body.on('click', '.js-c-letter__visible', function (e) {
		$('#select_letter_btn').removeClass('c-letter__more-btn clicked');
		$body.trigger('click');
	});
	
	$body.on('keydown', '#js-c-letter__input', function (e) {
		var key = e.keyCode;
	    if (key == 13) {
			e.preventDefault();
			e.stopPropagation();
			$('#js-c-letter__btn').trigger('click');
		}
	});
});
