import {extend, base_domain} from './utils';

var cookie = {
	get: function (key, def) {
		var cookies = cookie.all(), v = cookies[key];
		return v === undefined ? def : v;
	},
	set: function (key, value, opts) {
		opts = extend({
			path:		'/',
			expires:	5 * 365 * 24 * 3600,
			secure:		false,
			domain:		SPACES_PARAMS.cookies_domain,
			samesite:	'Lax'
		}, opts);
		
		var query = encodeURIComponent(key) + "=" + encodeURIComponent(value);
		if (opts.expires) {
			let expires = new Date(opts.expires < 0 ? new Date(0) : Date.now() + opts.expires * 1000);
			query += "; expires=" + expires.toUTCString();
		}
		if (opts.domain)
			query += "; domain=" + opts.domain;
		if (opts.path)
			query += "; path=" + opts.path;
		if (opts.secure)
			query += "; secure";
		if (opts.samesite)
			query += "; SameSite=" + opts.samesite;
		
		if (opts.expires > 0)
			cookie.removeBadCookies(key);
		
		document.cookie = query;
		
		return this;
	},
	all: function () {
		if (document.cookie == '')
			return {};
		var cookies = document.cookie.split(';'),
			result = {};
		for (var i = 0; i < cookies.length; ++i) {
			var item = cookies[i].split('=');
			if (item[0].charAt(0) == ' ')
				item[0] = item[0].substr(1);
			result[decodeURIComponent(item[0])] = item[1] !== undefined ? decodeURIComponent(item[1]) : '';
		}
		return result;
	},
	remove: function (key) {
		cookie.set(key, '', {expires: -1});
		cookie.removeBadCookies(key);
		return this;
	},
	removeBadCookies(key) {
		let bad_cookie_domains = cookie.getBadDomains();
		for (let i = 0; i < bad_cookie_domains.length; i++) {
			cookie.set(key, '', {expires: -1, domain: bad_cookie_domains[i]});
			cookie.set(key, '', {expires: -1, path: false, domain: bad_cookie_domains[i]});
		}
	},
	toggle: function (key, value, opts) {
		if (cookie.get(key)) {
			return cookie.remove(key);
		} else {
			return cookie.set(key, value, opts);
		}
	},
	enabled: function () {
		var test = 'ololo_' + Date.now();
		if (!cookie.set(test, 1).get(test))
			return false;
		cookie.remove(test);
		return true;
	},
	getBadDomains() {
		let bad_cookie_domains = [];
		let parts = location.host.split('.');
		while (parts.length >= 2) {
			let cookie_domain = parts.join('.');
			bad_cookie_domains.push(cookie_domain)
			if (("." + cookie_domain) != SPACES_PARAMS.cookies_domain)
				bad_cookie_domains.push("." + cookie_domain);
			parts.shift();
		}
		return bad_cookie_domains;
	}
};

export default cookie;
