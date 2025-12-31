import {ce} from './utils';
import {Events} from './events'
import {Spaces, parse_query, node_data} from './core';

update_links();

function update_links() {
	Events.glob('click', {
		'.js-action_link': filter_hide
	});
}

function filter_hide(e) {
	let el = this,
		data = node_data(el),
		params = parse_query(el.href);
	
	if (el.style.opacity == '0.4')
		return;
	
	el.style.opacity = '0.4';
	if (data.action == 'blogs_filter_hide' || data.action == 'blogs_filter_unhide') {
		params.CK = null;
		
		Spaces.api("blogs.hideChannel", params, function (res) {
			el.style.opacity = '1';
			if (res.code != 0) {
				Spaces.showError(res.$error);
			} else {
				let tmp = ce('div');
				tmp.innerHTML = res.new_link;
				el.parentNode.replaceChild(tmp.children[0], el);
			}
			update_links();
		}, {
			onError: function (err) {
				el.style.opacity = '1';
				Spaces.showError(err);
			}
		});
	}
	
	return false;
}


