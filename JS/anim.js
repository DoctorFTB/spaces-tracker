import $ from './jquery';
import Device from './device';

var can_transition = Device.can('transition'),
	can_transform = Device.can('transform'),
	can_css_3d = Device.can('transform3d'),
	support_animations = can_transition && can_transform,
	PROPS_RE = /\s*,\s*/;

$.support.nativeAnim = support_animations;
$.support.nativeAnim3d = support_animations && can_css_3d;

$.fn.move = function (x, y) {
	var self = this;
	if (can_transform) {
		self[0].style[can_transform] = can_css_3d ?
			'translate3d(' + Math.round(x) + 'px, ' + Math.round(y) + 'px, 0px)' :
			'translate(' + Math.round(x) + 'px, ' + Math.round(y) + 'px)';
	} else {
		self[0].style.left = x + "px";
		self[0].style.top = y + "px";
	}
	return self;
};

$.fn.transition = function (prop, func, time) {
	var i = 0, el;
	if (can_transition) {
		time = time || 100;
		func = func || 'linear';
		while ((el = this[i++]) && el.style) {
			var val = "";
			if (prop) {
				var parts = prop.split(PROPS_RE);
				for (var j = 0; j < parts.length; ++j)
					val += (!j ? '' : ', ') + Device.css(parts[j], true)  + ' ' + time + 'ms ' + func;
			} else {
				val = "none";
			}
			if (val != "none" || (el.style[can_transition] != "" && el.style[can_transition] != "none"))
				el.style[can_transition] = val;
		}
	}
	return this;
};

$.fn.transform = function (opts) {
	if (can_transform) {
		var i = 0, transforms = create_transform(opts), el;
		while ((el = this[i++]) && el.style) {
			if (transforms != "none" || (el.style[can_transform] != "" && el.style[can_transform] != "none"))
				el.style[can_transform] = transforms;
		}
	}
	return this;
};

$.fn.hasAnim = function () {
	return this.length && !!$.data(this[0], 'spAnimEnd');
};
$.fn.cssAnim = function (prop, func, time, callback) {
	var i = 0, el,
		events = "transitionend webkitTransitionEnd oTransitionEnd otransitionend msTransitionEnd".split(" ");
	
	func = func || 'linear';
	time = time || 100;
	
	if (can_transition) {
		while ((el = this[i++])) {
			el = $(el);
			
			// Удаляем старую
			var on_animation_end = $.data(el[0], 'spAnimEnd');
			if (on_animation_end) {
				on_animation_end.apply(el[0], []);
			} else {
				el.transition();
			}
			if (!prop)
				continue;
			
			var triggered = false;
			var on_animation_end = function (e) {
				
				var old_ev_callback = $.data(this, 'spAnimEnd');
				$(this).transition();
				if (old_ev_callback) {
					for (var i = 0; i < events.length; ++i)
						this.removeEventListener(events[i], old_ev_callback);
					$.removeData(this, 'spAnimEnd');
					callback && callback();
				}
			};
			
			for (var i = 0; i < events.length; ++i)
				el[0].addEventListener(events[i], on_animation_end, false);
			
			el.transition(prop, func, time);
			$.data(el[0], 'spAnimEnd', on_animation_end); // Что бы удалить при вызове cssAnim
		}
	}
	return this;
}

function create_transform(opts) {
	var values = "";
	if (opts) {
		if (opts.translate) {
			var x = opts.translate[0] + "", y = opts.translate[1] + "";
			if (x.indexOf('%') < 0)
				x += "px";
			if (y.indexOf('%') < 0)
				y += "px";
			values += (can_css_3d ? 'translate3d(' + x + ', ' + y + ', 0px) ' : 
				'translate(' + x + ', ' + y + ') ');
		}
		if (check_val(opts.scale))
			values += (can_css_3d ? 'scale3d(' + opts.scale + ', ' + opts.scale + ', 1) ' : 'scale(' + opts.scale + ') ');
		if (check_val(opts.rotate))
			values += ('rotate(' + opts.rotate + ') ');
	}
	return values.length ? values : "none";
}

function check_val(val) {
	return val !== undefined && val !== null;
}
