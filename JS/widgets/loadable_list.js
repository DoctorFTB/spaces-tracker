import module from 'module';
import $ from '../jquery';
import {Spaces} from '../spacesLib';

const tpl = {
	tilesCap:	() => {
		return `
			<div class="tiled_cap"></div>
			<div class="tiled_cap"></div>
			<div class="tiled_cap"></div>
			<div class="tiled_cap"></div>
		`;
	}
};

module.on("component", () => {
	$('#main').action('load_items', function (e) {
		e.preventDefault();
		
		let el = $(this);
		
		if (el.data('busy'))
			return;
		
		let data = el.data();
		let parent = el.parents('.js-loadable_list');
		let content = parent.find('.js-loadable_list_content');
		
		let toggle_loading = (flag) => {
			el.data('busy', flag);
			el.find('.js-ico').toggleClass('ico_spinner', flag);
		};
		
		toggle_loading(true);
		
		Spaces.api(data.method, data.params, function (res) {
			toggle_loading(false);
			
			if (res.code != 0) {
				Spaces.showApiError(res);
				return;
			}
			
			let result = res[data.result || 'items'];
			if (data.replace) {
				content.html(result);
			} else {
				// Удаляем кнопку для подгрузки новых тайлов
				if (!res.hasMore)
					el.remove();
				
				let container = content.find('.tiles_wrapper');
				if (container.length) {
					container.append(result.join(''));
					container.find('.tiled_cap').remove();
					container.append(tpl.tilesCap());
				} else {
					container = content.find('.list');
					container.append(result.join(''));
				}
				
				data.params.O += result.length;
			}
		}, {
			onError: function (err) {
				toggle_loading(false);
				Spaces.showError(err);
			}
		});
	});
});
