import require from 'require';
import module from 'module';
import $ from './jquery';
import Device from './device';
import * as pushstream from './core/lp';
import {Spaces, Url, Codes} from './spacesLib';
import page_loader from './ajaxify';
import {HistoryManager} from './ajaxify';
import notifications from './notifications';
import {Notifications} from './notifications';
import {checkOnline} from './online_status';
import GALLERY from './gallery';
import AttachSelector from './widgets/attach_selector';

import DdMenu from './dd_menu';
import './form_toolbar';
import {L, html_wrap, ge, numeral, tick, throttle} from './utils';
import { closeVoiceRecoder, destroyVoiceMessages, initVoiceMessages, startVoiceRecording, stopVoiceRecording } from './mail/voice-messages';
import { canRecordVoiceMessages } from './audio/recorder';
import { checkVoicePlayers } from './mail/voice-player';
import { closeAllPoppers, getPopperById } from './widgets/popper';

module.on("componentpage", function () {
//

var MAIL_REFRESH_INTERVAL = 30 * 1000;
var MailPage,
	body,
	last_refresh,
	mail_params = {},
	checkedChekboxes = [],
	checkedChekboxesMap = {},
	show_icons = true,
	new_msg_form = true,
	check_online_thread,
	newMessagesCnt = 0,
	toolbar_options = {},
	mail_place,
	last_ta_value, last_ta_value_int,
	screenWidth = $(window).width(),
	last_typing_req,

	prevMainButtonsState,
	currentAttachesCount = 0,
	currentRecordedVoice,
	voiceMessagesEnabled,
	voiceTypingInterval,

	newMessageSound = false,
	markReadOnFocus = [],

	mail_send_message,
	mail_last_send,

	mail_lock_events,
	mail_ready,

	before_edit_state,
	last_edit_req,

	isVoiceRecording = false;

var TAB_ID				= 'm' + Date.now();
var TYPING_TIMEOUT		= 5000;
var TYPING_SEND_TIMEOUT	= 4000;

var MAIL_LIST = {
	ALL:		0,	// Все
	FAV:		1,	// Избранное
	SPAM:		2,	// СПАМ
	ARCHIVE:	3,	// Архив
	GARBAGE:	4,	// Корзина
	NEW:		6	// Непрочитанные
};

var classes = {
		msg: {
			old: 'mail__old_msg',
			unread: 'mail__new_msg'
		}
	},
	messages_queue = {ids: []};

var tpl = {
	contactUndo: function (data) {
		return ' <a href="#" class="js-mail_contact_undo" data-action="' + data.action + '" ' + 
					'data-ids="' + data.ids  + '" data-state="' + data.state + '">' + L('Отмена') + 
					' <span class="ico ico_spinner js-spinner hide"></span></a>';
	},
	confirmErase: function (data) {
		var html = '' + 
			'<div class="widgets-group links-group links-group_grey dropdown-menu">' + 
				'<div class="content-bl content-bl__sep oh">' + 
					'Вы уверены, что хотите удалить сообщение у всех (это действие нельзя отменить)?' +
                    '<div class="grey">* Если у вашего адресата включена пересылка сообщений на Email, то они уже не могут быть удалены. Сообщения пересылаются через 10 минут.</div>' +
				'</div>' + 
				'<div class="dropdown-menu">' + 
					'<table class="table__wrap">' + 
						'<tr>' + 
							'<td class="table__cell links-group links-group_grey table__cell_border" width="50%">' + 
								'<a href="#" class="list-link list-link-red js-action_link" data-action="mail_message_erase" data-for-all="1">' + 
									'<span class="ico ico_remove_red"></span> ' + 
									'<span class="t">Удалить</span>' + 
								'</a>' + 
							'</td>' + 
							'<td class="table__cell links-group links-group_grey table__cell_last" width="50%">' + 
								'<a href="#" class="list-link js-popper_close">' +
									'<span class="t">Отмена</span>' + 
								'</a>' + 
							'</td>' + 
						'</tr>' + 
					'</table>' + 
				'</div>' + 
			'</div>';
		return html;
	}
};

var mailCore = {
	typing: {interval: null, cnt: 0},
	typings: {},
	send_typing: {},
	
	getContactsByIds : function(data,settings) {
		var list = data.List,
			Link_id = data.Link_id,
			contacts = data.contacts;

		Spaces.api("mail.getContactsByIds", {
			List: list,
			Link_id: Link_id,
			CoNtacts: contacts,
			Pag: 1
		}, function(data) {
			var code = data.code;
			if (code != 0) {
				if (code == Codes.MAIL.ERR_CONTACT_NOT_FOUND) /* контакт не найден */
					mailServices.goTo('/mail/contact_list/?List='+list, settings);
				else
					Spaces.showApiError(data);
			} else {
				mailTemplates.add_contacts(data);
			}
		})
	},

	searchContacts: function(data, settings) {
		var list = data.list || 0,
			P = data.P || 1,
			Link_id = Spaces.params.link_id;
		
		settings = settings || {};
		
		Spaces.cancelApi(last_refresh.req);
		last_refresh.req = Spaces.api("mail.getContacts", {
			List: list,
			P: P,
			Link_id: Link_id,
			q: data.q,
            Pag: 1
		}, function (data) {
			if (settings.onSuccess)
				settings.onSuccess();
			
			last_refresh.req = null;
			last_refresh.time = Date.now();
			
			if (data.code == Codes.MAIL.ERR_GARBAGE_IS_CLEARING) {
				mailCore.showMsg(L('В данный момент ваша корзина очищается, подождите несколько минут и повторите попытку.'));
			} else if (data.code == 0) {
				$('#search_messages_link')
					.html(data.search_messages_link || "")
					.toggleClass('hide', !data.search_messages_link);
				
				mailTemplates.contact_search_list(data, {
					list: list,
					Link_id: Link_id,
					settings: settings
				});
			} else {
				if (settings.onError)
					settings.onError(Spaces.apiError(data));
			}
		}, {
			onError: function (err) {
				if (settings.onError)
					settings.onError(err);
				last_refresh.req = null;
				last_refresh.time = Date.now();
			}
		});
	},
    
	// Получение списка сообщений
	getMessages: function (data, settings) {
		var contact = data.contact,
		    list = data.list,
		    P = data.P || 1,
		    Link_id = data.Link_id;
		
		settings = settings || {};
		
		var query = {
			method: 'getMessages',
			List: list,
			P: P,
			Pag: 1,
			q: data.q && data.q.length ? data.q : undefined,
			Link_id: Link_id
		};
		if (data.user) {
			query.User = data.user;
		} else {
			query.Contact = contact;
		}

		if (settings.search)
			query.Search = 1;
		
		last_refresh.req = Spaces.api("mail.getMessages", query, function(data) {
			last_refresh.req = null;
			last_refresh.time = Date.now();
			
			var code = data.code,
			    serviceData = {};
			
			serviceData.list = list;
			serviceData.Link_id = Link_id;
			serviceData.contact = contact;
			serviceData.settings = settings;
			
			if (code != 0) {
				if (code == Codes.MAIL.ERR_CONTACT_NOT_FOUND) {
					mailServices.goTo('/mail/contact_list/?List='+list, settings);
				} else {
					if (settings.onError)
						settings.onError(Spaces.apiError(data));
				}
			} else {
				if (settings.onSuccess)
					settings.onSuccess();
				
				if (data.messages){
					mailTemplates.message_list(data,serviceData);

					if(P == 1) {
						$('#loadNewMessages_place').empty();
					}
					
					var newData = {};
					newData.contact = contact;
				}else{
					mailServices.goTo('/mail/contact_list/?List=' + list, settings);
				}
			}
		}, {
			onError: function (err) {
				if (settings.onError)
					settings.onError(err);
				
				last_refresh.req = null;
				last_refresh.time = Date.now();
			}
		});
	},
    
	//Отправка сообщения
	async sendMessage(data, callback) {
		var user = html_wrap(data.user),
		    messageWrap = html_wrap(data.message),
		    message = encodeURIComponent(data.message),
		    image_code = data.image_code,
		    mess_user = data.mess_user,
		    mess_date = data.mess_date,
		    mess_text = data.mess_text,
		    from = mail_place,
		    att = data.att,
		    hash = data.hash,
		    contacttype = '',
		    Link_id = mailServices.getQueryVariable("Link_id"),
		    savedData = data;
		
		Spaces.cancelApi(last_typing_req);
		clearTimeout(last_ta_value_int);
		
		let query;
		let method;
		
		if (data.edit) {
			method = "mail.editMessage";
			query = {
				'CK': null,
				'Message': data.edit,
				'Contact': data.contact,
				'texttT': data.message,
				'atT': data.att,
				hash: TAB_ID
			};
		} else {
			method = "mail.sendMessage";
			query = {
				'CK': null,
				'user': data.user,
				'Contact': data.contact,
				'texttT': data.message,
				'atT': data.att,
				'Reply': data.reply,
				Pag: 1,
				hash: TAB_ID
			};
			
			if (mail_params.fromDating)
				query.from = 'dating';
			
			if (data.contact)
				query.Contact = data.contact;
			if (image_code)
				query.code = image_code;
			if (Link_id)
				query.Link_id = Link_id;
			if (data.contacttype)
				contacttype = data.contacttype;
		}

		if (data.voiceMessage) {
			let response = await mailCore.uploadVoiceMessage(data.voiceMessage.blob);
			if (response.code != 0) {
				callback && callback(response);
				return;
			}
			query.voice = response.md5sum;
		}

		Spaces.api(method, query, function(res){
			var code = res.code;
		    
			if (code != 0) {
				if (res.code == Codes.MAIL.ERR_ADMIN_SEND_DENIED) {
					Spaces.redirect('/mail/admin_mail_denied'); // Такого места не существует
					return;
				}

				if (code == Codes.COMMON.ERR_NEED_CAPTCHA || code == Codes.COMMON.ERR_WRONG_CAPTCHA_CODE) {
					var html = '<div style="padding-left: 5px; padding-top: 5px"><img src="' + res.captcha_url + '" /></div>' +
						'<div class="stnd_padd" style="font-size:small;">Введите код: <input type="text" name="captcha_code" size="4" value="" /></div>';
					$("#captcha").html(html);
				}
			} else {
				if (currentRecordedVoice) {
					currentRecordedVoice = null;
					mailServices.setVoiceRecording(false);
				}

				mailServices.refreshMessages(true);
				
				if (!data.edit) {
					if ((from == 'sendMessageForm')||(from == 'messageList')){
						var P = mailServices.getQueryVariable("P") || 1;
						
						if ((P == 1)&&(from == 'messageList')) {

							// отрендерим отправленное сообщение сразу
							// $('.error,#image_code_block').remove();
							
							setTimeout(function(){
								$('#temp_mes_loader'+hash).remove();
							},5000);
						}else{
							//перейдем на первую страницу в списке сообщений
							var List = mail_params.list;
							if (List == MAIL_LIST.ARCHIVE)
								List = 0;
							Spaces.redirect('/mail/message_list/?Contact='+res.message.contact.nid+'&List='+List+'&salt='+mailServices.randomNumber());
						}
					}
				}
			}
		    callback && callback(res);
		}, {
			disableCaptcha: true,
			onError: function (error) {
				callback && callback({
					code: Codes.COMMON.ERR_UNKNOWN_ERROR,
					error
				});
			}
		});
	},

	async getVoicesUploadURL() {
		return await Spaces.asyncApi("mail.voice.getUploadURL", { CK: true, Contact: mail_params.contactId }, {
			cache: true,
			cacheTime: 3600,
			retry: 3,
		});
	},

	async uploadVoiceMessage(blob) {
		let uploadUrlResponse = await mailCore.getVoicesUploadURL();
		if (uploadUrlResponse.code != 0)
			return uploadUrlResponse;

		const VOICE_SERVER_ERRORS = {
			413:		L('Превышен лимит голосового сообщения.'),
			415:		L('Неподдерживаемый тип голосового сообщения.'),
		};

		let form = new FormData();
		form.append('file', blob);
		return await new Promise((resolve) => {
			$.ajax({
				url: uploadUrlResponse.url,
				data: form,
				processData: false,
				contentType: false,
				type: 'POST',
				dataType: 'json'
			}).success((response) => {
				resolve({
					code: Codes.COMMON.SUCCESS,
					...response
				});
			}).fail((xhr) => {
				resolve({
					code: Codes.COMMON.ERR_UNKNOWN_ERROR,
					error: VOICE_SERVER_ERRORS[xhr.status] || Spaces.getHttpError(xhr.status)
				});
			});
		});
	},

	callbackAction : function(msg, element, id, response, opts) {
		opts = $.extend({
			full: false
		}, opts);
		
		if (msg)
			mailCore.showMsg(msg);
		
		if(element == 'contact') {
			if(response.operated_ids && response.operated_ids.length > 0) {
				for(var i = 0; i < response.operated_ids.length; i++) {
					$('#' + element + '_' + response.operated_ids[i]).remove();
				}
			}
			checkedChekboxes = [];

			if (response.counters)
				mailCore.updateCounters(response.counters);

			var page = mailServices.getQueryVariable("P") || 1;

			if (response.contacts) {
				var contacts_wrapper = $('#contacts_wrapper');
				opts.full ? contacts_wrapper.html(response.contacts.join('')) : 
							contacts_wrapper.append(response.contacts.join(''));
			}

			if($('#contacts_wrapper .js-mail_contact').length == 0 && page == 1) {
				$('#contacts_wrapper').html('<div class="content-bl">' + L('Список контактов пуст') + '</div>');
				$('#mail__contacts_buttons').hide();
			} else {
				$('#mail__contacts_buttons').show();
			}
			
			if ('pagination' in response) {
				if(response.pagination) {
					$('#mail_pagination').html(response.pagination);
				} else {
					$('#mail_pagination').empty();
				}
			}
		} else if(element == 'message') {
			$('#m' + id).remove();

			if(response.messages) {
				for(var i = 0; i < response.messages.length; i++) {
					$('#messages_list').append(response.messages[i]);
				}
			}

			var page = mailServices.getQueryVariable("P") || 1;

			if($('#messages_list .mail__dialog_wrapper').length == 0 && page == 1) {
				$('#messages_list').append('<div class="mail__dialog_wrapper">' + L('Список сообщений пуст') + '</div>').removeClass('pdt');
				$('#messages_list_form').remove();
				$('#action_links').remove();
				$('#MailPage .widgets-group .list-link__wrap .btn-tools').first().remove();
			}


			if(response.pagination) {
				$('#mail_pagination').html(response.pagination);
			} else {
				$('#mail_pagination').empty();
			}
		}
		
		if (!opts.noscroll)
			mailServices.scrollDocument();
	},

	updateCounters: function (counters) {
		$('#mail__lists_links a').each(function () {
			var link = $(this), key = link.data('counter');
			if (key in counters)
				link.find('.cnt').text(counters[key]);
		});
		
		$('#mail__tabs .js-tab_cnt').text(counters['new'])
			.toggle(counters['new'] > 0);
		
		mailServices.checkButtons(false);
	},

	// Перенос контакта в корзину/из корзины
	swapContacts: function (data) {
		var redirect = false,
		    garbage = data.garbage,
		    contactsLength = data.contacts.length,
			page = data.page,
			list = data.list;

		var offset = mail_params.contactsOnPage * page - contactsLength;

		var params = {
			CK: null,
			Garbage: data.garbage,
			CoNtacts: data.contacts,
			List: list
		};

		if ($('#contacts_wrapper .js-mail_contact').length == contactsLength) {
			params.P = page;
			params.Pag =  1;
		} else {
			params.O = offset;
			params.L = contactsLength;
			params.Pag = 1;
		}
		
		if (!$('#mail_pagination').is(':empty'))
			params.Cl = 1;
		
		if (data.undo) {
			params.Cl = 1;
			params.Pag = 1;
			params.O = mail_params.contactsOnPage * (page - 1);
			params.L = mail_params.contactsOnPage;
		}
		
		if (data.message)
			params.message = data.message;
		
		var show_spinner = function (f) {
			data.spinner && data.spinner.toggleClass('ico_spinner', f);
		};
		
		show_spinner(true);
		Spaces.api("mail.swapContacts", params, function (response) {
			show_spinner(false);
			if (response.code != 0) {
				Spaces.showApiError(response);
			} else {
				var msg;
				mailCore.clearUndo();
				
				if (contactsLength > 1) {
					msg = garbage ? L('Контакты перенесены в Корзину.') : L('Контакты восстановлены из Корзины.');
				} else {
					msg = garbage ? L('Контакт перенесён в Корзину.') : L('Контакт восстановлен из Корзины.');
				}
				
				if (!data.undo)
					msg += tpl.contactUndo({state: garbage, action: 'swap', ids: data.contacts.join(',')});
				mailServices.resetSelection();
				mailCore.callbackAction(msg, 'contact', data.contacts, response, {full: data.undo});
			}
		}, {
			onError: function (err) {
				Spaces.showError(err);
				show_spinner(false);
			}
		});
	},
    
	//Перенос контакта в архив/из архива
	archiveContacts : function (data) {
		var redirect = false,
		    archive = data.archive,
		    contactsLength = data.contacts.length,
			page = data.page,
			list = data.list;

		var offset = mail_params.contactsOnPage * page - contactsLength;

		var params = {
			CK: null,
			Archive: data.archive,
			CoNtacts: data.contacts,
			List: list
		};

		if($('#contacts_wrapper .js-mail_contact').length == contactsLength) {
			params.P = page;
			params.Pag =  1;
		} else {
			params.O = offset;
			params.L = contactsLength;
			params.Pag = 1;
		}
		
		if (!$('#mail_pagination').is(':empty'))
			params.Cl = 1;
		
		if (data.undo) {
			params.Cl = 1;
			params.Pag = 1;
			params.O = mail_params.contactsOnPage * (page - 1);
			params.L = mail_params.contactsOnPage;
		}
		
		var show_spinner = function (f) {
			data.spinner && data.spinner.toggleClass('ico_spinner', f);
		};
		
		show_spinner(true);
		Spaces.api("mail.archiveContacts", params, function (response) {
			show_spinner(false);
			if (response.code != 0) {
				Spaces.showApiError(response);
			} else {
				var msg;
				mailCore.clearUndo();
				
				if (contactsLength > 1) {
					msg = archive ? L('Контакты перенесены в Архив.') : L('Контакты восстановлены из Архива.');
				} else {
					msg = archive ? L('Контакт перенесён в Архив.') : L('Контакт восстановлен из Архива.');
				}
				
				if (!data.undo)
					msg += tpl.contactUndo({state: archive, action: 'archive', ids: data.contacts.join(',')});
				
				mailServices.resetSelection();
				mailCore.callbackAction(msg, 'contact', data.contacts, response, {full: data.undo});
			}
	    }, {
			onError: function (err) {
				Spaces.showError(err);
				show_spinner(false);
			}
		});
	},
    
	//удаление контакта из корзины (совсем)
	eraseContacts : function(data){
		var redirect = false,
		    contact_length = data.contacts.length,
			page = data.page,
			list = data.list;

		var offset = mail_params.contactsOnPage * page - contact_length;

		var params = {
			CK: null,
			CoNtacts: data.contacts,
			List: list
		};

		if ($('#contacts_wrapper .js-mail_contact').length == contact_length) {
			params.P = page;
			params.Pag =  1;
		} else {
			params.O = offset;
			params.L = contact_length;
			params.Pag = 1;
		}
		
		if (!$('#mail_pagination').is(':empty'))
			params.Cl = 1;
		
		if (data.undo) {
			params.Cl = 1;
			params.Pag = 1;
			params.O = mail_params.contactsOnPage * (page - 1);
			params.L = mail_params.contactsOnPage;
		}
		
		var show_spinner = function (f) {
			data.spinner && data.spinner.toggleClass('ico_spinner', f);
		};
		
		show_spinner(true);
		Spaces.api("mail.eraseContacts", params, function (response) {
			show_spinner(false);
			if (response.code != 0) {
				Spaces.showApiError(response);
			} else {
				var msg;
				mailCore.clearUndo();
				if (!data.undo)
					msg = contact_length > 1 ? L('Контакты удалены из Корзины') :  L('Контакт удалён из корзины');
				mailServices.resetSelection();
				mailCore.callbackAction(msg, 'contact', data.contacts, response);
			}
		}, {
			onError: function (err) {
				Spaces.showError(err);
				show_spinner(false);
			}
		});
	},
    
	//Перенос контакта в спам/из спама
	spamContacts : function(data){
		var redirect = false,
		    spam = data.spam,
		    contactsLength = data.contacts.length,
			page = data.page,
			list = data.list;

		var offset = mail_params.contactsOnPage * page - contactsLength;

		var params = {
			CK: null,
			Spam: data.spam,
			CoNtacts: data.contacts,
			List: list
		};

		if (!$('#mail_pagination').is(':empty'))
			params.Cl = 1;
		
		if ($('#contacts_wrapper .js-mail_contact').length == contactsLength) {
			params.P = page;
			params.Pag =  1;
		} else {
			params.O = offset;
			params.L = contactsLength;
			params.Pag = 1;
		}
		
		if (data.undo) {
			params.Cl = 1;
			params.Pag = 1;
			params.O = mail_params.contactsOnPage * (page - 1);
			params.L = mail_params.contactsOnPage;
		}
		
		if (data.message)
			params.message = data.message;
		
		var show_spinner = function (f) {
			data.spinner && data.spinner.toggleClass('ico_spinner', f);
		};
		
		show_spinner(true);
		Spaces.api("mail.spamContacts", params, function (response) {
			show_spinner(false);
			if (response.code != 0) {
				Spaces.showApiError(response);
			} else {
				var msg;
				mailCore.clearUndo();
				mailServices.resetSelection();
				
				if (contactsLength > 1) {
					msg = spam ? L('E-mail контакты отправлены в Спам.') : ('E-mail контакты восстановлены из Спама.');
				} else {
					msg = spam ? L('E-mail контакт отправлен в Спам.') : ('E-mail контакт восстановлен из Спама.');
				}
				
				if (!data.undo)
					msg += tpl.contactUndo({state: spam, action: 'spam', ids: data.contacts.join(',')});
				
				mailServices.resetSelection();
				mailCore.callbackAction(msg, 'contact', data.contacts, response, {full: data.undo});
			}
		}, {
			onError: function (err) {
				Spaces.showError(err);
				show_spinner(false);
			}
		});
	},

	//Отметка контакта как "прочитанный"
	markContactsAsRead : function(data){
		var contactsLength = data.contacts.length,
			redirect = false,
			from = '';

		if (data.redirect)
			redirect = data.redirect;

		if (data.from)
			from = data.from;
		
		Spaces.api("mail.markContactsAsRead", {
			CoNtacts: data.contacts,
			CK: null
		}, function(response) {

		});
	},
    
	//Очистка корзины
	clearGarbage : function(data){
		var redirect = false;
		if (data.redirect)
			redirect = data.redirect;
		
		Spaces.api("mail.clearGarbage", data, function (response) {
			if (response.code != 0) {
				Spaces.showApiError(response);
			} else {
				mailCore.showMsg(!data.postponed ? L('Ваша корзина очищена') : L('Контакты будут очищены в течение нескольких минут'));
				$('#contacts_wrapper').after('<div class="content-bl">Список контактов пуст.</div>');
				$('#contacts_wrapper, #mail__contacts_buttons, #mail_pagination').remove();
				$('#confirm_clear_garbage').hide();
				mailCore.updateCounters(response.counters);
				
				if (data.postponed)
					Spaces.redirect("/mail/");
			}
		});
	},
    
	//Отметка письма как "избранное"
	favMessages : function(data){
		var list = data.list,
			contact = data.contact,
			messages = data.messages,
			page = data.page,
			fav = data.fav;

		var offset = mail_params.onPage * page - 1;

		var params = {
			CK: null,
			Contact: data.contact,
			MeSsages: data.messages,
			Fav: data.fav,
			List: list
		};

		if(list == 1) {
			if($('#messages_list .mail__dialog_wrapper').length == 1) {
				params.P = page;
				params.Pag =  1;
			} else {
				params.O = offset;
				params.L = 1;
				params.Pag = 1;
			}

			if(!$('#mail_pagination').is(':empty')) params.Ml = 1;
		}
		
		Spaces.api("mail.favMessages", params, function (response) {
			if (response.code != 0) {
				Spaces.showApiError(response);
			} else {
				var msg = fav ? L('Сообщение добавлено в избранное') : L('Сообщение удалено из избранного');
				if (list == 1) {
					mailCore.callbackAction(msg, 'message', data.messages, response);
				} else {
					mailCore.showMsg(msg)
					data.el.data('action', fav ? 'mail_message_unfav' : 'mail_message_fav');
					data.el.html('<span class="ico_mail ico_mail_fav"></span> ' + 
						(fav ? L('Из избранного') : L('В избранное')));
				}
			}
		});
	},
    
    monitorTextareaTyping: function () {
		var ta = $('#MailPage textarea'), last_timeout;
		if (mail_params.contactId) {
			ta.typingDetect(true).on('focus', function () {
				last_ta_value = ta.val();
				last_timeout && clearTimeout(last_timeout);
				last_timeout = null;
			}).on('typing', function (e) {
				mailCore.sendTypingEvent(mail_params.contactId);
			}).on('blur', function () {
				last_timeout = setTimeout(function () {
					if (last_ta_value != null && last_ta_value != ta.val())
						mailCore.sendTypingEvent(mail_params.contactId, true);
					last_ta_value = null;
				}, 1000);
			});
		}
	},
    
    sendTypingEvent: function (nid, force) {
		var self = this;
		
		mailCore.send_typing[nid] = mailCore.send_typing[nid] || 0;
		if (Date.now() - mailCore.send_typing[nid] > TYPING_SEND_TIMEOUT || force) {
			var ta = $('#MailPage textarea');
			mailCore.send_typing[nid] = Date.now();
			
			if (Date.now() - mail_last_send < 3000 || mail_send_message)
				return;
			
			if (!force || last_ta_value != ta.val() || isVoiceRecording) {
				// console.log("SAVE: " + ta.val());
				Spaces.cancelApi(last_typing_req);
				last_typing_req = Spaces.api("mail.typing", {CK: null, Contact: nid, message: ta.val(), No_notify: force, Voice: isVoiceRecording ? 1 : 0});
			}
			last_ta_value = ta.val();
		}
		
		if (!force) {
			clearTimeout(last_ta_value_int);
			last_ta_value_int = setTimeout(function () {
				// console.log("force?!", last_ta_value);
				if (last_ta_value !== null)
					mailCore.sendTypingEvent(nid, true);
			}, 1000);
		}
	},
    
    typingPlace: function (typing) {
		var typing_place = ((mail_params.contactId && mail_params.contactId == typing.id) || 
			(mail_params.talkId && mail_params.talkId == typing.talk_id) ? 
				$('#mail_typing') : $('#mail_typing_' + typing.key));
		return {
			typing: typing_place,
			text: $('#mail_text_' + typing.key)
		};
	},
    
    setTyping: function (opts, enable, force) {
		var key = opts.talk_id ? 'talk' + opts.talk_id : opts.id,
			typing = mailCore.typings[key];
		
		if (!typing) {
			typing = {
				id: opts.id, talk_id: opts.talk_id,
				key: key, users: {}, voice: {}
			};
		}
		
		var place = mailCore.typingPlace(typing);
		if (!enable) {
			place.typing.empty().hide();
			place.text.show();
			$('#user_activity, #mail__members_cnt').show();
			
			if (!typing.talk_id || (!typing.users && !typing.voice) || force) {
				delete mailCore.typings[typing.key];
			} else {
				typing.users[opts.user] = 0;
				typing.voice[opts.user] = 0;
			}
		} else {
			mailCore.typings[typing.key] = typing;
			typing.time = Date.now();
			if (opts.user) {
				if (opts.voice) {
					typing.voice[opts.user] = Date.now();
				} else {
					typing.users[opts.user] = Date.now();
				}
			}
		}
		mailCore.typingMonitor(true);
	},
    
    typingMonitor: function (enable) {
		if (!enable && mailCore.typing.interval) {
			clearInterval(mailCore.typing.interval);
			mailCore.typing.interval = null;
			for (var id in mailCore.typings)
				mailCore.setTyping(mailCore.typings[id], false, true);
		}
		
		if (enable && !mailCore.typing.interval && !$.isEmptyObject(mailCore.typings)) {
			var points = ['&nbsp;&nbsp;&nbsp;', '.&nbsp;&nbsp;', '..&nbsp;', '...'];
			mailCore.typing.interval = setInterval(function () {
				if (mailCore.typing.cnt >= points.length)
					mailCore.typing.cnt = 0;
				
				var i = 0, now = Date.now();
				for (var id in mailCore.typings) {
					++i;
					var typing = mailCore.typings[id];
					if (now - typing.time > TYPING_TIMEOUT) {
						typing.users = null;
						typing.voice = null;
						mailCore.setTyping(typing, false, true);
						continue;
					}
					
					var place = mailCore.typingPlace(typing),
						from_cl = !!place.typing.data('cl');
					if (place.typing.length > 0) {
						var writing = "", users = [], voice = [];
						$.each(typing.users, function (k, v) {
							if (now - v <= TYPING_TIMEOUT)
								users.push('<strong>' + k + '</strong>');
						});
						$.each(typing.voice, function (k, v) {
							if (now - v <= TYPING_TIMEOUT)
								voice.push('<strong>' + k + '</strong>');
						});
						if (!users.length && !voice.length)
							continue;
						
						var writing;
						
						if (users.length > 0) {
							writing = users.length > 1 ?
								L('{0} и {1} печатают', users.slice(0, -1).join(', '), users.slice(-1).join('')) :
								L('<strong>{0}</strong> печатает', users[0]);
						} else {
							writing = voice.length > 1 ?
								L('{0} и {1} записывают голосовое сообщение', voice.slice(0, -1).join(', '), voice.slice(-1).join('')) :
								L('<strong>{0}</strong> записывает голосовое сообщение', voice[0]);
						}

						if (from_cl) {
							place.typing.show().html('<span class="ico_mail ico_mail_write"></span> ' + writing + points[mailCore.typing.cnt]);
						} else {
							$('#user_activity, #mail__members_cnt').hide();
							place.typing.show().html(
								'<span class="ico_mail ico_mail_write"></span> ' + 
								writing + points[mailCore.typing.cnt]
							);
						}
						place.text.hide();
					}
				}
				++mailCore.typing.cnt;
				
				if (!i)
					mailCore.typingMonitor(false);
			}, Device.type == 'desktop' ? 200 : 333);
		}
	},
    
	//Ответ на сообщение
	replyMessage : function(data){
		var redirect = false,
			list = data.list;

		var params = {
			CK: null,
			Message: data.message,
			Contact: data.contact,
			List: list
		};
		
		Spaces.api("mail.getReplyMessage", params, function (response) {
			if (response.code != 0) {
				Spaces.showApiError(response);
			} else {
				var message =
					'<span class="ico_buttons ico_buttons_close block-btn js-delete_reply" title="' + L('Удалить') + '"></span>' +
						response.message +
					'<input type="hidden" name="Reply" value="' + data.message + '" />';

                $('#reply_message').html(message).show();
                $('#MailPage textarea').focus();
			}
		});
	},
	
	// Редактирование сообщения
	editMessage(data) {
		let form = $('#MailPage form');
		
		let params = {
			CK: null,
			Message: data.message,
			Contact: data.contact,
			List: data.list
		};
		
		if ($('#mail-send-button').attr("disabled"))
			return;
		
		if (AttachSelector.isBusy())
			return;
		
		if (AttachSelector.instance(form)) {
			AttachSelector.instance(form).setEditMode(true);
			AttachSelector.instance(form).setObjectId(data.message);
		}

		if (last_edit_req)
			Spaces.cancelApi(last_edit_req);
		
		last_edit_req = Spaces.api("mail.getEditMessage", params, function (res) {
			last_edit_req = false;
			
			if (res.code != 0) {
				Spaces.showApiError(res);
				return;
			}
			
			let textarea = $('#MailPage textarea');
			
			// Сохраним текущие аттачи и текст, чтобы если что их восстановить
			before_edit_state = {
				attaches: saveOldAttaches(form),
				text: textarea.val()
			};
			
			$('#mail-send-button')
				.data('edit', data.message)
				.find('.js-btn_val').text(L('Сохранить'));
			
			// Добавляем аттачи из сообщения которое редактируем
			let attaches = getAttachesList(res.attaches);
			AttachSelector.replaceAttaches(form, attaches);
			mailServices.onAttachesChanged();
			
			let message =
				'<span class="ico_buttons ico_buttons_close block-btn js-mail_cancel_edit" title="' + L('Отменить редактирование') + '"></span>' +
				res.message;
			$('#reply_message').html(message).show();
			textarea.val(res.text);
			textarea[0].dispatchEvent(new Event('change', { bubbles: true }));
			textarea.focus();
			mailServices.checkMainButtons();
		}, {
			onError(err) {
				last_edit_req = false;
				Spaces.showError(err);
			}
		});
	},
	
	isEditMode() {
		return $('#mail-send-button').data('edit') > 0;
	},
	
	cancelEdit(clean_all) {
		let form = $('#MailPage form');
		let textarea = $('#MailPage textarea');
		
		AttachSelector.resetAttaches(form);
		mailServices.onAttachesChanged();
		
		$('#reply_message').hide().empty();
		$('#mail-send-button')
			.removeData('edit')
			.find('.js-btn_val').text(L('Отправить'));
		
		if (clean_all) {
			textarea[0].value = '';
			textarea[0].rows = 1;
			textarea[0].dispatchEvent(new Event('change', { bubbles: true }));
		} else {
			textarea[0].value = before_edit_state.text;
			textarea[0].rows = 1;
			textarea[0].dispatchEvent(new Event('change', { bubbles: true }));
			AttachSelector.replaceAttaches(form, before_edit_state.attaches);
		}

		if (AttachSelector.instance(form)) {
			AttachSelector.instance(form).setEditMode(false);
			AttachSelector.instance(form).setObjectId(0);
		}
		before_edit_state = false;

		mailServices.checkMainButtons();
	},
	
	//Перемещение письма из корзины/в корзину
	swapMessages : function(data){
		var redirect = false,
		    messagesLength = data.messages.length,
		    garbage = data.garbage,
			page = data.page,
			list = data.list;

		var offset = mail_params.onPage * page - 1;

		var params = {
			CK: null,
			Garbage: data.garbage,
			MeSsages: data.messages,
			Contact: data.contact,
			List: list,
			hash: TAB_ID
		};

		if($('#messages_list .mail__dialog_wrapper').length == 1) {
			params.P = page;
			params.Pag =  1;
		} else {
			params.O = offset;
			params.L = 1;
			params.Pag = 1;
		}

		if (!$('#mail_pagination').is(':empty'))
			params.Ml = 1;
		
		Spaces.api("mail.swapMessages", params, function (response) {
			if (response.code != 0) {
				Spaces.showApiError(response);
			} else {
				var msg = data.garbage ? L('Сообщение успешно перенесено в Корзину.') : L('Сообщение успешно восстановлено из Корзины.');
				mailCore.callbackAction(msg, 'message', data.messages, response);
			}
		});
	},
    
	//Удаление письма (из корзины, совсем)
	eraseMessages : function (data, for_all) {
		var redirect = false,
		    messagesLength = data.messages.length,
			page = data.page,
			list = data.list,
			msg;

		var offset = mail_params.onPage * page - 1;
		
		var params = {
			CK: null,
			Contact: data.contact,
			MeSsages: data.messages,
			List: list,
			For_all: for_all ? 1 : 0,
			hash: TAB_ID
		};

		if($('#messages_list .mail__dialog_wrapper').length == 1) {
			params.P = page;
			params.Pag =  1;
		} else {
			params.O = offset;
			params.L = 1;
			params.Pag = 1;
		}

		if (!$('#mail_pagination').is(':empty'))
			params.Ml = 1;
			
		Spaces.api("mail.eraseMessages", params, function (response) {
			if (response.code != 0) {
				Spaces.showApiError(response);
			} else {
				var msg = messagesLength > 1 ? L('Сообщения удалены из корзины') : L('Сообщение удалено из корзины');
				
				if (for_all)
					msg = messagesLength > 1 ? L('Сообщения удалены у вас и у собеседника') : L('Сообщение удалено у вас и у собеседника');
				
				DdMenu.close();
				mailCore.callbackAction(msg, 'message', data.messages, response);
			}
		});
	},
    
	// Сброс счётчика новых писем верхней панели
	resetMailEventsCnt: function () {
		notifications.updateCounter(Notifications.COUNTER.MAIL, 0);
		Spaces.api("mail.resetMailEventsCnt", {}, function() {});
	},
	showMsg: function (text) {
		notifications.showNotification(text, 'info');
	},
	clearUndo: function () {
		$('.js-mail_contact_undo').parent().find('.js-notif_close').click();
	}
};


var mailServices = {
	deinit: function() {
		mail_ready = false;
		
		page_loader.off('requeststart', "mail");
		page_loader.off('requestend', "mail");
		
		HistoryManager.remove("mail");
		pushstream.off("*", "mail");
		mailCore.typingMonitor(false);
		mailCore.send_typing = {};
		mail_params.contactId = 0;
		mailServices.resetMsgQueue(true);
		mailServices.setManualRefresh(false);

		if (voiceTypingInterval) {
			clearInterval(voiceTypingInterval);
			voiceTypingInterval = null;
		}

		destroyVoiceMessages();
	},
	
	init: function() {
		mail_ready = true;
		
		prevMainButtonsState = null;
		currentAttachesCount = 0;
		voiceMessagesEnabled = mailServices.isVoiceMessagesEnabled();

		last_refresh = {req: null, time: Date.now(), interval: null};
		body = $(document.body);
		MailPage = $('#MailPage');
		mail_place = MailPage.data('place');
		mail_params = $('#mail_params').data() || {};
		
		MailPage.on('popper:beforeOpen', '.js-message', function (e) {
			const message = $(this);
			if (!e.target.id.startsWith('mail_message_menu_'))
				return;
			const reactionsList = message.find('.js-reactions_list');
			if (!reactionsList.length || reactionsList.data('disabled'))
				return;

			const objectType = message.data('type');
			const objectId = message.data('id');

			const popperOpener = e.target.closest('.js-message');
			const popper = getPopperById(`reactions_selector_${objectType}_${objectId}`);
			popper.open({
				type: "toolbar",
				placement: "bottom-end",
				offsetTop: -41,
				offsetLeft: -9,
				group: `mail_message_menu_${objectId}`
			}, popperOpener);
		});

		MailPage.on('reactions:updateCounter', '.js-message', function (e) {
			const message = $(this);
			const link = message.find('.js-mail_message_reactions_users_link');
			link.find('.js-text').html(numeral(e.detail.count, [L('$n реакция'), L('$n реакции'), L('$n реакций')]));
			link.toggleClass('hide', e.detail.count == 0);
		});

		MailPage.on('reactions:selectorCollapse', '.js-message', function () {
			const message = $(this);
			const popper = getPopperById(`mail_message_menu_${message.data('id')}`);
			popper.open();
		});

		MailPage.action("reactions_list", function (e) {
			e.preventDefault();
			e.stopPropagation();

			const button = $(this);

			const objectType = button.data('type');
			const objectId = button.data('nid');

			const messageMenu = getPopperById(`mail_message_menu_${objectId}`);
			const usersListMenu = getPopperById(`reaction_users_${objectType}_${objectId}`);
			usersListMenu.open({ offsetTop: 9 }, messageMenu.opener());
		});

		MailPage.on('click', '.js-message_show', function (e) {
			e.preventDefault();
			e.stopPropagation();
			
			var wrap = $(this).parents('.js-message_split').first();
			
			wrap.find('.js-message_preview').each(function () {
				var el = $(this);
				if (el.parents('.js-message_split')[0] == wrap[0])
					el.remove();
			});
			
			wrap.find('.js-message_full').each(function () {
				var el = $(this);
				if (el.parents('.js-message_split')[0] == wrap[0])
					el.removeClass('hide');
			});
			
			if (wrap.data("id"))
				document.location.hash = '#full-' + wrap.data("id");
		});
		
		if (mail_place == 'messagesSearch')
			return;
		
		mail_send_message = false;
		mail_last_send = 0;
		
		page_loader.onShutdown("mail", function () {
			mailServices.deinit();
		});
		
		page_loader.on('requeststart', "mail", function () {
			mail_lock_events = true;
		}, true);
		
		page_loader.on('requestend', "mail", function (only_hash) {
			mail_lock_events = false;
			if (!only_hash) {
				setTimeout(function () {
					// На случай, если зафэйлился запрос, а мы пропускали события LP
					if (mail_ready)
						mailServices.router({refresh: true});
				}, 1000);
			}
		}, true);
		
		var generic_search_callback = function (data) {
			mailServices.router({
				refresh: true,
				onSuccess: data.onSuccess,
				onError: data.onError,
				search: true
			});
		};
		
		import("./search").then(function ({default: UniversalSearch}) {
			// Поиск сообщений
			UniversalSearch.register("mail_messages_search", {
				length: 3,
				allowEmpty: true,
				doSearch: generic_search_callback
			});
			
			// Поиск контактов
			UniversalSearch.register("mail_contacts_search", {
				length: 1,
				allowEmpty: true,
				doSearch: generic_search_callback
			});
			
			UniversalSearch.recheck();
		});
		
		$('#main')
			.on('counterchange', function (e) {
				if (e.counterType == Notifications.COUNTER.MAIL) {
					var List = mail_params.list,
						P = mailServices.getQueryVariable("P") || 1;
					if (notifications.isWindowActive()) {
						if (ge('#loadNewMessages_place_list') && P == 1 && (List == MAIL_LIST.ALL || List == MAIL_LIST.NEW)) {
							if (e.counterValue > 0)
								Spaces.api("mail.resetMailEventsCnt");
							e.counterValue = 0;
						}
					}
				}
			})
			.on('focuswindow', function () {
				if (markReadOnFocus.length > 0) {
					mailCore.markContactsAsRead({
						from: 'message_list',
						contacts: markReadOnFocus
					});
					markReadOnFocus = [];
				}
				if (notifications.getCounter(Notifications.COUNTER.MAIL) > 0)
					mailCore.resetMailEventsCnt();
			})
			.on('click', '.js-delete_reply', function (e) {
                $('#reply_message').hide().empty();
			})
			.on('click', '.js-mail_cancel_edit', function (e) {
				mailCore.cancelEdit(false);
			});

		mailServices.checkButtons(false);
		HistoryManager.replaceState({route: "mail"}, null, document.location.href);

		// lp
		pushstream.on('connect', 'mail', function (e) {
			if (!e.first)
				mailServices.refreshMessages(true);
			mailServices.setManualRefresh(false);
		}).on('disconnect', 'mail', function () {
			if (!pushstream.disabled())
				mailServices.setManualRefresh(true);
		}).on('message', 'mail', mailServices.longpollingMessage);
		mailServices.setManualRefresh(!pushstream.avail());
		
		MailPage.on('click', '.mysite-nick', function (e) {
			if (mail_params && mail_params.talkId) {
				var nick = $.trim($(this).text()),
					ta = $('#MailPage textarea');
				if (ta.length) {
					e.preventDefault();
					var old_value = ta.val(),
						insert = '@' + nick + ', ';
					if (old_value.indexOf(insert) < 0)
						ta.val(insert + ta.val());
					ta.focus();
				}
			}
		});
		
		MailPage.on('mailCheckboxChange', function(e) {
			mailServices.checkBoxesChecker();
		});
		
		// ищем все ссылки и вешаем события на все ссылки в нашем документе
		MailPage.on('click', '.pgn [data-p]', function(e) {
			e.preventDefault();
			var url = new Url($(this).attr("href"), true); // hack for uc-click
			mailServices.goTo(url.url(), false);
		});
	    
		//ввод номера страницы в пагинации
		MailPage.on('submit', '.pgn form', function(e) {
			e.preventDefault();
			var element = $(this),
			    link = element.attr('action') + '&P=' + element.find('input.pgn__search_input').val();
			
			mailServices.goTo(link, false);
		});
	    
		//перенос группы контактов в спам
		MailPage.on('click', '[name="spam_contacts"]',function(){
			if (checkedChekboxes.length > 0){
				mailCore.spamContacts({
				    contacts : checkedChekboxes,
				    spam : 1,
				    spinner: $(this).find('.ico_mail'),
					page: mailServices.getQueryVariable("P") || 1,
					list: mail_params.list
				});
			}
			return false;
		});

		MailPage.on('click', '[name="from_spam_contacts"]',function(){
			if (checkedChekboxes.length > 0){
				mailCore.spamContacts({
					contacts : checkedChekboxes,
					spam : 0,
				    spinner: $(this).find('.ico_mail'),
					page: mailServices.getQueryVariable("P") || 1,
					list: mail_params.list
				});
			}
			return false;
		});
		
		//перенос в корзину группы контактов
		MailPage.on('click', '[name="delete_contacts"]',function() {
			if (checkedChekboxes.length > 0) {
				mailCore.swapContacts({
					contacts : checkedChekboxes,
					garbage : 1,
				    spinner: $(this).find('.js-ico'),
					page: mailServices.getQueryVariable("P") || 1,
					list: mail_params.list
				});
			}
			return false;
		});
	    
		//перенос из корзины несколько контактов
		MailPage.on('click', '[name="restore_contacts"]',function(){
			if (checkedChekboxes.length > 0){
				mailCore.swapContacts({
					contacts : checkedChekboxes,
					garbage : 0,
				    spinner: $(this).find('.ico_mail'),
					page: mailServices.getQueryVariable("P") || 1,
					list: mail_params.list
				});
			}
			return false;
		});
		
		//очистка нескольких контактов в списке контактов из корзины (совсем сотрет)
		MailPage.on('click', '[name="erase_contacts"]',function(){
			var checkedChekboxesLength = checkedChekboxes.length,
			    confirmClearGarbageList = $('#confirm_clear_garbage_list');
			if (checkedChekboxesLength > 0){
				if (checkedChekboxesLength > 1){
					confirmClearGarbageList.find('div').text(L('Вы уверены, что хотите безвозвратно удалить контакты?'));
				}else{
					confirmClearGarbageList.find('div').text(L('Вы уверены, что хотите безвозвратно удалить контакт?'));
				}
				$('#confirm_clear_garbage').hide();
				confirmClearGarbageList.show();
				mailServices.scrollDocument();
			}
			return false;
		});
		
		MailPage.on('click', '#confirm_clear_garbage_list__no',function(){
			$('#confirm_clear_garbage_list').hide();
			return false;
		});
		
		MailPage.on('click', '#addSmilesButton2, #categories_toggler_menu a, #smiles_place a, #block_for_smiles a:not(.free), #mail__contacts_buttons .mail__button',function(e){
			e.preventDefault();
		});
	    
		MailPage.on('click', '#addSmilesButton',function(e){
			e.stopPropagation();
			e.preventDefault();
		});
		
		MailPage.on('click', '#confirm_clear_garbage_list__yes',function(){
			if (checkedChekboxes.length > 0){
				var el = $(this);
				mailCore.eraseContacts({
					contacts : checkedChekboxes,
					redirect : el.data('list'),
					page: mailServices.getQueryVariable("P") || 1,
					list: mail_params.list
				});
			}
			$('#confirm_clear_garbage_list').hide();
			return false;
		});
		
		//очистка всей корзины
		MailPage.on('click', '#clear_garbage, #erase_contact_from_garbage',function(){
			$('#confirm_clear_garbage_list').hide();
			$('#confirm_clear_garbage').show();
			mailServices.scrollDocument();
			return false;
		});
		
		MailPage.on('click', '.js-message-for-edit', function (e) {
			e.preventDefault();
			mailServices.scrollToMessage($(this).data('message'));
		});
		
		MailPage.on('click', 'a[data-action="clear_garbage"]',function(){
			var data = {};
			data.CK = null;
			data.redirect = $(this).data('list');
			mailCore.clearGarbage(data);
			
			var tools = $('#clear_garbage_tools');
			tools.find('.js-replace_link').removeClass('link_active');
			tools.find('.js-replace_widget').addClass('hide');
			
			return false;
		});
		
		MailPage.action('mail_message_delete_for_all', function (e) {
			const el = $(this), message = el.parents('.js-message');
			
			e.preventDefault();
			e.stopPropagation();
			
			const messageMenu = getPopperById(`mail_message_menu_${message.data('id')}`)
			const messageDeleteConfirm = getPopperById(`mail_message_delete_confirm_${message.data('id')}`);
			$(messageDeleteConfirm.element()).html(tpl.confirmErase());
			messageDeleteConfirm.open({}, messageMenu.opener());
		});
		
		// Удаление письма (из корзины, совсем)
		MailPage.action('mail_message_erase', function (e) {
			e.preventDefault();
			const el = $(this), message = el.parents('.js-message');

			if (!el.hasClass('in_action')) {
				const data = {};
				data.CK = null;
				
				checkedChekboxes = [message.data('id')];
				
				data.page = mailServices.getQueryVariable("P") || 1;
				data.list = mail_params.list;
				data.messages = checkedChekboxes;
				data.contact = mail_params.contactId;
				
				el.addClass('in_action');
				mailCore.eraseMessages(data, el.data('forAll'));
			}
			closeAllPoppers();
		});
	    
	    MailPage.action('mail_message_delete mail_message_restore', function (e) {
			e.preventDefault();
			const el = $(this), message = el.parents('.js-message');
			mailCore.swapMessages({
				el: el,
				silent: !!el.data('silent'),
				contact: mail_params.contactId,
				messages: [message.data('id')],
				page: mailServices.getQueryVariable("P") || 1,
				list: mail_params.list,
				garbage: e.linkAction == 'mail_message_delete'
			});
			closeAllPoppers();
		});
	    MailPage.action('mail_message_fav mail_message_unfav', function (e) {
			e.preventDefault();
			const el = $(this), message = el.parents('.js-message');
			mailCore.favMessages({
				contact: mail_params.contactId,
				messages: [message.data('id')],
				fav: e.linkAction == 'mail_message_fav',
				list: mail_params.list,
				page: mailServices.getQueryVariable("P") || 1,
				el
			});
			closeAllPoppers();
		});
		
		MailPage.action('mail_reply', function (e) {
			e.preventDefault();
			const el = $(this), message = el.parents('.js-message');
			mailCore.replyMessage({
				contact: mail_params.contactId,
				message: message.data('id'),
				list: mail_params.list,
				el
			});
			closeAllPoppers();
		});
	    
		MailPage.action('mail_message_edit', function (e) {
			e.preventDefault();
			const el = $(this), message = el.parents('.js-message');
			mailCore.editMessage({
				contact: mail_params.contactId,
				message: message.data('id'),
				list: mail_params.list,
				el
			});
			closeAllPoppers();
		});
	    
		MailPage.action('select_all', function (e) {
			e.preventDefault();
			
			let el = $(this);
			let state = !el.data('state');
			
			el.html(state ? L('Снять все') : L('Выбрать все'));
			
			$('input.mail_chb').each(function() {
				if (this.checked != state)
					$(this).parent().click();
			});
			el.data('state', state);
		});
		
		MailPage.action('select_contacts', function (e) {
			e.preventDefault();
			
			$('#mail_select_contacts_button, #mail_bottom_contacts_buttons, #mail_head_contacts_buttons').toggleClass('hide');
			MailPage.toggleClass('mail__select_contacts');
			
			let in_selection_mode = MailPage.hasClass('mail__select_contacts');
			if (in_selection_mode) {
				let first_contact = $('#contacts_wrapper > div:first-child');
				$('html, body').scrollTo(first_contact, {position: 'center'});
			} else {
				mailServices.resetSelection();
			}
		});
		
	    // Отмена действий с контактами
		$('body').on('click.oneRequest', '.js-mail_contact_undo', function() {
			var el = $(this),
				action = el.data('action'),
				state = !el.data('state');
			var data = {
				contacts: ("" + el.data('ids')).split(','),
				page: mailServices.getQueryVariable("P") || 1,
				list: mail_params.list,
				undo: 1
			};
			
			el.find('.js-spinner').removeClass('hide');
			
			if (action == 'swap') {
				data.garbage = state;
				mailCore.swapContacts(data);
			} else if (action == 'spam') {
				data.spam = state;
				mailCore.spamContacts(data);
			} else if (action == 'archive') {
				data.archive = state;
				mailCore.archiveContacts(data);
			}
			return false;
		});
	    
		//перенос в архив нескольких контактов
		MailPage.on('click', '[name="archive_contacts"]', function() {
			if (checkedChekboxes.length > 0) {
				mailCore.archiveContacts({
					contacts : checkedChekboxes,
					archive : 1,
				    spinner: $(this).find('.ico_mail'),
					page: mailServices.getQueryVariable("P") || 1,
					list: mail_params.list
				});
			}
			return false;
		});
	    
		//перенос из архива нескольких контактов
		MailPage.on('click', '[name="from_archive_contacts"]',function(){
			if (checkedChekboxes.length > 0){
				mailCore.archiveContacts({
					contacts : checkedChekboxes,
					archive : 0,
				    spinner: $(this).find('.ico_mail'),
					page: mailServices.getQueryVariable("P") || 1,
					list: mail_params.list
				});
			}
			return false;
		});
	    
		MailPage.on('inputError inputErrorHide', '#MailPage textarea', function (e) {
			$('#messages_list').toggleClass('pdt', e.type == 'inputErrorHide');
		});
		
		//отправка сообщния из списка сообщений
		MailPage.on('click', '#mail-send-button', async function (e) {
			var $btn = $(this),
				$textarea = $('#MailPage textarea'),
				$groups_selector = $('.js-groups_list').first(),
				$receiver = $groups_selector.find('.text-input').first(),
				$receiver_selected = $groups_selector.find('.s-property'),
				$captcha = $('input[name=captcha_code]'),
				$form = $(this).parents('form'),
				is_main_form = !ge('#messages_list');
			
			if (!is_main_form)
				e.preventDefault();
			
			if ($btn.attr('disabled'))
				return;
			
			Spaces.view.setInputError($textarea, false);
			Spaces.view.setInputError($receiver, false);
			
			var att_sel = AttachSelector.instance($form),
				message = $.trim($textarea.val()),
				attaches = AttachSelector.getAttaches($form, true),
				user = $.trim($receiver.val()),
				
				image_code = '';
			
			var toggle_form_lock = function (flag) {
				mail_send_message = flag;
				if (att_sel)
					att_sel.lock(flag);
				if (flag) {
					$('#mail-send-button').attr("disabled", "disabled").css("opacity", "0.4").find('.js-btn_val').text(L("Отправка"));
					$textarea.attr("readonly", "readonly");
				} else {
					$('#mail-send-button').removeAttr("disabled").css("opacity", "1").find('.js-btn_val').text(L("Отправить"));
					$textarea.removeAttr("readonly").removeAttr("disabled").trigger('hidebb');
				}
			};
			
			if ($captcha.length > 0)
				image_code = $captcha.val();
			
			var msg_error, max_length = $textarea.data('maxlength');
			if (!message.length && !isVoiceRecording && !attaches.length > 0 && (!att_sel || !att_sel.getTmpCnt()) && !$('#mail_share').length) {
				msg_error = L('Сообщение не должно быть пустым.');
			} else if (message.length > $textarea.data('maxlength')) {
				msg_error = L('Сообщение не должно быть больше {0} {1}.', max_length,
					numeral(max_length, [L("символа"), L("символов"), L("символов")]));
			}
			
			var has_errors = false;
			if (msg_error) {
				if (Device.type == 'desktop')
					$textarea.focus();
				if (isVoiceRecording) {
					Spaces.showError(msg_error);
				} else {
					Spaces.view.setInputError($textarea, msg_error);
				}
				has_errors = true;
			}
			
			if ($receiver.length && (!$receiver_selected.length && !has_errors && !user.length)) {
				$receiver.focus();
				// Spaces.view.setInputError($receiver, L('Не указаны получатели.'));
				has_errors = true;
			}

			if (has_errors) {
				e.preventDefault();
				return;
			}

			if (is_main_form) { // Это не список сообщений, значит не юзаем API
				tick(function () {
					toggle_form_lock(true);
				});
				return;
			}

			if (!has_errors && Device.type == 'desktop' && !$('#mail-send-button').data('edit'))
				$textarea.focus();

			toggle_form_lock(true);

			if (isVoiceRecording && !currentRecordedVoice) {
				await stopVoiceRecording();

				if (!currentRecordedVoice) {
					Spaces.showError(L('Ошибка сохранения голосового сообщения.'));
					mailServices.setVoiceRecording(false);
					toggle_form_lock(false);
					return;
				}
			}

			if (AttachSelector.isBusy()) {
				$textarea.attr("disabled", "disabled");
				AttachSelector.onDone(function () {
					toggle_form_lock(false);
					$btn.removeAttr("disabled").click();
				});
				return;
			}
			var att_sel = AttachSelector.instance($textarea);
			att_sel && att_sel.onFormSubmit();

			var data = {message: message};
			if (user)
				data.user = user;
			data.image_code = image_code;
			data.from = 'messageList';

			data.contact = mail_params.contactId;
			data.att = attaches;

			let $reply = $('input[name=Reply]');
			if ($reply.length > 0)
				data.reply = $reply.val();

			data.edit = $('#mail-send-button').data('edit');

			if (currentRecordedVoice)
				data.voiceMessage = currentRecordedVoice;

			mailCore.sendMessage(data, function (res) {
				let $ta = $('#MailPage textarea');
				if (res.code != 0) {
					if (isVoiceRecording) {
						Spaces.showApiError(res);
					} else {
						Spaces.view.setInputError($ta, Spaces.apiError(res));
					}
				}

				if (att_sel && !att_sel.ok())
					return; // Страница, с которой отправляли, умерла!

				toggle_form_lock(false);

				if (res && res.code == 0) {
					mail_last_send = Date.now();

					if (data.edit) {
						$('#m' + res.message.nid).replaceWith(res.message_widget);
						mailCore.cancelEdit(true);
					} else {
						$textarea[0].value = '';
						$textarea[0].rows = 1;
						$textarea[0].dispatchEvent(new Event('change', { bubbles: true }));
						$textarea.trigger('blur');
						AttachSelector.resetAttaches($form);
						mailServices.onAttachesChanged();
						$('#reply_message').hide().empty();
						$('#captcha').empty();
					}
				}

				if (res && res.code == 0) {
					if (data.edit) {
						mailServices.scrollToMessage(data.edit);
					} else if (mail_place != 'sendMessageForm') {
						var List = mail_params.list;
						if (List == MAIL_LIST.ARCHIVE) {
							Spaces.redirect(window.location.href);
						} else {
							let P = $('#mail_pagination .pgn').data('page') || 1;
							if (P == 1) {
								if ('pagination' in res) {
									if (res.pagination) {
										$('#mail_pagination').html(res.pagination);
									} else {
										$('#mail_pagination').empty();
									}
								}

								if (!ge('#m' + res.message.nid)) {
									$('#messages_list')
										.prepend(res.message_widget).first();
									mailServices.messagesLengthChecker();
								}
							} else {
								$('#mail_pagination [data-p="1"]').click();
							}
						}
					}
				}
			});
		});
	    
		//получение новых сообщений, полученных через лонгполинг
		MailPage.on('click', '#loadNewMessages',function(e){
			e.preventDefault();
			newMessagesCnt = 0;
			var link = $(this).data('url')+"&salt="+mailServices.randomNumber();
			$('#loadNewMessages_place').empty();
			
			mailServices.goTo(link, false);
		});
		
		// Сохранение аттачей
		MailPage.on('onSaveAttaches', function (e, data) {
			mailServices.onAttachesChanged();
		});
		
		// Удаление аттачей
		MailPage.on('onDeleteAttaches', function (e) {
			mailServices.onAttachesChanged();
		});

		MailPage.on('click', '#voice-recorder-cancel', (e) => {
			if (!currentRecordedVoice)
				return;

			e.preventDefault();
			currentRecordedVoice = null;
			clearInterval(voiceTypingInterval);
			voiceTypingInterval = null;
			mailServices.setVoiceRecording(false);
		});

		MailPage.on('click', '#mail-record-button', async (e) => {
			e.preventDefault();

			if (!canRecordVoiceMessages()) {
				Spaces.showError(L('Ваш браузер не поддерживает запись голосовых сообщений. Попробуйте его обновить или установить Google Chrome.'));
				return;
			}

			// Предварительно кэшиуем
			mailCore.getVoicesUploadURL();

			let started = await startVoiceRecording((recordedVoice) => {
				clearInterval(voiceTypingInterval);
				voiceTypingInterval = null;

				if (recordedVoice) {
					currentRecordedVoice = recordedVoice;
				} else {
					mailServices.setVoiceRecording(false);
				}
			});
			mailServices.setVoiceRecording(started);

			let voiceTyping = () => mailCore.sendTypingEvent(mail_params.contactId);
			voiceTyping();
			voiceTypingInterval = setInterval(voiceTyping, 1000);
		});
		
		MailPage.on('click', '.delete_temp_link',function(){
			$('#'+$(this).data('deleteid')).remove();
		});
		
		if (voiceMessagesEnabled) {
			let textarea = document.querySelector('#MailPage textarea');
			if (textarea) {
				let onInput = throttle(() => mailServices.checkMainButtons(), 10);
				textarea.addEventListener('change', () => onInput(), false);
				textarea.addEventListener('paste', () => onInput(), false);
				textarea.addEventListener('input', () => onInput(), false);
			}
		}

		mailServices.onAttachesChanged();
		mailServices.checkMainButtons();

		mailServices.fullMessageCheck();
		mailCore.monitorTextareaTyping();

		if ($('#messages_list').length)
			initVoiceMessages();
	},
	
	setVoiceRecording(flag) {
		isVoiceRecording = flag;
		$('#mail-form-atatch-buttons').toggleClass('hide', isVoiceRecording);
		$('#mail-text-field').toggleClass('hide', isVoiceRecording);
		$('#voice-recorder').toggleClass('hide', !isVoiceRecording);
		mailServices.checkMainButtons();

		if (!flag) {
			currentRecordedVoice = null;
			closeVoiceRecoder();
		}
	},

	isVoiceMessagesEnabled() {
		return $('#voice-recorder').length;
	},

	checkMainButtons() {
		let textarea = document.querySelector('#MailPage textarea');
		if (!textarea)
			return;

		let newState = textarea.value.length > 0 || currentAttachesCount > 0 || isVoiceRecording || !voiceMessagesEnabled || mailCore.isEditMode();
		if (newState !== prevMainButtonsState) {
			$('#mail-send-button').toggleClass('hide', !newState);
			$('#mail-record-button').toggleClass('hide', newState);
			prevMainButtonsState = newState;
		}
	},

	onAttachesChanged() {
		let form = $('#MailPage textarea').parents('form');
		if (form.length) {
			currentAttachesCount = AttachSelector.getAttaches(form, true).length;
			mailServices.checkMainButtons();
		}
	},

	fullMessageCheck: function () {
		var id = document.location.hash.match(/#full-(m[\d\.]+)/i);
		id && $('#' + id[1] + ' .js-message_show').click();
	},
	
	//перенаправление
	goTo : function (redirect, settings) {
		if (redirect) {
			var old_location = window.location.href;
			HistoryManager.pushState({route: "mail"}, null, redirect);
			if (window.location.href != old_location)
				mailServices.router(settings);
			else
				Spaces.redirect(redirect);
		} else
			mailServices.router(settings);
	},

	messagesLengthChecker : function(){
		var messageListItemsLength = $('#messages_list .mail__dialog_wrapper').length;

		if (messageListItemsLength > mail_params.onPage) {
			var delta = messageListItemsLength - mail_params.onPage;

			while (delta != 0){
				$('#messages_list .mail__dialog_wrapper').last().remove();
				delta -= 1;
			}
		}

		checkVoicePlayers();
	},
    
	contactsLengthChecker : function(){
		//убираем со страницы лишние контакты
		var contactListItemsLength = $('.js-mail_contact').length;
	    
		if (contactListItemsLength > mail_params.contactsOnPage) {
			var delta = contactListItemsLength - mail_params.contactsOnPage;
			
			while (delta != 0){
				$('.js-mail_contact').last().remove();
				delta -= 1;
			}
		}
	},
    
	//обработка сообщения из лонгполинга
	longpollingMessage : function(data) {
		if (mail_lock_events)
			return;
		
		/*
		var lp_name = 'UNKNOWN ' + data.act;
		$.each(pushstream.TYPES, function (k ,v) {
			if (data.act == v)
				lp_name = k;
		});
		console.log(lp_name, data);
		*/
		
		var in_message_list = !!ge('#messages_list'),
			has_textarea = !!$('#MailPage textarea').length;
		
		if (!mail_params.search && in_message_list && (
			(data.act == pushstream.TYPES.MAIL_TALK_MEMBER_ADD && !has_textarea) || 
			(data.act == pushstream.TYPES.MAIL_TALK_MEMBER_DELETE && has_textarea) || 
			(data.act == pushstream.TYPES.MAIL_TALK_MEMBER_RETURN && !has_textarea) || 
			(data.act == pushstream.TYPES.MAIL_TALK_MEMBER_LEAVE && has_textarea)
		) && mail_params.talkId == data.data.talk_id) {
			Spaces.redirect();
			return;
		}
		
		var List = mail_params.list,
		    Link_id = mailServices.getQueryVariable("Link_id") || 0,
		    contact = mailServices.getQueryVariable("Contact"),
		    P = mailServices.getQueryVariable("P") || 1,
		    contact_list = mailServices.getQueryWord('contact_list'),
		    message_list = mailServices.getQueryWord('message_list');
		
		switch (data.act) {
			case pushstream.TYPES.USER_OBJECT_ADD_REACTION:
			case pushstream.TYPES.USER_OBJECT_DELETE_REACTION:
			case pushstream.TYPES.USER_OBJECT_VIEW_REACTION: {
				if (data.newReactionsCnt != null) {
					const contactItem = document.querySelector(`#contact_${data.parentId}`);
					if (contactItem)
						contactItem.classList.toggle('mail-contact--has-reactions', +data.newReactionsCnt > 0);
				}
				break;
			}
		}

		if (data.act == pushstream.TYPES.MAIL_MESSAGE_RECEIVE || data.act == pushstream.TYPES.MAIL_MESSAGE_SEND) {
			// Выключаем печатание
			mailCore.setTyping({
				id: data.data.contact.nid,
				talk_id: data.data.contact.talk_id,
				user: data.data.contact.user
			}, false);
		}
		
		if (data.act == pushstream.TYPES.MAIL_MESSAGE_SEND && data.data.hash == TAB_ID) {
			// Игнорим сообщение, которое отправлено с этого же таба
			return;
		}
		
		//if (
		//	(data.act == pushstream.TYPES.MAIL_CONTACT_READ && data.data.nid == mail_params.contactId && !data.data.talk_id) || 
		//	(data.act == pushstream.TYPES.MAIL_MESSAGE_RECEIVE && data.data.contact.nid == mail_params.contactId && !data.data.contact.talk_id)
		//) {
		//	tick(() => {
		//		$('.js-action_link[data-action="mail_message_delete_for_all"]').remove();
		//	});
		//}
		
		if (data.act == pushstream.TYPES.MAIL_MESSAGE_RECEIVE && data.data.new_cnt) {
			$('a[data-counter="new"] .cnt').html(data.data.new_cnt);
		}
		
		if (data.act == pushstream.TYPES.MAIL_MESSAGE_SEND) {
			if (data.data.pagination_widget)
				$('#mail_pagination').html(data.data.pagination_widget);
		}
		
		if (data.act == pushstream.TYPES.MAIL_TYPING) {
			if (!data.talk_id || data.user != Spaces.params.name)
				mailCore.setTyping({id: data.contact_id, talk_id: data.talk_id, user: data.user, voice: data.voice}, true);
		}
		
		if (data.act == pushstream.TYPES.MAIL_CONTACT_READ) {
			var decrement_counter = function () {
				var new_cnt = $('#mail__tabs .js-tab_cnt'),
				cnt = Math.max(0, new_cnt.text() - 1);
				new_cnt.text(cnt).toggle(cnt > 0);
			};
			
			var contact = $('#contact_' + data.data.nid);
			if (List == MAIL_LIST.NEW) { // В этом списке удаляем прочитанные
				if (contact.length) {
					contact.remove();
					var api_data = mailServices.getApiParams(),
						contacts = $('#contacts_wrapper .js-mail_contact').length,
						pgn = $('#mail_pagination .pgn'),
						cur_page = pgn.data('page') || 1,
						total_pages = pgn.data('total') || 1;
					
					if (cur_page > 1 && cur_page == total_pages && !contacts) {
						var url = new Url(location.href);
						url.query.P = cur_page - 1;
						mailServices.goTo(url.url());
					} else if (cur_page != total_pages) {
						delete api_data.P;
						api_data.O = (mail_params.contactsOnPage * cur_page) - 1;
						api_data.L = mail_params.contactsOnPage - contacts;
						api_data.Pag = 1;
						
						decrement_counter();
						mailCore.callbackAction("", 'contact', [], {}, {noscroll: true});
						if (!last_refresh.interval && !last_refresh.req) {
							last_refresh.req = Spaces.api("mail.getContacts", api_data, function (res) {
								last_refresh.req = null;
								if (res.code == 0) {
									mailCore.callbackAction("", 'contact', res.contacts, res, {noscroll: true});
								} else {
									mailServices.router({refresh: true});
								}
							}, {
								onError: function () {
									last_refresh.req = null;
									mailServices.router({refresh: true});
								}
							});
						}
					} else {
						decrement_counter();
						mailCore.callbackAction("", 'contact', [], {}, {noscroll: true});
					}
				}
			} else {
				//отмечаем сообщения как прочитанные в переписке
				if (data.data.nid == mail_params.contactId && ge('#messages_list')) {
					$('.mail__dialog_unread').each(function(){
						$(this).removeClass('mail__dialog_unread');
					});
				}
				
				if (contact.length) {
					var mbody = contact.find('.js-mail_body');
					if (mbody.hasClass(classes.msg.unread)) {
						decrement_counter();
						mbody.removeClass(classes.msg.unread).addClass(classes.msg.old)
					}
					contact.removeClass('mail-contact--is-unread');
					$('#full_message_' + data.data.nid).removeClass('mail-contact__message--is-unread');
				} else {
					decrement_counter();
				}
			}
		}
		
		// если список конактов
		if ($('#contacts_wrapper').length > 0) {
			if ($.inArray(+data.act, [
				pushstream.TYPES.MAIL_MESSAGE_RECEIVE,
				pushstream.TYPES.MAIL_MESSAGE_SEND,
				pushstream.TYPES.MAIL_MESSAGE_ERASE,
				pushstream.TYPES.MAIL_MESSAGE_SWAP,
				pushstream.TYPES.MAIL_MESSAGE_EDIT
			]) >= 0)
			{
				let canHandle = (
					data.act == pushstream.TYPES.MAIL_MESSAGE_ERASE ||
					data.act == pushstream.TYPES.MAIL_MESSAGE_EDIT ||
					(P == 1 && (List == MAIL_LIST.ALL || List == MAIL_LIST.NEW))
				);
				if (canHandle) {
					if (List == MAIL_LIST.NEW) {
						mailServices.router({refresh: true});
					} else {
						tick(function () {
							mailCore.getContactsByIds({
								List: List,
								Link_id: Link_id,
								contacts: data.data.contact.nid
							});
						});
					}
				}
			}
		} else {
			if (data.act == pushstream.TYPES.MAIL_MESSAGE_EDIT && data.data.hash != TAB_ID) {
				Spaces.api("mail.getMessagesByIds", {
					Contact: data.data.contact.nid,
					MeSsages: [data.data.nid],
					List: mail_params.list
				}, function (res) {
					if (res.code == 0) {
						$('#m' + data.data.nid).replaceWith(res.messages[data.data.nid]);
					} else {
						console.error(`[MAIL_MESSAGE_EDIT] ${Spaces.apiError(res)}`);
					}
				}, {
					onError(err) {
						console.error(`[MAIL_MESSAGE_EDIT] ${err}`);
					}
				});
			}
			
			// если в переписке и мне пришло сообщение/либо я отправил
			if (!mail_params.search && (data.act == pushstream.TYPES.MAIL_MESSAGE_RECEIVE || data.act == pushstream.TYPES.MAIL_MESSAGE_SEND) &&
					data.data.contact.nid == mail_params.contactId && ge('#messages_list'))
			{
				if ((List == MAIL_LIST.ALL || List == MAIL_LIST.SPAM || List == MAIL_LIST.ALL) && P == 1) {
					let pgn = $('#mail_pagination .pgn');
					let need_pagination = true;
					if (pgn.length) {
						let new_count = +pgn.data('count') + 1;
						let old_pages = pgn.data('total');
						let new_pages = Math.ceil(new_count / pgn.data('on_page'));
						need_pagination = old_pages != new_pages;
						pgn.data('count', new_count).data('total', new_pages);
					}
					
					mailServices.getMessageDelayed({
						mid: data.data.nid,
						cid: data.data.contact.nid,
						Link_id: Link_id,
						new_page: need_pagination,
						received: data.act == pushstream.TYPES.MAIL_MESSAGE_RECEIVE
					});
					
					newMessagesCnt = 0;
				} else if (List == MAIL_LIST.ARCHIVE && P == 1) {
					// если на первой странице архива
					mailServices.router({refresh: true});
				} else {
					// если сообщение отправили не мы
					if (data.act != pushstream.TYPES.MAIL_MESSAGE_SEND) {
						// перенаправляем на первую страницу сообщений
						newMessagesCnt = newMessagesCnt + 1;
						var url ='/mail/message_list/?Contact='+data.data.contact.nid+'&Link_id='+Link_id+'&List='+List+'&P=1';
						$('#loadNewMessages_place').html(mailTemplates.loadNewMessages({'url':url}));
					}
				}
			}
			
			if ((data.act == pushstream.TYPES.MAIL_MESSAGE_ERASE || data.act == pushstream.TYPES.MAIL_MESSAGE_SWAP)) {
				if (data.data.contact.nid == mail_params.contactId && data.data.hash != TAB_ID) {
					let pgn = $('#mail_pagination .pgn');
					if (pgn.length) {
						let new_count = +pgn.data('count') + 1;
						let new_pages = Math.ceil(new_count / pgn.data('on_page'));
						pgn.data('count', new_count).data('total', new_pages);
					}
					
					var msg = $('#m' + data.data.nid);
					if (msg.length) {
						msg.remove();
						mailServices.router({refresh: true});
					}
				}
			}
		}
	},
    
    refreshMessages: function (force) {
		var self = this;
		if (last_refresh.interval) {
			if (!last_refresh.req && (force || (Date.now() - last_refresh.time >= MAIL_REFRESH_INTERVAL))) {
				// Обновляем сообщения только в ML и CL
				var P = mailServices.getQueryVariable("P") || 1;
				if (P == 1 && ((mail_params.contactId && ge('#messages_list')) || ge('#loadNewMessages_place_list'))) {
					mailServices.router({
						refresh: true
					});
				}
			}
		}
	},
	
    setManualRefresh: function (flag) {
		var self = this;
		
		if (mail_params.search) // В поиске нельзя такое!
			return;
		
		if (!flag == !last_refresh.interval)
			return;
		if (last_refresh.interval) {
			clearInterval(last_refresh.interval);
			last_refresh.interval = null;
		}
		if (flag) {
			last_refresh.interval = setInterval(function () {
				self.refreshMessages();
			}, MAIL_REFRESH_INTERVAL / 4);
			last_refresh.time = Date.now();
		}
	},
    
    markAsRead: function () {
		if (notifications.isWindowActive()) {
			mailCore.markContactsAsRead({
				from: 'message_list',
				contacts: [mail_params.contactId]
			});
		} else {
			markReadOnFocus.push(mail_params.contactId);
		}
	},
    
    getMessageDelayed: function (data) {
		if ($('#m' + data.mid).length) {
			if (data.received)
				mailServices.markAsRead();
			return;
		}
		
		if (!messages_queue.ids.length)
			messages_queue.start = Date.now();
		
		messages_queue.ids.push(data.mid);
		if (data.new_page)
			messages_queue.new_page = true;
		if (data.received)
			messages_queue.has_unread = true;
		
		if (!messages_queue.request) {
			var mids = messages_queue.ids;
			messages_queue.ids = [];
			
			messages_queue.request = Spaces.api("mail.getMessagesByIds", {
				Contact: data.cid,
				MeSsages: mids,
				List: data.list,
				Pag: messages_queue.new_page ? 1 : 0
			}, function (res) {
				if (messages_queue.has_unread)
					mailServices.markAsRead();
				if (res.code == 0) {
					messages_queue.request = false;
					
					var messages_wrap = $('#messages_list');
					for (var id in res.messages) {
						if (ge('#m' + data.mid))
							continue;
						
						var $message = messages_wrap.prepend(res.messages[id]).children().first();
						Spaces.prepareLinks($message, {link_id: data.Link_id});
					}
					
					if (res.pagination)
						$('#mail_pagination').html(res.pagination);
					
					mailServices.messagesLengthChecker();
				} else {
					console.error(Spaces.services.processingCodes(res), res);
					
					// Обновим сразу все сообщения при ошибке
					mailServices.resetMsgQueue();
					mailServices.router({refresh: true});
				}
			}, {
				onError: function (err) {
					console.log(err);
					
					// Обновим сразу все сообщения при ошибке
					if (messages_queue.has_unread)
						mailServices.markAsRead();
					mailServices.resetMsgQueue();
					mailServices.router({refresh: true});
				}
			});
		}
	},
    resetMsgQueue: function (stop) {
		if (messages_queue.request && stop)
			Spaces.cancelApi(messages_queue.request);
		
		messages_queue.request = false;
		messages_queue.ids = [];
		messages_queue.new_page = false;
		messages_queue.has_unread = false;
	},
    
	//проверка включенных чекбоксов, добавление айдишников в массив
	checkBoxesChecker : function(){
		checkedChekboxes = [];
		$('input.mail_chb:checked').each(function(){
			var id = $(this).data('id');
			checkedChekboxes.push(id);
			checkedChekboxesMap[id] = true;
		});
		mailServices.checkButtons(checkedChekboxes.length > 0);
	},
	
	restoreCheckBoxes: function () {
		mailServices.resetSelection();
	   
		if (checkedChekboxes && checkedChekboxes.length) {
			$('input.mail_chb').each(function() {
				var el = $(this), id = el.data('id');
				if (!this.checked && checkedChekboxesMap[id])
					el.parent().click();
			});
		}
	},
	
	resetSelection() {
		let select_all_btn = $('.js-action_link[data-action="select_all"]');
	    if (select_all_btn.data('state'))
			select_all_btn.click();
		
		$('input.mail_chb:checked').each(function() {
			$(this).parent().click();
		});
	},

	checkButtons : function(enabled) {
		var buttons = $('#mail_bottom_contacts_buttons button');
		for(var i=0; i < buttons.length; i++) {
			if(enabled)
				$(buttons[i]).removeClass('disabled').removeAttr('disabled');
			else
				$(buttons[i]).addClass('disabled').attr('disabled', 'disabled');
		}
	},
	
	getQueryVariable : function (variable) {
		var hash = Url.parseQuery(location.search.substr(1));
		return variable in hash ? hash[variable] : false;
	},
	
	getQueryWord : function(variable){
		var query = document.location.search.substring(1);
		return query.search(variable) != -1;
	},
    
	randomNumber : function(){
		return Math.floor(Math.random() * 10000) + 1
	},
	
	scrollToMessage(id) {
		let message = $(`#m${id}`);
		let message_content = message.find('.mail__dialog_message');
		
		$('html, body').scrollTo(message, {position: 'center'});
		
		if ($.support.nativeAnim) {
			message_content.addClass('mail__dialog_message--is-new');
			setTimeout(() => {
				message_content.cssAnim('background', 'ease-out', 2000);
				message_content.removeClass('mail__dialog_message--is-new');
			}, 50);
		}
	},
	
	scrollDocument : function(to){
		if (to){
			var scrollToPosition = $(to).position().top;
			$("html, body").animate({scrollTop: scrollToPosition+"px"});
		}else{
			$("html, body").scrollTop(0);
		}
	},
    
    getApiParams: function (router) {
		var params = mailServices.getRouterParams();
		return {
			q: params.q.length ? params.q : undefined,
			Contact: params.contact,
			List: params.list,
			P: params.P
		};
	},
	
    getRouterParams: function (router) {
		var data = new Url(location.href).query;
		
		// Костыли
		data.P = data.P || 1;
		data.list = mail_params.list;
		data.contact = data.Contact;
		
		if (data.contact) {
			// Поиск сообщений
			data.q = $.trim($('#mail_messages_search .js-search__input').val() || "");
		} else {
			// Поиск контактов
			data.q = $.trim($('#mail_contacts_search .js-search__input').val() || "");
		}
		
		return data;
	},
    
	router: function (settings) {
		settings = settings || {};
		if (!settings.refresh) {
			page_loader._trigger('mailrequeststart');
			
			if (settings.fromHistory && Url.onlyHashChanged(HistoryManager.cur_url, HistoryManager.old_url)) {
				// Изменился только хэш!
				page_loader._trigger('mailrequestend');
				return;
			}
			
			mailServices.resetMsgQueue(true);
			mailCore.typingMonitor(false);
			checkOnline();
		}
		
		checkVoicePlayers();

		require.loaded(import.meta.id("./widgets/video"), ({VideoPlayer}) => {
			VideoPlayer.destroyDetached();
		});
		
		mail_send_message = false;
		mail_last_send = 0;
		
		newMessagesCnt = 0;
		checkedChekboxes = [];
		
		var data = mailServices.getRouterParams();
		if (data.contact) {
			mailCore.getMessages(data, settings);
		} else {
			mailCore.searchContacts(data, settings);
		}
		
		if (!settings.refresh)
			page_loader._trigger('mailrequestend');
	},
	
	freeBr : function(data){
		return $.trim(data).replace(/\<br \/\>/g," ").replace(/\<br\>/g," ").replace(/\<br\/\>/g," ");
	}
}

var mailTemplates = {
	contact_search_list : function (data, service_data) {
		var q = data.q, contacts = data.contacts,
			toggle_parts = $('#mail__tabs, #mail_pagination, #mail__lists_links, #mail__settings_link, #mail__contacts_buttons'),
			contacts_wrap = $('#contacts_wrapper'),
			search_pgn = $('#mail__search_pagination');
		
		if (q.length > 0) { // Поиск
			toggle_parts.hide();
			search_pgn.html(data.pagination || '');
		} else { // КЛ
			toggle_parts.show();
			search_pgn.empty();
			$('#mail_pagination').html(data.pagination || '');
		}
		
		if (contacts.length > 0) {
			contacts_wrap.html(contacts.join(''));
		} else {
			contacts_wrap.html('<div class="content-bl"> ' + 
				(q.length > 0 ? L('Контакты не найдены') : L('Список контактов пуст')) + 
			'</div>');
		}
		if (!q.length)
			mailServices.restoreCheckBoxes();
		if (!service_data.settings || !service_data.settings.refresh)
			mailServices.scrollDocument();
	},
	add_contacts: function(data) {
		var contacts = data.contacts,
			html = '';
		
		if ($('#mail_contact_empty').length > 0) {
			$('#mail_contact_empty').remove();
			$('#mail__contacts_buttons').show();
		}
		
		var html = '';
		$.each(contacts, function (id, v) {
			if (v) {
				$('#contact_' + id).remove();
				html += v;
			}
		});
		
		$('#contacts_wrapper').prepend(html).trigger('pagechanged');
		$('#mail_pagination').html(data.pagination || '');
		
		mailServices.restoreCheckBoxes();
		mailServices.contactsLengthChecker();
	},
	message_list: function (data, service_data) {
		var messages = data.messages,
			messages_list = $('#messages_list'),
			messages_empty = $(mail_params.search ? '#messages_list_search_empty' : '#messages_list_empty');
		
		messages_list.html(messages.join(''));
		if (messages.length > 0) {
			messages_empty.addClass('hide');
			messages_list.removeClass('hide');
		} else {
			messages_empty.removeClass('hide');
			messages_list.addClass('hide');
		}
		$('#mail_pagination').html(data.pagination || '');
		
		mailServices.fullMessageCheck();
		
		if (!service_data.settings || !service_data.settings.refresh)
			mailServices.scrollDocument();
	},
	loadNewMessages : function(data){
		var html = '<div class="links-group links-group_short content-bl__sep3 links-group_important" id="loadNewMessages"';

		if (data && data.url)
			html += ' data-url="'+data.url+'"';

		html +=
			'>' +
			'<a class="list-link list-link_single t_center triangle-show triangle-show_top" href="javascript: void();">+ ' + newMessagesCnt + " " + numeral(newMessagesCnt, [L('новое сообщение'), L('новых сообщения'), L('новых сообщений')]) + '</a>' +
			'</div>';
		return html;
	}
};

function saveOldAttaches(form) {
	let list = {}, tiles = {};
	form.find('.js-attaches__tile .js-attach_item').each((i, widget) => {
		tiles[widget.id] = widget;
	});
	form.find('.js-attaches__plain .js-attach_item').each((i, widget) => {
		list[widget.id] = widget;
	});
	return { tiles, list };
}

function getAttachesList(attaches) {
	let list = {}, tiles = {};
	if (attaches.list) {
		attaches.list.forEach((att) => {
			list[att.input_value] = att.widget;
		});
	}
	if (attaches.tile) {
		attaches.tile.forEach((att) => {
			tiles[att.input_value] = att.widget;
		});
	}
	return { list, tiles };
}

function invalidate_checkboxes() {
	$('#check_all_label').show();
	$('#mark_as_read_contacts').parent().parent().hide();
	
	var checkboxes = $('.js-mail_contact_checkbox');
	for (var i = 0; i < checkboxes.length; ++i)
		toggle_checkbox(checkboxes[i], false);
}

function toggle_checkbox(checkbox, invert) {
	const $checkbox = $(checkbox);
	const input = $checkbox.find('input')[0];
	if (invert)
		input.checked = !input.checked;

	const checked = !!input.checked;
	$checkbox.parents('.js-mail_contact').toggleClass('mail-contact--is-checked', checked);

	if (invert)
		$checkbox.trigger('mailCheckboxChange');
}

if (page_loader.ok()) {
	mailServices.init();
	page_loader.noCache(true);
}

invalidate_checkboxes();
$('#main').on('click', '.js-mail_contact_checkbox', function (e) {
	e.preventDefault();
	toggle_checkbox(this, true);
}).on('pagechanged', function () {
	invalidate_checkboxes();
});

// window.mailCore = mailCore;
// window.mailServices = mailServices;

//
});
