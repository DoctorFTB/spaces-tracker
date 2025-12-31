import module from 'module';
import $ from './jquery';

var ACL_MODES = {
	BY_PASSWORD: 4,
	BY_ACCESS_LIST: 5
};

module.on("componentpage", function () {
	$('#main').on('change', '.js-acl_dropdown .js-radio input', function (e) {
		var el = $(this),
			wrap = el.parents('.js-acl_dropdown');
		
		var id = wrap.data('name') + wrap.data('postfix');
		$('#passwd_' + id).toggleClass('hide', el.val() != ACL_MODES.BY_PASSWORD);
		$('#acclist_' + id).toggleClass('hide', el.val() != ACL_MODES.BY_ACCESS_LIST);
	});
});
