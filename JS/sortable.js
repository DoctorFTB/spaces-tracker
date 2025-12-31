import module from 'module';
import $ from './jquery';
import './anim';

import { throttle } from './utils';
import { getElementRect, getBoxesIntersection } from './core/touch/utils';
import { startDraggable, stopDraggable } from './core/touch/draggable';
import autoscroll from './core/autoscroll';
import { addEvent, removeEvent } from './core/events';

const tpl = {
	placeholder(class_name) {
		return `
			<div style="box-sizing:border-box" class="${class_name || ''}">&nbsp;</div>
		`;
	}
};

let widgets_for_cleanup = [];

function findCurrentItem(parent, target) {
	let cursor = target;
	while (cursor && cursor.parentNode != parent)
		cursor = cursor.parentNode;
	return cursor && $(cursor);
}

export function startSortable(container, options) {
	let current_item;
	let old_inline_css;
	let start_index;
	let current_item_box;
	let last_position;
	let current_button;
	let limit_moving;
	let limit_scrolling;
	let last_scroll_dir = 0;
	let current_items;
	
	options = Object.assign({
		// Кастмоный плейсхолдер, если не подходит стандартный
		customPlaceholder:		false,
		
		// Кастомный класс для стандартного плейсхолдера
		placeholderClass:		false,
		
		// Автоматический ресайз плейсхолдера (под размер оригинального элемента)
		autoWidth:				true,
		autoHeight:				true,
		
		// Автоскролл, если список для сортировки длинный
		autoScroll:				true,
		
		// Классы для состояний
		moveClass:				false,
		dragClass:				false,
		
		// Кнопки, на которые можно перетащить элемент
		buttons:				false,
		
		// Кнопка с помощью которой выполнять перетаскивание
		dragButtonSelector:		false,
		
		// Ограничить движение вне контейнера
		limitMoving:			false,
		
		// Селектор элемента для определения индекса
		itemSelector:			false,
	}, options);
	
	let placeholder = options.customPlaceholder || $(tpl.placeholder(options.placeholderClass));
	
	let updateSortItems = throttle(() => {
		if (!current_item)
			return;
		
		let insert_before = true;
		
		let x = last_position.x + window.pageXOffset;
		let y = last_position.y + window.pageYOffset;
		
		if (options.limitMoving) {
			x = Math.min(limit_moving.maxX, Math.max(limit_moving.minX, x));
			y = Math.min(limit_moving.maxY, Math.max(limit_moving.minY, y));
		}
		
		let center_x = x + last_position.w / 2;
		let center_y = y + last_position.h / 2;
		
		for (let i = 0, l = current_items.length; i < l; i++) {
			let item = current_items[i];
			let item_position = getElementRect(item);
			
			if (item == current_item[0] || item == placeholder[0])
				continue;
			
			let matched_by_x = center_x >= item_position.x && center_x <= item_position.x + item_position.w;
			let matched_by_y = center_y >= item_position.y && center_y <= item_position.y + item_position.h;
			
			if (matched_by_x && matched_by_y) {
				if (item.compareDocumentPosition(placeholder[0]) & Node.DOCUMENT_POSITION_FOLLOWING) {
					placeholder.insertBefore(item);
				} else {
					placeholder.insertAfter(item);
				}
				break
			}
		}
		
		let max_intersection = 0;
		let max_intersection_btn;
		
		for (let i = 0, l = options.buttons.length; i < l; i++) {
			let button = options.buttons[i];
			let button_position = getElementRect(button);
			
			let intersection_pct = getBoxesIntersection({
				x, y,
				w: last_position.w,
				h: last_position.h,
			}, button_position);
			if (intersection_pct > max_intersection) {
				max_intersection_btn = button;
				max_intersection = intersection_pct;
			}
		}
		
		if (current_button != max_intersection_btn) {
			if (current_button) {
				let evt = new $.Event('sortableButtonBlur');
				evt.button = current_button;
				$(container).trigger(evt);
				current_button = false;
				
				if (options.dragClass)
					current_item.removeClass(options.dragClass);
			}
			
			if (max_intersection_btn) {
				current_button = max_intersection_btn;
				let evt = new $.Event('sortableButtonHover');
				evt.button = current_button;
				$(container).trigger(evt);
				
				if (options.dragClass)
					current_item.addClass(options.dragClass);
			}
		}
	}, 250);
	
	let updateScroll = throttle(() => {
		if (last_scroll_dir) {
			// console.log('update scroll speed', last_scroll_dir);
			let scroll_to = last_scroll_dir < 0 ? limit_scrolling.minY : limit_scrolling.maxY;
			autoscroll.start(last_scroll_dir, () => {
				fixCurrentItemPosition();
			}, scroll_to);
		}
	}, 100);
	
	let fixCurrentItemPosition = () => {
		if (options.limitMoving) {
			let scroll_x = window.pageXOffset;
			let scroll_y = window.pageYOffset;
			
			let x = last_position.x + scroll_x;
			let y = last_position.y + scroll_y;
			
			x = Math.min(limit_moving.maxX, Math.max(limit_moving.minX, x));
			y = Math.min(limit_moving.maxY, Math.max(limit_moving.minY, y));
			
			let screen_x = x - scroll_x;
			let screen_y = y - scroll_y;
			
			current_item.move(screen_x, screen_y);
		}
		updateSortItems();
	};
	
	// https://stackoverflow.com/questions/42958463/stop-automatic-scrolling-on-page-content-change
	container.style.overflowAnchor = 'none';
	
	startDraggable(container, {
		coordinates: 'client',
		preventClick: true,
		onBeforeDragStart(e) {
			let el = $(e.target);
			if (options.dragButtonSelector) {
				// Разрешаем перетаскивание только с помощью специальной кнопки
				if (!el.is(options.dragButtonSelector) && !el.parents(options.dragButtonSelector).length)
					return false;
			}
			return true;
		},
		onDragMove(e) {
			if (!current_item) {
				current_item = findCurrentItem(container, e.target);
				start_index = current_item.index(options.itemSelector);
				old_inline_css = current_item.attr("style") || "";
				
				current_item_box = getElementRect(current_item[0], true);
				
				if (options.moveClass)
					current_item.addClass(options.moveClass);
				
				if (options.autoWidth)
					placeholder.css({width: current_item_box.w + "px"});
				if (options.autoHeight)
					placeholder.css({height: current_item_box.h + "px"});
				
				current_item.css({
					position: 'fixed',
					left: 0, top: 0,
					'z-index': 10000,
					userSelect: 'none',
					cursor: 'move',
					'box-sizing': 'border-box',
					'will-change': 'left, top, transform',
					
					// Сохраняем размер
					width:	Math.ceil(current_item_box.w) + "px",
					height:	Math.ceil(current_item_box.h) + "px",
					
					// Отключаем анимацию
					'animation-play-state':	'paused',
					'animation-name':		'none',
					'transition':			'none'
				});
				
				// Триггерим событие
				let evt = new $.Event('sortableStart');
				evt.element = current_item;
				$(container).trigger(evt);
				
				placeholder.insertBefore(current_item);
				
				limit_moving = false;
				last_scroll_dir = false;
				
				if (options.limitMoving) {
					let container_box = getElementRect(container);
					limit_moving = {
						minY:		container_box.y,
						maxY:		container_box.y + container_box.h - current_item_box.h,
						minX:		container_box.x,
						maxX:		container_box.x + container_box.w - current_item_box.w
					};
				}
				
				if (options.autoScroll) {
					let container_box = getElementRect(container);
					let threshold = window.innerHeight * 0.2;
					limit_scrolling = {
						minY:		container_box.y - threshold,
						maxY:		container_box.y + container_box.h + threshold - window.innerHeight
					};
				}
				
				if (options.limitMoving || options.autoScroll) {
					addEvent(window, 'scroll', fixCurrentItemPosition, true);
				}
				
				if (options.itemSelector) {
					current_items = $(container).children(options.itemSelector);
				} else {
					current_items = $(container).children();
				}
			}
			
			let scroll_x = window.pageXOffset;
			let scroll_y = window.pageYOffset;
			
			let x = current_item_box.x + e.dX + scroll_x;
			let y = current_item_box.y + e.dY + scroll_y;
			
			if (limit_moving) {
				x = Math.min(limit_moving.maxX, Math.max(limit_moving.minX, x));
				y = Math.min(limit_moving.maxY, Math.max(limit_moving.minY, y));
			}
			
			let screen_x = x - scroll_x;
			let screen_y = y - scroll_y;
			
			if (options.autoScroll) {
				let scroll_threshold = 0.01;
				let scroll_trigger_area = window.innerHeight * scroll_threshold;
				let min_screen_y = window.innerHeight * 0.01;
				let max_screen_y = window.innerHeight;
				let min_speed = 100;
				let max_speed = 300;
				let current_y = y - scroll_y;
				
				let new_scroll_dir;
				if (current_y < min_screen_y) {
					let acceleration = Math.min(4, ((min_screen_y - current_y) / 20));
					let speed = min_speed + acceleration * (max_speed - min_speed);
					new_scroll_dir = -speed;
				} else if (current_y + current_item_box.h > max_screen_y) {
					let acceleration = Math.min(4, ((current_y + current_item_box.h) - max_screen_y) / 30);
					let speed = min_speed + acceleration * (max_speed - min_speed);
					new_scroll_dir = speed;
				} else {
					new_scroll_dir = 0;
				}
				
				// Включаем автоскролл только если совпадает направление движения
				if (!last_scroll_dir) {
					if (new_scroll_dir > 0 && e.dirY >= 0)
						new_scroll_dir = 0;
					if (new_scroll_dir < 0 && e.dirY <= 0)
						new_scroll_dir = 0;
				}
				
				if (last_scroll_dir != new_scroll_dir) {
					last_scroll_dir = new_scroll_dir;
					if (last_scroll_dir) {
						updateScroll();
					} else {
						autoscroll.stop();
					}
				}
			}
			
			current_item.move(screen_x, screen_y);
			
			last_position = {
				x: screen_x,
				y: screen_y,
				w: current_item_box.w,
				h: current_item_box.h,
			};
			
			if (!last_scroll_dir)
				updateSortItems();
		},
		onDragEnd(e) {
			if (!current_item)
				return;
			
			if (last_scroll_dir) {
				autoscroll.stop();
				last_scroll_dir = false;
			}
			
			if (options.moveClass)
				current_item.removeClass(options.moveClass);
			
			// Восстанавливаем CSS
			current_item.attr("style", old_inline_css);
			
			if (current_button) {
				// Восстанавливаем прежнюю позицию файла
				placeholder.detach();
				
				// Триггерим событие
				let evt = new $.Event('sortableButtonDrop');
				evt.element = current_item;
				evt.elementIndex = start_index;
				evt.button = current_button;
				$(container).trigger(evt);
				
				evt = new $.Event('sortableButtonBlur');
				evt.button = current_button;
				$(container).trigger(evt);
				
				evt = new $.Event('sortableEnd');
				$(container).trigger(evt);
			} else {
				// Переносим элемент на место плейсхолдера
				current_item.insertAfter(placeholder);
				placeholder.detach();
				
				// Триггерим событие
				let evt = new $.Event('sortableEnd');
				evt.from = start_index;
				evt.to = current_item.index(options.itemSelector);
				evt.offset = current_item.index(options.itemSelector) - start_index;
				evt.element = current_item;
				$(container).trigger(evt);
			}
			
			if (options.limitMoving || options.autoScroll)
				removeEvent(window, 'scroll', fixCurrentItemPosition, true);
			
			if (options.dragClass)
				current_item.removeClass(options.dragClass);
			
			current_item = false;
			current_button = false;
			limit_scrolling = false;
			limit_moving = false;
		}
	});
}

export function stopSortable(container) {
	stopDraggable(container);
	container.style.overflowAnchor = '';
}

module.on("componentpage", () => {
	$('.js-sortable').each(function () {
		let $el = $(this);
		widgets_for_cleanup.push(this);
		startSortable(this, {
			placeholderClass:		$el.data('placeholderClass'),
			moveClass:				$el.data('moveClass') || 'sortable-shadow',
			dragButtonSelector:		$el.data('dragButtonSelector'),
			limitMoving:			$el.data('limitMoving'),
		});
	});
});

module.on("componentpagedone", () => {
	widgets_for_cleanup.forEach((widget) => {
		stopSortable(widget);
	});
});
