import module from 'module';
import * as pushstream from '../../core/lp';
import $ from '../../jquery';
import { AI_STATUS } from './common';

let pendingTask;
let genId;

function init() {
	$('#main').on("change", ".js-select_input select", (e) => {
		const customInput = document.querySelector(`.js-text_input_${e.currentTarget.name}_custom`);
		if (customInput)
			customInput.classList.toggle("hide", e.currentTarget.value != "custom");
	});


	pendingTask = document.querySelector('.js-photo_style_task[data-status="new"]');
	if (pendingTask) {
		genId = +pendingTask.dataset.genId;

		pushstream.on('message', 'photo_style', (message) => {
			if (message.act == pushstream.TYPES.AI_PHOTO_STYLE) {
				if (message.id != genId)
					return;
				console.log("[photo_style]", message);
				if (message.status == AI_STATUS.SUCCESS) {
					Spaces.api("services.ai.photoStyle.result", { Id: genId }, (res) => {
						if (res.code == 0) {
							onGeneratedPhoto(res);
							onGenerationDone();
						}
					}, { retry: 3 });
				} else {
					console.log("[photo_style] error=" + message.error);
					setStatus("error");
					onGenerationDone();
				}
			}
		});
	}
}

function onGeneratedPhoto(res) {
	$(pendingTask).find(".js-photo_style_picture").html(res.picture);
	const pictureURL = pendingTask.querySelector('.js-photo_style_pic_url');
	if (pictureURL)
		pictureURL.href = res.pictureURL;
	const setAvatarURL = pendingTask.querySelector('.js-photo_style_ava_url');
	if (setAvatarURL)
		setAvatarURL.href = res.setAvatarURL;
	setStatus("done");
}

function onGenerationDone() {
	$('[data-action="retry"]').removeAttr("onclick").removeClass("stnd-link_disabled");

	if (pendingTask.dataset.status == "error") {
		$(pendingTask).find(".js-photo_style_picture_block").remove();
	}
}

function setStatus(status) {
	for (const block of pendingTask.querySelectorAll('.js-photo_style_status'))
		block.classList.toggle("hide", block.dataset.status !== status);
	pendingTask.dataset.status = status;
}

function destroy() {
	pendingTask = undefined;
	pushstream.off('*', 'photo_style');
}

module.on("componentpage", init);
module.on("componentpagedone", destroy);
