import module from 'module';
import $ from '../jquery';
import Spaces from '../spacesLib';

module.on("componentpage", function () {
	$('#rate_explain_btn').click(function (e) {
		e.preventDefault();
		
		var el = $(this);
		
		if (el.attr("disabled"))
			return;
		
		el.attr("disabled", "disabled").css("opacity", "0.5");
		
		Spaces.api("rate.getExplainWidget", {Oid: el.data('objectId'), Ot: el.data('objectType')}, function (res) {
			el.removeAttr("disabled").css("opacity", "1");
			
			if (res.code != 0) {
				Spaces.showApiError(res);
			} else {
				$('#rate_explain_widget').replaceWith(res.widget);
				$('#rate_explain_btn').click();
			}
		}, {
			onError: function (err) {
				el.removeAttr("disabled").css("opacity", "1");
				Spaces.showError(err);
			}
		})
	});
});
