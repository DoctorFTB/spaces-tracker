import videojs from 'video.js';

const Component = videojs.getComponent('Component');

class VideoJsControlBarSpacer extends Component {
	constructor(player, options = {}) {
		super(player, options);
	}

	createEl() {
		return videojs.dom.createEl('div', {
			className: 'vjs-control-bar-spacer'
		});
	}
}

videojs.registerComponent('ControlBarSpacer', VideoJsControlBarSpacer);
