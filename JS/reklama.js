import module from 'module';
import $ from './jquery';
import Device from './device';

module.on("componentpage", function () {
	var delayed;
	$('#main').on('input blur change', '.js-ad_header_input, .js-ad_description_input', function (e) {
		if (!delayed) {
			delayed = setTimeout(function () {
				delayed = false;
				
				var header = $('.js-ad_header_input input'),
					description = $('.js-ad_description_input textarea');
				
				$('#main .js-ad_header').text(header.val() || header.attr("placeholder"));
				$('#main .js-ad_description').text(description.val() || description.attr("placeholder"));
			}, Device.type == 'desktop' ? 150 : 300);
		}
	});
});
