import { initializeApp } from "firebase/app";
import { getMessaging } from "firebase/messaging/sw";
import { onBackgroundMessage } from "firebase/messaging/sw";
import { openDB } from 'idb';

let db;
let requests_bypass;
let is_old_domain;

const DEBUG = false;

init();

function init() {
	if (WEB_PUSH)
		initWebPush();
	
	if (ADDITIONAL_MEASURES) {
		DEBUG && console.log('SW protection enabled!');
		initFetchHook();
	}
}

async function initWorkerState() {
	DEBUG && console.log('initWorkerState');
	await reloadVariables();
	DEBUG && console.log('INIT', 'requests_bypass=', requests_bypass, 'is_old_domain=', is_old_domain);
}

async function reloadVariables() {
	requests_bypass = await idbGet('bypassRequests');
	is_old_domain = await idbGet('isOldDomain');
}

function isNeedBypass() {
	return requests_bypass && Date.now() - requests_bypass < 60 * 1000;
}

async function enableBypassMode(url) {
	DEBUG && console.log('NEED BYPASS');
	requests_bypass = Date.now();
	try { await idbSet('bypassRequests', requests_bypass); } catch (e) { }
	return Response.redirect(url.toString(), 301);
}

function checkForNewDomain(url) {
	// Делаем запрос за новым доменом к API
	DEBUG && console.log('Checking for the new domain...');
	return fetch(`https://${denoise(RANDOM_NOISE)}/api/common/getRandSalt?from=${encodeURIComponent(url.hostname)}`, { method: 'POST' })
		.then((res) => res.json())
		.then(async (res) => {
			// Если получили новый домен и он отличается от текущего, редиректим на новый URL
			let new_domain = denoise(res.salt);
			if (new_domain && !compareHosts(url.hostname, new_domain)) {
				let new_url = new URL(url);
				new_url.hostname = new_domain;
				new_url.searchParams.set('Swredir', 1);
				DEBUG && console.log('NEED REDIRECT TO THE NEW DOMAIN: ' + new_domain, new_url.toString());
				
				// Помечаем, что этот домен устарел
				is_old_domain = true;
				await idbSet('isOldDomain', is_old_domain);
				
				// Редиректим по новому адресу
				return Response.redirect(new_url.toString(), 301);
			} else {
				DEBUG && console.log('DOMAIN IS EQUAL TO OLD :(', new_domain);
			}
			
			// Иначе Включаем режим BYPASS
			return enableBypassMode(url.toString());
		})
		// Если не удалось выполнить запрос к API, включаем режим BYPASS
		.catch((err) => {
			DEBUG && console.error(`API ERROR:`, err);
			return enableBypassMode(url.toString());
		});
}

function loadPage(e, request_url) {
	let resolveFallbackPromise;
	
	let fallback_promise = new Promise((resolve, reject) => {
		resolveFallbackPromise = resolve;
	});
	
	// Если страница не загружается уже более 10 сек, попробуем дёрнуть API чтобы проверить наличие нового домена
	let onTimeout = () => {
		timeout_id = false;
		DEBUG && console.log('timeout!!!! check for new domain!!!!!!!!');
		checkForNewDomain(request_url).then((response) => {
			DEBUG && console.log('response', response.status, response.headers.get('Location'));
			// Домен действительно сменился, отправляем на него
			if (response.status == 301 && response.headers.get('Location').indexOf('Swredir=1') >= 0) {
				DEBUG && console.log('Detected Swredir, cancel main request\n');
				resolveFallbackPromise(response);
			}
		});
	};

	let timeout_id = setTimeout(onTimeout, 10000);
	
	reloadVariables().then(() => {
		if (is_old_domain && !isNeedBypass()) {
			DEBUG && console.log('is already marked as old domain!');
			if (timeout_id) {
				clearTimeout(timeout_id);
				timeout_id = false;
			}
			onTimeout();
		}
	});

	let request_promise = fetch(e.request)
		// Запрос успешно выполнился
		.then(async (res) => {
			if (timeout_id) {
				clearTimeout(timeout_id);
				timeout_id = false;
			}
			
			try {
				// Проверяем, вдруг это уже устаревший домен
				DEBUG && console.log('x-is-old-domain:', res.headers.get('x-is-old-domain'));
				if (res.headers.get('x-is-old-domain')) {
					DEBUG && console.log('force mark domain as OLD');
					// Запоминаем, что этот домен устарел
					is_old_domain = true;
					await idbSet('isOldDomain', is_old_domain);
				}
			} catch (e) { }
			return res;
		})
		// Если случилась ошибка при загрузке страницы, пробуем получить новый адрес через API
		.catch(async (err) => {
			if (timeout_id) {
				clearTimeout(timeout_id);
				timeout_id = false;
			}
			
			DEBUG && console.error(`Page loading error:`, err);
			return checkForNewDomain(request_url);
		});
	
	return Promise.race([ fallback_promise, request_promise ]);
}

function initFetchHook() {
	if (!Response.redirect)
		return;
	
	self.addEventListener("install", (event) => {
		DEBUG && console.log(`[SW] ${event.type}`);
		event.waitUntil(initWorkerState());
	});
	
	self.addEventListener('activate', (event) => {
		DEBUG && console.log(`[SW] ${event.type}`);
		event.waitUntil(initWorkerState());
	});
	
	self.addEventListener('fetch', function (e) {
		try {
			// Перехватываем навигационные GET-запросы
			if (e.request.destination != "document" || e.request.mode != "navigate" || e.request.method != "GET" || e.request.isHistoryNavigation)
				return;

			DEBUG && console.log('fetch', e.request.url, 'requests_bypass=', requests_bypass, isNeedBypass(), 'is_old_domain=', is_old_domain, e.request);

			let request_url = new URL(e.request.url);

			// Явный обход SW
			if (e.request.url.indexOf('Swredir=1') >= 0) {
				DEBUG && console.log('Detected Swredir=1, skip!');
				return;
			}

			if (e.request.url.indexOf('Swbypass=1') >= 0) {
				DEBUG && console.log('Detected Swbypass=1, skip!');
				requests_bypass = Date.now();
				is_old_domain = false;
				return;
			}

			// Выходим, если включен режим BYPASS
			if (isNeedBypass()) {
				DEBUG && console.log('requests_bypass=', Date.now() - requests_bypass, 'skip!');
				return;
			}

			// Если этот домен уже был помечен как старый, сразу делаем запрос к API
			if (is_old_domain) {
				DEBUG && console.log('old domain detected!');
				return e.respondWith(checkForNewDomain(request_url));
			}

			return e.respondWith(loadPage(e, request_url));
		} catch (e) {
			DEBUG && console.error('FATAL ERROR', e);
			requests_bypass = Date.now();
			is_old_domain = false;
		}
	});
}

function initWebPush() {
	self.addEventListener('notificationclick', function (event) {
		event.notification.close();
		if (event.notification.data.type !== undefined)
			spacesApiExec("common.androidNotificationGo", {Type: event.notification.data.type});
		return self.clients.openWindow(event.notification.data.link);
	});
	
	initializeApp({
		apiKey:				WEB_PUSH.apiKey, 
		authDomain:			WEB_PUSH.authDomain, 
		databaseURL:		WEB_PUSH.databaseURL, 
		projectId:			WEB_PUSH.projectId, 
		storageBucket:		WEB_PUSH.storageBucket, 
		messagingSenderId:	WEB_PUSH.messagingSenderId, 
		appId:				WEB_PUSH.appId, 
		measurementId:		WEB_PUSH.measurementId
	});

	let messaging = getMessaging();
	onBackgroundMessage(messaging, function (payload) {
		if (payload.data.type !== undefined)
			spacesApiExec("common.androidNotificationShow", {Type: payload.data.type});
		
		return self.registration.showNotification(payload.data.title, {
			body:		payload.data.body, 
			icon:		payload.data.icon, 
			tag:		payload.data.id, 
			renotify:	true, 
			data:		{
				link:	payload.data.link, 
				type:	payload.data.type
			}
		});
	});
}

function spacesApiExec(method, data) {
	var parts = method.split(".");
	
	data.method = parts[1];
	
	var post = [];
	for (var k in data)
		post.push(k + "=" + encodeURIComponent(data[k]));
	
	var date = new Date();
	
	fetch('/api/' + parts[0] + '/?_=' + date.getTime(), {
		method: 'POST',
		body: post.join("&"),
		credentials: "same-origin",
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded',
			'X-Unactive-Tab': 1
		}
	}).then(function (response) {
		return response.json();
	}).then(function (res) {
		if (res.code != 0)
			console.error("[FCM SW] " + method + " error code: " + res.code + (res.error ? " (" + res.error + ")" : ""));
	}).catch(function (err) {
		console.error("[FCM SW] " + method + " error:", err);
	});
}

function compareHosts(domain, base) {
	domain = domain.toLowerCase();
	base = base.toLowerCase();
	if (domain == base)
		return true;
	if (domain.endsWith("." + base))
		return true;
	return false;
}

function denoise(value) {
	return value && value.replace(/[^a-z0-9._-]/gi, '');
}

async function getDb() {
	return await openDB('spaces-sw', 1, {
		upgrade(db) {
			db.createObjectStore('keyval');
		}
	});
}

async function idbGet(key) {
	let db = await getDb();
	let result = db.get('keyval', key);
	await db.close();
	return result;
}

async function idbSet(key, val) {
	let db = await getDb();
	db.put('keyval', val, key);
	await db.close();
}

async function idbRemove(key) {
	let db = await getDb();
	db.delete('keyval', key);
	await db.close();
}
