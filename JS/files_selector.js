import $ from './jquery';
import cookie from './cookie';
import Device from './device';
import {Spaces, Url} from './spacesLib';
import page_loader from './ajaxify';
import {L, html_wrap, extend, tick, numeral} from './utils';

import "Files/Gallery.css";

var default_params = {
	dir: 0,
	commId: 0,
	talkId: 0,
	commSection: 0,
	maxFiles: 1,
	type: Spaces.TYPES.FILE,
	apiData: {}
	
	/*
		onFileSelect
		onFileMultiSelect
		onHistoryJSC
		onExit
		onRender
	*/
};

var params, last_api_request, saved_scroll,
	selected = {}, selected_cnt = 0,
	opened = false,
	has_shadows = !cookie.get('gal_no_transp') && Device.css('box-shadow', '0px 0px 0px #000', /\d\w/),
	gallery_transp = Device.type == 'desktop' && has_shadows,
	cur_state = {},
	type2name = {
		[Spaces.TYPES.FILE]: L('Файлы'),
		[Spaces.TYPES.VIDEO]: L('Видео'),
		[Spaces.TYPES.MUSIC]: L('Музыка'),
		[Spaces.TYPES.PICTURE]: L('Фото')
	};

var tpl = {
	selectorWin: function () {
		var html = 
			'<div id="Gallery" class="gallery gallery_fileselector">' + 
				'<div class="gallery__page_shadow"></div>' + 
				'<div class="gallery__header">' + 
					'<div class="gallery__header_inner">' + 
						'<div class="gallery__tools_place">&nbsp;</div>' + 
						'<a class="gallery__tools_button" href="#gallery_exit" id="gallery_exit">' + 
							'<span class="ico_gallery ico_gallery_exit m"></span>' + 
						'</a>' + 
					'</div>' + 
					'<table class="gallery_cnt-table">' + 
						'<tr><td><div class="gallery_cnt" id="files_selector-title"></div></td></tr>' + 
					'</table>' + 
				'</div>' + 
				'<div class="gallery__image-wrapper">' + 
					'<div class="oh modal_content">' + 
						'<div id="files_selector-error" class="error hide"></div>' + 
						'<div id="files_selector-selected"></div>' + 
						'<div id="files_selector-list"></div>' + 
					'</div>' + 
				'</div>' + 
			'</div>';
		return html;
	},
	selected: function () {
		var html = '', first = true;
		if (selected_cnt > 0) {
			html += '<div class="stnd_padd">' +
			 L('Выбрано {0} из {1}:', selected_cnt, params.maxFiles) + '<br />';
			for (var nid in selected) {
				var f = selected[nid];
				html += (first ? '' : ', ') + '<span class="ico_files ico_files_' + Spaces.getFileIcon(f.fileext) + ' js-ico m"></span>' + 
					'<span class="m t-strong_item">' + html_wrap(f.filename + '.' + f.fileext) + '</span></a>';
				if (first)
					first = false;
			}
			html += '</div>';
		}
		return html;
	}
};

function open(args) {
	saved_scroll = $(window).scrollTop();
	params = extend({}, default_params, args);
	cur_state = {};
	opened = true;
	init();
}

function close() {
	if (page_loader.ok() && page_loader.isJSC())
		window.history.back();
	else
		realClose();
}

function realClose() {
	_selectFile();
	if (opened) {
		$('#Gallery').remove();
		$('body').removeClass('gallery__open gallery__transp_open').off('.files_selector');
		if (!gallery_transp) {
			tick(function () {
				$('html, body').scrollTop(saved_scroll);
			});
		}
		
		opened = false;
		selected = {};
		selected_cnt = 0;
		Spaces.cancelApi(last_api_request);
		params.onExit && params.onExit();
		
		if (Device.android_app) {
			// Костыль для перерисовки верхней панели, т.к. после закрытия фуллскрин просмотрщика она криво позиционируется. (Android 2.3)
			$('#pmb8876').remove();
			$('#navi').append('<div id="pmb8876">');
		}
	}
}

function init() {
	if (page_loader.ok()) {
		page_loader.on('shutdown', "file_selector", function () {
			realClose();
			params = {};
			params = null;
		});
		page_loader.on('requestend', "file_selector", function () {
			realClose();
		}, {persistOnRequest: true});
		page_loader.on('mailrequestend', "file_selector", function () {
			realClose();
		}, {persistOnRequest: true});
		page_loader.onJSC('file_selector', function (jsc_params) {
			if (params.onHistoryJSC) {
				params.onHistoryJSC(jsc_params.split(':'));
			} else {
				page_loader.setJSC(false);
			}
		});
		page_loader.setJSC('file_selector', params.type);
	}
	
	showFilesList(function () {
		$('#main_wrap').append(tpl.selectorWin());
		$('body')
			.addClass(!gallery_transp ? 'gallery__open' : 'gallery__transp_open')
			.on('keydown.files_selector', function (e) {
				if (e.keyCode == 27) // ESC
					close();
			});
		
		var gallery = $('#Gallery')
		.on('click', '#gallery_exit, .gallery__page_shadow', function (e) {
			e.preventDefault();
			close();
		}).on('click', '.js-file_item a, .js-file_item input[type="checkbox"]', function (e) {
			e.preventDefault();
			e.stopPropagation();
			e.stopImmediatePropagation();
			
			var el = $(this).parents('.js-file_item'),
				file = el.data();
			file.previewURL = el.find('.preview').first().prop("src"); // FIXME: КОСТЫЛЬ
			onSelectFile(file);
			tick(function () {
				el.find('input[type="checkbox"]').prop("checked", !!selected[file.nid]);
			});
		}).on('submit', 'form', function (e) {
			e.preventDefault();
			var el = $(this), url = new Url(el.find('.pgn').data('url'));
			$.extend(url.query, Url.serializeForm(this));
			loadByUrl(url);
		}).on('click', 'a, uc-click', function (e) {
			var url = new Url($(this).attr("href"));
			if (url.query.Dir) {
				e.preventDefault();
				loadByUrl(url);
			}
		});
		
		params.onRender && params.onRender();
	});
	
}

function onSelectFile(file) {
	// fix file
	if (!Spaces.core.fixFile(file, params.type)) {
		console.error(file);
		return showErrors(L("Ошибка разбора файла!"));
	}
	
	showErrors(false);
	if (params.maxFiles > 1) {
		if (selected[file.nid]) {
			--selected_cnt;
			delete selected[file.nid];
		} else {
			if (params.maxFiles <= selected_cnt) {
				showErrors(L("Выбрано максимальное количество файлов."));
			} else {
				++selected_cnt;
				selected[file.nid] = file;
				
			}
		}
		updateSelectedList();
	} else {
		selected[file.nid] = file;
		++selected_cnt;
		_selectFile();
		tick(close);
	}
}

function _selectFile() {
	var files = [];
	$.each(selected, function (nid, file) {
		if (params.onFileMultiSelect) {
			files.push(selected[nid]);
		} else if (params.onFileSelect) {
			params.onFileSelect(file.nid, params.type, file)
		}
	});
	
	selected = {};
	selected_cnt = 0;
	
	if (params.onFileMultiSelect)
		params.onFileMultiSelect(files);
}

function loadByUrl(url) {
	cur_state = url.query;
	showFilesList();
}

function showFilesList(callback) {
	var data = $.extend({
		Type: params.type,
		Html: 1,
		Multi: params.maxFiles > 1,
		Rli: Spaces.params.link_id,
		Link_id: Spaces.params.link_id
	}, params.apiData, cur_state);
	
	if (params.commId) {
		data.Comm = params.commId;
		data.Section = params.commSection;
	} else if (params.talkId) {
		data.Talk = params.talkId;
	}
	
	showErrors(false);
	
	Spaces.cancelApi(last_api_request);
	$('#files_selector-title').text(L('Загрузка...'));
	last_api_request = Spaces.api("files.select", data, function (res) {
		if (res.code == 0) {
			callback && callback();
			$('#files_selector-list').html(res.select_widget);
		} else {
			showErrors(Spaces.apiError(res));
		}
		updateSelectedList();
		scrollToTop();
	});
}

function showErrors(error) {
	if (error) {
		if (error instanceof Array)
			error = error.join('<br />');
		$('#files_selector-error').html(error).show();
		scrollToTop();
	} else {
		$('#files_selector-error').hide();
	}
}

function scrollToTop() {
	var el = Device.type == 'desktop' ? $('#Gallery .gallery__image-wrapper') : $('html, body');
	el.scrollTop(0);
}

function updateSelectedList() {
	$('#gallery_exit .ico_gallery')
		.toggleClass('ico_gallery_select', selected_cnt > 0)
		.toggleClass('ico_gallery_exit', !selected_cnt);
	$('#files_selector-selected').html(tpl.selected());
	
	var title = params.maxFiles > 1 ? L('Выберите файлы') : L('Выберите файл')
	if (selected_cnt > 0)
		title = numeral(selected_cnt, [L('Выбран $n файл'), L('Выбрано $n файла'), L('Выбрано $n файлов')]);
	$('#files_selector-title').text(title);
	
	$('#files_selector-list input[type="checkbox"]').each(function () {
		var nid = $(this).parents('.js-file_item').data('nid');
		if (selected[nid])
			this.checked = true;
	});
}

var FilesSelector = {open: open};
export default FilesSelector;
