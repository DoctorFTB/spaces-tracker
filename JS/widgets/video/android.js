import Spaces from '../../spacesLib';
import $ from '../../jquery';
import SpacesApp from '../../android/api';
import BaseDriver from './base';

const tpl = {
	play() {
		return `<span class="ico_play_btn ico_play_btn_normal"></span>`;
	},
	
	qualitySelector(sources, selected_index) {
		return `
			<div class="video-player_quality_wrap">
				<select class="video-player_quality">
					${tpl.qualityOptions(sources, selected_index)}
				</select>
			</div>
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

// Драйвер для плеера внутри приложения
class AndroidAppDriver extends BaseDriver {
	constructor(id, container, options) {
		super(id, container, options);
		
		this.destroyed = false;
		this.old_playing = false;
		this.source_id = this.getDefaultSource();
	}
	
	init(callback) {
		window.SpacesApp = $.extend(window.SpacesApp || {}, {
			onVideoPlay: () => {
				this.triggerPlay();
			},
			onVideoPause: () => {
				this.triggerPause();
			},
			onVideoFallback: () => {
				this.options.native = false;
				this.initFallback();
				this.play();
			}
		});
		
		let player = this.container.find('.js-vp_player')
			.css("cursor", "pointer");
		
		// Кнопка play
		player.append(tpl.play());
		player.click((e) => {
			e.preventDefault();
			this.play();
		});
		
		if (!this.options.native)
			this.initFallback();
		
		callback();
	}
	
	initFallback() {
		let {sources} = this.options;
		let player = this.container.find('.js-vp_player');
		
		// Выбор качества
		if (sources.length > 1) {
			player.append(tpl.qualitySelector(sources, this.source_id));
			this.container.find('select').change((e) => {
				this.selectSource(e.target.value, true);
			}).click((e) => {
				e.stopPropagation();
			});
		}
	}
	
	triggerPlay() {
		if (!this.old_playing) {
			this.trigger('play');
			this.old_playing = true;
		}
	}
	
	triggerPause() {
		if (this.old_playing) {
			this.trigger('pause');
			this.old_playing = false;
		}
	}
	
	ready(callback) {
		if (this.is_ready) {
			callback();
		} else {
			this.on_ready.push(callback);
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
		
		this.selectSource(this.getDefaultSource(), false);
	}
	
	selectSource(index, from_user) {
		let {sources} = this.options;
		this.source_id = index;
		if (from_user)
			this.trigger('quality-changed', [sources[this.source_id].resolution]);
		this.updateSelector();
	}
	
	updateSelector() {
		let {sources} = this.options;
		if (sources.length > 1)
			this.container.find('select').html(tpl.qualityOptions(sources, this.source_id));
	}
	
	isFullscreen() {
		return false;
	}
	
	setFullscreen(flag) {
		// stub
	}
	
	play() {
		if (this.options.native) {
			SpacesApp.exec("nativeVideo", this.options.file);
		} else {
			let src = this.options.sources[this.source_id].src;
			SpacesApp.exec("playVideo", {src: src});
		}
	}
	
	pause() {
		// no way
	}
	
	isPlaying() {
		return this.old_playing;
	}
	
	destroy() {
		this.triggerPause();
		
		delete window.SpacesApp.onVideoPlay;
		delete window.SpacesApp.onVideoPause;
		delete window.SpacesApp.onVideoFallback;
	}
}

export default AndroidAppDriver;
