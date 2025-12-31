import $ from './jquery';
import Spaces from './spacesLib';

// Модуль подсвечивания элементов в списке стрелочками
var expando = '_select_item_' + Date.now();
/*
	$el.itemsSelector({
		activeClass:	класс для активного элемента
		activeSelector:	селектор активного элемента, по умолчанию .activeClass
		selector:		селектор обычного элемента, по умолчанию все дети ноды $el
		external:		если true, то использует find() вместо children() ддя поиска элементов в $el
		keydownArea:	блок, на который повесится keydown
	})
*/
$.fn.itemsSelector = function (opts) {
	var el = this.first();
	
	if (!el.length || el.data(expando))
		return this;
	el.data(expando, true);
	
	opts = $.extend({
		activeClass: 	'active',
		keydownArea: 	el,
		clickSelector:	false,
		autoScroll:		false,
		hoverSelect:	true
	}, opts);
	opts.activeSelector = opts.activeSelector || ('.' + opts.activeClass);
	opts.keydownArea.on('keydown', function (e) {
		var key = e.keyCode;
		if (key == Spaces.KEYS.ENTER || key == Spaces.KEYS.MAC_ENTER) {
			var active = getActiveItem();
			if (active.length) {
				e.preventDefault();
				
				if (opts.clickSelector) {
					active.find(opts.clickSelector).click();
				} else {
					active.click();
				}
			}
		} else if (key == Spaces.KEYS.UP || key == Spaces.KEYS.DOWN) {
			e.preventDefault();
			moveSelectedItem(key == Spaces.KEYS.UP ? -1 : 1);
		}
	}).on('focus', function () {
		highlightItem();
	});
	
	var child_selector = opts.selector || '*',
		item_selector = opts.external ? opts.selector : ':scope > ' + child_selector;
	
	el.on('touchmove mouseenter mousedown touchstart', item_selector, function (e) {
		opts.hoverSelect && highlightItem($(this));
	}).on('mouseleave', ':scope > *', function (e) {
		opts.hoverSelect && highlightItem();
	});
	
	function getActiveItem(dir) {
		return children(el, opts.activeSelector);
	}
	
	function highlightItem(active) {
		children(el, opts.activeSelector).removeClass(opts.activeClass);
		if (active) {
			if (opts.autoScroll)
				$('html, body').scrollTo(active, {position: 'visible'});
			
			active.toggleClass(opts.activeClass, !active.data('no_highlight')).trigger('highlight');
		}
	}
	
	function children(parent, selector) {
		return (opts.external ? parent.find(selector) : parent.children(selector)).filter(function () {
			return $(this).isVisible();
		});
	}
	
	function moveSelectedItem(dir) {
		var items = children(el, opts.selector),
			active = getActiveItem();
		
		var current;
		if (!active.length) {
			current = dir > 0 ? items.first() : items.last();
		} else {
			var index = items.index(active[0]);
			if (dir > 0) {
				// вниз
				index = index + 1 < items.length ? index + 1 : 0;
			} else {
				// вверх
				index = index - 1 >= 0 ? index - 1 : items.length - 1;
			}
			current = $(items[index]);
		}
		
		if (current[0] != active[0])
			highlightItem(current);
	}
};

