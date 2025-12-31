import require from 'require';
import module from 'module';
import $ from './jquery';
import cookie from './cookie';
import Device from './device';
import {Class, TSimpleEvents} from './class';
import {Spaces, Url, Codes} from './spacesLib';
import SpacesApp from './android/api';
import page_loader from './ajaxify';
import {L, tick, extend} from './utils';

import './draggable';
import './anim';

import "Files/Gallery.css";
import { trackItemView } from './metrics/view-tracker';

var TRANSPARENT_STUB = ICONS_BASEURL + "pixel.png",
	HEADER_HEIGHT = 50,
	FOOTER_HEIGHT = 50,
	dev_is_ucweb = Device.type == 'ucbrowser',
	GALLERY_PRELOAD_PCT = 50,
	GALLERY_LOADER_LIMIT = 1,
	GALLERY_LOADER_MAX_LIMIT = 2,
	OPT_PLAY_W = 66;

// Настройки галлереи
var OPT_SLIDES				= 3,
	OPT_SHADOW_COLOR		= 'rgba(69, 69, 69, 0.95)', // Цвет тени для скрытия контента
	OPT_ZOOM_MAX			= 3,		// Максимальный зум
	OPT_MIN_SWIPE_SPEED		= 0.212,	// Минимальная скорость для свайпа
	OPT_SLIDE_DURATION		= 300,		// Длительность анимации слайда
	OPT_COOLDOWN_DURATION	= 300,		// Длительность анимации исправления позиции картинки
	OPT_CLOSING_DURATION	= 150,		// Длительность анимации закрытия
	OPT_ZOOM_DURATION		= 200,		// Длительность анимации зума
	OPT_FAST_CLOSE_LIMIT	= 9,		// Кличество пролистаных фото до которого будет работать быстрое закрытие
	OPT_CLOSING_PATH		= 100,		// Лимит пикселей для закрытия галлереи свайпом вверх
	OPT_PLAY_SIZE			= 0.35,		// Размер области кнопочки play
	OPT_BOUNCE_PAGING		= 1.5,		// Замедление, если нельзя перелистывать
	OPT_BOUNCE_ZOOM			= 10,		// Замедление зума
	OPT_BOUNCE_CLOSING		= 1.5,		// Замедление закрытия
	OPT_BOUNCE_CLOSE_TXT	= 5;		// Замедление текста с подсказкой закрытия

var LIKE_ICONS = [
	['ico_gallery_vote_up', 'ico_gallery_vote_up_on'],
	['ico_gallery_vote_down', 'ico_gallery_vote_down_on']
];

var has_shadows = Device.css('box-shadow', '0px 0px 0px #000', /\d\w/),
	gallery_transp = Device.type == 'desktop' && has_shadows,
	has_animations = $.support.nativeAnim,
	features = {
		zoom: has_animations
	},
	device_touch = Device.type == 'touch',
	
	failed_images = {},
	loading_images = {}, // Картинки, которые загружаются
	loaded_images = {}, // Картинки, которые точно загружены
	load_image_callback = {},
	
	groups_skip = {},
	items_list = {},
	items_cache = {},
	sorted_list = {},
	group_errors = {},
	override_count = {},
	override_offset = {},
	current,
	position_delta = 0,
	gallery_rect,
	last_scroll = 0,
	cid = 0,
	last_click_action,
	last_click_cnt = 0,
	
	error_states = [false, false, false],
	click_lock = false,
	lock_touch = false,
	gallery_gestures = false,
	global_lock = false,
	enable_check_adult = true,
	fullscreen,
	pc_fullscreen,
	last_jsc,
	Gallery,
	
	gallery, // главный блок галлереи
	gallery_container, // контейнер с картинкой и сиблингами
	
	old_body_css,
	touching = false,
	hide_notif_timeout,
	notif_showed;

// has_animations = false;
// gallery_gestures = false;

var tpl = {
	playBtn() {
		return `
			<div class="gallery__play_btn">
				<span class="ico_play_btn ico_play_btn_normal"></span>
			</div>
		`;
	},
	gallery: function (data) {
		var arrow_class = data.arrowSmall ? ' js-gallery_arrow' : '',
			arrow_wrap_class = !data.arrowSmall ? ' js-gallery_arrow' : '';
		var html = 
		'<div id="Gallery" class="gallery js-action_bar">' + 
			'<div class="gallery__page_shadow"></div>' + 
			'<div class="gallery__shadow"></div>' + 
			'<div class="gallery__side gallery__side_prev js-gallery_arrow" data-dir="-1" href="#gprev">' + 
				'<div class="gallery__side-arrow ico_gallery ico_gallery_arrow_left"></div>' + 
			'</div>' + 
			'<div class="gallery__side gallery__side_next js-gallery_arrow" data-dir="1" href="#gnext">' + 
				'<div class="gallery__side-arrow ico_gallery ico_gallery_arrow_right"></div>' + 
			'</div>' + 
			'<div class="gallery__fs_header">' + 
				'<div class="gallery__fs_btn js-gallery_cnt"></div>' + 
				'<a class="gallery__fs_btn right js-gallery_fullscreen" href="#fullscreen">' + 
					'<span class="ico_gallery ico_gallery_exit"></span>' + 
				'</a>' + 
			'</div>' + 
			'<div class="gallery__loader"></div>' + 
			'<div class="gallery__header" id="gallery_tools">' + 
				'<table class="gallery_cnt-table"><tr><td>' + 
					'<div class="gallery_cnt js-gallery_cnt"></div>' + 
				'</td></tr></table>' + 
				
				'<div class="gallery__header_inner">' + 
					'<a class="gallery__tools_button" href="" target="_blank" rel="noopener" id="g_dloadlink" title="' + L('Скачать') + '">' + 
						'<span class="ico_gallery ico_gallery_download m"></span>' + 
					'</a>' + 
					'<a class="gallery__tools_button" href="" target="_blank" style="display:none" rel="noopener" id="g_complaint" title="' + L('Жалоба') + '">' + 
						'<span class="ico_gallery ico_gallery_complaint m"></span>' + 
					'</a>' + 
					'<div class="gallery__tools_place">&nbsp;</div>' + 
					
					(Device.type == 'desktop' ? 
					'<a class="gallery__tools_button" href="#zoom" id="gallery__zoom" title="' + L('Увеличить') + '">' + 
						'<span class="ico_gallery ico_gallery_zoom m"></span>' + 
					'</a>' + 
					'<a class="gallery__tools_button js-gallery_fullscreen" href="#fullscreen" title="' + L('На весь экран') + '">' + 
						'<span class="ico_gallery ico_gallery_fullscreen m"></span>' + 
					'</a>' : '') + 
					
					'<a class="gallery__tools_button" href="#gallery_exit" id="gallery__exit" title="' + L('Закрыть') + '">' + 
						'<span class="ico_gallery ico_gallery_exit m"></span>' + 
					'</a>' + 
				'</div>' + 
			'</div>' + 
			'<div id="gallery-container" class="accel-3d">' + 
				'<div id="gallery_close_msg">'+
					'<span id="gallery_close_text">' + tpl.closeMsg() + '</span>' + 
					'<span id="gallery_closed_text">' + tpl.closeMsg(true) + '</span>' + 
				'</div>' + 
				'<div id="gallery_img_0_wrap" class="gallery-anim_hide gallery__image-wrapper accel-3d gallery-sibling">' + 
					'<img src="' + TRANSPARENT_STUB + '" alt="" id="gallery_img_0" class="gallery__image" />' + 
					'<div class="gallery__error gallery__image"></div>' + 
					tpl.playBtn() +
				'</div>' + 
				'<div id="gallery_img_1_wrap" class="gallery-anim_hide gallery__image-wrapper accel-3d">' + 
					'<img src="' + TRANSPARENT_STUB + '" alt="" id="gallery_img_1" class="gallery__image" />' + 
					'<div class="gallery__error gallery__image"></div>' + 
					'<center id="galleryVideo"></center>' + 
					tpl.playBtn() +
				'</div>' + 
				'<div id="gallery_img_2_wrap" class="gallery-anim_hide gallery__image-wrapper accel-3d gallery-sibling">' + 
					'<img src="' + TRANSPARENT_STUB + '" alt="" id="gallery_img_2" class="gallery__image" />' + 
					'<div class="gallery__error gallery__image"></div>' + 
					tpl.playBtn() +
				'</div>' + 
			'</div>' + 
			(Device.type != 'desktop' ? '<div class="gallery__descr hide" id="gallery_descr_wrap">' + 
				'<div class="gallery__descr_text" id="gallery_descr"></div>' + 
			'</div>' : '') + 
			'<div class="gallery__footer" id="gallery_bottom">' + 
				'<table class="gallery__footer_table"><tr>' + 
					'<td class="first gallery__link">' + 
						'<a href="" id="g_advancepage" title="' + L('Комментировать') + '">' + 
							'<span class="ico_gallery ico_gallery_mess"></span> <span id="g_commentCnt" class="gallery__link_text"></span>' + 
						'</a>' + 
					'</td>' +
					'<td class="gallery__link" id="g_collections" title="' + L('Сохранить к себе') + '" data-no_label="1" data-noclass="1">' + 
						'<span class="ico ico_plus_white"></span>' + 
					'</td>' +
					'<td class="gallery__link js-dd_menu_link" id="g_share" ' +
						'data-menu_id="g_share_menu" data-position="1" data-no_label="1" data-noclass="1" title="' + L('Поделиться') + '"' +
					'>' + 
						'<span class="ico ico_shared_white"></span>' + 
					'</td>' +
					(Device.type == 'desktop' ? '<td class="pointer js-descr_wrap">' + 
						'<div class="gallery__descr_text hide" id="gallery_descr_wrap">' + 
							'<div id="gallery_descr"></div>' +
						'</div>' + 
					'</td>' : '') + 
					'<td class="gallery__link">' + 
						'<a href="#glup" class="js-vote_btn" data-type="1" mode="gallery">' + 
							'<span class="ico_gallery ' + LIKE_ICONS[0][0] + '"></span> ' + 
							'<span class="js-vote_btn_cnt gallery__link_text"></span>' + 
						'</a>' + 
					'</td>' + 
					'<td class="last gallery__link">' + 
						'<a href="#gldown" class="js-vote_btn" data-type="-1" mode="gallery">' + 
							'<span class="ico_gallery ' + LIKE_ICONS[1][0] + '"></span> ' + 
							'<span class="js-vote_btn_cnt gallery__link_text"></span>' + 
						'</a>' + 
					'</td>' + 
				'</tr></table>' + 
			'</div>' + 
			'<div class="gallery__loader_shadow"></div>' + 
			'<div class="gallery__shadow_error" id="Gallery_error"></div>' + 
			'<div class="js-dd_menu_item user__dropdown-menu dropdown-menu__wrap js-share_menu js-fix_height" ' +
				'data-gallery-inline="1" data-scroll="1" data-toggle_same="1" data-events="1" data-in_gallery="1" id="g_share_menu"' +
			'>' +
				'<div class="widgets-group dropdown-menu js-ddmenu_content"></div>' +
			'</div>' +
		'</div>';
		return html;
	},
	error: function (msg) {
		return '<div class="gallery-error_msg">' + msg + '</div>';
	},
	loadError: function (data) {
		var html = 
			'<div class="gallery__error_inner">' + 
				data.message + 
				(data.action ? 
					'<br />' + 
					'<a href="#g-adult-show" class="gallery__button js-gallery_repeat" data-action="' + data.action + '">' +
						'<span class="ico_gallery ico_gallery_reload m"></span> ' + 
						'<span class="m">' + L("Повторить") + '</span>' + 
					'</a>' : '') + 
			'</div>';
		return html;
	},
	retry: function () {
		return '<div><a href="#g_retry" class="gallery__button">' + 
			'<span class="ico_gallery ico_gallery_reload m"></span> ' + 
			'<span class="m">' + L("Повторить") + '</span>' + 
		'</a></div>';
	},
	closeMsg: function (flag) {
		return (flag ? L('Отпустите, чтобы закрыть...') : L('Потяните, чтобы закрыть...'));
	},
	adult: function (data) {
		var item = data.content == 'video' ? L('Показать видео') : L('Показать фото');
		
		var html = 
			'<div class="gallery__error_inner">' + 
				L('Внимание! Эти материалы только для взрослых! ') + 
				L('Нажимая &quot;{0}&quot;, вы подтверждаете, ', item) + 
				L('что вам 18 или более лет.')+ '<br />' + 
				'<a href="#g-adult-show" class="gallery__button js-adult">' + 
					'<span class="ico_gallery ico_gallery_eye m"></span> ' + 
					'<span class="m">' + item + '</span>' + 
				'</a>' + 
			'</div>';
		return html;
	},
	notif: function (data) {
		var html = 
			'<div id="gallery_notif">' + 
				'<div class="gallery__notif_inner word_break">' + 
					data.text + 
					'<a href="#gnc" class="gallery__notif_close">' + 
						'<span class="ico_gallery ico_gallery_exit js-gallery_notif_close"></span>' + 
					'</a>' + 
				'</div>' + 
			'</div>';
		return html;
	},
	collectionsMotivator: function () {
		var html = 
			'<div class="t_center">' + 
				'Сохраните этот файл в свою коллекцию. Нажмите кнопку ' + 
					'<span class="ico ico_plus_white ico_no-mrg m pointer js-gallery_collection"></span>' + 
			'</div>';
		return html;
	},
	playerStub(preview) {
		return `
			<div class="js-vp video-player_container">
				<div class="js-vp_player_wrap video-player_wrap">
					<div class="video-player js-vp_player">
						<img src="${preview}" alt="" />
					</div>
				</div>
			</div>
		`;
	}
};

Gallery = {
	init: function () {
		var self = this;
		
		if (page_loader.ok()) {
			page_loader.onJSC('gallery', function (params) {
				tick(function () {
					if (params.match(/^[\/\d+\w+:_-]+$/)) {
						var args = params.split('/');
						if (args.length == 2)
							self.open(args[0], args[1], true);
					}
				});
			}, true);
		}
		
		page_loader.on('shutdown', "removegallery", function () {
			items_list = {};
			sorted_list = {};
			items_cache = {};
			group_errors = {};
			override_count = {};
			override_offset = {};
			self.off(false);
		});
		
		groups_skip = {};
		failed_images = {};
		loading_images = {};
		loaded_images = {};
		
		// для этих пропускаем инициализацию галлереи
		let divs = $.querySelectorAll('div.js-gallery_skip .gview_link:first-child');
		for (let i = 0, l = divs.length; i < l; i++)
			groups_skip[gallery_get_meta(divs[i]).gid] = 1;
	},
	
	open: function (gid, id, form_history, lite_open) {
		var self = this;
		id = +id;
		
		if (Device.android_app && !lite_open)
			self.pullToRefresh(false);
		
		if (form_history && sorted_list[gid])
			id = sorted_list[gid][id - (override_offset[gid] || 0)];
		
		gallery_rect = null;
		if (current && gid == current.gid && id == current.id) {
			self.update();
			return;
		}
		
		notif_showed = hide_notif_timeout = false;
		error_states = [false, false, false];
		
		var first_init = false;
		if (!current) {
			position_delta = 0;
			pc_fullscreen = fullscreen = false;
			
			global_lock = click_lock = lock_touch = false;
			
			var tmp_gid = Date.now();
			if (!lite_open) {
				last_scroll = $(window).scrollTop();
				if (!gallery_transp) {
					// Реклама Mobiads скроллит o_O, фиксим это
					$('html, body').scrollTop(0);
				}
			}
			
			first_init = true;
			
			if (page_loader.ok() && !form_history)
				page_loader.setJSC(false);
			
			if (!items_list[gid] || !items_list[gid][id]) {
				console.warn("[gallery] not found: " + gid + "/" + id);
				return;
			}
			
			gallery = $(tpl.gallery({
				mode: 'normal',
				id: tmp_gid
			}));
			
			var is_video = items_list[gid][id].content == 'video';
			gallery.toggleClass('gallery__touch', Device.type != 'desktop');
			
			var old_gallery = $('#Gallery');
			if (old_gallery.length) {
				old_gallery.replaceWith(gallery);
			} else {
				let gallery_wrap = $('<div id="gallery_wrap">');
				gallery_wrap.append(gallery);
				
				$('#main_wrap').append(gallery_wrap);
				$('body').addClass(gallery_transp ? 'gallery__transp_open' : 'gallery__open');
				$('html, body').addClass('gallery__doc');
			}
			gallery_container = $('#gallery-container');
			
			// Считаем, что не может попастся видео вперемешку с картинками. 
			gallery_gestures = !is_video && (has_animations || Device.type == 'touch');
			
			if (!is_video)
				self.initGestures();
			if (gallery_gestures) {
				if (!is_video)
					self.initMouseScale();
				gallery.toggleClass('gallery-anim', has_animations);
				$('#gallery-siblings').removeClass('hide');
			}
			
			gallery.on('click', '.js-gallery_collection', function (e) {
				e.preventDefault();
				self.hideNotif();
				Spaces.LocalStorage.set("hide-collections-motivator", true);
				tick(function () {
					$('#g_collections').click();
				});
			}).on('click', '.js-adult', function (e) {
				e.preventDefault();
				var el = $(this);
				
				enable_check_adult = false;
				
				self.update(true);
				
				Spaces.api("session.adultCheck", {Passed: 1});
				
				if (current.showOnAdult) {
					current.showOnAdult();
					delete current.showOnAdult;
				}
				
				// self.setError(false);
			}).on('click', '.js-gallery_repeat', function (e) {
				e.preventDefault();
				var action = $(this).data('action');
				if (action == 'img') {
					current.currImage = replace_image(current.currImage, current.item.image, current.item.image_2x, true);
					self.update(true);
				} else if (action == 'loader') {
					var callbacks = group_errors[current.gid].callbacks;
					self.setGroupError(current.gid, false);
					
					for (var i = 0; i < callbacks.length; ++i)
						callbacks[i]();
				}
			}).on('like', function (e, data) {
				if (current && current.item.loaded) {
					current.item.votingInfo.vote = data.polarity;
					current.item.votingInfo.likes_count = data.plus;
					current.item.votingInfo.dislikes_count = data.minus;
					self.syncLikes();
				}
			}).on('click', '.disabled', function (e) {
				e.preventDefault();
			//	e.stopPropagation();
				
				var link = $(this).find('a').attr("id") || $(this).attr("id"),
					object = current.item.content == 'video' ? L('видео') : L('фото'),
					errors = {
						g_advancepage: L('У этого {0} нет комментариев.', object),
						g_share: L("Этим {0} нельзя делиться.", object),
						g_collections: Spaces.params.nid ? 
							L("Это {0} нельзя сохранять в коллекции.", object) : 
							Spaces.view.onlyAuthMotivator()
					};
				
				let error = errors[link] || L('Функция недоступна.');
				Spaces.showMsg(error, {gallery: true, type: 'alert'});
			}).on('click', '.js-gallery_notif_close', function (e) {
				e.preventDefault();
				
				var notif = $('#gallery_notif');
				if (notif.find('.js-gallery_collection').length)
					Spaces.LocalStorage.set("hide-collections-motivator", true);
				
				self.hideNotif();
			}).on('click', '.js-descr_wrap', function (e) {
				e.preventDefault();
				$('#g_advancepage')[0].click();
			});
			gallery.on('click', '#g_collections', function (e) {
				var el = $(this);
				if (el.hasClass('disabled'))
					return;
				
				if (!current.collectionsLink) {
					e.preventDefault();
					e.stopPropagation();
					e.stopImmediatePropagation();
					
					self.autoHideNotif();
					Spaces.LocalStorage.set("hide-collections-motivator", true);
					
					var ico = el.find('.ico');
					ico.addClass('ico_spinner');
					
					el.data({
						nid:		current.item.nid,
						type:		current.item.type,
						extType:	current.item.extType,
						
					});
					
					current.collectionsLink = el;
					
					// Trigger component
					require.component(import.meta.id('./collections'));
					
					import('./collections').then(({default: FileCollections}) => {
						ico.removeClass('ico_spinner');
						FileCollections.init(el);
						el.click();
					});
				}
			});
			
			var start = Date.now();
			$('.js-gallery_arrow').on('click', function (e) {
				e.preventDefault();
				if (click_lock || current.scale != 1)
					return;
				var dir = +$(this).data('dir');
				self.move(dir);
			});
			$('.js-gallery_fullscreen').on('click', function (e) {
				e.preventDefault();
				if (click_lock)
					return;
				click_lock = true;
				setTimeout(function () {
					click_lock = false;
				}, 300);
				
				pc_fullscreen = !gallery.hasClass('gallery__fullcreen');
				self.toggleFullscreen(pc_fullscreen);
				gallery.toggleClass('gallery__fullcreen', pc_fullscreen);
				
				self.onResize();
			});
			$('#gallery__zoom').on('click', function (e) {
				e.preventDefault();
				if (click_lock)
					return;
				self.toggleZoom();
			});
			$('#gallery__exit').on('click', function (e) {
				e.preventDefault();
				self.exit();
			});
			$('#g_advancepage').on('click', function (e) {
				var a = new Url(location.href),
					b = new Url(this.href);
				if (a.isSame(b)) {
					e.preventDefault();
					self.exit(true);
				}
			});
			
			$('#main').on('like.gallery', function () {
				current && self.syncLikes();
			});
			
			$(window).on('keydown.gallery', function (e) {
				var code = e.keyCode;
				if (global_lock && code != Spaces.KEYS.ESC)
					return;
				
				e.preventDefault();
				if (code == Spaces.KEYS.ESC) {
					self.exit();
				} else if (code == Spaces.KEYS.UP) {
					self.toggleZoom(true);
				} else if (code == Spaces.KEYS.DOWN) {
					self.toggleZoom(false);
				} else if (code == Spaces.KEYS.LEFT) {
					self.move(-1);
				} else if (code == Spaces.KEYS.RIGHT) {
					self.move(1);
				}
			}).on('resize.gallery orientationchange.gallery', function (e) {
				self.onResize();
				
				// Тупой ucbrowser некорректные значения возвращает
				if (Device.browser.name == 'ucbrowser') {
					tick(() => self.onResize());
					setTimeout(() => self.onResize(), 50);
				}
			});
			
			if (items_list[gid].length < 2)
				gallery.addClass('one_image');
			
			page_loader.on('requestend', "removegallery", function (only_hash) {
				if (!only_hash || (last_jsc && location.hash != last_jsc))
					self.exit(true);
			}, true);
			page_loader.on('mailrequestend', "removegallery", function() {
				self.exit(true);
			}, true);
			
			import('./widgets/action_bar').then(({init}) => init($('#gallery_wrap')));
		}
		
		self.selectItem(gid, id, first_init, false, 0, form_history);
		if (current.item.content == 'video') {
			// Не нужны для видео
			gallery.find('#gallery__zoom, .js-gallery_fullscreen').remove();
		}
		
		self.blinkArrows();
		
//		if (current.item.content != 'video')
//			self.blinkButtons()
	},
	exit: function (from_cb, lite_exit) {
		var self = this;
		if (!current)
			return;
		
		if (Device.android_app && !lite_exit) {
			tick(function () {
				self.pullToRefresh(true);
			});
		}
		
		gallery.draggable(false);
		self.freeItem();
		
		$('#main').off('.gallery');
		$(window).off('.gallery');
		
		let restore_scroll = () => {
			$('html, body').scrollTop(last_scroll);
		};
		
		if (!lite_exit) {
			$('body').removeClass('gallery__transp_open gallery__open');
			$('html, body').removeClass('gallery__doc');
			document.body.style.cssText = old_body_css;
			old_body_css = null;
			gallery.remove();
			$('#gallery_wrap').remove();
			gallery = gallery_container = null;
		}
		
		page_loader.on('requestend', "removegallery", false);
		page_loader.on('mailrequestend', "removegallery", false);
		
		if (!lite_exit) {
			if (!gallery_transp) { // Скролл и так сохраняется
				restore_scroll();
				tick(restore_scroll);
				setTimeout(restore_scroll, 100);
			}
			self._onGroupTrigger(current.gid, 'exit', []);
		}
		
		current.collectionsFree && current.collectionsFree();
		
		current = null;
		
		if (!from_cb && page_loader.ok())
			history.back();
		
		if (Device.android_app) {
			// Костыль для перерисовки верхней панели, т.к. после закрытия фуллскрин просмотрщика она криво позиционируется. (Android 2.3)
			$('#pmb8876').remove();
			$('#navi').append('<div id="pmb8876">');
		}
	},
	
	pullToRefresh: function (flag) {
		SpacesApp.exec("pullToRefresh", {enable: flag});
		SpacesApp.exec("fullscreen", {enable: !flag, onlyHeader: true});
		SpacesApp.exec("sidebar", {enable: flag});
	},
	
	// Увеличение колёсиком
	initMouseScale: function () {
		var self = this,
			image_rect,
			base_scale,
			scale_timeout;
		
		if (!has_animations)
			return;
		
		var fix_scale = function () {
			scale_timeout = null;
			
			var metric = recalc_scale(gallery_rect, current.scale, current.imageX, current.imageY,
				image_rect.w, image_rect.h, true);
			
			self.toggleSiblings(false);
			self.setMoveAnim('transform', 'ease', OPT_COOLDOWN_DURATION, function () {
				if (current.scale <= 1)
					self.toggleZoom(false, true);
			});
			self.moveImage(metric.x, metric.y, metric.scale);
		};
		function onMouseWheel(evt) {
			if (global_lock)
				return;
			
			evt.preventDefault();
			evt.stopPropagation();
			
			var delta = -evt.deltaY || evt.detail || evt.wheelDelta;
			if (delta === undefined || !self.canScale())
				return;
			
			if (!scale_timeout) {
				var img = current.currImage;
				image_rect = {h: img.width(), w: img.height()};
				
				if (!image_rect.w || !image_rect.h || !current)
					return;
				
				base_scale = current.scale;
				
				self.setMoveAnim(false);
				self.toggleZoom(true, true);
			} else {
				clearTimeout(scale_timeout);
			}
			scale_timeout = setTimeout(fix_scale, 200);
			
			base_scale *= (delta > 0 ? 1.05 : 0.95);
			var metric = recalc_scale(gallery_rect, base_scale, current.imageX, current.imageY,
				image_rect.w, image_rect.h, false);
			self.moveImage(metric.x, metric.y, metric.scale);
		}
		
		var event_name, events = {
			onmousewheel: 'mousewheel',
			onwheel: 'wheel',
			DOMMouseScroll: 'DOMMouseScroll'
		};
		for (var k in events) {
			if (k in document) {
				event_name = events[k];
				break;
			}
		}
		
		gallery[0].addEventListener(event_name, onMouseWheel, false);
	},
	
	// Жесты и прочее
	initGestures: function () {
		var self = this;
		
		var bx, by, bs,
			x, y, moved = false, scaling = true,
			
			G_NONE = 0,
			G_CLOSING = 1,
			G_PAGING = 2,
			G_MOVING = 3,
			G_STUB = 4,
			state = G_NONE,
			
			type = 'none';
		
		var can_left, can_right,
			gallery_close_msg,
			gallery_toolbars,
			close_triggered = false,
			close_direction;
		
		var max_move_x, max_move_y;
		
		var inertia = new Spaces.Inertia(),
			prevent_clicks = false;
		
		var fix_zoom = function () {
			var metric = recalc_scale(gallery_rect, current.scale, current.imageX, current.imageY,
				max_move_x, max_move_y, false);
			
			self.toggleSiblings(false);
			self.setMoveAnim('transform', 'ease', OPT_COOLDOWN_DURATION, function () {
				if (current.scale <= 1)
					self.toggleZoom(false, true);
			});
			self.moveImage(metric.x, metric.y, metric.scale);
		};
		
		var base_dx, base_dy, dx, dy,
			allow_scale;
		gallery.draggable({
			disableContextMenu: false,
			onlyEvents: true,
			realtime: true,
			scroll: gallery_transp,
			detectZoom: true,
			fastEvents: true,
			forceStart: true,
			calcRelative: false,
			events: {
				zoomStart: function () {
					if (state == G_PAGING || state == G_NONE) {
						if (!scaling)
							self.toggleZoom(true, true);
						scaling = true;
					}
				},
				zoomEnd: function () {
					if (scaling && (state == G_PAGING || state == G_NONE))
						fix_zoom();
					scaling = false;
				},
				
				dragStart: function () {
					state = G_NONE;
					
					if (lock_touch || !current || global_lock)
						return;
					
					scaling = false;
					touching = true;
					
					self.setMoveAnim(false);
					
					can_left = self.canMove(1),
					can_right = self.canMove(-1);
					
					bx = current.imageY = current.imageY || 0;
					by = current.imageX = current.imageX || 0;
					bs = current.scale;
					
					inertia.start();
					
					base_dx = base_dy = 0;
					dx = dy = 0;
				},
				dragMove: function (e) {
					if (!touching || !current || global_lock)
						return;
					
					dx = e.dX - base_dx;
					dy = e.dY - base_dy;
					
					y = bx; x = by;
					
					if (!gallery_gestures)
						return;
					
					// Здесь определяем какое сейчас действие делаем юзер
					if (state == G_NONE) {
						var abs_dx = Math.abs(dx),
							abs_dy = Math.abs(dy),
							allow_close = !scaling && current.scale == 1;
						
						allow_scale = self.canScale();
						
						if (abs_dx > 5 || abs_dy > 5 || !allow_close) {
							base_dx = e.dX; base_dy = e.dY;
							
							dx = e.dX - base_dx;
							dy = e.dY - base_dy;
							
							if (abs_dy > 5 && abs_dx <= 5 && allow_close) {
								// Закрытие галлереи
								gallery_toolbars = $('#gallery_notif, #gallery_bottom, #gallery_tools, #gallery_zoom, #gallery_descr_wrap' + 
									(gallery_transp ? ', .gallery__shadow' : ''));
								
								state = G_CLOSING;
								if (has_animations) {
									gallery_close_msg = {
										wrap: $('#gallery_close_msg').show(),
										closeMsg: $('#gallery_close_text').css("opacity", "1"),
										closedMsg: $('#gallery_closed_text').css("opacity", "0"),
										msg: null
									};
									gallery_close_msg.msg = gallery_close_msg.closeMsg;
									
									gallery_toolbars
										.cssAnim('opacity', 'ease-out', OPT_CLOSING_DURATION)
										.css("opacity", 0);
									current.currImageWrap.css("overflow", "visible");
									close_triggered = false;
									self.switchShadow(true);
								}
							} else {
								// Листание
								state = G_PAGING;
								
								var max_sizes = self.getImageSize();
								max_move_x = max_sizes[0];
								max_move_y = max_sizes[1];
							}
						}
						
						self.toggleSiblings(state == G_PAGING && current.scale == 1 && !scaling);
					}
					
					if (state == G_PAGING) {
						// Если в сторону нельзя двигать - замедляем
						var scale = current.scale;
						if (e.scale && allow_scale)
							scale = bs * e.scale;
						
						if (current.scale != 1)
							y += dy;
						
						var denied = (!can_right && dx >= 0) || (!can_left && dx < 0);
						x += denied ? dx / OPT_BOUNCE_PAGING : dx;
						
						if (has_animations) {
							var metric = recalc_scale(gallery_rect, scale, x, y,
								max_move_x, max_move_y, false);
							self.moveImage(metric.x, metric.y, metric.scale);
						}
					} else if (state == G_CLOSING) {
						// Вывод текста с подсказкой закрытия галлереи
						var text_y = y + dy / OPT_BOUNCE_CLOSE_TXT;
						
						y += dy / OPT_BOUNCE_CLOSING; // Замедляем
						
						if (has_animations) {
							var abs_y = Math.abs(y);
							
							if (close_triggered != abs_y >= OPT_CLOSING_PATH) {
								close_triggered = abs_y > OPT_CLOSING_PATH;
								
								// Костыли с opacity - из-за UCWeb, который лажил в любых других вариантах, кроме этого
								gallery_close_msg.msg[0].style.opacity = 0;
								gallery_close_msg.msg = close_triggered ? gallery_close_msg.closedMsg : gallery_close_msg.closeMsg;
							}
							
							var text_style = gallery_close_msg.msg[0].style,
								image_style = current.currImageWrap[0].style;
							
							// Больше натянули - больше затемнили
							var pct = Math.max(0, Math.min(abs_y / (gallery_rect.h / 2), 1));
							image_style.opacity = (1 - (0.4 * pct)).toFixed(2);
							
							var text_style = gallery_close_msg.msg[0].style,
								text_opacity = Math.max(0, Math.min(abs_y / OPT_CLOSING_PATH, 1)).toFixed(2);
							if (dy < 0) {
								text_style.top = "-1em";
								text_y += gallery_rect.rh;
								text_style.opacity = text_opacity;
							} else {
								text_style.top = "0";
								text_style.opacity = text_opacity;
							}
							
							gallery_close_msg.wrap.transform({translate: [x, text_y]});
							self.moveImage(x, y);
						}
						close_direction = dy >= 0;
					}
					inertia.add(x, y);
				},
				dragEnd: function (e) {
					if (!touching || !current || global_lock)
						return;
					
					touching = false;
					inertia.end();
					
					if (state != G_NONE) {
						lock_clicks();
						
						var inertia_speed = inertia.speed(),
							inertia_data = inertia.inertia(4.7);
						
						if (state == G_PAGING) {
							var max_x = gallery_rect.w / 2;
							
							if (inertia_data) {
								if (current.scale == 1) {
									x += inertia_data.x;
									// y += inertia_data.y;
									
									var max_x2 = gallery_rect.w * 0.6;
									if (x > max_x2)
										x = max_x2;
									if (x < -max_x2)
										x = -max_x2;
									
									self.moveImage(x, y);
								} else {
									current.imageX += inertia_data.x;
									current.imageY += inertia_data.y;
								}
							}
							
							var metric = recalc_scale(gallery_rect, current.scale, current.imageX, current.imageY,
								max_move_x, max_move_y, true);
							
							var fast_swipe_left = current.scale == 1 && inertia_speed.speedX < -OPT_MIN_SWIPE_SPEED,
								fast_swipe_right = current.scale == 1 && inertia_speed.speedX > OPT_MIN_SWIPE_SPEED,
								can_swipe = current.scale == 1 || metric.overX;
							
							if ((x < -max_x || fast_swipe_left) && can_left && can_swipe) {
							//	console.log("left");
								self.move(1, true, true, true);
							} else if ((x > max_x || fast_swipe_right) && can_right && can_swipe) {
							//	console.log("right");
								self.move(-1, true, true, true);
							} else {
								// Восстанавливаем нормальную позицию
								self.setMoveAnim('transform, opacity', 'ease-out', OPT_SLIDE_DURATION);
								self.moveImage(metric.x, metric.y, metric.scale);
							}
							return;
						} else if (state == G_CLOSING) {
							x = 0; y = 0;
							var speed = inertia_speed.speedY,
								fast_close = (Math.abs(position_delta) < OPT_FAST_CLOSE_LIMIT && Math.abs(speed) > OPT_MIN_SWIPE_SPEED
									&& speed >= 0 == close_direction);
							
							if (has_animations) {
								gallery_close_msg.wrap.hide();
								if (close_triggered || fast_close) {
									self.lockTouch(true);
									self.setMoveAnim('transform, opacity', 'ease-out', OPT_CLOSING_DURATION, function () {
										self.lockTouch(false);
										self.exit();
									});
									self.moveImage(0, close_direction ? gallery_rect.h : -gallery_rect.h);
									current.currImageWrap.css("opacity", 0);
									return;
								} else {
									gallery_toolbars.cssAnim().css("opacity", "");
									current.currImageWrap.css({"opacity": "", "overflow": ""});
								}
								self.setMoveAnim('transform, opacity', 'ease-out', OPT_COOLDOWN_DURATION, function () {
									self.toggleSiblings(false);
								});
								self.moveImage(x, y);
								self.switchShadow(false);
							}
						}
					} else if (!click_lock) {
						// Загрузка оригинала для гифок
						if (current.item.gif && Math.abs(dx) <= 10 && Math.abs(dx) <= 10) {
							var offset = $('#Gallery').offset();
							var w = Math.max(OPT_PLAY_W, gallery_rect.w * OPT_PLAY_SIZE) * current.scale,
								h = gallery_rect.h * OPT_PLAY_SIZE * current.scale;
							var bx = (offset.left + (gallery_rect.x + gallery_rect.w) / 2 - w / 2) + current.imageX,
								by = (offset.top + (gallery_rect.y + gallery_rect.h) / 2 - h / 2) + current.imageY;
							
							if ((e.x >= bx && e.x <= bx + w) && (e.y >= by && e.y <= by + h)) {
								if (!current.gif_time || Date.now() - current.gif_time > 500) {
									self.playGif();
								}
								lock_clicks();
								return;
							}
						}
						
						var free_click = true;
						$('.js-gallery_arrow, .gallery__error_inner, #gallery_tools, #gallery_bottom, #gallery_notif').each(function () {
							if (match_element($(this), e.x, e.y)) {
								free_click = false;
								return false;
							}
						});
						
						if (gallery_transp && !match_element(gallery, e.x, e.y)) {
							tick(function () {
								self.exit();
							});
							free_click = false;
						}
						
						if (free_click && current.item.content != 'video') {
							if (!last_click_action) {
								last_click_action = setTimeout(function () {
									last_click_action = null;
									if (!click_lock && !touching) {
										if (last_click_cnt == 1) {
											if (gallery) {
												if (Device.type == 'desktop') {
													gallery.find('.js-gallery_fullscreen').click();
												} else {
													if (!pc_fullscreen)
														self.toggleFullscreen();
												}
											}
										} else if (last_click_cnt == 2) {
											self.toggleZoom();
										}
									}
									last_click_cnt = 0;
								}, 300);
							}
							++last_click_cnt;
						}
					}
					
					if (!current.inited) {
						tick(function () {
							self.postSelectItem();
						})
					}
				}
			}
		});
	},
	toggleSiblings: function (flag) {
		if (!current.siblings == !flag)
			return;
		current.siblings = !!flag;
	},
	setMoveAnim: function (prop, func, time, callback) {
		if (!has_animations || !gallery_gestures || !current.currImageWrap)
			return;
		
		if (current.siblings) {
			current.currImageWrap.cssAnim(false);
			gallery_container.cssAnim(prop, func, time, callback);
		} else {
			gallery_container.cssAnim(prop, func, time);
			if (current.fixZoom) {
				var one_callback = function () {
					var func = callback;
					callback = null;
					func && func();
				};
				current.fixZoom.img.cssAnim(prop, func, time, one_callback);
				current.currImageWrap.cssAnim(prop, func, time, one_callback);
			} else {
				current.currImageWrap.cssAnim(prop, func, time, callback);
			}
		}
	},
	moveImage: function (x, y, scale) {
		var self = this;
		
		if (!has_animations || !gallery_gestures)
			return;
		
		if (x === false) { // reset
			current.scale = 1;
			current.imageY = current.imageX = 0;
			current.currImageWrap.cssAnim(false);
			gallery_container.cssAnim(false).transform({
				translate: [0, 0]
			});
			return;
		}
		
		x = Math.round(x);
		y = Math.round(y);
		
		var old_scale = current.scale;
		if ((!scale || scale === current.scale) && current.imageY == y && current.imageX == x && current._fz == !!current.fixZoom && !current.invalidate) {
			current.currImageWrap.cssAnim(false);
			self.setMoveAnim(false);
			return;
		}
		delete current.invalidate;
		
		if (scale) {
			if (current.scale != scale) {
				current.scale = scale;
				self.recalcFrames(false);
				self.toggleZoom(current.scale != 1, true);
			}
			if (current.zoomDir != scale >= 1) {
				current.zoomDir = scale >= 1;
				gallery.toggleClass('gallery__zoom', current.zoomDir);
			}
		}
		current.imageY = y;
		current.imageX = x;
		current._fz = !!current.fixZoom;
		
		var fz = current.fixZoom;
		if (fz) {
			fz.img.transform({
				translate: [fz.x, fz.y + y],
				scale: fz.scale * current.scale
			});
		}
		
		if (!current.siblings || old_scale != 1) {
			gallery_container.transform({
				translate: [x, 0]
			});
			current.currImageWrap.transform({
				translate: [0, y],
				scale: current.scale
			});
		} else {
			gallery_container.transform({
				translate: [x, 0]
			});
		}
	},
	
	fixSiblings: function () {
		var self = this;
		self.syncErrors();
		if (!has_animations || !gallery_gestures || !current) {
			if (current.item.content != "video" && current)
				current.currImage = replace_image(current.currImage, current.item.image, current.item.image_2x, true);
			return;
		}
		
		var group_items = items_list[current.gid],
			neighbors = self.getNeighbors(current.gid, current.id, true);
		if (neighbors)
			self.recalcFrames(undefined, group_items[neighbors.next], group_items[neighbors.prev]);
	},
	getFrame: function (dir) {
		if (!has_animations)
			return dir < 0 ? 0 : (dir > 1 ? 2 : 1);
		dir = dir || 0;
		return get_slide_index(position_delta + 1 + (dir < 0 ? 2 : (dir > 0 ? -2 : 0)), 3);
	},
	syncErrors: function () {
		var self = this,
			group_items = items_list[current.gid],
			neighbors = self.getNeighbors(current.gid, current.id, true),
			idx = !has_animations ? [self.getFrame()] : [self.getFrame(-1), self.getFrame(0), self.getFrame(1)],
			
			prev = group_items[neighbors.prev],
			curr = current.item,
			next = group_items[neighbors.next],
			
			adult = [ // adult flags
				!!prev.adult && enable_check_adult,
				!!curr.adult && enable_check_adult,
				!!next.adult && enable_check_adult
			],
			load_error = [
				!!failed_images[prev.image],
				!!failed_images[curr.image],
				!!failed_images[next.image]
			],
			not_found = [
				!!prev.not_found,
				!!curr.not_found,
				!!next.not_found
			],
			blocked = [
				!!prev.blocked,
				!!curr.blocked,
				!!next.blocked
			],
			errors = [
				!!group_errors[current.gid],
				!!group_errors[current.gid],
				!!group_errors[current.gid]
			];
		for (var i = 0; i < 3; ++i) {
			var state = error_states[idx[i]];
			if (state != (not_found[i] || errors[i] || adult[i] || load_error[i])) {
				if (not_found[i]) {
					self.setImageError(idx[i], tpl.loadError({
						message: L('Пользователь удалил файл.'),
						action: false
					}));
				} else if (blocked[i]) {
					self.setImageError(idx[i], tpl.loadError({
						message: L('Файл заблокирован.'),
						action: false
					}));
				} else if (errors[i]) {
					self.setImageError(idx[i], tpl.loadError({
						message: group_errors[current.gid].errors.join('<br />'),
						action: 'loader'
					}));
				} else if (load_error[i]) {
					self.setImageError(idx[i], tpl.loadError({
						message: L('Ошибка загрузки изображения. Проверьте ваш интернет.'),
						action: 'img'
					}));
				} else {
					self.setImageAdult(idx[i], adult[i]);
				}
			}
		}
	},
	recalcFrames: function (dir, image_prev, image_next) {
		if (!has_animations || !gallery_gestures || !current || !gallery_rect)
			return;
		
		if (current.item.content == 'video')
			return;
		
		var self = this,
			delta = position_delta + 1,
			curr = get_slide_index(delta, 3),
			prev = get_slide_index(delta - 2, 3),
			next = get_slide_index(delta + 2, 3);
		
		if (dir !== false)
			self.moveImage(0, 0);
		
		var width = gallery_rect.w * 1.05,
			pos = [-width - (width / 2 * (current.scale - 1)), 0, width + (width / 2 * (current.scale - 1))],
			idx = [next, curr, prev],
			scale = +(+current.scale).toFixed(2);
		
		for (var i = 0; i < 3; ++i) {
			let img_wrap = $('#gallery_img_' + idx[i] + '_wrap');
			if (dir || idx[i] != curr) {
				img_wrap.transform({
					translate: [Math.floor(pos[i]), 0]
				});
			}
		}
		
		let recheckForGif = () => {
			$(`#gallery_img_${prev}_wrap`).toggleClass('gallery__gif', !!(image_prev && image_prev.gif));
			$(`#gallery_img_${curr}_wrap`).toggleClass('gallery__gif', !!current.item.gif);
			$(`#gallery_img_${next}_wrap`).toggleClass('gallery__gif', !!(image_next && image_next.gif));
		};

		if (dir) {
			// Замена соседней картинки, если нужно
			var prev_img = $('#gallery_img_' + next),
				next_img = $('#gallery_img_' + prev);
			if (dir < 0) {
				replace_image(prev_img, image_prev ? image_prev.image : TRANSPARENT_STUB, image_prev && image_prev.image_2x);
			} else {
				replace_image(next_img, image_next ? image_next.image : TRANSPARENT_STUB, image_next && image_next.image_2x);
			}
			
			current.currImage = $('#gallery_img_' + curr);
			current.currImageWrap = $('#gallery_img_' + curr + '_wrap');

			recheckForGif();
		} else if (image_prev || image_next) {
			set_image(current.currImage, current.item.image, current.item.image_2x);
			set_image($('#gallery_img_' + prev), image_prev ? image_prev.image : TRANSPARENT_STUB, image_prev && image_prev.image_2x);
			set_image($('#gallery_img_' + next), image_next ? image_next.image : TRANSPARENT_STUB, image_next && image_next.image_2x);
			recheckForGif();
		}
	},
	update: function (force) {
		var self = this;
		if (!current)
			return;
		
		var group_items = sorted_list[current.gid],
			loader_offset = override_offset[current.gid] || 0,
			prev_loaded = !loader_offset,
			next_loaded = (group_items.length + loader_offset >= override_count[current.gid]) || !override_count[current.gid];
		
		if (!prev_loaded || !next_loaded) {
			current.prev = current.n > 0 || !prev_loaded;
			current.next = current.n + 1 < group_items.length || !next_loaded;
		} else {
			current.prev = current.next = group_items.length > 1;
		}
		
		var is_video = current.item.content == "video";
		$('.js-gallery_arrow[data-dir="-1"]').toggleClass('hide', !current.prev || is_video);
		$('.js-gallery_arrow[data-dir="1"]').toggleClass('hide', !current.next || is_video);
		
		gallery.find('.js-gallery_cnt').text(L('{0} из {1}',
			loader_offset + current.n + 1, Math.max(group_items.length, override_count[current.gid] || 0)));
		
		if (force) {
			self.fixSiblings();
			self.syncErrors();
		}
	},
	selectItem: function (gid, id, first_init, partial_init, dir, form_history) {
		var self = this;
		if (current && gid == current.gid && id == current.id) {
			self.update();
			return;
		}
		
		self.freeItem();
		self.toggleZoom(false, true);
		
		var neighbors = self.getNeighbors(gid, id, true);
		var group_items = items_list[gid],
			item = items_list[gid][id],
			is_video = item.content == "video",
			total_items = sorted_list[gid].length,
			prev = neighbors.prev,
			next = neighbors.next;
		
		var old_item = current;
		current = {
			gid: gid,
			id: id,
			item: item,
			zoomed: false,
			scale: 1,
			siblings: true,
			n: neighbors.n
		};
		
		self.update();
		
		var image_prev = current.prev && ((gallery_gestures && current.prev) || id != prev) && group_items[prev],
			image_next = current.next && ((gallery_gestures && current.next) || prev != next) && group_items[next],
			
			image_prev_src = image_prev ? image_prev.image : TRANSPARENT_STUB,
			image_next_src = image_next ? image_next.image : TRANSPARENT_STUB;
		
		if (is_video || !has_animations || !gallery_gestures) {
			current.currImage = $('#gallery_img_1');
			current.currImageWrap = $('#gallery_img_1_wrap');
			
			$('#gallery_img_0').prop("src", image_prev_src);
			if (!is_video)
				current.currImage = replace_image(current.currImage, item.image, item.image_2x, true);
			$('#gallery_img_2').prop("src", image_next_src);
			self.syncErrors();
		} else {
			if (first_init) {
				var init_frames = function () {
					if (!gallery_rect)
						gallery_rect = get_gallery_rect();
					var width = gallery_rect.w * 1.05,
						pos = [-width, 0, width];
					for (var i = 0; i < 3; ++i) {
						$('#gallery_img_' + i + '_wrap').transform({
							translate: [pos[i], 0]
						}).removeClass('gallery-anim_hide');
					}
					
					current.currImage = $('#gallery_img_1');
					current.currImageWrap = $('#gallery_img_1_wrap');
					self.moveImage(false);
					
					$('#gallery_img_0_wrap').toggleClass('gallery__gif', !!(image_prev && image_prev.gif));
					$('#gallery_img_1_wrap').toggleClass('gallery__gif', !!item.gif);
					$('#gallery_img_2_wrap').toggleClass('gallery__gif', !!(image_next && image_next.gif));
					
					set_image($('#gallery_img_0'), image_prev_src, image_prev && image_prev.image_2x);
					set_image($('#gallery_img_2'), image_next_src, image_next && image_next.image_2x);
					set_image(current.currImage, item.image, item.image_2x);
					
					self.syncErrors();
				};
				// Иначе из-за get_gallery_rect() портится потом скролл
				// Потому что там получается offsetHeight галлереи, что заставляет насильно вызвать перерисовку страницы
				// И начинают происходить странные вещи со скроллом после закрытия галлереи
				// Если без инициированного юзером скролла будет меняться документ по высоте
				tick(init_frames);
			} else {
				self.recalcFrames(dir, image_prev, image_next);
			}
		}
		
		if (is_video)
			self.renderPlayer();
		
		// Ивент для загрузчика
		self._onGroupTrigger(current.gid, 'list', [{
			current: current.n,
			last: old_item ? old_item.n : false,
			total: total_items
		}]);
		
		if (!partial_init)
			self.postSelectItem(first_init, form_history);
		
		self.syncErrors();
		
		if (old_item && old_item.gifed) {
			old_item.gifed = false;
			old_item.currImage = replace_image(old_item.currImage, old_item.item.image, old_item.item.image_2x);
		}
		
		gallery.toggleClass('gallery__gif_playing', false);
		
		// Автоплей GIF
		if (first_init && current.item.gif)
			tick(() => self.playGif());
	},
	playGif: function () {
		var self = this;
		$('#Gallery').toggleClass('gallery__gif_playing', !current.gifed);
		current.currImage = replace_image(current.currImage, current.gifed ? current.item.image : current.item.gif, current.gifed ? current.item.image_2x : false);
		self.moveImage(current.imageX, current.imageY, 1);
		current.gifed = !current.gifed;
		current.gif_time = Date.now();
	},
	setImageAdult: function (image, flag) {
		this.setImageError(image, flag ? tpl.adult({content: current.item.content}) : false);
	},
	setImageError: function (image, text) {
		var self = this,
			id = 'gallery_img_' + image,
			parent = $('#' + id).parent(),
			error = parent.find('.gallery__error');
		if (text) {
			parent.addClass('gallery__show_error');
			error.html(text);
		} else if (error_states[image]) {
			parent.removeClass('gallery__show_error');
			error.empty();
		}
		error_states[image] = !!text;
		
		if (text && image == self.getFrame(0) && current.zoomed)
			self.toggleZoom(false);
	},
	hasError: function () {
		return !!(error_states[this.getFrame(0)] || current.hasError);
	},
	postSelectItem: function (first_init, form_history) {
		if (!current)
			return;
		
		var self = this,
			item = current.item;
		
		if (!first_init)
			self.moveImage(false);
		
		current.inited = true;
		self.toggleSiblings(false);
		
		if (features.zoom)
			$('#gallery__zoom').toggle(current.item.content != 'video');
		
		// Ссылка на скачивание
		$('#g_dloadlink').prop("href", item.download).toggle(!!item.download);
		
		if (page_loader.ok()) {
			var id = self.getItemPos();
			page_loader.setJSC('gallery', current.gid + '/' + id, !first_init || form_history);
			last_jsc = location.hash;
		}
		
		self.toggleSiblings(false);
		self.onResize(true);
		self.toggleSiblings(true);
		
		self.autoHideNotif();
		
		// Отслеживание просмотров
		var preview = $(current.item.el).find('.preview')[0];
		if (preview) {
			var viewer_token = preview.getAttribute("data-tv");
			if (viewer_token) {
				preview.setAttribute("data-t", viewer_token);
				preview.removeAttribute('data-tv');
			}
			trackItemView(preview);
		}
		
		if (item.loaded) {
			self.updateExtraInfo();
		} else {
			// Блокируем нижнюю панель до полной загрузки допю данных
			$('#gallery_bottom .gallery__link').addClass('disabled');
			
			// Загружаем дополнительные данные по API
			self.loadExtraInfo();
		}
	},
	setViewerInfo(gid, extra_info) {
		if (!items_list[gid]) {
			console.error(`[setViewerInfo] gid ${gid} not exists!`);
			return;
		}
		
		let extra_info_cache = {};
		for (let i = 0, l = extra_info.length; i < l; i++) {
			let item = extra_info[i];
			extra_info_cache[`${item.type}_${item.id}`] = item;
		}
		
		items_list[gid].forEach((item) => {
			let item_key = `${item.type}_${item.nid}`;
			if (item.nid && !item.loaded && extra_info_cache[item_key]) {
				$.extend(item, extra_info_cache[item_key]);
				item.loaded = true;
			}
		});
	},
	getNotLoadedItems() {
		let not_loaded = [];
		items_list[current.gid].forEach((item) => {
			if (item.nid && !item.loaded && !item.loading)
				not_loaded.push(item);
		});
		return not_loaded;
	},
	loadExtraInfo() {
		let not_loaded = this.getNotLoadedItems();
		if (!not_loaded.length)
			return;
		
		let api_data = {IdS: [], TyPes: [], PaRent_ids: [], PaRent_types: [], liSt_params: []};
		not_loaded.forEach((item) => {
			api_data.IdS.push(item.nid);
			api_data.TyPes.push(item.type);
			api_data.PaRent_ids.push(item.parentId || '');
			api_data.PaRent_types.push(item.parentType || '');
			api_data.liSt_params.push(item.listParams || '');
			item.loading = true;
		});
		
		let on_fail = () => {
			not_loaded.forEach((item) => {
				item.loading = false;
			});
		};
		
		let on_load_done = () => {
			if (current && !current.item.loaded && !current.item.loading) {
				let err = (current.item.content == 'video' ? L('Ошибка загрузки видео.') : L('Ошибка загрузки фото.'));
				Spaces.showMsg(err, {gallery: true, type: 'alert'});
			}
		};
		
		Spaces.api("files.getViewerInfo", api_data, (res) => {
			if (res.code == 0) {
				let need_refresh = false;
				
				not_loaded.forEach((item, index) => {
					let viewer_info = res.viewerInfo[index];
					if (viewer_info) {
						$.extend(item, viewer_info);

						// Если у нас в списке только "Поделиться с помощью..." и он не работает, то отключаем кнопку деления
						if (('shareLinks' in item) && item.shareLinks.length == 2 && typeof navigator.share !== 'function')
							item.shareLinks = false;

						item.loaded = true;
					} else {
						console.error('[loadExtraInfo] can\'t get viewer info for item:', item);
						item.loading = false;
					}
					
					if (current && current.item.n == item.n)
						need_refresh = true;
				});
				
				if (need_refresh)
					tick(() => this.updateExtraInfo());
			} else {
				console.error('[loadExtraInfo] ' + Spaces.apiError(res));
				if (current && !current.item.loaded)
					Spaces.showMsg(L('Ошибка загрузки: {0}', Spaces.apiError(res)), {gallery: true, type: 'alert'});
				on_fail();
			}
			
			on_load_done();
		}, {
			onError(err) {
				console.error('[loadExtraInfo] ' + err)
				
				if (current && !current.item.loaded)
					Spaces.showMsg(L('Ошибка загрузки: {0}', err), {gallery: true, type: 'alert'});
				
				on_fail();
				on_load_done();
			}
		});
	},
	updateExtraInfo() {
		let item = current.item;
		
		$('#Gallery').data('objectUrl', item.commentsLink);
		
		// Разблокируем нижню панель
		$('#gallery_bottom .gallery__link').removeClass('disabled');
		
		// Коллекции
		$('#g_collections').toggleClass('disabled', !item.saveLink);
		
		// Шеринг
		$('#g_share').toggleClass('disabled', !item.shareLinks);
		
		if (item.shareLinks)
			$('#g_share_menu .js-ddmenu_content').fastHtml(item.shareLinks.join(''));
		
		// Ссылка на обсуждение
		$('#g_advancepage').prop("href", item.commentsLink).toggleClass('mr_l_0', item.commentCnt > 0)
			.parents('td').toggleClass('disabled', !item.commentsLink || item.commentsLink.indexOf('#no_link') > 0);
		$('#g_commentCnt').text(item.commentCnt || '').toggle(item.commentCnt > 0);
		
		// Описание
		$('#gallery_descr').fastHtml(item.description);
		$('#gallery_descr_wrap').toggleClass('hide', !item.description || (item.content == 'video' && Device.type != 'desktop'));
		
		// Жалобы
		$('#g_complaint').prop("href", item.complainUrl).toggle(!!item.complainUrl);
		
		// Мотиватор коллекций
		if (!item.haveCollections && !Spaces.LocalStorage.get("hide-collections-motivator") && item.saveLink)
			tick(() => Gallery.showNotif(tpl.collectionsMotivator(), {timeout: false}));
		
		// Лайки
		this.syncLikes();
		
		if (item.content == 'video')
			this.renderPlayer();
	},
	renderPlayer: function () {
		let self = this;
		
		if (current.playerInited)
			return;
		
		// Временная заглушка для плеера, пока не получим его по API
		if (!current.item.loaded) {
			$('#galleryVideo').show().fastHtml(tpl.playerStub(current.item.preview));
			self.onResize();
			import('./widgets/video').then(() => self.onResize());
			return;
		}
		
		$('#galleryVideo').show().fastHtml(current.item.player);
		
		let video = $('#galleryVideo').find('.js-vp');
		video.removeClass('hide').addClass('js-vp_new');
		
		if (Device.type == 'desktop') {
			if (!current.item.adult || !enable_check_adult)
				video.data('autoplay', true);
		}
		
		require.component(import.meta.id('./widgets/video'));
		self.onResize();
		
		let last_current = current;
		require.fast(import.meta.id('./widgets/video'), ({vplayer}) => {
			if (last_current != current)
				return;
			
			let player = vplayer(video);
			self.onResize();
			
			player.ready(() => {
				if (last_current != current)
					return;
				
				self.onResize();
				
				if (Device.type == 'desktop') {
					current.showOnAdult = function () {
						player.play();
					};
				}
			});
			current.videoPlayer = player;
		});
		
		current.playerInited = true;
	},
	blinkArrows: function () {
		if (Device.type == 'desktop')
			return;
		
		var self = this,
			arrows = $('.gallery__side-arrow');
		
		if (self.arrows_timeout)
			clearTimeout(self.arrows_timeout);
		
		arrows.show();
		self.arrows_timeout = setTimeout(function () {
			self.arrows_timeout = false;
			arrows.hide(); // FIXME: fade out
		}, 1500);
	},
	syncLikes: function () {
		let self = this;
		let item = current.item;
		
		if (!item.loaded)
			return;
		
		require.component(import.meta.id('./likes'));
		
		if (item.parentId) { // Бинд лайков родительского объекта
			let type_id = item.parentType + '_' + item.parentId;
			let up = $('#' + type_id + '_voteUp');
			let down = $('#' + type_id + '_voteDown');
			
			if (up.length) {
				item.votingInfo = {
					is_owner:		Spaces.params.nid && (!up.length || up.data('disabled')),
					not_auth:		!Spaces.params.nid,
					hide_dislike:	!down.length,
					likes_count:	up.data('cnt'),
					dislikes_count:	down.data('cnt'),
					vote:			(up.data('clicked') ? 1 : (down.data('clicked') ? -1 : 0)),
					binded:			type_id
				};
			}
		}
		
		let vote_info = item.votingInfo;
		let is_disabled = vote_info.is_owner || vote_info.not_auth || item.type == Spaces.TYPES.EXTERNAL_VIDEO;
		
		gallery.find('.js-vote_btn').each(function () {
			let btn = $(this);
			let counter = btn.find('.js-vote_btn_cnt');
			let vote_id = item.type + '_' + item.nid;
			let vote_type = btn.data('type');
			let cnt = vote_type < 0 ? +vote_info.dislikes_count : +vote_info.likes_count;
			
			counter.attr("id", 'vote_' + (vote_type < 0 ? 'down' : 'up') + '_cnt_' + vote_id)
				.toggleClass('mr_l_0', !cnt).text(cnt || '');
			
			btn.attr({
				id: vote_id + (vote_type < 0 ? '_voteDown' : '_voteUp'),
				title: (vote_type < 0 ? L('Против {0}', cnt) : L('За {0}', cnt))
			}).data({
				cnt:			cnt,
				oid:			item.nid,
				ot:				item.type,
				disabled:		is_disabled,
				vote_id:		vote_id,
				clicked:		vote_info.vote == vote_type,
				privatePhoto:	!!vote_info.hide_dislike,
				binded:			vote_info.binded || ""
			});
			
			btn.parents('td')
				.toggleClass('js-clicked', vote_info.vote == vote_type)
				.toggleClass('disabled', !!(is_disabled || (vote_type < 0 && vote_info.hide_dislike)));
		});
	},
	freeItem: function () {
		var self = this;
		if (!current)
			return;
		
		let player = current.videoPlayer;
		if (player)
			tick(() => player.destroy());
		
		let collections = current.collectionsLink;
		if (collections) {
			current.collectionsLink = null;
			import('./collections').then(({default: FileCollections}) => {
				FileCollections.freeInstance(collections);
			});
		}
	},
	getItemPos: function () {
		return (current.n + (override_offset[current.gid] || 0));
	},
	getMaxZoom: function () {
		var self = this,
			thumb_size = parse_thumb_size(current.item.image);
		
		if (!thumb_size || !current.item.size)
			return 1;
		
		var real_thumb_size = resize_image(current.item.size[0], current.item.size[1], thumb_size[0], thumb_size[1]), // Тумба с сервера
			inner_thumb = resize_image2(real_thumb_size[0], real_thumb_size[1], gallery_rect.w, gallery_rect.h), // Тумба внутри галлереи
			def_zoom = Math.max(current.item.size[0], current.item.size[1]) / Math.max(inner_thumb[0], inner_thumb[1]),
			def_zoom2 = Math.max(current.item.size[0], current.item.size[1]) / Math.max(real_thumb_size[0], real_thumb_size[1]);
		
		OPT_ZOOM_MAX = Math.max(2, def_zoom);
		return [def_zoom, def_zoom2];
	},
	getImageSize: function () {
		var self = this,
			thumb_size = parse_thumb_size(current.item.image);
		if (!thumb_size || !current.item.size)
			return [current.currImage.width(), current.currImage.height()]
		var real_thumb_size = resize_image(current.item.size[0], current.item.size[1], thumb_size[0], thumb_size[1]), // Тумба с сервера
			inner_thumb = resize_image2(real_thumb_size[0], real_thumb_size[1], gallery_rect.w, gallery_rect.h); // Тумба внутри галлереи
		return [inner_thumb[0], inner_thumb[1]];
	},
	toggleZoom: function (state, no_anim) {
		var self = this
		
		if (!current || current.item.content == "video" || !features.zoom)
			return;
		
		if (state === undefined)
			state = !current.zoomed;
		
		if (state == current.zoomed)
			return;
		
		if (state && !self.canScale())
			return;
		
		self.autoHideNotif();
		
		current.zoomDir = true;
		current.zoomed = state;
		gallery.toggleClass('gallery__zoom gallery__nav_hide', current.zoomed);
		
		$('#gallery__zoom').attr("title", current.zoomed ? L("Уменьшить") : L("Увеличить"));
		
		var session_id = 'session_id:' + Date.now(),
			max_zoom = self.getMaxZoom(),
			def_zoom = Math.max(1.4, max_zoom[0]);
		
		current.zoomId = session_id;
		
		var on_before_zoom_changed = function () {
			if (!state) {
				gallery.removeClass('gallery__loading');
				if (current.fixZoom) {
					current.currImage.removeClass('hide');
					current.fixZoom.img.remove();
					current.fixZoom = false;
				}
			}
		};
		var on_after_zoom_changed = function () {
			if (state && max_zoom[1] >= 1.1) {
				gallery.addClass('gallery__loading');
				var callback = function (src, status) {
					if (current && current.zoomId == session_id && current.zoomed && !current.fixZoom) {
						gallery.removeClass('gallery__loading');
						if (current.scale <= 1) {
							setTimeout(function () {
								callback(src, status);
							}, 1000);
							return;
						}
						
						var zoom_img = $('<img>', {id: 'gallery_img_z', src: src});
						current.currImage.addClass('hide').parent().after(zoom_img);
						
						current.fixZoom = {
							img: zoom_img,
							scale: 1 / max_zoom[0]
						};
						self.onResize(true);
					}
					// Костыль, т.к. картинка большая и может вытесниться из кэша
					delete loaded_images[src];
				};
				load_image(current.item.download, null, callback);
			}
		};
		
		if (!no_anim) {
			if (Device.browser.name == 'ucbrowser') {
				on_before_zoom_changed();
				on_after_zoom_changed();
				self.toggleSiblings(false);
				self.setMoveAnim(false);
				self.moveImage(0, 0, state ? def_zoom : 1);
				self.toggleSiblings(!state);
			} else {
				self.toggleSiblings(false);
				on_before_zoom_changed();
				self.setMoveAnim('transform', 'ease-out', OPT_ZOOM_DURATION, function () {
					if (!state)
						self.toggleSiblings(true);
					on_after_zoom_changed();
				});
				self.moveImage(0, 0, state ? def_zoom : 1);
			};
		} else {
			on_before_zoom_changed();
			on_after_zoom_changed();
			self.toggleSiblings(!state);
		}
	},
	lockTouch: function (f) {
		lock_touch = f;
	},
	toggleFullscreen: function (flag) {
		var self = this;
		fullscreen = typeof flag == 'boolean' ? flag : !fullscreen;
		gallery.toggleClass('gallery_hide-toolbars', fullscreen);
		gallery_rect = undefined;
		self.onResize(true);
		
		if (!fullscreen)
			self.blinkArrows();
	},
	isFullscreen: function () {
		return fullscreen;
	},
	blinkButtons: function () {
		var i = 0;
		var interval = setInterval(function () {
			if (i == 0) {
				gallery.addClass('gallery__side-arrow_show');
			} else if (i == 1) {
				clearInterval(interval);
				
				gallery.removeClass('gallery__side-arrow_show');
				gallery.addClass('gallery__animation-ended');
			}
			++i;
		}, 1000);
	},
	canScale: function () {
		return current && (!current.gifed ? loaded_images[current.item.image] : loaded_images[current.item.gif]) && !this.hasError();
	},
	canMove: function (dir) {
		var self = this;
		if (dir < 0 && !current.prev)
			return false;
		if (dir > 0 && !current.next)
			return false;
		return sorted_list[current.gid].length > 1;
	},
	needLoad: function (dir) {
		var self = this;
		if (!self.canMove(dir))
			return false;
		
		var offset = override_offset[current.gid] || 0,
			count = override_count[current.gid];
		
		if (dir < 0 && offset && current.n < 1)
			return true;
		if (dir > 0 && count && current.n >= sorted_list[current.gid].length - 1 && offset + current.n < count - 1)
			return true;
		
		return false;
	},
	// Получить соседей
	getNeighbors: function (gid, n, cycle) {
		var self = this, files = sorted_list[gid];
		for (var i = 0, l = files.length; i < l; ++i) {
			if (files[i] == n) {
				return {
					prev: i > 0 ? files[i - 1] : (cycle ? files[files.length - 1] : false),
					next: i + 1 < files.length ? files[i + 1] : (cycle ? files[0] : false),
					n: i
				}
			}
		}
		return false;
	},
	move: function (dir, anim, partial, from_touch) {
		if (!current)
			return;
		
		var self = this,
			group_items = sorted_list[current.gid];
		
		self.setMoveAnim(false);
		
		if (lock_touch)
			return;
		
		if (self.needLoad(dir)) {
			self._onGroupTrigger(current.gid, 'load', [{
				dir: dir
			}]);
			if (self.needLoad(dir)) {
				Gallery.setLoading(true);
				return;
			}
			
			if (!anim) {
				tick(function() {
					self.move(dir, false);
				});
				return;
			}
		}
		
		dir = dir >= 0 ? 1 : -1;
		
		if (dir < 0 && !current.prev)
			return;
		if (dir > 0 && !current.next)
			return;
		
		if (gallery_gestures && has_animations) {
			if (anim) {
				var do_anim = function () {
					self.toggleSiblings(true);
					self.setMoveAnim('transform', 'ease-out', OPT_SLIDE_DURATION, function () {
						self.move(dir, false, touching);
					});
					var width = gallery_rect.w * 1.05;
					self.moveImage((width + (width / 2 * (current.scale - 1))) * -dir, 0);
				};
				dev_is_ucweb ? tick(do_anim) : do_anim();
				return;
			}
		} else {
			anim = partial = false;
		}
		
		var new_item = current.n + dir
		if (new_item >= group_items.length)
			new_item = 0;
		if (new_item < 0)
			new_item = group_items.length - 1;
		
		new_item = sorted_list[current.gid][new_item];
		
		position_delta += dir;
		self.selectItem(current.gid, new_item, false, partial, dir);
	},
	switchShadow: function (inset) {
		if (gallery_transp) {
			var max = Math.ceil(Math.max(($(window).innerWidth() - gallery_rect.w) / 2, ($(window).innerHeight() - gallery_rect.rh / 2))),
				shadow = '0px 0px 0px ' + max + 'px ' + OPT_SHADOW_COLOR;
			gallery.css(has_shadows, shadow + (inset ? ', inset ' + shadow : ''));
		}
	},
	onResize: function (manual) {
		var self = this;
		
		if (!current)
			return;
		
		if (!gallery_rect || !manual) {
			let inner_h = $(window).innerHeight();
			let min_height = Math.max(window.innerHeight, inner_h);
			
			if (old_body_css == null)
				old_body_css = document.body.style.cssText;
			
			if (Device.type == 'ucbrowser') {
				// SPAC-14658
				document.body.style.cssText = old_body_css + "; height:" + min_height + "px !important";
			} else {
				document.body.style.cssText = old_body_css + "; " + (inner_h != min_height ? "min-height:" + min_height + "px !important" : "");
			}
			
			gallery_rect = get_gallery_rect();
			
			tick(() => {
			//	alert("rh:"+gallery_rect.rh+",h:"+screen.availHeight+",wh:"+window.innerHeight);
			});
		}
		
		self.switchShadow(false);
		
		if (current.hasError) {
			var err = $('#Gallery_error .gallery-error_msg');
			err.css("top", (gallery_rect.rh - err.height()) / 2);
		}
		
		if (current.item.content == 'video') {
			let gallery_video = $('#galleryVideo').find('.js-vp');
			let aspect = 16 / 9; // на текущий момент плеер всегда 16:9
			
			// У плеера может быть небольшой тулбар снизу, пробуем его вычислить
			let extra_height = get_player_extra_height(gallery_video.width(), gallery_video.height(), aspect);
			
			let max_height = gallery_rect.h - extra_height;
			let player_width = gallery_rect.w;
			let player_height = Math.floor(player_width / aspect);
			
			if (player_height > max_height) {
				player_height = max_height;
				player_width =  Math.floor(player_height * aspect);
			}
			
			gallery_video
				.css("margin-top", (max_height - player_height) / 2 + "px")
				.css("max-width", player_width + "px");
		} else {
			if (!manual)
				self.recalcFrames();
		}
		
		if (!manual) {
			tick(function () {
				if (current) // Может выполниться после закрытия из-за tick()
					self.moveImage(current.imageX, current.imageY);
			});
		}
		
		var fz = current.fixZoom;
		if (fz) { // Фиксим зум
			var def_zoom = self.getMaxZoom()[0],
				diff = def_zoom / (1 / fz.scale),
				curr_scale = current.scale * diff;
			
			fz.scale = 1 / def_zoom;
			
			fz.x = Math.round((gallery_rect.w - current.item.size[0]) / 2);
			fz.y = Math.round((gallery_rect.rh - current.item.size[1]) / 2);
			
			// Фиксим положение
			var metric = recalc_scale(gallery_rect, curr_scale, current.imageX, current.imageY, true);
			current.invalidate = true;
			self.moveImage(metric.x, metric.y, metric.scale);
		}
	},
	addPhoto: function (pics) {
		var self = this;
		
		// TODO: сделать списочки, который сами дополняются нормально
		sorted_list = {};
		
		var current_fixed = false;
		
		if (!pics)
			pics = document.getElementsByClassName('gview_link');
		
		for (var i = 0; i < pics.length; ++i) {
			var pic = pics[i],
				item = gallery_get_meta(pic),
				gid = item.gid;
			
			if (groups_skip[gid])
				continue;
			
			if (!items_list[gid])
				items_list[gid] = [];
			if (!sorted_list[gid])
				sorted_list[gid] = [];
			
			if (!pic.gallery_cache_id) {
				var n = items_list[gid].length;
				
				pic.onclick = self._openLink;
				
				pic.gallery_cache_id = ++cid;
				items_cache[pic.gallery_cache_id] = item; // кэшируем, getAttribute тяжёлый
				
				items_list[gid].push(item);
				
				item.n = n;
				item.el.setAttribute('data-gallery_id', n);
			}
			
			if (current && current.item.n == item.n) {
				current.n = sorted_list[gid].length;
				current_fixed = true;
			}
			
			sorted_list[gid].push(item.n);
		}
		
		if (current && !current_fixed) {
			var gid = current.gid, id = self.getItemPos();
			if (!sorted_list[gid][id])
				id = sorted_list[gid].length - 1;
			self.exit(true, true);
			self.open(gid, id, true, true);
		}
	},
	reopen: function () {
		var self = this;
		if (current) {
			var gid = current.gid,
				id = current.id;
			self.exit(true, true);
			self.open(gid, id, true, true);
		}
	},
	_openLink: function (e) {
		e = e || window.event;
		e.stopPropagation && e.stopPropagation();
		e.stopImmediatePropagation && e.stopImmediatePropagation();
		
		if ($.draggableNoClick())
			return false;
		
		var el = $(this),
			meta = gallery_get_meta(el[0]);
		Gallery.open(meta.gid, meta.n);
		return false;
	},
	removeFiles: function (gid, dir, limit, item_wrap) {
		var self = this,
			sorted_group_items = sorted_list[gid],
			group_items = items_list[gid];
		
		var chunk = [];
		if (dir < 0) {
			for (var i = 0; i < limit; ++i) {
				var id = sorted_group_items[i],
					el = group_items[id].el;
				items_cache[el.gallery_cache_id] = null;
				chunk.push(el);
				items_list[id] = null;
			}
			if (current)
				current.n -= limit;
			sorted_list[gid] = sorted_group_items.splice(limit);
		} else {
			for (var i = sorted_group_items.length - limit; i < sorted_group_items.length; ++i) {
				var id = sorted_group_items[i],
					el = group_items[id].el;
				items_cache[el.gallery_cache_id] = null;
				chunk.push(el);
				items_list[id] = null;
			}
			sorted_list[gid] = sorted_group_items.splice(0, sorted_group_items.length - limit);
		}
		item_wrap ? $(chunk).parents(item_wrap).remove() : $(chunk).remove();
	},
	// Получить limit файлов с позиции offset
	getFiles: function (gid, offset, limit, item_wrap) {
		var self = this,
			files = sorted_list[gid],
			chunk = [];
		if (files) {
			for (var i = offset, l = Math.min(files.length, offset + limit); i < l; ++i) {
				var item = items_list[gid][files[i]];
				chunk.push(item_wrap ? $(item.el).parents(item_wrap)[0] : item.el);
			}
		}
		return chunk;
	},
	
	// Совместимость со старой галлереей
	onGroup: function (gid, action, cbk) {
		var self = this;
		return self.on(action + ':' + gid, cbk);
	},
	unlockGroup: function (gid) {
		groups_skip[gid] = null;
		delete groups_skip[gid];
	},
	_onGroupTrigger: function (gid, action, args) {
		var self = this;
		return self._trigger(action + ':' + gid, args);
	},
	setBaseOffset: function (gid, count) {
		override_offset[gid] = count;
	},
	setGroupVisibleCount: function (gid, count) {
		override_count[gid] = count;
	},
	getGroupCnt: function (gid, total) {
		if (!sorted_list[gid])
			return 0;
		var cnt = sorted_list[gid].length;
		return total ? override_count[gid] || cnt : cnt;
	},
	showNotif: function (text, opts) {
		var self = this;
		
		opts = $.extend({
			timeout: 5000
		}, opts);
		
		if (hide_notif_timeout)
			clearTimeout(hide_notif_timeout);
		$('#gallery_notif').remove();
		
		gallery.append(tpl.notif({
			text: text
		}));
		
		if (opts.timeout) {
			hide_notif_timeout = setTimeout(function () {
				self.hideNotif();
			}, opts.timeout);
		}
		
		notif_showed = true;
	},
	hideNotif: function () {
		var self = this,
			gallery_notif = $('#gallery_notif');
		clearTimeout(hide_notif_timeout);
		hide_notif_timeout = 0;
		notif_showed = false;
		if (has_animations) {
			gallery_notif.cssAnim('opacity', 'ease-out', 300, function () {
				gallery_notif.remove();
			}).css("opacity", 0);
		} else {
			gallery_notif.remove();
		}
	},
	autoHideNotif: function () {
		var self = this;
		if (notif_showed)
			self.hideNotif();
	},
	setLoading: function (f) {
		if (current && !current.isLoading != !f) {
			$('#Gallery').toggleClass('gallery__loading gallery__lock', !!f);
			current.isLoading = lock_touch = !!f;
		}
	},
	setGroupError: function (gid, error, callback) {
		var self = this;
		if (error) {
			if (group_errors[gid]) {
				if ($.inArray(error, group_errors[gid].errors) < 0)
					group_errors[gid].errors.push(error);
				group_errors[gid].callbacks.push(callback);
			} else {
				group_errors[gid] = {
					errors: [error],
					callbacks: [callback]
				};
			}
		} else {
			delete group_errors[gid];
		}
		if (current)
			self.syncErrors();
	},
	setError: function (f, retry_callback) {
		var self = this;
		if (current && current.hasError != f) {
			self.setLoading(false);
			var err = $('#Gallery_error')
				.toggle(!!f)
				.html(f ? tpl.error(f + (retry_callback ? '<br />' : '')) : '');
			if (retry_callback) {
				var retry = $(tpl.retry()).click(function (e) {
					e.preventDefault();
					retry_callback();
				});
				err.find('.gallery-error_msg').append(retry);
			}
			current.hasError = lock_touch = !!f;
			self.onResize(true);
			
			if (current.hasError && current.zoomed)
				self.toggleZoom(false);
		}
	},
	getGalleryRect: get_gallery_rect,
	lock: function (flag) {
		global_lock = flag;
	}
};

extend(Gallery, TSimpleEvents);

function get_player_extra_height(player_width, player_height, aspect) {
	return player_height - Math.floor(player_width / aspect);
}

function gallery_get_meta(pic) {
	var cache = pic.gallery_cache_id && items_cache[pic.gallery_cache_id];
	return cache || Spaces.File.getMeta(pic);
}

function lock_clicks() {
	if (!click_lock) {
		click_lock = true;
		setTimeout(function () {
			click_lock = false;
		}, 130);
	}
}

function recalc_scale(rect, scale, x, y, max_w, max_h, strict) {
	var max_x = Math.max((max_w * scale) - rect.w, 0) / 2,
		max_y = Math.max((max_h * scale) - rect.h, 0) / 2,
		over_x = Math.abs(x) > max_x,
		over_y = Math.abs(y) > max_y;
	
	if (strict) {
		if (x > max_x) {
			x = strict ? max_x : x + (max_x - x) / OPT_BOUNCE_PAGING;
		} else if (x < -max_x) {
			x = strict ? -max_x : x - (max_x + x) / OPT_BOUNCE_PAGING;
		}
	}
	
	if (y > max_y) {
		y = strict ? max_y : y + (max_y - y) / OPT_BOUNCE_PAGING;
	} else if (y < -max_y) {
		y = strict ? -max_y : y - (max_y + y) / OPT_BOUNCE_PAGING;
	}
	
	if (scale > OPT_ZOOM_MAX)
		scale = strict ? OPT_ZOOM_MAX : scale + (OPT_ZOOM_MAX - scale) / OPT_BOUNCE_PAGING;
	else if (scale < 1)
		scale = strict ? 1 : scale + (1 - scale) / OPT_BOUNCE_PAGING;
	
	return {
		x: x,
		y: y,
		overX: over_x,
		overY: over_y,
		scale: scale
	};
}

// Метод создания нового <img> по шаблону
function create_new_img(src, src_2x, id, parent) {
	var img = new Image();
	img.srcset = src_2x ? src + ', ' + src_2x + ' 1.5x' : '';
	img.src = src;
	img.id = id;
	img.className = 'gallery__image';
	var $img = $(img);
	set_image($img, src, src_2x, parent);
	return $img;
};

// Метод замены изображения на другое
function replace_image(orig, src, src_2x, no_load) {
	var new_img = create_new_img(src, src_2x, orig.attr("id"), orig.parent(), no_load);
	orig.replaceWith(new_img);
	return new_img;
};

// Images loading
function set_image(img, src, src_2x, parent) {
	let srcset = src_2x ? src + ', ' + src_2x + ' 1.5x' : '';
	
	if (!has_animations) {
		if (src === undefined) {
			src = ICONS_BASEURL + "preloader_dark.gif";
			srcset = "";
		} else {
			loaded_images[src] = true;
		}
		img.prop("srcset", srcset);
		img.prop("src", src);
		return;
	}
	
	if (src === undefined) {
		img.prop("src", TRANSPARENT_STUB).prop("srcset", "").removeData("o_src");
		set_image_loading(img, parent);
		return;
	}
	
	var orig_img = img[0],
		orig_src = $.data(orig_img, "o_src"),
		orig_srcset = $.data(orig_img, "o_srcset"),
		image_src = $.prop(orig_img, "src"),
		image_srcset = $.prop(orig_img, "srcset");
	if (orig_src != src) {
		if (!loaded_images[src]) {
			orig_img.srcset = "";
			orig_img.src = TRANSPARENT_STUB;
			$.data(orig_img, {
				src: src,
				o_src: src,
				srcset: srcset,
				o_srcset: srcset
			});
			set_image_loading(img, parent);
			load_image(src, src_2x);
			return;
		} else {
			orig_img.srcset = srcset;
			orig_img.src = src;
			
			$.data(orig_img, "o_src", src);
			$.data(orig_img, "o_srcset", srcset);
		}
	}
	if (loaded_images[src])
		set_image_loading(img, parent);
}

function get_image_size(src) {
	return loaded_images[src];
}

function load_image_done(src, status) {
	var callbacks = load_image_callback[src];
	if (callbacks) {
		for (var i = 0; i < callbacks.length; ++i)
			callbacks[i](src, status);
		delete load_image_callback[src];
	}
}

function load_image(src, src_2x, callback) {
	let srcset = src_2x ? src + ', ' + src_2x + ' 1.5x' : '';
	
	if (callback)
		(load_image_callback[src] || (load_image_callback[src] = [])).push(callback);
	
	if (!loaded_images[src]) {
		var now = Date.now();
		if (loading_images[src] && now - loading_images[src] < 1000) {
	//		console.log("[DUP]", src);
			return;
		}
		
		delete failed_images[src];
		loading_images[src] = Date.now();
		
		var image = new Image();
		image.onload = function() {
		//	console.log("[loaded]", src);
			image = null;
			loaded_images[src] = {width: this.width, height: this.height};
			refresh_all_images(src);
			load_image_done(src, true);
			delete loading_images[src];
			
			if (failed_images[src]) { // Всякое бывает
				delete failed_images[src];
				if (current)
					Gallery.update(true);
			}
		};
		image.onerror = function() {
			image = null;
			delete loading_images[src];
			
			if (!loaded_images[src]) { // Всякое бывает
				failed_images[src] = true;
				if (current)
					Gallery.update(true);
			}
			load_image_done(src, false);
		};
		image.srcset = srcset;
		image.src = src;
		image = null;
	} else {
		load_image_done(src, true);
		refresh_all_images(src);
	}
}

function resize_image(w, h, max_w, max_h) {
	if (w > max_w || h > max_h)
		return w > h ? [+max_w, Math.round(max_w / w * h)] : [Math.round(max_h / h * w), +max_h];
	return [+w, +h];
}

function resize_image2(w, h, max_w, max_h) {
	var a = w / h;
	if (h > max_h) {
		h = max_h;
		w = h * a;
	}
	if (w > max_w) {
		w = max_w;
		h = w / a;
	}
	return [Math.round(w), Math.round(h)];
}

function parse_thumb_size(src) {
	if (src) {
		var size = src.match(/\.\w+\.(\d+)\.(\d+)/);
		return size && [size[1], size[2]];
	}
}

function match_element(el, x, y) {
	var offset = el.offset();
	return !!(offset && (x >= offset.left && x <= offset.left + el.outerWidth()) && 
				(y >= offset.top && y <= offset.top + el.outerHeight()));
}

function set_image_loading(img, parent) {
	var flag = !loaded_images[img.data('o_src')];
	if (!flag && img.data('src')) {
		img.prop("srcset", img.data('srcset'));
		img.prop("src", img.data('src'));
		img.removeData('src').removeData('srcset').removeAttr("width").removeAttr("height");
	}
	(parent || img.parent()).toggleClass('gallery-img_loading', !!flag);
}

function refresh_all_images(src, flag) {
	for (var i = 0; i < OPT_SLIDES; ++i) {
		var img = $('#gallery_img_' + i);
		if (img.data("o_src") == src)
			set_image_loading(img);
	};
}

function get_gallery_rect() {
	var h = get_gallery_height();
	return {
		x: 0,
		y: !fullscreen ? HEADER_HEIGHT : 0,
		h: h - (!fullscreen ? HEADER_HEIGHT + FOOTER_HEIGHT : 0),
		rh: h,
		w: gallery.innerWidth()
	};
}
function get_gallery_inner_height() {
	return get_gallery_height() - (!fullscreen ? HEADER_HEIGHT + FOOTER_HEIGHT : 0);
}
function get_gallery_height() {
	return $('#Gallery').height();
}

function get_slide_index(a, b) {
	return a - Math.floor(a / b) * b;
}

var GalleryLoader = Class({
	Static: {
		setupLoaders: function (el) {
			if (el) {
				tick(() => {
					var $el = $(el);
					$el.data('GalleryLoader', new GalleryLoader($el));
					$el.removeClass('js-gallery_loader');
				});
			} else {
				let divs;
				if (document.getElementsByClassName) {
					divs = document.getElementsByClassName('js-gallery_loader');
				} else {
					divs = $('.js-gallery_loader');
				}
				
				for (let i = 0, l = divs.length; i < l; i++)
					GalleryLoader.setupLoaders(divs[i]);
			}
		}
	},
	Constructor: function (el) {
		var self = this;
		self.opts = $.extend({
			apiMethod: "",
			apiData: {},
			total: 0,
			limit: 0,
			offset: 0,
			gc: false, // garbage collector
			itemWrap: false,
			hasMore: false,
			
			fixResult: null
		}, el.data());
		
		self.el = el;
		self.offset = 0;
		self.loaded_offset = self.opts.offset;
		
		self.total = self.opts.total;
		self.limit = self.opts.limit;
		
		if (!self.setupGallery() || !self.hasMore(0))
			return;
		self.update();
		
		page_loader.push('shutdown', function () {
			self.destroy();
		});
	},
	hasMore: function (dir) {
		var self = this;
		if (dir > 0)
			return self.loaded_offset + self.offset + self.limit < self.total;
		if (dir < 0)
			return !!self.loaded_offset;
		return self.hasMore(-1) || self.hasMore(1);
	},
	// garbage collector
	gc: function () {
		var self = this;
		
		var total = Gallery.getGroupCnt(self.gid),
			left = ((self.page - 1) * self.limit - self.loaded_offset) / self.limit,
			right = (total - (self.page * self.limit - self.loaded_offset)) / self.limit;
		
		if (left > GALLERY_LOADER_MAX_LIMIT) {
			var overhead = left - GALLERY_LOADER_LIMIT;
		//	console.log("худеем слева", overhead);
			Gallery.removeFiles(self.gid, -1, overhead * self.limit, self.opts.itemWrap);
			self.offset -= overhead * self.limit;
			self.loaded_offset += overhead * self.limit;
			Gallery.setBaseOffset(self.gid, self.loaded_offset);
		}
		
		if (right > GALLERY_LOADER_MAX_LIMIT) {
			var overhead = right - GALLERY_LOADER_LIMIT;
		//	console.log("худеем справа", overhead);
			Gallery.removeFiles(self.gid, 1, overhead * self.limit, self.opts.itemWrap);
			self.offset -= overhead * self.limit;
		}
	},
	setupGallery: function () {
		var self = this;
		var gallery = self.el.find('.gview_link');
		if (gallery.length) {
			if (!self.limit)
				self.limit = gallery.length * 2;
			self.gid = gallery_get_meta(gallery[0]).gid;
			
			Gallery.unlockGroup(self.gid);
			Gallery.setBaseOffset(self.gid, self.loaded_offset);
			Gallery.addPhoto();
			
			Gallery.onGroup(self.gid, 'load', function (e) {
				self._go_next = true;
				Gallery.setLoading(true);
			});
			Gallery.onGroup(self.gid, 'exit', function (e) {
				self.el.trigger('galleryExit', {
					page: self.page,
					total: self.total
				});
			});
			Gallery.onGroup(self.gid, 'list', function (e) {
				var dir;
				if (e.last !== false) {
					dir = e.current - e.last;
				} else {
					if (e.current == 0) {
						dir = -1;
					} else if (e.current == e.total - 1) {
						dir = 1;
					}
				}
				
				var loaded_pct = (1 - (dir < 0 ? Math.min(1, e.current / self.limit) : 
						Math.min(1, (e.total - e.current) / self.limit))) * 100;
				if (loaded_pct > GALLERY_PRELOAD_PCT)
					self.load(dir);
				/*
				console.log("loaded_pct=", loaded_pct, e.total, e.current, "|dir=", dir, "\n",
					(e.total - e.current), self.limit);
				*/
				var cur_page = self.getPage(self.loaded_offset + e.current + 1);
				if (self.page != cur_page) {
					var files = Gallery.getFiles(self.gid, (cur_page - 1) * self.limit - self.loaded_offset, self.limit, self.opts.itemWrap);
					self.el.trigger('galleryPageChanged', {
						files: files,
						prevFiles: self.shadow_prev_items,
						nextFiles: self.shadow_next_items,
						
						// pages
						page: cur_page,
						lastPage: self.page,
						totalPages: Math.ceil(Gallery.getGroupCnt(self.gid, true) / self.limit)
					});
					self.page = cur_page;
				}
			});
			
			self.shadow_prev_items = $('<div class="hide">').insertBefore(self.el);
			self.shadow_next_items = $('<div class="hide">').insertAfter(self.el);
			self.page = self.getPage(self.loaded_offset + self.offset + 1);
			
			return true;
		}
		return false;
	},
	getPage: function (offset) {
		var self = this;
		return Math.max(1, Math.ceil(offset / self.limit));
	},
	update: function () {
		var self = this;
		Gallery.setGroupVisibleCount(self.gid, self.total);
	},
	load: function (dir) {
		var self = this;
		
		dir = dir < 0 ? -1 : 1;
		if (!self.hasMore(dir))
			return;
		
		self.loadChunk(self.limit * dir, function () {
			if (self._go_next) {
				Gallery.move(dir);
				self._go_next = false;
			}
		}, function (err) {
			Gallery.setError(err.message, function () {
				Gallery.setError(false);
				Gallery.setLoading(true);
				self.load(dir);
			});
		});
	},
	loadChunk: function (limit, callback, onerror) {
		var self = this;
		if (self._proccess)
			return;
		
		var offset = limit < 0 ? self.loaded_offset + limit : 
			self.loaded_offset + self.offset + limit;
		
		self._proccess = true;
		self.loadData(function (res) {
			self._proccess = false;
			
			self.total = res.count;
			Gallery.setLoading(false);
			
			var items = res.widgets,
				total_loaded = Gallery.getGroupCnt(self.gid);
			if (total_loaded + items.length >= self.total || !items.length) {
				// Справа всё загружено!
				self.total = total_loaded + items.length + self.loaded_offset;
			}
			
			// Погружаем в скрытый блок новые картинки списочка галлереи
			if (limit > 0) {
				self.shadow_next_items.append(items.join(''));
			} else {
				self.shadow_prev_items.prepend(items.join(''));
			}
			
			self.offset += items.length;
			if (limit < 0)
				self.loaded_offset -= items.length;
			
			// Обновляем галлерею и её списочки
			self.update();
			Gallery.setBaseOffset(self.gid, self.loaded_offset);
			Gallery.addPhoto();
			if (self.opts.gc)
				self.gc();
			Gallery.update(true);
			
			if (res.viewerInfo)
				Gallery.setViewerInfo(self.gid, res.viewerInfo);
			
			callback();
		}, function (e) {
			self._proccess = false;
			onerror(e);
		}, offset, Math.abs(limit));
	},
	loadData: function (callback, onerror, offset, limit) {
		var self = this;
		var api_data = $.extend({}, self.opts.apiData, {
			L: limit,
			O: offset
		});
		
		api_data.Viewer = 1;
		api_data.Defer_fetch = 0;
		
		Spaces.api(self.opts.apiMethod, api_data, function (res) {
			self.opts.fixResult && self.opts.fixResult(res);
			if (res.code == Codes.AUTH.ERR_AUTH_ERROR && res.auth_errror == Codes.AUTH.AUTH_ERROR.ERR_FREQ_LIMIT) {
				console.error(":(");
				setTimeout(function () {
					self.loadData(offset, limit, callback, onerror);
				}, 3000);
			} else if (res.code != 0) {
				onerror({
					message: Spaces.services.processingCodes(res),
					retry: true
				});
			} else {
				callback(res);
			}
		}, {
			onError: function (err) {
				onerror({
					message: err,
					retry: true
				});
			}
		});
	},
	destroy: function () {
		var self = this;
		self.el = null;
		self.shadow_prev_items.remove();
		self.shadow_next_items.remove();
	}
});

module.on("component", () => Gallery.addPhoto());

module.on("componentpage", function () {
	enable_check_adult = true;
	
	tick(() => GalleryLoader.setupLoaders());
	
	Gallery.init();
});

export default Gallery;
export {Gallery, GalleryLoader};
