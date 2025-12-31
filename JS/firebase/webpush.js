import module from 'module';
import $ from '../jquery';
import Spaces from '../spacesLib';
import page_loader from '../ajaxify';
import notifications from '../notifications';
import '../form_controls';

import "Common/Sticker.css";
import SPACES_PARAMS from '../core/env';

let WEB_PUSH = Spaces.params.web_push;
let messaging;
let firebase;
let serviceWorkerRegistration;

const tpl = {
	sticker: function () {
		var notify_checkboxes = '';
		
		$.each(WEB_PUSH.notifySettings, function (k, v) {
			notify_checkboxes +=
				'<div class="js-checkbox_wrap">' + 
					'<label class="form-checkbox square left_chb js-checkbox' + (v[2] ? ' form-checkbox_checked' : '') + '">' + 
						'<input class="js-webpush_settings form-checkbox__el" type="checkbox" value="' + v[0] + '" name="settings"' + (v[2] ? ' checked="checked"' : '') + ' />' + 
						v[1] + 
					'</label>' + 
				'</div>';
		});
		
		var html = '' + 
			'<div id="sticker" class="sticker">' + 
				'<a href="#" class="ico_buttons ico_buttons_close ico_no-mrg sticker-close js-webpush_cancel"></a>' + 
				'<div class="content-item3 wbg oh">' + 
					'Хотите получать уведомления о самом важном от &laquo;' + Spaces.params.Domain + '&raquo;?' + 
					'<div class="pad_t_a">' + 
						notify_checkboxes + 
					'</div>' + 
					'<small class="pad_t_a grey">' + 
						'Вы всегда сможете изменить это в <a href="' + WEB_PUSH.notifySettingsURL + '">Настройках</a>.' + 
					'</small>' + 
					'<div class="pad_t_a">' + 
						'<button class="btn btn_input js-webpush_accept" data-from="dialog">' + 
							'<span class="ico ico_spinner_white js-spinner hide"></span> ' + 
							'Включить уведомления' + 
						'</button> ' + 
						'<button class="btn btn_white btn_input js-webpush_cancel right sticker-close_btn">' + 
							'Нет' + 
						'</button> ' + 
					'</div>' + 
				'</div>' + 
			'</div>';
		return html;
	}
};

init();

module.on("componentpage", function () {
	if (!$('#firebase_request_webpush').length)
		return;
	
	if (!canWebPush()) {
		$('#webpush_enable_form').addClass('hide');
		$('#webpush_denied_form').addClass('hide');
		$('#webpush_unsupported_form').removeClass('hide');
		return;
	}
	
	// Скрываем стикер
	$('#sticker').remove();
	
	// Просим подписаться, если уведомления ещё не разрешены
	if (Notification.permission == 'default') {
		$('#webpush_enable_form').removeClass('hide');
	}
	// Если явно запрещены, выводим ошибку
	else if (Notification.permission == 'denied') {
		$('#webpush_enable_form').addClass('hide');
		$('#webpush_denied_form').removeClass('hide');
	}
	
	$('#main').on('click', '.js-webpush_accept', function (e) {
		e.preventDefault();
		
		var el = $(this);
		
		Spaces.LocalStorage.remove("fcm_token");
		
		var toggle_spinner = function (flag) {
			if (flag) {
				el.attr("disabled", "disabled");
			} else {
				el.removeAttr("disabled");
			}
			el.find('.js-spinner').toggleClass('hide', !flag);
		};
		
		toggle_spinner(true);
		
		Notification.requestPermission().then(function (permission) {
			try {
				if (Notification.permission !== permission)
					Notification.permission = permission;
			} catch (e) { }
			
			if (permission == 'granted') {
				firebaseInit(function () {
					fetchNewToken(function (success, error) {
						toggle_spinner(false);
						
						if (success) {
							page_loader.reload()
						} else {
							Spaces.showError("Ошибка подписки на уведомления. <br />" + error);
						}
					}, true);
				});
			} else {
				$('#webpush_enable_form').addClass('hide');
				$('#webpush_denied_form').removeClass('hide');
				
				toggle_spinner(false);
			}
		}).catch(function (err) {
			toggle_spinner(false);
			Spaces.showError("Ошибка подписки на уведомления. Попробуйте позже.");
			console.error('[FCM] requestPermission: ' + err);
		});
	});
});

function showDelayedSticker() {
	if (WEB_PUSH.dialogHidden)
		return;
	
	if (Spaces.params.newbie) {
		var callback = function () {
			if (Spaces.hits && Spaces.hits >= 10) {
				showSticker();
				page_loader.off('requestend', "web_push");
			} else {
				page_loader.on('requestend', "web_push", callback, true);
			}
		};
		callback();
	} else {
		showSticker();
	}
}

async function init() {
	if (!canWebPush())
		return;
	
	if (SPACES_PARAMS.sw) {
		try {
			serviceWorkerRegistration = await SPACES_PARAMS.sw;
		} catch (e) {
			console.error(`[sw]`, e);
		}
	}

	if (!WEB_PUSH.tokenExists)
		Spaces.LocalStorage.remove("fcm_token");
	
	if (Notification.permission == 'default') {
		showDelayedSticker();
	} else if (Notification.permission == 'granted') {
		firebaseInit(function () {
			fetchNewToken(function (success, error) {
				if (!success)
					showDelayedSticker();
			});
		});
	}
}

function canWebPush() {
	return window.Notification && window.Promise && navigator.serviceWorker && WEB_PUSH;
}

function showSticker() {
	Spaces.api("gcm.webPushDialogShow", {CK: null}, function (res) {
		if (res.code != 0)
			console.error('[FCM] send stat: ' + Spaces.apiError(res));
	}, {
		onError: function (err) {
			console.error('[FCM] send stat: ' + err);
		}
	});
	
	$('#sticker').remove();
	
	$('body').prepend(tpl.sticker());
	
	$('#sticker').on('click', '.js-webpush_cancel', function (e) {
		e.preventDefault();
		
		WEB_PUSH.dialogHidden = 1;
		
		Spaces.api("gcm.webPushDialogHide", {CK: null}, function (res) {
			if (res.code != 0) {
				console.error('[FCM] can\'t hide: ' + Spaces.apiError(res));
			}
		}, {
			onError: function (err) {
				console.error('[FCM] can\'t hide: ' + err);
			}
		});
		
		$('#sticker').remove();
	}).on('click', '.js-webpush_accept', function (e) {
		var el = $(this);
		
		e.preventDefault();
		
		$.each(WEB_PUSH.notifySettings, function (k, v) {
			WEB_PUSH.notifySettings[k][2] = +$('#sticker .js-webpush_settings[value="' + v[0] + '"]').prop("checked");
		});
		
		el
			.attr("disabled", "disabled")
			.find('.js-spinner').removeClass('hide');
		
		Notification.requestPermission().then(function (permission) {
			try {
				if (Notification.permission !== permission)
					Notification.permission = permission;
			} catch (e) { }
			
			$('#sticker').remove();
			
			if (permission == 'granted') {
				firebaseInit(function () {
					fetchNewToken(function (success, error) {
						if (!success)
							Spaces.showError("Ошибка подписки на уведомления. <br />" + error);
					}, true, el.data('from'));
				});
			}
		}).catch(function (err) {
			Spaces.showError("Ошибка подписки на уведомления. Попробуйте позже.");
			console.error('[FCM] requestPermission: ' + err);
		});
	});
}

function firebaseInit(callback) {
	if (messaging) {
		callback && callback();
		return;
	}
	
	import("../libs/firebase").then((_firebase) => {
		firebase = _firebase;
		
		firebase.initializeApp({
			apiKey:				WEB_PUSH.apiKey,
			authDomain:			WEB_PUSH.authDomain,
			databaseURL:		WEB_PUSH.databaseURL,
			projectId:			WEB_PUSH.projectId,
			storageBucket:		WEB_PUSH.storageBucket,
			messagingSenderId:	WEB_PUSH.messagingSenderId,
			appId:				WEB_PUSH.appId,
			measurementId:		WEB_PUSH.measurementId
		});
		
		messaging = firebase.getMessaging();

		if (SPACES_PARAMS.sw) {
			console.log('sw=', SPACES_PARAMS.sw);
		}
		
		firebase.onMessage(messaging, (payload) => {
			if (!notifications.isWindowActive()) {
				var notification = new Notification(payload.data.title, {
					body:		payload.data.body,
					icon:		payload.data.icon,
					tag:		payload.data.id,
					renotify:	true,
					data:		{
						link:	payload.data.link,
						type:	payload.data.type
					},
				});
				notification.onclick = function (event) {
					event.preventDefault();
					window.open(event.target.data.link, '_blank');
					notification.close();
					
					if (event.target.data.type !== undefined) {
						Spaces.api("common.androidNotificationGo", {Type: event.target.data.type}, function (res) {
							if (res.code != 0)
								console.error('[FCM] send stat: ' + Spaces.apiError(res));
						}, {
							onError: function (err) {
								console.error('[FCM] send stat: ' + err);
							}
						});
					}
				};
				
				if (payload.data.type !== undefined) {
					Spaces.api("common.androidNotificationShow", {Type: payload.data.type}, function (res) {
						if (res.code != 0)
							console.error('[FCM] send stat: ' + Spaces.apiError(res));
					}, {
						onError: function (err) {
							console.error('[FCM] send stat: ' + err);
						}
					});
				}
			}
		});
		
		callback && callback();
	});
}

function fetchNewToken(callback, force, from) {
	firebase.getToken(messaging, { vapidKey: WEB_PUSH.publicKey, serviceWorkerRegistration }).then((token) => {
		saveFcmToken(token, callback, force, from);
	}).catch(function (err) {
		// Если удалить SW через chrome://serviceworker-internals/, то сработает только на второй раз
		firebase.getToken(messaging, { vapidKey: WEB_PUSH.publicKey, serviceWorkerRegistration }).then((token) => {
			saveFcmToken(token, callback, force, from);
		}).catch(function (err) {
			console.error('[FCM] getToken: ' + err);
			callback && callback(false, err);
		});
	});
}

function saveFcmToken(token, callback, force, from) {
	var old_token = Spaces.LocalStorage.get("fcm_token");
	if (!old_token || old_token != (Spaces.sid() + ":" + token) || force) {
		var settings = [];
		$.each(WEB_PUSH.notifySettings, function (k, v) {
			if (v[2])
				settings.push(v[0]);
		});
		
		Spaces.api("gcm.addWebPushToken", {token: token, CK: null, SeTtings: settings, Force: force ? 1 : 0, from: from || ""}, function (res) {
			if (res.code != 0) {
				console.error('[FCM] can\'t save token: ' + Spaces.apiError(res));
				callback && callback(false, Spaces.apiError(res));
			} else {
				console.log("[FCM] new token: " + token);
				Spaces.LocalStorage.set("fcm_token", Spaces.sid() + ":" + token);
				callback && callback(true);
			}
		}, {
			onError: function (err) {
				console.error('[FCM] can\'t save token: ' + err);
				callback && callback(false, err);
			}
		});
	} else {
		callback && callback(true);
	}
}
