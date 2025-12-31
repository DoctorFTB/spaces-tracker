import module from 'module';
import $ from './jquery';
import Device from './device';
import Spaces from './spacesLib';
import {pad} from './utils';

var TIME_UPDATE_INTERVAL = 30, // Обновление раз в 30 секунд, при возможности
	early_now = new Date(SPACES_LOAD_START),
	time_offset = 0,
	last_time,
	last_timeout,
	last_timezone,
	last_interval_time;

function clock_recalc_offset() {
	var el = $('#user_time');
	if (el.length && !el.data("clocked")) {
		var time = el.text(),
			now = early_now || (new Date()),
			m = time.match(/(\d+):(\d+)/),
			minutes1 = +m[1] * 60 + +m[2],
			minutes2 = now.getHours() * 60 + now.getMinutes();
		time_offset = 0;
		if (Math.abs(minutes1 - minutes2) > 5)
			time_offset = (minutes1 - minutes2) * 60000;
		el.data("clocked", true);
		last_timezone = now.getTimezoneOffset();
	}
	early_now = null;
	
	return el.length > 0;
}

function clock_thread() {
	var sys_now = new Date(),
		sys_now_unix = Date.now();
	/*
	if (last_time && Math.abs(last_time - sys_now_unix) > 2 * 60000) {
		// Пересчитываем время, если юзер его внезапно сменил
		time_offset += (last_time + last_interval_time) - sys_now_unix;
	}
	last_time = sys_now_unix;
	
	// Если внезапно сменилась временная зона
	if (last_timezone != sys_now.getTimezoneOffset()) {
		time_offset -= (last_timezone - sys_now.getTimezoneOffset()) * 60000;
		last_timezone = sys_now.getTimezoneOffset();
	}
	
	var now = new Date(sys_now_unix + time_offset);
	// Костыль для Зимнего/Летнего времени
	if (sys_now.getTimezoneOffset() != now.getTimezoneOffset()) {
		var tz_diff = (sys_now.getTimezoneOffset() - now.getTimezoneOffset()) * 60000;
		now.setTime(sys_now_unix + time_offset - tz_diff);
	}
	*/
	var now = new Date(sys_now_unix + time_offset);
	$('#user_time').text(pad(now.getHours(), 2) + ":" + pad(now.getMinutes(), 2));
	
	last_interval_time = Math.max(Math.min(TIME_UPDATE_INTERVAL, 60 - now.getSeconds() - 5) * 1000, 0);
	last_timeout = setTimeout(clock_thread, last_interval_time);
}

module.on("component", function () {
	if (last_timeout)
		clearTimeout(last_timeout);
	if (clock_recalc_offset())
		clock_thread();
});
