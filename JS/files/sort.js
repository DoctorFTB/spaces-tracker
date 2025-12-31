import module from 'module';
import {Spaces, Codes} from '../spacesLib';
import $ from '../jquery';
import { startSortable, stopSortable } from '../sortable';
import { getElementRect } from '../core/touch/utils';

let files_wrap;

module.on('componentpage', () => {
	files_wrap = $('#files_list');
	
	let options = {
		buttons:			$('.js-files_sort_dnd'),
		dragButtonSelector:	'.js-drag_button',
		itemSelector:		'.js-file_item',
	};
	
	if (files_wrap.data('layout') == 'tile') {
		let placeholder_tile = $('#files_list .js-file_item').first().clone();
		placeholder_tile.addClass('tile--stub-empty');
		
		options.autoWidth = false;
		options.autoHeight = false;
		options.moveClass = 'tile--state-moving';
		options.dragClass = 'tile--state-dragover';
		options.customPlaceholder = placeholder_tile;
	} else {
		options.autoWidth = false;
		options.moveClass = 'sortable-shadow';
		options.dragClass = 'sortable-shadow--active';
		options.limitMoving = true;
		options.placeholderClass = 'wbg content-bl__sep';
	}
	
	startSortable(files_wrap[0], options);
	
	files_wrap.on('sortableButtonHover', (e) => {
		$(e.button).addClass('files-sort-dnd--active');
	}).on('sortableButtonBlur', (e) => {
		$(e.button).removeClass('files-sort-dnd--active');
	}).on('sortableButtonDrop', (e) => {
		let button = $(e.button);
		let element = $(e.element);
		let pgn = $('.pgn');
		let file = element.data();
		
		let ref_index = button.data('dir') < 0 ? 0 : pgn.data('on_page') - 1;
		let new_index = button.data('dir') < 0 ? -1 : pgn.data('on_page');
		let diff = e.elementIndex - new_index;
		
		let placeholder;
		if (files_wrap.data('layout') == 'tile') {
			element.addClass('tile--stub-filled');
			if (button.data('dir') < 0) {
				files_wrap.prepend(element);
			} else {
				files_wrap.find('.tiled_cap').first().before(element);
			}
			placeholder = element;
		} else {
			let box = getElementRect(element[0]);
			placeholder = $('<div>').css({
				height: box.h + "px",
				'box-sizing': 'border-box',
			}).addClass('wbg content-bl__sep');
			
			element.remove();
			
			let top_dnd = files_wrap.find('.js-files_sort_dnd_top');
			let bottom_dnd = files_wrap.find('.js-files_sort_dnd_bottom');
			
			if (button.data('dir') < 0) {
				if (top_dnd.length) {
					top_dnd.after(placeholder);
				} else {
					files_wrap.prepend(placeholder);
				}
			} else {
				if (bottom_dnd.length) {
					bottom_dnd.before(placeholder);
				} else {
					files_wrap.append(placeholder);
				}
			}
		}
		
		Spaces.api("files.file.level", {CK: null, Type: file.type, Id: file.nid, Rfi: ref_index, P: pgn.data('page'), Ldiff: diff}, (res) => {
			if (res.code == 0) {
				placeholder.replaceWith(res.replaceFile)
			} else {
				// Восстанавливаем старый элемент при ошибке
				placeholder.replaceWith(element);
				Spaces.showApiError(res);
			}
		});
	}).on('sortableEnd', (e) => {
		if (e.element && e.offset != 0) {
			let file = $(e.element).data();
			Spaces.api("files.file.level", {CK: null, Type: file.type, Id: file.nid, Ldiff: -e.offset});
		}
	});
});

module.on('componentpagedone', () => {
	stopSortable(files_wrap[0]);
	files_wrap = false;
});
