import videojs from 'video.js';

videojs.registerPlugin('smartAltTab', function VideoJsSmartAltTab() {
	for (const button of this.el().querySelectorAll('.vjs-control.vjs-button'))
		initFocusMonitor(this, button);
});

function initFocusMonitor(player, button) {
	let isMouseDown = false;
	let isFocusedByMouse = false;

	const handleMouseDown = () => {
		isMouseDown = true;
	};

	const handleMouseUp = () => {
		isMouseDown = false;
	};

	const handleFocus = () => {
		if (isMouseDown)
			isFocusedByMouse = true;
	};

	const handleBlur = () => {
		isFocusedByMouse = false;
	};

	const handleKeyDown = (e) => {
		if (isFocusedByMouse && e.which == 32) {
			e.stopPropagation();
			e.preventDefault();
			e.stopImmediatePropagation();

			if (document.activeElement === e.currentTarget)
				player.focus();

			player.handleKeyDown(e);
			return false;
		}
	};

	button.addEventListener('mousedown', handleMouseDown, false);
	button.addEventListener('mouseup', handleMouseUp, false);
	button.addEventListener('focus', handleFocus, false);
	button.addEventListener('blur', handleBlur, false);
	button.addEventListener('keydown', handleKeyDown, false);

	player.on('dispose', () => {
		button.removeEventListener('mousedown', handleMouseDown, false);
		button.removeEventListener('mouseup', handleMouseUp, false);
		button.removeEventListener('focus', handleFocus, false);
		button.removeEventListener('blur', handleBlur, false);
		button.removeEventListener('keydown', handleKeyDown, false);
	});
}
