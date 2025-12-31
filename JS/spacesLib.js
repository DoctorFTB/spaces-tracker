import require from 'require';
import {loadPageStyles} from 'loader';
import $ from './jquery';
import cookie from './cookie';
import Device from './device';
import {Class} from './class';
import * as pushstream from './core/lp';
import config from './project/config';
import SpacesApp from './android/api';
import {L, tick, extend, ge, html_wrap, updateUrlScheme} from './utils';

var Spaces = {}, Url, Codes, FormState, API_ERRORS,	// extern
	SPACES_ACTIVITY_TIMEOUT = 60 * 1000,							// Через 60 секунд считаем таб неактивным
	RE_THUMB_CHANGE = /(\w+)\.(\d+)\.(\d+)/;

// Карта для распаковки расширеннй файловой инфы
var FILE_META_DECODE_MAP = [
	'#nid', '#type', 'gid', 'content', '#extType', 'parent', 'commentsLink',
	'preview', 'image', '#adult', 'resolution', 'download', '#gif', '#converted', 'listParams', 'image_2x', 'preview_2x'
];

const TAB_ID		= Date.now();
const MAX_API_RPS	= 6;

let last_api_call_time;
let last_api_call_cnt;

Spaces.referer = document.referer;

// For debug
window.Spaces = Spaces;

Codes = {
	COMMON: {
		code: 0,
		SUCCESS: 0,
		ERR_NEED_CAPTCHA: 1,
		ERR_UNKNOWN_METHOD: 2,
		ERR_USER_NOT_FOUND: 3,
		ERR_WRONG_CAPTCHA_CODE: 4,
		ERR_EMPTY_MESSAGE: 5,
		ERR_UNKNOWN_ERROR: 6,
		ERR_OFTEN_OPERATION: 7,
		ERR_WRONG_CK: 8,
		ERR_SMS_NOT_SEND: 9,
		ERR_UNKNOWN_ERROR_PLEASE_RETRY: 10,
		ERR_FORBIDDEN: 11,
		ERR_BAD_REQUEST: 12,
		ERR_NEED_CONFIRM_ACTION: 13,
		ERR_USER_IN_YOUR_BLACKLIST: 14,
		ERR_YOU_IN_USER_BLACKLIST: 15,
		ERR_MESSAGE_TOO_LONG: 16,
		ERR_MESSAGE_WITH_UNPAID_STICKERS: 17,
		ERR_GCM: 18,
		ERR_USER_ACT_PHONE_NOT_FOUND: 19,
		ERR_OBJECT_NOT_FOUND: 20,
		ERR_USER_IS_OWNER: 21,
		ERR_COMM_NOT_FOUND: 22,
		ERR_WRONG_EMAIL: 23,
		ERR_WRONG_PHONE: 24,
		ERR_USER_IS_BLOCKED: 25,
		ERR_USER_IS_FROZEN: 26,
		ERR_APP_NOT_FOUND: 27,
		ERR_WML: 28,
		ERR_ADULT_CONTENT: 29,
		ERR_SPAM_CONTROL: 30,
		ERR_WRONG_OWNER: 31,
		ERR_NOT_ENOUGH_KARMA: 32,
		ERR_SMALL_RATE: 33,
		ERR_URL_NOT_FOUND: 34,
		ERR_YOU_ARE_BANNED: 35,
		ERR_OBJECT_BLOCKED: 36,
		ERR_ALREADY_DONE: 37,
		ERR_CANCEL_CAPTCHA: 9999,
	},
	AUTH: {
		code: 1,
		ERR_AUTH_REQUIRED: 1001,
		ERR_EMPTY_LOGIN_OR_PASSWORD: 1002,
		ERR_WRONG_LOGIN_OR_PASSWORD: 1003,
		ERR_SESSION_NOT_FOUND: 1004,
		ERR_USER_MODEL_NOT_CONSTRUCTED: 1005,
		ERR_AUTH_ERROR: 1006,
		ERR_ALREADY_LOGGED_IN: 1007,
		ERR_ACTIVATION_REQUIRED: 1008,
		ERR_ACCOUNT_UNFREEZE: 1009
	},
	MAIL: {
		code: 2,
		ERR_CONTACT_NOT_FOUND: 2001,
		ERR_MESSAGE_ERROR: 2002,
		ERR_SPAM_CONTROL: 2003,
		ERR_GARBAGE_IS_CLEARING: 2005,
		ERR_CONTACT_IS_SWAPPING: 2006,
		ERR_MESSAGE_NOT_FOUND: 2007,
		ERR_WRONG_EMAIL_FORMAT: 2008,
		ERR_MESSAGE_SEND_DENIED: 2009,
		ERR_DUP_MESSAGE: 2010,
		ERR_WRONG_PHONE_FORMAT: 2011,
		ERR_TOO_LARGE_ATTACHES_WEIGHT: 2012,
		ERR_SPAMING_INNER_CONTACT: 2013,
		ERR_TALK_NOT_FOUND: 2014,
		ERR_TALK_MEMBER_NOT_FOUND: 2015
	},
	REG: {
		code: 3,
		ERR_WRONG_CONTACT: 3001,
		ERR_CONTACT_ALREADY_USED: 3002,
		ERR_CONTACT_ALREADY_REGISTERED: 3003,
		ERR_IP_LIMIT_EXCEEDED: 3004,
		ERR_DOMAIN_LIMIT_EXCEEDED: 3005,
		ERR_ACTIVATION_NOT_FOUND: 3006,
		ERR_RESTORE_TYPE_REQUIRED: 3007,
		ERR_WRONG_CODE: 3008
	},
	FRIENDS: {
		code: 4,
		ERR_HIS_LIMIT_EXCEEDED: 4001,
		ERR_YOUR_LIMIT_EXCEEDED: 4002,
		ERR_OFFER_EXISTS: 4003,
		ERR_ALREADY_FRIENDS: 4004,
		ERR_OFFER_BLOCKED: 4005,
		ERR_FRIEND_NOT_FOUND: 4006,
		ERR_PENDING_NOT_FOUND: 4007,
		ERR_FROM: 4008,
		ERR_EMAIL_USED: 4009,
		ERR_INVITE_EXISTS: 4010,
		ERR_OFFER_RESTRICTED: 4011,
		ERR_SYNC_DECLINED: 4012,
		ERR_SYNC_NOT_EXIST: 4013
	},
	CHAT: {
		code: 5,
		ERR_ATTACH_SEND_DENIED: 5001,
		ERR_ROOM_NOT_FOUND: 5002,
		ERR_CONTACT_DENIED: 5003,
		ERR_BANNED: 5004,
		ERR_NEWBIE: 5005,
		ERR_FORBIDDEN: 5006,
		ERR_SHUTUP: 5007,
		ERR_MESSAGE_PARAMS: 5008,
		ERR_SPAM: 5009,
		ERR_DUP_MESSAGE: 5010,
		ERR_COMPLAIN: 5011,
		ERR_MESSAGE_NOT_FOUND: 5012,
		ERR_USER_ISNT_FRIEND: 5013,
		ERR_SMILES_LIMIT_EXCEED: 5014
	},
	FORUM: {
		code: 6,
		ERR_COMMENT_NOT_FOUND: 6001,
		ERR_TOPIC_NOT_FOUND: 6002,
		ERR_FORUM_NOT_FOUND: 6003,
		ERR_FORUM_IN_GARBAGE: 6004,
		ERR_NEED_RULE_READ: 6005
	},
	TRASH: {
		code: 7,
		ERR_OBJ_DELETED: 7001,
		ERR_OBJ_RESTORED: 7002
	},
	VOTING: {
		code: 8,
		ERR_VOTE_NOT_FOUND: 8001,
		ERR_CANT_DISLIKE: 8002
	},
	FILES: {
		code: 9,
		ERR_DIR_ACCESS_DENIED: 9001,
		ERR_FILE_NOT_FOUND: 9002,
		ERR_RESOLUTION_NOT_AVAILABLE: 9003,
		ERR_WRONG_SIZE: 9004,
		ERR_BAD_VIDEO_CONVERTER_KEY: 9005,
		ERR_UPLOAD_ERROR: 9006,
		ERR_FILE_IS_BLOCKED: 9007,
		ERR_WRONG_TYPE: 9008,
		ERR_DIR_NOT_FOUND: 9009,
		ERR_WRONG_TEMP_ID: 9010,
		ERR_STRANGER_FILE: 9011,
		ERR_EDIT: 9012,
		ERR_CANT_LOAD_PIC: 9013,
		ERR_CANT_LOAD_LINK: 9014,
		ERR_COLLECTION_NOT_FOUND: 9015,
		ERR_YOUR_FILE: 9016,
		ERR_YOUR_COLLECTION: 9017,
		ERR_NOT_CONVERTED: 9018
	},
	SEARCH: {
		code: 10,
		ERR_BAD_QUERY: 10001
	},
	LENTA: {
		code: 11,
		ERR_SUBSCR_NOT_FOUND: 11001,
		ERR_AUTHOR_IS_PRIVATE_GROUP: 11002,
		ERR_SUBSCR_ALREADY_EXISTS: 11003
	},
	GIFTS: {
		code: 12,
		ERR_GIFT_NOT_FOUND: 12001
	},
	SERVICES: {
		code: 13,
		ERR_COUNTRY_NOT_FOUND: 13001,
		ERR_REGION_NOT_FOUND: 13002,
		ERR_CITY_NOT_FOUND: 13003,
		ERR_UNIVERSITY_NOT_FOUND: 13004,
		ERR_FACULTY_NOT_FOUND: 13005,
		ERR_MOBILE_BRAND_NOT_FOUND: 13006,
		ERR_GHOST_NOT_FOUND: 13007,
		ERR_GHOST_UNCHANGED: 13008,
		ERR_NOT_ENOUGH_MONEY: 13009,
	},
	COMPLAINTS: {
		code: 14,
		ERR_WRONG_TYPE: 14001,
		ERR_WRONG_REASON: 14002,
		ERR_COMPLAIN_DENIED: 14003,
		ERR_COMPLAINTS_EXIST: 14004,
		ERR_TIME_EXCEED: 14005,
		ERR_CNT_EXCEED: 14006
	},
	BLACKLIST: {
		code: 15,
		ERR_WRONG_TYPE: 15001,
		ERR_OBJECT_NOT_FOUND: 15002,
		ERR_SPAM_CONTROL: 15003
	},
	POLLS: {
		code: 16,
		ERR_POLL_EXIST: 16001,
		ERR_ACCESS_DENIED: 16002,
		ERR_WRONG_OWNER: 16003,
		ERR_WRONG_END_TIME: 16004,
		ERR_WRONG_VARIANT: 16005,
		ERR_VARIANTS_CNT: 16006,
		ERR_POLL_ISNT_VALIDATE: 16007,
		ERR_POLL_NOT_FOUND: 16008,
		ERR_SMALL_RATE: 16009,
		ALREADY_VOTED: 16010,
		ERR_VOTING: 16011
	},
	ATTACHES: {
		code: 17,
		ERR_ATTACH_NOT_FOUND: 17001,
		ERR_TYPE_ISNT_SUPPORTED: 17002,
		ERR_PARENT_NOT_FOUND: 17003,
		ERR_ATTACH_ALREADY_EXIST: 17004,
		ERR_WRONG_OWNER: 17005,
		ERR_MAX_COUNT: 17006,
		ERR_CHECK_ATTACH: 17007
	},
	COMM: {
		code: 18,
		ERR_BLOCKED: 18001,
		ERR_ACCESS_DENIED: 18002
	},
	COMMENTS: {
		code: 19,
		ERR_INVALID: 19001,
		ERR_NOT_FOUND: 19002,
		ERR_EDIT_TIME: 19003
	},
	JOURNAL: {
		code: 20,
		ERR_RECORD_NOT_FOUND: 20001
	}
};

// Статические ошибки API
API_ERRORS = {
	// COMMON
	[Codes.COMMON.ERR_USER_NOT_FOUND]: L("Пользователь не найден"),
	[Codes.COMMON.ERR_WRONG_CAPTCHA_CODE]: L("Неверный код с картинки"),
	[Codes.COMMON.ERR_NEED_CAPTCHA]: L("Неверный код с картинки"),
	[Codes.COMMON.ERR_CANCEL_CAPTCHA]: L("Не введён код с картинки, действие отменено."),
	[Codes.COMMON.ERR_EMPTY_MESSAGE]: L("Пустое сообщение"),
	[Codes.COMMON.ERR_OFTEN_OPERATION]: L("Слишком частая операция"),
	[Codes.COMMON.ERR_SMS_NOT_SEND]: L("SMS не было отправлено"),
	[Codes.COMMON.ERR_UNKNOWN_ERROR_PLEASE_RETRY]: L("Неизвестная ошибка, повторите"),
	[Codes.COMMON.ERR_FORBIDDEN]: L("Доступ запрещён"),
	[Codes.COMMON.ERR_BAD_REQUEST]: L("Ошибка в параметрах API"),
	[Codes.COMMON.ERR_NEED_CONFIRM_ACTION]: L("Нужно подтверждение регистрации"),
	[Codes.COMMON.ERR_USER_IN_YOUR_BLACKLIST]: L("Пользователь находится в вашем чёрном списке"),
	[Codes.COMMON.ERR_YOU_IN_USER_BLACKLIST]: L("Вы находитесь в чёрном списке обитателя"),
	[Codes.COMMON.ERR_MESSAGE_TOO_LONG]: L("Слишком длинное сообщение"),
	[Codes.COMMON.ERR_MESSAGE_WITH_UNPAID_STICKERS]: L("В сообщении использованы неоплаченные стикеры"),
	[Codes.COMMON.ERR_USER_ACT_PHONE_NOT_FOUND]: L("Не найден телефон обитателя"),
	[Codes.COMMON.ERR_OBJECT_NOT_FOUND]: L("Объект не найден"),
	[Codes.COMMON.ERR_USER_IS_OWNER]: L("Пользователь - владелец объекта"), // и чо?
	[Codes.COMMON.ERR_COMM_NOT_FOUND]: L("Сообщество не найдено"),
	[Codes.COMMON.ERR_WRONG_EMAIL]: L("Неправильный e-mail"),
	[Codes.COMMON.ERR_FREQ_LIMITER]: L("Слишком частая операция. Подождите немного и попробуйте снова."),
	[Codes.COMMON.ERR_WRONG_PHONE]: L("Неправильный номер телефона"),
	[Codes.COMMON.ERR_USER_IS_BLOCKED]: L("Пользователь заблокирован"),
	[Codes.COMMON.ERR_APP_NOT_FOUND]: L("Игра не найдена"),
	[Codes.COMMON.ERR_USER_IS_FROZEN]: L("Пользователь удалён"),
	[Codes.COMMON.ERR_YOU_ARE_BANNED]: L("Действие недоступно до истечения срока бана"),

	// AUTH
	[Codes.AUTH.ERR_EMPTY_LOGIN_OR_PASSWORD]: L("Пустой логин или пароль"),
	[Codes.AUTH.ERR_WRONG_LOGIN_OR_PASSWORD]: L("Неверный логин или пароль"),

	// MAIL
	[Codes.MAIL.ERR_CONTACT_NOT_FOUND]: L("Контакт не найден"),
	[Codes.MAIL.ERR_SPAM_CONTROL]: L("Сработала защита от СПАМа"),
	[Codes.MAIL.ERR_ADMIN_SEND_DENIED]: L("Извините, но у администрации нет возможности читать все письма обитателей. Мы просто не успеваем это делать."),
	[Codes.MAIL.ERR_GARBAGE_IS_CLEARING]: L("Происходит очистка корзины"),
	[Codes.MAIL.ERR_CONTACT_IS_SWAPPING]: L("Происходит перенос контакта"),
	[Codes.MAIL.ERR_MESSAGE_NOT_FOUND]: L("Сообщение не найдено"),
	[Codes.MAIL.ERR_WRONG_EMAIL_FORMAT]: L("Неверный формат E-mail"),
	[Codes.MAIL.ERR_DUP_MESSAGE]: L("Вы только что отправили такое же сообщение"),
	[Codes.MAIL.ERR_WRONG_PHONE_FORMAT]: L("Неверный формат телефона"),
	[Codes.MAIL.ERR_TOO_LARGE_ATTACHES_WEIGHT]: L("Суммарный размер вложений не может превышать 10Мб"),
	[Codes.MAIL.ERR_SPAMING_INNER_CONTACT]: L('В СПАМ можно отправлять только E-mail контакты.'),

	// FRIENDS
	[Codes.FRIENDS.ERR_HIS_LIMIT_EXCEEDED]: L("У пользователя превышен лимит на количество друзей."),
	[Codes.FRIENDS.ERR_YOUR_LIMIT_EXCEEDED]: L("У вас превышен лимит на количество друзей."),
	[Codes.FRIENDS.ERR_OFFER_EXISTS]: L("Вы уже отправили предложение"),
	[Codes.FRIENDS.ERR_ALREADY_FRIENDS]: L("Вы уже друзья"),
	[Codes.FRIENDS.ERR_OFFER_BLOCKED]: L("Пользователь установил запрет на предложения дружбы."),
	[Codes.FRIENDS.ERR_FRIEND_NOT_FOUND]: L("Пользователь не является другом"),
	[Codes.FRIENDS.ERR_PENDING_NOT_FOUND]: L("Запрос на предложение дружбы не найден"),
	[Codes.FRIENDS.ERR_INVITE_EXISTS]: L("Приглашение уже отправлено"),

	// CHAT
	[Codes.CHAT.ERR_ATTACH_SEND_DENIED]: L("Запрет на отправку аттачей"),
	[Codes.CHAT.ERR_ROOM_NOT_FOUND]: L("Комната не найдена"),
	[Codes.CHAT.ERR_CONTACT_DENIED]: L("Контакт запрещён"),
	[Codes.CHAT.ERR_BANNED]: L("Вы забанены"),
	[Codes.CHAT.ERR_NEWBIE]: L("Вы провели слишком мало времени на сайте"),
	[Codes.CHAT.ERR_FORBIDDEN]: L("У вас нет доступа к этой комнате"),
	[Codes.CHAT.ERR_SHUTUP]: L("Вы временно не можете оставлять сообщения в данной комнате"),
	[Codes.CHAT.ERR_MESSAGE_PARAMS]: L("Неправильные параметры отправки сообщения"),
	[Codes.CHAT.ERR_SPAM]: L("Зашита от СПАМа! Ссылки на другие ресурсы запрещены!"),
	[Codes.CHAT.ERR_DUP_MESSAGE]: L("Вы уже добавили такое же сообщение только что"),
	[Codes.CHAT.ERR_MESSAGE_NOT_FOUND]: L("Сообщение не найдено"),
	[Codes.CHAT.ERR_USER_ISNT_FRIEND]: L("Один из выбранных пользователей не является вашим другом!"),

	// FORUM
	[Codes.FORUM.ERR_COMMENT_NOT_FOUND]: L("Комментарий не найден"),
	[Codes.FORUM.ERR_TOPIC_NOT_FOUND]: L("Тема не найдена."),
	[Codes.FORUM.ERR_FORUM_IN_GARBAGE]: L("Тема находится в корзине."),

	// FRIENDS
	[Codes.FRIENDS.ERR_FROM]: L("Подпись заполнена неверно"),
	[Codes.FRIENDS.ERR_EMAIL_USED]: L("Почта, на которую отправлено приглашение, уже использована"),

	// TRASH
	[Codes.TRASH.ERR_OBJ_DELETED]: L("Объект уже удалён"),
	[Codes.TRASH.ERR_OBJ_RESTORED]: L("Объект уже восстановлен"),

	// VOTING
	[Codes.VOTING.ERR_VOTE_NOT_FOUND]: L("Голос не найден"),

	// FILES
	[Codes.FILES.ERR_DIR_ACCESS_DENIED]: L("Доступ к папке запрещён"),
	[Codes.FILES.ERR_FILE_NOT_FOUND]: L("Файл не найден"),
	[Codes.FILES.ERR_WRONG_SIZE]: L("Неправильное значение размера"), // wtf??
	[Codes.FILES.ERR_COLLECTION_NOT_FOUND]: L("Коллекция не найдена"),
	[Codes.FILES.ERR_CANT_LOAD_PIC]: L("Ссылка не содержит поддерживаемых файлов."),
	[Codes.FILES.ERR_CANT_LOAD_LINK]: L("Ссылка не содержит поддерживаемых файлов."),

	// LENTA
	[Codes.LENTA.ERR_SUBSCR_NOT_FOUND]: L("Подписка не найдена"),
	[Codes.LENTA.ERR_AUTHOR_IS_PRIVATE_GROUP]: L("Автор - секретная группа"),
	[Codes.LENTA.ERR_SUBSCR_ALREADY_EXISTS]: L("Подписка уже существует"),

	// GIFTS
	[Codes.GIFTS.ERR_GIFT_NOT_FOUND]: L("Подарок не найден"),

	// COMPLAINTS
	[Codes.COMPLAINTS.ERR_WRONG_TYPE]: L("Неверный тип"),
	[Codes.COMPLAINTS.ERR_WRONG_REASON]: L("Неверная причина"),
	[Codes.COMPLAINTS.ERR_COMPLAIN_DENIED]: L("В течение недели вы не сможете подавать жалобы, так как модераторы решили, что вы подаете необоснованные жалобы"),
	[Codes.COMPLAINTS.ERR_COMPLAINTS_EXIST]: L("От вас было принято слишком большое кол-во жалоб за короткое время"),

	// BLACKLIST
	[Codes.BLACKLIST.ERR_WRONG_TYPE]: L("Неверный тип объекта, из-за которого пользователь попадает в ЧС"),
	[Codes.BLACKLIST.ERR_OBJECT_NOT_FOUND]: L("Объект не найден"),

	// SERVICES
	[Codes.SERVICES.ERR_COUNTRY_NOT_FOUND]: L("Страна не найдена"),
	[Codes.SERVICES.ERR_REGION_NOT_FOUND]: L("Регион не найден"),
	[Codes.SERVICES.ERR_CITY_NOT_FOUND]: L("Город не найден"),
	[Codes.SERVICES.ERR_UNIVERSITY_NOT_FOUND]: L("Университет не найден"),
	[Codes.SERVICES.ERR_FACULTY_NOT_FOUND]: L("Факультет не найден"),
	[Codes.SERVICES.ERR_MOBILE_BRAND_NOT_FOUND]: L("Бренд не найден"),
	[Codes.SERVICES.ERR_NOT_ENOUGH_MONEY]: L('На вашем счёте недостаточно монет. <a href="/payment/" target="_blank" rel="noopener">Пополнить</a>.'),

	// ATTACHES
	[Codes.ATTACHES.ERR_ATTACH_NOT_FOUND]: L("Файл, который вы прикрепляете, не найден. "),
	[Codes.ATTACHES.ERR_PARENT_NOT_FOUND]: L("Топик, к комментарию которого вы прикрепляете файл, был удалён."),
	[Codes.ATTACHES.ERR_WRONG_OWNER]: L("Объект, к которому вы прикрепляете файл, был удалён."),
	[Codes.ATTACHES.ERR_MAX_COUNT]: L("Превышен лимит аттачей."),
	[Codes.ATTACHES.ERR_CHECK_ATTACH]: L("Нет доступа к файлу."),

	// ERR_NOT_FOUND.ERR_NOT_FOUND
	[Codes.COMMENTS.ERR_NOT_FOUND]: L("Комментарий, на который вы отвечаете, был удалён.")
};

extend(Spaces, {
	api_cache: {}, cache: {}, global: {},
	setTimeout: setTimeout, setInterval: setInterval,

	lastActivity: Date.now(),
	windowActive: true,

	SIDEBAR: {
		MIN_WIDTH: 900
	},

	AUTH_ERRORS: {
		1: L("Дуп сессии"),
		2: L("Невалидная кука песка"),
		3: L("Слишком быстрые запросы"),
		4: L("Ваш аккаунт заблокирован"),
		5: L("Ошибка XSRF"),
		6: L("Дубль запроса. "),
		7: L("Нужны последние цифры номера"),
		8: L("Нужна капча")
	},

	KEYS: {
		ESC: 27,
		PGDOWN: 34,
		PGUP: 33,
		HOME: 36,
		END: 35,
		UP: 38,
		DOWN: 40,
		RIGHT: 39,
		LEFT: 37,
		ENTER: 10,
		MAC_ENTER: 13,
		ALT: 18
	},

	PREVIEW: {
		SIZE_81_80: 14
	},

	SHOW_PREVIEW_RE: /^(gif|jpg|jpeg|png|bmp|avi|mpg|mp4|m4v|mpeg|asf|wmv|3gp|3gpp|flv|mov|wevm)$/i,
	TYPES: {
		FILE:				5,
		MUSIC:				6,
		PICTURE:			7,
		FORUM_TOPIC:		8,
		DIARY_TOPIC:		9,
		COMM:				10,
		USER:				11,
		MAIL_MSG:			19,
		VIDEO:				25,
		COMM_DIARY_TOPIC:	49,
		MAIL_TALK:			79,
		EXTERNAL_VIDEO:		82
	},
	FILES_LIST: {
		DIRS: 1,
		FILES: 2,

		NEW_FILES: 4,
		POPULAR_ALLTIME: 5,
		POPUlAR_NOW: 6,
		POPULAR_MONTH: 14,

		FILES_SORT_POPULAR: 7,
		FILES_ALL: 23
	},
	RENDER_MODE: {
		PREVIEW: -1,
		TILE: -4,
		CAROUSEL: -8
	},
	WIDGETS: {
		HEADER: 1,
		SIDEBAR: 2,
		FOOTER: 4,
		CSS: 8,
		RIGHTBAR :16
	},
	SettingsTypes: {
		SOUND_NOTIFY_BLOCK: 1,
		FORM_SUBMIT_KEY: 2,
		// FONT_SIZE: 3,
		USER_NAME: 4,
		AVATAR: 5,
		THEME: 7
	},
	LIMIT: {
		ATTACHES: 3
	},
	ExternalVideo: {
		YOUTUBE: 1
	},

	CK: function () {
		return Spaces.params.CK;
	},

	tabId() {
		return TAB_ID;
	},

	userId() {
		return Spaces.params.nid;
	},

	// Инициализация
	init: function () {
		Spaces.params = window.SPACES_PARAMS;

		tick(function () {
			// Перманентные для сессии модули
			var modules = Spaces.persistModules();
			for (let i = 0, l = modules.length; i < l; i++) {
				console.log('load persist module: ' + modules[i]);
				require.component(modules[i]);
			}
		});

		tick(function () {
			var body = $('body');
			body.on('click.form_submit', 'input[type="submit"], button', function (e) {
				if (this.form) {
					this.form.submit_btn = this;
				} else {
					var form = $(this).parents('form')[0];
					if (form) {
						this.form = form;
						form.submit_btn = this;
					}
				}
			//}).on('click', '.js-pagenav_toggle', function (e) {
			//	e.preventDefault();
			//	var el = $(this), pgn = el.parents('.pgn');
			//	pgn.find('.table__nums').toggleClass('hide');
			//	el.toggleClass('pgn__button_press');
			//	el.children().toggleClass('pgn__link_hover');
			}).on('click mouseup', function () {
				Spaces.lastActivity = Date.now();
			}).on('blurwindow', function () {
				Spaces.windowActive = false;
			}).on('focuswindow', function () {
				Spaces.windowActive = true;
			});
		});
	},

	// API
	api_req_cnt: 1,
	api_requests: {},
	cancelApi: function (rid) {
		var request = Spaces.api_requests[rid];
		if (request) {
			Spaces.api_requests[rid] = false;
			request.abort && request.abort();
		}
	},
	async asyncApi(method, params, opts) {
		return new Promise((resolve) => {
			Spaces.api(method, params, resolve, {
				...opts,
				onError(error) {
					resolve({
						code: Codes.COMMON.ERR_UNKNOWN_ERROR,
						error
					});
				}
			});
		});
	},
	api(method, params, callback, opts) {
		params = params || {};
		opts = extend({
			cache: false,
			cacheTime: false,
			disableChecks: false,
			disableCaptcha: false,
			disableFreqLimitRetry: false,
			GET: {},
			_rid: Spaces.api_req_cnt++
		}, opts);

		var api_url;
		if (method.indexOf('/') == 0 || method.indexOf('http') == 0) {
			api_url = method;
		} else {
			if (params.method && method.indexOf('.') < 0) {
				method = method.split('.')[0] + "." + params.method;
				delete params.method;
			}

			api_url = "/api/" + method.replace(/\./g, '/') + "/";

			var get_params = opts.GET || {};
			if (!opts.cache) {
				// Если URL совпадает, то UCWEB начинает путать данные для отправки
				get_params._ = Spaces.api_req_cnt;
			}

			api_url += Url.buildQuery(get_params, "&", "?");
		}

		// Костыль для извращенцев, которые отключают cookies
		if (document.cookie.indexOf('sid=') < 0)
			params.sid = Spaces.sid();

		params._origin = location.protocol + "//" + location.host

		if (('CK' in params))
			params.CK = Spaces.CK();

		var raw_data = Url.buildQuery(params);
		var from_cache = false;

		var api_params = {method: method, params: params, callback: callback, opts: opts};

		let elapsed = Date.now() - last_api_call_time;
		if (elapsed < 1000) {
			if (last_api_call_cnt > MAX_API_RPS) {
				Spaces.api_requests[opts._rid] = {};

				setTimeout(() => {
					if (!Spaces.api_requests[opts._rid])
						return;

					Spaces.api(method, params, callback, opts);
				}, 1000 - elapsed);

				return opts._rid;
			} else {
				last_api_call_cnt++;
			}
		} else {
			last_api_call_time = Date.now();
			last_api_call_cnt = 0;
		}

		var xhr_callback = function (data) {
			opts.captchaCallback && opts.captchaCallback();

			if (typeof data != "object") {
				if (typeof data == "string") {
					try {
						data = $.parseJSON(data);
					} catch (e) { data = null; }
				}
				if (!data) {
					Spaces.defaultAjaxErrorCallback({
						status: -666
					}, api_params);
					return;
				}
			}

			if (!Spaces.api_requests[opts._rid]) // Отменённый запрос
				return;

			if (opts.cache && !from_cache) {
				// Закэшируем
				Spaces.api_cache[method + "?" + raw_data] = {
					data: data,
					time: Date.now(),
					expire: opts.cacheTime * 1000
				}
			}

			// console.log("result " + method + ":\n", JSON.stringify(data));
			if (Spaces.defaultAjaxCallback(data, api_params)) {
				delete Spaces.api_requests[opts._rid];
				callback && callback(data, api_params);
			}
		}

		if (opts.cache) {
			var cached = Spaces.api_cache[method + "?" + raw_data];
			if (cached && cached.data && (!cached.expire || Date.now() - cached.time < cached.expire)) {
				from_cache = true;
				Spaces.api_requests[opts._rid] = {};
				xhr_callback(cached.data);
				return opts._rid;
			}
		}

		var headers = {};
		if (!Spaces.windowActive || Date.now() - Spaces.lastActivity > SPACES_ACTIVITY_TIMEOUT)
			headers["X-Unactive-Tab"] = 1;

		if (opts._response) {
			xhr_callback(opts._response);
			return opts._rid;
		}

		Spaces.api_requests[opts._rid] = $.ajax(api_url, {
			method: "POST",
			headers: {},
			data: raw_data,
			// dataType: "json",
			headers: headers
		}).success(xhr_callback).fail(function (err) {
			opts.captchaCallback && opts.captchaCallback();
			Spaces.defaultAjaxErrorCallback(err, api_params);
		});
		return opts._rid;
	},
	defaultAjaxCallback: function (res, api_params) {
		if (res.code !== undefined) {
			res.$code = res.code;
			res.code = parseInt(res.code, 10);

			if (res.t > 0.5)
				console.warn(api_params.method + " (" + res.t + " s)\n" + Url.buildQuery(api_params.params));
		}

		if (res.code != 0) {
			console.error("[API ERROR] " + api_params.method + ": " + Spaces.apiError(res));
		}

		if (!api_params.opts.disableChecks) {
			let need_reload = false;

			// Почему-то CK перестал подходить... перезагрузим страницу, на всякий случай
			if (res.code == Codes.COMMON.ERR_WRONG_CK)
				need_reload = true;

			if (res.code == Codes.AUTH.ERR_AUTH_ERROR && res.auth_errror != 3) {
				need_reload = true;

				// Нет смысла перезагружать страницу, UI для ввода 4-х цифр уже показан
				if (res.auth_errror == 7 && (Spaces.params.last_phone_digit_required || $('#global_phone_require_ui').length))
					need_reload = false;

				// Нет смысла перезагружать страницу, UI для ввода капчи уже показан
				if (res.auth_errror == 8 && $('#global_captcha_require_ui').length)
					need_reload = false;
			}

			// Полная перезагрузка страницы
			if (need_reload) {
				console.error("Froce reload page: " + Spaces.apiError(res));
				location.reload();
				return false;
			}
		}

		// Слишком быстрые запросы
		if (!api_params.opts.disableFreqLimitRetry && res.code == Codes.AUTH.ERR_AUTH_ERROR && res.auth_errror == 3) {
			setTimeout(() => {
				api_params.opts.disableFreqLimitRetry = true;
				Spaces.api(api_params.method, api_params.params, api_params.callback, api_params.opts);
			}, 1000);
			return;
		}

		// Нужна капча
		if (!api_params.opts.disableCaptcha && (res.code == Codes.COMMON.ERR_NEED_CAPTCHA || res.code == Codes.COMMON.ERR_WRONG_CAPTCHA_CODE)) {
			console.log('[captcha] req_id=' + api_params.opts._rid);
			import("./global_captcha").then(function ({showGlobalCaptcha}) {
				if (!Spaces.api_requests[api_params.opts._rid])
					return;

				var error;
				if (res.code == Codes.COMMON.ERR_WRONG_CAPTCHA_CODE)
					error = Spaces.apiError(res);

				showGlobalCaptcha(api_params.opts._rid, res.captcha_url, function (code, captcha_callback) {
					if (!Spaces.api_requests[api_params.opts._rid])
						return;

					if (code === false) {
						api_params.opts.captchaCallback = false;
						api_params.opts.disableCaptcha = true;
						api_params.opts._response = res;

						res.code = Codes.COMMON.ERR_CANCEL_CAPTCHA;

						Spaces.api(api_params.method, api_params.params, api_params.callback, api_params.opts);
						return;
					}

					api_params.opts.captchaCallback = captcha_callback;
					api_params.params.image_code = code;
					api_params.params.captcha_code = code;

					Spaces.api(api_params.method, api_params.params, api_params.callback, api_params.opts);
				}, error);
			});
			return false;
		}

		if (res.css_files && res.css_files.length)
			loadPageStyles(res.css_files);

		return true;
	},
	defaultAjaxErrorCallback: function (err, api_params) {
		if (!Spaces.api_requests[api_params.opts._rid])
			return;
		console.error("[API ERROR] " + api_params.method + ": " + err.status);
		if (api_params.opts.retry && err.status == 0) {
			--api_params.opts.retry;
			setTimeout(function () {
				Spaces.api(api_params.method, api_params.params, api_params.callback, api_params.opts);
			}, 1000);
			return;
		}
		delete Spaces.api_requests[api_params.opts._rid];

		if (api_params.opts.onError)
			api_params.opts.onError(Spaces.getHttpError(err.status));
	},
	apiError: function (data, custom_errors) {
		if (data.http_error)
			 return Spaces.getHttpError(data.http_error);

		if (data.error)
		    return data.error;

		if (data.auth_errror && Spaces.AUTH_ERRORS[data.auth_errror])
			return Spaces.AUTH_ERRORS[data.auth_errror];

		var code = parseInt(data.code, 10);
		if (custom_errors && custom_errors[code])
			return custom_errors[code];
		if (API_ERRORS[code])
			return API_ERRORS[code];

		// Динамические ошибки
		switch (code) {
			case Codes.COMMON.ERR_NOT_ENOUGH_KARMA:
				return data.message || L("Недостаточно кармы.");
			case Codes.COMMON.ERR_WML:
			case Codes.COMMON.ERR_UNKNOWN_ERROR:
				return data.message || L("Неизвестная ошибка");
			case Codes.AUTH.ERR_AUTH_ERROR:
				return Spaces.AUTH_ERRORS[data.auth_errror] || L("Ошибка авторизации #{0}", data.auth_errror);
			case Codes.AUTH.ERR_ACTIVATION_REQUIRED:
				return L("Извините, вы не можете {0}, пока не {2}подтвердите свой аккаунт{3}. " +
					"Если у вас возникли проблемы с подтверждением аккаунта, обратитесь в {1}.", data.action || "это сделать",
					'<a href="' + config.support.addr + '">' + config.support.name + '</a>',
					'<a href="' + Spaces.getActivationLink() + '">', '</a>');
			case Codes.MAIL.ERR_MESSAGE_ERROR:
				return data.message;
			case Codes.MAIL.ERR_MESSAGE_SEND_DENIED:
				return data.can_write_error.message;
			case Codes.FILES.ERR_UPLOAD_ERROR:
				if (data.httpCode)
					return Spaces.getHttpError(data.httpCode);
				return data.errMsg ? data.errMsg : L("Ошибка загрузки файла");
			default:
				for (var section in Codes) {
					var section_codes = Codes[section];
					if (section_codes) {
						for (var k in section_codes) {
							if (k !== "code" && +section_codes[k] === +data.code)
								return section + "." + k + " (" + (data.$code || data.code) + ")";
						}
					}
				}
				return L("Неизвестная ошибка #{0}", (data.$code || data.code));
		}
	},
	getHttpError: function (code) {
		code = parseInt(code);
		switch (code) {
			case 501: case 502: case 503: case 504:
				return L('Внимание! На {0} в данный момент проводятся технические работы!<br />' +
							'Подождите несколько секунд и повторите попытку. ', Spaces.params.Domain) +
					(code == 502 && !!ge('#sandbox_indicator') ?
						"<br />(" + L("Возможно, перезагрузка песочницы") + ")<br />" : "");
			case -666:
				return L('Неверный ответ API. ');

			case 500: case 525:
				return L(
					'Внимание! При выполнении вашего запроса, произошла внутренняя ошибка сервера!<br />' +
					'Попробуйте сейчас обновить страницу, и, если ошибка повторяется, немедленно сообщите об этом в {0} {1}<br />' +
					'Опишите подробно, где произошла данная ошибка, в какой момент, и что нужно сделать для того, чтобы повторить данную ошибку. <br />' +
					'Спасибо вам за помощь в нахождении ошибок на сайте!<br />',
					config.support.what,
					'<a href="' + config.support.addr + '">' + config.support.name + '</a>'
				);

			case -500:
				return L(
					'Внимание! При выполнении вашего запроса, сервер ответил неожиданным ответом!<br />' +
					'Попробуйте сейчас обновить страницу, и, если ошибка повторяется, немедленно сообщите об этом в сообществе {0} {1}<br />' +
					'Опишите подробно, где произошла данная ошибка, в какой момент, и что нужно сделать для того, чтобы повторить данную ошибку. <br />' +
					'Спасибо вам за помощь в нахождении ошибок на сайте!<br />',
					config.support.what,
					'<a href="' + config.support.addr + '">' + config.support.name + '</a>'
				);

			case 413:
				return L('Вы ввели слишком много текста. ');

			case 404:
				return L('Запрашиваемый URL не найден. ');

			case 0:
				return L("Ошибка подключения. Проверьте ваше подключение к интернету. ");

			default:
				return L('При выполнении вашего запроса произошла ошибка HTTP: {code}', {code: code});
		}
	},
	clearError: function (id) {
		id = id || "common_error";
		$('#' + id).remove();
	},
	clearErrors: function () {
		$('#siteContent').find('.js-alert_message').remove();
	},
	showError: function (msg, id, params) {
		params = $.extend({
			type: 'alert',
			close: true,
			classes: {
				alert: 'system-message_alert',
				info: 'system-message_service',
				warn: ''
			},
			onRetry: false,
			hideTimeout: 0,
			scroll: true
		}, params);

		id = id || params.id || "common_error";
		$('#' + id).remove();
		var $err = $(Spaces.templates.notification({classes: params.classes[params.type], text: msg, close: params.close, retry: !!params.onRetry}));
		$err.attr('id', id).find('.js-notif_close').click(function () {
			Spaces.clearError(id);
			return false;
		});
		$err.find('.js-retry').click(function (e) {
			e.preventDefault();
			params.onRetry();
		});

		if (ge('#Gallery') && params.gallery) {
			import('./gallery').then(({default: GALLERY}) => {
				GALLERY.showNotif(msg);
			});
		} else {
			$('#main_content').prepend($err);
			if (params.scroll)
				$('html, body').scrollTop(0);
		}

		if (params.hideTimeout) {
			setTimeout(function () {
				Spaces.clearError(id, true);
			}, params.hideTimeout);
		}

		return $err;
	},
	showMsg: function (msg, params) {
		params = $.extend({type: 'info'}, params);
		return Spaces.showError(msg, false, params);
	},
	showApiError: function (res, id, params) {
		return Spaces.showError(Spaces.apiError(res), id, params);
	},
	getHumanSize: function (size) {
		if (size >= 1024 * 1024 * 1024)
			return L("{0} Гб", +(size / 1024 / 1024 / 1024).toFixed(1));
		else if (size >= 1024 * 1024)
			return L("{0} Мб", +(size / 1024 / 1024).toFixed(1));
		else if (size >= 1024)
			return L("{0} Кб", +(size / 1024).toFixed(1));
		return L("{0} б", size);
	},
	getFileType: function (ext) {
		ext = ext || '';
		ext = (ext + "").toLowerCase();
		if (/^(avi|mpg|mp4|m4v|mpeg|asf|wmv|3gp|3gpp|flv|mov|webm|mpe)$/.test(ext))
			return Spaces.TYPES.VIDEO;
		if (/^(gif|jpg|jpeg|bmp|png)$/.test(ext))
			return Spaces.TYPES.PICTURE;
		if (/^(mp3|aac|amr|mp3|midi)$/.test(ext))
			return Spaces.TYPES.MUSIC;
		return Spaces.TYPES.FILE;
	},
	getFileIcon: function (ext) {
		ext = (ext + "").toLowerCase();

		var type = Spaces.getFileType(ext);
		if (type == Spaces.TYPES.VIDEO)
			return 'video';
		if (type == Spaces.TYPES.MUSIC)
			return 'mp3';
		if (type == Spaces.TYPES.PICTURE)
			return 'pic';

		var regex = {
			'txt|doc|docx|pdf|fb2'		: 'txt',
			'apk'						: 'apk',
			'jar'						: 'jar',
			'sis|sisx'					: 'sis',
			'exe|xap|cab'				: 'exe',
			'dmg|ipa'					: 'apple',
			'zip|gz|tar|7z|xz|bz|rar'	: 'zip'
		};

		var ico = 'bin';
		$.each(regex, function (k ,v) {
			if ((new RegExp('/^(' + k + ')$/i'))) {
				ico = v;
				return false;
			}
		});
		return ico;
	},
	redirect: function (url, params) {
		import('./ajaxify').then(({default: page_loader}) => {
			if (url === undefined || url === null || url === false)
				url = location.href;
			if (!page_loader.ok() || !page_loader.loadPage({url: url, routerData: params})) {
				// Обычный редирект если нет загрузчика или урл для него не подходит
				location.assign(url);
			}
		});
	},
	// Метод для смены размера тумбы
	thumb: function (url, w, h) {
		return url.replace(RE_THUMB_CHANGE, '$1.' + w + '.' + h);
	},
	getActivationLink: function () {
		return Spaces.prepareLink('/registration/?Link_id=::link_id::');
	},
	prepareLink: function (str, params) {
		params = $.extend({
			link_id:		Spaces.params.link_id,
			ck:				Spaces.CK(),
			sid:			cookie.get('sid') ? '' : Spaces.sid()
		}, params);

		return (str + "").replace(/(::|%3A%3A)([\w\d%_-]+)(::|%3A%3A)/gi, function (a, b, name) {
			return params[decodeURIComponent(name.toLowerCase())] || '';
		});
	},
	prepareLinks: function (el, params) {
		if (!('length' in el))
			el = [el];
		for (var j = 0; j < el.length; ++j) {
			var links = el[j].getElementsByTagName('a');
			for (var i = 0; i < links.length; ++i)
				links[i].href = Spaces.prepareLink(links[i].href, params);
		}
	},
	sid: function () {
		var sid = cookie.get('sid');
		if (!sid) {
			var m = location.search.match(/sid=([^#;&]+)/);
			sid = m ? m[1] : '';
		}
		return sid;
	},
	persistModules: function (module) {
		if (Device.can('sessionStorage')) {
			var old_modules = JSON.parse(window.sessionStorage["preload_modules"] || '[]');
			if ($.inArray(module, old_modules) < 0 && module) {
				old_modules.push(module);
				window.sessionStorage["preload_modules"] = JSON.stringify(old_modules);
			}
			return old_modules;
		}
		return [];
	},
	registerModuleEvent: function (module, event, func) {
		Spaces['$' + module + ':' + event] = func;
	}
});

Spaces.view = {
	getFormSubmitter: function (form) {
		var active = $(document.activeElement);
		if (active.length && form.has(active) && active.is('input[type="submit"], button')) {
			return active;
		} else if (form[0].submit_btn) {
			return $(form[0].submit_btn);
		}
		return null;

	},
	updateAvatars: function (new_src) {
		let [src, src_2x] = ($.isArray(new_src) ? new_src : [new_src, false]);

		src = updateUrlScheme(src);
		if (src_2x)
			src_2x = updateUrlScheme(src_2x);

		let srcset = src_2x ? `${src}, ${src_2x} 1.5x` : '';

		$('.js-my_avatar img')
			.prop("src", src)
			.prop("srcset", srcset)
			.addClass('preview--stub');
	},
	pageNav: {
		'get': function () {
			return $('.pgn').first();
		},
		replace: function (pagination) {
			return $('.pgn-wrapper').first().empty().append(pagination);
		}
	},
	pushWidget: function (el, persist) {
		var id = persist ? 'widgets_pcontainer' : 'widgets_container',
			container = $('#' + id);
		if (!container.length) {
			container = $('<div id="' + id + '" class="relative">');
			$(persist ? '#content_wrap_move' : '#main').prepend($('<div id="' + id + '_wrap">').append(container));
		}
		container.append(el);
	},

	/*
		js-input_error_wrap | враппер, фон которого меняется на красный, если нет, то равен .parent().parent() инпута
		js-input_error      | сообщение с ошибкой внутри враппера, если нет - добавится после поля ввода

		Ивенты:
			inputError     | {error: ошибка} | Когда устанавливается ошибка на поле
			inputErrorHide |                 | Когда ошибка удаляется
	*/
	hasInputError: function (input, error) {
		var parent = input.parents('.js-input_error_wrap').first();
		if (!parent.length)
			parent = input.parent().parent();
		return parent.hasClass('error__item');
	},
	setInputError: function (input, error) {
		var parent = input.parents('.js-input_error_wrap').first(),
			error_place = parent.find('.js-input_error').first();

		if (!parent.length)
			parent = input.parent().parent();
		if (!error_place.length)
			error_place = parent.find('.error__msg');

		var parent_classes = 'error__item ' + (!parent.data('inner') ? 'our_error__item' : 'content-bl_wrap') +
			(parent.hasClass('form__item') ? ' form__item_error' : '');
		if (error !== false) {
			// Костыль какой-то :/
			// надо Серёгу пнуть, чтобы разрулил в CSS
			// а Серёга уже лет 10 не работает, кого пинать то???
			var has_pdb = parent.hasClass('pdb');
			if (has_pdb) {
				parent.data('has_pdb', true);
				parent.removeClass('pdb');
			}

			if (input.hasClass('text-input'))
				input.addClass('text-input_error');
			parent.addClass(parent_classes);

			if (error) {
				if (!error_place.length) {
					error_place = $('<div>', {'class': 'error__msg js-input_error'})
						.insertAfter(input.parent());
				}
				error_place.removeClass('hide').html(error);
			} else {
				error_place.addClass('hide');
			}

			input.trigger('inputError', {error: error});
		} else {
			if (input.hasClass('text-input'))
				input.removeClass('text-input_error');
			parent.removeClass(parent_classes);
			error_place.addClass('hide');

			if (parent.data('has_pdb'))
				parent.addClass('pdb');
			parent.removeData('has_pdb');

			input.trigger('inputErrorHide', {error: error});
		}

		// FIXME
	//	require.loaded(import.meta.id("./dd_menu"), ({default: DdMenu}) => {
	//		DdMenu.fixSize();
	//	});
	},
	onlyAuthMotivator: function () {
		var html =
			'<div class="t_center">' +
				L('Извините, эта функция доступна только зарегистрированным пользователям.') + '<br />' +
				L('Узнайте все преимущества') + ' ' +
				'<a href="/registration/" class="inl-link link-blue">' +
					L('регистрации') + ' <span class="ico ico_arr_right_blue"></span>' +
				'</a>' +
			'</div>';
		return html;
	}
};
Spaces.templates = {
	notification: function (data) {
		var html =
			'<div class="js-alert_message nl system-message ' + data.classes + '">' +
				(data.close ? '<a href="' + data.close + '" class="tdn right">' +
					'<span class="ico ico_remove js-notif_close"></span>' +
				'</a>' : '') +
				data.text +
				(data.retry ? ' <a href="' + data.close + '" class="tdn nl js-retry">' +
					L('Повторить') +
				'</a>' : '') +
			'</div>';
		return html;
	}
};
Spaces.tools = {
	formHidden: function (form, name, value) {
		var v = form.find('input[name="' + name + '"]');
		if (value === null) {
			v.remove();
		} else {
			if (v.length) {
				v.val(value);
			} else {
				form.append($('<input>', {
					type: 'hidden',
					name: name,
					value: value
				}));
			}
		}
	}
};
Spaces.services = {
	processingCodes: function (data) {
		return Spaces.apiError(data);
	},
	pageReload: function (no_state) {
		import('./ajaxify').then(({default: page_loader}) => {
			if (page_loader.ok()) {
				page_loader.loadPage({url: document.location.href, state: !no_state ? history.state : null, history: false, scroll: true});
			} else {
				location.reload();
			}
		});
	}
};
Spaces.File = {
	getMeta: function (el) {
		if ((el instanceof $)) {
			var new_el = el.findAttr('g');
			if (new_el.length)
				el = new_el;
		}
		el = el[0] || el;
		if (!el)
			return;

		var query = el.getAttribute("data-url-params"),
			out = {el: el, link: el.href + (query ? "?" + query : ""), parentId: 0, parentType: 0},
			raw_data = el.getAttribute('g'),
			descr = el.getAttribute('d') || '';
		if (raw_data) {
			var data = raw_data.split("|");
			for (var i = 0, l = FILE_META_DECODE_MAP.length; i < l; ++i) {
				var k = FILE_META_DECODE_MAP[i], v = data[i];
				if (k.substr(0, 1) == '#') {
					k = k.substr(1);
					v = +v || 0;
				}
				out[k] = v;
			}

			if (el.getAttribute("data-not-found"))
				out.not_found = 1;

			if (el.getAttribute("data-blocked"))
				out.blocked = 1;

			if (out.parent) {
				let tmp = out.parent.split(':');
				out.parentType = tmp[0];
				out.parentId = tmp[1];
			}

			if (out.gif)
				out.gif = out.download;

			if (!out.commentsLink)
				out.commentsLink = out.link;

			if (out.commentsLink)
				out.commentsLink = out.commentsLink.replace('" data-url-params="', '?');

			if (out.resolution) {
				var tmp = out.resolution.split("x");
				out.size = [+tmp[0], +tmp[1]];
			}

			out.description = descr;
			out.partial = !out.preview;

			return out;
		}
	}
};

Spaces.core = {
	extractFile: function (el) { // костыли...
		let srcset = el.find('img').prop("src");
		var file = {
			nid: el.data('nid'),
			type: el.data('type'),
			weight: el.data('weight'),
			name: html_wrap(el.data('name') || "unknown.ext"),
			previewURL: el.find('img').prop("src"),
			previewURL_2x: false
		};

		var file_meta;
		if ((file_meta = Spaces.File.getMeta(el))) {
			file.nid = file_meta.nid;
			file.type = file_meta.type;
			file.preview = {
				URL: file_meta.link,
				shareCnt: file_meta.shareCnt,
				group: file_meta.gid,
				commentCnt: file_meta.commentCnt,
				downloadLink: file_meta.download,
				showLink: file_meta.image,
				previewURL: file_meta.preview,
				previewURL_2x: file_meta.preview_2x
			};

			file.previewURL = file_meta.preview;
			file.previewURL_2x = file_meta.preview_2x;
		}

		if (el.prop('href') && !file.URL)
			file.URL = el.prop("href");

		return Spaces.core.fixFile(file);
	},
	fixFile: function (file, type, upload) {
		if (!file.type && file.preview && file.preview.type)
			file.type = file.preview.type;

		if (!file.type)
			file.type = type;
		if (!file.nid) {
			if (file.id) {
				file.nid = file.id;
			} else {
				console.error("File without id", file);
				return false;
			}
		}

		if (file.filename)
			file.filename = file.filename.replace(/[\r\n]/g, ' ');

		if (file.type == Spaces.TYPES.EXTERNAL_VIDEO) {
			file.fileext = "";
			if (!file.filename) {
				if (!file.name) {
					console.error("File without name", file);
					return false;
				}
				file.filename = file.name;
			}
		} else if ((!file.filename || !file.fileext) && file.name) {
			file.name = file.name.replace(/[\r\n]/g, ' ');
			var m = file.name.match(/^(.*?)\.([^\.]+)$/mi);
			if (file.type == Spaces.TYPES.MUSIC && (!m || !m[2] || !/^mp3|aac$/mi.test(m[2]))) {
				file.filename = file.name;
				file.fileext = "mp3";
			} else {
				if (m) {
					file.filename = m[1];
					file.fileext = m[2];
				} else {
					console.error("File without name", file);
					return false;
				}
			}
		}

		if (upload && file.preview && file.thumbLink)
			file.preview.previewURL = file.thumbLink;
		if (!file.URL && file.preview && file.preview.URL)
			file.URL = file.preview.URL;
		if (!file.name)
			file.name = file.filename + "." + file.fileext;

		if (!file.URL && file.redirect_link)
			file.URL = file.redirect_link;

		if (!file.URL) {
			var def_path = {};
			def_path[Spaces.TYPES.MUSIC] = "/music/";
			def_path[Spaces.TYPES.PICTURE] = "/pictures/";
			def_path[Spaces.TYPES.FILE] = "/files/";
			def_path[Spaces.TYPES.VIDEO] = "/video/";

			file.URL = (new Url(def_path[file.type] + "?read=" + file.nid, true)).url();
		}

		file.show_preview = (file.type == Spaces.TYPES.EXTERNAL_VIDEO || file.type == Spaces.TYPES.VIDEO ||
			file.type == Spaces.TYPES.PICTURE || Spaces.SHOW_PREVIEW_RE.test(file.fileext));
		file.extType = Spaces.getFileType(file.fileext);

		return file;
	}
};

// WP 8.1 падает на LS, поэтому try/catch
Spaces.LocalStorage = {
	get: function (k, def) {
		try {
			if (('localStorage' in window) && (k in window.localStorage))
				return window.localStorage[k];
		} catch (e) { }
		return def;
	},
	set: function (k, v) {
		try {
			if ('localStorage' in window)
				window.localStorage[k] = v;
		} catch (e) { }
		return this;
	},
	remove: function (k) {
		try {
			if ('localStorage' in window)
				window.localStorage.removeItem(k);
		} catch (e) { }
		return this;
	},
	support: function () {
		var self = this, k = 'spaces_test';
		if (self.supported === undefined) {
			self.set(k, k);
			self.supported = self.get(k, false) === k;
			self.remove(k);
		}
		return self.supported;
	}
};

// Класс для работы с URL
Url = Class({
	Constructor: function (url, merge_with_current) {
		url = url || "";
		this.parse(url, merge_with_current);
	},
	Static: {
		regexp: /^(([a-z0-9_.-]+\:)?(\/\/([^\/#\?@:]+))?(:\d+)?)?([^\?#]+)?(\?[^#]*)?(#.*)?$/i,
		onlyHashChanged: function (a, b) {
			if (!a || !b)
				return false;
			if (typeof a == 'string')
				a = new Url(a);
			if (typeof b == 'string')
				b = new Url(b);
			return ((a.hash.length > 0 || b.hash.length > 0) && a.isSame(b));
		},
		parseQuery: function (query) {
			if (query.charAt(0) == '?')
				query = query.substr(1);

			var params = {},
				pairs = query.split(/&amp;|&|;/);
			for (var i = 0; i < pairs.length; ++i) {
				var k, v = null;
				var idx = pairs[i].indexOf('=');
				if (idx != -1) {
					k = Url.decode(pairs[i].substr(0, idx));
					v = Url.decode(pairs[i].substr(idx + 1));
				} else {
					k = Url.decode(pairs[i]);
					v = null;
				}

				if (k.length) {
					if (params[k] !== undefined) {
						if (!(params[k] instanceof Array))
							params[k] = [params[k], v]
						else
							params[k].push(v);
					} else
						params[k] = v;
				}
			}
			return params;
		},
		decode: function (str) {
			// decodeURIComponent слишком strict :(
			return decodeURIComponent(str.replace(/%([^a-f0-9]{1,2}|$)/gi, "%25$1").replace(/\+/g, ' '));
		},
		encode: function (str) {
			if (typeof str == 'boolean')
				return str ? 1 : 0;
			return encodeURIComponent(str).replace(/%2F/g, '/');
		},
		buildQuery: function (query, sep, begin) {
			var first = true;
			var url = "";
			sep = sep || "&";
			begin = begin || "";
			for (var key in query) {
				if (query[key] === undefined)
					continue;
				if (query[key] instanceof Array) {
					for (var i = 0; i < query[key].length; ++i) {
						url += (first ? begin : sep) + encodeURIComponent(key) + "=" +
							Url.encode(query[key][i]);
						if (first) first = false;
					}
				} else {
					url += (first ? begin : sep) + encodeURIComponent(key) + "=" +
						Url.encode(query[key]);
					if (first) first = false;
				}
			}
			return url;
		},
		serializeForm: function (form, own_object) {
			var form_data = "", object = own_object || {};

			if (form instanceof $) {
				if (!form.length)
					return {};

				form = form[0];
			}

			var elements = form.elements;
			if (form.tagName.toLowerCase() != 'form')
				elements = $(form).find('textarea, input, button, select');

			for (var i = 0, l = elements.length; i < l; ++i) {
				var p = elements[i],
					type = p.type.toLowerCase();

				if (!p.name.length || ((type == "radio" || type == "checkbox") && !p.checked) ||
						(type == 'submit' && p != form.submit_btn))
					continue;
				if (object[p.name] !== undefined) {
					if (!(object[p.name] instanceof Array))
						object[p.name] = [object[p.name]];
					object[p.name].push(p.value);
				} else
					object[p.name] = p.value;
			}
			return object;
		}
	},
	parse: function (url, merge_with_current) {
		var self = this,
			m = url.match(Url.regexp) || [];

		self.scheme = m[2] || '';
		self.domain = m[4] || '';
		self.port   = m[5] || '';
		self.path   = m[6] || '';
		self.query  = m[7] || '';
		self.hash   = m[8] || '';

		if (merge_with_current) {
			// Мержим относительный URL с текущим
			self._mergeWithCurrent();
		}

		self.domain = self.domain.toLowerCase();
		self.scheme = self.scheme.substr(0, self.scheme.length - 1).toLowerCase();
		self.port   = self.port.substr(1);
		self.query  = self.query.substr(1);
		self.hash   = self.hash.substr(1);
		self.query  = Url.parseQuery(self.query);

		return self;
	},
	isSame: function (url) {
		return this.url(true) === url.url(true);
	},
	_mergeWithCurrent: function () {
		var self = this,
			c = window.location;
		if (!self.scheme.length) {
			self.scheme = c.protocol;
			if (!self.domain.length) {
				self.domain = c.hostname;
				if (!self.path.length) {
					self.path = window.location.pathname;
					if (!self.query.length) {
						self.query = c.search;
						if (!self.hash.length)
							self.hash = c.hash;
					}
				} else if (self.path.substr(0, 1) != '/') {
					self.path = c.pathname +
						(c.pathname.substr(c.pathname.length - 1) == "/" ? "" : "/") +
						self.path;
				}
			}
		}
		return self;
	},
	val: function (k) {
		var self = this;
		return self.query[k] instanceof Array ? self.query[k][0] : self.query[k];
	},
	merge: function (c) {
		var self = this;
		if (!self.scheme.length) {
			self.scheme = c.scheme;
			if (!self.domain.length) {
				self.domain = c.domain;
				if (!self.path.length) {
					self.path = c.path;
					if ($.isEmptyObject(self.query)) {
						self.query = $.extend({}, c.query);
						if (!self.hash.length)
							self.hash = c.hash;
					}
				} else if (self.path.substr(0, 1) != '/') {
					self.path = c.path +
						(c.path.substr(c.path.length - 1) == "/" ? "" : "/") +
						self.path;
				}
			}
		}
		return self;
	},
	url: function (skip_hash) {
		var self = this, url = "";
		if (self.scheme.length)
			url += self.scheme + ":";
		if (self.domain.length || self.port.length) {
			url += "//";
			if (self.domain.length)
				url += self.domain;
			if (self.port.length)
				url += ":" + self.port;
		}
		if (self.path.length)
			url += self.path;
		if (!$.isEmptyObject(self.query))
			url += Url.buildQuery(self.query, "&", "?");
		if (self.hash.length && !skip_hash)
			url += "#" + self.hash;
		return url;
	},
	toString: function () {
		return this.url();
	},
	clone: function () {
		var empty = new Url();
		return empty.merge(this);
	},
	parseDomain: function() {
		var self = this, m, out = {domain: self.domain, sub_domain: "", sub_domains: [], base_domain: ""};
		if ((m = self.domain.match(/((.*?)\.|^)([^\.]+\.[^\.]+)$/))) {
			if (m[2] !== undefined) {
				out.sub_domain = m[2].toLowerCase();
				out.sub_domains = out.sub_domain.split('.');
			}
			if (m[3] !== undefined)
				out.base_domain = m[3].toLowerCase();
		}
		return out;
	},
	trimPath: function() {
		var self = this;
		if (self.path.length == 0)
			return "/";
		var path = self.path.replace(/[\/]+/g, '/');
		return path[path.length - 1] == '/' ? path : path + "/";
	}
});

Spaces.init();

export default Spaces;
export {Spaces, Url, Codes};
