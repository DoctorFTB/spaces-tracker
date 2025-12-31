import module from 'module';
import $ from './jquery';
import Device from './device';
import { Spaces } from './spacesLib';

var elements = {
	input: '.js-search__input',
	clear: '.js-search__btn_clear',
	submit: '.js-search__submit'
};

var SearchForm = {
	init: function () {
		var self = this;
		
		if (Device.android() && Device.android() < 2.3)
			return;
		
		$('#main').on('focus', elements.input, function(e) {
			var el = $(this);
			if (!el.data("noToggleSubmit"))
				self.changeButtons(el, true);
		}).on('blur change', elements.input, function(e) {
			var el = $(this);
			if (!el.data("noToggleSubmit")) {
				setTimeout(function() {
					if (!el.is(':focus'))
						self.changeButtons(el, false);
				}, 200);
			}
		}).on('click', elements.clear, function(e) {
			var el = $(this);
			
			if (el.data('clearUrl')) {
				Spaces.redirect(el.data('clearUrl'));
			} else if (!el.data("noToggleSubmit") && self.clear(el)) {
				e.preventDefault(); e.stopPropagation();
				el.trigger('clearSearchForm');
			}
		});
	},
	changeButtons: function (input, focus) {
		var self = this,
			parent = self.findParent(input),
			clear = parent.find(elements.clear),
			submit = parent.find(elements.submit);
		
		var state = !$.trim(input.val()).length || focus;
		clear.toggleClass('hide', state);
		submit.toggleClass('hide', !state);
	},
	clear: function (clear) {
		var self = this,
			input = self.findParent(clear).find(elements.input);
		
		if (!input.is(':focus')) {
			input.val('').trigger('input');
			self.changeButtons(input, false);
			return true;
		}
	},
	findParent: function (el) {
		while (el && el.length) {
			if (el.find(elements.input).length && el.find(elements.submit).length)
				return el;
			el = el.parent();
		}
	}
};

module.on("componentpage", function() {
	SearchForm.init();
});
