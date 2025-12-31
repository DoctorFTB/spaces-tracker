import module from 'module';
import $ from '../../jquery';
import { L, updateUrl, updateUrlScheme } from '../../utils';
import * as pushstream from '../../core/lp';
import { AI_STATUS } from './common';

const STAGE = {
	ERROR:		-2,
	NONE:		-1,
	SEND:		0,
	GENERATE:	1,
	DOWNLOAD:	2,
	SAVE:		3,
};

const tpl = {
	image(src, srcset) {
		return `
			<img
				width="100" height="100"
				style="max-width:100%; height: auto"
				src="${src}"
				srcset="${srcset || src}"
				class="js-gift_gen_img preview"
				alt=""
			/>
		`;
	},
};

let pendingGift;
let deferTimeout;
let deferStage;

init();

function init() {
	pendingGift = $('.js-gift_gen_item[data-status="pending"]');

	if (!pendingGift.length)
		return;

	setStage(STAGE.SEND);

	deferStage = STAGE.GENERATE;
	deferTimeout = setTimeout(() => {
		setStage(deferStage);
		deferTimeout = false;
	}, 3000);

	pushstream.on('message', 'gift_generator', (message) => {
		if (message.act == pushstream.TYPES.AI_GIFT_GEN) {
			if (message.stage) {
				if (deferTimeout) {
					deferStage = message.stage;
				} else {
					setStage(message.stage);
				}
				return;
			}

			if (message.error) {
				const errorText = message.error == AI_STATUS.DENIED_BY_CENSORE
					? L('Ваш запрос не прошёл внутреннюю цензуру нейросети, попробуйте его изменить:')
					: L('Сервис временно недоступен. Попробуйте позже.');
				pendingGift.find('.js-gift_gen_title_wrap').addClass('red');
				pendingGift.find('.js-gift_gen_title').html(errorText);
				setStage(STAGE.ERROR);
			} else {
				const img = pendingGift.find('.js-gift_gen_img');
				img.replaceWith(tpl.image(updateUrlScheme(message.previewURL), `${updateUrlScheme(message.previewURL)}, ${updateUrlScheme(message.previewURL_2x)} 2x`));
				pendingGift.find('.js-gift_gen_title').html(L('Результат по вашему запросу:'));
				setStage(STAGE.NONE);
			}

			$('[data-action="retry"]').removeAttr("onclick").removeClass("stnd-link_disabled");
		}
	});
}

function destroy() {
	if (deferTimeout) {
		clearTimeout(deferTimeout);
		deferTimeout = false;
	}
	pushstream.off('*', 'gift_generator');
}

function setStage(stage) {
	if (deferTimeout) {
		clearTimeout(deferTimeout);
		deferTimeout = false;
	}

	pendingGift.find('.js-gift_gen_progress_block').toggleClass('hide', stage == STAGE.NONE || stage == STAGE.ERROR);
	pendingGift.find('.js-gift_gen_result_block').toggleClass('hide', stage != STAGE.NONE);

	if (stage != STAGE.NONE) {
		const STAGE_TO_TEXT = {
			[STAGE.SEND]:		L('Отправка задания...'),
			[STAGE.GENERATE]:	L('Создание подарка...'),
			[STAGE.SAVE]:		L('Сохранение подарка...'),
		};
		const STAGE_TO_PCT = {
			[STAGE.SEND]:		20,
			[STAGE.GENERATE]:	75,
			[STAGE.SAVE]:		95,
		};

		const pb = pendingGift.find('.js-gift_gen_progress_bar');
		pb.css("width", Math.max(pb.data('progress'), STAGE_TO_PCT[stage]) + '%');
		pendingGift.find('.js-gift_gen_progress_txt').text(STAGE_TO_TEXT[stage]);
	}
}

module.on("componentpage", init);
module.on("componentpagedone", destroy);
