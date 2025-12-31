import {L} from '../../utils';
import Spaces from '../../spacesLib';
import $ from '../../jquery';
import BaseDriver from './base';

const tpl = {
	play() {
		return `<span class="ico_play_btn ico_play_btn_normal"></span>`;
	},
	
	qualitySelector(sources, selected_index) {
		return `
			<div class="video-player_quality_wrap">
				<label>
					Качество:
					<select class="video-player_quality select">
						${tpl.qualityOptions(sources, selected_index)}
					</select>
				</label>
			</div>
			<div class="video-player_spinner"></div>
		`;
	},
	
	qualityOptions(sources, selected_index) {
		let sources_html = '';
		for (let i = 0, l = sources.length; i < l; i++) {
			let source = sources[i];
			if (source.enabled || i == selected_index)
				sources_html += `<option ${i == selected_index ? ' selected="selected"' : ''} value="${i}">${source.label}</option>`;
		}
		return sources_html;
	}
};

// Драйвер для нативного <video>, используем для UC Browser
class NativeDriver extends BaseDriver {
	constructor(id, container, options) {
		super(id, container, options);
		this.on_ready = [];
		this.source_id = -1;
		this.played = false;
		this.old_playing = false;
	}
	
	init(callback) {
		let {sources} = this.options;
		
		// Инициализируем <video>
		let player = document.createElement('video');
		player.className = 'js-vp_player video-player video-player_native';
		player.id = this.id + '-native';
		player.setAttribute('preload', 'none');
		player.setAttribute('controls', '');
		player.setAttribute('playsinline', '');
		player.setAttribute('webkit-playsinline', '');
		player.setAttribute('poster', this.options.preview);
		this.player = player;
		
		player.addEventListener('play', () => this.triggerPlay(), false);
		player.addEventListener('pause', () => this.triggerPause(), false);
		player.addEventListener('ended', () => this.triggerPause(), false);
		
		this.container.find('.js-vp_player').replaceWith(player);
		
		this.selectSource(this.getDefaultSource(), false);
		
		// Выбор качества
		if (sources.length > 1) {
			this.container.append(tpl.qualitySelector(sources, this.source_id));
			this.container.find('select').change((e) => {
				this.selectSource(e.target.value, true);
			});
		}
		
		// Монитор фуллскрина
		let old_fullscreen_state = this.isFullscreen();
		this.fullscreen_monitor = () => {
			let new_fullscreen_state = this.isFullscreen();
			if (new_fullscreen_state != old_fullscreen_state) {
				$(this.player).toggleClass('video-player_fullscreen', new_fullscreen_state);
				this.trigger('fullscreen', [new_fullscreen_state]);
				old_fullscreen_state = new_fullscreen_state;
			}
		};
		onFullscreenChange(this.fullscreen_monitor);
		
		callback && callback();
	}
	
	triggerPlay() {
		this.played = true;
		if (!this.old_playing) {
			this.container.addClass('video-player_playing');
			this.trigger('play');
			this.old_playing = true;
		}
	}
	
	triggerPause() {
		if (this.old_playing) {
			this.container.removeClass('video-player_playing');
			this.trigger('pause');
			this.old_playing = false;
		}
	}
	
	selectSource(index, from_user) {
		let {sources} = this.options;
		
		if (this.source_id == index)
			return;
		
		this.source_id = index;
		
		let player = this.player;
		let source = sources[index];
		let current_time = player.currentTime;
		
		if (current_time > 0) {
			this.container.addClass('video-player_busy');
			
			this.defer_seek = {
				time:		current_time,
				callback:	() => this.resolveDeferSeek()
			};
			player.addEventListener("loadedmetadata", this.defer_seek.callback, false);
			player.src = source.src;
			player.load();
			player.play();
		} else {
			player.src = source.src;
		}
		
		this.updateSelector();
		
		if (from_user)
			this.trigger('quality-changed', [sources[this.source_id].resolution]);
	}
	
	resolveDeferSeek() {
		if (this.defer_seek) {
			let player = this.player;
			player.currentTime = this.defer_seek.time;
			player.removeEventListener("loadedmetadata", this.defer_seek.callback, false);
			this.defer_seek = false;
			this.container.removeClass('video-player_busy');
		}
	}
	
	updateSource(resolution, converted) {
		let {sources} = this.options;
		let player = this.player;
		for (let i = 0, l = sources.length; i < l; i++) {
			let source = sources[i];
			if (source.resolution == resolution) {
				source.enabled = converted;
				break;
			}
		}
		
		if (!this.played && sources.length > 1)
			this.selectSource(this.getDefaultSource(), false);
		
		this.updateSelector();
	}
	
	updateSelector() {
		let {sources} = this.options;
		if (sources.length > 1)
			this.container.find('select').html(tpl.qualityOptions(sources, this.source_id));
	}
	
	isFullscreen() {
		return this.player == getFullscreenElement();
	}
	
	setFullscreen(flag) {
		if (flag && !this.isFullscreen()) {
			requestFullscreen(this.player);
		} else if (!flag && this.isFullscreen()) {
			cancelFullscreen();
		}
	}
	
	play() {
		this.player.play();
	}
	
	pause() {
		this.player.pause();
	}
	
	isPlaying() {
		return !this.player.paused;
	}
	
	destroy() {
		if (this.isFullscreen()) {
			this.setFullscreen(false);
			setTimeout(() => offFullscreenChange(this.fullscreen_monitor), 1000);
		} else {
			offFullscreenChange(this.fullscreen_monitor);
		}
		
		this.triggerPause();
		
		try {
			this.player.pause();
			this.player.removeAttribute('src');
			this.player.load();
		} catch (e) { }
		
		this.player.parentNode.removeChild(this.player);
		this.player = false;
	}
}

function onFullscreenChange(callback) {
	document.addEventListener('fullscreenchange', callback, false);
	document.addEventListener('webkitfullscreenchange', callback, false);
	document.addEventListener('mozfullscreenchange', callback, false);
	document.addEventListener('MSFullscreenChange', callback, false);
}

function offFullscreenChange(callback) {
	document.removeEventListener('fullscreenchange', callback, false);
	document.removeEventListener('webkitfullscreenchange', callback, false);
	document.removeEventListener('mozfullscreenchange', callback, false);
	document.removeEventListener('MSFullscreenChange', callback, false);
}

function getFullscreenElement() {
	return document.fullscreenElement || document.mozFullScreenElement || document.webkitFullscreenElement || document.msFullscreenElement;
}

function cancelFullscreen() {
	if (document.exitFullscreen) {
		document.exitFullscreen();
	} else if (document.mozCancelFullScreen) {
		document.mozCancelFullScreen();
	} else if (document.webkitExitFullscreen) {
		document.webkitExitFullscreen();
	} else if (this.player.msExitFullscreen) {
		this.player.msExitFullscreen();
	}
}

function requestFullscreen(el) {
	if (el.requestFullscreen) {
		el.requestFullscreen();
	} else if (el.mozRequestFullScreen) {
		el.mozRequestFullScreen();
	} else if (el.webkitRequestFullscreen) {
		el.webkitRequestFullscreen(Element.ALLOW_KEYBOARD_INPUT);
	} else if (el.msRequestFullscreen) {
		el.msRequestFullscreen();
	}
}

export default NativeDriver;
