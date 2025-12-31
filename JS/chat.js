import require from 'require';
import module from 'module';
import $ from './jquery';
import Device from './device';
import * as pushstream from './core/lp';
import {Spaces, Codes} from './spacesLib';
import page_loader from './ajaxify';
import notifications from './notifications';
import DdMenu from './dd_menu';
import Toolbar from './form_toolbar';
import AttachSelector from './widgets/attach_selector';
import {L, html_wrap, numeral, ge} from './utils';

var CHAT_REFRESH_INTERVAL = 30 * 1000;
var tpl = {
	recipient: function (data) {
		return '<span class="m">' + L('Для {0}', data.name) + '</span> <span class="ico ico_remove m pointer mb0" id="remove_recipient"></span>';
	},
	userProperty: function (data) {
		return '' + 
			'<span class="s-property js-selected_user" data-name="' + html_wrap(data.name) + '">' + 
				html_wrap(data.name) + 
				'<input type="submit" name="rst_G" class="ico delete-btn js-selected_user_remove" value="." />' + 
			'</span>';
	},
	confirmCompl: function (data) {
		return '' + 
			'<div class="content-bl text help-block t_center">' + L('Вы уверены, что хотите отправить жалобу на <b>{0}</b>?', data.name)+ '</div>' + 
			'<table class="table__wrap">' + 
				'<tr>' + 
					'<td class="table__cell links-group links-group_attention table_cell_border" width="50%">' + 
						'<a href="#" class="list-link js-call_moder_confirm" data-name="' + html_wrap(data.name || '') + '" data-id="' + data.id + '">' + 
							'<span class="ico ico_att"></span>' + L('Отправить') + '</a>' + 
					'</td>' + 
					'<td class="table__cell links-group links-group_grey table__cell_last" width="50%">' + 
						'<a href="#" class="list-link js-dd_menu_close">' + 
							'<span class="ico ico_history"></span>' + L('Отмена') + '</a>' + 
					'</td>' + 
				'</tr>' + 
			'</table>';
	},
	title: function (n) {
		return numeral(n, [L('+$n новое сообщение'), L('+$n новых сообщения'), L('+$n новых сообщений')])
			.replace(/(\d+) \+\$n/, '$1');
	},
	inputError: function (msg) {
		return '<div class="error__msg js-input_error">' + msg + '</div>';
	},
	spinner: function (msg) {
		var html = 
			'<div>' + 
				'<span class="ico ico_spinner"></span> <span class="grey">' + msg + '</span>' + 
			'</div>';
		return html;
	},
	hideAttachesError: function (data) {
		var html = 
			'<div class="red">' + 
				data.error + ' <a href="#" class="js-block_attaches" data-id="' + data.id + '"' + (data.state ? ' data-revert="1"' : '') + '>Повторить.</a>' + 
			'</div>';
		return html;
	},
	captcha: function (data) { // TODO: получать с бекенда
		if (data.url) {
			var html = 
				'<div>' + 
					'<a href="' + data.url + '">' + 
						'<img src="' + data.url + '" alt="" />' + 
					'</a>' + 
				'</div>' + 
				(data.error ? '<div class="red pad_t_a">' + data.error + '</div>' : '') + 
				'<div class="pad_t_a">' + 
					L("Введите код:") + ' ' + 
					'<input type="text" name="captcha_code" size="4" value="" />' + 
				'</div>';
			return html;
		}
		return '';
	}
};

var chat_params, last_message_id, messages_queue,
	messages_list,
	last_refresh, // Метадата последнего обновления сообщений через API
	new_messages_cnt, unread_messages_cnt,
	fallback_mode = false, // Режим без HTML5 History API
	classes = {
		inputWrapPersonal: 'text-input__wrap_personal-message',
		inputWrapPrivate: 'text-input__wrap_private-message',
		msgNoAvatar: 'message-block_no-avatar'
	};

var Chat = {
	init: function () {
		var self = this;
		
		page_loader.onShutdown("chat", function () {
			self.destroy();
		});
		
		fallback_mode = !page_loader.ok();
		new_messages_cnt = 0;
		unread_messages_cnt = 0;
		last_message_id = 0;
		chat_params = $('#ChatPage').data();
		messages_list = $('#messages_place');
		
		messages_queue = {ids: [], pag: false};
		last_refresh = {req: null, time: Date.now(), interval: null};
		
		if (notifications && chat_params)
			notifications.setNotifFilter(new RegExp('Rid=' + chat_params.roomid));
		
		var complaint_confirm = new DdMenu();
		$('body').on('click.onRequest', '.js-personal_answer, .js-private_answer', function (e) {
			if (e.ajaxify)
				return;
			
			e.preventDefault();
			var el = $(this),
				is_private = el.hasClass('js-private_answer') || el.data('private');
			Chat.addRecipient(el.data('name'), el.data('userid'), is_private, el.data('znayko'), el.data('id'));
			$('#text').focus();
		});
		
		$('#main').on('click', '#chat_unread_notify_link', function (e) {
			e.preventDefault();
			
			var link = $('.pgn a[data-p="1"]');
			if (link.length) {
				link.click();
			} else {
				Spaces.redirect();
			}
		}).on('click', '.js-toggle_attaches', function (e) {
			e.preventDefault();
			
			var el = $(this),
				id = el.data('id'),
				msg = $('#msg' + id);
			msg.find('.js-attaches_list').toggleClass('hide');
		}).on('click', '.js-call_moder_confirm', function (e) {
			e.preventDefault();
			var el = $(this);
			DdMenu.close();
			Spaces.api("chat.callModer", {
				CK: null,
				Call_moder: el.data('id')
			}, function (res) {
				$('html, body').scrollTop(0);
				if (res.code != 0) {
					Spaces.showApiError(res);
				} else {
					Spaces.showMsg(L('Жалоба на <b>{0}</b> отправлена.', el.data('name')), {hideTimeout: 15000});
				}
			});
		}).on('click', '.js-block_attaches, .js-reveal_attaches', function (e) {
			e.preventDefault();
			var el = $(this),
				id = el.data('id'),
				msg = $('#msg' + id),
				block_link = msg.find('.js-block_attaches'),
				unblock_link = msg.find('.js-reveal_attaches'),
				state = !!el.data('revert'),
				attaches = msg.find('.js-attaches_list'),
				attaches_block = msg.find('.js-attaches_block');
			
			var toggle_state = function (state) {
				attaches.toggleClass('hide', !state);
				attaches_block.toggleClass('hide', state);
				block_link.toggleClass('hide', !state);
				unblock_link.toggleClass('hide', state);
			};
			
			toggle_state(false);
			attaches_block.html(tpl.spinner(state ? L('Показываем вложения') : L('Скрываем вложения')));
			
			Spaces.api(state ? "chat.revealAttaches" : "chat.hideAttaches", {
				CK: null,
				Msg_id: id
			}, function (res) {
				DdMenu.close();
				if (res.code != 0) {
					attaches_block.html(tpl.hideAttachesError({
						error:	Spaces.apiError(res),
						id:		id,
						state:	state
					}));
				} else {
					toggle_state(state);
					attaches_block.html(L('Вложения скрыты модератором.'));
				}
			}, {
				onError: function (err) {
					attaches_block.html(tpl.hideAttachesError({
						error:	err,
						id:		id,
						state:	state
					}));
				}
			});
		}).on('click', '.js-call_moder', function (e) {
			e.preventDefault();
			var el = $(this),
				opener = DdMenu.current().data("menu_opener");
			complaint_confirm.content().html(tpl.confirmCompl({
				id: el.data('id'),
				name: el.data('name')
			}));
			complaint_confirm.openAs(opener);
		}).on('click', '#remove_recipient', function (e) {
			e.preventDefault();
			Chat.removeRecipient();
		}).on('click', '.js-quote', function (e) {
			e.preventDefault();
			// o_O
		}).on('click', '.js-lock_open, .js-lock_close', function (e) {
			e.preventDefault();
			Chat.switchAccess($(this).hasClass('js-lock_close'));
		})
		
		// Приглашения
		.on('dd_menu_open', '#invite_friend_menu', function (e) {
			let input = $('#invite_friend_input');
			Spaces.view.setInputError(input, false);
		}).on('focus', '#invite_friend_input', function (e) {
			$(this).parent().parent().find('.js-input_error').remove();
		}).on('click', '.js-chat_invite', function (e) {
			e.preventDefault(); e.stopPropagation();
			e.stopImmediatePropagation();
			
			$(this).trigger('suggestSelect');
			
			var api_data = {frIends: [], Rid: chat_params.roomid, CK: null},
				input = $('#invite_friend_input'),
				selected_wrap = $('#invite_friend_selected');
			selected_wrap.find('.js-selected_user').each(function () {
				api_data.frIends.push($(this).data('name'));
			});
			if (api_data.frIends.length > 0 && !selected_wrap.data("proccess")) {
				var ico = $('.js-chat_invite .ico');
				ico.addClass('ico_spinner');
				
				input.attr("disabled");
				selected_wrap.data("proccess", true);
				
				var on_done = function () {
					selected_wrap.data("proccess", false);
					ico.removeClass('ico_spinner');
					selected_wrap.empty();
					input.val('');
					input.removeAttr("disabled");
				};
				
				Spaces.api("chat.invite", api_data, function (res) {
					on_done();
					if (res.code != 0) {
						Spaces.view.setInputError(input, Spaces.apiError(res));
					} else {
						Spaces.showMsg(L('Приглашения отправлены'), {hideTimeout: 1500});
						$('html, body').scrollTop(0);
						DdMenu.close('invite_friend_menu');
					}
				}, {
					onError: function () {
						on_done();
					}
				});
			}
		}).on('suggestSelect', function (e, data) {
			var input = $('#invite_friend_input'),
				user = $.trim(input.val()),
				selected = $('#invite_friend_selected');
			if (!data && user.length > 2)
				data = {name: user};
			if (data)
				selected.append(tpl.userProperty(data));
			input.val('');
		}).on('click', '.js-selected_user_remove', function (e) {
			e.preventDefault(); e.stopPropagation();
			e.stopImmediatePropagation();
			$(this).parents('.js-selected_user').remove();
		});
		
		if (notifications) {
			$('#main').on('focuswindow', function () {
				new_messages_cnt = 0;
			});
		}
		
		// LP
		if (messages_list.length > 0) {
			$('#main').on('submit', '#add_form', function (e) {
				e.preventDefault();
				var form = this;
				var data = {
					msg: form.msg.value,
					Rid: chat_params.roomid
				};
				if (form.To_user_id)
					data.To_user_id = form.To_user_id.value;
				if (form.Private)
					data.Private = form.Private.value;
				if (form.to)
					data.to = form.to.value;
				if (form.A_msg_id)
					data.A_msg_id = form.A_msg_id.value;
				data.atT = AttachSelector.getAttaches(form, true);
				self.sendMessage(data, function () {
					AttachSelector.resetAttaches(form);
					form.msg.value = "";
					form.msg.placeholder = L("Напишите сообщение");
					Chat.removeRecipient();
				});
			});
			
			self.setManualRefresh(!pushstream || !pushstream.avail());
			if (pushstream) {
				pushstream.on("message", "chat", function (data) {
					if (data.room_id != chat_params.roomid)
						return;
					
					if (data.act == pushstream.TYPES.CHAT_SEND_MESSAGE) {
						var mid = data.id || data.msg_id,
							duplicate = ge('#msg' + mid);
						
						if (!duplicate)
							++chat_params.allcnt;
						
						var pag = chat_params.allcnt < chat_params.maxcnt && chat_params.allcnt > 1 && chat_params.allcnt % chat_params.onpage == 1;
						
						var pgn = Spaces.view.pageNav.get();
						if (pgn.length && pgn.data('page') > 1 && !duplicate) {
							if (data.user_id != Spaces.params.nid) {
								++unread_messages_cnt;
								self.showUnreadNotify();
								if (pag)
									Chat.getMessages($.extend(self.getApiExtra(), {Op: 1}));
							}
						} else {
							self.getMessageDelayed({
								id: mid,
								pag: pag
							});
						}
					}
					if (data.act == pushstream.TYPES.CHAT_DELETE_MESSAGE) {
						--chat_params.allcnt;
						
						var msg = $('#msg' + data.id);
						if (msg.length > 0) {
							var pgn = Spaces.view.pageNav.get();
							if (pgn.length && pgn.data('page') > 1) {
								Chat.getMessages($.extend(self.getApiExtra(), {Op: 0}));
							} else {
								msg.remove();
							}
						}
						
						self.cutMessages();
					}
				}).on('connect', 'chat', function (e) {
					if (!e.first)
						self.refreshMessages(true);
					self.setManualRefresh(false);
				}).on('disconnect', 'chat', function () {
					if (!pushstream.disabled()) {
						self.setManualRefresh(true);
						self.resetMsgQueue(true);
					}
				});
			}
		}
	},
	getApiExtra: function (url) {
		return {
			P: $('.pgn').data('page') || 1,
			Rid: chat_params.roomid,
			Link_id: Spaces.params.link_id
		};
	},
	destroy: function () {
		var self = this;
		
		self.setManualRefresh(false);
		pushstream.off("*", "chat");
		chat_params = messages_list = null;
		if (notifications)
			notifications.setNotifFilter(false);
		
		if (last_refresh) {
			Spaces.cancelApi(last_refresh.req);
			last_refresh = null;
		}
	},
	getMessages: function (data, callback, opts) {
		var self = this;
		
		if (last_refresh.req)
			Spaces.cancelApi(last_refresh.req);
		
		last_refresh.req = Spaces.api("chat.getMessages", data, function (res) {
			last_refresh.req = null;
			last_refresh.time = Date.now();
			if (res.code == 0) {
				if (res.widgets) {
					var html = res.widgets.join('');
					messages_list.empty();
					
					messages_list.html(html);
					self.cutMessages();
					
					require.loaded(import.meta.id("./widgets/video"), ({VideoPlayer}) => {
						VideoPlayer.destroyDetached();
					});
				}
				Spaces.view.pageNav.replace(res.pagination || '');
				chat_params.onpage = res.msgOnPage;
				
				unread_messages_cnt = 0;
				self.showUnreadNotify();
				self.resetMsgQueue();
			} else {
				Spaces.showApiError(res);
			}
			callback && callback();
		}, {
			onError: function () {
				last_refresh.req = null;
				last_refresh.time = Date.now();
			}
		});
	},
	sendMessage: function (data, callback) {
		var self = this;
		
		if (!$.trim(data.msg).length && (!data.atT || !data.atT.length))
			return;
		
		var btn = $('#mainSubmitForm'),
			textarea = $('#text');
		var toggle_form_lock = function (flag) {
			if (flag) {
				textarea.attr("disabled", "disabled");
				btn.attr("disabled", "disabled").css("opacity", "0.5").val(L("Отправка"));
			} else {
				textarea.removeAttr("disabled");
				btn.css("opacity", "").removeAttr('disabled').val(L("Написать"));
			}
		};
		
		toggle_form_lock(true);
		if (AttachSelector.isBusy()) {
			AttachSelector.onDone(function () {
				toggle_form_lock(false);
				btn.click();
			});
			return;
		}
		
		var captcha_code = $('input[name="captcha_code"]');
		if (captcha_code.length)
			data.captcha_code = captcha_code.val();
		
		var att_sel = AttachSelector.instance(textarea);
		data.msg = att_sel.stripUrls(data.msg);
		
		data.CK = null;
		Spaces.api("chat.sendMessage", data, function (res) {
			toggle_form_lock(false);
			$('#chat_captcha').addClass('hide').empty();
			if (res.code == 0) {
				var pgn = Spaces.view.pageNav.get();
				if (pgn.length && pgn.data('page') > 1) {
					Chat.getMessages($.extend(self.getApiExtra(), {Op: 0}));
				} else {
					self.showMessage(res.id, res.message);
				}
				textarea.val('').trigger('change');
			} else if (res.code == Codes.COMMON.ERR_NEED_CAPTCHA || res.code == Codes.COMMON.ERR_WRONG_CAPTCHA_CODE) {
				$('#chat_captcha').removeClass('hide').html(tpl.captcha({
					url: res.captcha_url,
					error: res.code == Codes.COMMON.ERR_WRONG_CAPTCHA_CODE ? Spaces.apiError(res) : ''
				}));
			} else if (res.code == Codes.COMMON.ERR_OFTEN_OPERATION) {
				Spaces.showError(L("Слишком часто отправляете сообщения. Подождите минутку. "));
				return;
			} else {
				Spaces.showApiError(res);
				return;
			}
			self.refreshMessages(true);
			callback && callback(res);
		}, {
			disableCaptcha: true,
			onError: function () {
				toggle_form_lock(false);
			}
		});
	},
	showMessage: function (mid, message) {
		var self = this;
		
		var old = $('#msg' + mid);
		if (old.length) {
			old.after(message);
			old.remove();
		} else {
			messages_list.prepend(message);
		}
		
		$('#no_messages_notify').remove();
		
		require.loaded(import.meta.id("./widgets/video"), ({VideoPlayer}) => {
			VideoPlayer.destroyDetached();
		});
		
		return !old.length;
	},
	
	// Очередь сообщений
	getMessageDelayed: function (data) {
		var self = this;
		messages_queue.ids.push(data.id);
		
		if (data.pag)
			messages_queue.pag = true;
		
		if (!messages_queue.request && messages_queue.ids.length > 0) {
			// Получаем текущую очередь сообщений
			var messages = messages_queue.ids;
			var pag = messages_queue.pag;
			messages.sort(function (a, b) {
				return a - b;
			});
			self.resetMsgQueue();
			
			// console.log("=> chat.getMessages(" + messages.join(", ") + ")" + (pag ? " ... with pagination" : ""));
			
			messages_queue.request = Spaces.api("chat.getMessages", $.extend(self.getApiExtra(), {
				IdS: messages,
				Op: pag
			}), function (res) {
				messages_queue.request = false;
				if (res.code == 0) {
					var cnt = 0;
					for (var i = 0; i < messages.length; ++i) {
						var mid = messages[i];
						if (self.showMessage(mid, res.widgets[mid]))
							++cnt;
					}
					self.cutMessages();
					
					if (!notifications.isWindowActive()) {
						new_messages_cnt += cnt;
						notifications.showNewEvent(tpl.title(new_messages_cnt), {oneTab: true});
					} else {
						new_messages_cnt = 0;
					}
					
					// Обновляем пагинацию
					if (pag)
						Spaces.view.pageNav.replace(res.pagination || '');
				} else {
					console.error("[getMessageDelayed] " + Spaces.apiError(res))
					// Обновим сразу все сообщения при ошибке
					self.resetMsgQueue(true);
					Chat.getMessages($.extend(self.getApiExtra(), {Op: 0}));
				}
			}, {
				retry: 10,
				onError: function (err) {
					console.error("[getMessageDelayed] " + err);
					// Обновим сразу все сообщения при ошибке
					self.resetMsgQueue(true);
					Chat.getMessages($.extend(self.getApiExtra(), {Op: 0}));
				}
			});
		}
	},
	
    resetMsgQueue: function (stop) {
		if (stop && messages_queue.request)
			Spaces.cancelApi(messages_queue.request);
		messages_queue.pag = false;
		messages_queue.request = false;
		messages_queue.ids = [];
	},
	refreshMessages: function (force) {
		var self = this;
		if (last_refresh.interval && messages_list.length > 0) {
			if (!last_refresh.req && (force || (Date.now() - last_refresh.time >= CHAT_REFRESH_INTERVAL))) {
				// refresh messages
				if (self.getApiExtra().P == 1)
					Chat.getMessages($.extend(self.getApiExtra(), {Op: 0}));
			}
		}
	},
	setManualRefresh: function (flag) {
		var self = this;
		if (!flag == !last_refresh.interval)
			return;
		if (last_refresh.interval) {
			clearInterval(last_refresh.interval);
			last_refresh.interval = null;
		}
		if (flag) {
			last_refresh.interval = setInterval(function () {
				self.refreshMessages();
			}, CHAT_REFRESH_INTERVAL / 4);
			last_refresh.time = Date.now();
		}
	},
	cutMessages: function () {
		var messages;
		while (true) {
			messages = messages_list.children();
			if (!messages.length || messages.length <= chat_params.onpage)
				break;
			$(messages[messages.length - 1]).remove();
		}
		$('#no_messages_notify').toggle(!messages.length);
	},
	addRecipient: function (name, user_id, is_private, znayko, msg_id) {
		Chat.removeRecipient();
		var form = $('#add_form');
		if (!znayko) {
			Spaces.tools.formHidden(form, 'to', name);
			Spaces.tools.formHidden(form, 'A_msg_id', msg_id);
			Spaces.tools.formHidden(form, 'To_user_id', user_id);
		}
		Chat.switchAccess(is_private);
		$('#recipient').append(tpl.recipient({name: name}));
	},
	removeRecipient: function () {
		var form = $('#add_form');
		form.find('.js-lock_open, .js-lock_close').hide();
		form.find('.js-textarea_wrapper')
			.removeClass(classes.inputWrapPersonal)
			.removeClass(classes.inputWrapPrivate)
		Spaces.tools.formHidden(form, 'to', "");
		Spaces.tools.formHidden(form, 'To_user_id', 0);
		Spaces.tools.formHidden(form, 'A_msg_id', 0);
		Spaces.tools.formHidden(form, 'Private', 0);
		$('#recipient').empty();
	},
	switchAccess: function (is_private) {
		is_private = !!is_private;
		
		var form = $('#add_form'),
			private_switch = form.find('#js-private_toggle');
		if (private_switch.length) {
			private_switch.find('option').each(function () {
				var opt = $(this);
				if (opt.val() == 0) {
					if (!is_private)
						private_switch.val(opt.val());
				} else {
					if (is_private)
						private_switch.val(opt.val());
				}
			});
		} else {
			Spaces.tools.formHidden(form, 'Private', is_private ? 1 : 0);
		}
		
		form.find('.js-lock_close').toggle(!is_private);
		form.find('.js-lock_open').toggle(is_private);
		
		form.find('.js-textarea_wrapper')
			.toggleClass(classes.inputWrapPersonal, !is_private)
			.toggleClass(classes.inputWrapPrivate, is_private);
	},
	showUnreadNotify: function () {
		var self = this;
		$('#chat_unread_notify').toggleClass('hide', !unread_messages_cnt);
		$('#chat_unread_notify_link').text(tpl.title(unread_messages_cnt));
	}
};

module.on("componentpage", function () {
	Chat.init();
});
