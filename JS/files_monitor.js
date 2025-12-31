import $ from './jquery';
import {tick} from './utils';

var drag_places = [],
	has_dragndrop = ('ondragover' in document.body),
	ns = '.spdnd' + Date.now(),
	DND_TIMEOUT = 300,
	
	RE_CYR_SUBDOMAINS = ['xn--p1ai|xn--j1amh|xn--80asehdb|xn--80aswg', 'рф|укр|онлайн|сайт|срб|su'], // Список кириллических доменов
	RE_URL_START = '([!()?.,\\s\\n\\r]|^)',
	RE_URL_END = '(?:[.!:;,*()]*([\\s\\r\\n]|$))',
	RE_PARSE_URLS = new RegExp('(?:' + 
			// Обычные домены
			RE_URL_START + '((https?://)?((?:[a-z0-9_\\-]+\\.)+(?:[a-z]{2,7}|' + RE_CYR_SUBDOMAINS[0] + '))(/.*?)?(\\#.*?)?)' + RE_URL_END + 
			'|' + 
			// Кириллические домены
			RE_URL_START + '((https?://)?((?:[a-z0-9а-яєґї_\\-]+\\.)+(?:' + RE_CYR_SUBDOMAINS[1] + '))(/.*?)?(\\#.*?)?)' + RE_URL_END + 
			'|' + 
			// Кириллические домены в зонах некиррилических
			RE_URL_START + '((https?://)((?:[a-z0-9а-яєґї_\\-]+\\.)+(?:[a-z]{2,7}|' + RE_CYR_SUBDOMAINS[1] + '))(/.*?)?(\\#.*?)?)' + RE_URL_END + 
		')', 'gi');

function check_url(text) {
	RE_PARSE_URLS.lastIndex = 0;
	var m = RE_PARSE_URLS.exec(text);
	return !!(m && $.trim(text).indexOf($.trim(m[0])) === 0);
}

$.fn.filesMonitor = function () {
	var el = this, drag_timeout, in_dropndrag = false;
	if (el.data('inited' + ns))
		return el;
	el.data('inited' + ns, true);
	
	drag_places.push(el);
	
	// Drag'n'Drop
	if (has_dragndrop) {
		el.on('dragenter' + ns, function (evt) {
			var e = evt.originalEvent;
			if (_isFileTransfer(e.dataTransfer.types))
				evt.preventDefault(); // в IE без этого не работает O_O
		}).on('dragover' + ns, function (evt) {
			var e = evt.originalEvent;
			if (drag_timeout) {
				clearTimeout(drag_timeout);
				drag_timeout = null;
			}
			if (_isFileTransfer(e.dataTransfer.types)) {
				evt.preventDefault();
				if (!in_dropndrag)
					el.trigger('fileDragStart');
				in_dropndrag = true;
				el.addClass(el.data('dragover-class'));
				el.removeClass(el.data('dragleave-class'));
			}
		}).on('dragleave' + ns, function (evt) {
			var e = evt.originalEvent;
			if (!drag_timeout) {
				drag_timeout = setTimeout(function () {
					if (in_dropndrag)
						el.trigger('fileDragEnd');
					in_dropndrag = false;
					el.removeClass(el.data('dragover-class'));
					el.addClass(el.data('dragleave-class'));
				}, DND_TIMEOUT);
			}
		}).on('drop' + ns, function (evt) {
			var e = evt.originalEvent;
			if (e.dataTransfer.files.length > 0 && !e[ns]) {
				evt.preventDefault();
				el.trigger('fileDragEnd');
				el.trigger('dragGlobalEnd');
				el.trigger('files', {
					files: e.dataTransfer.files
				});
				in_dropndrag = false;
				el.removeClass(el.data('dragover-class'));
				el.removeClass(el.data('dragleave-class'));
				
				e[ns] = true;
			}
		});
	}
	
	// Paste
	el.on('paste' + ns, function (e, data) {
		var target = $(e.target),
			clip = e.originalEvent.clipboardData || window.clipboardData,
			files = get_clip_file(clip);
		if (files) {
			e.preventDefault();
			e.stopPropagation();
			e.stopImmediatePropagation();
			el.trigger('files', {files: files});
		} else if (clip && (!clip.types || $.inArray("text/plain", clip.types) >= 0 || $.inArray("Text", clip.types) >= 0) && !target.data('no_paste')) {
			var clip_data;
			try { clip_data = clip.getData('text/plain'); } catch (e) { }
			if (!clip_data) {
				// ie hack
				try { clip_data = clip.getData('Text'); } catch (e) { }
			}

			var urls = extract_urls(clip_data);
			if (urls.length > 0) {
				el.trigger('pasteurl', {
					urls: urls,
					target: target,
					fromInput: is_editable(target)
				});
			}
		}
	});
	
	return el;
};

function is_editable(el) {
	var tag_name = el.prop("tagName");
	return tag_name && /^textarea|input$/i.test(tag_name);
}

function init_dnd_monitor() {
	var self = this, drag_timeout,
		in_dropndrag = false,
		real_in_dropndrag = false;
	
	if (!has_dragndrop)
		return;
	var $main = $('#main');
	
	$('body').on('dragover.oneRequest', function (ev) {
		var e = ev.originalEvent;
		if (_isFileTransfer(e.dataTransfer.types)) {
			ev.preventDefault();
			for (var i = 0; i < drag_places.length; ++i) {
				var el = drag_places[i];
				el.addClass(el.data('dragavail-class'));
			}
			if (!real_in_dropndrag)
				$main.trigger('dragGlobalStart');
			
			in_dropndrag = true;
			real_in_dropndrag = true;
			if (drag_timeout) {
				clearTimeout(drag_timeout);
				drag_timeout = null;
			}
		}
	}).on('dragleave.oneRequest drop.oneRequest', function (ev) {
		var e = ev.originalEvent;
		if (_isFileTransfer(e.dataTransfer.types)) {
			if (ev.type == 'drop')
				e.preventDefault();
			in_dropndrag = false;
			if (!drag_timeout) {
				drag_timeout = setTimeout(function () {
					for (var i = 0; i < drag_places.length; ++i) {
						var el = drag_places[i];
						el.removeClass(el.data('dragavail-class'));
					}
					drag_timeout = null;
					if (real_in_dropndrag)
						$main.trigger('dragGlobalEnd');
					real_in_dropndrag = false;
				}, DND_TIMEOUT);
			}
		}
	});
}

function extract_urls(text) {
	var m, urls = [], re_http = /^http(s?):\/\//i;
	RE_PARSE_URLS.lastIndex = 0;
	while (text && (m = RE_PARSE_URLS.exec(text))) {
		var offset = m[4] ? 0 : m[7 + 4] ? 7 : 14,
			url = m[offset + 2];
		if (!re_http.test(url))
			url = 'http://' + url;
		urls.push({
			url: url,
			domain: m[offset + 4]
		});
	}
	return urls;
}

function get_clip_file(clip) {
	if (clip) {
		if (clip.files && clip.files.length > 0) // FF?
			return clip.files;
		
		if ('items' in clip && clip.items) {
			var files = [];
			for (var i = 0; i < clip.items.length; ++i) {
				var item = clip.items[i];
				if (item.kind == "file" && item.getAsFile) {
					var blob = item.getAsFile();
					files.push(blob);
				}
			}
			if (files.length > 0)
				return files;
		}
	}
	
	// IE?
	clip = window.clipboardData;
	if (clip && clip.files && clip.files.length > 0)
		return clip.files;
}

function _isFileTransfer(types) {
	return ($.inArray("Files", types) > -1 || $.inArray("application/x-moz-file", types) > -1) && $.inArray("text/_moz_htmlcontext", types) < 0;
}

function destroy() {
	has_dragndrop = [];
	drag_places = [];
}

var FilesMonitor = {checkUrl: check_url, extractUrls: extract_urls, init: init_dnd_monitor, destroy: destroy};
export default FilesMonitor;
