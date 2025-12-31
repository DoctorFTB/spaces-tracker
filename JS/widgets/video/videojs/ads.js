import 'videojs-contrib-ads';
import 'videojs-ima';
import { loadGoogleImaSdk } from '../ima';
import cookie from '../../../cookie';
import SPACES_PARAMS from '../../../core/env';

const EVENTS_FOR_SAVE = [
	'play',
	'contentended',
	'dispose',
	'readyforpreroll',
	'adtimeout',
	'loadstart',
	'suspend',
	'abort',
	'error',
	'emptied',
	'stalled',
	'loadedmetadata',
	'loadeddata',
	'canplay',
	'canplaythrough',
	'playing',
	'waiting',
	'seeking',
	'seeked',
	'ended',
	'durationchange',
	'timeupdate',
	'progress',
	'pause',
	'ratechange',
	'resize',
	'volumechange',
	'firstplay',
	'loadedalldata',
	'contenttimeupdate',
	'addurationchange',
	'adcanplay',
	'nopreroll',
	'nopostroll',
	'contentchanged',
	'adsready',
	'adscanceled',
	'adskip',
	'adserror',
	'adended',
	'ads-ad-started',
	'ads-ad-skipped',
	'contentresumed',
	'readyforpostroll'
];

export function setupAds(player, adBreaks) {
	// Сохраняем события для отложенной инициализации google ima
	const deferEvents = [];
	const onDeferEvent = function (e) {
		deferEvents.push({
			type: e.type,
			self: this,
			arguments: [...arguments]
		});
	};

	for (const type of EVENTS_FOR_SAVE)
		player.on(type, onDeferEvent);

	loadGoogleImaSdk()
		.then(() => {
			if (player.isDisposed())
				return;

			console.log("[IMA SDK] ready!", Date.now() - SPACES_LOAD_START);

			for (const type of EVENTS_FOR_SAVE)
				player.off(type, onDeferEvent);

			initGoogleIma(player, deferEvents, {
				adsResponse: createVmap(adBreaks),
				debug: !!cookie.get('ima_debug'),
				adsRenderingSettings: {
					enablePreloading: true
				},
				requestMode: 'onLoad',
				locale: SPACES_PARAMS.lang
			});
		})
		.catch((e) => {
			if (player.isDisposed())
				return;

			console.error("[IMA SDK] init error!", e);
			for (const type of EVENTS_FOR_SAVE)
				player.off(type, onDeferEvent);
		});
}

// google ima не поддерживает ленивую инициализацию
// Чтобы это обойти - сохраняем события (loadstart, loadedmetadata, loadeddata), которые произошли до инициализации плагина ima()
// Далее на время инициализации плагина подменяем функции player.on() и player.one(), чтобы получить все хэндлеры, которые он устанавливает
// После инициализации плагина берём ранее сохранённые события и вызываем для них ранее полученные хэндлеры
// Таким образом, восстанавливаем нужное состояние, которое было бы при синхронной инициализации
function initGoogleIma(player, deferEvents, options) {
	// Подменяем player.on() и player.one()
	const originalFnOn = player.on;
	const originalFnOne = player.one;
	
	const eventHandlers = {};
	player.on = function (types, handler) {
		for (const type of types.toString().split(",")) {
			eventHandlers[type] = eventHandlers[type] || [];
			eventHandlers[type].push(handler);
		}
		return originalFnOn.apply(this, arguments);
	};
	
	player.one = function (types, handler) {
		for (const type of types.toString().split(",")) {
			eventHandlers[type] = eventHandlers[type] || [];
			eventHandlers[type].push(handler);
		}
		return originalFnOne.apply(this, arguments);
	};
	
	// Инциализируем плагин
	player.ima(options);
	
	// Возвращаем функции обратно
	player.on = originalFnOn;
	player.one = originalFnOne;
	
	// Восстанавливаем отложенные события
	for (const ev of deferEvents) {
		if (eventHandlers[ev.type]) {
			for (const handler of eventHandlers[ev.type])
				handler.apply(ev.self, ev.arguments);
		}
	}
	
	// Инициализация контейнера для тача
	let startEvent = 'click';
	if (navigator.userAgent.match(/iPhone|iPad|Android/i))
		startEvent = 'touchend';
	
	const initAdsContainer = () => {
		player.ima.initializeAdDisplayContainer();
		player.el().removeEventListener(startEvent, initAdsContainer, false);
	};
	player.el().addEventListener(startEvent, initAdsContainer, false);
}

function createVmap(adBreaks) {
	let xml = `<?xml version="1.0" encoding="UTF-8"?><vmap:VMAP xmlns:vmap="http://www.iab.net/videosuite/vmap" version="1.0">`;
	let i = 0;
	for (const ad of adBreaks) {
		xml += `
			<vmap:AdBreak timeOffset="${ad.offset}" breakType="${ad.type}" breakId="${ad.id}">
				<vmap:AdSource id="ad-${ad.id}-${ad.type}-${i++}" allowMultipleAds="false" followRedirects="true">
					<vmap:AdTagURI templateType="vast3"><![CDATA[${ad.tag}]]></vmap:AdTagURI>
				</vmap:AdSource>
			</vmap:AdBreak>
		`;
	}
	xml += `</vmap:VMAP>`;
	return xml;
}
