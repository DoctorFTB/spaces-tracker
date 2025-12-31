import module from "module";
import $ from './jquery';
import Device from './device';
import * as sidebar from './widgets/swiper';

var can_css_tab_size = !!Device.css('tabSize');

var CodeHighlight = {
	init: function () {
		var self = this;
		$('.code_tag.code_tag-new').each(function () {
			self.makeCode($(this));
		});
	}, 
	makeCode: function (el) {
		var self = this;
		try {
			var lang = el.data('lang').replace(/\s+/gim, '').toLowerCase();
			
			if (!lang.length)
				lang = "text";
			if (lang == '*')
				lang = "";
			
			var opts = {useBR: true};
			if (!can_css_tab_size) {
				var fm = el.fontMetrics();
				opts.tabReplace = '<span style="display: inline-block; width: ' + fm.w * 4 + 'px">\t</span>';
			}
			// hljs.configure(opts);
			
			if (!el.data('chtl')) {
				el.on('touchstart', function (e) {
					sidebar.lock(true);
					el.one('touchcancel touchend', function () {
						sidebar.lock(false);
					});
				});
				el.data('chtl', true);
			}
			
			el.removeClass('code_tag-new').addClass('lang-' + lang);
			// hljs.highlightBlock(el[0]);
		} catch (e) { }
	}, 
	concatCode: function (first_part, second_part) {
		var self = this;
		self.clearBr($([first_part[0], second_part[0]]));
		first_part.text(first_part.text() + second_part.text());
		second_part.remove();
		self.makeCode(first_part);
	}, 
	clearBr: function (el) {
		el.find('br').each(function () {
			this.parentNode.replaceChild(document.createTextNode('\r\n'), this);
		});
	}
};

module.on("component", () => CodeHighlight.init());

export default CodeHighlight;
