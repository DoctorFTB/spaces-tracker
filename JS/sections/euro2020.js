import module from 'module';
import $ from '../jquery';

module.on("componentpage", function () {
	$('#main').on('click', '.js-score_show', function (e) {
		e.preventDefault();
		$('.js-score_spoiler').remove();
		$('.js-score').removeClass('hide');
	});
});
