import module from 'module';
import $ from '../jquery';
import Device from '../device';
import {Class} from '../class';
import * as pushstream from '../core/lp';
import {Spaces, Codes, Url} from '../spacesLib';
import page_loader from '../ajaxify';
import fixPageHeight from '../min_height';
import DdMenu from '../dd_menu';
import FilesMonitor from '../files_monitor';

// Загрузчик файлов загрузить позже
let FileUploader;
let FilesUploader;

import '../draggable';
import '../anim';
import {L, tick, numeral, ge} from '../utils';

import "Anketa/AvatarSelector.css";
import "Files/Tile.css";
import "Files/Gallery.css";
import "Common/Attaches.css";

/*
	Параметры кнопки:
		data-form="#someid"   | опциональный | id или селектор формы, для которой аттачи. По умолчанию - первый form в parents
		data-max_files="1"    | опциональный | лимит количества аттачей, по умолчанию Spaces.LIMIT.ATTACHES, 1 отключает мультивыбор
		data-attaches=""      | опциональный | место для аттачей, по умолчанию .js-attaches_place, если 0, то пререндер аттаечй отключен
		data-buttons=""       | опциональный | селектор на блок с дополнительными кнопками
		data-std_attach="0"   | опциональный | тип пользовательского объекта, для которого есть стандатный способ аттачей (тип костыля)
		data-comm="0"         | опциональный | ID текущего сообщества
		data-talk="0"         | опциональный | ID текущей беседы
		data-menu_pos         | опциональный | Позиция меню. Не задано - снизу кнопку, before - сверху
		data-public="1"       | опциональный | Если 1 - грузится во Вложения, иначе в скрытую папку, к которой нет никому доступа (почта, првиатный чат)
		
	Ивенты:
		onNewAttach
			{nid:, type:, el:}
		onDeleteAttach
			{nid:, type:}
	
	Пример юзания:
		<form>
			// Кнопка выбора
			<input type="submit" value="Файл" class="js-attach">
			
			// Список аттачей
			<div class="js-attaches"></div>
		</form>

	Или если нет формы или кнопка вне неё:
		<div id="some_form">
			// Список аттачей
			<div class="js-attaches"></div>
		</div>
	
	Кнопка выбора:
		<input type="submit" value="Файл" data-form="#some_form" class="js-attach">
	
	Получить список аттачей из JS:
		AttachSelector.getAttaches($('#some_form')); // [{nid: ид, type: тип, el: элемент}, ..]
*/

var TYPES = {}, TYPES_ORDER = [
	Spaces.TYPES.PICTURE,
	Spaces.TYPES.MUSIC,
	Spaces.TYPES.VIDEO,
	Spaces.TYPES.FILE
];
TYPES[Spaces.TYPES.FILE] = {
	name: L('Файлы'),
	title: L('Файлы'),
	title2: L('файлов'),
	icon: 'ico_mail ico_mail_file',
	type: Spaces.TYPES.FILE,
	sex: 1
};
TYPES[Spaces.TYPES.VIDEO] = {
	name: L('Видео'),
	title: L('Видео'),
	title2: L('видео'),
	icon: 'ico_mail ico_mail_video',
	type: Spaces.TYPES.VIDEO,
	sex: 0
};
TYPES[Spaces.TYPES.MUSIC] = {
	name: L('Музыка'),
	title:L( 'Музыка'),
	title2: L('треков'),
	icon: 'ico_mail ico_mail_music',
	type: Spaces.TYPES.MUSIC,
	sex: 1
};
TYPES[Spaces.TYPES.PICTURE] = {
	name: L('Фото'),
	title: L('Фотографии'),
	title2: L('фотографий'),
	icon: 'ico_mail ico_mail_picture',
	type: Spaces.TYPES.PICTURE,
	sex: 0
};
var section_names = {
	0: 'comm',
	1: 'user'
};
var RE_STRIP_URL = /^http(s?):\/\/|#.*?$/ig

var media_urls_cache = {},
	GET_IMAGE_TIMEOUT = 10000,
	GET_IMAGE_LONG_TIMEOUT = 60000,
	media_url_current,
	deffer_render_cnt = 0;

var tpl = {
	typeSelect: function (data) {
		var html = '<div class="links-group links-group_grey">';
		for (var i = 0; i < TYPES_ORDER.length; ++i) {
			var type = TYPES[TYPES_ORDER[i]];
			if (data.types && $.inArray(+type.type, data.types) < 0)
				continue;
			html += '<a href="#" class="list-link js-select_file" data-type="' + type.type + '">' + 
				'<span class="' + type.icon + '"></span> ' + type.name + '</a>';
		}
		html += '<a href="#" class="list-link js-dd_menu_close"><span class="ico ico_remove"></span> ' + L('Закрыть') + '</a></div>';
		return html;
	},
	quickSelector: function (data) {
		var html = 
		'<div class="links-group links-group_grey hide" data-view="action" data-empty="1"></div>' + 
		(data.upload ? 
			'<div class="upload-dnd_msg js-attach_dnd">' + 
				'<div class="js-dnd_msg"></div>' + 
			'</div>' : ''
		) + 
		'<div class="hide" data-view="upload_progress">' + 
			'<div class="content-item3 wbg content-bl__sep js-qsel_link_upload">' + 
				'<div class="grey pad_b_a">Загрузка файла...</div>' + 
				tpl.spinner3() + 
			'</div>' + 
		'</div>' + 
		'<div class="hide wbg" data-view="upload">' + 
			'<div class="js-qsel_upload_file"></div>' + 
			'<div class="js-qsel_upload_widget_wrap">' + 
				'<div class="js-qsel_upload_widget"></div>' + 
			'</div>' + 
		'</div>' + 
		'<div class="hide wbg" data-view="editor">' + 
		'</div>' + 
		'<div class="links-group links-group_grey hide" data-view="main">' + 
			'<table class="table__wrap' + (!data.sources ? ' hide' : '') + '">' + 
				'<tr>' + 
					'<td class="table__cell links-group links-group_grey table__cell_last" width="50%">' + 
						'<a href="#" class="list-link upcs b js-attach_source" data-source="comm">' + L('Сообщество') + '</a>' + 
					'</td>' + 
					'<td class="table__cell links-group links-group_grey table_cell_border" width="50%">' + 
						'<a href="#" class="list-link js-attach_source upcs b" data-source="user">' + L('Мои файлы') + '</a>' + 
					'</td>' + 
				'</tr>' + 
			'</table>' + 
			'<div class="js-qsel_main js-gallery_skip">' + 
				'<div class="b-title b-title_first b-title_in-window' + (!data.showSlider ? ' hide' : '') + '">' + 
					TYPES[data.type].title + ' <span class="js-qsel_cnt cnt" style="opacity:0">0</span>' + 
					'<a href="#" class="link-imp right js-qsel_all">' + 
						'<span class="js-qsel_all_spinner hide ico ico_spinner"></span> ' + 
						L('ВСЕ') + 
					' <span class="ico ico_arr_right_blue"></span></a>' + 
				'</div>' + 
				'<div class="js-qsel_carousel wbg ' + (!data.showSlider ? ' hide' : '') + '" ' +
					(data.type == Spaces.TYPES.PICTURE || data.type == Spaces.TYPES.VIDEO ? 'style="min-height: 114px"' : '') + '></div>' +
				'<div class="js-qsel_error" style="color: red"></div>' + 
				'<div class="links-group links-group_grey">' + 
					'<div class="js-qsel_upload_err stnd-block error__msg content-bl__sep hide"></div>' + 
					
					'<div class="qsel-cust_upl_btn"></div>' + 
					
					(data.picGenerator ? `
						<div class="js-pic_generator list-link">
							<span class="js-ico ico ico_magic"></span> ${L('Создать уникальную картинку')}
						</div>` : ``) + 
					
					(data.upload ? 
						'<span class="list-link list-link_first js-qsel_upload_btn disabled">' + 
							'<span class="js-content">' + 
								'<span class="ico ico_upload js-upload_btn_ico hide"></span> ' + 
								'<span class="ico ico_spinner js-upload_btn_spinner"></span> ' + 
								(TYPES[data.type].sex ? L('Загрузить новый') : L('Загрузить новое')) + 
							'</span>' + 
						'</span>' : '') + 
					
					(data.linkDownload ? 
						'<div class="content-item3 wbg content-bl__sep js-qsel_link_upload">' + 
							'<label class="label text">' + L('Загрузить по ссылке:') + '</label>' + 
							'<table class="table__wrap table__wrap-layout">' + 
								'<tr>' + 
									'<td style="width: 100%" class="table__cell">' +
										'<div class="text-input__wrap">' + 
											'<input type="text" class="text-input js-qsel_link_input" data-no_paste="1" value="" ' + 
													'placeholder="' + L('Введите ссылку') + '" />' + 
										'</div>' + 
									'</td>' + 
									'<td class="table__cell padd_left">' + 
										'<button disabled="disabled" type="submit" ' + 
												'class="btn btn_input js-qsel_download_url_btn" name="qsel_select_btn">' + 
											L('Загрузить') + 
										'</button>' +
									'</td>' + 
								'</tr>' + 
							'</table>' + 
						'</div>'
					: '') + 
					
					/*
					(data.linkDownload || data.upload ? `
						<div class="wbg f-c_fll">
							<div class="js-input_error_wrap js-checkbox_wrap">
								<label class="form-checkbox square left_chb js-checkbox">
									<input class="form-checkbox__el js-qsel_adult" type="checkbox" value="1" name="Adult" />
									Только для взрослых <span class="t red">(18+)</span>
								</label>
							</div>
						</div>
					` : ``) +
					*/
					
					'<div class="qsel-cust_btn"></div>' + 
					
					(data.attaches ? 
						'<table class="table__wrap">' + 
							'<tr class="js-upload_state-uploading" style="display: table-row;">' + 
								'<td class="table__cell links-group links-group_grey table__cell_border" width="50%">' + 
									'<a href="#" class="list-link list-link-blue js-qsel_select_btn disabled">' + 
										'<span class="ico ico_plus_blue"></span> ' + 
										'<span class="t">' + data.attachBtnName + '</span>' + 
									'</a>' + 
								'</td>' + 
								'<td class="table__cell links-group links-group_grey table__cell_last" width="50%">' + 
									'<a href="#" class="list-link js-dd_menu_close" id="upload_cancel_btn">' + 
										'<span class="ico ico_remove"></span> ' + 
										'<span class="t">' + L('Закрыть') + '</span>' + 
									'</a>' + 
								'</td>' + 
							'</tr>' + 
						'</table>' : 
						'<a href="#" class="list-link list-link_last js-dd_menu_close"><span class="ico ico_remove"></span> ' + L('Закрыть') + '</a>'
					) + 
				'</div>' + 
			'</div>' + 
		'</div>';
		return html;
	},
	carouselStub() {
		return `
			<div style="height: 114px">
				
			</div>
		`;
	},
	spinner: function () {
		return tpl.message({text: '<span class="ico ico_spinner"></span> ' + L('Загрузка...')});
	},
	spinner2: function (msg) {
		return '<div class="js-tmp_spinner list-link-darkblue stnd_padd content-bl__sep">' + 
					'<span class="ico ico_spinner m"></span> <span class="m">' + msg + '</span></div>';
	},
	spinner3: function () {
		return '<div class="progress-item js-tmp_pg_spinner"><div class="progress-item__runner progress-item__runner_anim"></div></div>';
	},
	dndPlace: function () {
		return '<div class="upload-dnd_msg">' + 
			'<div class="js-dnd_msg"></div>' + 
		'</div>';
	},
	message: function (data) {
		var html = 
			'<div class="content-bl content-bl_first content-bl__sep">' + 
				data.text + 
			'</div>';
		return html;
	},
	error: function (data) {
		return tpl.message({text: '<span style="color: red">' + data.text + '</span>'}) + 
			(!data.no_button ? 
			'<button class="menu_back btn-main js-qsel_back" data-back_view="' + (data.back || "main") + '">' + 
				'<span class="ico ico_remove"></span> ' + L('Закрыть') + 
			'</button>' : '');
	},
	attach: function (data) { // Заглушка
		var html;
		if (data.show_preview) { // tile
			html = 
				'<div class="tiled_item js-attach_item tiled_item-128 tiled_fixed" id="' + data.nid + '_' + data.type + '">' + 
					'<div class="tiled_inner t_center relative">' + 
						'<div class="tiled-preview">' + 
						//	'<img src="' + ICONS_BASEURL + 'default_file_preview.png" alt="" class="preview" />' + 
						'</div>' + 
					'</div>' + 
				'</div>';
		} else { // list
			html =
				'<div class="att_wrap js-attach_item" id="' + data.nid + '_' + data.type + '">' +
					'<span class="ico ico_spinner"></span>' + 
				'</div>';
		}
		return html;
	},
	musicList: function (data) {
		var html = '<div class="links-group links-group_grey">';
		for (var i = 0; i < data.files.length; ++i) {
			var w = data.files[i];
			html += 
				'<a href="' + w.preview.URL + '" class="list-link list-link_select_item js-qsel_select_music" data-nid="' + w.nid + '" ' + 
						'data-type="' + w.type + '" data-name="' + w.artist + ' - ' + w.title + '">' + 
					'<span class="ico_buttons ico_buttons_select"></span>' + 
					'<div class="no_word_break">' + 
						'<span class="ico_colored ico_colored_music"></span> <b>' + w.artist + '</b> - ' + w.title + 
					'</div>' + 
				'</a>';
		}
		html += '</div>';
		return html;
	},
	uploadProgressWrap: function (data) {
		return '<div class="stnd_padd light_border_bottom grey pointer js-qsel_upload_progress_wrap"></div>';
	},
	disabledUploadError: function () {
		return L('Добавление файлов в сообщество запрещено.') + '<br />' + 
			L('Чтобы прикрепить новый файл, воспользуйтесь вкладкой {0} вверху страницы.',
			'<a href="#" class="js-attach_source" data-source="user">' + L("Мои файлы") + '</a> ');
	}
};

var MAttachSelector, AttachSelector;

var lock_close = false,
	in_upload = false,
	current_section,
	file2instance = {},
	file2bbcode = {},
	active_instance,
	instances = [],
	upload_initialized = false;

AttachSelector = {
	init() {
		MAttachSelector.delayedInit();
	},
	resetAttaches: function (form) {
		form = $(form);
		let self = AttachSelector.instance(form);
		if (!self)
			return;
		self.deleteAll(true);
	},
	replaceAttaches: function (form, attaches) {
		form = $(form);
		
		let self = AttachSelector.instance(form);
		if (!self)
			return;
		
		AttachSelector.resetAttaches(form);
		
		let tmp_attaches = [];
		$.each(attaches.tiles, (id, att) => {
			let widget = $(att);
			let file = MAttachSelector.parseFile(widget);
			self.onAttachSelect(file, true, false, {tile: widget});
			tmp_attaches.push(file);
		});
		$.each(attaches.list, (id, att) => {
			let widget = $(att);
			let file = MAttachSelector.parseFile(widget);
			self.onAttachSelect(file, true, false, {list: widget});
			tmp_attaches.push(file);
		});
		self.saveAttaches(tmp_attaches, true);
		self.checkAttList();
	},
	getAttaches: function (form, std_list) {
		var attaches = [];
		form = $(form);
		form.find('.js-attach_item').each(function () {
			var el = $(this), file = MAttachSelector.parseFile(el);
			if (std_list) {
				attaches.push(file.nid + '_' + file.type);
			} else {
				file.el = el;
				attaches.push(file);
			}
		});
		return attaches;
	},
	select: function (nid, type) {
		var self = MAttachSelector.active();
		if (self)
			self.selectDefault(nid, type);
	},
	resetSelected: function (nid, type) {
		var self = MAttachSelector.active();
		self.default_selected = [];
	},
	instance: function (el, flag) {
		return MAttachSelector.instance(el);
	},
	isBusy: function () {
		return in_upload || deffer_render_cnt > 0;
	},
	isOpened: function () {
		return !!MAttachSelector.active();
	},
	onDone: function (callback) {
		var self = this;
		if (!self.isBusy()) {
			callback();
			return;
		}
		$('#main').one('onAttachesComplete', function () {
			callback();
		});
	},
	close: function () {
		var self = MAttachSelector.active();
		if (self)
			self.close();
	}
};

MAttachSelector = Class({
	Static: {
		init: function () {
			var self = this;
			
			$('#main').on('click', '.js-attach_delete', function (e) {
				e.preventDefault(); e.stopPropagation();
				e.stopImmediatePropagation();
				
				var el = $(this),
					att = self.instance(el),
					file = MAttachSelector.parseId(el.data('id'));
				
				att.deleteAttach(file.nid, file.type);
			}).on('click', '.js-attach', function (e) { // Ленивая инициализация
				self.setup(this);
			}).on('click', '.js-postpone', function (e) {
				e.preventDefault();
				var el = $(this),
					form = el.parents('form'),
					state = form.find('.js-postpone_state');
				form.find('.js-postpone_form').toggleClass('hide');
				el.find('.js-ico').toggleClass('ico_history ico_history_black');
				state.val(+state.val() ? 0 : 1);
			});
			self._initDND();
		},
		
		parseId: function (id) {
			var m = id.match(/(\d+)_(\d+)/);
			return {nid: +m[1], type: +m[2], id: id};
		},
		
		parseFile: function (el) {
			return $.extend(this.parseId(el.attr('id')), el.data());
		},
		
		// Аплоадер
		_initUploader: function () {
			var self = this;
			
			if (upload_initialized)
				return;
			upload_initialized = true;
			
			var reset_state = function (self) {
				if (self.state.limit < 2) {
					self.view("main", true);
					self.view("upload").find('.js-qsel_upload_file').empty();
					self.view("upload").find('.js-qsel_upload_widget_wrap').show();
				}
			};
			var tmp_files = [];
			
			FileUploader.init({
				buttonClass: {
					hover: 'strong_clicked',
					active: 'strong_clicked_active'
				},
				autoSubmit: true,
				noDragClass: true,
				removeAfterUpload: true,
				multiple: true,
				onSubmit: function (file) {
					in_upload = true;
					
					var self = file2instance[file.id];
					
					if (self.state.limit < 2) {
						if (!self.state.noAutoSelect)
							self.sliderSelect();
						lock_close = true;
						self.view("upload", true);
					}
					
					var post = {};
					post.Adult = self.uploadAsAdult ? 1 : 0;
					if (self.state.dir !== undefined) {
						post.dir = self.state.dir;
					} else {
						post.Att = 1;
						if (self.state.privateAttaches)
							post.Ss = 1;
					}
					if (self.state.commId && current_section == 'comm')
						post.Comm = self.state.commId;
					if (self.state.talkId)
						post.Talk = self.state.talkId;
					FileUploader.setPostData(post);
				},
				onShowNative: function () {
					var self = MAttachSelector.active();
					self.view("upload", true);
				},
				onFileUpload: function (res, tmp_file) {
					lock_close = false;
					in_upload = false;
					
					var file = res.data,
						self = file2instance[tmp_file.id];
					if (self.onAttachSelect(file, true, !!file2bbcode[tmp_file.id]))
						self.saveAttaches([file]);
					if (self.state.limit < 2)
						self.menu.close();
				},
				onError: function (error) {
					lock_close = false;
					in_upload = false;
					
					var self = MAttachSelector.active();
					if (self)
						self.showError(error);
				},
				onFileError: function (id, error) {
					var self = MAttachSelector.active();
					if (self && self.state.limit < 2)
						self.showError(error);
				},
				onHideError: function () {
					// _view("main");
				},
				onReset: function (is_reset) {
					lock_close = false;
					in_upload = false;
					
					if (is_reset)
						reset_state(self);
				},
				onNewFileAdd: function (data) {
					var self = MAttachSelector.active();
					if (self.state.proxyUpload) {
						data.file.file._spaces = {type: self.current_type, bb: true};
						tmp_files.push(data.file.file);
						return false;
					}
					if (!self.state.upload)
						return false;
					if (self.state.uploadError) {
						self.showError(self.state.uploadError);
						return false;
					}
					
					var extra = data.file.file._spaces;
					if (extra && extra.bb)
						file2bbcode[data.file.id] = true;
					file2instance[data.file.id] = self; // Сохраеям чей именно это файл
					
					if (self.state.limit > 1) {
						self.onAttachUpload(data.file.id, data.widget);
						if (data.file.error) {
							tick(function () {
								self.menu.close();
							});
						}
					} else {
						self.view("upload").find('.js-qsel_upload_widget_wrap').hide();
						self.view("upload").find('.js-qsel_upload_file').empty().append(tpl.uploadProgressWrap());
						self.view("upload").find('.js-qsel_upload_progress_wrap').append(data.widget);
					}
				},
				onFilesChunkEnd: function (data) {
					var self = MAttachSelector.active();
					if (self.state.proxyUpload) {
						self.menu.close();
						tick(function () {
							self.parent.form.trigger('files', {proxied: true, files: [...tmp_files]});
							tmp_files = [];
						});
						return;
					}
					
					if (!self.state.noAutoSelect)
						self.sliderSelect();
					self.checkAttList();
				},
				onAfterAutoSubmit: function () {
					var self = MAttachSelector.active();
					if (self.state.limit > 1)
						self.menu.close();
				},
				onRemoveFile: function (file) {
					var self = file2instance[file.id];
					self.checkAttList();
					reset_state(self);
					tick(function () {
						self.checkComplete();
					});
				},
				onGetTotal: function (ref) {
					var self = MAttachSelector.active();
					ref.total = self.getTotal();
				}
			});
		},
		_initDND: function () {
			var drag_msg_toggle = function (parent, flag) {
				var dnd_msg = parent
					.find('.upload-dnd_msg')
					.toggleClass('upload-dnd_msg_active', flag)
					.find('.js-dnd_msg')
					.text(
						!flag ? 
							L('Перенесите сюда файлы, чтобы прикрепить их к сообщению.') : 
							L('Отпустите клавишу мыши, чтобы прикрепить файлы.')
					);
				
				$('.upload-dnd_msg .js-dnd_msg').each(function () {
					// Выравнивание сообщения, если оно ушло куда-то вниз
					var dnd_msg = $(this),
						$window = $(window),
						scroll = $window.scrollTop(),
						wind_height = $window.innerHeight(),
						wrap = dnd_msg.parent(),
						wrap_pos = wrap.offset(),
						wrap_h = wrap.height();
					
					if (wrap_h && (wrap_pos.top < scroll || wrap_pos.top + wrap_h > scroll + wind_height)) {
						var start_y = Math.max(scroll, wrap_pos.top),
							end_y = Math.min(wrap_pos.top + wrap_h, scroll + wind_height);
						dnd_msg.css("top", ((end_y - start_y) / 2 + Math.max(0, scroll - wrap_pos.top)) + "px");
					} else {
						dnd_msg.css("top", "50%");
					}
				});
			};
			
			if (pushstream) {
				pushstream.on('message', 'media_urls', function (data) {
					if (data.act == pushstream.TYPES.LOADED_FILE && media_url_current) {
						var time = ((Date.now() - media_url_current.time) / 1000).toFixed(2);
						if (data.code != 0 || !data.data) {
							console.log('[getImage] ' + media_url_current.url + ' - server error (' + time + 's): ' + Spaces.apiError(data));
							media_url_current.callback(false, false, Spaces.apiError(data));
						} else {
							console.log('[getImage] ' + media_url_current.url + ' - OK (' + time + 's)');
							media_url_current.callback(data);
						}
					}
				});
			}
			
			page_loader.on('formsubmit', 'media_urls', function (e) {
				var form = $(e.form),
					btn = $(e.form.submit_btn),
					self = AttachSelector.instance(btn);
				
				if (!self)
					return;
				if (form.data('disabled'))
					return false;
				
				if (AttachSelector.isBusy()) {
					form.data('disabled', true);
					form.find('textarea').attr("disabled", "disabled");
					AttachSelector.onDone(function () {
						self.onFormSubmit();
						form.removeData('disabled');
						btn.click();
					})
					return false;
				}
				
				self.onFormSubmit();
			}, {persistOnRequest: true});
			
			// Показ подсказки DnD
			var in_local_drag = false;
			$('#main').on('dragGlobalStart', function () {
				var self = MAttachSelector.active();
				if (self) {
					if (self.upload_inited) {
						var form = self.menu.content();
						form.addClass('upload-dnd_msg_show');
						drag_msg_toggle(form, false);
					}
				} else {
					for (var i = 0; i < instances.length; ++i) {
						var self = instances[i];
						if (self) {
							var form = self.state.form;
							form.addClass('upload-dnd_msg_show');
							drag_msg_toggle(form, false);
						}
					}
				}
			}).on('dragGlobalEnd', function () {
				var self = MAttachSelector.active();
				if (self) { // Окно могли уже закрыть
					if (self.upload_inited)
						self.menu.content().removeClass('upload-dnd_msg_show');
				} else {
					for (var i = 0; i < instances.length; ++i) {
						var self = instances[i];
						if (self)
							self.state.form.removeClass('upload-dnd_msg_show');
					}
				}
			}).on('fileDragStart', '.js-attach_dnd', function () {
				in_local_drag = true;
				drag_msg_toggle($(this), true);
			}).on('fileDragEnd', '.js-attach_dnd', function () {
				in_local_drag = false;
				drag_msg_toggle($(this), false);
			}).on('pasteurl', '.js-attach_dnd', function (e, data) {
				var self = MAttachSelector.instance($(this));
				if (self)
					self.loadImages(data.urls);
			}).on('files', '.js-attach_dnd', function (e, data) {
				e.stopPropagation();
				e.stopImmediatePropagation();

				var self = MAttachSelector.active();
				if (self) {
					if (data.proxied && self.state.proxyUpload)
						return;
					FileUploader.addFiles(data.files);
				} else {
					var self = MAttachSelector.instance($(this));
					if (data.proxied && self.state.proxyUpload)
						return;
					
					var MIME2TYPE = {
						"image/pjpeg": Spaces.TYPES.PICTURE,
						"image/jpeg": Spaces.TYPES.PICTURE,
						"image/jpg": Spaces.TYPES.PICTURE,
						"image/gif": !self.typeAllowed(Spaces.TYPES.FILE) ? Spaces.TYPES.PICTURE : Spaces.TYPES.FILE,
						"image/png": Spaces.TYPES.PICTURE,
						"audio/mp3": Spaces.TYPES.MUSIC
					};
					var files_by_type = {};
					for (var i = 0; i < data.files.length; ++i) {
						var file = data.files[i],
							type = Spaces.TYPES.FILE;
						if (file.name) {
							type = Spaces.getFileType(file.name.split('.').slice(-1));
						} else if (file.type) {
							type = MIME2TYPE[file.type.toLowerCase()] || Spaces.TYPES.FILE;
						}
						if (file._spaces)
							type = file._spaces.type;
						
						if (!self.typeAllowed(type))
							return;
						
						if (!files_by_type[type])
							files_by_type[type] = [];
						
						files_by_type[type].push(file);
					}
					
					if (self) {
						if (self.state.limit > 1)
							self.showProgress(true);
						$.each(files_by_type, function (type, files) {
							if (files.length > 0) {
								if (self.state.limit < 2) {
									self.menu.open();
									self.quickSelector(type, true, function () {
										FileUploader.addFiles(files);
									}, true);
								} else {
									self.setupUploader(type, false, function () {
										MAttachSelector.active(self);
										self.showProgress(false);
										FileUploader.addFiles(files);
										MAttachSelector.active(null);
									});
								}
							}
						});
					}
				}
			});
		},
		active: function (instance) {
			if (instance !== undefined)
				active_instance = instance;
			return active_instance;
		},
		instance: function (el) {
			el = $(el);
			var form = el.hasClass('js-attaches_form') ? el : el.parents('.js-attaches_form');
			return form.data('AttachSelector');
		},
		destroy: function () {
			// Убиваем все инстансы
			for (var i = 0; i < instances.length; ++i)
				instances[i].destroy();
			instances = [];
			
			lock_close = false;
			in_upload = false;
			upload_initialized = false;
			deffer_render_cnt = 0;
			
			file2instance = {};
			file2bbcode = {};
			active_instance = null;
		},
		delayedInit: function () {
			var self = this;
			var links = $('.js-attach');
			for (var i = 0; i < links.length; ++i)
				self.setup(links[i]);
		},
		setup: function (el) {
			var link = $(el);
			if (!link.data('AttachSelector')) {
				// Создаём инстанс
				link.data('AttachSelector', new MAttachSelector(link));
			}
			return link.data('AttachSelector');
		}
	},
	Constructor: function (link) {
		var self = this,
			form = link.data('form') ? $(link.data('form')) : link.parents('form'),
			list = link.data('list') ? $(link.data('list')) : (form.hasClass('js-attaches') ? form : form.find('.js-attaches')),
			data = $.extend({upload: true}, link.data());
		
		// Форма уже проинициализирована!
		if (form.hasClass('js-attaches_form') && !link.data('allowAlias'))
			return;
		
		instances.push(self);
		self.new_attaches = [];
		self.default_selected = [];
		
		form.addClass('js-attaches_form')
			.data("AttachSelector", self);
		
		if (!data.fallback)
			data.fallback = link.prop("href");
		
		let links = form.find('.js-attach');
		let enabled_types = link.data("enabledTypes") ?? [];
		
		if (!links.length)
			links = link;

		self.state = {
			id:					'',
			link:				link,
			form: 				form,
			avatar:				data.avatar,
			talkId:				data.talk,
			commId:				data.comm,
			exVideo:			enabled_types.includes(Spaces.TYPES.EXTERNAL_VIDEO),
			onlyUpload:			!!data.only_upload,
			onlyComm:			data.comm && data.only_comm,
			dir:				data.dir,
			file_type:			data.file_type,
			buttons:			data.buttons,
			uploadButtons:		data.uploadButtons,
			privateAttaches:	!data['public'],
			enabledTypes:		enabled_types,
			linkDownload:		data.linkDownload,
			picGenerator:		data.picGenerator,
			attaches:			data.attaches === undefined ? true : !!data.attaches,
			attachesList:		list,
			proxyUpload:		data.proxyUpload,
			fallbackUrl:		data.fallback,
			upload:				data.upload,
			spoiler:			(data.spoiler ? (data.spoiler[0] == '#' ? $(data.spoiler) : form.find(data.spoiler).first()) : ''),
			noAutoSelect:		data.noAutoSelect,
			noAttachDeleteApi:	data.noAttachDeleteApi,
			isEditMode:			data.isEditMode,
			
			oid:	data.oid,
			ot:		data.ot,
			pid:	data.pid,
			
			limit:	data.max_files || Spaces.LIMIT.ATTACHES
		};

		self.state.mode = "picker";
		if (self.state.attachesList.length || self.state.proxyUpload)
			self.state.mode = "attaches";
		
		if (self.state.attaches)
			self.state.linkDownload = true;
		
		self.state.flat = true;
		if (!self.state.spoiler || !self.state.spoiler.length) {
			self.state.spoiler = false;
		} else {
			self.state.flat = !self.state.spoiler.data('wrap');
		}
		
		if (!self.state.proxyUpload) {
			var dnd_palce = $(tpl.dndPlace());
			self.state.form.addClass('js-attach_dnd').filesMonitor().prepend(dnd_palce);
			// dnd_palce.filesMonitor();
		}
		
		self.link = links;
		self.form = form;
		self.list = list;
		
		if (self.list.length && Device.type == 'desktop')
			self._initDragDrop();
		self._setup();
	},
	_setup: function () {
		var self = this;
		
		var menu = new DdMenu({
			flat: self.state.flat,
			data: {
				scroll: true,
				spoiler: self.state.spoiler,
				toggle_same: true
			}
		});
		
		self.link.each(function () {
			menu.link($(this).data('no_label', !!self.state.spoiler));
		});
		
		menu.element().on('dd_menu_open', function () {
			if (menu.opener().data('locked'))
				return false;
		}).on('dd_menu_toggle', function (e, data) {
			var btn_types = data.link.data('selectTypes');
			if (!data.sameLink && btn_types && btn_types.length == 1) {
				menu.close();
				data.link.click();
				return false;
			}
		}).on('dd_menu_opened', function () {
			var link = menu.opener();
			
			current_section = self.state.onlyComm ? 'comm' : Spaces.LocalStorage.get('attach_selector_source', 'comm');
			
			var btn_types = link.data('selectTypes');
			var file_type = (btn_types && btn_types.length == 1 && btn_types[0]) || link.data('temp_type') || self.state.file_type;
			if (!file_type) {
				menu.content().empty().append(tpl.typeSelect({
					types: self.state.enabledTypes
				}));
				DdMenu.fixSize();
			} else {
				link.removeData('temp_type');
				self.quickSelector(file_type);
			}
			MAttachSelector.active(self);
		}).on('dd_menu_close', function (e) {
			if (lock_close) {
				e.preventDefault();
				return;
			}
			
			if (self.new_attaches.length > 0)
				self.saveAttaches(self.new_attaches);
			
			self.free();
			fixPageHeight();
			
			MAttachSelector.active(null);
			
			if (self.state.form)
				self.state.form.trigger('AttachSelectorClose');
		}).on('click', '.js-pic_generator', function (e) {
			let link = $(this);
			link.addClass('disabled').find('.js-ico').addClass('ico_spinner');
			import("../pic_generator").then(function ({default: PicGenerator}) {
				PicGenerator.init(self.view("editor"), {
					type: 'pic',
					onInit() {
						link.removeClass('disabled').find('.js-ico').removeClass('ico_spinner');
						self.view("editor", true);
					},
					onSelect(file_id, preview, preview_2x) {
						self.onAttachSelect({
							nid: file_id,
							type: Spaces.TYPES.PICTURE,
							show_preview: true
						});
						self.menu.close();
					},
					onCancel() {
						self.view("main", true);
					}
				});
			});
		}).on('click', '.js-select_file', function (e) {
			e.preventDefault(); e.stopPropagation();
			self.quickSelector($(this).data('type'), true);
		}).on('click', '.js-qsel_upload_btn', function (e) {
			e.stopImmediatePropagation();
			
			if (self.state.uploadError) {
				e.preventDefault();
				e.stopPropagation();
				self.showError(self.state.uploadError);
			}
			
			if (FilesUploader.needStaticUpload()) {
				if ((self.state.fallbackUrl instanceof $)) {
					self.state.fallbackUrl.one('click', function (e) {
						e.stopPropagation();
						e.stopImmediatePropagation();
					}).click();
					return false;
				} else if (self.state.fallbackUrl) {
					location.assign(self.state.fallbackUrl);
					return false;
				} else {
					var btn = self.link;
					if (!/^input|button$/i.test(btn[0].tagName))
						btn = btn.find('button, input[type="submit"]').first();
					var form = btn.parents('form');
					if (btn.length && form.length) {
						DdMenu.close();
						self.link.data('disabled', true);
						setTimeout(function () {
							form.on('submit._att_select', function (e) {
								e.stopPropagation();
								e.stopImmediatePropagation();
							});
							form.addClass('no_ajax');
							form.data('preventSubmit', true);
							btn.trigger('click', {
								ignoreEvent: true
							});
							tick(function () {
								form.data('preventSubmit', false);
								form.off('submit._att_select');
							});
						}, 0);
						return false;
					}
				}
				// Если не найден механизм fallback'а
				self.showQSelError(L("Загрузка файла не реализована. Сообщите в <a href='/soo/support'>Support</a>"));
			}
		}).on('click', '.js-attach_source', function (e) {
			e.preventDefault(); e.stopPropagation();
			current_section = $(this).data('source');
			Spaces.LocalStorage.set('attach_selector_source', current_section);
			self.free();
			self.quickSelector(self.current_type);
		}).on('click', '.js-qsel_back', function (e) {
			e.preventDefault(); e.stopPropagation();
			var view_id = $(this).data('back_view');
			if (view_id == 'exit') {
				menu.close();
			} else {
				self.view(view_id, true);
			}
		}).on('change', '.js-qsel_adult', function (e) {
			for (var i = 0; i < instances.length; i++)
				instances[i].uploadAsAdult = this.checked;
		}).on('click', '.js-qsel_download_url_btn', function (e) {
			e.preventDefault(); e.stopPropagation();
			
			if ($(this).attr("disabled"))
				return;
			
			self.loadUrl();
		}).on('click', '.js-qsel_select_btn', function (e) {
			e.preventDefault(); e.stopPropagation();
			
			if ($(this).hasClass('disabled'))
				return;
			
			self.sliderSelect();
			menu.close();
		}).on('click', '.js-qsel_select_music', function (e) {
			e.preventDefault(); e.stopPropagation();
			var file = Spaces.core.extractFile($(this));
			if (self.state.limit < 2) {
				if (!self.checkParentLimit()) {
					self.markMusic(file.nid, false);
					return false;
				}
				if (self.onAttachSelect(file))
					menu.close();
				return false;
			}
			
			var is_delete = self.markMusic(file.nid);
			if (is_delete) {
				self.deleteAttach(file.nid, file.type);
				self.showQSelError('');
			} else {
				var avail = self.getAvail();
				if (avail < 0) {
					self.markMusic(file.nid, false);
					self.limitError();
				}
			}
			self._showSelectBtn();
			
			return false;
			
		}).on('click', '.js-qsel_all', function (e) {
			e.preventDefault(); e.stopPropagation();
			if (self.state.limit > 1) {
				var avail = self.getAvail();
				if (avail <= 0) {
					self.limitError();
					return;
				}
				self.sliderSelect();
			} else {
				if (!self.checkParentLimit())
					return;
			}
			
			var el = $(this);
			self.view("main").find('.js-qsel_all_spinner').removeClass('hide');
			
			var data = {};
			if (self.state.avatar == "mail") {
				data.Talk_logo = 1;
			} else if (self.state.avatar == "comm") {
				data.Comm_logo = 1;
			} else if (self.state.avatar == "user") {
				data.User_photo = 1;
			} else if (self.state.avatar == "picker") {
				data.Ad_photo = 1;
			}
			
			import("../files_selector").then(function ({default: FilesSelector}) {
				FilesSelector.open({
					attaches: true,
					commId: self.state.commId,
					talkId: self.state.talkId,
					commSection: current_section == 'comm' || self.state.onlyComm ? 0 : 1,
					hideTabs: self.state.onlyComm,
					type: self.current_type,
					maxFiles: avail,
					apiData: data,
					onFileMultiSelect: function (files) {
						for (var i = 0; i < files.length; ++i)
							self.onAttachSelect(Spaces.core.fixFile(files[i]));
						self.saveAttaches(self.new_attaches);
						self.new_attaches = [];
					},
					onExit: function () {
						menu.close();
					}
				});
			});
		})
		.on('input change paste keydown', '.js-qsel_link_input', function (e) {
			self._showSelectBtn();
			
			var el = $(this);
			
			if (el.prop("delayed_check"))
				clearTimeout(el.prop("delayed_check"));
			
			var id = setTimeout(function () { // иначе на FF баг, в val() пустота
				el.prop("delayed_check", false);
				self._showSelectBtn();
			}, 50);
			el.prop("delayed_check", id);
		});
		
		menu.element().find('.js-qsel_link_input');
		
		var spoiler = self.state.spoiler;
		if (spoiler) {
			spoiler.after(menu.element().detach().addClass(spoiler.attr("class")));
			spoiler.remove();
		}
		
		self.menu = menu;
	},
	showProgress: function (flag) {
		var self = this;
		
		let custom_spinner = self.form.find('.js-attach_spinner');
		if (custom_spinner.length) {
			custom_spinner.toggleClass('hide', !flag);
		} else {
			self.state.attachesList.find('.js-tmp_pg_spinner').remove();
			if (flag)
				self.state.attachesList.prepend(tpl.spinner3());
			self.checkAttList();
		}
	},
	setSection: function (section) {
		var self = this;
		self.menu.content().find('.list-link.js-attach_source.clicked')
			.removeClass('clicked');
		self.menu.content().find('.list-link.js-attach_source[data-source="' + section + '"]')
			.addClass('clicked');
		current_section = section;
	},
	
	// Загрузка картинок по URL
	loadImages: function (links, report_error) {
		var self = this;
		
		var show_error = function (err) {
			if (report_error)
				self.showError(err);
		};
		
		if (!self)
			return;
		
		if (!pushstream.avail()) {
			show_error(L("Ошибка подключения. Проверьте ваш интернет."));
			return;
		}
		
		if (media_url_current) {
			show_error(L("Подождите окончаения предыдущей загрузки по ссылке."));
			return;
		}
		
		if (self.state.mode == "attaches" && !self.getAvail()) {
			show_error(L('Превышен лимит количества файлов. Максимально можно прикрепить {0}. ',
				numeral(self.state.limit, [L('$n файл'), L('$n файла'), L('$n файлов')])));
			return;
		}
		
		var RE_TEST_DOMAIN = new RegExp('(\\.|^)(' + location.hostname.replace(/(\.)/g, '\\$1') + ')(\\.?)$', 'i');
		for (var i = 0; i < links.length; ++i) {
			var link = links[i];
			if (RE_TEST_DOMAIN.test(link.domain)) {
				show_error(L("Cсылка не поддерживается."));
				continue;
			}
			if (!report_error && media_urls_cache[link.url] === false)
				continue;
			media_url_current = {url: link.url, time: Date.now()};
			break;
		}
		
		if (!media_url_current)
			return false;
		
		media_url_current.photo = self.state.mode == 'picker';
		
		media_url_current.callback = function (data, no_blacklist, error) {
			var state = media_url_current;
			media_url_current = null;
			
			if (report_error) {
				lock_close = false;
			} else {
				self.showProgress(false);
			}
			
			var file = data.data ? Spaces.core.fixFile(data.data) : data;
			if (state.timeout)
				clearTimeout(state.timeout);
			if (file && !file.blocked) {
				if (self.state.privateAttaches)
					file._private_attach = true;
				media_urls_cache[state.url] = file;
				if (self.onAttachSelect(file, true))
					self.saveAttaches([file]);
				
				self.menu.close();
			} else {
				show_error(error || L("Ссылка не содержит поддерживаемых файлов."));
				
				if (data)
					console.log('[getImage] ' + state.url + ' - ' + (file && file.blocked ? "file blocked" : "invalid upload answer"));
				if (!no_blacklist)
					media_urls_cache[state.url] = false;
				self.checkComplete();
			}
		};
		
		var cache = media_urls_cache[media_url_current.url];
		if (cache && (!cache._private_attach || self.state.privateAttaches)) {
			media_url_current.callback(cache);
		} else {
			if (report_error) {
				lock_close = true;
				self.view("upload_progress", true);
			} else {
				self.showProgress(true);
			}
			
			var api_data = {
				link:	media_url_current.url,
				Ss:		self.state.dir === undefined && self.state.privateAttaches,
				Adult:	self.uploadAsAdult ? 1 : 0,
				Type:	Spaces.TYPES.PICTURE,
				CK:		null
			};
			
			if (self.state.commId) {
				api_data.Comm = self.state.commId;
			} else if (self.state.talkId) {
				api_data.Talk = self.state.talkId;
			}
			
			Spaces.api("files.getImage", api_data, function (res) {
				if (!media_url_current)
					return;
				if (res.code != 0) {
					console.log("[getImage] " + media_url_current.url + " - error");
					show_error(Spaces.apiError(res));
					media_url_current.callback(false);
				} else {
					media_url_current.time = Date.now();
					if (res.data) {
						console.log("[getImage] " + media_url_current.url + " - OK (exists)");
						media_url_current.callback(res);
					} else {
						console.log("[getImage] " + media_url_current.url + " - queued");
						media_url_current.timeout = setTimeout(function () {
							media_url_current.callback(false);
						}, report_error ? GET_IMAGE_TIMEOUT : GET_IMAGE_LONG_TIMEOUT);
					}
				}
			}, {
				retry: 3,
				onError: function (err) {
					console.log("[getImage] " + media_url_current.url + " - net error");
					media_url_current.callback(false, true);
					show_error(err);
				}
			});
		}
		
		return true;
	},
	
	onFormSubmit() {
		var self = this;
		if (media_url_current) {
			clearTimeout(media_url_current.timeout);
			self.showProgress(false);
		}
		media_url_current = false;
	},
	
	stripUrls: function (value) {
		var self = this;
		
		var attaches = self.getAttaches(),
			file = media_urls_cache[$.trim(value)] || media_urls_cache['http://' + $.trim(value)];
		if (file) {
			// Приватные аттачи нельзя в публичные места!
			if (!self.state.privateAttaches && file._private_attach)
				return value;
			for (var i = 0; i < attaches.length; ++i) {
				if (attaches[i].nid == file.nid && attaches[i].type == file.type) {
					return "";
				}
			}
		}
		return value;
	},
	
	quickSelector: function (type, first_open, callback, wait_upload) {
		var self = this;
		
		var wrap = self.menu.content().empty(),
			el = $(tpl.quickSelector({
				type:				type,
				showSlider:			!self.state.onlyUpload,
				upload:				self.state.upload,
				attachBtnName:		self.state.proxyUpload ? L("Вставить") : L("Добавить"),
				sources:			self.state.commId && !self.state.onlyComm,
				attaches:			self.state.mode == "attaches",
				picGenerator:		self.state.picGenerator && type == Spaces.TYPES.PICTURE,
				linkDownload:		(self.state.linkDownload && (type == Spaces.TYPES.PICTURE || (type == Spaces.TYPES.VIDEO && self.state.exVideo)))
			}));
		
		el.find('.js-qsel_link_input').keypress(function (e) {
			if (e.keyCode == Spaces.KEYS.ENTER || e.keyCode == Spaces.KEYS.MAC_ENTER) {
				e.preventDefault();
				el.find('.js-qsel_select_btn').click();
			}
		});
		
		self.setUploadErr(null);
		
		if (self.state.uploadButtons)
			el.find('.qsel-cust_upl_btn').replaceWith($(self.state.uploadButtons).children().clone());
		
		if (self.state.buttons)
			el.find('.qsel-cust_btn').replaceWith($(self.state.buttons).children().clone());
		
		wrap.addClass('js-attach_dnd').append(el);
		if (!wait_upload)
			self.view("main", true);
		
		self.current_type = type;
		self.setSection(current_section);
		// wait_upload
		DdMenu.fixSize();
		
		var callback_uploader = function () {
			if (!wait_upload)
				self.setLoadling(false);
			
			self.slider = null;
			if (!self.state.onlyUpload) {
				if (type == Spaces.TYPES.MUSIC) { // Невероятные костыли для Музыка
					self.slider = null;
					el.find('.js-qsel_carousel').html(tpl.spinner());
					
					var api_data = {
						Type: Spaces.TYPES.MUSIC,
						Lt: Spaces.FILES_LIST.FILES_ALL,
						O: 0, L: 4
					};
					
					api_data.user = Spaces.params.name;
					if (self.state.commId) {
						api_data.Comm = self.state.commId;
						api_data.Default = current_section == 'comm' && first_open;
						api_data.Section = current_section == 'comm' ? 0 : 1;
					} else if (self.state.talkId) {
						api_data.Talk = self.state.talkId;
					}
					
					Spaces.api("files.getFiles", api_data, function (res) {
						self.setUploadErr(res.uploadError);
						
						if (res.code == 0) {
							if ('Section' in res) {
								// Раздел отключен!!
								if (res.Section != api_data.Section && !self.state.onlyComm) {
									// Переключаем на правильную секцию
									self.setSection(section_names[res.Section]);
								}
							}
							
							el.find('.js-qsel_carousel').replaceWith(tpl.musicList({
								files: res.widgets
							}));
							el.find('.js-qsel_cnt').text(res.count).css('opacity', 1);
							
							var attaches = self.getAttaches(true)[type];
							if (attaches) {
								for (var i = 0; i < attaches.length; ++i)
									self.markMusic(attaches[i].nid);
							}
							DdMenu.fixSize();
						} else {
							var error_msg = Spaces.apiError(res);
							if (res.code == Codes.FILES.ERR_DIR_ACCESS_DENIED && current_section == 'comm')
								error_msg = tpl.disabledUploadError();
							el.find('.js-qsel_main').html(tpl.error({text: error_msg, back: 'exit'}));
						}
					});
				} else {
					var api_data = {
						Type: type,
						Psize: Spaces.PREVIEW.SIZE_81_80,
						Lt: Spaces.FILES_LIST.FILES_ALL,
						Mode: type == Spaces.TYPES.FILE ? Spaces.RENDER_MODE.CAROUSEL : Spaces.RENDER_MODE.PREVIEW
					};
					
					api_data.user = Spaces.params.name;
					if (self.state.commId) {
						api_data.Default = current_section == 'comm' && first_open;
						api_data.Comm = self.state.commId;
						api_data.Section = current_section == 'comm' ? 0 : 1;
					} else if (self.state.talkId)
						api_data.Talk = self.state.talkId;
					
					var first_chunk = false;
					var slider = el.find('.js-qsel_carousel').carousel({
						select: true,
						hasMore: true,
						firstLoad: true,
						gallery: false,
						multiple: self.state.limit > 1,
						limit: 30,
						apiMethod: 'files.getFiles',
						metric: "attach_selector",
						apiData: api_data
					}).on('apiResult', function (res) {
						self.setUploadErr(res.uploadError);
						
						if ('Section' in res) {
							// Раздел отключен!!
							if (res.Section != api_data.Section && !self.state.onlyComm) {
								// Переключаем на правильную секцию
								self.setSection(section_names[res.Section]);
							}
						}
					}).on('loadError', function (e) {
						var error_msg = e.message || L("Неизвестная ошибка загрузки.");
						if (e.type == "api" && e.res.code == Codes.FILES.ERR_DIR_ACCESS_DENIED) {
							if (self.state.onlyComm) {
								self.menu.content().find('.js-qsel_all').hide();
								slider.resetItems();
								slider.insert($('<div>' + Spaces.apiError(e.res) + '</div>'));
								slider.update();
								return;
							}
							
							if (current_section == 'comm')
								error_msg = tpl.disabledUploadError();
						}
						el.find('.js-qsel_main').html(tpl.error({text: error_msg, back: 'exit'}));
					}).on('photosLoadChunk', function () {
						if (!slider)
							return;
						
						if (!slider.totalItems()) {
							slider.insert($('<div>' + L('У вас ещё нет загруженных {0}. ', TYPES[type].title2) + '</div>'));
							slider.update();
						}
						
						el.find('.js-qsel_cnt').text(slider.totalItems()).css('opacity', 1);
						
						// Метим уже выбранные аттачи
						var attaches = self.getAttaches(true)[type];
						if (attaches) {
							for (var i = 0; i < attaches.length; ++i)
								slider.markSelected(attaches[i].nid);
						}
						
						if (!first_chunk) {
							first_chunk = true;
							DdMenu.fixSize();
						}
					}).on('firstPhotosLoad', function () {
						tick(function () {
							DdMenu.fixSize();
						});
					}).on('selectFile', function (slide, file) {
						if (!slider || !file.nid)
							return;
						
						if (self.state.limit < 2) {
							if (!self.checkParentLimit()) {
								slider.toggleSelected(file.nid, false);
								return false;
							}
							if (self.onAttachSelect(file))
								self.menu.close();
							return false;
						}
						
						var is_delete = !slider.isSelected(file.nid);
						self._showSelectBtn();
						if (is_delete) {
							self.deleteAttach(file.nid, file.type);
							self.showQSelError('');
						} else {
							var avail = self.getAvail();
							if (avail < 0) {
								slider.toggleSelected(file.nid, false);
								self.limitError();
							}
						}
						DdMenu.fixSize();
						return false;
					});
					self.slider = slider;
					DdMenu.fixSize();
				}
			}
			self.state.form.trigger('AttachSelectorOpen', {
				ui: wrap
			});
			setTimeout(function () {
				DdMenu.fixSize();
				callback && callback();
			}, 0);
		};
		self.setupUploader(type, wait_upload ? null : callback_uploader, wait_upload ? callback_uploader : null);
		
		if (self.uploadAsAdult)
			el.find('.js-qsel_adult').parents('.js-checkbox').click();
	},
	setupUploader: function (type, callback, callback_upload) {
		var self = this;
		var handler = function (info) {
			var action = new Url(info.url);
			if (self.state.dir !== undefined) {
				action.query.dir = self.state.dir;
			} else {
				action.query.Att = 1;
				if (self.state.privateAttaches)
					action.query.Ss = 1;
			}
			if (self.state.commId && current_section == 'comm')
				action.query.Comm = self.state.commId;
			if (self.state.talkId)
				action.query.Talk = self.state.talkId;
			
			var main_view = self.view("main"),
				upload_view = self.view("upload"),
				upload_btn;
			
			if (main_view) {
				upload_btn = main_view.find('.js-qsel_upload_btn');
				upload_btn.find('.js-upload_btn_ico').removeClass('hide');
				upload_btn.find('.js-upload_btn_spinner').addClass('hide');
				upload_btn.removeClass('disabled');
 			}
 			
			if (FilesUploader.needStaticUpload()) {
				callback_upload && callback_upload();
				return;
			}
			
 			var by_duration = info.maxFileWeightByDuration;
			FileUploader.setup({
				name: "myFile",
				action: action.url(),
				multiple: true,
				denyUpload: info.FileExtWithRateRestrictionsForUpload,
				inlineFileWidget: self.state.limit < 2,
				maxFiles: self.state.limit,
				maxSize: info.maxSize * 1024 * 1024,
				uploadDrag: self.menu.content(),
				selectButton: main_view ? upload_btn : false,
				uploadWidget: upload_view ? upload_view.find('.js-qsel_upload_widget') : false,
				buttonClass: {
					hover: 'strong_clicked',
					active: 'strong_clicked_active'
				},
				type: type,
				mode: FileUploader.MODES.BUTTON
			});
			self.upload_inited = true;
			callback_upload && callback_upload();
		};
		
		self.upload_inited = false;
		
		Promise.all([import("../files_uploader"), import("../libs/FilesUploader"), import("../slider")])
			.then((m) => {
				FileUploader = m[0].default;
				FilesUploader = m[1].default;
				
				MAttachSelector._initUploader();
				callback && callback();
				
				Spaces.api("files.getUploadInfo", {Type: type}, function (info) {
					if (info.code == 0)
						handler(info);
				}, {
					cache: true,
					cacheTime: 1200,
					retry: 20
				});
			});
	},
	onAttachUpload: function (id, widget) {
		var self = this;
		if (self.state.attaches) {
			var upload = self.list.find('.js-attaches__upload');
			if (!upload.length) {
				self.list
					.prepend(upload = $('<div class="js-attaches__upload">'))
			}
			upload.append(widget);
		}
	},
	onAttachSelect: function (file, force_add, is_bbcode, widget) {
		var self = this;
		var evt = new $.Event('onNewAttach');
		self.state.form.trigger(evt, {file: file});
		if (evt.isDefaultPrevented())
			return false;
		
		if (is_bbcode)
			self.state.form.trigger('onNewAttachBb', {file: file});
		
		if (ge('#' + file.nid + '_' + file.type))
			return self.state.limit < 2;
		
		if (self.state.limit < 2) {
			self.deleteAll(true);
			self.new_attaches = [];
		}
		
		if (self.state.attaches) {
			var tiles = self.list.find('.js-attaches__tile'),
				plain = self.list.find('.js-attaches__plain');
			if (!tiles.length)
				self.list.append(tiles = $('<div class="js-attaches__tile attaches__wrap_tile">'));
			if (!plain.length)
				self.list.append(plain = $('<div class="js-attaches__plain">'));
			
			if (widget) {
				widget.tile ? tiles.append(widget.tile) : plain.append(widget.list);
			} else {
				file.show_preview ? tiles.append(tpl.attach(file)) : plain.append(tpl.attach(file));
			}
			
			tiles.toggle(tiles.find('.js-attach_item').first().length > 0);
			plain.toggle(plain.find('.js-attach_item').first().length > 0);
		}
		
		if (!force_add)
			self.new_attaches.push(file);
		self.checkAttList();
		
		return true;
	},
	typeAllowed: function (type) {
		var self = this;
		return $.inArray(+type, self.state.enabledTypes) >= 0;
	},
	setUploadErr: function (message) {
		var self = this, main = self.view("main");
		self.state.uploadError = message;
		if (main && message) {
			main.find('.js-qsel_upload_err').removeClass('hide').html(message);
			main.find('.js-qsel_upload_btn, .js-qsel_link_upload').addClass('hide');
		}
	},
	showError: function (message) {
		var self = this,
			view = self.view("action", true);
		if (view) {
			return view.html(tpl.error({
				text: message
			}));
		} else {
			return Spaces.showError(message);
		}
	},
	showQSelError: function (text) {
		var self = this;
		var ret = self.view("main", true).find('.js-qsel_error')
			.html(text ? tpl.error({text: text, no_button: true}) : '');
		DdMenu.fixSize();
		return ret;
	},
	setLoadling: function (flag) {
		var self = this;
		if (!self.view("action"))
			return;
		if (flag) {
			self.loading_last_view = self.last_view_name;
			self.view("action", true).append(tpl.spinner());
		} else {
			self.view(self.loading_last_view, true);
		}
	},
	setEditMode(flag) {
		this.state.isEditMode = flag;
	},
	setObjectId(id) {
		this.state.oid = id;
	},
	setObjectType(type) {
		this.state.ot = type;
	},
	sliderSelect: function () {
		var self = this;
		var selected = self.getSelected();
		for (var i = 0; i < selected.length; ++i)
			self.onAttachSelect(Spaces.core.extractFile(selected[i]));
	},
	saveAttaches: function (new_attaches, rendered) {
		var self = this;
		
		if (new_attaches.length) {
			var on_done = function (attaches) {
				if (self.state.attaches && !rendered)
					--deffer_render_cnt;
				self.checkComplete();
				// Заменяем заглушки на реальные аттачи
				if (attaches) {
					self.renderAttach(attaches.tiles, attaches.list);
				} else {
					// при ошибке удаляем все аттачи
					for (var i = 0; i < new_attaches.length; ++i)
						self.deleteAttach(new_attaches[i].nid, new_attaches[i].type);
				}
			};
			
			if (self.state.attaches && !rendered)
				++deffer_render_cnt;
			
			self.form.trigger('onSaveAttaches', {
				attaches: new_attaches,
				rendered,
				callback: function (attaches) {
					// Костыль для нестандартных аттачей
					on_done(attaches);
				}
			});
			self.checkComplete();
			
			if (!self.state.ot || (self.state.isEditMode && rendered))
				return;

			// Если надо юзаем стандартное API аттачей
			var api_data = {
				Oid: self.state.oid,
				Pid: self.state.pid,
				Ot: self.state.ot,
				Comm: self.state.commId,
				CK: null,
				atT: AttachSelector.getAttaches(self.state.form, true)
			};
			Spaces.api("attach.add", api_data, function (res) {
				if (res.code != 0) {
					Spaces.showApiError(res);
					on_done(false);
				} else {
					on_done(res.new_attaches);
				}
			}, {
				onError: function (err) {
					Spaces.showError(err);
					on_done(false);
				}
			});
		}
	},
	renderAttach: function (tiles_attaches, plain_attaches) {
		var self = this;
		$.each($.extend(plain_attaches, tiles_attaches), function (id, attach) {
			$('#' + id).replaceWith(attach);
		});
		if (!$.isEmptyObject(tiles_attaches)) {
			import("../gallery").then(function ({default: GALLERY}) {
				GALLERY.addPhoto();
			});
		}
		self.checkAttList();
	},
	checkComplete: function () {
		var self = this;
		if (!AttachSelector.isBusy())
			self.form.trigger('onAttachesComplete');
	},
	deleteAttach: function (id, type, silentDelete) {
		let self = this;
		
		let attach = $('#' + id + '_' + type);
		if (!attach.length)
			return;

		let file = MAttachSelector.parseFile(attach);
		let removeIcon = attach.find('.ico_buttons_close_darkblue');

		let onAttachDeleted = () => {
			attach.remove();
			self.state.form.trigger('onDeleteAttaches', {attaches: [file]});

			self.checkAttList();

			import("../gallery").then(function ({default: GALLERY}) {
				GALLERY.addPhoto();
			});
		};

		if (!self.state.ot || self.state.isEditMode || silentDelete) {
			onAttachDeleted();
			return;
		}

		// Если надо юзаем стандартное API аттачей
		let api_data = {
			Oid: self.state.oid,
			Pid: self.state.pid,
			Ot: self.state.ot,
			Comm: self.state.commId,
			CK: null,
			File_id: id,
			Ft: type
		};
		removeIcon.addClass('ico_spinner');
		Spaces.api("attach.delete", api_data, function (res) {
			if (res.code != 0) {
				removeIcon.removeClass('ico_spinner');
				Spaces.showApiError(res);
			} else {
				onAttachDeleted();
			}
		}, {
			onError(err) {
				Spaces.showError(err);
				removeIcon.removeClass('ico_spinner');
			}
		});
	},
	deleteAll: function (silent) {
		var self = this,
			attaches = self.getAttaches();
		for (var i = 0; i < attaches.length; ++i)
			self.deleteAttach(attaches[i].nid, attaches[i].type, silent);
	},
	markMusic: function (id, flag) {
		var self = this,
			el = self.view("main").find('[data-nid="' + id + '"]')
				.find('.ico_buttons_selected, .ico_buttons_select');
		
		if (self.state.limit < 2) {
			self.view("main").find('.ico_buttons_selected')
				.removeClass('ico_buttons_selected')
				.addClass('ico_buttons_select');
		}
		
		var old_state = el.hasClass('ico_buttons_select');
		if (flag !== undefined ? flag : old_state) {
			el.removeClass('ico_buttons_select');
			el.addClass('ico_buttons_selected');
		} else {
			el.removeClass('ico_buttons_selected');
			el.addClass('ico_buttons_select');
		}
		return !old_state;
	},
	getSelected: function () {
		var self = this;
		if (self.slider) {
			return self.slider.getSelected();
		} else if (self.view("main")) {
			var self = this, ret = [];
			self.view("main").find('.ico_buttons_selected').each(function () {
				ret.push($(this).parent());
			});
			return ret;
		}
		return [];
	},
	setParent: function (att) {
		var self = this;
		self.parent = att;
	},
	getAvail: function () {
		var self = this;
		return self.state.limit - self.getTotal();
	},
	getTmpCnt: function () {
		var self = this;
		return self.list.find('.js-attaches__upload').children().length;
	},
	getTotal: function () {
		var self = this;
		
		if (self.parent && !self.parent.getAvail())
			return self.state.limit;
		
		var attaches = self.getAttaches(),
			selected = self.getSelected(),
			tmp_upload = self.getTmpCnt(),
			exists = {}, cnt = attaches.length + tmp_upload;
		
		for (var i = 0; i < attaches.length; ++i)
			exists[attaches[i].nid + ":" + attaches[i].type] = 1;
		for (var i = 0; i < selected.length; ++i) {
			var file = Spaces.core.extractFile(selected[i]);
			if (!exists[file.nid + ":" + file.type])
				++cnt;
		}
		return cnt;
	},
	getAttaches: function (group) {
		var self = this, attaches = group ? {} : [];
		if (self.state.attaches) {
			self.list.find('.js-attach_item').each(function () {
				var el = $(this),
					file = MAttachSelector.parseFile(el);
				file.el = el;
				if (group) {
					if (!attaches[file.type])
						attaches[file.type] = [];
					attaches[file.type].push(file);
				} else {
					attaches.push(file);
				}
			});
			return attaches;
		} else {
			for (var i = 0; i < self.default_selected.length; ++i) {
				var file = self.default_selected[i];
				if (group) {
					if (!attaches[file.type])
						attaches[file.type] = [];
					attaches[file.type].push(file);
				} else {
					attaches.push(file);
				}
			}
			return attaches;
		}
	},
	checkAttList: function () {
		var self = this,
			has_attaches = self.list.find('.js-attach_item').first().length > 0 || 
				self.list.find('.js-attaches__upload').children().length > 0,
			has_tmp = self.list.find('.js-tmp_pg_spinner').length > 0;
		self.list.toggle(has_attaches || has_tmp);
		self.form.find('.js-attaches_show').toggleClass('hide', !has_tmp && !has_attaches);
		
		var tiles = self.list.find('.js-attaches__tile'),
			has_tiles = tiles.children().length > 0,
			plain = self.list.find('.js-attaches__plain'),
			has_plain = plain.children().length > 0;
		tiles.toggle(has_tiles);
		plain.toggle(has_plain);
		
		self.form.trigger('onAdultAttach', {
			hasAdult: self.list.find('[itemprop="requiredMinAge"]').length > 0
		});
	},
	selectDefault: function (nid, type) {
		var self = this;
		if (self.state) {
			if (self.slider) {
				self.slider.markSelected(nid);
			} else {
				self.markMusic(nid);
			}
			if (self.state.limit < 2)
				self.default_selected = [];
			self.default_selected.push({
				nid: nid, type: type,
				id: nid + '_' + type
			});
		}
	},
	view: function (name, do_switch) {
		var self = this;
		if (name === undefined)
			return self.last_view_name;
		
		if (!self.views_cache || $.isEmptyObject(self.views_cache)) {
			self.views_cache = {};
			var list = self.menu.content().find('[data-view]');
			for (var i = 0; i < list.length; ++i) {
				var el = $(list[i]);
				self.views_cache[el.data('view')] = el;
			}
		}
		
		if (name === self.last_view_name || !do_switch)
			return self.views_cache[name];
		
		var ret;
		for (var view_name in self.views_cache) {
			var view = self.views_cache[view_name];
			if (view_name === name) {
				ret = view;
				view.show();
			} else {
				if (view_name === self.last_view_name && view.data('empty'))
					view.empty();
				view.hide();
			}
		}
		
		self.last_view_name = name;
		tick(function () {
			DdMenu.fixSize();
		});
		
		return ret;
	},
	lock: function (flag) {
		var self = this;
		self.menu.close();
		self.state.link.data('locked', flag);
	},
	_showSelectBtn: function () {
		var self = this,
			main = self.view("main");
		if (main) { // Может быть вызвана после уничтожения UI
			var sel_button = main.find('.js-qsel_select_btn'),
				url_button = main.find('.js-qsel_download_url_btn'),
				url_input = main.find('.js-qsel_link_input'),
				has_url = $.trim(url_input.val()).length > 0,
				valid_url = FilesMonitor.checkUrl(url_input.val());
			
			sel_button.toggleClass('disabled', self.state.limit > 1 && !self.getSelected().length);
			
			if (has_url && valid_url)
				url_button.removeAttr("disabled");
			else
				url_button.attr("disabled", "disabled");
			
			url_input.toggleClass('text-input_error text-input_error_bg', has_url && !valid_url);
			DdMenu.fixSize();
		}
	},
	loadUrl: function () {
		var self = this;
		return self.loadImages(FilesMonitor.extractUrls(self.view("main").find('.js-qsel_link_input').val()), true);
	},
	limitError: function (n) {
		var self = this;
		n = n || self.state.limit;
		self.showQSelError(L('Превышен лимит количества файлов. Максимально можно прикрепить {0}. ',
			numeral(n, [L('$n файл'), L('$n файла'), L('$n файлов')])));
	},
	checkParentLimit: function () {
		var self = this;
		if (!self.parent)
			return true;
		
		if (!self.parent.getAvail()) {
			self.limitError(self.parent.state.limit);
			return false;
		}
		return true;
	},
	close: function () {
		var self = this;
		self.menu.close();
	},
	free: function () {
		var self = this;
		
		if (self.menu)
			self.menu.content().empty();
		if (self.slider)
			self.slider = null;
		
		self.new_attaches = [];
		self.default_selected = [];
		self.views_cache = self.last_view_name = null;
		
		lock_close = false;
	},
	destroy: function () {
		var self = this;
		self.free();
		self.menu = null;
	},
	ok: function () {
		return !!this.menu;
	},
	
	// TODO: вынести во что-нибудь универчальное?
	_initDragDrop: function () {
		var self = this;
		
		var moved = false, last_css, el_pos,
			placeholder = $('<div style="display: inline-block">&nbsp;</div>'),
			$shadow = $('<div>').css({
				position: 'absolute',
				cursor: 'pointer',
				background: 'rgba(255, 255, 255, 0)',
				top: 0, bottom: 0, left: 0, right: 0,
				zIndex: 999999999
			}),
			recheck_interval,
			recheck_data,
			current_el,
			current_el_size,
			current_ta;
		
		var recheck = function () {
			current_ta = self.state.form.find('textarea').findByPos(recheck_data);
			current_el[0].style.opacity = !current_ta ? 0.5 : 1;
		};
		
		self.list.draggable({
			realtime: true,
			fastEvents: true,
			disableContextMenu: false,
			forceStart: true,
			scroll: true,
			events: {
				dragStart: function (e) {
					current_el = self.list.find('.js-attach_item').findByPos({x: e.x, y: e.y});
					if (current_el) {
						last_css = current_el.prop("style").cssText;
						moved = false;
						recheck_interval = setInterval(recheck, 250);
						current_el_size = {
							x: e.x - current_el.offset().left,
							y: e.y - current_el.offset().top,
							w: current_el.width(),
							h: current_el.height()
						};
					}
				},
				dragMove: function (e) {
					if (!current_el)
						return;
					if (!moved) {
						el_pos = current_el.position();
						
						placeholder
							.outerWidth(current_el.outerWidth())
							.outerHeight(current_el.outerHeight());
						current_el.after(placeholder);
						self.list.after($shadow);
						
						current_el.css({
							position: 'absolute',
							left: 0, top: 0,
							right: 0, bottom: 0,
							userSelect: 'none',
							width: current_el.width(),
							height: current_el.height(),
							zIndex: 999999999,
							cursor: 'pointer',
							opacity: 0.5
						});
						moved = true;
					}
					
					if (!$.support.nativeAnim) {
						current_el[0].style.left = (el_pos.left + e.dX) + "px";
						current_el[0].style.top = (el_pos.top + e.dY) + "px";
					} else {
						current_el.transform({
							translate: [el_pos.left + e.dX, el_pos.top + e.dY]
						});
					}
				//	console.log(current_el_size);
					recheck_data = {
						x: e.x - current_el_size.x,
						y: e.y - current_el_size.y,
						w: current_el_size.w,
						h: current_el_size.h
					};
				},
				dragEnd: function (e) {
					if (!current_el)
						return;
					if (recheck_interval)
						clearInterval(recheck_interval);
					recheck_interval = null;
					if (moved) {
						placeholder.detach();
						$shadow.detach();
						if ($.support.nativeAnim)
							current_el.transform();
						current_el.prop("style").cssText = last_css;
						
						if (!e.trueTouch) {
							// Аццкие костыль - хром стал насилько кликать элемент после отпускания мыши
							var prevent_click_el = current_el;
							prevent_click_el.one('click._prevent_click', function (e) {
								e.preventDefault();
								e.stopPropagation();
								e.stopImmediatePropagation();
							});
							tick(function () {
								prevent_click_el.off('._prevent_click');
							});
						}
						
						if (current_ta) {
							var file = MAttachSelector.parseFile(current_el);
							current_ta.trigger('onDropAttach', file);
						}
						
						current_el = null;
						current_ta = null;
					}
				}
			}
		});
	}
});

module.on("component", function () {
	MAttachSelector.delayedInit();
});

module.on("componentpage", function () {
	MAttachSelector.init();
	FilesMonitor.init();
});

module.on("componentpagedone", function () {
	MAttachSelector.destroy();
	FilesMonitor.destroy();
	if (FileUploader)
		FileUploader.destroy();
});

export default AttachSelector;
