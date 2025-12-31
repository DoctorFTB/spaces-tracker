// Обход бага: videojs с disableSeekWhileScrubbingOnMobile=true не обновляет время на таймлайне при перемотке с тача.
// Приходится выбирать: или держать копию videojs в локальном репозитории или использовать такой костыль
import { throttleRaf } from "../../../../utils";

export function videojsPatchSeekBar(videojs) {
	const SeekBar = videojs.getComponent('SeekBar');

	const originalPendingSeekTime = SeekBar.prototype.pendingSeekTime;

	const updateTime = throttleRaf((self) => {
		self.player_.trigger({ type: 'timeupdate', target: self, manuallyTriggered: true });
	});

	SeekBar.prototype.pendingSeekTime = function (...args) {
		const result = originalPendingSeekTime.apply(this, args);
		if (args.length > 0) {
			this.player().getCache().currentTime = args[0];
			updateTime(this);
		}
		return result;
	};
}
