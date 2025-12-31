import module from 'module';
import {Spaces, Url} from '../spacesLib';
import {L} from '../utils';

module.on('component', () => {
	$('#main').on('submit', '.js-ajax_form', function (e) {
		e.preventDefault();
		
		let el = $(this);
		let btn = $(this.submit_btn);
		
		let event = $.Event("ajax-form-validate");
		el.trigger(event);
		if (event.isDefaultPrevented())
			return false;
		
		if (btn.attr('disabled'))
			return;
		
		let data = Url.serializeForm(el);
		data.CK = null;
		
		let toggle_loading = (flag) => {
			if (flag) {
				btn.attr('disabled', 'disabled');
			} else {
				btn.removeAttr('disabled');
			}
			btn.find('.js-ico').toggleClass('ico_spinner', flag);
		};
		
		toggle_loading(true);
		
		Spaces.api(el.data('apiMethod'), data, (res) => {
			toggle_loading(false);
			
			if (res.code != 0) {
				el.trigger('ajax-form-error', {
					formData: data,
					error: Spaces.apiError(res)
				});
				Spaces.showApiError(res);
				return;
			}
			
			el.trigger('ajax-form-saved', {
				formData: data,
				response: res
			});
			
			animateSaveButton(btn);
		}, {
			onError(err) {
				toggle_loading(false);
				Spaces.showError(err);
				
				el.trigger('ajax-form-error', {
					formData: data,
					error: err
				});
			}
		});
	});
	
	function animateSaveButton(btn) {
		if (btn.hasClass('list-link-blue')) {
			btn.removeClass('list-link-blue').addClass('list-link-green');
			
			let orig_text = btn.find('.js-btn_val').html();
			btn.find('.js-ico').removeClass('ico_ok').addClass('ico_ok_green');
			btn.find('.js-btn_val').html(L('Сохранено!'));
			
			setTimeout(() => {
				btn.addClass('list-link-blue').removeClass('list-link-green');
				btn.find('.js-ico').removeClass('ico_ok_green').addClass('ico_ok');
				btn.find('.js-btn_val').html(orig_text);
			}, 3000);
		} else if (btn.hasClass('btn')) {
			let orig_text = btn.find('.js-btn_val').html();
			btn.find('.js-btn_val').html(L('Сохранено!'));
			
			setTimeout(() => {
				btn.find('.js-btn_val').html(orig_text);
			}, 3000);
		}
	}
});
