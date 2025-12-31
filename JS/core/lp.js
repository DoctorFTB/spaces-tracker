import {loadScript} from 'loader';
import {tick} from '../utils';
import * as jsonp from './lp/jsonp';

const POLL_TIMEOUT	= 30 * 1000;
const ALIVE_TIMEOUT = 60 * 1000;

const TYPES = {
	NOTIFICATION_SEND: 20,
	TOP_COUNTER_UPDATE: 21,
	REFRESH_WIDGETS: 26,
	COMM_COUNTER_UPDATE: 27,
	SETTINGS: 28,
	BIND_EMAIL_RESULT: 29,
	CHAT_SEND_MESSAGE: 32,
	CHAT_DELETE_MESSAGE: 33,
	FRIENDS_ONLINE_COUNTER_UPDATE: 54,

	// Конвертер
	VIDEO_CONVERT: 25,
	VIDEO_STORYBOARD: 60,

	// Почта
	MAIL_MESSAGE_RECEIVE: 1,
	MAIL_CONTACT_READ: 2,
	MAIL_CONTACT_SWAP: 4,
	MAIL_CONTACT_ERASE: 5,
	MAIL_CONTACT_ARCHIVE: 6,
	MAIL_CONTACT_SPAM: 7,
	MAIL_CLEAR_GARBAGE: 8,
	MAIL_MESSAGE_FAV: 9,
	MAIL_MESSAGE_SWAP: 10,
	MAIL_MESSAGE_ERASE: 11,
	MAIL_MESSAGE_EDIT: 12,
	MAIL_VOICE_LISTEN: 14,
	MAIL_TYPING: 24,
	MAIL_MESSAGE_SEND: 18,
	MAIL_TALK_MEMBER_ADD: 36,
	MAIL_TALK_MEMBER_DELETE: 37,
	MAIL_TALK_MEMBER_LEAVE: 38,
	MAIL_TALK_MEMBER_RETURN: 39,

	// Файлы
	LOADED_FILE: 34,

	// Статус онлайн
	STATUS_CHANGE: 35,

	// Камменты
	COMMENT_ADD: 40,
	COMMENT_DELETE: 41,

	// Карма
	KARMA_CHANGED: 42,

	// Смена версии
	DEVICE_TYPE_CHANGE: 44,

	// Разлогин
	LOGOUT: 30,

	// Обновление рекомендаций
	UOBJ_RECOMMENDATIONS_UPDATE: 45,

	// Обновление журнала
	UPDATE_JOURNAL: 50,

	// AI
	AI_PICTURE_GEN: 3,
	AI_GIFT_GEN: 13,
	AI_STICKER_GEN: 56,
	AI_PHOTO_STYLE: 57,
	AI_CHAT_MESSAGE: 58,
	BALANCE_UPDATE: 59,

	// Реакции
	USER_OBJECT_ADD_REACTION: 61,
	USER_OBJECT_DELETE_REACTION: 62,
	USER_OBJECT_VIEW_REACTION: 63,
};

let is_ready = false;
let handlers = {};
let is_disabled = false;
let errors_cnt = 0;
let last_success = 0;

let poll_timer;
let status_update_timer;

// Текущие состояние LP
let ready_state = false;

// Последнее принятое событие
let last_message_tag;
let last_message_time = (new Date(SPACES_SERVER_TIME)).toUTCString();
let last_message_event_id;
let last_request_id = 0;

// Очередь событий
let messages_queue = [];
let messages_queue_timer;

init();

function init() {
	if (!SPACES_PARAMS.lp || !SPACES_PARAMS.lp.ch)
		return;

	on('connecting', "_", () => {
		let now = new Date();
		console.log("[LP] start connecting, time: ", now.toUTCString());
	});

	on('connect', "_", () => {
		let now = new Date();
		console.log("[LP] connected, time: ", now.toUTCString());
	});

	on('disconnect', "_", () => {
		let now = new Date();
		if (is_disabled) {
			console.warn("[LP] disabled, time: ", now.toUTCString());
		} else {
			console.warn("[LP] disconnected, time: ", now.toUTCString());
		}
	});

	on('error', "_", (e) => {
		console.error("[LP] error: ", e.message);
	});

	waitWindowReady(() => {
		is_ready = true;
		poll();
	});

	window.addEventListener('beforeunload', () => {
		cancelLastPoll();
		is_ready = false;
	});
}

function setState(state) {
	if (ready_state != state) {
		ready_state = state;

		if (ready_state) {
			trigger('connect', [{first: Date.now() - SPACES_LOAD_START <= ALIVE_TIMEOUT}]);
		} else {
			trigger('disconnect', []);
		}
	}
}

function poll() {
	if (!is_ready)
		return;

	poll_timer = false;

	jsonp.request(getPollUrl(), pollSuccess, pollError, pollResponse, POLL_TIMEOUT + 2000);

	if (!ready_state) {
		if (errors_cnt > 0) {
			status_update_timer = setTimeout(() => setState(true), 1000);
		} else {
			setState(true);
		}
	}
}

function pollResponse(messages) {
	if (is_disabled)
		return;

	last_success = Date.now();

	for (let i = 0, l = messages.length; i < l; i++) {
		let message = messages[i];
		last_message_tag = message.tag;
		last_message_time = message.time;
		last_message_event_id = message.eventid;

		messages_queue.push(message.text);
	}

	if (!messages_queue_timer)
		resolveMessagesQueue();
}

function pollSuccess() {
	cancelDeferStatus();
	setState(true);

	last_success = Date.now();
	errors_cnt = 0;
	poll_timer = setTimeout(poll, 0);
}

function pollError(error_type, elapsed) {
	cancelDeferStatus();

	if (elapsed > POLL_TIMEOUT / 2) {
		// Игнорируем ошибку, если прошло более половины таймаута
		pollSuccess();
		return;
	}

	errors_cnt++;

	// Сбрасываем состояние LP, если последнее успешное подключение было слишком давно
	if (!last_success || Date.now() - last_success > POLL_TIMEOUT) {
		last_message_tag = false;
		last_message_time = false;
		last_message_event_id = false;
		setState(false);
	}

	poll_timer = setTimeout(poll, getErrorTimeout());
	trigger('error', [{message: error_type}]);
}

function cancelDeferStatus() {
	// Отменяем отложенное обновление статуса
	if (status_update_timer) {
		clearTimeout(status_update_timer);
		status_update_timer = false;
	}
}

function cancelLastPoll() {
	// Очищаем следующий запланированный поллинг
	if (poll_timer) {
		clearTimeout(poll_timer);
		poll_timer = false;
	}

	jsonp.clear(true);
}

function resolveMessagesQueue() {
	messages_queue_timer = false;

	let message = messages_queue.shift();
	if (messages_queue.length > 0)
		messages_queue_timer = tick(resolveMessagesQueue);

	//if (message.session_id && message.session_id != SPACES_PARAMS.sid)
	//	return;

	if (handlers.message) {
		for (let id in handlers.message)
			handlers.message[id](message);
	}
}

function getPollUrl() {
	let url =
		// base url
		location.protocol + '//' + SPACES_PARAMS.lp.host + '/lpex/' + SPACES_PARAMS.lp.ch +

		// jsonp callback
		"?callback=JSONP_CALLBACK" +

		// last event tag
		"&tag=" + encodeURIComponent(last_message_tag || "") +

		// last event id
		"&eventid=" + encodeURIComponent(last_message_event_id || "") +

		// last event time
		"&time=" + encodeURIComponent(last_message_time || "") +

		// Randomization
		"&_" + Date.now();

	return url;
}

function waitWindowReady(calllback) {
	if (document.readyState === "complete") {
		setTimeout(calllback, 0);
	} else {
		window.addEventListener('load', calllback, false);
	}
}

function disable() {
	is_disabled = true;
	cancelLastPoll();

	last_message_tag = false;
	last_message_time = false;
	last_message_event_id = false;

	setState(false);
	return this;
}

function enable() {
	is_disabled = false;
	cancelLastPoll();
	poll();
	return this;
}

function disabled() {
	return is_disabled;
}

function avail() {
	return ready_state;
}

function getErrorTimeout() {
	if (errors_cnt < 2) {
		return 150;
	} else {
		let random = Math.floor(Math.random() * 9000) + 1000;
		return Math.min(Math.pow(2, (errors_cnt - 2)) * 1000, 64000) + random;
	}
}

function on(event, id, callback) {
	handlers[event] = handlers[event] || {};
	handlers[event][id] = callback;
	return this;
}

function off(event, id) {
	if (event == '*') {
		for (let k in handlers) {
			if (handlers[k])
				delete handlers[k][id];
		}
	} else {
		if (handlers[event]) {
			if (id) {
				delete handlers[event][id];
			} else {
				delete handlers[event];
			}
		}
	}
	return this;
}

function callHandler(callback, args) {
	tick(() => callback.apply(null, args));
}

function trigger(event, args) {
	for (let id in handlers[event])
		callHandler(handlers[event][id], args);
}

export {on, off, avail, enable, disable, disabled, TYPES};
