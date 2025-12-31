import {tick, clearTick, domReady, executeScripts} from 'loader';

export const TRANSPARENT_PIXEL = 'data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==';

let window_ready_fired = false;
let window_ready_callbacks = [];

// Функция для отложенного запуска кода после полной загрузки страницы + 3 секунды
// Используется, чтобы не тормозить начальную загрузку страницы
export function windowReady(user_callback) {
	const ONLOAD_TIMEOUT = 3000;
	const DCL_TIMEOUT = 5000;
	
	if (window_ready_fired) {
		tick(user_callback);
	} else {
		window_ready_callbacks.push(user_callback);
		
		if (window_ready_callbacks.length == 1) {
			let callback = (timeout) => {
				window_ready_fired = true;
				for (let i = 0, l = window_ready_callbacks.length; i < l; i++)
					tick(window_ready_callbacks[i]);
				window_ready_callbacks = [];
			};
			
			// onload уже случился, поэтому запускаем таймер на SPACES_LOAD_START + ONLOAD_TIMEOUT
			if (document.readyState === "complete") {
				let delta = Date.now() - window.SPACES_LOAD_START;
				setTimeout(callback, Math.ceil(DCL_TIMEOUT - delta));
			}
			// Ждём onload
			else {
				if (document.addEventListener) {
					window.addEventListener('load', () => setTimeout(callback, ONLOAD_TIMEOUT), false);
				}
			}
		}
	}
}

export function debounce(callback, timeout) {
	let timer;
	return function () {
		let args = arguments;
		timer && clearTimeout(timer);
		timer = setTimeout(() => {
			callback.apply(this, args);
		}, timeout);
	};
}

export function throttle(callback, timeout) {
	let timer;
	let args;
	let self;
	return function (...currentArgs) {
		args = currentArgs;
		self = this;
		if (!timer) {
			timer = setTimeout(() => {
				timer = false;
				callback.apply(self, args);
			}, timeout);
		}
		return timer;
	};
}

export function throttleRaf(callback) {
	let scheduled = false;
	let lastArgs;

	return (...args) => {
		lastArgs = args;
		if (!scheduled) {
			scheduled = true;
			window.requestAnimationFrame(() => {
				scheduled = false;
				callback(...lastArgs);
			});
		}
	};
}

export function renderDelayed(id, html) {
	windowReady(() => {
		let el = document.getElementById(id);
		if (el) {
			el.innerHTML = html;
			executeScripts(el.getElementsByTagName('script'));
		}
	});
}

export function updateUrl(url) {
	return url.replace(/https?:\/\/([^#?\/]+)/ig, location.protocol + "//" + location.host);
}

export function updateUrlScheme(url) {
	return url.replace(/^(https|http):/i, location.protocol);
}

export function each(a, callback) {
	if (a) {
		if ('length' in a && (0 in a || !a.length)) {
			for (var i = 0, l = a.length; i < l; ++i)
				callback.call(a[i], a[i], i);
		} else {
			for (var k in a) {
				if (Object.prototype.hasOwnProperty.call(a, k))
					callback.call(a[k], a[k], k);
			}
		}
	}
}

export function base_domain(d) {
	d = d || location.host.toString();
	return d.match(/[a-zA-Z-_\d]+\.[a-zA-Z-_\d]+\.?$/)[0];
}

export function ce(tag, params, css, attrs) {
	var el = document.createElement(tag);
	var vars = [
		[params, el],
		[css, el.style],
		[attrs, 'setAttribute']
	];
	each(vars, function (v, k) {
		var vv = v[1];
		each(v[0], function (value, key) {
			if (value !== undefined) {
				typeof vv == 'string' ? el[vv](key, value) : (vv[key] = value);
			}
		});
	});
	return el;
}

export function ge(query, p) {
	var c = query.charAt(0);
	if (c == '#')
		return document.getElementById(query.substr(1));
	if (c == '.' || c == '`') {
		var parent = (p || document);
		if (parent.getElementsByClassName && c == '.') {
			return parent.getElementsByClassName(query.substr(1));
		} else {
			var elements = parent.getElementsByTagName("*"),
				out = [],
				class_name = query.substr(1),
				regexp = new RegExp('(^|\\s)' + class_name + '(\\s|$)');
			for (var i = 0; i < elements.length; ++i) {
				if (regexp.test(elements[i].className))
					out.push(elements[i]);
			}
			return out;
		}
	}
	return null;
}

export function numeral(num, titles) {
	var cases = [2, 0, 1, 1, 1, 2];
	return titles[(num % 100 > 4 && num % 100 < 20 ? 2 : cases[Math.min(num % 10, 5)])].replace(/\$n/g, num);
}

export function extend() {
	var target = arguments[0];
	for (var i = 1; i < arguments.length; ++i) {
		if (arguments[i]) {
			for (var k in arguments[i]) {
				if (Object.prototype.hasOwnProperty.call(arguments[i], k))
					target[k] = arguments[i][k];
			}
		}
	}
	return target;
}

export function addClass(o, c) {
	var re = new RegExp("(^|\\s)" + c + "(\\s|$)", "g")
	if (re.test(o.className)) return
	o.className = (o.className + " " + c).replace(/\s+/g, " ").replace(/(^ | $)/g, "")
}

export function removeClass(o, c) {
	var re = new RegExp("(^|\\s)" + c + "(\\s|$)", "g")
	o.className = o.className.replace(re, "$1").replace(/\s+/g, " ").replace(/(^ | $)/g, "")
}

export function hasClass(o, c) {
	return !!o.className.match(new RegExp('(\\s|^)' + c + '(\\s|$)'))
}

export function toggleClass(o, c, f) {
	if (typeof f != 'boolean')
		f = !hasClass(o, c);
	return (f ? addClass : removeClass)(o, c)
}

export function pad(val, n, str) {
	str = str || '0';
	
	var tmp = "";
	for (var i = 0; i < n - 1; ++i)
		tmp += str;
	return (tmp + val).slice(-n);
}

export function html_unwrap(str) {
	var map = {'quot': '"', 'lt': '<', 'gt': '>', 'nbsp': '\xA0', 'amp': '&', 'apos': '\''};
	return ((str || "") + "").replace(/&(#x[a-f\d]+|#\d+|[\w\d]+);/gim, function (m, s) {
		if (s.charAt(0) == "#") {
			var val;
			if (s.charAt(1) == "x")
				val = parseInt(s.substr(2), 16);
			else
				val = parseInt(s.substr(1));
			return String.fromCharCode(val);
		} else
			return map[s] || m;
	});
}

export function html_wrap(str) {
	var map = {"<": "lt", ">": "gt", "\"": "quot", "&": "amp", "'": "apos"};
	return ((str || "") + "").replace(/["'<>&]/gim, function (m) {
		return '&' + (map[m] || ('#' + m.charCodeAt(0))) + ';';
	});
}

export function set_caret_pos(e, start, end) {
	if (e.setSelectionRange) {
		e.focus();
		e.setSelectionRange(start, end);
	} else if (e.createTextRange) {
		var range = e.createTextRange();
		range.collapse(true);
		range.moveStart('character', start);
		range.moveEnd('character', end - start);
		range.select();
	}
}

export function get_caret_pos(e) {
	var pos = 0;
	if (document.selection) {
		e.focus();
		var s = document.selection.createRange();
		s.moveStart('character', -e.value.length);
		pos = s.text.length;
		s.moveStart('character', pos);
	} else if (e.selectionStart) {
		pos = e.selectionStart;
	}
	return pos;
}

export function L(text, strings) {
	if ((typeof strings == "object")) {
		return text.replace(/\{([\w\d-_]+)\}/gim, function (m, s) {
			return strings[s] !== undefined ? strings[s] : m;
		});
	} else if (arguments.length > 1) {
		var str = arguments;
		return text.replace(/\{(\d+)\}/gim, function (m, s) {
			return s < str.length - 1 ? str[+s + 1] : m;
		});
	}
	return text;
}

export function find_var(v, path) {
	var parts = path.split("."),
		ref = v;
	if (ref) {
		for (var i = 0; i < parts.length; ++i) {
			ref = ref[parts[i]];
			if (!ref)
				return null;
		}
	}
	return ref;
};

export function interpolateArray(data, newSize) {
	let oldSize = data.length;
	let newData = new Array(newSize);

	for (let i = 0; i < newSize; i++) {
		let j = (i * (oldSize - 1)) / (newSize - 1);
		let j0 = Math.floor(j);
		let j1 = Math.ceil(j);

		if (j0 === j1) {
			newData[i] = data[j0];
		} else {
			let value0 = data[j0];
			let value1 = data[j1];
			newData[i] = value0 + (value1 - value0) * (j - j0);
		}
	}

	return newData;
}

export function compareVersions(a, b) {
	let partsA = (a || "0").split('.');
	let partsB = (b || "0").split('.');
	let cnt = Math.max(partsA.length, partsB.length);

	for (let i = 0; i < cnt; i++) {
		let valueA = i < partsA.length ? partsA[i] : '0';
		let valueB = i < partsB.length ? partsB[i] : '0';

		if (valueA > valueB)
			return 1;
		if (valueB > valueA)
			return -1;
	}

	return 0;
}

export function formatDuration(time) {
	let hours = Math.floor(time / 3600);
	let minutes = Math.floor((time - hours * 3600) / 60);
	let seconds = Math.floor(time - (hours * 3600) - (minutes * 60));

	let values = [];
	if (hours > 0)
		values.push(hours.toString());
	values.push(hours > 0 ? minutes.toString().padStart(2, '0') : minutes.toString());
	values.push(seconds.toString().padStart(2, '0'));

	return values.join(':');
}

export {tick, clearTick, domReady} from 'loader';
