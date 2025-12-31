import $ from '../jquery';

let current_scroll;
let current_scroll_dir;
let current_scroll_limit;
let scroll_callback;

function start(dir, callback, scroll_limit) {
	let scroll_element = $('html, body');
	
	current_scroll_dir = dir;
	scroll_callback = callback;
	current_scroll_limit = scroll_limit;
	
	if (current_scroll)
		return;
	
	let start_scroll = scroll_element.scrollTop();
	let last_time = Date.now();
	
	let frame = () => {
		let now = Date.now();
		let max_scroll = document.documentElement.scrollHeight - window.innerHeight;
		let is_done;
		
		start_scroll += (current_scroll_dir / 1000) * (now - last_time);
		
		window.scroll(0, start_scroll);
		
		if (current_scroll_dir < 0) {
			is_done = window.pageYOffset <= Math.max(current_scroll_limit, 0);
		} else {
			is_done = window.pageYOffset >= Math.min(max_scroll, current_scroll_limit);
		}
		
		if (!is_done) {
			current_scroll = requestAnimationFrame(frame);
		} else {
			current_scroll = false;
			scroll_callback && scroll_callback();
			scroll_callback = false;
		}
		
		last_time = now;
	};
	frame();
}

function stop() {
	if (current_scroll) {
		cancelAnimationFrame(current_scroll);
		current_scroll = false;
		scroll_callback && scroll_callback();
		scroll_callback = false;
	}
}

export default { start, stop };
