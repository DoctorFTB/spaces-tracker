import videojs from 'video.js';

videojs.registerPlugin('fastShowOnHover', function VideoJsFastShowOnHover() {
	this.el().addEventListener('mousemove', () => {
		this.userActive(true);
	});
});
