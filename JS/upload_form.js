import module from 'module';
import $ from './jquery';
import {Spaces, Codes, Url} from './spacesLib';
import notifications from './notifications';
import FileUploader from './files_uploader';
import FilesMonitor from './files_monitor';
import FilesUploader from './libs/FilesUploader';
import DdMenu from './dd_menu';
import {extend, numeral, L, html_unwrap, tick} from './utils';

import './form_controls';

const tpl = {
	dnd() {
		return `
			<div class="upload-dnd_msg js-attach_dnd">
				<div class="js-dnd_msg"></div>
			</div>
		`;
	}
};

const STATE_IDLE		= 0;
const STATE_UPLOADING	= 1;
const STATE_COMPLETE	= 2;

let form;
let options;
let current_files;
let state;
let success_uploaded;
let sync_queue;
let sync_queue_tasks;
let sync_queue_timer;

function initForm() {
	form = $('.js-files_upload_form');
	current_files = {};
	state = STATE_IDLE;
	success_uploaded = 0;
	sync_queue_timer = false;
	sync_queue = [];
	sync_queue_tasks = {};
	
	options = $.extend({
		type:			Spaces.TYPES.FILE,
		maxFiles:		1,
		maxSize:		0
	}, form.data());
	
	// Для кривых устройств
	if (FilesUploader.needStaticUpload()) {
		$('#upload_ajax_form').hide();
		$('#upload_fallback_form').show();
		return;
	}
	
	form.on('blur change', '.js-upload_file textarea, .js-upload_file input', function () {
		let file_id = $(this).parents('.js-upload_file').data("id");
		tick(() => syncFileFields(current_files[file_id]));
	});
	
	$('#upload_cancel_btn').on('click', function (e) {
		e.preventDefault();
		e.stopPropagation();
		
		if ($(this).hasClass('disabled'))
			return;
		
		FileUploader.getUploader().cancel();
	});
	
	$('#upload_save_btn').on('click', function (e) {
		e.preventDefault();
		e.stopPropagation();
		
		let save_btn = $(this);
		if (save_btn.hasClass('disabled'))
			return;
		
		save_btn.addClass('disabled');
		save_btn.find('.ico').addClass('ico_spinner');
		
		saveAllFiles((success) => {
			save_btn.removeClass('disabled');
			save_btn.find('.ico').removeClass('ico_spinner');
			
			if (success) {
				Spaces.redirect(save_btn.prop("href"));
			} else {
				// Скроллим до файла с ошибкой
				let file_with_error = hasErrors();
				$('html, body').scrollTo($(`#upload_file_${file_with_error}`), {position: 'visible'});
			}
		});
		
		FileUploader.getUploader().cancel();
	});
	
	$('#upload_start_btn').on('click', function (e) {
		e.preventDefault();
		
		let upload_btn = $(this);
		if (upload_btn.hasClass('disabled'))
			return;
		
		upload_btn.addClass('disabled');
		upload_btn.find('.ico').addClass('ico_spinner');
		
		saveAllFiles((success) => {
			upload_btn.removeClass('disabled');
			upload_btn.find('.ico').removeClass('ico_spinner');
			
			if (success) {
				FileUploader.submit();
			} else {
				// Скроллим до файла с ошибкой
				let file_with_error = hasErrors();
				$('html, body').scrollTo($(`#upload_file_${file_with_error}`), {position: 'visible'});
			}
		});
	});
	
	initUploader();
	initDragAndDrop();
}

function initUploader() {
	let use_native_button = FilesUploader.needNtiveControls();
	
	let files_place = $('#upload_files_list');
	let files_place_wrap = $('#upload_files_wrap');
	let native_select_btn = $('#upload_native_btn');
	let select_btn = $('#upload_select_btn');
	let save_btn = $('#upload_save_btn');
	let last_redirect;
	
	FileUploader.init({
		autoSubmit: false,
		multiple: true,
		
		onSubmit(file) {
			FileUploader.setPostData(serializeForm(file));
		},
		onUploadStart() {
			state = STATE_UPLOADING;
			updateFormState();
			
			// Скроллим в начало списка
			if (FileUploader.getUploader().total() > 1)
				$('html, body').scrollTop(0);
			
			// form.find('.js-upload_file_fields').addClass('hide');
		},
		onUploadComplete() {
			if (success_uploaded) {
				state = STATE_COMPLETE;
				
				if (notifications && !notifications.isWindowActive()) {
					let msg = success_uploaded > 1 ? L("Файлы успешно загружены") : L("Файл успешно загружен");
					notifications.showNewEvent(msg, {oneTab: true});
				}
				
				if (options.maxFiles == 1)
					Spaces.redirect(last_redirect);
			} else {
				// Если не удалось загрузить файлы, возвращаем форму в изначальное состояние
				state = STATE_IDLE;
			}
			
			updateFormState();
		},
		onFileUpload(res, file) {
			last_redirect = res.redirect_link;
			
			if (res.data) {
				success_uploaded++;
				
				current_files[file.id].nid = res.data.nid;
				current_files[file.id].filename = html_unwrap(res.data.filename);

				$(`#upload_file_${file.id}`).trigger('fileUploaded', res.data);
			}
			
			let url = success_uploaded > 1 ? res.data.dirLink : res.redirect_link;
			save_btn.prop("href", url);
		},
		onNewFileAdd(data) {
			if (options.maxFiles == 1)
				form.find('.js-upload_remove').first().click();
			
			files_place.append(data.widget);
			updateFileNumbers();
			
			current_files[data.file.id] = {
				tid:		Date.now(),
				id:			data.file.id,
				ext:		data.file.ext,
				type:		options.type,
				fields:		Url.serializeForm($(`#upload_file_${data.file.id}`)),
				errors:		{}
			};
			
			// Убираем лимиты
			$(`#upload_file_${data.file.id} [maxlength]`).each(function () {
				$(this).removeAttr('maxlength').removeAttr('minlength');
			});
			
			// Заранее валидируем файл
			syncFileFields(current_files[data.file.id]);
			
			if (options.type == Spaces.TYPES.MUSIC) {
				$(`#upload_name_input_${data.file.id}`)
					.attr("disabled", "disabled")
					.attr("readonly", "readonly");
			}
			
			updateFormState();
		},
		onRemoveFile(e) {
			delete current_files[e.id];
			tick(() => {
				updateFileNumbers();
				updateFormState()
			});
		},
		onError(error) {
			Spaces.showError(error, "upload_err");
		},
		onHideError() {
			Spaces.clearError("upload_err");
		},
		onFilesChunkEnd() {
			updateFormState();
		}
	});
	
	FileUploader.setup({
		selectButton:	use_native_button ? false : select_btn,
		uploadWidget:	use_native_button ? native_select_btn : false,
		uploadDrag:		$('#upload_form_draggable'),
		noDragClass:	true,
		denyUpload:		options.denyUpload,
		maxFiles:		options.maxFiles,
		action:			form.prop("action"),
		name:			select_btn.prop('name'),
		accept:			select_btn.prop('accept'),
		maxSize:		options.maxSize * 1024,
		mode:			FileUploader.MODES.WIDGET,
		type:			options.type,
		firstReset:		true,
		additionalMenu:	true,
		filenameAutocomplete:	options.filenameAutocomplete
	});
	
	select_btn.on('click', (e) => {
		if (select_btn.hasClass('disabled')) {
			e.preventDefault();
			e.stopPropagation();
			e.stopImmediatePropagation();
		}
	});
	
	// Скрываем спиннер
	select_btn.find('.js-spinner').remove();
	
	if (use_native_button) {
		form.find('.js-upload_native_btn').removeClass('hide');
	} else {
		form.find('.js-upload_btn').removeClass('hide');
	}
}

function updateFileNumbers() {
	let counter= 1;
	form.find('.js-upload_file_number').each(function () {
		$(this).text(counter++);
	});
}

function syncFileFields(file, callback) {
	if (sync_queue_tasks[file.id]) {
		sync_queue_tasks[file.id][1].push(callback);
	} else {
		sync_queue_tasks[file.id] = [file, [callback]];
		sync_queue.push(file.id);
	}
	
	if (!sync_queue_timer)
		sync_queue_timer = tick(syncFileFieldsTask);
}

function syncFileFieldsTask() {
	if (!sync_queue.length) {
		sync_queue_timer = false;
		return;
	}
	
	let file_id = sync_queue.shift();
	let task = sync_queue_tasks[file_id];
	
	delete sync_queue_tasks[file_id];
	
	syncFileFieldsAsync(task[0], (success) => {
		sync_queue_timer = tick(syncFileFieldsTask);
		
		for (let i = 0; i < task[1].length; i++)
			task[1][i] && task[1][i](success);
	});
}

function syncFileFieldsAsync(file, callback) {
	let new_fields = Url.serializeForm($(`#upload_file_${file.id}`));
	
	let changed = 0;
	
	for (let k in new_fields) {
		if (file.fields[k] !== new_fields[k])
			changed++;
	}
	
	for (let k in file.fields) {
		if (file.fields[k] !== new_fields[k])
			changed++;
	}
	
	file.fields = new_fields;
	
	if (!new_fields.Adult)
		new_fields.Adult = 0;

	if (changed > 0 || !file.validated) {
		saveFile(file, callback);
	} else {
		callback && callback(!file.error);
	}
}

function saveAllFiles(callback) {
	let counter = 0;
	let summary_success = true;
	
	let on_file_sync = (success) => {
		counter--;
		
		if (!success)
			summary_success = false;
		
		if (counter == 0) {
			if (!summary_success)
				showAllFileErrors();
			
			callback && callback(summary_success);
		}
	};
	
	for (let file_id in current_files)
		counter++;
	
	for (let file_id in current_files)
		syncFileFields(current_files[file_id], on_file_sync);
}

function setFileErrors(file, errors) {
	file.errors = errors;
	file.error = !$.isEmptyObject(errors);
}

function showAllFileErrors() {
	for (let file_id in current_files)
		showFileErrors(current_files[file_id]);
}

function showFileErrors(file) {
	let file_wrap = $(`#upload_file_${file.id}`);
	
	let errors_map = {
		filename:		'fn',
		new_filename:	'fn',
		name:			'descrR',
		CaT:			'cats_q',
		caT:			'cats_q',
	};
	
	let focused = document.activeElement;
	let common_error = [];
	
	for (let k in file.errors) {
		let element = file_wrap.find(`[name=${errors_map[k] || k}]`);
		if (element.length) {
			if (element[0] != focused)
				Spaces.view.setInputError(element, file.errors[k]);
		} else {
			console.log('err', k, errors_map[k] || k, file.errors[k]);
			common_error.push(file.errors[k]);
		}
	}
	
	if (common_error.length)
		Spaces.showError(common_error.join('<br />'));
}

function saveFile(file, callback) {
	let api_data;
	let api_method;
	
	if (file.nid) {
		let new_fields = $.remap({
			descrR:		'new_name',
			fn:			'new_filename'
		}, file.fields);
		
		api_method = "files.edit";
		
		api_data = $.extend({
			CK:			null,
			File_id:	file.nid,
			Type:		file.type
		}, new_fields);
	} else {
		api_method = "files.setTempInfo";
		
		api_data = $.extend({
			CK:			null,
			TempId:		file.tid,
			Type:		file.type,
			Dir:		form.find('[name=dir]').val(),
			ext:		file.ext
		}, file.fields);
	}
	
	FileUploader.showFileSpinner(file.id, true);
	updateFormState();
	
	// Редактирование загруженного файла
	Spaces.cancelApi(file.edit_req);
	
	file.validated = false;
	
	file.edit_req = Spaces.api(api_method, api_data, (res) => {
		if (res.code == Codes.FILES.ERR_EDIT) {
			callback && callback(false);
			
			file.validated = true;
			
			setFileErrors(file, res.errors || {});
		} else if (res.code != 0) {
			callback && callback(false);
			
			setFileErrors(file, {filename: `${L("Ошибка проверки файла:")}<br />${Spaces.apiError(res)}`});
		} else {
			callback && callback(true);
			
			file.validated = true;
			
			setFileErrors(file, {});
		}
		
		FileUploader.showFileSpinner(file.id, false);
		updateFormState();
	}, {
		onError: (err) => {
			callback && callback(false);
			
			setFileErrors(file, {filename: `${L("Ошибка проверки файла:")}<br />${err}`});
			
			FileUploader.showFileSpinner(file.id, false);
			updateFormState();
		}
	});
}

function initDragAndDrop() {
	FilesMonitor.init();
	
	let drag_place = $('#upload_form_draggable');
	drag_place.append(tpl.dnd());
	
	// Показываем или скрывание сообщение про DND
	$('#main').on('dragGlobalStart', function () {
		drag_place.addClass('upload-dnd_msg_show');
	}).on('dragGlobalEnd', function () {
		drag_place.removeClass('upload-dnd_msg_show');
	});
	
	drag_place.on('fileDragStart fileDragEnd', (e) => {
		let is_active = e.type == 'fileDragStart';
		
		drag_place
			.find('.upload-dnd_msg')
			.toggleClass('upload-dnd_msg_active', is_active)
			.find('.js-dnd_msg')
			.text(!is_active ? L('Отпустите клавишу мыши, чтобы добавить файл.') : L('Перенесите сюда файлы, чтобы добавить файл.'));
	});
}

function hasErrors() {
	for (let file_id in current_files) {
		let file = current_files[file_id];
		if (file.error)
			return file.id;
	}
	return false;
}

function updateFormState() {
	let files_place = $('#upload_files_list');
	let files_place_wrap = $('#upload_files_wrap');
	let select_btn = $('#upload_select_btn');
	
	let selected_files = files_place.children().length;
	let invalid_files = files_place.children('.js-upload_has_error').length;
	
	files_place_wrap.toggle(selected_files > 0);
	
	form.find('.js-upload_state-selected').toggle(selected_files > 0);
	form.find('.js-upload_state-preupload').toggle(selected_files > 0 && state == STATE_IDLE);
	form.find('.js-upload_state-uploading').toggle(state == STATE_UPLOADING || state == STATE_COMPLETE);
	
	let disable_select_btn = (state != STATE_IDLE);
	
	// Блокируем кнопку выбора файла
	select_btn.toggleClass('disabled', disable_select_btn);
	
	if (FilesUploader.needNtiveControls()) {
		select_btn.find('.js-upload_btn').toggleClass('hide', !disable_select_btn);
		select_btn.find('.js-upload_native_btn').toggleClass('hide', disable_select_btn);
	}
	
	// Блокируем кнопку загрузки
	let can_upload = selected_files > 0 && selected_files > invalid_files;
	$('#upload_start_btn').toggleClass('disabled', !can_upload);
	
	// Кнопки сохранения и отмены
	$('#upload_save_btn').toggleClass('disabled', state != STATE_COMPLETE);
	$('#upload_cancel_btn').toggleClass('disabled', state != STATE_UPLOADING);
	
	// Обновляем заголовок формы
	let titles = {
		[STATE_IDLE]:		[L('Выбран $n файл'), L('Выбрано $n файла'), L('Выбрано $n файлов')],
		[STATE_UPLOADING]:	[L('Выгружаем $n файл'), L('Выгружаем $n файла'), L('Выгружаем $n файлов')],
		[STATE_COMPLETE]:	[L('Файл загружен'), L('Файлы загружены'), L('Файлы загружены')]
	};
	$('#upload_header_text').text(numeral(selected_files, titles[state]));
}

function serializeForm(file) {
	let main_form = Url.serializeForm(form);
	let unsolicited_params = Url.serializeForm($('#upload_files_list'));
	
	for (let k in unsolicited_params)
		delete main_form[k];
	
	main_form.TempId = current_files[file.id].tid;
	
	return main_form;
}

function destroyForm() {
	form = false;
	current_files = false;
	sync_queue = false;
	sync_queue_tasks = false;
	sync_queue_timer = false;
}

module.on("componentpage", () => initForm());
module.on("componentpagedone", () => destroyForm());
