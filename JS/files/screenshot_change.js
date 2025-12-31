import module from 'module';
import {Spaces, Codes} from '../spacesLib';
import $ from '../jquery';

module.on('componentpage', () => {
	$('#main').action('screenshot_add', function (e) {
		e.preventDefault();
		
		let el = $(this);
		let wrap = el.parents('.tiles_wrapper');
		let api_data = el.data('params');
		
		let markLoading = (flag) => {
			el.toggleClass('fd-checkbox-active', flag);
			el.find('.js-ico').toggleClass('ico_spinner_white', flag);
		};
		
		let markSelected = () => {
			wrap.find('.js-screenshot_checkbox').removeClass('fd-checkbox-active');
			el.addClass('fd-checkbox-active');
			el.find('.js-ico').removeClass('ico_spinner_white');
		};
		
		if (!api_data) {
			markSelected();
			return;
		}
		
		api_data.CK = null;
		
		markLoading(true);
		
		Spaces.api("files.screenshot.add", api_data, (res) => {
			markLoading(false);
			if (res.code != 0) {
				Spaces.showApiError(res);
			} else {
				markSelected();
				
				// Перезагружем первый тайл
				let first_thumb = wrap.find('.tiled-preview .preview').first();
				for (let prop_name of ['src', 'srcset']) {
					let val = first_thumb.prop(prop_name);
					val && first_thumb.prop(prop_name, val.replace(/\?(\d+)/g, '?' + Date.now()));
				}
			}
		}, {
			onError(err) {
				markLoading(false);
				Spaces.showError(err);
			}
		})
	});
});
