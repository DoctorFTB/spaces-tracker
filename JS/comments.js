import module from 'module';
import Device from './device';
import $ from './jquery';
import * as pushstream from './core/lp';
import {Spaces, Url, Codes} from './spacesLib';
import {default as page_loader, HistoryManager} from './ajaxify';
import notifications from './notifications';
import {L, tick, numeral, ge} from './utils';
import {copyToClipboard} from './core/clipboard';

let AttachSelector;

/*
================= 1-level =================
НОВЫЕ ВНИЗУ (current.sort=0)
1
2
3
4
< Показать следующие комментарии >

НОВЫЕ ВВЕРХУ (current.sort=1)
99
98
97
96
< Показать предыдущие комментарии >

================= 2-level =================
НОВЫЕ ВНИЗУ (current.sort=0)
1
2
3
4
......5
......6
......7
......< Показать следующие комментарии >
30
31
32

НОВЫЕ ВВЕРХУ (current.sort=1)
32
31
30
4
......< Показать предыдущие комментарии >
......27
......28
......29
3
2
1
*/
var tpl = {
	copied: function () {
		return '<span class="green">Скопировано!</span>';
	},
	captcha: function (data) { // TODO: получать с бекенда
		if (data.url) {
			return '<div style="padding-left: 5px; padding-top: 5px"><img src="' + data.url + '" alt="" /></div>' + 
				'<div class="stnd_padd" style="font-size:small;">' + L("Введите код:") + ' <input type="text" name="captcha_code" size="4" value="" /></div>';
		}
		return '';
	},
	dateSpinner: function () {
		return '<span class="comment_date js-comment_spinner">' + 
					'<span class="ico ico_spinner"></span>' + 
				'</span>';
	},
	newSpinner: function () {
		return '<span class="ico ico_spinner hide js-spinner"></span> ';
	},
	notif: function (text) {
		var html = 
			'<a href="#close-notif" class="tdn right"><span class="ico ico_remove js-comments_notif_close"></span></a>' + 
			text;
		return html;
	},
	commentError(error) {
		return `
			<div class="comm-error">
				${error}
			</div>
		`;
	},
	menuNotification(status, message) {
		return `
			<div class="widgets-group">
				<div class="comm margin0 ${status == 'error' ? 'red' : 'green'}">
					${status == 'error' ? '' : '<span class="ico ico_ok_green"></span>'}
					${message}
				</div>
			</div>
		`;
	}
};

var TAB_ID = Date.now();

var CommentsModule = function (wrap) {
	var current,
		last_sub_req, last_delete_req, last_more_req,
		comments_queue = {},
		comments_ids = {},
		last_deleted_comment,
		is_dirty_state = false,
		reply_from_opened,
		mod_id = 'comments_' + Date.now();
	
	var CommentsController = {
		initParams: function () {
			var self = this;
			
			comments_queue = {};
			last_deleted_comment = null;
			
			var form_lite_widget = wrap.find('.js-comment_form');
			current = $.extend(wrap.find('.js-comments_list').data(), {
				form:		form_lite_widget.parents('form'),
				textarea:	form_lite_widget.find('textarea').first(),
				pagination:	wrap.find('.js-comments-pgn')
			});
			
			if (current.rootId) {
				current.list = wrap.find('#sub_' + current.rootId + '_list');
			} else {
				current.list = wrap.find('.js-comments_wrap');
			}
			
			current.roots = {0: true};
			current.sort = {0: current.rootSort};
			current.load_sort = {0: current.rootSort};
			current.counter = {0:  +current.rootCommentsCnt};
			current.unread = {0: 0};
			current.bias = {0: 0};
			
			if (current.lenta) {
				if (!current.sort[0])
					current.load_sort[0] = 1;
			}
			
			if (notifications && !current.lenta && !current.disable) {
				// Устанавливаем тип раздела, где сейчас находится юзер
				notifications.setPlace(current.type, current.id, current.objectType);
			}
			
			if (!current.disable)
				self.collectIds();
			
			reply_from_opened = false;
		},
		init: function () {
			var self = this;
			
			self.initParams();
			
			if (!current.disable)
				self.initDelete();
			
			// Триггерим показ "Ещё N комментариев"
			if (current.lenta)
				self.setCounter(0, current.counter[0]);
			
			// Меню комментария
			$(wrap).action('comment_menu_open', function (e) {
				e.preventDefault();
				e.stopPropagation();
				
				let el = $(this);
				let comm = el.parents('.js-comm');
				self.openMenu(el, comm, "links");
			})
			
			// Форма жалобы
			.action('comment_complaint', function (e) {
				e.preventDefault();
				e.stopPropagation();
				
				let el = $(this);
				let comm = el.parents('.js-comm');
				self.openMenu(el, comm, "complaint");
			})
			
			// Отправка жалобы
			.action('comment_complaint_send', function (e) {
				e.preventDefault();
				
				let el = $(this);
				let comm = el.parents('.js-comm');
				let menu = comm.find('.js-comm-menu-complaint');
				let cid = comm.data('id');
				
				var api_data = {
					CK: null,
					Oid: cid,
					Ot: current.type
				};
				
				// Доп. поля в жалобе
				let reason = menu.find('.js-radio-complaint_reason.form-checkbox_checked input');
				let comment_textarea = menu.find('textarea');
				let api_method = 'complaints.spamComplain';
				
				if (comment_textarea.length) {
					api_method = 'complaints.complain';
					
					let complaint_text = $.trim(comment_textarea.val());
					
					let error = false;
					if (!reason.length) {
						error = L("Чтобы отправить жалобу нужно выбрать причину.");
					} else if (!complaint_text.length) {
						error = L("Чтобы отправить жалобу нужно заполнить сообщение.");
					}
					api_data.R = reason.val();
					api_data.c = complaint_text;
					
					Spaces.view.setInputError(comment_textarea, error);
					
					if (error)
						return false;
				}
				
				menu.find('.js-spinner').addClass('ico_spinner');
				Spaces.api(api_method, api_data, function (res) {
					if (res.code == 0) {
						menu.html(tpl.menuNotification('success', L("Жалоба успешно отправлена.")));
					} else {
						menu.html(tpl.menuNotification('error', Spaces.apiError(res)));
					}
					setTimeout(() => self.closeMenu(comm), 3000);
					$('html, body').scrollTo(menu, {position: 'center'});
				}, {
					onError(err) {
						menu.html(tpl.menuNotification('error', err));
						setTimeout(() => self.closeMenu(comm), 3000);
						$('html, body').scrollTo(menu, {position: 'center'});
					}
				});
			})
			
			// Закрыть меню
			.action('comment_menu_close', function (e) {
				e.preventDefault();
				let comm = $(this).parents('.js-comm');
				self.closeMenu(comm);
			})
			
			// Скрытие уведомления
			.on('click', '.js-comments_notif_close', function (e) {
				e.preventDefault();
				self.showMsg(false);
			})
			
			// Копирование ссылки
			.action('comment_link', function (e) {
				e.preventDefault();
				
				let el = $(this);
				
				// Копируем в буфер браузера
				copyToClipboard(el.data('link'));
				
				// Копируем в буфер сайта
				if (Spaces.params.nid) {
					Spaces.api("common.copyURL", {
						url:	el.data('link'),
						CK:		null
					});
				}
				
				// Анимация
				let setStatus = (flag) => {
					el.find('.js-text')
						.text(flag ? L('Скопировать ссылку (скопировано)') : L('Скопировать ссылку'))
						.toggleClass('green', flag)
					el.find('.js-ico')
						.toggleClass("ico_mail ico_mail_link", !flag).toggleClass("ico ico_ok_green", flag);
				};
				setStatus(true);
				setTimeout(() => {
					let comm = el.parents('.js-comm');
					self.closeMenu(comm);
					setStatus(false);
				}, 1500);
			})
			// Раскрытие субветки комментариев
			.action('sub_comments_expand sub_comments_collapse', function (e) {
				e.preventDefault();
				
				var el = $(this),
					comm = el.parents('.js-comm');
				
				if (el.data('busy'))
					return;
				
				var set_busy = function (flag) {
					el.data('busy', flag);
					
					var comment_date = comm.find('.comment_date');
					if (flag) {
						comment_date.addClass('hide')
							.after(tpl.dateSpinner());
					} else {
						comment_date.removeClass('hide');
						comm.find('.js-comment_spinner').remove();
					}
				};
				
				set_busy(true);
				
				self.loadSubComments({
					id: comm.data("id"),
					expand: e.linkAction == 'sub_comments_expand'
				}, function () {
					set_busy(false);
				}, function (err) {
					set_busy(false);
					Spaces.showError(err);
				});
			})
			
			// Перевод комментария
			wrap.on('click', '.js-comment_translate', async (e) => {
				e.preventDefault();

				let el = $(e.target);
				let comm = el.parents('.js-comm');
				let cid = comm.data("id");

				if (el.data('busy'))
					return;

				let setBusy = (flag) => {
					el.data('busy', flag);

					let commentDate = comm.find('.comment_date');
					if (flag) {
						commentDate.addClass('hide').after(tpl.dateSpinner());
					} else {
						commentDate.removeClass('hide');
						comm.find('.js-comment_spinner').remove();
					}
				};

				let switchTranslate = (flag) => {
					originalText.toggleClass('hide', flag);
					translatedText.toggleClass('hide', !flag);
					el.html(flag ? L("Показать оригинал") : L("Показать перевод"));
					comm.data('translated', flag);
				};

				let originalText = comm.find('.js-comment_original_text');
				let translatedText = comm.find('.js-comment_translated_text');

				if (comm.data('translated')) {
					switchTranslate(false);
				} else if (comm.data('translateCached')) {
					switchTranslate(true);
				} else {
					setBusy(true);
					let response = await Spaces.asyncApi("comments.translate", {
						Id: cid,
						Type: current.type,
						...el.data('params')
					});
					setBusy(false);

					if (response.code == 0) {
						translatedText.html(response.translation);
						switchTranslate(true);
						comm.data('translateCached', true);
					} else {
						translatedText.html(tpl.commentError(Spaces.apiError(response)));
						switchTranslate(true);
					}
				}
			});

			if (!pushstream || !page_loader.ok() || current.disable)
				return;
			
			wrap.on('click', '.js-comments_subscribe', function (e) {
				e.preventDefault();
				var el = $(this),
					off = el.hasClass('js-comments_unsubscr');
				
				if (el.hasClass('disabled'))
					return;
				el.addClass('disabled');
				
				var on_done = function () {
					el.removeClass('disabled');
				};
				
				var params = {
					CK: null,
					Oid: current.id,
					Ot: current.objectType
				};
				params[off ? 'Off' : 'On'] = 1;
				
				Spaces.api("journal.subscribe", params, function (res) {
					on_done();
					if (res.code != 0) {
						Spaces.showApiError(res);
					} else {
						wrap.find('.js-comments_subscr').toggleClass('hide', !off);
						wrap.find('.js-comments_unsubscr').toggleClass('hide', off);
					}
				}, {
					onError: function (err) {
						Spaces.showError(err);
						on_done();
					}
				});
			}).action('comment_reply', function (e) {
				var el = $(this),
					comm = el.parents('.js-comm'),
					id = comm.data("id"),
					opened = el.hasClass('js-clicked'),
					form = wrap.find('.js-comments_form'),
					hidden = !!comm.find('.comm_hidden').length,
					checkbox = form.find('input[name="Hidden"]'),
					root_id = self.getRootIdFromParent(el);
				
				if (!form.length)
					return;
				e.preventDefault();
				
				self.resetReplyForm();
				if (!opened) {
					reply_from_opened = true;
					wrap.find('.js-comments_form_reply').removeClass('hide');
					wrap.find('.js-comments_form_user').empty().append($.trim(comm.find('.user__nick .inl_bl').html()));
					form.data({
						reply_id:	id,
						root_id:	root_id
					});
					
					var sibling = comm;
					if (root_id && !comm.next().length)
						sibling = $('#sub_' + root_id);
					
					sibling.after(form);
					comm.addClass('comm-menu_opened');
					el.addClass('js-clicked');
					
					if (checkbox.prop("checked") != hidden)
						checkbox.parent().click();
					
					tick(function () {
						if (Device.type == 'desktop')
							form.find('textarea').focus();
					});
					
					import("./form_toolbar").then(function ({default: Toolbar}) {
						Toolbar.expand(form, true);
					});
				}
			}).on('click', '.js-comm_compl', function (e) {
				e.preventDefault();
				var el = $(this),
					comm = el.parents('.js-comm'),
					comm_id = comm.data("id"),
					compl_div = wrap.find('.js-tpl-comments_compl'),
					need_open = compl_div.data('id') != comm_id;
				self.resetReplyForm();
				if (need_open) {
					var root_id = self.getRootIdFromParent(el);
					
					var sibling = comm;
					if (root_id && !comm.next().length)
						sibling = $('#sub_' + root_id);
					
					sibling.after(compl_div.data("id", comm_id));
					comm.addClass('comm-menu_opened');
					el.addClass('link_active');
				}
			}).on('click', '.js-comm_close', function (e) {
				e.preventDefault();
				self.resetReplyForm();
			}).on('click', '.js-comments_more-link', function (e) {
				e.preventDefault();
				var el = $(this),
					spinner = el.find('.js-spinner'),
					root_id = el.data('rootId') || 0;
				
				if (spinner.isVisible())
					return;
				
				spinner.removeClass('hide');
				
				let offset;
				let limit;
				if (el.data('dir') > 0) {
					offset = self.getCommentsLoadOffset(root_id);
					limit = current.onPage;
				} else {
					offset = Math.max(0, current.bias[root_id] - current.onPage);
					limit = Math.min(current.onPage, current.bias[root_id]);
				}
				
				self.getMoreMessages(root_id, offset, limit, function () {
					if (el.data('dir') < 0) { // TODO: тут это ок?
						current.bias[root_id] -= limit;
					}
					spinner.addClass('hide');
				}, function (err) {
					spinner.addClass('hide');
					Spaces.showError(L("Ошибка получения комментариев:") + err);
				});
			}).on('click', '.js-comments_unread-link', function (e) {
				e.preventDefault();
				
				var el = $(this),
					spinner = $(this).find('.js-spinner'),
					root_id = self.getRootIdFromParent(el);
				
				if (spinner.isVisible())
					return;
				
				spinner.removeClass('hide');
				
				var new_cnt = current.counter[root_id] + current.unread[root_id]
				self.loadEndPage(root_id, new_cnt, function () {
					current.unread[root_id] = 0;
					self.updateUnread(root_id);
					spinner.addClass('hide');
				}, function (err) {
					spinner.addClass('hide');
					Spaces.showError(err);
				});
			});
			
			page_loader.on('shutdown', mod_id, function () {
				self.reset();
				pushstream.off("*", mod_id);
			});
			
			if (!current.lenta) {
				pushstream
					.on('message', mod_id, $.proxy(self.onLongPolling, self))
					.on('disconnect', mod_id, function () {
						is_dirty_state = true;
					});
			}
			
			// Отправка комментария
			current.form.on('submit', function (e) {
				if (!this.submit_btn || this.submit_btn.name != "cfms")
					return;
				e.preventDefault();
				
				self.submitForm();
			});
		},
		
		submitForm: function () {
			var self = this,
				form_wrap = wrap.find('.js-comments_form');
			
			var reply_id = form_wrap.data('reply_id') || current.rootId,
				root_id = form_wrap.data('root_id') || 0;
			
			if (!root_id && reply_id && current.treeView)
				root_id = reply_id;
			
			// Ветка может быть ещё не раскрыта
			if (root_id)
				self.initRoot(root_id);
			
			if (current.form.data('busy'))
				return;
			
			var text = $.trim(current.textarea.val()),
				max_length = current.textarea.data('maxlength'),
				msg_error = false,
				submit_btn = $(current.form.prop("submit_btn")),
				attaches = AttachSelector.getAttaches(current.form, true),
				att_sel = AttachSelector.instance(current.form),
				form = Url.serializeForm(current.form[0]);
			
			if (!text.length && (!att_sel || (!att_sel.getTmpCnt()) && !attaches.length)) {
				msg_error = L('Комментарий не должен быть пустым.');
			} else if (text.length > max_length) {
				msg_error = L('Комментарий не должен быть больше {0} {1}.', max_length,
					numeral(max_length, [L("символа"), L("символов"), L("символов")]));
			}
			Spaces.view.setInputError(current.textarea, msg_error);
			
			if (msg_error)
				return;
			
			var set_busy = function (flag) {
				current.form.data('busy', flag);
				if (flag) {
					current.textarea.attr('readonly', 'readonly');
					if (!submit_btn.data('old_name'))
						submit_btn.data('old_name', submit_btn.val());
					submit_btn.val('Отправка').attr('disabled', 'disabled').css({opacity: 0.5});
				} else {
					current.textarea.removeAttr('readonly');
					submit_btn.val(submit_btn.data('old_name')).removeAttr('disabled').css({opacity: ''});
				}
			};
			
			set_busy(true);
			
			if (AttachSelector.isBusy()) {
				AttachSelector.onDone(function () {
					set_busy(false);
					submit_btn.click();
				});
				return;
			}
			
			var api_data = $.extend(self.getApiExtra(), {
				Type: current.type,
				Id: current.id,
				comment: text,
				Cr: reply_id,
				atT: attaches,
				CK: null,
				captcha_code: form.captcha_code,
				Pag: true,
				Com: current.lenta,
				from: current.form.find('input[name="from"]').val(),
				Hidden: form.Hidden
			});
			
			var predict_next_page = self.isActivePage(root_id) ?
				(current.load_sort[root_id] ? 1 : self.getMaxPage(root_id, 1)) : 
				self.getPage(root_id);
			
			if (current.lenta || root_id) {
				delete api_data.Cp;
			} else {
				if (current.rootId)
					api_data.Root_id = current.rootId;
				api_data.Cp = predict_next_page;
			}
			
			var old_cnt = current.counter[root_id];
			Spaces.api("comments.add", api_data, function (res) {
				wrap.find('.js-captcha_widget').html(tpl.captcha({
					url: res.captcha_url
				}));
				
				if (res.code != 0) {
					set_busy(false);
					if (res.code != Codes.COMMON.ERR_NEED_CAPTCHA) {
						var errors = [];
						if (res.code == Codes.COMMENTS.ERR_INVALID) {
							$.each(res.errors, function (k, v) {
								errors.push(v);
							});
						} else {
							errors = [Spaces.apiError(res)];
						}
						Spaces.view.setInputError(current.textarea, errors.join('<br />'));
					}
				} else {
					current.textarea.val('').trigger('change');
					AttachSelector.resetAttaches(current.form);
					
					var on_comment_posted = function () {
						self.resetReplyForm();
						
						set_busy(false);
						self.showMsg(false);
						
						if (!current.lenta && !root_id) {
							if (res.notify && predict_next_page != self.getPage(root_id))
								self.showMsg(L("Ваш комментарий добавлен!") + ' <a href="' + res.notify + '">' + L("Вернуться назад") + '</a>');
						}
						
						var comments_wrap = root_id ? $('#sub_' + root_id + '_list') : current.list,
							my_comment;
						if (current.sort[root_id]) {
							my_comment = comments_wrap.children().first();
						} else {
							my_comment = comments_wrap.children().last();
							self.setPage(root_id, self.getPage(root_id));
						}
						
						current.unread[root_id] = 0;
						self.updateUnread(root_id);
						
						$('html, body').scrollTo(my_comment, {position: "visible"});
						self.highlightNewComment(my_comment, true);
					};
					
					// Кол-во комментариев на текущем уровне
					var new_cnt = self.getLevelCnt(res, root_id);
					
					// Устанавливаме dirty-флаг, если после добавления комментария счётчик изменился не на +1
					if (new_cnt != old_cnt + 1 && self.hasRoot(root_id))
						is_dirty_state = true;
					
					self.setCommonCounter(res.cnt);
					
					// Если мы на активной странице + не установлен dirty-флаг,
					// то просто добавляем комментарий на текущую страницу
					if (self.isActivePage(root_id) && !is_dirty_state) {
						self.removeRestoreComment();
						
						// Добавляем комментарий в список
						var new_comments = {};
						new_comments[res.id] = res.widget;
						
						self.updateComments(root_id, false, {
							comments:		new_comments,
							newComment:		true
						});
						
						self.setCounter(root_id, new_cnt);
						
						if (!current.lenta && !root_id)
							current.pagination.html(res.pagination || '');
						
						on_comment_posted();
					}
					// Иначе запрашиваем с сервера страницу с последними комментариями
					else {
						self.loadEndPage(root_id, new_cnt, function () {
							on_comment_posted();
						}, function (err) {
							set_busy(false);
							Spaces.view.setInputError(current.textarea, err);
						});
					}
				}
			}, {
				disableCaptcha: true,
				onError: function (err) {
					set_busy(false);
					Spaces.view.setInputError(current.textarea, err);
				}
			});
		},
		
		loadEndPage: function (root_id, new_cnt, callback, onerror) {
			var self = this;
			
			if (current.lenta) {
				self.getMoreMessages(root_id, 0, current.onPage, callback, onerror);
			} else if (root_id) {
				self.loadSubComments({id: root_id, expand: true, last: true}, callback, onerror);
			} else {
				var active_page = current.sort[root_id] ? 1 : Math.ceil(new_cnt / current.onPage);
				self.loadComments({
					page: active_page
				}, callback, onerror);
			}
		},
		
		loadSubComments: function (options, callback, onerror) {
			var self = this;
			
			var sort = current.sort[0];
			if (options.last && !sort)
				sort = 1;
			
			last_sub_req = Spaces.api("comments.read", $.extend(self.getApiExtra(), {
				IdS:			[options.id],
				Pag:			false,
				Ch:				true,
				Sub_comments:	options.expand,
				Sort:			sort
			}), function (res) {
				if (res.code == 0) {
					self.resetReplyForm();
					$('#sub_' + options.id).remove();
					$('#c' + options.id).replaceWith(res.comments[options.id]);
					
					delete current.roots[options.id];
					self.collectIds();
					
					callback();
					
					if (options.last && options.expand) {
						let comm_to_scroll = $('#sub_' + options.id + '_list').children().last();
						$('html, body').scrollTo(comm_to_scroll, {position: "visible"});
					}
					
					self.highlightNewComment($('#sub_' + options.id + '_list'));
				} else {
					onerror(Spaces.apiError(res));
				}
			}, {
				retry: 10,
				onError: function (err) {
					onerror(err);
				}
			});
		},
		showMsg: function (text) {
			wrap.find(current.sort[0] ? '.js-comments_top_notif' : '.js-comments_bottom_notif')
				.toggleClass('hide', !text).html(tpl.notif(text));
		},
		closeMenu(comm) {
			let opened_menu = comm.data('openedMenu');
			if (opened_menu) {
				opened_menu.link.removeClass('js-clicked');
				opened_menu.menu.addClass('hide');
				comm.data('openedMenu', false);
			}
			
			$('body').off(`click.comm${comm.data('id')}`);
		},
		openMenu(link, comm, menu_id) {
			let self = this;
			let opened_menu = comm.data('openedMenu');
			if (opened_menu && opened_menu.id == menu_id) {
				// Нажали второй раз по "..." для закрытия меню
				self.closeMenu(comm);
			} else {
				// Закрываем предыдущее меню
				self.closeMenu(comm);
				
				// Закрытие по свободному клику
				$('body').on(`click.comm${comm.data('id')}`, (e) => {
					if (!$(e.target).parents('.spoiler_inject').length)
						self.closeMenu(comm);
				});
				
				// Открываем новое
				let menu = comm.find(`.js-comm-menu-${menu_id}`);
				menu.removeClass('hide');
				link.addClass('js-clicked');
				
				// Копируем шаблон меню
				let template = wrap.find(`.js-tpl-comments-${menu_id}`);
				if (template.length)
					menu.empty().append(template.children().clone());
				
				comm.data('openedMenu', {id: menu_id, link, menu});
			}
		},
		initDelete: function () {
			var self = this;
			wrap
				// Скрытие коммента
				.action('comment_hide comment_show', function (e) {
					e.preventDefault();
					
					let comm = $(this).parents('.js-comm');
					let id = comm.data("id");
					
					self.hideComment(id, e.linkAction == 'comment_hide');
				})
				// Удаление коммента
				.action('comment_delete', function (e) {
					e.preventDefault();
					
					let el = $(this);
					let comm = el.parents('.js-comm');
					let id = comm.data("id");
					
					self.deleteComment(el, id, 'delete', current.type);
				})
				// Восстановить коммент
				.on('click', 'a.ajax_restore_message', function (e) {
					if (!last_deleted_comment)
						return;
					
					e.preventDefault();
					var element = $(this), cid = element.data('cmtid');
					$('#rc' + cid).find('.js-comment_spinner').removeClass('hide');
					self.deleteComment(element, cid, 'restore_message', element.data('cmttype'));
				});
		},
		
		// Подсвечиваем появление нового комментария
		highlightNewComment: function (comm, my) {
			if ($.support.nativeAnim) {
				comm.find('.comm').each(function () {
					var el = $(this);
					el.addClass('comm_new');
					setTimeout(function () {
						el.cssAnim('background', 'ease-out', my ? 450 : 2000);
						el.removeClass('comm_new');
					}, 50);
				});
			}
		},
		
		// Удаляет "Комментарий удалён | Отмена"
		removeRestoreComment: function () {
			last_deleted_comment = null;
			wrap.find('.js-comment_restore').first().remove();
			
			var curl = new Url(location.href);
			if (curl.query.Deleted) {
				delete curl.query.Deleted;
				delete curl.query.CK;
				HistoryManager.replaceState(HistoryManager.state, document.title, curl.url(true));
			}
		},
		
		// Обработка LP
		onLongPolling: function (data) {
			var self = this;
			
			if (current.disable_lp)
				return;
			
			// Игнорим чужие события
			if (data.objectId != current.id || data.commentType != current.type || data.hash == TAB_ID)
				return;
			
			// Игнорим скрытые комментарии, если не можем их видеть
			if (!current.canSeeDeleted && data.hidden)
				return;
			
			if (current.rootId && data.rootCommentId != current.rootId)
				return;
			
			if (data.restored) {
				is_dirty_state = true;
				return;
			}
			
			if (current.rootId) {
				data.rootCommentId = 0;
			} else {
				data.rootCommentId = data.rootCommentId || 0;
			}
			
			if (data.rootCommentId)
				self.initRoot(data.rootCommentId);
			
			switch (+data.act) {
				case pushstream.TYPES.COMMENT_ADD:
					// Не получаем автоматически в фоне!
					if (!notifications.isWindowActive())
						is_dirty_state = true;
					
					// Ставим dirty-флаг, если открыта форма ответа
					if (reply_from_opened)
						is_dirty_state = true;
					
					// Ставим dirty-флаг, если юзер сейчас набирает сообщение
					if ($('textarea:focus').length)
						is_dirty_state = true;
					
					// Добавляем сообщение, пришедшее по LP, только если:
					// - Не установлен dirty-флаг
					// - Страница ещё не заполнена
					// - Мы на странице с последними комментариями
					if (!is_dirty_state && !self.isFullPage(data.rootCommentId) && self.isActivePage(data.rootCommentId)) {
						self.getMessageDelayed(data.rootCommentId, {id: data.id});
					} else {
						var update_unread_cnt = function () {
							is_dirty_state = true;
							current.unread[data.rootCommentId]++;
							self.updateUnread(data.rootCommentId);
						};
						
						// Добавили суб-комментарий
						if (data.rootCommentId) {
							// Если корневой комментарий не присутствует на странице - ничего не делаем
							if ($('#c' + data.rootCommentId).length) {
								// Если рутовый комментарий уже развёрнут - выводим счётчик непрочитанного
								if (self.hasRoot(data.rootCommentId)) {
									if (current.load_sort[data.rootCommentId] || !self.hasMore(data.rootCommentId)) {
										update_unread_cnt();
									} else {
										self.setCounter(data.rootCommentId, current.counter[data.rootCommentId] + 1);
									}
								}
								// Если ещё не был развёрнут - обновляем корневой комментарий целиком,
								// чтобы обновился счётчик суб-комментариев
								else {
									self.getMessageDelayed(0, {id: data.rootCommentId}, true);
								}
							}
						}
						// Обновляем счётчик непрочитанного
						else {
							update_unread_cnt();
						}
					}
				break;
				
				case pushstream.TYPES.COMMENT_DELETE:
					is_dirty_state = true;
				break;
			}
		},
		
		// Обновляем блок с ссылкой на непрочитанное
		updateUnread: function (root_id) {
			var self = this;
			
			var unread_wrap = wrap.find('.js-comments_unread_' + root_id);
			unread_wrap.toggleClass('hide', !current.unread[root_id]);
			
			if (current.unread[root_id] > 0) {
				var curl = new Url(location.href);
				self.updateUrlPage(curl, current.sort[root_id] ? 1 : self.getPage(root_id) + Math.ceil(current.unread[root_id] / current.onPage));
				
				var title = numeral(current.unread[root_id], [L('+$n новый комментарий'), L('+$n новых комментария'), L('+$n новых комментариев')]);
				unread_wrap.find('.js-comments_unread-link').prop("href", curl.url()).html(tpl.newSpinner() + title);
				
				if (notifications && !notifications.isWindowActive())
					notifications.showNewEvent(title, {oneTab: true, notif: false});
			}
		},
		
		updateUrlPage: function (curl, page) {
			delete curl.query.p;
			delete curl.query.P;
			delete curl.query.cp;
			delete curl.query.Cp;
			delete curl.query.scp;
			delete curl.query.Scp;
			
			var seo_url_re = new RegExp('/p\\d+(/|$|\\?)', 'i');
			if (seo_url_re.test(curl.path)) { // Димин SEO-урл
				curl.path = curl.path.replace(seo_url_re, '/p' + page + '$1');
			} else {
				curl.query.Cp = page;
			}
		},
		
		// Загрузка комментариев
		loadComments: function (opts, callback, onerror) {
			var self = this;
			
			var opts = $.extend({
				page:		1
			}, opts);
			
			var api_data = $.extend(self.getApiExtra(), {
				Pag:		true,
				Root_id:	current.rootId
			});
			
			api_data.Cp = opts.page;
			
			var xhr_callback = function (res) {
				if (res.code != 0) {
					delete api_data.sid;
					onerror && onerror(Spaces.apiError(res));
				} else {
					self.resetReplyForm();
					self.reset();
					current.list.html(res.comments.join(''));
					current.pagination.html(res.pagination || '');
					self.collectIds();
					
					// Кол-во комментариев на текущем уровне
					var new_cnt = self.getLevelCnt(res, 0);
					self.setCounter(0, new_cnt);
					self.setCommonCounter(+res.cnt);
					
					self.setPage(0, self.getPage(0));
					
					callback && callback();
				}
			};
			
			Spaces.api("comments.read", api_data, xhr_callback, {
				retry: 20,
				onError: function (err) {
					onerror && onerror(err);
				}
			});
		},
		
		// Скрытие комментария
		hideComment: function (id, hide) {
			var self = this,
				el = $('#c' + id),
				root_id = self.getRootIdFromParent(el);
			
			if (el.data('busy'))
				return;
			
			el.data('busy', true);
			el.find('.comment_date')
				.addClass('hide')
				.after(tpl.dateSpinner());
			
			var remove_spinner = function () {
				el.find('.js-comment_spinner').remove();
				el.find('.comment_date').removeClass('hide');
				el.removeData('busy');
			};
			var api_data = {
				Ec: id,
				Id: current.id,
				Type: current.type,
				CK: null
			};
			api_data[hide ? "Hc" : "Rc"] = 1;
			Spaces.api("comments.add", api_data, function (res) {
				if (res.code == 0) {
					self.updateComments(root_id, false, {
						comments: {[id]: res.widget},
						newComment: true
					});
				} else {
					Spaces.showApiError(res);
					remove_spinner();
				}
			}, {
				onError: function (err) {
					Spaces.showError(err);
					remove_spinner();
				}
			});
		},
		
		// Удаление комментария
		deleteComment: function (el, cid, action, object_type) {
			var self = this,
				comm_widgets = $('#c' + cid + ', #cr' + cid + ', #sub_' + cid),
				comm = $('#c' + cid + ', #cr' + cid),
				root_id = self.getRootIdFromParent(comm);
			
			if (comm.data('busy'))
				return;
			
			is_dirty_state = true;
			
			var api_method, api_data;
			if (action == 'delete') {
				api_method = "comments.delete";
				api_data = new Url(el.prop("href")).query;
				api_data.type = object_type;
				api_data.Comment_widget = 1;
				api_data.Id = current.id;
			} else {
				api_method = 'uobj.uobj.restore';
				api_data = new Url(el.prop("href")).query;
			}
			
			api_data.CK = null;
			api_data.hash = TAB_ID;
			api_data.Ch = true;
			api_data.Pag = false;
			
			var is_right_edge = current.load_sort[root_id] ?
				self.isBeginPage(root_id) :
				self.isActivePage(root_id);
			
			var new_page;
			if (action == 'delete') {
				api_data.Root_id = root_id || current.rootId;
				
				if (root_id || current.lenta) {
					api_data.O = this.getCommentsLoadOffset(root_id) - 1;
					api_data.L = 1;
					api_data.Pag = false;
					api_data.Sort = current.load_sort[root_id];
				} else if (cid != current.rootId) {
					if (is_right_edge) {
						if (comments_ids[root_id].length <= 1 && self.getMaxPage(root_id) > 1) {
							new_page = self.getPage(root_id) - 1;
							api_data.O = ((new_page - 1) * current.onPage);
							api_data.L = current.onPage;
							api_data.Pag = true;
							api_data.Cp = new_page;
						}
					} else {
						var offset = self.getPage(root_id) * current.onPage - 1;
						api_data.O = offset;
						api_data.L = 1;
						api_data.Pag = true;
						api_data.Cp = self.getPage(root_id);
					}
				}
			}
			
			el.find('.js-ico').addClass('ico_spinner');
			$(`#cr${cid}`).find('.js-comment_spinner').removeClass('hide');
			
			var remove_spinner = function (comm) {
				comm.removeData('busy');
				el.find('.js-ico').removeClass('ico_spinner');
				$(`#cr${cid}`).find('.js-comment_spinner').addClass('hide');
			};
			
			comm.data('busy', true);
			last_delete_req = Spaces.api(api_method, api_data, function (res) {
				remove_spinner(comm);
				
				self.resetReplyForm();
				
				if (res.code == 0) {
					if (action == 'delete') {
						let prev_page = self.getPage(root_id);
						
						// Убираем последний виджет восстановления
						self.removeRestoreComment();
						
						comm.after(res.widget);
						
						last_deleted_comment = {
							id:					cid,
							widget:				comm_widgets.detach(),
							cnt:				1 + (current.counter[cid] || 0),
							fromRightEdge:		is_right_edge,
							pagination:			api_data.Pag && current.pagination.children().detach(),
							rootId:				root_id
						};
						
						// Удаляем комментарий
						if (cid == current.rootId) {
							self.enableLP(false);
							$('#c' + cid).remove();
							
							last_deleted_comment.pagination = current.pagination.children().detach();
							last_deleted_comment.lastCounter = current.counter[root_id];
							self.setCounter(root_id, 0);
						} else {
							var new_cnt = self.getLevelCnt(res, root_id);
							self.setCounter(root_id, new_cnt);
							self.setCommonCounter(+res.cnt);
							
							var comments_to_delete = {};
							comments_to_delete[cid] = null;
							
							self.updateComments(root_id, [cid], {
								comments:		comments_to_delete,
								allowNewPage:	false
							});
							
							// Добавляем недостающие комментарии
							if (res.comments) {
								self.updateComments(root_id, false, {
									comments:		res.comments,
									allowNewPage:	false
								});
							}
							
							if (api_data.Pag) {
								current.pagination.html(res.pagination || '');
								new_page && self.setPage(root_id, new_page);
							}
						}
						
						if (!root_id && prev_page != self.getPage(root_id)) {
							let deleted_stub = wrap.find('.js-comment_restore').first();
							$('html, body').scrollTo(deleted_stub, {position: "center"});
						}
					} else if (action == 'restore_message') {
						// Восстанавливаем комментарий обратно в список
						if (cid == current.rootId) {
							self.enableLP(true);
							wrap.find('.js-comments_wrap').prepend(last_deleted_comment.widget);
							self.setCounter(root_id, last_deleted_comment.lastCounter);
							self.collectIds();
							
							if (last_deleted_comment.pagination)
								current.pagination.empty().append(last_deleted_comment.pagination);
						} else {
							var restored_comments = {};
							restored_comments[last_deleted_comment.id] = last_deleted_comment.widget;
							
							self.updateComments(root_id, [last_deleted_comment.id], {
								comments:		restored_comments,
								allowNewPage:	last_deleted_comment.fromRightEdge
							});
							
							if (last_deleted_comment.pagination) {
								current.pagination.empty().append(last_deleted_comment.pagination);
								self.setPage(root_id, self.getPage(root_id));
							}
							
							self.setCounter(root_id, current.counter[root_id] + last_deleted_comment.cnt);
							self.setCommonCounter(current.commentsCnt + last_deleted_comment.cnt);
						}
						
						// Закроем меню
						self.closeMenu($('#c' + last_deleted_comment.id));
						
						// Удаляем спиннер
						remove_spinner($('#c' + last_deleted_comment.id));
						self.removeRestoreComment();
					}
				} else {
					Spaces.showApiError(res);
				}
			}, {
				onError: function (err) {
					remove_spinner(comm);
					Spaces.showError(err);
				}
			});
		},
		
		enableLP: function (flag) {
			is_dirty_state = true;
			current.disable_lp = flag;
		},
		
		// Дополнительные параметры для API из текущего URL
		getApiExtra: function () {
			var self = this;
			
			var url_params;
			if (current.lenta) {
				url_params = {
					id:			current.id,
					Id:			current.id,
					Read:		current.id,
					Link_id:	Spaces.params.link_id
				};
			} else {
				url_params = current.request;
				
				// удаляем ненужные параметры
				delete url_params.scp;
				delete url_params.Scp;
				delete url_params.p;
				delete url_params.P;
				delete url_params.Cp;
				delete url_params.cp;
				delete url_params.Deleted;
				delete url_params.CK;
				//delete url_params.Vck;
				//delete url_params.Dtype;
				delete url_params.method;
			}
			
			return $.extend({}, url_params, {
				Type: current.type,
				Link_id: url_params.Link_id || Spaces.params.link_id,
				hash: TAB_ID,
				Id: url_params.Id || url_params.id,
				Passed: 1
			});
		},
		
		// Получить сообщения по чанкам
		getMoreMessages: function (root_id, seek, limit, done, onerror) {
			var self = this;
			
			Spaces.cancelApi(last_more_req);
			
			last_more_req = Spaces.api("comments.read", $.extend(self.getApiExtra(), {
				O: seek,
				L: limit,
				Pag: false,
				Ch: true,
				Root_id: root_id || current.rootId,
				Sort: current.load_sort[root_id]
			}), function (res) {
				done && done();
				last_more_req = false;
				if (res.code == 0) {
					var old_scroll = wrap.outerHeight();
					
					self.updateComments(root_id, false, {
						newComment: true,
						comments: res.comments
					});
					
					var new_cnt = self.getLevelCnt(res, root_id);
					self.setCommonCounter(+res.cnt);
					self.setCounter(root_id, new_cnt);
					
					if (!current.sort[root_id] && !root_id)
						$('html, body').scrollTop($(window).scrollTop() + (wrap.outerHeight() - old_scroll));
				} else {
					onerror && onerror(Spaces.apiError(res));
				}
			}, {
				retry: 10,
				onError: function (err) {
					onerror && onerror(err);
					last_more_req = false;
				}
			});
		},
		
		// Очередь сообщений
		getMessageDelayed: function (root_id, data, only_update_exists) {
			var self = this;
			
			var key = root_id;
			if (only_update_exists)
				key = key + ":replace";
			
			if (!comments_queue[key]) {
				comments_queue[key] = {
					ids:	[],
					start:	0
				};
			}
			
			comments_queue[key].ids.push(data.id);
			
			if (!comments_queue[key].request && comments_queue[key].ids.length > 0) {
				// Получаем текущую очередь сообщений
				var messages = comments_queue[key].ids;
				comments_queue[key].ids = [];
				
				var api_data = {
					IdS:		messages,
					Pag:		false,
					Ch:			true,
					Root_id:	root_id || current.rootId
				};
				
				if (!root_id && !only_update_exists) {
					api_data.Cp = current.sort[root_id] ? 1 : self.getPage(root_id);
					api_data.Pag = true;
				}
				
				comments_queue[key].request = Spaces.api("comments.read", $.extend(self.getApiExtra(), api_data), function (res) {
					comments_queue[key].request = false;
					if (res.code == 0) {
						self.updateComments(root_id, messages, {
							newComment:		true,
							onlyReplace:	only_update_exists,
							comments:		res.comments
						});
						
						var new_cnt = self.getLevelCnt(res, root_id);
						self.setCommonCounter(+res.cnt);
						self.setCounter(root_id, new_cnt);
						
						// Обновляем пагинацию
						if (api_data.Pag)
							current.pagination.html(res.pagination || '');
					} else {
						Spaces.showError(L("Ошибка получения комментариев:") + Spaces.apiError(res));
					}
				}, {
					retry: 10,
					onError: function () {
						comments_queue[key].request = false;
					}
				});
			}
		},
		
		// Метод для обновления списка комментов
		updateComments: function (root_id, messages, res) {
			var self = this;
			
			var current_list = root_id ? $('#sub_' + root_id + '_list') : current.list;
			
			res = $.extend({
				allowNewPage:	true,
				newComment:		false,
				onlyReplace:	false
			}, res);
			
			// Заполняем несуществующие комменты и дополняем массив комментов
			if (messages) {
				for (var i = 0; i < messages.length; ++i) {
					var id = messages[i];
					if (!(id in res.comments))
						res.comments[id] = null;
					if ($.inArray(+id, comments_ids[root_id]) < 0)
						comments_ids[root_id].push(id);
				}
			} else {
				for (var id in res.comments) {
					if ($.inArray(+id, comments_ids[root_id]) < 0)
						comments_ids[root_id].push(+id);
				}
			}
			
			// Сортируем комменты для правильного порядка
			comments_ids[root_id].sort(function (a, b) {
				return !current.sort[root_id] ? a - b : b - a;
			});
			
			// Вставляем комментарии
			var delta = 0;
			for (var i = 0; i < comments_ids[root_id].length; ++i) {
				var id = comments_ids[root_id][i];
				if (id in res.comments) {
					if (res.comments[id] !== null) {
						var comment = ge('#c' + id);
						if (!comment) {
							if (res.onlyReplace)
								continue;
							
							var prev = comments_ids[root_id][i - 1];
							
							// Костыль для выравнивания сортировки
							if (last_deleted_comment && last_deleted_comment.rootId == root_id) {
								if (Math.max(prev, id) > last_deleted_comment.id && Math.min(prev, id) < last_deleted_comment.id)
									prev = 'r' + last_deleted_comment.id;
							}
							
							if (prev) {
								var prev_sub_comments = $('#sub_' + prev),
									prev_comment = $('#c' + prev),
									prev_place = prev_sub_comments.length ? prev_sub_comments : prev_comment;
								
								prev_place.after(res.comments[id]);
							} else {
								current_list.prepend(res.comments[id]);
							}
							
							self.highlightNewComment($('#c' + id), false);
							
							delta++;
						} else {
							$('#sub_' + id).remove();
							$('#c' + id).replaceWith(res.comments[id]);
							
							if (res.onlyReplace)
								self.highlightNewComment($('#c' + id), false);
						}
					} else {
						$('#c' + id + ', #sub_' + id).remove();
						comments_ids[root_id].splice(i, 1);
						i--;
						delta--;
					}
				}
			}
			
			// Удаляем лишние комменты
			if (comments_ids[root_id].length > current.onPage && !current.lenta && !root_id) {
				if ((res.newComment ? current.sort[root_id] : !res.allowNewPage)) {
					for (var i = current.onPage; i < comments_ids[root_id].length; ++i)
						$('#c' + comments_ids[root_id][i] + ', #sub_' + comments_ids[root_id][i]).remove();
					comments_ids[root_id] = comments_ids[root_id].slice(0, current.onPage);
				} else {
					var overflow = current.onPage * Math.floor(comments_ids[root_id].length / current.onPage);
					for (var i = 0; i < overflow; ++i)
						$('#c' + comments_ids[root_id][i] + ', #sub_' + comments_ids[root_id][i]).remove();
					comments_ids[root_id] = comments_ids[root_id].slice(overflow);
				}
			}
			
			return delta;
		},
		
		resetReplyForm: function () {
			var self = this;
			
			// Возвращаем на место форму ответа
			var form = wrap.find('.js-comments_form');
			wrap.find('.js-comments_form_reply').addClass('hide');
			wrap.find('[data-action="comment_reply"].js-clicked').removeClass('js-clicked');
			wrap.find('.comm-menu_opened').removeClass('comm-menu_opened');
			form.data({reply_id: 0, root_id: 0});
			wrap.find('.js-comments_form_wrap').append(form);
			
			// Чекбокс "Скрытый комментарий"
			var checkbox = form.find('input[name="Hidden"]')
			if (checkbox.prop("checked"))
				checkbox.parent().click();
			
			// Возвращаем на место форму жалобы
			var compl = wrap.find('.js-tpl-comments_compl').removeData();
			compl.find('.ico_spinner').removeClass('ico_spinner');
			wrap.find('.js-comments-tpl').append(compl);
			wrap.find('.js-comm_compl.link_active').removeClass('link_active');
			
			import("./form_toolbar").then(function ({default: Toolbar}) {
				Toolbar.expand(form, false);
			});
			
			reply_from_opened = false;
		},
		
		// Инициализация состояния по-умолчанию для ветки, если она ещё не раскрыта
		initRoot: function (root_id) {
			var self = this;
			
			if (!current.roots[root_id]) {
				current.unread[root_id] = 0;
				current.counter[root_id] = 0;
				current.bias[root_id] = 0;
				current.sort[root_id] = 0;
				
				var sub_wrap = $('#sub_' + root_id);
				if (sub_wrap.length) {
					current.load_sort[root_id] = sub_wrap.data('sort');
					current.bias[root_id] = sub_wrap.data('cntBias');
					self.setCounter(root_id, sub_wrap.data('cnt'));
				} else {
					current.load_sort[root_id] = current.sort[0];
					comments_ids[root_id] = [];
				}
				
				current.roots[root_id] = true;
			}
		},
		
		// Наличие загруженного списка комментариев для кокретного root_id
		hasRoot: function (root_id) {
			if (root_id)
				return $('#sub_' + root_id).length > 0;
			return true;
		},
		
		// Обновление номера текущей страницы
		setPage: function (root_id, page) {
			var self = this;
			
			if (!root_id && !current.lenta) {
				var curl = new Url(location.href);
				self.updateUrlPage(curl, page);
				curl.hash = 'page-up';
				current.pagination.find('.pgn').data('page', page);
				
				HistoryManager.replaceState(HistoryManager.state, document.title, curl.url(true));
			}
		},
		
		// Номер текущий страницы
		getPage: function (root_id) {
			var self = this;
			if (root_id || current.lenta) {
				return current.sort[root_id] ? 1 : self.getMaxPage(root_id);
			} else {
				var pgn = current.pagination.find('.pgn');
				return pgn.data('page') || 1;
			}
		},
		
		// Общее количество страниц
		getMaxPage: function (root_id, new_cnt) {
			new_cnt = new_cnt || 0;
			var comments_cnt = current.counter[root_id] + new_cnt;
			return Math.max(1, Math.ceil(comments_cnt / current.onPage));
		},
		
		// Страница полностью заполнена комментариями?
		isFullPage: function (root_id) {
			return this.getCommentsLoadOffset(root_id) >= current.onPage;
		},
		
		// Мы на странице с последними комментариями?
		isActivePage: function (root_id) {
			var self = this;
			if (root_id || current.lenta) {
				if (!self.hasRoot(root_id))
					return false;
				if (current.load_sort[root_id] || !self.isFullPage(root_id))
					return true;
				return false;
			}
			
			var p = self.getPage(root_id);
			return current.sort[root_id] ? p == 1 : p == self.getMaxPage(root_id);
		},
		
		// Мы на странице с первыми комментариями?
		isBeginPage: function (root_id) {
			var self = this;
			if (root_id || current.lenta) {
				if (!self.hasRoot(root_id))
					return false;
				if (current.load_sort[root_id] || !self.isFullPage(root_id))
					return false;
				return true;
			}
			
			var p = self.getPage(root_id);
			return current.sort[root_id] ? p == self.getMaxPage(root_id) : p == 1;
		},
		
		// Обновление счётчика комментов
		setCounter: function (root_id, cnt) {
			var self = this;
			
			if (current.rootId && !root_id)
				wrap.find('.js-comments_cnt .js-cnt').text(cnt);
			
			current.counter[root_id] = +cnt;
			
			if (root_id) {
				var title = numeral(current.counter[root_id], [L('Скрыть $n ответ'), L('Скрыть $n ответа'), L('Скрыть $n ответов')]);
				$('#c' + root_id)
					.find('.js-sub_comments_collapse')
					.toggleClass('hide', current.counter[root_id] <= 1)
					.find(' .t')
					.text(title);
			} else {
				var has_deleted = current.list.find('.js-comment_restore').length;
				
				wrap.find('.js-comments_show').each(function () {
					var el = $(this),
						data = el.data();
					if (data.show == 'cnt') {
						el.toggleClass('hide', !(has_deleted + cnt));
					} else if (data.hide == 'cnt') {
						el.toggleClass('hide', !!(has_deleted + cnt));
					}
				});
			}
			
			if (current.lenta || root_id) {
				var more_cnt = self.hasMore(root_id);
				let comments_next = wrap.find(`.js-comments_more_${root_id}.js-comments_more_next`);
				let next_title = numeral(more_cnt, [L('Ещё $n комментарий'), L('Ещё $n комментария'), L('Ещё $n комментариев')]);
				comments_next.find('.js-comments_more-link').html(tpl.newSpinner() + next_title);
				comments_next.toggleClass('hide', !more_cnt);
				
				let prev_cnt = self.hasPrev(root_id);
				let comments_prev = wrap.find(`.js-comments_more_${root_id}.js-comments_more_prev`);
				let prev_title = numeral(prev_cnt, [L('Ещё $n комментарий'), L('Ещё $n комментария'), L('Ещё $n комментариев')]);
				comments_prev.find('.js-comments_more-link').html(tpl.newSpinner() + prev_title);
				comments_prev.toggleClass('hide', !prev_cnt);
			}
		},
		
		getLevelCnt: function (res, root_id) {
			var result = {};
			if (current.rootId || root_id) {
				return +res.level_cnt;
			} else {
				return +(res.root_cnt || res.cnt);
			}
		},
		
		getCommentsLoadOffset(root_id) {
			return comments_ids[root_id].length + current.bias[root_id];
		},
		
		hasMore: function (root_id) {
			return Math.max(0, Math.min(current.onPage, current.counter[root_id] - this.getCommentsLoadOffset(root_id)));
		},
		
		hasPrev: function (root_id) {
			return Math.max(0, Math.min(current.onPage, current.bias[root_id]));
		},
		
		setCommonCounter: function (cnt) {
			current.commentsCnt = +cnt;
			
			if (!current.rootId)
				wrap.find('.js-comments_cnt .js-cnt').text(cnt);
		},
		
		getRootIdFromParent: function (el) {
			if (current.rootId) {
				return 0;
			} else {
				return el.parents('.js-comments_sub_wrap').data('id') || 0;
			}
		},
		
		collectIds: function () {
			var self = this;
			
			comments_ids = {};
			
			var fetch_comments_ids = function (root_id, list) {
				comments_ids[root_id] = [];
				
				for (var i = 0, l = list.length; i < l; i++) {
					if (list[i].nodeType != 1)
						continue;
					
					if (list[i].className.indexOf('js-comments_sub_wrap') > -1) {
						var child_root_id = list[i].getAttribute('data-id');
						fetch_comments_ids(child_root_id, document.getElementById('sub_' + child_root_id + '_list').childNodes);
						self.initRoot(child_root_id);
					} else {
						comments_ids[root_id].push(+list[i].getAttribute('data-id'));
					}
				}
			};
			
			fetch_comments_ids(0, current.list[0].childNodes);
		},
		reset: function () {
			var self = this;
			Spaces.cancelApi(last_sub_req);
			Spaces.cancelApi(last_delete_req);
			Spaces.cancelApi(last_more_req);
			
			$.each(comments_queue, function (k, v) {
				if (v.request)
					Spaces.cancelApi(v.request);
			});
			comments_queue = {};
			
			last_deleted_comment = null;
			is_dirty_state = false;
			
			$.each(comments_queue, function (k, v) {
				current.unread[k] = 0;
				self.updateUnread(k);
			});
		}
	};
	
	CommentsController.init(wrap);
}

function setupComments() {
	let comments_wraps = document.getElementsByClassName('js-comments');
	for (let i = 0, l = comments_wraps.length; i < l; i++) {
		let comments_wrap = comments_wraps[i];
		if (!comments_wrap.getAttribute('data-inited')) {
			comments_wrap.setAttribute('data-inited', 1);
			new CommentsModule($(comments_wrap));
		}
	}
}

module.on("component", function () {
	if (!AttachSelector && Spaces.params.nid) {
		// Отложенно загружаем виджет аттачинга, т.к. он нужен только авторизированным юзерам
		// Для гостей это экономит 100500 кб
		import('./widgets/attach_selector').then((module) => {
			AttachSelector = module.default;
			setupComments();
		});
	} else {
		setupComments();
	}
});
