import require from 'require';
import $ from '../jquery';
import Device from '../device';

if (Device.android_app) {
	$.extend(window.SpacesApp, {
		toggleSidebar: function (flag) {
			import('../widgets/swiper').then(sidebar => sidebar.toggle(flag));
		},
		on: function (event, func) {
			var self = this;
			self["on" + event.substr(0, 1).toUpperCase() + event.substr(1)] = func;
			return self;
		},
		loadPage: function (url) {
			let ret = false;
			require.loaded(import.meta.id('../ajaxify'), ({default: page_loader}) => {
				ret = page_loader.loadPage({url: url});
			});
			return ret;
		},
		exec: function (method, data) {
			return window.prompt(method, JSON.stringify(data || {}));
		}
	});
}

export default window.SpacesApp;
