import { L, numeral, updateUrl, updateUrlScheme } from './utils';
import require from 'require';
import { Codes, Spaces } from './spacesLib';
import { ICONS_BASEURL } from './core/env';
import * as pushstream from './core/lp';

const MAX_PROMPT_LENGTH = 250;
const pic_gen_TIMEOUT = 120 * 1000;

const AI_ERRORS = {
	TIMEOUT:			-1,
	INTERNAL_ERROR:		1,
	SERVICE_ERROR:		2,
	NO_SUCH_QUALITY:	3,
	NO_SUCH_MODEL:		4,
	NO_SUCH_SCALE:		5,
	UNKNOWN_ERROR:		6,
	NOT_ENOUGH_FUNDS:	7,
};

const WALLET_MODE = {
	DEFAULT: 0,
	DROPDOWN: 1,
};

const STAGE = {
	NONE:		-1,
	SEND:		0,
	GENERATE:	1,
	DOWNLOAD:	2,
	SAVE:		3,
};

let container;
let current_generation_id;
let current_generation;
let current_generation_timeout;
let params;

const tpl = {
	fatalError(error) {
		return `
			<div class="content-item3 wbg red">
				${error}
			</div>
			<div class="links-group content-bl__top_sep t_center">
				<a href="#" class="list-link list-link-grey js-dd_menu_close">
					<span class="js-ico ico ico_remove"></span> ${L('Закрыть')}
				</a>
			</div>
		`;
	},
	
	image(src, srcset) {
		return `<img src="${src}" srcset="${srcset || src}" alt="" class="js-pic_gen_img fixed-size__content" style="max-width: 100%" />`;
	},
	
	menu() {
		let select_button;
		if (params.type == 'avatar') {
			select_button = `
				<div href="#" class="list-link list-link-green js-pic_gen_selected">
					<span class="js-ico ico ico_ok_green"></span>
					${L('Установить на аватар')}
				</div>
				<a href="#" class="list-link list-link-blue js-pic_gen_select">
					<span class="js-ico ico_mail ico_mail_picture_blue"></span>
					${L('Установить на аватар')}
				</a>
			`;
		} else {
			select_button = `
				<a href="#" class="list-link list-link-blue js-pic_gen_select">
					<span class="js-ico ico_attaches ico_attaches_attach_blue"></span>
					${L('Прикрепить картинку')}
				</a>
			`;
		}
		
		return `
			<div data-screen="generator-form" class="error__item_wrapper">
				<div class="content-bl__top_sep js-pic_gen_form"></div>

				<div class="content-bl__top_sep js-pic_gen_balance_widget"></div>
				
				<div class="content-item3 wbg red pdt js-pic_gen_error hide"></div>
				
				<div class="links-group content-bl__top_sep">
					<a href="#" class="list-link list-link-grey js-pic_gen_cancel">
						<span class="js-ico ico ico_remove"></span>
						${L('Отменить')}
					</a>
				</div>
			</div>
			
			<div data-screen="results">
				<div class="content-item3 wbg">
					<div class="grey">
						${L('Готово! Мы создали картинку по вашему запросу:')}
					</div>
					
					<div class="pad_t_a t_center">
						<div class="fixed-size fixed-size--1-1" style="max-width: min(360px, 100%);">
							<a href="" class="js-pic_gen_img_link" target="_blank" rel="noopener">
								${tpl.image(ICONS_BASEURL + 'pixel.png')}
							</a>
						</div>
					</div>
					
					<div class="pad_t_a t_center grey">
						${L('Сохранено в папку')}
						&nbsp;
						<a href="#" target="_blank" rel="noopener" class="js-pic_gen_img_link">
							<span class="ico_files ico_files_dir_all_small"></span>
							${L('Вложения')}
						</a>
					</div>
				</div>
				
				<div class="links-group content-bl__top_sep">
					${select_button}
					<a href="#" class="list-link list-link-grey js-pic_gen_return">
						<span class="js-ico ico ico_reload"></span>
						${L('Создать другую картинку')}
					</a>
					<a href="#" class="list-link list-link-grey js-dd_menu_close">
						<span class="js-ico ico ico_remove"></span>
						${L('Закрыть')}
					</a>
				</div>
			</div>
		`;
	}
};

function init(el, _params) {
	container = el;
	params = _params;
	
	initForm(() => {
		params.onInit();
	});
}

function initForm(callback) {
	Spaces.api("services.ai.genPicture.getForm", { }, (res) => {
		callback();

		if (res.code != 0) {
			container.html(tpl.fatalError(Spaces.apiError(res)));
			return;
		}

		render();
		container.find('.js-pic_gen_form').html(res.form);
		container.find('.js-pic_gen_balance_widget').html(res.wallet);
	}, {
		onError(err) {
			callback();
			container.html(tpl.fatalError(err));
		}
	});
}

function render() {
	container.html(tpl.menu());
	
	pushstream.on('message', 'pic_generator', (message) => {
		if (message.act == pushstream.TYPES.AI_PICTURE_GEN) {
			if (message.genId == current_generation_id && current_generation)
				current_generation(message);
		}
	});
	
	// Генерация картинки
	container.action('ai_gen_picture', function (e) {
		e.preventDefault();
		e.stopPropagation();
		
		let el = $(this);
		
		if (el.data('loading'))
			return;
		
		let setLoading = (flag) => {
			// el.find('.js-ico').toggleClass('ico_spinner', flag);
			// el.find('.js-pic_gen_do').toggleClass('stnd-link_disabled', flag);
			el.data('loading', flag);
		};
		
		let setStage = (stage) => {
			container.find('.js-pic_gen_progress_block').toggleClass('hide', stage == STAGE.NONE);
			container.find('.js-pic_gen_buttons_block').toggleClass('hide', stage != STAGE.NONE);
			
			if (stage != STAGE.NONE) {
				const STAGE_TO_TEXT = {
					[STAGE.SEND]:		L('Отправка задания...'),
					[STAGE.GENERATE]:	L('Создание изображения...'),
					[STAGE.DOWNLOAD]:	L('Загрузка файла...'),
					[STAGE.SAVE]:		L('Сохранение во Вложения...'),
				};
				const STAGE_TO_PCT = {
					[STAGE.SEND]:		20,
					[STAGE.GENERATE]:	60,
					[STAGE.DOWNLOAD]:	75,
					[STAGE.SAVE]:		95,
				};
				
				container.find('.js-pic_gen_progress_txt').text(STAGE_TO_TEXT[stage]);
				container.find('.js-pic_gen_progress_bar').css("width", STAGE_TO_PCT[stage] + '%');
			}
		};
		
		let textarea = container.find('textarea');
		let prompt = $.trim(textarea.val());
		
		if (prompt.length >= MAX_PROMPT_LENGTH) {
			Spaces.view.setInputError(textarea, L('Превышена максимальная длина запроса.'));
			return;
		}
		
		if (!prompt.length) {
			Spaces.view.setInputError(textarea, L('Необходимо ввести запрос.'));
			return;
		}
		
		if (!pushstream.avail()) {
			Spaces.view.setInputError(textarea, L('Сервис временно недоступен.'));
			return;
		}
		
		setStage(STAGE.SEND);
		setLoading(true);
		
		Spaces.api("services.ai.genPicture.addTask", {CK: null, text: textarea.val()}, (res) => {
			if (res.code != 0) {
				setStage(STAGE.NONE);
				setLoading(false);
				let error_message = Spaces.apiError(res);
				if (res.code == Codes.COMMON.ERR_OFTEN_OPERATION) {
					error_message = (
						params.type == 'avatar' ?
							L('Вы уже ранее отправили запрос на генерирование аватара. Дождитесь его завершения.') :
							L('Вы уже ранее отправили запрос на генерирование картинки. Дождитесь его завершения.')
					);
				}
				Spaces.view.setInputError(textarea, error_message);
				return;
			}
			
			let defer_stage = STAGE.GENERATE;
			let defer_timeout = setTimeout(() => {
				setStage(defer_stage);
				defer_timeout = false;
			}, 3000);
			
			setStage(STAGE.SEND);
			
			current_generation_id = res.id;
			current_generation = (message) => {
				if (message.stage) {
					if (defer_timeout) {
						defer_stage = message.stage;
					} else {
						setStage(message.stage);
					}
					return;
				}
				
				if (defer_timeout)
					clearTimeout(defer_timeout);
				
				setStage(STAGE.NONE);
				setLoading(false);
				clearTimeout(current_generation_timeout);
				
				if (message.timeout) {
					Spaces.view.setInputError(textarea, L('Не удалось сгенерировать изображение, попробуйте позже.'));
				} else if (message.error) {
					let error_text;
					if (message.error == AI_ERRORS.SERVICE_ERROR) {
						error_text = L('Ваш запрос не прошёл внутреннюю цензуру нейросети. Попробуйте другой.');
					} else if (message.error == AI_ERRORS.TIMEOUT) {
						error_text = L('Сервис временно недоступен. Попробуйте позже.')
					} else {
						error_text = L('При выполнении вашего запроса произошла ошибка. Попробуйте ещё раз.')
					}
					Spaces.view.setInputError(textarea, error_text);
				} else {
					let img = container.find('.js-pic_gen_img');
					img.replaceWith(tpl.image(updateUrlScheme(message.previewURL), `${updateUrlScheme(message.previewURL)}, ${updateUrlScheme(message.previewURL_2x)} 2x`));
					
					container.find('.js-pic_gen_selected').addClass('hide');
					container.find('.js-pic_gen_select').removeClass('hide').data({
						fileId:			message.fileId,
						fileType:		message.fileType,
						preview:		updateUrlScheme(message.previewURL),
						preview_2x:		updateUrlScheme(message.previewURL_2x),
					});
					container.find('.js-pic_gen_img_link').prop("href", updateUrl(message.fileURL));
					setScreen('results');
				}
			};
			
			current_generation_timeout = setTimeout(() => {
				current_generation && current_generation({timeout: true});
			}, pic_gen_TIMEOUT);
		}, {
			onError(err) {
				setStage(STAGE.NONE);
				setLoading(false);
				Spaces.view.setInputError(textarea, err);
			}
		});
	});
	
	// Возврат назад
	container.on('click', '.js-pic_gen_return', function (e) {
		e.preventDefault();
		e.stopPropagation();

		const toggleLoading = (flag) => {
			$(this).find('.js-ico').toggleClass('ico_spinner', flag);
		};

		toggleLoading(true);
		const prevUserPrompt = container.find('textarea').val();
		initForm(() => {
			toggleLoading(false);
			setTimeout(() => {
				setScreen('generator-form');
				container.find('textarea').val(prevUserPrompt);
			});
		});
	});
	
	// Установить на аватар
	container.on('click', '.js-pic_gen_select', function (e) {
		e.preventDefault();
		e.stopPropagation();
		
		container.find('.js-pic_gen_select').addClass('hide');
		container.find('.js-pic_gen_selected').removeClass('hide');
		
		let el = $(this);
		params.onSelect(el.data('fileId'), el.data('preview'), el.data('preview_2x'));
	});
	
	// Возврат назад
	container.on('click', '.js-pic_gen_cancel', function (e) {
		e.preventDefault();
		e.stopPropagation();
		params.onCancel();
	});
	
	// Костыль :(
	container.on('click', '.js-pic_gen_img_link', function (e) {
		e.stopPropagation();
	});
	
	setScreen('generator-form');
	
	require.component('form_toolbar');
	require.component('core/textarea-autoresize');
}

function setScreen(screen_name) {
	container.find('[data-screen]').each(function () {
		let screen = $(this);
		screen.toggleClass('hide', screen_name != screen.data('screen'));
	});
}

function destroy() {
	container.unbind().empty();
	container = null;
	current_generation = null;
	params = null;
	
	pushstream.off('*', 'pic_generator');
}

export default { init, open, destroy };
