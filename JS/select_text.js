import module from 'module';
import $ from './jquery';

module.on('componentpage', function () {
	$('#main').on('focus', '.js-copy-input', function (e) {
		$(this).select();
	});
});
