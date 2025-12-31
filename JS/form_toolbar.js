import module from 'module';
import $ from './jquery';
import Device from './device';
import Spaces from './spacesLib';
import page_loader from './ajaxify';
import fixPageHeight from './min_height';
import DdMenu from './dd_menu';
import AttachSelector from './widgets/attach_selector';

import './form_tools';
import './colorpicker';
import {L, html_wrap, extend, tick, html_unwrap, base_domain, set_caret_pos} from './utils';

/*
	.js-toolbar_wrap - родительский элемент вокруг поля ввода, в котором ищутся
		.js-toolbar - место для тулбара
		.js-toolbar_inline - место для инлайн тулбара
*/
var ITEMS_INLINE = {
	chat: {
		quote: true
	}
};
var ITEM_WIDTH = 40;
// Элементы тулбара
var ITEMS = {
	quote: {
		iconInline: 'ico ico_quote',
		icon: 'ico_mail ico_mail_quote ico-alone',
		title: L("Цитата"),
		key: 81 // Q
	},
	url: {
		icon: 'ico_mail ico_mail_link ico-alone',
		title: L("Ссылка")
	},
	pic: {
		icon: 'ico ico_plus ico-alone',
		dd: true,
		title: L("Вставить")
	},
	color: {
		icon: "ico_mail ico_mail_color ico-alone",
		title: L("Цвет шрифта"),
		dd: true
	},
	b: {
		icon: 'ico_mail ico_mail_bold ico-alone',
		title: L("Жирный шрифт"),
		key: 66 // B
	},
	i: {
		icon: 'ico_mail ico_mail_italic ico-alone',
		title: L("Наклонный шрифт"),
		key: 73 // I
	},
	u: {
		icon: 'ico_mail ico_mail_underline ico-alone',
		title: L("Подчеркнутый шрифт"),
		key: 85 // U
	},
	s: {
		icon: 'ico_mail ico_mail_strike ico-alone',
		title: L("Зачеркнутый шрифт"),
		key: 83 // S
	},
	smile: {
		icon: 'ico ico_smile ico-alone',
		title: L("Смайлы")
	},
	code: {
		icon: "ico_mail ico_mail_code ico-alone",
		title: L("Код"),
		dd: true
	},
	spoiler: {
		hide: true,
		key: 72, // H
		param: L('Введите название спойлера')
	},
	gray: {
		hide: true,
		bbTag: "color",
		key: 71 // G
	},
	fon: {
		icon: "ico_mail ico_mail_background ico-alone",
		title: L("Цвет фона"),
		dd: true
	},
	more: {
		icon: "ico ico_more ico-alone",
		title: L("Ещё")
	},
	user: {
		hide: true,
		shortTag: '@__value__ ',
		param: L('Введите ник пользователя'),
		def: Spaces.params.name
	},
	comm: {
		hide: true,
		shortTag: '$__value__$ ',
		def: 'support',
		param: L('Введите имя сообщества')
	}
};

var TYPE2TAG = {
	[Spaces.TYPES.FILE]: 'file',
	[Spaces.TYPES.MUSIC]: 'music',
	[Spaces.TYPES.PICTURE]: 'pic',
	[Spaces.TYPES.VIDEO]: 'video'
};
var EXTERNAL2TAG = {
	[Spaces.ExternalVideo.YOUTUBE]: 'youtube'
};
var COLORS = [
	"90CAF9 80DEEA A5D6A7 FFF59D FFCC80 FFAB91 CE93D8".split(" "),
	"2196F3 00BCD4 4CAF50 FFEB3B FF9800 F44336 9C27B0".split(" "),
	"1565C0 00838F 2E7D32 F9A825 EF6C00 C62828 6A1B9A".split(" "),
	"ECF0F1 CFD8DC B0BEC5 97A6B0 546E7A 44565E 3A474C".split(" ")
];
var PL_NAMES = {
	text: L("Текст"),
	ini: '^',
	'1c': '^',
	json: '^',
	sql: '^',
	javascript: 'JavaScript',
	php: '^',
	cpp: 'C/C++',
	actionscript: 'ActionScript',
	coffeescript: 'CoffeScript',
	http: '^',
	cmake: 'CMake',
	avrasm: 'AVR Asm',
	vim: '^',
	vbnet: 'VB.NET',
	'vbscript-html': 'VBScript (HTML)',
	cs: 'C#',
	vbscript: 'VBScript',
	css: '^',
	xml: '^',
	x86asm: 'X86 ASM',
	applescript: 'AppleScript',
	typescript: 'TypeScript',
	objectivec: 'Objective C'
};
var PL_LANGS = "text delphi ini 1c json sql javascript perl swift lisp d nginx php java cpp actionscript lua coffeescript vala http go avrasm vim dos vbnet xml vbscript-html bash cs python diff less erlang matlab vbscript css rust apache prolog markdown x86asm applescript fortran makefile ruby smali typescript cmake objectivec".split(" ");

var tpl = {
	colorsList: function (tag) {
		var desktop = Device.type == 'desktop',
			action_class = desktop ? 'js-bb_color' : 'js-bb_insert_tag';
		var html = '<div class="widgets-group dropdown-menu wbg toolbar__spoiler"><div class="t_center">' +
						'<table class="table__wrap bb-colorpicker"><tr>';

		// colors list
		html += '<td class="table__cell' + (desktop ? '' : ' table__cell_last js-bb_colorpicker_tab') + '">' +
					'<div class="' + (desktop ? 'colorpicker-colors' : 'content-item3 wbg content-bl__sep') + '">';
		for (var i = 0; i < COLORS.length; ++i) {
			html += '<div>';
			for (var j = 0; j < COLORS[i].length; ++j) {
				var color = COLORS[i][j];
				html += '<div style="background-color:#' + color + '" data-tag="' + tag + '" data-val="#' + color + '" ' +
					'class="' + action_class + ' toolbar-color pointer"></div>';
			}
			html += '</div>';
		}
		html += '</div></td>';

		// colorpicker
		html +=
			'<td class="table__cell table__cell_last' + (desktop ? '' : ' hide js-bb_colorpicker_tab') + '">' +
				'<div class="' + (desktop ? 'colorpicker-colors' : 'content-item3 wbg content-bl__sep') + '">' +
					'<div class="js-bb_colorpicker"></div>' +
				'</div>' +
			'</td>';

		html += '</tr></table></div>';

		// Кнопка выбора своего цвета
		if (!desktop) {
			html +=
				'<div class="links-group links-group_grey t_center">' +
					'<a href="#" class="list-link js-bb_own_color">' +
						L('Выбрать свой цвет') +
					'</a>' +
				'</div>';
		}

		html += '</div>';
		return html;
	},
	codesList: function () {
		var html = '<div class="widgets-group dropdown-menu wbg toolbar__spoiler"><div class="content-item3 wbg content-bl__sep">';
		for (var j = 0; j < PL_LANGS.length; ++j) {
			var name = PL_LANGS[j];
			if (PL_NAMES[name]) {
				if (PL_NAMES[name] == '^')
					name = name.toUpperCase();
				else
					name = PL_NAMES[name];
			} else {
				name = name.substr(0, 1).toUpperCase() + name.substr(1);
			}

			html += '<a href="#code-' + j + '" data-tag="code" data-val="' + PL_LANGS[j] + '" class="js-bb_insert_tag">' + name + '</a>';
			if (j != PL_LANGS.length - 1)
				html += ', ';
		}
		html += '</div></div>';
		return html;
	},
	ddWindow: function (content) {
		var html =
			'<div class="spoiler_inject dropdown-menu" skip="1">' +
				content +
			'</div>';
		return html;
	},
	restoreTemp: function (data) {
		var html =
			'<div class="nl system-message system-message_service mb10 js-temp_text_parent">' +
				L('Обнаружен черновик.') + ' <a href="#" class="js-temp_text" data-action="restore">' + L('Восстановить') + '</a>' +
				'<span class="ico ico_remove right pointer js-temp_text" data-action="delete"></span>' +
			'</div>';
		return html;
	},
	toolbar: function (data) {
		var now = Date.now(),
			html = '<div class="toolbar__wrap' + (data.hide ? ' hide' : '') + '">' +
				'<table class="toolbar table__wrap"><tr>';
		$.each(ITEMS, function (tag, item) {
			if (data.disabled[tag] || item.hide)
				return;
			html +=
				'<td class="table__cell">' +
					'<a href="#l' + now + tag + '" data-no_label="1" class="list-link js-bb_' + tag + '" title="' + item.title + '" data-tag="' + tag + '">' +
						'<span class="' + item.icon + '"></span>' +
					'</a>' +
				'</td>';
		});
		html += '</tr><tr class="hide"></tr><tr class="hide"></tr><tr class="hide"></tr></table></div>';
		// html += '<div class="spoiler_inject"><div class="widgets-group donotblockme"><div class="content-bl">efewfewfefwefw</div></div></div>';
		return html;
	},
	inlineToolbar: function (data) {
		var now = Date.now(),
			html = '';
		$.each(ITEMS, function (tag, item) {
			if (!data.allowed[tag])
				return;
			html +=
				'<button href="#bb-' + tag + '" class="url-btn button" data-tag="' + tag + '" title="' + item.title + '">' +
					'<span class="' + item.iconInline + '"></span>' +
				'</button>';
		});
		return html;
	},
	counter: function (data) {
		if (data.old) {
			return	'<span class="right grey">' +
						'<span class="js-bb_counter">0</span> / ' + data.maxlength +
					'</span>';
		} else {
			return	'<span class="right cntBl' + (data.hide ? ' hide' : '') + '" style="display:none">' +
						'<span class="js-bb_counter">0</span> / ' + data.maxlength +
					'</span>';
		}
	},
	bbMenu: function (id) {
		return '' +
			'<div class="hide"><span class="js-bb_hid_attach"></span></div>' + // Тут будет скрытая кнопка открытия аттач-меню, чтобы из JS открывать его
			'<div class="js-bb_smile_menu"></div>' + // тут будет само аттач-меню
			'<div class="hide spoiler_inject" id="ddspoiler_' + id + '"></div>' +
			'<div class="js-bb_menu" style="position:relative;display:none"></div>';
	},
	attachesMenu: function (data) {
		const FILES_ITEMS = {
			picture:	[L('Фото'), 'ico_mail ico_mail_picture'],
			music:		[L('Музыка'), 'ico_mail ico_mail_music'],
			video:		[L('Видео'), 'ico_mail ico_mail_video'],
			file:		[L('Файлы'), 'ico_mail ico_mail_file', true]
		};
		const VOTE_ITEMS = {
			vote:		[L('Опрос'), 'ico ico_vote']
		};
		const BBCODE_ITEMS = {
			user:		[L('Ссылка на пользователя'), 'ico ico_user'],
			comm:		[L('Ссылка на сообщество'), 'ico ico_users_group'],
			spoiler:	[L('Спойлер'), 'ico_mail ico_mail_spoiler'],
			close:		[L('Отменить'), 'ico ico_remove']
		};

		if (data.fileTypes.indexOf(Spaces.TYPES.PICTURE) < 0)
			delete FILES_ITEMS.picture;
		if (data.fileTypes.indexOf(Spaces.TYPES.MUSIC) < 0)
			delete FILES_ITEMS.music;
		if (data.fileTypes.indexOf(Spaces.TYPES.VIDEO) < 0)
			delete FILES_ITEMS.video;
		if (data.fileTypes.indexOf(Spaces.TYPES.FILE) < 0)
			delete FILES_ITEMS.file;
		if (data.fileTypes.indexOf(Spaces.TYPES.USER) < 0)
			delete BBCODE_ITEMS.user;
		if (data.fileTypes.indexOf(Spaces.TYPES.COMM) < 0)
			delete BBCODE_ITEMS.comm;

		var menu_items = {};
		if (data.files)
			$.extend(menu_items, FILES_ITEMS);
		if (data.vote)
			$.extend(menu_items, VOTE_ITEMS);
		$.extend(menu_items, BBCODE_ITEMS);

		for (let k in data.disabled)
			delete menu_items[k];

		var html = '<div class="widgets-group links-group links-group_grey dropdown-menu bb0 toolbar__spoiler">';
		$.each2(menu_items, function (k, v, meta) {
			var clazz = (meta.first ? ' list-link_first' : (meta.last ? ' list-link_last' : ''));
			html +=
				'<a href="#bb-' + k + '" class="list-link js-bb_attach' + clazz + '" data-type="' + k + '"' +
						(v[2] ? ' style="border-bottom-width: 2px"' : "") + '>' +
					'<span class="' + v[1] + '"></span> ' + v[0] +
				'</a>';
		});
		html += '</div>';
		return html;
	},
	bbParam: function (data) {
		var html =
			'<div class="widgets-group dropdown-menu wbg toolbar__spoiler">' +
				'<div class="content-item3 wbg content-bl__sep">' +
					'<div class="text-input__wrap">' +
						'<input type="text" class="text-input js-bb_value_input" data-no_paste="1" ' +
							'value="' + html_wrap(data.value) + '" placeholder="' + data.placeholder + '">' +
					'</div>' +
				'</div>' +

				'<table class="table__wrap">' +
					'<tr>' +
						'<td class="table__cell links-group links-group_grey table__cell_border" width="50%">' +
							'<a href="#bb-add" class="list-link list-link-blue bb0 js-bb_insert_tag" data-tag="' + data.tag + '">' +
								'<span class="ico ico_plus_blue"></span>' +
								'<span class="t">' + L('Добавить') + '</span>' +
							'</a>' +
						'</td>' +
						'<td class="table__cell links-group links-group_grey table__cell_last" width="50%">' +
							'<a href="#bb-close" class="list-link bb0 js-bb_attach" data-type="close">' +
								'<span class="t">' + L('Отмена') + '</span>' +
							'</a>' +
						'</td>' +
					'</tr>' +
				'</table>' +
			'</div>';
		return html;
	}
};

function Toolbar(el, opts) {
	var id = el.attr("id") || 'tb_' + Date.now(),
		parent = el.parents('.js-toolbar_wrap').first(),
		toolbar = parent.find('.js-toolbar'),
		inline = parent.find('.js-toolbar_inline'),
		maxlength = el.data("maxlength") || el.attr("maxlength") || 0,
		minlength = el.data("minlength") || el.attr("minlength") || 0,
		lengthCounterThreshold = el.data("lengthCounterThreshold") ?? 80,
		last_selection,
		bb_menu, smiles_menu, counter, bb_more, bb_toggle,
		current_menu, current_menu_opener,
		expanded = false,
		last_items_on_line = 0,
		quote_text,
		length_interval,
		attach_menu_opened,
		counter_last_text,
		text_input_focused;

	setupToolbar();

	function setupToolbar() {
		opts = extend({
			length: true,
			toolbar: true,
			hide: false,
			activeAttaches: false,
			inline: false,
			disable: {},
			hideCounter: false
		}, opts);

		// Если нет поля для тулбара - создаём выше textarea
		if (!toolbar.length) {
			toolbar = $('<div class="cf">');
			if (opts.toolbar) {
				el.before(toolbar);
			} else {
				el.after(toolbar);
			}
		}

		// Для оперы мини отключаем показ длины сообщения
		if ( opts.inline)
			opts.length = false;

		render();

		text_input_focused = false;

		el.on('focus', function () {
			text_input_focused = true;
			if (maxlength)
				length_interval = setInterval(lengthMonitor, 300);
			last_selection = null;
			lengthMonitor();
		}).on('blur', function () {
			text_input_focused = false;
			if (maxlength)
				clearInterval(length_interval);
			length_interval = null;
			last_selection = getSelectionRange(true);
			lengthMonitor();
		}).on('change', function () {
			if (!length_interval)
				lengthMonitor();
		});

		$(window).on('resize.sp_toolbar orientationchange.sp_toolbar', function () {
			fixToolbarWidth();
		});

		$(document.documentElement).on('mouseup.sp_toolbar', function () {
			var text;
			if (window.getSelection) {
				text = window.getSelection();
			} else if (document.getSelection) {
				text = document.getSelection();
			} else if (document.selection) {
				text = document.selection.createRange().text;
			}
			if (text)
				quote_text = $.trim(text);
		});

		if (opts.activeAttaches) {
			el.on('onDropAttach', function (e, data) {
				insertAttach([data]);
			});
			toolbar.parents('form').on('onDeleteAttaches', function (e, data) {
				data.attaches.forEach((file) => {
					deleteAttach(file);
				});
			});
		}

		// Хоткеи
		el.keydown(function (e) {
			if (e.altKey) {
				$.each(ITEMS, function (tag, item) {
					if (item.key == e.keyCode)
						tagInsert(tag);
				});
			}
		});

		import("./text_restore").then(function () {
			tick(function () {
				if (el.hasClass('js-has_saved_text')) {
					el.removeClass('js-has_saved_text');
					toolbar.prepend(tpl.restoreTemp());
				}
			});
		});

		page_loader.push('shutdown', destroy);
	}

	function render() {
		var old_widget = !el.parents('.text-input__wrap').length && !opts.toolbar;
		if (opts.toolbar) {
			// Тулбар
			toolbar.append(tpl.toolbar({
				hide: opts.hide,
				old: old_widget,
				disabled: {
					fon:		opts.disable.bgcolor,
					smile:		opts.disable.smiles,
				}
			}));
		}

		if (opts.length && maxlength) {
			counter = el.parents('.js-input_error_wrap').find('.js-input_right_label');

			if (!counter.text().trim().length || !counter.length) {
				// Счётчик символов
				counter = $(tpl.counter({
					id: id,
					old: old_widget,
					maxlength: maxlength,
					hide: opts.hideCounter
				}));
				old_widget ? toolbar.append(counter) : el.after(counter);
				counter = counter.find('.js-bb_counter');
			} else {
				counter_last_text = counter.html() + " ";
			}
		}

		if (opts.inline)
			renderInline();

		toolbar.append(tpl.bbMenu(id));

		bb_menu = toolbar.find('.js-bb_menu');
		smiles_menu = toolbar.find('.js-bb_smile_menu');
		bb_more = toolbar.find('.js-bb_more').parent('td');

		el.parents('form').find('.js-smile').show().off('click').on('click', function (e) {
			e.preventDefault();
			toggleSmiles($(this));
		});
		bb_toggle = el.parents('form').find('.js-bb_toggle').show().click(function (e) {
			e.preventDefault();
			var table = toolbar.find('table');
			table.parent().toggleClass('hide');
			$(this).toggleClass('js-clicked');

			let isOpen = !table.parent().hasClass('hide');
			el.attr('data-toolbar-opened', isOpen || '').trigger('change');

			if (isOpen)
				el[0].focus();
		});
		toolbar.find('a').click(function (e) {
			e.preventDefault();
			tagInsert($(this).data('tag'));
		});
		bb_menu.on('click', '.js-bb_insert_tag', function (e) {
			e.preventDefault();
			var link = $(this),
				tag = link.data('tag'),
				val = link.data('val') || toolbar.find('.js-bb_value_input').val();
			var tinfo = ITEMS[tag];
			if (tinfo.shortTag) {
				textReplaceTag(function () {
					return tinfo.shortTag.replace('__value__', val || tinfo.def);
				});
			} else {
				textInsertTag('[' + tag + '=' + val +']', '[/' + tag + ']', '');
			}
			showMenu();
		});
		bb_menu.on('click', '.js-bb_attach', function (e) {
			e.preventDefault();
			var type = $(this).data('type');
			var OPEN_FILES = {
				file:		Spaces.TYPES.FILE,
				picture:	Spaces.TYPES.PICTURE,
				music:		Spaces.TYPES.MUSIC,
				video:		Spaces.TYPES.VIDEO
			};
			if (OPEN_FILES[type]) {
				initAttaches(OPEN_FILES[type]);
			} else if (type == 'close') {
				showMenu();
			} else if (type == 'vote') {
				alert('Ничего нет!');
			} else {
				showMenu(type);
			}
		});

		lengthMonitor();
		fixToolbarWidth();
	}

	function renderInline() {
		inline.html(tpl.inlineToolbar({
			allowed: ITEMS_INLINE[opts.inline]
		})).find('a').click(function (e) {
			e.preventDefault();
			tagInsert($(this).data('tag'));
		});
	}

	function fixToolbarWidth() {
		var items_on_line = Math.max(4, Math.floor(toolbar.innerWidth() / 40));
		if (last_items_on_line != items_on_line) {
			var table = toolbar.find('table').first();
			bb_more.detach();

			var lines = table.find('tr'),
				items = table.find('td').detach(),
				max_lines = items.length / items_on_line;

			for (var i = 0; i < items.length; ++i) {
				var item = items[i],
					line = Math.floor((max_lines > 1 ? i + 1 : i) / items_on_line);
				$(lines[line]).append(item);
			}

			lines.toggleClass('hide', !expanded);
			$(lines[0]).removeClass('hide').append(bb_more.toggleClass('hide', max_lines <= 1));
			bb_more.find('.js-bb_more').toggleClass('js-clicked', expanded);

			last_items_on_line = items_on_line;
		}
	}

	function lengthMonitor() {
		if (counter) {
			let text_length = el[0].value.length;
			if (counter_last_text) {
				if (text_input_focused) {
					let error = text_length > maxlength || (minlength && text_length < minlength);
					counter[0].innerHTML = text_length + '/' + maxlength;
					counter[0].style.color = error ? '#ff6837' : '';
					counter[0].parentNode.style.display = '';
				} else {
					counter[0].innerHTML = counter_last_text;
					counter[0].style.color = '';
					counter[0].parentNode.style.display = '';
				}
			} else {
				counter[0].innerHTML = text_length;
				counter[0].style.color = text_length > maxlength ? 'red' : '';
				counter[0].parentNode.style.display = text_input_focused && text_length >= Math.floor(maxlength / 100 * lengthCounterThreshold) ? '' : 'none';
			}
		}
	}

	function showMenu(tag) {
		var same = false;

		if (tag == 'pic' && isAttachChildOpened() && toolbar.find('.js-bb_pic').hasClass('js-clicked')) {
			// Костыль
			showMenu();
			return;
		}

		if (current_menu) {
			onCloseMenu(current_menu, tag);
			same = current_menu.data('tag') == tag;
			current_menu.remove();
			bb_menu.hide();
			current_menu_opener.removeClass('js-clicked');
			current_menu_opener = current_menu = null;
			fixPageHeight();
			$('body').off('click.sp_toolbar');
		}

		if (tag && !same) {
			current_menu_opener = toolbar.find('.js-bb_' + tag).addClass('js-clicked');
			current_menu = $(tpl.ddWindow(onCreateMenu(tag))).data('tag', tag);
			bb_menu.append(current_menu).show();

			if ((Device.webkit() && Device.webkit() <= 533.1)) {
				if (current_menu.css("position") == 'absolute')
					current_menu.css("position", "static");
			}

			// Закрытие менб по клику в любое место
			tick(function () {
				$('body').on('click.sp_toolbar', function (e) {
					if (!$(e.target).parents('.js-bb_menu').length)
						showMenu();
				});
			});
			DdMenu.close();
			fixPageHeight(current_menu);

			onAfterCreateMenu(current_menu, tag);
		}
		checkAttachClicked();
	}

	function onCreateMenu(tag) {
		const fileTypes = el.data('enabledTypes') ?? [];
		if (tag == 'color' || tag == 'fon') {
			return tpl.colorsList(tag);
		} else if (tag == 'code') {
			return tpl.codesList();
		} else if (tag == 'pic') {
			return tpl.attachesMenu({
				files: opts.activeAttaches,
				vote: false,
				disabled: opts.disable,
				fileTypes
			});
		} else if (ITEMS[tag].param) {
			return tpl.bbParam({
				tag: tag,
				value: ITEMS[tag].shortTag ?  getSelectedText() : "",
				placeholder: ITEMS[tag].param
			});
		}
	}

	function onAfterCreateMenu(menu, tag) {
		if (tag == 'color' || tag == 'fon') {
			var div_colorpicker = menu.find('.js-bb_colorpicker'),
				colorpicker = div_colorpicker.colorpicker();

			div_colorpicker.on('colorpicker:select', function (e, data) {
				textInsertTag('[' + tag + '=' + data.color +']', '[/' + tag + ']', '');
				showMenu();
			});

			menu.on('click', '.js-bb_color', function (e) {
				e.preventDefault();
				colorpicker.setColor($(this).data('val'));
			}).on('click', '.js-bb_own_color', function (e) {
				e.preventDefault();
				$(this).toggleClass('clicked');
				menu.find('.js-bb_colorpicker_tab').toggleClass('hide');
			});
		}
	}

	function onCloseMenu(menu, tag) {
		if (tag == 'color' || tag == 'fon') {
			menu.find('.js-bb_colorpicker').colorpicker(false);
		}
	}

	function isAttachChildOpened() {
		var tag = current_menu && current_menu.data('tag');
		return attach_menu_opened || /spoiler|user|comm|pic/.test(tag);
	}

	function checkAttachClicked() {
		toolbar.find('.js-bb_pic').toggleClass('js-clicked', isAttachChildOpened());
	}

	function toggleSmiles(link) {
		var body = $('body');
		showMenu();

		let ico = link.find('.ico_smile');

		ico.addClass('ico_spinner');

		import('./smiles_menu').then(({default: SmilesMenu}) => {
			ico.removeClass('ico_spinner');

			SmilesMenu.toggle(id, toolbar[0], function (v) {
				textReplaceTag(function () {
					return v + ' ';
				});
			}, function () {
				link.find('.js-ico')
					.removeClass("ico_smile")
					.addClass("ico_smile_black");
			}, function () {
				link.find('.js-ico')
					.removeClass('ico_smile_black')
					.addClass("ico_smile");
			}, {stickers: !opts.disable.stickers});
		});
	}

	function initAttaches(type) {
		var link = toolbar.find('.js-bb_hid_attach').data('temp_type', type);

		tick(function () {
			showMenu();
		//	if (opts.activeAttaches) // костыль
		//		link.parent().show();
			link.click();
		});
		attach_menu_opened = true;

		if (!link.hasClass('js-attach')) { // Ленивая инициализация
			var form = link.parents('form'),
				att_parent = $('<div id="azzzkoe_kostilishe_' + Date.now() + '"></div>'),
				attach_btn = form.find('.js-attach'),
				max_files = attach_btn.data("max_files"),
				chunk_files = [];

			att_parent.on('onNewAttach', function (e, data) {
				e.stopPropagation();
				e.stopImmediatePropagation();

				if (!chunk_files.length) {
					tick(function () {
						insertAttach(chunk_files);
						chunk_files = [];
					});
				}
				chunk_files.push(data.file);
			}).on('AttachSelectorClose', function () {
				attach_menu_opened = false;
				checkAttachClicked();
			});
			form.on('onNewAttachBb', function (e, data) {
				insertAttach([data.file]);
			});
			form.after(att_parent);

			link.addClass('js-attach').data({
				form: '#' + att_parent.attr("id"),
				max_files: max_files,
				enabledTypes: attach_btn.data("enabledTypes"),
				picGenerator: attach_btn.data("picGenerator"),
				comm: attach_btn.data("comm"),
				'public': attach_btn.data("public"),
				attaches: false,
				linkDownload: true,
				upload: true,
				spoiler: '#ddspoiler_' + id,
				proxyUpload: max_files > 1,
				fix_position: -10,
				no_label: true
			});

			AttachSelector.init();

			var att = AttachSelector.instance(att_parent)
			att.setParent(AttachSelector.instance(form));
		}
	}

	function getFileTag(file) {
		if (file.type == Spaces.TYPES.EXTERNAL_VIDEO)
			return {tag: EXTERNAL2TAG[file.source_type], val: file.video_id};
		return {tag: TYPE2TAG[file.type], val: file.nid};
	}

	function deleteAttach(file) {
		var self = this,
			t = getFileTag(file),
			re = new RegExp('\\[' + t.tag + '=' + t.val + '\\]', 'gi');
		el.val(el.val().replace(re, ''));
	}

	function insertAttach(attaches) {
		textReplaceTag(function () {
			var att = AttachSelector.instance(el), text = '', has_new = false;
			for (var i = 0; i < attaches.length; ++i) {
				var attach = attaches[i],
					t = getFileTag(attach);
				if (att.onAttachSelect(attach, true))
					has_new = true;
				text += '[' + t.tag + '=' + t.val + ']';
			}
			if (has_new)
				att.saveAttaches(attaches);
			return text;
		});
	}

	function tagInsert(tag) {
		var item = ITEMS[tag];
		if (el.attr("disabled") || el.attr("readonly"))
			return;

		if (tag == 'smile') {
			toggleSmiles(toolbar.find('.js-bb_smile'));
		} else if (tag == 'pic2') {
			initAttaches();
		} else if (tag == 'more') {
			last_items_on_line = 0;
			expanded = !expanded;
			fixToolbarWidth();
		} else if (tag == 'quote') {
			textInsertTag('[quote]', '[/quote]', quote_text || "");
		} else if (tag == 'url') {
			textReplaceTag(function (value) {
				if (!value.length) {
					var clipboard = $('#toolbar_payload').data('clipboard') || "";
					return clipboard ?
						html_unwrap(clipboard) :
						'[url=' + location.protocol + '//' + base_domain() + ']' + L('ссылка') + '[/url]';
				} else {
					return '[url=' + value + ']' + L('ссылка') + '[/url]';
				}
			});
		} else if (item && item.dd) {
			showMenu(tag);
		} else if (item && !item.nobb) {
			var def_values = {color: "green", fon: "LightBlue", gray: '#ccc'},
				value = def_values[tag],
				real_tag = item.bbTag || tag;
			textInsertTag('[' + real_tag + (value ? '=' + value : '') +']', '[/' + real_tag + ']', '');
		}
	}

	function destroy() {
		$('body, html').off('.sp_toolbar');
		$(window).off('.sp_toolbar');

		if (length_interval)
			clearInterval(length_interval);
	}

	// Получить выделенный текст в поле ввода
	function getSelectionRange(from_blur) {
		var offset = 0, length = 0;
		if (el[0].selectionStart !== undefined) {
			offset = el[0].selectionStart;
			length = el[0].selectionEnd - el[0].selectionStart;
		} else if (document.selection && el[0].createTextRange) {
			if (from_blur)
				return null;
			el[0].focus();
			var len = el[0].value.length;
			var s = document.selection.createRange();
			length = s.text.length;
			var tr = el[0].createTextRange();
			tr.moveToBookmark(s.getBookmark());
			offset = -tr.moveStart("character", -len);
		} else {
			return null;
		}
		return [offset, length];
	}

	function getSelectedText() {
		var sel = last_selection || getSelectionRange(el);
		if (sel)
			return el[0].value.substr(sel[0], sel[1]);
		return "";
	}

	// Вставка тега
	function textInsertTag(text1, text2, text3, text4) {
		var fix_pos;
		textReplaceTag(function (value, sel) {
			var middle = text4 || value || text3;
			if (sel)
				fix_pos = sel[0] + text1.length + middle.length;
			return text1 + middle + text2
		});
		if (fix_pos)
			set_caret_pos(el[0], fix_pos, fix_pos);
	}

	// Замена выделенного текста или добавление в конец
	function textReplaceTag(callback) {
		var sel = last_selection || getSelectionRange(el);
 		if (sel) {
			var new_value = callback(el[0].value.substr(sel[0], sel[1]), sel),
				new_pos = sel[0] + new_value.length;
			el[0].value =
				el[0].value.substr(0, sel[0]) +
				new_value +
				el[0].value.substr(sel[0] + sel[1]);
		} else {
			el[0].value += callback("");
			new_pos = el[0].value.length;
		}
		last_selection = null;

		el[0].focus();
		set_caret_pos(el[0], new_pos, new_pos);

		el[0].dispatchEvent(new Event('change', { bubbles: true }));
	}
}

$.extend(Toolbar, {
	expand: function (el, flag) {
		var toggle = el.findClass('js-bb_toggle');
		if (toggle.length) {
			if (flag != toggle.hasClass('js-clicked'))
				toggle.click();
		}
	}
});

module.on("component", function () {
	var textareas = $('textarea, input');
	for (var i = 0; i < textareas.length; ++i) {
		var ta = textareas[i],
			data = parse_opts(ta.getAttribute('data-toolbar'));
		if (data) {
			var $ta = $(ta);
			if (!$ta.data('__toolbar__'))
				$ta.data('__toolbar__', new Toolbar($ta, data));
		}
	}
});

function parse_opts(data) {
	if (data === "")
		return {};
	if (data) {
		let k = "eval";
		return window[k]('(' + data + ')');
	}
	return undefined;
}

export default Toolbar;
