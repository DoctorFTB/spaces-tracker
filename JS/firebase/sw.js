import { initializeApp } from "firebase/app";
import { getMessaging } from "firebase/messaging/sw";
import { onBackgroundMessage } from "firebase/messaging/sw";

init();

function init() {
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
