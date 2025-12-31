import $ from '../jquery';
import Device from '../device';
import SpacesApp from '../android/api';
import {Spaces, Url} from '../spacesLib';
import {ce, extend, tick, L} from '../utils';

/*
	events
		file         (filename, fileext, filesize)
		extEeror     (filename, fileext, filesize)
		sizeError    (filename, fileext, filesize)
		limitError   ()
		submit       (file)
		progress     (file, pct, loaded, total)
		complete     ()
		uploaded     (file, res)
		error        (file, code, message, response)
		cancel       (file)
		input        (input)
		uploadStart  ()
		notSelectedError ()
		dragStart    ()
		dragDrop     ()
		dragEnd      ()
		dragGlobalStart ()
		dragGlobalEnd   ()
*/

var native_upload_progress = false;

var FilesUploader = function (params) {
	var self = this;
	self.events = {};
	self.ajax = FilesUploader.isAjaxSupport();
};
$.extend(FilesUploader, {
	isAjaxApiSupport: function () {
		return true;
	},
	isAjaxSupport: function () {
		return FilesUploader.isAjaxApiSupport() || FilesUploader.inAppUpload();
	},
	needNtiveControls: function () {
		return false;
	},
	inAppUpload: function () {
//		if (Device.android_app && !FilesUploader.isAjaxApiSupport())
//			return true;
		return Device.android_app && navigator.userAgent.toLowerCase().indexOf('android 4.4') >= 0;
	},
	maybeUnsupported: function () {
		// На этом телефоне скорее всего не будет работать загрузка файлов
		return false;
	},
	needStaticUpload: function () {
		// На ucweb под WP шлётся нулевой файл, если его слать из iframe или через AJAX
		return false;
	}
});
$.extend(FilesUploader.prototype, {
	setup: function (params) {
		var self = this;
		self.destroy();
		self.params = $.extend(true, {
			autoSubmit: false,
			buttonClass: {
				hover: '',
				focus: '',
				active: ''
			},
			extra: null,
			dragPlace: null,
			postData: {},
			action: {},
			name: "file",
			multiple: false,
			maxFiles: 1,
			responseType: "json",

			allowedExtensions: [],
			notAllowedExtensions: []
		}, params);
		self._init();

		return self;
	},
	resetDragPlaces: function () {
		var self = this;
		if (self._dragndrop_places) {
			for (var i = 0; i < self._dragndrop_places.length; ++i)
				$(self._dragndrop_places[i]).off('.SpFilesUploader');
		}
		return self;
	},
	resetPastePlaces: function () {
		var self = this;
		if (self._paste_btns) {
			for (var i = 0; i < self._paste_btns.length; ++i)
				$(self._paste_btns[i]).off('.SpFilesUploader');
		}
		return self;
	},
	destroy: function () {
		var self = this;

		$([window, document.body]).off('.SpFilesUploader');
		self.resetDragPlaces().resetPastePlaces();

		if (self.input_wrap)
			self.input_wrap.remove();
		if (self.input)
			$(self.input).remove();

		self.files = [];
		self._in_upload = false;
		self._paste_btns = [];
		self._dragndrop_places = [];
		self.cur_file_id = null;
		self.input = self.input_wrap = null;
	},
	set: function (args) {
		var self = this;
		$.extend(self.params, args);
		self._createInput();
		return self;
	},
	setButton: function (btn, buttonClass) {
		var self = this;

		self.clearButton();
		self.params.buttonClass = $.extend({
			hover: '',
			focus: '',
			active: ''
		}, buttonClass);
		self.button = ((btn instanceof $) ? btn : $(btn)).first();
		self.button.on('mouseover.SpFilesUploader touchmove.SpFilesUploader', function () {
			self.updateButton();
		});
		self.button.css({position: 'relative'}).append(self.input_wrap);
		if (self.button.css("display") == "inline")
			self.button.css("display", "inline-block");
		self._createInput();
		return self;
	},
	clearButton: function () {
		var self = this;
		if (self.button) {
			self.button.off('.SpFilesUploader');
			self.button = null;
		}
		return self;
	},

	_init: function () {
		var self = this;

		self.input_wrap = $('<div>').css({
			display : 'block',
			position : 'absolute',
			overflow : 'hidden',
			margin : 0,
			padding : 0,
			opacity : 0,
			cursor: 'pointer',
			visibility: 'visible',
			direction : 'ltr',
			zIndex: 2147483583,
			filter: 'alpha(opacity=0)'
		}).prop("ajax_upload_button", true);

		self.input_wrap.on('mousedown touchstart', function () {
			if (self.button) {
				self.button.addClass(self.params.buttonClass.active);
				$(window).one('mouseup', function () {
					self.button.removeClass(self.params.buttonClass.active);
				});
			}
		});
		self.input_wrap.on('touchend touchcancel', function () {
			if (self.button)
				self.button.removeClass(self.params.buttonClass.active);
		});
		self.input_wrap.on('mouseover', function () {
			if (self.button)
				self.button.addClass(self.params.buttonClass.hover);
		});
		self.input_wrap.on('mouseout', function () {
			if (self.button) {
				self.button.removeClass(self.params.buttonClass.hover);
				self.button.removeClass(self.params.buttonClass.focus);
			}
		});
		self.input_wrap.on('focus', function () {
			if (self.button)
				self.button.addClass(self.params.buttonClass.focus);
		});
		self.input_wrap.on('blur', function () {
			if (self.button)
				self.button.removeClass(self.params.buttonClass.focus);
		});

		self.on('uploadStart', function () {
			if (self.params.maxFiles == 1 || !self.params.autoSubmit)
				self.input_wrap.hide();
			else
				self.updateButton();
		});
		self.on('complete', function () {
			if (self.params.maxFiles == 1 || !self.params.autoSubmit)
				self.input_wrap.show();
			self.updateButton();
		});

		// Загрузка на KitKat
		if (FilesUploader.inAppUpload()) {
			SpacesApp.on('file', function (file_name, file_size, file_thumb) {
				if (self.input && file_name) {
					self._createInput();
					self.addFiles([{
						filename:	file_name,
						name:		file_name,
						size:		file_size
					}]);
				}
			}).on('preview', function (file_name, thumb) {
				for (var i = 0; i < self.files.length; ++i) {
					var file = self.files[i];
					if (file.file.filename == file_name) {
						self._trigger('preview', [file, 'data:image/jpeg;base64,' + thumb]);
						break;
					}
				}
			});
		}

		// self._dragDropMonitor();
		// self._createInput();
	},
	_createInput: function () {
		var self = this;

		delete self.input;
		var input = ce('input', {
			type: 'file',
			name: self.params.name
		});

		var safari = Object.prototype.toString.call(window.HTMLElement).indexOf('Constructor') > 0;
		if (self.params.maxFiles > 1 && FilesUploader.isAjaxSupport() && !safari)
			input.multiple = true;

		input.ajax_upload_button = true;
		if (self.params.accept)
			input.accept = self.params.accept;

		input.onclick = function () {
			var not_avail = (self.params.maxFiles > 1 && self.getTotalFiles() >= self.params.maxFiles);
			if (not_avail || !self._trigger('checkLimit')) {
				self._trigger('limitError');
				return false;
			}

			if (FilesUploader.inAppUpload()) {
				SpacesApp.exec('selectFile', {multiple: input.multiple});
				return false;
			}
		};
		input.onchange = function () {
			if (this.value == '' && !this.files.length)
				return;
			self._createInput();

			this.onchange = null;
			if (self.ajax) {
				self.addFiles(this.files);
			} else {
				self.addFiles([this]);
			}
		};
		self.input = input;

		if (self.button) {
			self.input_wrap.empty();
			self.input_wrap.append(input);
			self.updateButton();

			extend(input.style, {
				'position' : 'absolute',
				'right' : 0,
				'margin' : 0,
				'padding' : 0,
				'fontFamily' : 'sans-serif',
				'cursor' : 'pointer'
			});
			input.style.cssText += ';font-size: 480px !important;';
		}
		setTimeout(function () { self._trigger('input', [input]); }, 0);
	},
	updateButton: function () {
		var self = this;
		if (self.button) {
			var w = self.button.outerWidth() + "px", h = self.button.outerHeight() + "px";
			extend(self.input.style, {
				width: w,
				height: h,
				fontSize: '360px'
			});
			self.input_wrap.css({
				width: w,
				height: h
			})
			.css({left: 0, top: 0});
		}
	},
	progressAvail: function () {
		return this.ajax;
	},
	inUpload: function () {
		return this._in_upload;
	},
	getInput: function () {
		return this.input;
	},
	getFiles: function () {
		return this.files;
	},
	getExt: function (filename) {
		var parts = filename.match(/\.([~\w\d_-]{1,16})$/i);
		return (parts && parts[1]) || "";
	},
	setPostData: function (post) {
		this.params.postData = post;
		return this;
	},
	addFiles: function (files, name_prefix) {
		var self = this;
		if (self._in_upload && self.params.maxFiles == 1)
			return;

		var mime2ext = {
			"image/pjpeg": "jpg",
			"image/jpeg": "jpg",
			"image/jpg": "jpg",
			"image/gif": "gif",
			"image/png": "png",
			"audio/mp3": "mp3"
		};

		if (self.params.maxFiles == 1) {
			// Если не нужна мультизагрузка - очистим прошлый файл
			self.files = [];
		}

		self._trigger('filesChunkStart');

		name_prefix = name_prefix || 'upload_';
		for (var i = 0; i < files.length; ++i) {
			var file = files[i];
			if (self.params.maxFiles <= self.getTotalFiles()) {
				self._trigger('limitError');
				break;
			}

			if (self.ajax && !FilesUploader.inAppUpload()) {
				if (!(file instanceof File) || !file.name) {
					var ext = mime2ext[file.type];
					if (!ext)
						continue;
					file.name = file.filemame = self._genFileName(name_prefix) + "." + ext;
				}
			}

			var filename = $.trim(self._getFilename(self.ajax ? file.name : file.value)),
				fileext = self.getExt(filename),
				filesize = self.ajax ? file.size : undefined;

			var id = Date.now() + '_' + i,
				file_struct = {id: id, file: file, name: filename, ext: fileext, size: filesize,
					postData: self.params.postData, action: self.params.action, formName: self.params.name};

			if (self.params.maxSize && filesize !== undefined && filesize !== null) {
				if (self.params.maxSize < filesize) {
					self._trigger('sizeError', [file_struct]);
					continue;
				}
			}

			if (filename) {
				if (self.params.allowedExtensions.length) {
					if (!self._checkExt(fileext, self.params.allowedExtensions)) {
						self._trigger('extError', [file_struct]);
						continue;
					}
				}
				if (self.params.notAllowedExtensions.length) {
					if (self._checkExt(fileext, self.params.notAllowedExtensions)) {
						self._trigger('extError', [file_struct]);
						continue;
					}
				}
			}

			file_struct.extra = self.params.extra;

			if (self._trigger('file', [file_struct])) {
				self.files.push(file_struct);

				// Получаем адрес файла для превьюшки
				if (self.needMakePreview(file_struct)) {
					if (FilesUploader.inAppUpload()) {
						SpacesApp.exec('getPreview', {
							file: file_struct.file.filename
						});
					} else if (self.ajax) {
						(function (file_struct) {
							tick(function () {
								var url = self.createObjectURL(file_struct.file);
								if (url)
									self._trigger('preview', [file_struct, url]);
							});
						})(file_struct);
					}
				}
			}
		}
		self._trigger('filesChunkEnd');

		if (self.params.autoSubmit && self.files.length) {
			self.submit();
			self._trigger('afterAutoSubmit');
		}
	},
	needMakePreview: function (file) {
		return file.size <= 10 * 1024 * 1024 && /^(gif|jpg|jpeg|png|bmp|webp)$/i.test(file.ext);
	},
	createObjectURL: function (file) {
		var url = !window.URL || !window.URL.createObjectURL ? window.webkitURL : window.URL;
		if (url && url.createObjectURL)
			return url.createObjectURL(file);
		return null;
	},
	submit: function () {
		var self = this, next_file = function () {
			if (self.files.length > 0 && (!self._current_file || !self._current_file.abort)) {
				self._in_upload = true;
				self._current_file = self.files[0];
				self._submit(function () {
					if (self._current_file == self.files[0])
						self.files.shift();
					next_file();
				});
			} else {
				self._current_file = null;
				self._in_upload = false;
				self._trigger('complete');
				self.files = [];
			}
		};
		if (self._in_upload)
			return this;

		if (!self.ajax && !self.files.length > 0) { // КОСТЫЛЬ для недобраузеров
			self.addFiles([self.input]);
			self._createInput();
		}

		if (self.files.length > 0) {
			self._trigger('uploadStart');
			next_file();
		} else
			self._trigger('notSelectedError');
		return this;
	},
	reset: function () {
		var self = this;
		if (!self._in_upload) {
			self._trigger('reset');
			self.files = [];
		}
		return this;
	},
	_submit: function (callback) {
		var self = this, file = self._current_file;

		if (!self._trigger('submit', [file])) {
			setTimeout(callback, 0);
			return;
		}

		var form_action = new Url(file.action),
			file_id = self._getUID();

		if (FilesUploader.inAppUpload()) {
			file._request = true;

			SpacesApp.on('uploadProgress', function (offset, size) {
				self._trigger('progress', [file, (offset / size) * 100, offset, size]);
			}).on('uploadSuccess', function (res) {
				self._onDone(file, res);
				setTimeout(callback, 0);
			}).on('uploadError', function (status) {
				self._trigger('error', [file, status, Spaces.getHttpError(status), '']);
				setTimeout(callback, 0);
			});

			SpacesApp.exec('upload', {
				action:	form_action.url(),
				name:	file.formName.replace('%d', file.id),
				file:	file.file.filename,
				params:	file.postData || {}
			});
		} else if (self.ajax) {
			// Создаём FormData из файлов
			var form_data = new FormData(),
				post = file.postData;
			for (var k in post) {
				if (post[k] instanceof Array) {
					for (var i = 0; i < post[k].length; ++i)
						form_data.append(k, post[k][i]);
				} else {
					form_data.append(k, post[k]);
				}
			}
			form_data.append(file.formName.replace('%d', file.id), file.file, file.name);

			var xhr = self._xhr();
			xhr.onreadystatechange = function () {
				try {
					if (xhr.readyState == 4) {
						if (!xhr.__is_abort) {
							file._request = null;
							xhr.onreadystatechange = function() { };

							var status = 0, statusText = '';
							try { status = xhr.status; } catch (e) { }
							try { statusText = xhr.statusText; } catch (e) { }

							if (status >= 200 && status < 300) {
								self._onDone(file, xhr.responseText);
							} else {
								self._trigger('error', [file, status, Spaces.getHttpError(status), xhr.responseText]);
							}
						}
						setTimeout(callback, 0);
					}
				} catch (e) {
					self._trigger('error', [file, -1, e.stack || e.message]);
					setTimeout(callback, 0);
				}
			};

			xhr.open("POST", form_action.url(), true);

			try { xhr.withCredentials = false; } catch (e) {  }

			if ('onprogress' in xhr) {
				xhr.upload.onloadstart = function (e) {
					self._trigger('progress', [file, 0]);
				};
				xhr.upload.onprogress = function (e) {
					if (e.lengthComputable) {
						var pct = (e.loaded / e.total) * 100;
						self._trigger('progress', [file, pct, e.loaded, e.total]);
					}
					if (!native_upload_progress) {
						native_upload_progress = true;
					}
				};
			}
			xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
			xhr.send(form_data);

			file._request = xhr;
		} else {
			// Создаём iframe
			var iframe,
				request_loaded = false;
			if (navigator.userAgent.indexOf('MSIE 7') > -1) {
				iframe = document.createElement('<iframe src="javascript:false;" name="' + file_id + '">');
			} else {
				iframe = document.createElement('iframe');
				iframe.src = 'javascript:false;';
				iframe.name = file_id;
			}
			iframe.style.display = 'none';
			iframe.id = file_id;
			document.body.appendChild(iframe);

			var _frame_cleanup = function () {
				delete file._request;
				$(iframe).remove(); iframe = null;
				$(window).off('.' + file_id);
			};
			/*
			iframe.onerror = function (e) {
				self._trigger('error', [file, 0, L("Ошибка подключения. Проверьте ваше подключение к интернету. ")]);
				_frame_cleanup();
			};*/
			iframe.onload = function (e) {
				if (e === false) {
					setTimeout(callback, 0);
					return;
				}

				if (!file._request)
					return;
				delete file._request;

				setTimeout(function () {
					if (!request_loaded) {
						self._trigger('error', [file, -1, L("Сервер ответил неожиданным ответом. (iframe)")]);
						setTimeout(callback, 0);
						_frame_cleanup();
					}
				}, 800);
			};

			// Создаём форму
			var form_action_url = form_action.url(),
				form = self._getForm(file_id, form_action_url, file.postData);
			form.appendChild(file.file);
			document.body.appendChild(form);

			$(window).on('message.' + file_id, function (e) {
				delete file._request;

				var evt = e.originalEvent;
				try {
					if (form_action_url.indexOf(evt.origin) != 0) {
						console.log("[uploader] non matched origin: ", form_action_url, e.originalEvent.origin);
						return;
					}
					request_loaded = true;
					self._onDone(file, evt.data);
				} catch (e) {
					self._trigger('error', [file, -1, e.stack || e.message, evt.data]);
				}
				setTimeout(callback, 0);
				_frame_cleanup();
			});

			file._request = iframe;

			form.submit();
			$(form).remove();
			form = null;
		}
	},

	getFileIndex: function (file_id) {
		var self = this;
		for (var i = 0; i < self.files.length; ++i) {
			var file = self.files[i];
			if (file.id == file_id)
				return i;
		}
		return -1;
	},

	isInUpload: function () {
		var self = this;
		return self._in_upload;
	},

	total: function () {
		var self = this;
		return self.files.length;
	},

	// Задать action и post для конкретного файла
	setFileParams: function (file_id, params) {
		var self = this,
			index = self.getFileIndex(file_id);
		if (index > -1) {
			var allow = ['action', 'name', 'postData'],
				file = self.files[index];
			for (var i in allow) {
				var k = allow[i];
				if (params[k] !== undefined)
					file[k] = params[k];
			}
		}
		return self;
	},

	// Удаление файла из очереди
	remove: function (file_id) {
		var self = this;
		return self.removeByIndex(self.getFileIndex(file_id));
	},
	removeByIndex: function (index) {
		var self = this;
		if (index > -1) {
			self.cancel(index);
			self._trigger('remove', [self.files[index]]);
			self.files.splice(index, 1);
		}
		return self;
	},

	// Получить реальное кол-во файлов
	getTotalFiles: function () {
		var self = this,
			ref = {total: self.files.length};
		if (self.params.maxFiles == 1)
			return 0;
		self._trigger('getTotal', [ref]);
		return ref.total;
	},

	// Отмена загрузки конкретного файла
	cancel: function (file_id) {
		var self = this;
		if (typeof file_id == "number") {
			var file = self.files[file_id];
			if (file && file._request) {
				if (FilesUploader.inAppUpload()) {
					SpacesApp.exec('cancelUpload');
				} else if (self.ajax) {
					file._request.__is_abort = true;
					file._request.abort();
				} else {
					var iframe = file._request;
					iframe.onload(false);
					iframe.onload = null;

					try { iframe.stop(); } catch (e) { }
					try { iframe.execCommand('stop'); } catch (e) { }
					try { iframe.contentWindow.document.execCommand('stop'); } catch (e) { }
					iframe.src = 'javascript:false;';
				}
				delete file._request;
				self._trigger('cancel', [file]);
			}
		} else {
			if (self._current_file) {
				self._current_file.abort = true;
				while (self.files.length)
					self.removeByIndex(0);
			}
		}
		return self;
	},
	_getForm: function (target, action, data) { // TODO: вынести в либу
		var form = document.createElement('form');
		form.action = action;
		form.method = "POST";
		form.target = target;
		form.name = this._getUID();
		form.style.display = "none";
		form.encoding = "multipart/form-data";
        form.enctype = "multipart/form-data";

		for (var k in data) {
			if (data[k] instanceof Array) {
				for (var i = 0; i < data[k].length; ++i) {
					var input = document.createElement('input');
					input.type = "hidden";
					input.name = k; input.value = data[k][i];
					form.appendChild(input);
				}
			} else {
				var input = document.createElement('input');
				input.type = "hidden";
				input.name = k; input.value = data[k];
				form.appendChild(input);
			}
		}
		return form;
	},
	_onDone: function (file, res) {
		var self = this;
		try {
			if (self.params.responseType == "json" && (typeof res) == 'string')
				res = $.parseJSON(res);
		} catch (e) {
			res = null;
		}

		if (res) {
			self._trigger('uploaded', [file, res]);
			return;
		}

		self._trigger('error', [file, -1, L("Сервер ответил неожиданным результатом.")]);
	},
	// TODO: вынести костылеивенты в интерфейс
	on: function (event, callback) {
		if (!this.events[event])
			this.events[event] = [];
		this.events[event].push(callback);
		return this;
	},
	_trigger: function (event, values) {
		// console.log("["+event+"]", values);

		var val = true;
		if (this.events[event]) {
			for (var i = 0; i < this.events[event].length; ++i) {
				var func = this.events[event][i];
				if (func && (func.apply(this, values || []) === false)) {
					val = false;
					break;
				}
			}
		}
		return val;
	},
	_xhr: function () {
		var xhr;
		if (typeof XMLHttpRequest !== 'undefined') {
			xhr = new window.XMLHttpRequest();
		} else if (window.ActiveXObject) {
			try {
				xhr = new window.ActiveXObject('Microsoft.XMLHTTP');
			} catch (e) {
				return false;
			}
		}
		return xhr;
	},
	_checkExt: function (ext, extensions) {
		for (var i = 0; i < extensions.length; ++i) {
			if (extensions[i].toLowerCase() === ext.toLowerCase())
				return true;
		}
		return false;
	},
	_getUID: function() { // TODO: вынести в либу
		return 'axxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
			var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
			return v.toString(16);
		});
	},
	_genFileName: function (prefix) {
		var date = new Date;
		return (prefix || 'upload_') + date.getFullYear() + "-" + ("0" + (date.getMonth() + 1)).slice(-2) + "-" + ("0" + date.getDate()).slice(-2) + "_" +
			("0" + date.getHours()).slice(-2) + "." + ("0" + date.getMinutes()).slice(-2) + "." + ("0" + date.getSeconds()).slice(-2);
	},
	_getFilename: function (name) {
		return name
			// Убьём window слэши
			.replace(/\\/g, '/')
			// Получим имя файла без папок
			.replace(/^.+\//g, '')
			// // WP 8.1 передаёт очень кривые имена файлов с полным путём, в котором слэши заменены на подчёркивания.
			.replace(/^C__Data_Users_DefApps_AppData_INTERNETEXPLORER_([^_]+)_/, '');
	}
});

export default FilesUploader;
