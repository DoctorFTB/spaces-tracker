(function (window) {
	/*
	 * Console
	 * */
	var n = function () {},
		m = [
			"assert", "clear", "count", "debug", "dir", "dirxml", "error", "group", "groupEnd", 
			"info", "log", "markTimeline", "profile", "profileEnd", "table", "time", "timeEnd", 
			"timeStamp", "timeline", "timelineEnd", "trace", "warn"
		],
		c = (window.console = window.console || {});
	for (var k in m)
		c[m[k]] = c[m[k]] || n;
	
	/*
	 * Array.prototype.forEach (IE8)
	 * */
	if (!Array.prototype.forEach) {
		Array.prototype.forEach = function (action, that) {
			for (var  i = 0, n = this.length; i < n; ++i)
				action.call(that, this[i], i, this);
		};
	}
	
	/*
	 * Date.now (IE8)
	 * */
	if (!Date.now) {
		Date.now = function () {
			return (new Date()).getTime();
		};
	}
	
	/*
	 * Function.prototype.bind (IE8)
	 * */
	if (!Function.prototype.bind) {
		Function.prototype.bind = function (context /* ...args */) {
			var fn = this;
			var args = Array.prototype.slice.call(arguments, 1);
			
			return function () {
				return fn.apply(context, args.concat(Array.prototype.slice.call(arguments)));
			};
		}
	}
	
	/*
	 * Object.assign polyfill
	 * */
	if (!Object.assign) {
		Object.assign = function (target, varArgs) { // .length of function is 2
			if (target == null) // TypeError if undefined or null
				throw new TypeError('Cannot convert undefined or null to object');
			
			var to = Object(target);
			
			for (var index = 1; index < arguments.length; index++) {
				var nextSource = arguments[index];
				
				if (nextSource != null) { // Skip over if undefined or null
					for (var nextKey in nextSource) {
						// Avoid bugs when hasOwnProperty is shadowed
						if (Object.prototype.hasOwnProperty.call(nextSource, nextKey)) {
							to[nextKey] = nextSource[nextKey];
						}
					}
				}
			}
			return to;
		};
	}
})(window);

/*
 * requestAnimationFrame
 * */
(function() {
	let vendors = ['ms', 'moz', 'webkit', 'o'];
	for (let x = 0; x < vendors.length && !window.requestAnimationFrame; x++) {
		window.requestAnimationFrame = window[vendors[x] + 'RequestAnimationFrame'];
		window.cancelAnimationFrame = window[vendors[x] + 'CancelAnimationFrame'] || window[vendors[x] + 'CancelRequestAnimationFrame'];
	}
}());
