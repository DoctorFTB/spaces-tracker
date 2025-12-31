import module from 'module';
import $ from './jquery';
import Spaces from './spacesLib';
import page_loader from './ajaxify';
import GALLERY from './gallery';

var tpl = {
	stub: function () {
		return '<div class="gview_link" g="0|0|' + gid + '"></div>';
	}
};

var CHUNK_SIZE = 30;

var gid, files_wrap, opts, current,
	prev_items, next_items, last_api_req;

module.on("componentpage", init);

function init() {
	files_wrap = $('#photo_preview');
	opts = $('#photos_slider').data();
	
	page_loader.push('shutdown', destroy);
	
	last_api_req = {};
	current = {
		offset: opts.offset - 1,
		total: opts.total
	};
	
	var photo = files_wrap.find('.gview_link:first-child').first();
	if (!photo.length)
		return;
	
	gid = Spaces.File.getMeta(photo[0]).gid;
	
	prev_items = $('<div class="hide">').insertBefore(files_wrap);
	next_items = $('<div class="hide">').insertAfter(files_wrap);
	
	GALLERY.unlockGroup(gid);
	GALLERY.setBaseOffset(gid, current.offset);
	GALLERY.setGroupVisibleCount(gid, current.total);
	GALLERY.addPhoto();
	
	GALLERY.onGroup(gid, 'list', function (e) {
		if (e.last === false) {
			// Загружаем начальный чанк для обех сторон
			loadChunk(Math.max(current.offset - CHUNK_SIZE / 2, 0), CHUNK_SIZE + 1);
		} else {
			var dir = e.current - e.last;
			if (dir > 0) {
				// Загружаем по перелистыванию вперёд
				if (GALLERY.getGroupCnt(gid) - e.current < CHUNK_SIZE / 4) {
					var total_next = next_items.children().length;
					loadChunk(current.offset + total_next + 1, CHUNK_SIZE);
				}
			} else {
				// Загружаем по перелистыванию назад
				if (e.current < CHUNK_SIZE / 4) {
					var total_prev = prev_items.children().length,
						offset = current.offset - total_prev - CHUNK_SIZE,
						size = CHUNK_SIZE;
					
					if (offset < 0) {
						size += offset;
						offset = 0;
					}
					
					loadChunk(offset, size);
				}
			}
		}
	});
}

function destroy() {
	$.each(last_api_req, function (k, v) {
		Spaces.cancelApi(v);
	});
	
	last_api_req = files_wrap = opts = current = null;
	prev_items = next_items = null;
}

function isLoaded(offset, size) {
	var total_prev = prev_items.children().length,
		total_next = next_items.children().length;
	
	if (offset < current.offset - total_prev)
		return false;
	
	if (offset + size > current.offset + total_next)
		return false;
	
	return true;
}

function loadChunk(offset, size) {
	if (offset + size > current.total)
		size -= (offset + size) - current.total;
	
	if (size <= 0 || isLoaded(offset, size))
		return;
	
	var total, items, 	
		total_prev = prev_items.children().length,
		total_next = next_items.children().length;
	
	// Добавляем заглушки слева
	total = Math.max(current.offset - offset - total_prev, 0);
	items = '';
	if (total) {
		for (var i = 0; i < total; ++i)
			items += tpl.stub(gid);
		prev_items.prepend(items);
	}
	
	if (total)
		GALLERY.setBaseOffset(gid, current.offset - (total_prev + total));
	
	// Добавляем заглушки справа
	total = Math.max(offset + size - current.offset - total_next - 1, 0);
	items = '';
	if (total) {
		for (var i = 0; i < total; ++i)
			items += tpl.stub(gid);
		next_items.append(items);
	}
	
	GALLERY.addPhoto();
	GALLERY.update(true);
	
	var on_error = function (err) {
		GALLERY.setGroupError(gid, err, function () {
			GALLERY.setGroupError(gid, err, false);
			try_load();
		});
	};
	
	var try_load = function () {
		var api_data = $.extend({}, opts.apiData, {
			Mode: -1,
			O: offset,
			L: size
		});
		
		last_api_req[offset + ":" + size] = Spaces.api("files." + api_data.method, api_data, function (res) {
			delete last_api_req[offset + ":" + size];
			
			if (res.code == 0) {
				// Если юзер удалил файлы, заменяем их на null, тогда просмотрщик будет выводить "Пользователь удалил файл"
				while (res.widgets.length < size)
					res.widgets.push(null);
				
				let prev_items_children = prev_items.children();
				let next_items_children = next_items.children();
				
				// Обновляем заглушки на загруженные фото
				for (var i = offset, j = 0; i < offset + size; ++i, ++j) {
					if (i < current.offset) { // prev
						var index = i - offset,
							item = $(prev_items_children[index]);
						res.widgets[j] ? item.replaceWith(res.widgets[j]) : item.data('notFound', true);
					} else if (i > current.offset) { // next
						var index = i - current.offset - 1,
							item = $(next_items_children[index]);
						res.widgets[j] ? item.replaceWith(res.widgets[j]) : item.data('notFound', true);
					}
				}
				
				GALLERY.addPhoto();
				GALLERY.update(true);
			} else {
				on_error(Spaces.apiError(res));
			}
		}, {
			onError: function (err) {
				delete last_api_req[offset + ":" + size];
				
				on_error(err);
			}
		});
	};
	
	try_load();
}


