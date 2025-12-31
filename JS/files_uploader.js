import $ from './jquery';
import Device from './device';
import {Class, TSimpleEvents} from './class';
import {Spaces, Url} from './spacesLib';
import page_loader from './ajaxify';
import FilesUploader from './libs/FilesUploader';
import {L, html_wrap, extend, tick} from './utils';

/*
	#upload_file_{id}
	#upload_thumb_{id}
	#upload_pb_pct_{id}
	#upload_pb_wrap_{id} - прогресс бар файла
	#upload_name_input_{id} - поле ввода с именем файла
	#upload_name_{id} - поле ввода с именем файла
*/
var classes = {
	pbar: {
		light: 'progress-item__runner_light',
		pctDone: 'progress-item__num_fin'
	}
};

var tpl = {
	/*
		Упрощенный списочный итем без редактирования
		Используется в аттачах и для индикации загрузки файла в окне выбора аттачей
	*/
	fileItemLite: function (data) {
		var html = 
			'<div id="upload_file_' + data.id + '" class="cf' + (data.noWrap ? '' : ' stnd_padd') + '">' + 
				'<div class="block-item__avatar">' + 
					'<img src="' + filters[data.type].thumb + '" alt="" ' + 
						'class="preview" id="upload_thumb_' + data.id + '" width="40" height="40">' + 
				'</div>' + 
				'<div class="block-item__descr oh">' + 
					'<div>' + 
						'<span class="m ico ico_close js-upload_remove right" data-id="' + data.id + '"></span>' + 
						tpl.fileItemInline(data) + 
					'</div>' + 
					'<div>' + 
						'<table class="table__wrap table_progress table_progress-full">' + 
							'<tr>' + 
								'<td class="table__cell hide" id="upload_spinner_' + data.id + '"></td>' + 
								'<td class="table__cell hide" id="upload_err_' + data.id + '"></td>' + 
								'<td class="table__cell table__cell_progress hide" id="upload_pb_wrap_' + data.id + '"></td>' + 
								'<td class="table__cell">' + 
									'<div class="progress-item__num" id="upload_pb_pct_' + data.id + '"></div>' + 
								'</td>' + 
							'</tr>' + 
						'</table>' + 
					'</div>' + 
				'</div>' + 
			'</div>';
		return html;
	},
	
	/*
		Списочный итем загрузки файла
	*/
	fileItem: function (data) {
		if (!data.additionalMenu)
			return tpl.fileItemLite(data);
		
		let file_fields_html = $('#upload_fields_template').text().replace(/x-script/g, 'script');
		
		return `
			<div
				class="upload_error__item_wrapper ${(data.noWrap ? '' : 'content-item3 wbg content-bl__sep content-bl__sep')} js-upload_file"
				id="upload_file_${data.id}"
				data-id="${data.id}"
			>
				<table class="table__wrap"><tr>
				<td class="block-item__avatar t_center" width="80">
					<div class="upload_preview t_center">
						<img src="${filters[data.type].thumb}" alt="" class="preview m" id="upload_thumb_${data.id}" style="width: 100%" />
					</div>
					<div class="t_center normal-stnd stnd_padd4">${(data.size ? Spaces.getHumanSize(data.size) : "")}</div>
				</td>
				<td style="width: 100%; vertical-align: top">
					<div class="cl break-word">
						<a href="#" class="js-upload_no_pb_ui js-upload_remove" data-id="${data.id}" title="${L('Убрать из загрузки')}">
							<span class="ico ico_remove right"></span>
						</a>
						<span class="grey">Файл <span class="js-upload_file_number">0</span>:</span> ${html_wrap(data.name)}
					</div>
					<div class="normal-stnd">
						<div class="js-upload_file_fields">
							${file_fields_html}
						</div>
						<div class="cl">
							<div class="pad_t_a hide js-upload_pb_ui">
								<table class="table__wrap table_progress table_progress-full">
									<tr class="m">
										<td class="table__cell">
											<div class="t-padd_right js-upload_remove" data-id="${data.id}">
												<span class="ico ico_remove ico_no-mrg"></span>
											</div>
											<div class="t-padd_right js-upload_done hide">
												<span class="ico ico_ok_green ico_no-mrg"></span>
											</div>
										</td>
										<td class="table__cell table__cell_progress" id="upload_pb_wrap_${data.id}"></td>
										<td class="table__cell">
											<div class="t-padd_left" id="upload_pb_pct_${data.id}"></div>
										</td>
									</tr>
								</table>
							</div>
							<div id="upload_err_${data.id}" class="hide pad_t_a"></div>
						</div>
					</div>
				</td>
				</tr></table>
			</div>
		`;
	},
	fileItemInline: function (data) {
		var html = 
			'<span id="upload_file_info_' + data.id + '">' + 
				(!data.empty ? '<span class="ico_files ico_files_' + Spaces.getFileIcon(data.ext) + ' js-ico m"></span> ' : '') + 
				html_wrap(!data.empty ? (data.name || L('Имя файла не определено')) : L('Файл не выбран')) + 
			'</span> ' + 
			(data.size ? '<b>(' + Spaces.getHumanSize(data.size) + ')</b> ' : '') + 
			(data.deleteBtn ? tpl.deleteBtn() : '');
		return html;
	},
	fileProgress: function (data) {
		var html =
			'<div class="progress-item">' +
				'<div class="progress-item__runner progress-item__runner_light" id="upload_pb_' + data.id + '"></div>' +
			'</div>';
		return html;
	},
	cancelBtn: function (data) {
		return '<input type="submit" value="' + L('Отмена') + '" class="hide js-upload_cancel hide' + 
			(Device.type == "desktop" ? ' url-btn font_medium right' : '') + '" /> ';
	},
	deleteBtn: function (data) {
		return '&nbsp;<span class="m ico ico_close js-upload_remove"></span>';
	},
	uploadWidget: function (data) {
		var html;
		if (data.mode == FileUploader.MODES.BUTTON) {
			html = 
				'<div id="upload_main_widget" class="stnd_padd light_border_bottom grey pointer">' +
					'<div class="stnd_padd break-word">' + 
						tpl.cancelBtn() + tpl.uploadBtn(data) + 
						'<span id="upload_main_file" class="hide"></span>' + 
					'</div>' +
					'<div id="upload_main_pb" class="hide"></div>' + 
				'</div>';
		} else {
			html = 
				'<div id="upload_main_widget">' +
					'<div class="break-word">' + 
						tpl.cancelBtn() + tpl.uploadBtn(data) + 
						'<span id="upload_main_file" class="hide"></span>' + 
					'</div>' +
					'<div id="upload_main_pb" class="hide pad_t_a"></div>' + 
				'</div>';
		}
		return html;
	},
	uploadBtn: function (data) {
		var unsupported = "";
		if (FilesUploader.maybeUnsupported())
			unsupported = '<div class="red">' + L('Скорее всего, ваше устройство не поддерживает выгрузку файлов.') + '</div>';
		
		if (!show_native_btn) {
			if (data.mode == FileUploader.MODES.WIDGET) {
				return unsupported + '<span id="upload_file_btn"><input type="submit" id="upload_file_label" value="' + L('Выберите файл') + '" /></span> ';
			} else {
				return '<div id="upload_file_btn" class="t_center">' + 
						'<img src="' + ICONS_BASEURL + 'icon_add_file.gif" alt="" class="m" /> ' + 
							'<small class="m" style="font-weight:bold;">' + L('Загрузить новый файл') + '</small>' + 
							unsupported + 
					'</div>';
			}
		} else {
			if (data.mode == FileUploader.MODES.WIDGET) {
				return '<div class="js-upload_btn_wrap"><span id="upload_file_btn"></span> ' + unsupported + '</div>';
			} else {
				return '<div class="t_center stnd_padd js-upload_btn_wrap"><span id="upload_file_btn"></span> ' + 
						'<input type="submit" value="OK" id="upload_submit_btn" />' + unsupported + '</div>';
			}
		}
	},
	spinner: function (full) {
		return '<img src="' + ICONS_BASEURL + 'roundPreloader.gif" alt="" class="m upload_spinner" /> ' + 
			(full ? L('Выгружаем...') : '');
	},
	uploadSuccess: function (data) {
		return '<b class="green"><span class="ico ico_ok_green"></span> ' + L('Файл успешно заргружен') + '</b>';
	},
	uploadError: function (data) {
		return '<span class="ico ico_alert_red"></span><small class="red break-word">' + data.message + '</small>';
	}
};

var params, state_params,
	MODES = {
		WIDGET: 0,
		BUTTON: 1
	},
	NS = '.spFilesUploader',
	upload_view, current_type,
	uploader,
	post_data = {},
	upload_button,
	files_uploaded = [],
	has_error = false,
	initialized = false,
	show_native_btn = FilesUploader.needNtiveControls();

var filters = {};
filters[Spaces.TYPES.FILE] = {
	name: L("Файлы"),
	thumb: ICONS_BASEURL + "default_file_preview.png?1",
	exts: [], accept: ''
};
filters[Spaces.TYPES.PICTURE] = {
	name: L("Фото"),
	exts: ['', 'gif','jpg','jpeg','png','bmp','webp'],
	thumb: ICONS_BASEURL + "pixel.png",
	thumb: ICONS_BASEURL + "default_file_preview.png?1",
	accept: 'image/*'
};
filters[Spaces.TYPES.MUSIC] = {
	name: L("Музыка"),
	exts: [
		// audio
		'', 'mp3','aac','wav','ogg','3ga','wma','flac','m4a','wave','amr','snd','au','aif','aiff','aifc',
		
		// video
		'avi','3gp','3gpp','mpg','mpe','mpeg','wmv','mp4','m4v','flv','mov','webm','asf','mkv','ogv',
		'ts', 'm2t', 'm2s', 'm4t', 'm4s', 'tmf', 'ts', 'tp', 'trp', 'ty', 'vob', 'm2ts', 'mts'
	],
	thumb: ICONS_BASEURL + "default_file_preview.png?1",
	accept: ''
};
filters[Spaces.TYPES.VIDEO] = {
	name: L("Видео"),
	exts: [
		'', 'avi','3gp','3gpp','mpg','mpe','mpeg','wmv','mp4','m4v','flv','mov','webm','asf','mkv','ogv',
		'ts', 'm2t', 'm2s', 'm4t', 'm4s', 'tmf', 'ts', 'tp', 'trp', 'ty', 'vob', 'm2ts', 'mts'
	],
	thumb: ICONS_BASEURL + "default_file_preview.png?1",
	accept: Device.browser.name != 'ucbrowser' ? 'video/*' : '' /* eval я ucweb, почему-то выбирает фото, вместо видео. */
};

if (Device.type == 'desktop')
	filters[Spaces.TYPES.VIDEO].accept = "." + filters[Spaces.TYPES.VIDEO].exts.join(",.")

var FileUploader = new (Class({
	MODES: MODES,
	Implements: [TSimpleEvents],
	init: function (args) {
		var self = this;
		self.reset();
		
		has_error = false;
		params = extend({
			type: Spaces.TYPES.FILE,
			selectButton: null,
			buttonClass: {},
			uploadWidget: null,
			uploadDrag: null,
			autoSubmit: false,
			noDragClass: false,
			mode: MODES.WIDGET
		}, args);
		
		for (var k in params) {
			if (k.indexOf('on') == 0) {
				var evt_name = k.replace(/^on/, '');
				evt_name = evt_name[0].toLowerCase() + evt_name.substr(1);
				self.on(evt_name, params[k]);
				delete params[k];
			}
		}
		
		$('#main').on('click' + NS, '.js-upload_cancel', function (e) {
			e.preventDefault();
			uploader.cancel();
		}).on('click' + NS, '.js-upload_remove', function (e) {
			e.preventDefault();
			var id = $(this).data('id'),
				type = $(this).data('type');
			if (id !== undefined) {
				uploader.remove(id);
				self.removeTmpFile(id);
			} else
				uploader.reset();
		});
		
		uploader = new FilesUploader();
		uploader.setup({
			autoSubmit: params.autoSubmit
		});
		
		var reset_state = function (is_reset) {
			if (show_native_btn) {
				upload_view.button.show();
				upload_view.file.empty();
				upload_view.fallback_btn_wrap.show();
			} else {
				upload_view.label.val(L("Выберите файл"));
				if (!params.multiple) {
					upload_view.file.html(tpl.fileItemInline({
						empty: true
					})).show();
				}
			}
			
			upload_view.pb.hide();
			upload_view.cancel.hide();
			upload_view.button.show();
			self._trigger('reset', [!!is_reset]);
			
			uploader.updateButton();
			
			window.onbeforeunload = null;
		};
		
		var set_progress = function (file, pct) {
			current_progress[0].style.width = pct + '%';
			if (current_progress_pct[0])
				current_progress_pct[0].innerHTML = Math.round(pct) + '%';
			if (!show_native_btn)
				upload_view.label.val(L('Выгружаем... {0}%', Math.round(pct)));
		};
		
		var current_progress,
			current_progress_pct,
			current_progress_wrap;
		uploader
			.on('progress', function (file, pct, loaded, total) {
				set_progress(file, pct);
			}).on('reset', function () {
				if (params.multiple) {
					
				} else {
					reset_state(true);
				}
			}).on('cancel', function () {
				if (params.multiple) {
					
				} else {
					reset_state(true);
				}
			}).on('remove', function (file) {
				if (params.multiple)
					self.removeTmpFile(file.id);
			}).on('input', function (input) {
				if (show_native_btn) {
					upload_button.empty();
					upload_button.append(input);
				}
			})
			.on('limitError', function () {
				self.error(L('Невозможно добавить файл, вы выбрали максимальное количество файлов. '));
			})
			.on('filesChunkStart', function () {
				self._trigger('filesChunkStart', []);
			})
			.on('filesChunkEnd', function () {
				self._trigger('filesChunkEnd', []);
			})
			.on('getTotal', function () {
				return self._trigger('getTotal', arguments);
			})
			.on('afterAutoSubmit', function () {
				self._trigger('afterAutoSubmit', []);
			})
			.on('file', function (file) {
				if (state_params.denyUpload && $.inArray(file.ext, state_params.denyUpload.exts) >= 0) {
					if (params.multiple) {
						self.addFile(file);
						self.setFileError(file.id, state_params.denyUpload.error);
						return false;
					} else
						self.error(state_params.denyUpload.error);
					return false;
				}
				
				self.error(false);
				if (params.multiple) {
					return self.addFile(file);
				} else {
					upload_view.file
						.html(tpl.fileItemInline(extend({}, file, {deleteBtn: show_native_btn})))
						.show();
					if (show_native_btn) {
						upload_view.button.hide();
						upload_view.fallback_btn_wrap.hide();
					}
					
					if (state_params.mode == MODES.BUTTON)
						upload_view.button.hide();
				}
				return true;
			})
			.on('preview', function (file, url) {
				$('#upload_thumb_' + file.id).prop("src", url);
			})
			.on('submit', function (file) {
				if (!self._trigger('submit', [file]))
					return false;
				
				self.error(false);
				
				// Добавляем прогрессбар
				current_progress_wrap = $(params.multiple ? 
					'#upload_pb_wrap_' + file.id : '#upload_main_pb');
				current_progress_wrap.html(tpl.fileProgress({
					id: file.id
				})).show();
				
				var upload_file = $('#upload_file_' + file.id);
				upload_file.find('.js-upload_pb_ui').removeClass('hide');
				upload_file.find('.js-upload_no_pb_ui').addClass('hide');
				
				if (params.multiple) {
				//	$('#upload_additional_' + file.id).hide();
				//	$('#upload_spinner_' + file.id).html(tpl.spinner(true)).show();
				} else {
					upload_view.cancel.show();
					if (Device.type != 'desktop')
						upload_view.button.hide();
					upload_view.label.val(L('Выгружаем...'));
					upload_view.file.find('img')
						.replaceWith(tpl.spinner());
					
					if (show_native_btn)
						upload_view.wrap.find('.js-upload_remove').hide();
				}
				
				current_progress = $('#upload_pb_' + file.id);
				current_progress_pct = $('#upload_pb_pct_' + file.id);
				
				post_data.json = 1;
				post_data.sid = Spaces.sid();
				
				set_progress(file, 0);
				
				this.setFileParams(file.id, {
					postData: post_data
				});
			})
			.on('uploadStart', function () {
				files_uploaded = [];
			//	$.each(uploader.getFiles(), function () {
			//		$('#upload_additional_' + this.id).remove();
			//	});
				self._trigger('uploadStart');
				
				window.onbeforeunload = () => {
					return L("Вы уверены, что хотите прервать загрузку файла и перейти на другую страницу?");
				};
			})
			.on('complete', function () {
				reset_state();
				self._trigger('uploadComplete');
			//	for (var i = 0; i < files_uploaded.length; ++i)
			//		self._trigger('fileUpload', [files_uploaded[i]]);
			})
			.on('uploaded', function (file, res) {
				current_progress.removeClass(classes.pbar.light);
				current_progress_pct.addClass(classes.pbar.pctDone);
				
				// $('#upload_pb_wrap_' + file.id).hide();
				// $('#upload_spinner_' + file.id).hide();
				
				if (res.redirect && !res.data) {
					uploader.cancel();
					uploader.on('complete', function () {
						Spaces.redirect(res.redirect);
					});
				} else if (res.redirect_link && !res.data && params.multiple) {
					var message = L('Файл заблокирован. <a href="{0}">Узнать подробности</a>', res.redirect_link);
					if (params.multiple)
						self.setFileError(file.id, message);
					else
						self.error(message);
				} else if (res.code != 0) {
					var message = Spaces.services.processingCodes(res);
					if (params.multiple)
						self.setFileError(file.id, message);
					else
						self.error(message);
				} else if (!res.data && !res.redirect_link) {
					var message = L('Странная ошибка! Напишите в <a href="/soo/support">Support</a>.');
					if (params.multiple)
						self.setFileError(file.id, message);
					else
						self.error(message);
				} else {
					$('#upload_success_' + file.id).show();
					
					if (params.removeAfterUpload)
						self.removeTmpFile(file.id);
					if (res.data) {
						Spaces.core.fixFile(res.data, file.extra.spacesType, true);
						
						if (res.redirect_link && params.multiple) {
							$('#upload_file_info_' + file.id).replaceWith(tpl.fileItemInline({
								id: file.id,
								name: res.data.name,
								ext: res.data.fileext
							}));
							
							var name = $('#upload_file_info_' + file.id);
							name.replaceWith($('<a>').prop("href", res.redirect_link).html(name.html()));
						}
						
						// Обновляем тумбу и оборачиваем её в ссылку
						var thumb = $('#upload_thumb_' + file.id);
						if (res.data.preview && res.data.preview.previewURL)
							thumb.prop("src", res.data.preview.previewURL);
						thumb.wrap($('<a>', {href: res.redirect_link}));
						
						// Обновляем имя файла в поле
						var fn = $('#upload_name_input_' + file.id);
						if (fn.length && !fn.val().length) {
							fn.val(res.data.filename).removeAttr("disabled").removeAttr("readonly");
							fn.parent().find('.js-file_ext').text(res.data.fileext);
							self._fixInputWidth(fn);
						}
						
						var upload_file = $('#upload_file_' + file.id);
						upload_file.find('.js-upload_remove').addClass('hide');
						upload_file.find('.js-upload_done').removeClass('hide');
					}
					
					set_progress(file, 100);
					self._trigger('fileUpload', [res, file])
				}
			})
			.on('extError', function (file) {
				var error = L("Неподдерживаемый тип файла ({0}).", html_wrap(file.ext));
				if (params.multiple)
					self.addFileWithError(file, error);
				else
					self.error(error);
			})
			.on('sizeError', function (file) {
				var error = L("Максимальный размер файла <b>{0}</b>", Spaces.getHumanSize(state_params.maxSize));
				if (params.multiple)
					self.addFileWithError(file, error);
				else
					self.error(error);
			})
			.on('notSelectedError', function () {
				self.error(params.maxFiles > 1 ? L("Файл не выбран!") : L("Файлы не выбраны!"));
			})
			.on('error', function (file, code, message, response) {
				var errmsg = message ? message : L("Неизвестная ошибка #{0}", code);
				if (params.multiple)
					self.setFileError(file.id, errmsg);
				else
					self.error(errmsg);
				console.error("[upload error]", file, code, message, response);
			})
			.on('dragStart', function () {
				self._trigger('dragStart');
			})
			.on('dragDrop', function () {
				self._trigger('dragDrop');
			})
			.on('dragEnd', function () {
				self._trigger('dragEnd');
			})
			.on('dragGlobalStart', function () {
				self._trigger('dragGlobalStart');
			})
			.on('dragGlobalEnd', function () {
				self._trigger('dragGlobalEnd');
			});
		// reset_state();
		
		page_loader.on('beforerequest', 'files_uploader', function (params) {
			if (uploader.inUpload()) {
				if (confirm(L("Вы уверены, что хотите прервать загрузку файла и перейти на другую страницу?"))) {
					uploader.cancel();
					return true;
				}
				return false;
			}
		});
		initialized = true;
	},
	setup: function (args) {
		var self = this, upload_widget;
		
		if (!uploader)
			throw "Run init() before!";
		
		current_type = args.type || Spaces.TYPES.PICTURE
		
		state_params = $.extend({
			maxSize: false,
			maxFiles: 1,
			type: Spaces.TYPES.FILE,
			action: null,
			denyUpload: null,
			name: "myFile",
			inlineFileWidget: false,
			selectButton: null,
			uploadDrag: null,
			uploadWidget: null,
			noDragClass: false,
			buttonClass: {},
			mode: MODES.BUTTON
		}, args);
		
		if (upload_view && upload_view.widget)
			upload_view.widget.remove();
		
		// Кнопка выбора файла
		$(state_params.uploadWidget)
			.replaceWith(upload_widget = $(tpl.uploadWidget({mode: state_params.mode})));
		
		upload_view = {
			widget: upload_widget,
			wrap: $('#upload_main_widget'),
			file: $('#upload_main_file'),
			button: $('#upload_file_btn'),
			cancel:  upload_widget.find('.js-upload_cancel'),
			pb: $('#upload_main_pb'),
			label: $('#upload_file_label'),
			fallback_btn_wrap: upload_widget.find('.js-upload_btn_wrap')
		};
		
		// Кнопка начала выбора файла
		if (state_params.selectButton) {
			upload_button = $(state_params.selectButton);
			if (show_native_btn) {
				upload_button.click(function (e) {
					e.preventDefault(); e.stopPropagation();
					self._trigger('showNative');
				});
				upload_button = $('#upload_file_btn');
			}
		} else {
			upload_button = $('#upload_file_btn');
		}
		$('#upload_submit_btn').click(function (e) {
			e.preventDefault();
			tick(function () {
				uploader.submit();
			});
		});
		
		var action_url = new Url(state_params.action);
		action_url.query.json = 1;
		if (!FilesUploader.isAjaxSupport())
			action_url.query.xhr_iframe = 1;
		
		var max_size = state_params.maxSize;
		uploader.set({
			action: action_url.url(),
			name: state_params.name,
			maxSize: max_size ? max_size + 2 * 1024 * 1024 : 0,
			maxFiles: state_params.maxFiles,
			postData: {json: 1},
			accept: filters[current_type].accept,
			allowedExtensions: filters[current_type].exts,
			extra: {
				spacesType: state_params.type
			}
		});
		uploader.clearButton();
		if (!show_native_btn)
			uploader.setButton(upload_button, state_params.buttonClass);
		
		// Место для Drag'n'Drop
		uploader.resetDragPlaces().resetPastePlaces();
		if (state_params.uploadDrag) {
			var upload_drag_place = $(state_params.uploadDrag);
			if (!state_params.noDragClass) {
				upload_drag_place.data('dragover-class', 'dropable-selected');
				upload_drag_place.data('dragavail-class', 'dropable');
			}
			upload_drag_place.filesMonitor().on('files', function (e, data) {
				e.stopPropagation();
				e.stopImmediatePropagation();
				
				uploader.addFiles(data.files);
			}).on('pasteurl', function (e, data) {
			//	self.loadUrls(data.urls);
			});
		}
		
		if (state_params.firstReset)
			uploader.reset();
	},
	addFiles: function (files) {
		uploader.addFiles(files);
	},
	loadUrls: function (links) {
		console.log(links);
	},
	reset: function () {
		var self = this;
		
		if (uploader)
			uploader.destroy();
		
		self.off(false);
		$('#main').on(NS);
		$('body').off(NS);
		
		if (upload_view)
			upload_view.widget.remove();
		
		upload_button = upload_view = null;
		files_uploaded = [];
		has_error = false;
		initialized = false;
		return self;
	},
	destroy: function () {
		var self = this;
		self.reset();
		uploader = state_params = null;
	},
	initialized: function () {
		return initialized;
	},
	setPostData: function (data) {
		var self = this;
		post_data = $.extend({}, data);
		return self;
	},
	addFile: function (file, error) {
		var self = this;
		
		var widget = $(tpl.fileItem($.extend({
			type: state_params.type
		}, file, {
			noWrap:				state_params.inlineFileWidget,
			additionalMenu:		state_params.additionalMenu
		})));
		
		if (state_params.filenameAutocomplete) {
			let ext_len = (file.ext.length ? file.ext.length + 1 : 0);
			let name = file.name.substr(0, file.name.length - ext_len);
			let input = widget.find('[name=fn]');
			input.val(name);
		}
		
		widget.find('.js-text_input_fn .js-input_suffix').text("." + (file.ext || 'ext')).attr("title", "." + (file.ext || 'ext'));
		
		var file_evt = {
			file: file,
			error: !!error,
			widget: widget
		};
		
		var ret = self._trigger('newFileAdd', [file_evt]);
		tick(function () {
			self._fixInputWidth($('#upload_name_input_' + file.id));
		});
		return ret;
	},
	_fixInputWidth: function (input) {
		var parent = input.parent('.text-input__wrap'),
			label = parent.find('.text-input__control-group'),
			parent_padd = Math.min(parent.width() * 0.5, label.width() + 20);
		parent.css({'padding-right': parent_padd + 'px'});
		input.css({'padding-right': (parent_padd - 11) + 'px'});
		label.find('.js-file_ext').css({'max-width': (parent_padd - 11) + "px"});
	},
	addFileWithError: function (file, message) {
		var self = this;
		file.error = true;
		if (self.addFile(file, true)) {
			self.setFileError(file.id, message);
			return true;
		}
		return false;
	},
	setFileError: function (id, message) {
		var self = this;
		$('#upload_err_' + id).html(tpl.uploadError({
			message: message
		})).show();
		$('#upload_pb_wrap_' + id + ', #upload_additional_' + id + 
			', #upload_spinner_' + id + ', #upload_pb_pct_' + id).hide();
		
		self._trigger('fileError', [id, message]);
		
		var upload_file = $('#upload_file_' + id);
		upload_file.find('.js-upload_pb_ui').addClass('hide');
		upload_file.find('.js-upload_no_pb_ui').removeClass('hide');
		upload_file.addClass('js-upload_has_error');
		
		return self;
	},
	showFileSpinner: function (id, flag) {
		var self = this;
		var input = $('#upload_name_input_' + id),
			ext = input.parent().find('.js-file_ext'),
			spinner = input.parent().find('.js-file_spinner');
		
		ext.toggle(!flag);
		spinner.toggle(!!flag);
		
		self._fixInputWidth(input);
	},
	removeTmpFile: function (id) {
		var self = this,
			file = $('#upload_file_' + id);
		if (file.length) {
			file.remove();
			self._trigger('removeFile', [{id: id}]);
		}
	},
	error: function (error) {
		var self = this;
		if (error) {
			has_error = true;
			self._trigger('error', [error]);
		} else {
			has_error = false;
			self._trigger('hideError');
		}
		return self;
	},
	submit: function () {
		var self = this;
		if (uploader)
			uploader.submit();
		return self;
	},
	getUploader: function () {
		return uploader;
	}
}));

export default FileUploader;
