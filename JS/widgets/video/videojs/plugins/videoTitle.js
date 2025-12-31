import videojs from 'video.js';

const Component = videojs.getComponent('Component');

videojs.registerPlugin('videoTitle', function VideoJsVideoTitle(options = {}) {
	this.addChild('VideoTitle', options);
});

class VideoTitle extends Component {
	constructor(player, options = {}) {
		super(player, options);
	}

	createEl() {
		const link = videojs.dom.createEl('a', {
			innerHTML: this.options_.title,
			href: this.options_.url,
			target: '_blank',
			rel: 'noopener',
		});
		const block = videojs.dom.createEl('a', {
			className: 'vjs-video-title',
		});
		block.appendChild(link);
		return block;
	}
}

videojs.registerComponent('VideoTitle', VideoTitle);
