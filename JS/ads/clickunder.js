import $ from '../jquery';
import page_loader from '../ajaxify';
import {Url, Spaces} from '../spacesLib';

let already_run = false;
let video_cu_url;
let user_agent = navigator.userAgent;
let cu_installed = false;
let cu_timeout;
let cu_sended = {};
let cu_click_block;

function initOnPlay(go, type) {
	if (cu_installed)
		return;
	
	if (go) {
		checkClickunder('go', type)
	} else {
		$('.js-vp, .js-video_player_block').one('video_play', () => checkClickunder('play', type));
		$('[id^="download_wrap_"], #download_wrap').one('click', () => checkClickunder('download', type));
	}
	
	page_loader.one('shutdown', () => cu_sended = {});
}

function checkClickunder(action, type) {
	if (cu_sended[`${type}:${action}`] || cu_installed)
		return;
	
	cu_sended[`${type}:${action}`] = true;
	
	let method = (action == 'go' ? "ama1k3r.onNeed2Go" : "ama1k3r.onCl1ckCU");
	Spaces.api(method, {action: action, type: type}, (res) => {
		if (res.code == 0) {
			if (res.goURL)
				installClickunder(res.goURL, res.goTTL);
		} else {
			console.error(`[spcu] ${Spaces.apiError(res)}`);
		}
	}, {
		onError(err) {
			console.error(`[spcu] ${err}`);
		}
	})
}

function installClickunder(url, timeout) {
	video_cu_url = url;
	cu_timeout = Date.now() + timeout * 1000;
	cu_installed = true;
	
	page_loader.on('beforerequest', 'clickunder', function (params) {
		if (already_run)
			return;
		
		if (Date.now() >= cu_timeout)
			return;
		
		if (cu_click_block) {
			if (!params.el)
				return true;
			
			let block = document.getElementById(cu_click_block);
			if (!block || !$.contains(block, params.el))
				return true;
		}
		
		if (parseMainDomain(params.url) != parseMainDomain(document.location.href))
			return true;
		
		if (params.form || params.from_history || !params.el)
			return true;
		
		openClickunder(params.url, video_cu_url);
		
		if (user_agent.match(/IE|Trident/)) {
			page_loader.off('beforerequest', 'clickunder');
			return true;
		}
		
		return false;
	}, true);
}

function openWindow(old_url, new_url) {
	if (user_agent.match(/Safari/) && !user_agent.match(/Chrome/) && !user_agent.match(/(Android|Adr)/i)) {
		let a = document.createElement('a');
		a.setAttribute("href", old_url);
		a.setAttribute("target", "_blank");
		
		let dispatch = document.createEvent("HTMLEvents");
		dispatch.initEvent("click", true, true);
		a.dispatchEvent(dispatch);
		
		setTimeout(function () {
			window.location = new_url;
		}, 100);
	} else if (user_agent.match(/IE|Trident/)) {
		window.open(new_url, 'spcu', 'toolbar=0,statusbar=1,resizable=1,scrollbars=1,menubar=0,location=1,directories=0,height=755,width=1025');
		setTimeout(window.focus, 0);
		window.focus();
		
		setTimeout(function() {
			let a = window.open("about:blank");
			a.focus();
			a.close();
			window.focus()
		}, 200);
		
		return false;
	} else {
		setTimeout(function() {
			window.location = new_url;
		}, 200);
		window.open(old_url);
	}
	
	return true;
}

function openClickunder(old_url, new_url) {
	if (already_run)
		return false;
	
	already_run = true;
	
	if (openWindow(old_url, new_url))
		return true;
	
	return false;
}

function parseMainDomain(href) {
	let m = href.match(/^(?:http|https):\/\/(?:[\w\d_.-]+\.)?([\w\d_-]+\.[\w\d_-]+)(?:[\/#?]|$)/i);
	return m && m[1];
}

export {initOnPlay};
