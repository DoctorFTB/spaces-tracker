import {executeScripts} from 'loader';
import Spaces from '../../spacesLib';
import $ from '../../jquery';
import BaseDriver from './base';

let yt_deffered = [];

// Драйвер для embeded youtube
class YoutubeDriver extends BaseDriver {
	constructor(id, container, options) {
		super(id, container, options);
		
		this.destroyed = false;
		this.old_playing = false;
		this.is_ready = false;
		this.on_ready = [];
	}
	
	init(callback) {
		let video_id = this.options.sources[0].src;
		
		let iframe = document.createElement('iframe');
		iframe.id = this.id + '-iframe';
		iframe.className = 'js-vp_player video-player video-player_native';
		iframe.setAttribute("width", '100%');
		iframe.setAttribute("height", '100%');
		iframe.setAttribute("allow", 'autoplay; encrypted-media');
		iframe.setAttribute("allowfullscreen", '');
		iframe.src = '//www.youtube.com/embed/' + video_id + '?enablejsapi=1&' + 
			'autoplay=' + (this.options.autoplay ? 1 : 0) + '&' + 
			'origin=' + location.protocol + "//" + location.hostname;
		this.container.find('.js-vp_player').replaceWith(iframe);
		
		this.iframe = iframe;
		
		initYoutubeApi(() => {
			if (this.destroyed)
				return;
			
			this.player = new YT.Player(iframe.id, {
				events: {
					onReady: () => {
						if (this.destroyed)
							return;
						
						this.is_ready = true;
						for (let i = 0, l = this.on_ready.length; i < l; i++)
							this.on_ready[i]();
					},
					onStateChange: (e) => {
						if (this.destroyed)
							return;
						
						if (e.data == YT.PlayerState.PLAYING || e.data == YT.PlayerState.BUFFERING)
							this.triggerPlay();
						if (e.data == YT.PlayerState.PAUSED || e.data == YT.PlayerState.ENDED || e.data == YT.PlayerState.CUED)
							this.triggerPause();
					}
				}
			});
			
			window.Y = this.player;
		});
		
		this.ready(callback);
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
		// stub
	}
	
	isFullscreen() {
		return false;
	}
	
	setFullscreen(flag) {
		// stub
	}
	
	play() {
		this.player && this.player.playVideo();
	}
	
	pause() {
		this.player && this.player.pauseVideo();
	}
	
	isPlaying() {
		return this.old_playing;
	}
	
	destroy() {
		this.triggerPause();
		
		this.destroyed = true;
		this.on_ready = [];
		
		if (this.player) {
			this.player.destroy();
		} else {
			this.iframe.src = "about:blank";
			this.iframe.parentNode.removeChild(this.iframe);
		}
		
		this.player = false;
		this.iframe = false;
	}
}

function initYoutubeApi(callback) {
	if (yt_deffered) {
		yt_deffered.push(callback);
		
		if (!window.onYouTubeIframeAPIReady) {
			window.onYouTubeIframeAPIReady = () => {
				for (var i = 0, l = yt_deffered.length; i < l; i++)
					yt_deffered[i]();
				yt_deffered = null;
			};
			executeScripts([{src: "https://www.youtube.com/iframe_api"}]);
		}
	} else {
		callback();
		return;
	}
}

export default YoutubeDriver;
