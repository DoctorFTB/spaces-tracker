import module from 'module';
import page_loader from '../ajaxify';
import {tick} from '../utils';
import $ from '../jquery';

init();

function init() {
	recheckLoadables();
	
	page_loader.on('pageloaded', 'loadable_item', () => {
		tick(() => recheckLoadables());
	}, true);
}

function recheckLoadables() {
	let widgets = document.getElementsByClassName('js-loadable_item');
	
	let to_load = {};
	while (widgets.length) {
		let widget = widgets[0];
		
		let id = widget.getAttribute('data-id');
		let key = widget.getAttribute('data-key');
		let method = widget.getAttribute('data-method');
		let params = widget.getAttribute('data-params');
		let result = widget.getAttribute('data-result');
		
		let uniq_id = key + ':' + result + ':' + method + ':' + params;
		if (!to_load[uniq_id]) {
			to_load[uniq_id] = {
				elements: {},
				params:	$.parseJSON(params),
				method,
				result
			};
		}
		to_load[uniq_id].params[key] = to_load[uniq_id].params[key] || [];
		to_load[uniq_id].params[key].push(id);
		to_load[uniq_id].elements[id] = widget;
		
		widget.className = widget.className.replace('js-loadable_item', '');
	}
	
	for (let uniq_id in to_load)
		loadWidgets(to_load[uniq_id]);
}

function loadWidgets(data) {
	Spaces.api(data.method, data.params, (res) => {
		if (res.code == 0) {
			let widgets = res[data.result];
			for (let id in widgets)
				$(data.elements[id]).replaceWith(widgets[id]);
		} else {
			console.error('[loadable]', Spaces.apiError(res));
		}
	}, {
		retries: 3,
		onError(error) {
			console.error('[loadable]', error);
		}
	});
}
