import module from 'module';
import $ from './jquery';
import {Spaces, Url} from './spacesLib';

module.on("componentpage", function () {
	$('#main').action('blogs_filter_hide blogs_filter_unhide', function (e) {
		e.preventDefault();
		
		var el = $(this),
			hide = e.linkAction == 'blogs_filter_hide',
			params = new Url(el.prop("href")).query;
		
		if (el.hasClass('disabled'))
			return;
		el.addClass('disabled');
		
		var on_done = function () {
			el.removeClass('disabled');
		};
		
		Spaces.api("blogs.hideChannel", params, function (res) {
			on_done();
			if (res.code != 0) {
				Spaces.showApiError(res);
			} else {
				el.replaceWith(res.new_link);
			}
		}, {
			onError: function (err) {
				Spaces.showError(err);
				on_done();
			}
		});
	});
});
