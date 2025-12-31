import module from 'module';
import {Events} from '../events';
import {L, find_parents, ge, addClass, removeClass} from '../utils';

Events.bulk(ge('.js-legacy_tab'), {
	click: function (e) {
		let wrap = find_parents(this, '.js-legacy_tabs', true);
		let tab_id = this.getAttribute('data-tab-id');
		let mode = this.getAttribute('data-mode') || '';
		
		let tab_links = wrap.getElementsByClassName('js-legacy_tab');
		for (let i = 0, l = tab_links.length; i < l; i++) {
			if (tab_links[i].getAttribute('data-tab-id') == tab_id) {
				if (mode == 'ssi') {
					addClass(tab_links[i], 'b');
				} else {
					addClass(tab_links[i], 'tab_active');
				}
				addClass(tab_links[i], 'black');
			} else {
				if (mode == 'ssi') {
					removeClass(tab_links[i], 'b');
				} else {
					removeClass(tab_links[i], 'tab_active');
				}
				removeClass(tab_links[i], 'black');
			}
		}
		
		let tab_contents = wrap.getElementsByClassName('js-legacy_tab_content');
		for (let i = 0, l = tab_contents.length; i < l; i++) {
			if (tab_contents[i].getAttribute('data-tab-id') == tab_id) {
				removeClass(tab_contents[i], 'hide');
			} else {
				addClass(tab_contents[i], 'hide');
			}
		}
		
		return false;
	}
}, true);
