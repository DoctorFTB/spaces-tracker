import $ from './jquery';
import {each} from './utils';
import {addClass, removeClass, hasClass, toggleClass, ge, L} from './utils';

var Spoilers = {
	/*
		Универсальный спойлер для лайт и wap
		Пример юзания:
			onclick="return Spoilers.click(this)" data-show="about_spaces-link" data-hide="about_spaces"
	*/
	click: function (link) {
		var hide = get_elements(link.getAttribute('data-hide')),
			show = get_elements(link.getAttribute('data-show')),
			toggle = get_elements(link.getAttribute('data-toggle')),
			clazz = link.getAttribute('data-class');
		
		for (var i = 0; i < hide.length; ++i)
			addClass(hide[i], 'hide');
		for (var i = 0; i < show.length; ++i)
			removeClass(show[i], 'hide');
		
		let $link = $(this);
		
		if (toggle.length > 0) {
			var state = !hasClass(toggle[0], 'hide');
			if (clazz)
				toggleClass(link, clazz, !state);
			
			let show_title = $link.data('showTitle');
			let hide_title = $link.data('hideTitle');
			if (show_title && hide_title)
				$link.find('.t').text(state ? show_title : hide_title);
			
			for (var i = 0; i < toggle.length; ++i) {
				var el = toggle[i],
					icon = ge('#' + el.id + '-icon');
				if (icon)
					icon.src = ICONS_BASEURL + icon.getAttribute(state ? 'data-show' : 'data-hide');
				toggleClass(el, 'hide', state);
			}
			each([['on', state], ['off', !state]], function (v) {
				var links = ge('.js-spoiler_' + v[0], link);
				for (var i = 0; i < links.length; ++i)
					toggleClass(links[i], 'hide', v[1]);
			});
		}
		
		return false;
	},
	expand: function (el) {
		var wrap = find_parents(el, '.js-expandadble_text_wrap', true);
		
		var full = ge('.js-expandadble_full_text', wrap)[0],
			short = ge('.js-expanadble_short_text', wrap)[0];
		
		full.style.display = 'block';
		short.style.display = 'none';
		
		return false;
	},
	extSpoiler: function (link) {
		var id = link.getAttribute('data-id'),
			place = ge('#' + link.getAttribute('data-place'));
		
		if (place) {
			var menu = ge('#' + id);
			place.appendChild(menu);
		}
		
		return Spoilers.toggle(link, id);
	},
    toggleQuote: function (id) {
		let el = ge('#quote-' + id);
		el.style.display = el.style.display != 'block' ? 'block' : 'none';
		return false;
	},
    toggle: function (el, id) {
        var spo_body = typeof id == 'string' ? ge('#' + id) : id,
			state = spo_body.style.display == 'none';
		spo_body.style.display = state ? '' : 'none';
		
		var spo_desc = ge('.spo_desc', el)[0],
			spo_desc_id = el.getAttribute('data-desc');
		if (spo_desc_id && spo_desc)
			spo_desc.innerHTML = ge('#spo-' + spo_desc_id + '-' + +state).innerHTML;
		if (el.getAttribute('data-self-hide'))
			el.style.display = 'none';
		return false;
	},
	toggleAll: function (el) {
		var flag = !+el.getAttribute('data-state');
		each(ge('.h_spl'), function (spoiler) {
			toggleClass(spoiler, 'hide', flag);
		});
		el.setAttribute('data-state', +flag);
		el.innerHTML = flag ? L('Показать скрытые комментарии') : L('Спрятать скрытые комментарии');
		return false;
	},
	spoiler: function (el) {
		var spo_all = find_parents(el, '.spo_all', true);
		return Spoilers.toggle(el, ge('.spo_text', spo_all)[0]);
	}
};

function get_elements(list) {
	var ret = [];
	if (list) {
		var ids = list.split(/,\s*/);
		for (var i = 0; i < ids.length; ++i) {
			if (ids[i].substr(0, 1) != ".") {
				ret.push(ge('#' + ids[i]));
			} else {
				var result = ge(ids[i]);
				for (var j = 0; j < result.length; ++j)
					ret.push(result[j]);
			}
		}
	}
	return ret;
}

function find_parents(e, selector, one) {
	var elements = [];
	if (selector) {
		var clazz, tag_name;
		if (selector[0] == '.')
			clazz = new RegExp('(^|\\s)' + selector.substr(1) + '(\\s|$)');
		else
			tag_name = selector.toLowerCase();
		
		while ((e = e.parentNode)) {
			if ((tag_name && e.nodeName.toLowerCase() == tag_name) || (clazz && clazz.test(e.className))) {
				elements.push(e);
				if (one)
					break;
			}
		}
	} else {
		while ((e = e.parentNode) && e != document)
			elements.push(e);
	}
	return one ? elements[0] : elements;
}

var toggle_replace_link = function (widget, flag) {
	var table = widget.parents('.table__wrap').first();
	
	widget
		.toggleClass('hide', !flag)
		.data('link')
		.toggleClass('link_active', flag);
	
	if (table.length)
		table.after(widget.addClass("content-bl__top_sep"));
};

// Для виджета Link
$('body').on('click', '.js-replace_link', function (e) {
	e.preventDefault();
	var link = $(this),
		widget = link.data('widget') || link.parent().find('.replace_widget');
	
	link.data('widget', widget);
	widget.data('link', link);
	
	toggle_replace_link(widget, !link.hasClass('link_active'));
}).action('cancel_link_replace', function (e) {
	e.preventDefault();
	var widget = $(this).parents('.js-replace_widget');
	toggle_replace_link(widget, false);
}).action('spoiler', function (e) {
	e.preventDefault();
	
	if ($(this).data('selector')) {
		$($(this).data('selector')).toggleClass('hide');
	} else if ($(this).data('id')) {
		$('#' + $(this).data('id')).toggleClass('hide');
		$(this).toggleClass('js-clicked');
	} else {
		let el = $(this);
		el.find('.ico_arr_down, .ico_arr_up').toggleClass('ico_arr_down ico_arr_up');
		el.parents('.js-spoiler_wrap').find('.js-spoiler_content').toggleClass('hide');
	}
})

// Спойлеры делегированные
.on('click', '.js-spolier', function () {
	return Spoilers.click(this);
});

// FIXME
window.Spoilers = Spoilers;

export default Spoilers;
