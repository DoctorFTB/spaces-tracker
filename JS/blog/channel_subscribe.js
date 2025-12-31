import module from 'module';
import Spaces from '../spacesLib';
import $ from '../jquery';
import {L} from '../utils';

let timeout_id;

module.on("componentpage", function () {
	var form = $('#channel_subscribe_form');
	form.on('submit', function (e) {
		if (form.data('submitted'))
			return;
		
		form.data('submitted', true);
		
		var channels = [];
		$('input[type="checkbox"]').each(function () {
			if (this.checked && this.name.match(/^Ch\d+$/))
				channels.push(this.value);
		});
		
		if (!channels.length)
			return;
		
		e.preventDefault();
		
		var subscription_done = false;
		
		var online = +form.find('input[name="Online"]').val();
		if (online) {
			// Выводим прогресс подписки
			var progress_widget = $('#channel_subscr_progress');
			progress_widget.removeClass('hide');
			$('#channel_subscr_btn').addClass('hide');
			
			// Раз в 0.5 увеличиваем прогрессбар на 1 единицу
			var progress_line = progress_widget.find('.js-progress_line'),
				progress_text = progress_widget.find('.js-progress_text');
			
			var counter = 0;
			var progress_update = function () {
				if (subscription_done)
					return;
				
				progress_text.text(L('{0} из {1}', counter, channels.length));
				progress_line.css("width", (counter / channels.length * 100) + "%");
				counter++;
				
				timeout_id = false;
				if (counter < channels.length)
					timeout_id = setTimeout(progress_update, 500);
			};
			progress_update();
		} else {
			var btn = form.find('button[name="cfms"]');
			btn.attr("disabled", "disabled").addClass('disabled');
			btn.find('.js-ico').addClass('ico_spinner');
		}
		
		Spaces.api("blogs.questComplete", {CK: null, ChIds: channels, Online: online}, function (res) {
			if (res.code != 0)
				console.error("[channel_subscribe] " + Spaces.apiError(res));
			subscription_done = true;
			form.submit();
		}, {
			onError: function (err) {
				console.error("[channel_subscribe] " + err);
				subscription_done = true;
				form.submit();
			}
		});
	});
});
