import module from 'module';
import $ from './jquery';
import Spaces from './spacesLib';

var tpl = {
	spinner: function () {
		return '<span class=""js-spinner><span class="ico ico_spinner"></span> </span>';
	}
};

module.on("componentpage", function () {
	$('#main').action('topic_expand', function (e) {
		e.preventDefault();
		
		var el = $(this),
			data = el.data(),
			subject = $('#subject_' + data.id),
			spinner = subject.find('.js-load_full_spinner');
		
		var fallback = function () {
			spinner.addClass('hide');
			Spaces.redirect(el.prop("href"));
		};
		
		spinner.removeClass('hide');
		Spaces.api("diary.getFullSubject", {Id: data.id, CK: null, Link_id: data.link_id, page: data.page, Visit: data.visit}, function (res) {
			if (res.code == 0) {
				subject.fastHtml(res.full_subject);
			} else {
				console.error(Spaces.apiError(res));
				fallback();
			}
		}, {
			onError: fallback
		});
	}).action('sections_get', function (e) {
		e.preventDefault();
		
		var el = $(this),
			data = el.data();
		
		if (data.busy)
			return;
		
		el.find('.js-spinner').remove();
		el.prepend(tpl.spinner());
		
		var fallback = function () {
			el.find('.js-spinner').remove();
			Spaces.redirect(el.prop("href"));
			data.busy = false;
		};
		
		data.busy = true;
		
		Spaces.api("anketa.getSections", {User: data.user_id, CK: null, Link_id: Spaces.params.link_id}, function (res) {
			data.busy = false;
			
			if (res.code == 0) {
				el.parents('.js-anketa_expand_wrap').remove();
				$('#anketa_extended').fastHtml(res.sections.join(""));
			} else {
				console.error(Spaces.apiError(res));
				fallback();
			}
		}, {
			onError: fallback
		});
	});
});

