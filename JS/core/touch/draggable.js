import $ from '../../jquery';
import { addEvent, removeEvent } from '../events';
import * as sidebar from '../../widgets/swiper';

/*
 * Универсальная либа для всего, где нужен тач
 * */
export function startDraggable(el, options) {
	let is_true_touch = false;
	let in_touching = false;
	let is_moved = false;
	let last_x, last_y;
	let start_x, start_y;
	let origin_dx, origin_dy;
	let last_event;
	let zoom_start_distance = false;
	let first_target;
	let prevent_next_click;
	let relative_rect;
	
	options = Object.assign({
		// События DND
		onBeforeDragStart: () => true,
		onDragStart: () => {},
		onDragMove: () => {},
		onDragEnd: () => {},
		
		// События zoom
		onZoomStart: () => {},
		onZoomEnd: () => {},
		
		coordinates: 'client',			// Режим координат: client / page / screen
		calcRelative: false,
		
		preventMouseClick:		true,	// Отключить клик мыши, если было движение
		preventTouchScroll:		true,	// Отключить скроллинг при таче
		disableContextMenu:		false,	// Отключить контекстное меню
	}, options);
	
	// Context-menu не нужны
	if (options.disableContextMenu) {
		addEvent(el, 'contextmenu', preventDefault);
		addEvent(el, 'dblclick', preventDefault);
	}
	
	// Нативный DND не нужен
	addEvent(el, 'dragstart', preventDefault);
	addEvent(el, 'dragenter', preventDefault);
	
	let onTouchStart = (e) => {
		if (in_touching)
			return;
		
		// Сохраняем элемент, с корторого начался тач
		first_target = e.target;
		
		if (e.type == 'mousedown') {
			// С Chrome могут приходить события мыши, даже если мы с тача
			// Так же игнорируем все кнопки мыши кроме левой
			if (is_true_touch || e.which != 1)
				return;
		} else if (e.type == 'touchstart') {
			// Перед нами настоящий тач, игнорируем события мыши
			is_true_touch = true;
		}

		prevent_next_click = false;

		if (!options.onBeforeDragStart({ target: e.target }))
			return;
		
		sidebar.lock(true);

		if (is_true_touch && options.preventTouchScroll) {
			e.preventDefault();
			e.stopPropagation();
		}
		
		let touch = getPosition(e, options.coordinates);
		last_x = start_x = touch[0];
		last_y = start_y = touch[1];
		origin_dx = origin_dy = 0;
		is_moved = false;
		
		in_touching = true;
		zoom_start_distance = false;
		
		onTouchMove(e, true);
		
		// Динамически включаем события мыши
		if (!is_true_touch) {
			addEvent(document, 'mousemove', onTouchMove);
			addEvent(document, 'mouseup', onTouchEnd);
		}
		
		options.onDragStart(last_event);
	};
	
	let onTouchMove = (e, read_only) => {
		// Игнорим события мыши, если работаем с тачем
		if (!in_touching || (e.type == 'mousemove' && is_true_touch))
			return;
		
		let touch = getPosition(e, options.coordinates);
		
		// Зум двумя пальцами с тача
		if (is_true_touch) {
			if (e.touches.length > 1) {
				if (zoom_start_distance === false) {
					zoom_start_distance = calcDistance(e.touches);
					origin_dx = touch[2];
					origin_dy = touch[3];
					
					options.onZoomStart({});
				}
			} else if (zoom_start_distance !== false) {
				origin_dx = touch[0] - last_x;
				origin_dy = touch[1] - last_y;
				
				options.onZoomEnd({});
				zoom_start_distance = false;
			}
		}
		
		let x = touch[0] - origin_dx;
		let y = touch[1] - origin_dy;
		
		if (!is_moved && (x != last_x || y != last_y))
			is_moved = true;
		
		last_event = {
			x, y,
			dX: x - start_x, dY: y - start_y,
			dirX: last_x - x < 0 ? -1 : 1,
			dirY: last_y - y < 0 ? -1 : 1,
			trueTouch: is_true_touch,
			target: e.target,
			moved: is_moved,
			scale: 1
		};
		
		if (options.calcRelative) {
			relative_rect = relative_rect || el.getBoundingClientRect();
			last_event.relX = Math.min(Math.max((last_event.x - relative_rect.x) / relative_rect.width, 0), 1);
			last_event.relY = Math.min(Math.max((last_event.y - relative_rect.y) / relative_rect.height, 0), 1);
		}

		// Рассчитываем зум с помощью двух пальцев
		if (zoom_start_distance !== false)
			last_event.scale = calcDistance(e) / zoom_start_distance;
		
		last_x = touch[0];
		last_y = touch[1];
		
		// Чтобы не выделялся текст мышкой
		if (!read_only && !is_true_touch) {
			e.preventDefault();
			e.stopPropagation();
		}
		
		if (is_moved)
			options.onDragMove(last_event);
	};
	
	let onTouchEnd = (e) => {
		// При мультитаче прилетают на каждый палец, игнорим
		if (is_true_touch && e.touches.length > 0)
			return;
		
		// Игнорим события мыши, если работаем с тачем
		if (!in_touching || (e.type == 'mouseup' && is_true_touch))
			return;
		
		if (!is_true_touch) {
			// Динамически выключаем события мыши
			removeEvent(document, 'mousemove', onTouchMove);
			removeEvent(document, 'mouseup', onTouchEnd);
		}
		
		// Если перемещения не было, симулируем клик сами
		// Это нужно из-за того, что ранее отменили событие touchstart
		if (options.preventTouchScroll && !is_moved && is_true_touch) {
			$(first_target).click();
		}
		
		// Устанавливаем флаг, чтобы отменить следующий клик, который произодйёт после mouseup
		if (options.preventMouseClick && is_moved && !is_true_touch) {
			prevent_next_click = true;
			setTimeout(() => prevent_next_click = false, 50);
		}
		
		in_touching = false;
		is_true_touch = false;
		first_target = false;
		relative_rect = null;
		
		options.onDragEnd(last_event);

		sidebar.lock(false);
	};
	
	let onClick = (e) => {
		if (prevent_next_click) {
			e.preventDefault();
			prevent_next_click = false;
		}
	};
	
	// События тача
	addEvent(el, 'touchstart', onTouchStart);
	addEvent(el, 'touchmove', onTouchMove, true);
	addEvent(el, 'touchend', onTouchEnd);
	addEvent(el, 'touchcancel', onTouchEnd);
	
	// События мыши
	addEvent(el, 'mousedown', onTouchStart);
	addEvent(el, 'click', onClick);
	
	$(el).data('draggable', {
		events: { onTouchStart, onTouchMove, onTouchEnd, onClick }
	});
}

export function stopDraggable(el) {
	let state = $(el).data('draggable');
	if (state) {
		let events = state.events;
		
		// События тача
		removeEvent(el, 'touchstart', events.onTouchStart);
		removeEvent(el, 'touchmove', events.onTouchMove, true);
		removeEvent(el, 'touchend', events.onTouchEnd);
		removeEvent(el, 'touchcancel', events.onTouchEnd);
		
		// События мыши
		removeEvent(el, 'mousedown', events.onTouchStart);
		removeEvent(el, 'click', events.onClick);
		removeEvent(document, 'mousemove', events.onTouchMove);
		removeEvent(document, 'mouseup', events.onTouchEnd);
		
		// Прочее
		removeEvent(el, 'contextmenu', preventDefault);
		removeEvent(el, 'dblclick', preventDefault);
		removeEvent(el, 'dragstart', preventDefault);
		removeEvent(el, 'dragenter', preventDefault);
		
		$(el).removeData('draggable');
	}
}

function calcDistance(e) {
	let dx = (e.touches[1].clientX - e.touches[0].clientX);
	let dy = (e.touches[1].clientY - e.touches[0].clientY);
	return Math.sqrt(dx * dx + dy * dy);
}

function getPosition(e, prefix) {
	let touches = e.touches;
	let keyX = prefix + 'X';
	let keyY = prefix + 'Y';
	
	if (touches) {
		if (touches.length < 2)
			return [touches[0][keyX], touches[0][keyY]];
		
		let x = (touches[0][keyX] + touches[1][keyX]) / 2;
		let y = (touches[0][keyY] + touches[1][keyY]) / 2;
		
		return [x, y, x - touches[0][keyX], y - touches[0][keyY]];
	}
	
	return [e[keyX], e[keyY]];
}

function preventDefault(e) {
	e.preventDefault();
}
