// JSONP транспорт для LP
// Здесь по максимуму избегаем утечек памяти
// Стараемся не создавать новые функции или объекты на каждый запрос

const PREFIX = '__spcslp';

let current_script;
let timeout_timer;
let request_start;
let success_callback = null;
let error_callback = null;
let last_request_id = 0;

function request(src, onsuccess, onerror, onresponse, load_timeout) {
	clear(false);
	
	last_request_id++;
	
	// Удаляем старые callback'и
	// Последние 10 callback'ов не трогаем во избедание ошибок JS
	// Остальные удаляем из window, чтобы не засорять его
	delete window[PREFIX + (last_request_id - 10)];
	
	window[PREFIX + last_request_id] = onresponse;
	
	success_callback = onsuccess;
	error_callback = onerror;
	
	current_script = document.createElement('script');
	current_script.src = src.replace('JSONP_CALLBACK', PREFIX + last_request_id);
	current_script.type = "text/javascript";
	current_script.async = true;
	current_script.onload = scriptOnLoad;
	current_script.onerror = scriptOnError;
	current_script.onreadystatechange = scriptOnReadyStateChange;
	
	let head = document.head || document.getElementsByTagName('head')[0];
	head.appendChild(current_script);
	
	timeout_timer = setTimeout(scriptOnTimeout, load_timeout);
	request_start = Date.now();
}

function scriptOnLoad() {
	if (current_script) {
		let callback = success_callback;
		clear(false);
		callback();
	}
}

function scriptOnError() {
	if (current_script) {
		let callback = error_callback;
		clear(true);
		callback("jsonp error", Date.now() - request_start);
	}
}

function scriptOnTimeout() {
	if (current_script) {
		let callback = error_callback;
		clear(true);
		callback("jsonp timeout", Date.now() - request_start);
	}
}

function scriptOnReadyStateChange() {
	if (current_script && /^(complete|loaded)$/.test(current_script.readyState))
		scriptOnLoad();
}

function clear(force) {
	if (force) {
		// Заменяем текущий callback на пустышку, чтобы не было ошибок в будущем
		window[PREFIX + last_request_id] = noop;
	}
	
	if (current_script) {
		current_script.onerror = current_script.onload = current_script.onreadystatechange = null;
		current_script.parentNode.removeChild(current_script);
		current_script = null;
	}
	
	if (timeout_timer) {
		clearTimeout(timeout_timer);
		timeout_timer = null;
	}
	
	success_callback = null;
	error_callback = null;
}

function noop() {
	console.warn("[LP] received old message...");
}

export {request, clear};
