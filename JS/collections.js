import module from 'module';
import $ from './jquery';
import cookie from './cookie';
import Device from './device';
import {Class} from './class';
import {Spaces, Url, Codes} from './spacesLib';
import page_loader from './ajaxify';
import fixPageHeight from './min_height';
import DdMenu from './dd_menu';
import {html_wrap, L, tick} from './utils';

var FILE_TYPE_2_DIR_TYPE = {
	[Spaces.TYPES.FILE]:		1,
	[Spaces.TYPES.MUSIC]:		2,
	[Spaces.TYPES.PICTURE]:		3,
	[Spaces.TYPES.VIDEO]:		24
};

var tpl = {
	saveNotif: function (data) {
		var dir = '<a href="' + data.url + '">' + html_wrap(data.name) + '</a>',
			cancel = 
				'<a href="#coll-cancel" class="js-collection_delete" data-nid="' + data.id + '" data-type="' + data.type + '" data-orig-nid="' + data.origNid + '">' + 
					'<span class="ico ico_spinner hide js-spinner"></span>' + 
					L('Отменить') + 
				'</a>';
		return L('Файл сохранён в вашу коллекцию {0}. {1}', dir, cancel);
	},
	saveMusicNotif: function (data) {
		if (data.exists) {
			return L('Файл был добавлен ранее: ') + '<a href="' + data.url + '">' + data.name + '</a>';
		} else {
			var dir = '<a href="' + data.url + '">' + L('Музыку') + '</a>',
				cancel = 
					'<a href="#coll-cancel" class="js-collection_delete" data-nid="' + data.id + '" data-type="' + data.type + '" ' + 
							'data-orig-nid="' + data.origNid + '" data-music="1">' + 
						'<span class="ico ico_spinner hide js-spinner"></span>' + 
						L('Отменить') + 
					'</a>';
			return L('Файл сохранён в вашу {0}. {1}', dir, cancel);
		}
	},
	errorMessage: function (error) {
		var html =
			'<div class="content-item3 wbg content-bl__sep red t_center">' + error + '</div>' + 
			'<div class="links-group links-group_grey" data-view="list">' + 
				'<span class="list-link links-group_grey t_center list-link_last js-dd_menu_close">' + 
					'<span class="ico ico_remove js-ico"></span> ' + 
					L('Закрыть') + 
				'</span>' + 
			'</div>';
		return html;
	},
	noDirs: function () {
		var html = 
			'<div class="content-item3 wbg t_center grey content-bl__sep">' + 
				L("У вас пока нет коллекций.") + 
			'</div>';
		return html;
	},
	window: function () {
		var html = 
				'<div data-view="error" data-empty="1"></div>' + 
				'<div data-view="create" data-empty="1"></div>' + 
				'<div class="links-group" data-view="list">' + 
					'<div class="js-collections_warn stnd-block-yellow stnd-block content-bl__sep hide"></div>' + 
					'<div class="js-collections_dirs">' + 
						'<div class="content-item3 wbg t_center grey content-bl__sep">' + 
							'<span class="ico ico_spinner"></span> ' + L("Загрузка коллекций") + 
						'</div>' + 
					'</div>' + 
					'<div class="links-group links-group_grey t_center hide js-collections_next">' + 
						'<span class="list-link">' + 
							L('Показать ещё') + 
						'</span>' + 
					'</div>' + 
					'<div class="links-group links-group_grey t_center hide js-collections_rewind">' + 
						'<span class="list-link">' + 
							L('Перейти к началу') + 
						'</span>' + 
					'</div>' + 
					(Device.type == 'desktop' ? 
						// PC
						'<table class="table__wrap">' + 
							'<tr>' + 
								'<td class="table__cell links-group links-group_grey table__cell_border" width="50%">' + 
									'<span class="list-link list-link-blue js-collection_add list-link_first list-link_last">' + 
										'<span class="ico ico_plus_blue js-ico"></span> ' + 
										'<span class="t">' +  L('Создать коллекцию') + '</span>' + 
									'</span>' + 
								'</td>' + 
								'<td class="table__cell links-group links-group_grey table__cell_last" width="50%">' + 
									'<span class="list-link js-dd_menu_close list-link_first list-link_last">' + 
										'<span class="t">' + L('Отменить') + '</span>' + 
									'</span>' + 
								'</td>' + 
							'</tr>' + 
						'</table>' : 
						// Touch
						'<div class="links-group links-group_grey">' + 
							'<span class="list-link list-link-blue js-collection_add list-link_first">' + 
								'<span class="ico ico_plus_blue js-ico"></span> ' + 
								'<span class="t">' +  L('Создать коллекцию') + '</span>' + 
							'</span>' + 
							'<span class="list-link js-dd_menu_close list-link_last">' + 
								'<span class="ico ico_remove js-ico"></span> ' + 
								'<span class="t">' + L('Отменить') + '</span>' + 
							'</span>' + 
						'</div>'
					) + 
				'</div>';
		return html;
	}
};

var FileCollections = Class({
	Static: {
		init: function (el) {
			if (!el.data('__collections__'))
				el.data('__collections__', new FileCollections(el));
		},
		freeInstance: function (link) {
			if (link.data("__collections__"))
				link.data("__collections__").destroy();
		},
		setup: function () {
			$('.js-collection_copy').each(function () {
				FileCollections.init($(this).removeClass('js-collection_copy'));
			});
			
			// Удаление файла из коллекции через "Отмена"
			$('body').on('click.oneRequest', '.js-collection_delete', function (e) {
				e.stopPropagation();
				e.preventDefault();
				
				var cancel = $(this),
					orig_nid = cancel.data('origNid'),
					nid = cancel.data('nid'),
					type = cancel.data('type');
				cancel.find('.js-spinner').removeClass('hide');
				
				Spaces.api("files.delete", {
					File_id: nid,
					Type: type,
					Link_id: Spaces.params.link_id,
					CK: null
				}, function (res) {
					if (res.code == 0) {
						$('#collections_' + type + '_' + orig_nid).addClass('hide');
						Spaces.showMsg(cancel.data('music') ? L("Файл удалён из музыки.") : L("Файл удалён из коллекции."), {gallery: true});
					} else {
						Spaces.showError(Spaces.showApiError(res));
					}
				}, {
					onError: function (err) {
						Spaces.showError(err, false, false, {gallery: true});
					}
				});
			});
		}
	},
	Constructor: function (link) {
		var self = this;
		
		self.nid = link.data('nid');
		self.type = link.data('extType') || link.data('type');
		self.fileType = link.data('type');
		self.msg = $('#collections_' + self.type + '_' + self.nid);
		self.link = link;
		
		var autoreg_handler = function (res) {
			if (!Spaces.params.nid) {
				// Обновляем виджеты на странице
				page_loader.refreshWidgets(Spaces.WIDGETS.FOOTER | Spaces.WIDGETS.HEADER | Spaces.WIDGETS.SIDEBAR | Spaces.WIDGETS.CSS, function () {
					// Обновляем user_id
					Spaces.params.nid = cookie.get("user_id");
				});
				// Делаем следующий хит с перезагрузкой
				page_loader.disable(true);
			}
		}
		
		if (self.type == Spaces.TYPES.MUSIC) {
			if (!Spaces.params.nid)
				return;
			
			link.click(function (e) {
				e.preventDefault();
				
				if (link.data('busy'))
					return;
				
				var toggle_save = function (flag) {
					link.find('span').first().toggleClass('ico_spinner', !!flag).data('busy', !!flag);
				};
				toggle_save(true);
				
				var api_data = $.extend((new Url(link.prop("href"))).query, {
					CK: null,
					Ft: self.fileType,
					Type: self.type
				});
				toggle_save(true);
				Spaces.api("files.copy2me", api_data, function (res) {
					toggle_save(false);
					if (res.code == 0 || res.exists) {
						// Удаляем мотиватор
						$('#collections_motivator_' + self.type + '_' + self.nid).remove();
						
						self.showMsg(tpl.saveMusicNotif({
							id: res.fileId,
							name: res.fileName,
							exists: res.exists,
							url: res.url,
							
							type: self.type,
							origNid: self.nid
						}));
					} else {
						Spaces.showApiError(res);
					}
				}, {
					onError: function (err) {
						toggle_save(false);
						Spaces.showError(err, false, {gallery: true});
					}
				});
			});
		} else {
			var menu = new DdMenu({
				data: {
					scroll: true,
					toggle_same: true,
					events: true,
					in_gallery: true
				}
			});
			menu.link(link);
			menu.element().on('dd_menu_open', function (e) {
				self.msg.addClass('hide');
				
				Spaces.api("files.getCollections", {
					Fid: self.nid,
					Ft: self.fileType,
					Type: FILE_TYPE_2_DIR_TYPE[self.type],
					Uid: Spaces.params.nid,
					Link_id: Spaces.params.link_id
				}, function (res) {
					var list = self.view("list").find('.js-collections_dirs'),
						msg = self.view("list").find('.js-collections_warn');
					if (res.code == 0) {
						autoreg_handler();
						list.html(res.collections.length ? res.collections.join('') : tpl.noDirs());
						msg.html(res.message).toggleClass('hide', !res.message);
					} else {
						self.showError(Spaces.apiError(res));
					}
					self.fixHeight();
				});
				self.view("list", true);
				self.busy = false;
			})
			.on('click', '.js-collections_next', function (e) {
				e.preventDefault();
				var el = menu.element();
				el.data('collectionsOffset', el.data('collectionsOffset') + el.data('collectionsChunk'));
				self.onResize();
			})
			.on('click', '.js-collections_rewind', function (e) {
				e.preventDefault();
				var el = menu.element();
				el.data('collectionsOffset', 0);
				self.onResize();
			})
			// Добавление новой коллекции
			.on('click', '.js-collection_add', function (e) {
				e.preventDefault();
				var btn = $(this);
				
				var toggle_save = function (saving) {
					btn.find('.js-ico').toggleClass('ico_spinner', saving);
				};
				var api_data = {
					D: -Spaces.params.nid,
					Type: FILE_TYPE_2_DIR_TYPE[self.type],
					Col: 1,
					a: 'cd',
					CK: null,
					Link_id: Spaces.params.link_id
				};
				toggle_save(true);
				Spaces.api("files.createDir", api_data, function (res) {
					toggle_save(false);
					if (res.code == 0) {
						self.view("create", true).html(res.widget);
					} else {
						self.showError(Spaces.apiError(res));
					}
					self.fixHeight();
				}, {
					onError: function (err) {
						toggle_save(true);
						self.showError(err);
					}
				});
			})
			// Выбор коллекции и сохранение файла в неё
			.on('click', '.js-collections_dirs .js-dir', function (e, data) {
				e.stopPropagation();
				e.preventDefault();
				
				if (self.busy)
					return;
				
				var dir = $(this);
				
				var toggle_save = function (saving) {
					self.busy = saving;
					
					var img = dir.find('img');
					if (saving) {
						img.data("old_src", img.prop("src")).prop("src", ICONS_BASEURL + "spinner2.gif");
					} else {
						img.prop("src", img.data("old_src"));
					}
				};
				
				var api_data = {
					File_id: self.nid,
					Ft: self.fileType,
					Type: self.type,
					Dir: dir.data('nid'),
					Link_id: Spaces.params.link_id,
					Force: 1,
					CK: null
				};
				
				toggle_save(true);
				Spaces.api("files.copy2me", api_data, function (res) {
					toggle_save(false);
					if (res.code == 0) {
						self.showMsg(tpl.saveNotif({
							name: $.trim(dir.find('.js-dir_name').text()),
							url: dir.prop("href"),
							id: res.fileId,
							type: self.type,
							origNid: self.nid
						}));
						
						// Удаляем мотиватор
						$('#collections_motivator_' + self.type + '_' + self.nid).remove();
						
						DdMenu.close();
					} else {
						self.showError(Spaces.apiError(res));
					}
				}, {
					onError: function (err) {
						toggle_save(false);
						self.showError(err);
					}
				});
			})
			// Переход на список коллекций
			.on('click', '.js-collections_list', function (e) {
				e.stopPropagation();
				e.preventDefault();
				self.view("list", true);
			})
			// Сохранение новой коллекции
			.on('click', 'button[name="cfms"]', function (e) {
				e.stopPropagation();
				e.preventDefault();
				
				var form = self.view("create"),
					save_btn = $(this),
					name = form.find('input[name="n"]'),
					name_val = $.trim(name.val()),
					api_data = $.extend(Url.serializeForm(form), {
						D: -Spaces.params.nid,
						Type: FILE_TYPE_2_DIR_TYPE[self.type],
						Col: 1,
						a: 'cd',
						cfms: 1,
						Link_id: Spaces.params.link_id
					});
				
				var toggle_save = function (saving) {
					save_btn.find('.js-ico').toggleClass('ico_spinner', saving);
				};
				Spaces.api("files.createDir", api_data, function (res) {
					toggle_save(false);
					if (res.code == 0) {
						if (res.dirs) {
							var list = self.view("list", true).find('.js-collections_dirs');
							list.html(res.dirs.join(''));
							
							// Ищем только что созданную папку
							var dirs = [], dirs_hash = {};
							list.find('[data-nid]').each(function () {
								var el = $(this), nid = el.data('nid');
								dirs_hash[nid] = el;
								dirs.push(nid);
							});
							
							dirs.sort(function (a, b) {
								return b - a;
							});
							
							// И сохраняем в неё файл
							dirs_hash[dirs[0]].click();
						} else {
							form.html(res.widget);
						}
					} else {
						Spaces.view.setInputError(name, Spaces.apiError(res));
					}
					self.fixHeight();
				}, {
					onError: function (err) {
						toggle_save(false);
						Spaces.view.setInputError(name, err);
					}
				});
				
				toggle_save(true);
			});
			
			menu.content().append(tpl.window());
			self.menu = menu;
		}
		
		if ($('#Gallery').length) {
			menu.on('resize', function () {
				self.onResize();
			}).on('opened', function () {
				$('#g_sharelink_inner').addClass('js-clicked');
			}).on('closed', function () {
				$('#g_sharelink_inner').removeClass('js-clicked');
			});
		} else {
			page_loader.onShutdown("collections", function () {
				self.destroy();
			});
		}
	},
	showMsg: function (text) {
		var self = this;
		if (self.msg.length) {
			self.msg.html(text).removeClass('hide');
		} else {
			Spaces.showMsg(text, {gallery: true});
		}
	},
	showError: function (err) {
		var self = this;
		self.view("error", true).html(tpl.errorMessage(err));
	},
	destroy: function () {
		var self = this;
		if (self.link) {
			self.link.removeData('__collections__');
			self.link.removeClass('js-dd_menu_link');
		}
		if (self.menu)
			self.menu.destroy();
		self.msg = self.menu = self.link = null;
	},
	view: function (name, do_switch) { // TODO: вынести в класс
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
	onResize: function () {
		var self = this,
			menu = self.menu.element(),
			content = self.menu.content();
		
		var max_height = menu.css("maxHeight").replace("px", "");
		if (max_height == 'none' || !max_height)
			return;
		
		var paddings = (+menu.css("paddingTop").replace("px", "") || 0) + 
			(+menu.css("paddingBottom").replace("px", "") || 0);
		max_height -= paddings;
		if (max_height != menu.data('oldMaxHeight')) {
			menu.data('collectionsOffset', 0);
			menu.data('oldMaxHeight', max_height);
		}
		
		var next = content.find('.js-collections_next'),
			rewind = content.find('.js-collections_rewind'),
			dirs_wrap = content.find('.js-collections_dirs'),
			dirs = dirs_wrap.children().hide().toArray(),
			offset = menu.data('collectionsOffset') || 0,
			chunk = 0;
		
		next.removeClass('hide');
		rewind.addClass('hide');
		
		var old_h, i = 0, last_show = -1;
		while (max_height >= content.height() && i < dirs.length) {
			if (i >= offset) {
				$(dirs[i]).show();
				last_show = i;
				++chunk;
			}
			++i;
		}
		
		if (last_show == -1) {
			$(dirs[offset]).show();
			last_show = offset;
		}
		
		if (max_height < content.height()) {
			if (!offset && last_show == dirs.length - 1) {
				next.addClass('hide');
			} else if (last_show && chunk > 1) {
				$(dirs[last_show]).hide();
				--last_show;
				--chunk;
			}
		}
		
		if (!dirs.length || last_show == dirs.length - 1) {
			next.addClass('hide');
			if (offset)
				rewind.removeClass('hide');
		} else {
			menu.data('collectionsChunk', chunk);
		}
	},
	fixHeight: function () {
		var self = this;
		if ($('#Gallery').length) {
			self.onResize();
		} else {
			fixPageHeight();
		}
	}
});

module.on("component", function () {
	FileCollections.setup();
});

export default FileCollections;
