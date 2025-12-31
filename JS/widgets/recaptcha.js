import module from 'module';
import {loadScript} from 'loader'
import $ from '../jquery';

var to_reset = [];

module.on("component", function () {
	$('.js-recaptcha').each(function () {
		var el = this,
			type = el.getAttribute('data-type');
		loadRecaptcha(type, function (api) {
			api.ready(function () {
				el.innerHTML = '';
				api.render(el);
				el.className = el.className.replace(/js-recaptcha/g, '');
			});
		});
	});
});

function loadRecaptcha(type, callback) {
	if (!window[type]) {
		var urls = {
			grecaptcha:		'https://www.google.com/recaptcha/api.js',
			hcaptcha:		'https://hcaptcha.com/1/api.js?render=explicit'
		};
		loadScript(urls[type], function () {
			callback(window[type]);
		});
	} else {
		callback(window[type]);
	}
}
