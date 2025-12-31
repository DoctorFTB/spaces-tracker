import module from 'module';
import require from 'require';
import $ from './jquery';
import Spaces from './spacesLib';
import page_loader from './ajaxify';
import DdMenu from './dd_menu';
import AttachSelector from './widgets/attach_selector';
import {L, tick} from './utils';

var params, spinner_avatar,
	type, cfg, last_api_request, editor_window, generator_window;

let on_destroy = [];

var TYPES = {
	// Аватарка юзера
	[Spaces.TYPES.USER]: {
		api: {
			edit: "anketa.photoEdit",
			remove: "anketa.photoDelete"
		},
		params: {
			photo: "Photo",
			curPhoto: "avatar",
			defPhoto: "default_avatar",
			uplPhoto: "upload_avatar"
		},
		ownAvatar: true,
		selector: 'js-my_avatar',
		selectorStub: 'js-my_avatar_stub',
		selectorParent: '',
		avatarType: 'user'
	},
	
	// Аватарка сообщества
	[Spaces.TYPES.COMM]: {
		api: {
			edit: "comm.logoEdit",
			remove: "comm.logoDelete"
		},
		params: {
			photo: "Logo",
			curPhoto: "logo",
			defPhoto: "default_logo",
			uplPhoto: "upload_logo"
		},
		bind: {Comm: "id"},
		selector: 'js-comm_avatar',
		selectorStub: 'js-my_avatar_stub',
		selectorParent: '',
		avatarType: 'comm',
		ownerIdParam: 'comm',
		selectorParams: {
			only_comm: true
		}
	},
	
	// Обложка беседы
	[Spaces.TYPES.MAIL_TALK]: {
		api: {
			edit: "mail.talkAvatarEdit",
			remove: "mail.talkAvatarDelete"
		},
		dir: 0,
		params: {
			photo: "Avatar",
			curPhoto: "avatar",
			defPhoto: "default_avatar",
			uplPhoto: "default_avatar"
		},
		bind: {Talk: "id"},
		selector: 'js-talk_avatar',
		selectorStub: 'js-my_avatar_stub',
		selectorParent: '',
		avatarType: 'mail',
		ownerIdParam: 'talk'
	},
	
	// Универсальный пикер
	['unknown']: {
		api: false,
		dir: undefined,
		closeAfterSelect: true,
		params: {},
		selector: 'js-picker_picture',
		selectorStub: 'js-picker_picture_stub',
		selectorParent: '#main ',
		avatarType: 'picker'
	}
};

var tpl = {
	spinner: function () {
		return '<div class="content-bl"><span class="ico ico_spinner"></span> ' + L("Загрузка...") + '</div>';
	}
};

var AvatarChange = {
	init: function () {
		var self = this;
		
		params = $('#change_avatar-buttons').data();
		if (!params)
			return;
		
		type = params.type;
		cfg = TYPES[type] || TYPES['unknown'];
		
		$('#change_avatar-buttons').on('onNewAttach', function (e, data) {
			// AttachSelector.select(data.file.nid, Spaces.TYPES.PICTURE);
			if (data.file.preview) {
				self.selectAvatar(data.file.nid, data.file.preview.previewURL, data.file.preview.previewURL_2x);
			} else {
				self.selectAvatar(data.file.nid, data.file.previewURL, data.file.previewURL_2x);
			}
			return false;
		}).on('AttachSelectorOpen', function (e, data) {
			$('.js-avatar_delete, .js-avatar_crop').toggle(params.photo_id > 0);
			
			tick(function () {
				AttachSelector.select(params.photo_id, Spaces.TYPES.PICTURE);
			});
		});
		
		require.component('widgets/attach_selector');
		
		$('#main').on('click', '.js-avatar_delete', function (e) {
			e.preventDefault(); e.stopPropagation();
			AttachSelector.select(0, Spaces.TYPES.PICTURE);
			self.selectAvatar(false);
			AttachSelector.close();
		}).on('click', '.change_avatar_sublink, .change_avatar_link', function (e) {
			var el = $(this);
			if (!el.hasClass('js-attach')) {
				e.preventDefault();
				
				var selector_params = {
					file_type:		Spaces.TYPES.PICTURE,
					form:			'#change_avatar-buttons',
					buttons:		"#change_avatar-buttons",
					uploadButtons:	"#change_avatar-upload-buttons",
					allowAlias:		true,
					fallback:		params.fallback ? params.fallback : $('#file_selector'),
					max_files:		1,
					avatar:			cfg.avatarType,
					only_upload:	!!params.photo_disabled,
					linkDownload:	true,
					fix_position:	-10,
					'public':		true,
					attaches:		false,
					noAutoSelect:	true,
					dir:			cfg.dir
				};
				
				// Id объекта, которому выбираем аватар
				if (cfg.ownerIdParam)
					selector_params[cfg.ownerIdParam] = params.id;
				
				// Доп. параметры селектору
				if (cfg.selectorParams)
					$.extend(selector_params, cfg.selectorParams);
				
				el.addClass('js-attach').data(selector_params);
				
				tick(function () { el.click(); });
			}
		}).on('click', '.js-avatar_generator', function (e) {
			e.preventDefault();
			e.stopPropagation();
			
			let link = $(this);
			let current_link = DdMenu.current().data("menu_opener");
			
			link.addClass('disabled').find('.js-ico').addClass('ico_spinner');
			
			if (!generator_window) {
				generator_window = new DdMenu({data: {
					scroll: true,
					fix_position: -10,
					preventCloseByClick: true
				}});
				generator_window.on('closed', () => {
					console.log('dd_menu_closed');
					import("./pic_generator").then(({default: PicGenerator}) => PicGenerator.destroy());
				});
			}
			
			import("./pic_generator").then(function ({default: PicGenerator}) {
				PicGenerator.init(generator_window.content(), {
					type: 'avatar',
					onInit() {
						generator_window.openAs(current_link);
					},
					onSelect(file_id, preview, preview_2x) {
						AvatarChange.selectAvatar(file_id, preview, preview_2x);
					},
					onCancel() {
						$('.change_avatar_link').click();
					}
				});
			});
		}).on('click', '.js-avatar_crop', function (e) {
			e.preventDefault();
			e.stopPropagation();
			
			let link = $(this);
			let current_link = DdMenu.current().data("menu_opener");
			
			link.addClass('disabled').find('.js-ico').addClass('ico_spinner');
			
			if (!editor_window) {
				editor_window = new DdMenu({data: {
					scroll: true,
					fix_position: -10
				}});
				editor_window.on('closed', function () {
					import("./avatar_crop").then(function ({default: AvatarCrop}) {
						AvatarCrop.destroy(editor_window.content());
					});
				});
			}
			
			import("./avatar_crop").then(function ({default: AvatarCrop}) {
				AvatarCrop.setup(editor_window.content(), {
					image: params.preview,
					image_2x: params.preview_2x,
					area: params.photo_area,
					rotate: params.rotate,
					onAvatarCrop(url, url_2x, area) {
						self.setAvatarLoading(true);
						self.setAvatarLoading(false, url, url_2x);
						Spaces.view.updateAvatars([url, url_2x]);
						params.photo_area = area;
					}
				}, function () {
					DdMenu.close();
					editor_window.openAs(current_link);
				});
			});
		});
	},
	destroy: function () {
		var self = this;
		
		for (let i = 0; i < on_destroy.length; i++)
			on_destroy[i]();
		on_destroy = [];
		
		if (last_api_request)
			Spaces.cancelApi(last_api_request);
		self.setAvatarLoading(false);
		last_api_request = cfg = params = null;
		generator_window = null;
		editor_window = null;
	},
	selectAvatar: function (file_id, file_thumb, file_thumb_2x) {
		var self = this;
		
		var api_data = {CK: null};
		api_data[cfg.params.photo] = file_id;
		
		if (cfg.bind) {
			$.each(cfg.bind, function (k, v) {
				api_data[k] = params[v];
			});
		}
		
		$('#change_avatar-file_id').val(file_id);
		
		if (cfg.api) {
			self.setAvatarLoading(true);
			if (last_api_request)
				Spaces.cancelApi(last_api_request);
			last_api_request = Spaces.api(file_id ? cfg.api.edit : cfg.api.remove, api_data, function (res) {
				if (res.code == 0) {
					params.preview = res.choose_area;
					params.preview_2x = res.choose_area_2x;
					
					params.photo_id = file_id;
					$('.js-avatar_delete, .js-avatar_crop').toggle(file_id > 0);
					DdMenu.fixSize();
					
					let stub = file_id ? res[cfg.params.curPhoto] : res[cfg.params.uplPhoto];
					let stub_2x = file_id ? res[`${cfg.params.curPhoto}_2x`] : res[`${cfg.params.uplPhoto}_2x`];
					let stub_srcset = stub_2x ? `${stub}, ${stub_2x} 1.5x` : '';
					
					let image = file_id ? res[cfg.params.curPhoto] : res[cfg.params.defPhoto];
					let image_2x = file_id ? res[`${cfg.params.curPhoto}_2x`] : res[`${cfg.params.defPhoto}_2x`];
					let srcset = image_2x ? `${image}, ${image_2x} 1.5x` : '';
					
					self.setAvatarLoading(false, stub, stub_srcset, file_id);
					params.photo_area = '';
					params.rotate = res.rotate;
					
					if (cfg.ownAvatar) {
						Spaces.view.updateAvatars([image, image_2x]);
					} else {
						// Обновляем все аватары
						$(cfg.selectorParent + '.' + cfg.selector + ' img')
							.prop("src", image)
							.prop("srcset", srcset)
							.addClass('preview--stub');
					}
					
					if (res.dating_error)
						Spaces.showMsg(res.dating_error, {type: "warn"});
					
					if (cfg.closeAfterSelect)
						DdMenu.close();
				} else {
					self.setAvatarLoading(false);
					Spaces.showApiError(res);
				}
			});
		} else {
			// Обновляем все аватары
			$(cfg.selectorParent + '.' + cfg.selector + ' img').each(function () {
				let img = $(this);
				let srcset = file_thumb_2x ? `${file_thumb}, ${file_thumb_2x} 1.5x` : '';
				
				img.css({width: img.prop("width"), height: img.prop("height")});
				img.prop("src", file_thumb).prop("srcset", srcset);
			});
			
			self.setAvatarLoading(true);
			self.setAvatarLoading(false, file_thumb, file_thumb_2x, file_id);
			
			params.preview = file_thumb;
			params.preview_2x = file_thumb_2x;
			params.photo_id = file_id;
			params.photo_area = '';
			params.rotate = 0;
			
			if (cfg.closeAfterSelect)
				DdMenu.close();
		}
	},
	setAvatarLoading: function (flag, new_image, new_srcset, is_upload) {
		is_upload = !!is_upload;
		if (flag) {
			spinner_avatar = $('.change_avatar_sublink .preview, .change_avatar_link .preview');
			spinner_avatar.data("old_src", spinner_avatar.prop("src"));
			spinner_avatar.data("old_srcset", spinner_avatar.prop("srcset"));
			spinner_avatar.addClass('preview--stub');
			spinner_avatar.prop("src", ICONS_BASEURL + 'preloader.gif').prop("srcset", "");
		} else if (spinner_avatar) {
			new_srcset = new_srcset || '';
			spinner_avatar
				.prop("src", new_image ? new_image : spinner_avatar.data("old_src"))
				.prop("srcset", new_image ? new_srcset : spinner_avatar.data("old_srcset"))
				.removeData('old_src');
			
			spinner_avatar.parents(cfg.selectorParent + '.' + cfg.selector + ', ' + cfg.selectorParent + '.' + cfg.selectorStub)
				.toggleClass(cfg.selector, is_upload)
				.toggleClass(cfg.selectorStub, !is_upload)
				.toggleClass('preview--stub', is_upload);
			
			spinner_avatar = null;
		}
	}
};

module.on("componentpage", function () {
	AvatarChange.init();
});

module.on("componentpagedone", function () {
	AvatarChange.destroy();
});
