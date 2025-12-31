import module from 'module';
import $ from './jquery';
import {Spaces, Codes, Url} from './spacesLib';
import FileUploader from './files_uploader';
import FilesMonitor from './files_monitor';
import FilesUploader from './libs/FilesUploader';
import {L, tick} from './utils';

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

let form;
let options;

function initForm() {
	form = $('.js-files_upload_form');
	
	options = $.extend({
		type:		Spaces.TYPES.FILE,
		maxSize:	0
	}, form.data());
	
	$('#upload_spinner').addClass('hide');
	$('#upload_select_btn').removeClass('hide');
	
	// Для кривых устройств
	if (FilesUploader.needStaticUpload())
		return;
	
	form.submit((e) => {
		e.preventDefault();
		FileUploader.submit();
	});
	
	initUploader();
	initDragAndDrop();
}

function initUploader() {
	let select_btn = $('#upload_select_btn');
	
	let last_redirect;
	
	FileUploader.init({
		autoSubmit: false,
		multiple: false,
		
		onUploadStart() {
			$('#upload_button').attr("disabled", "disabled");
		},
		onSubmit(file) {
			FileUploader.setPostData(Url.serializeForm(form));
		},
		onUploadComplete() {
			$('#upload_button').removeAttr("disabled");
			
			if (last_redirect)
				Spaces.redirect(last_redirect);
		},
		onFileUpload(res, file) {
			last_redirect = res.redirect_link;
		},
		onError(error) {
			Spaces.showError(error, "upload_err");
		},
		onHideError() {
			Spaces.clearError("upload_err");
		}
	});
	
	FileUploader.setup({
		selectButton:	false,
		uploadWidget:	select_btn,
		uploadDrag:		$('#upload_form'),
		noDragClass:	true,
		denyUpload:		options.denyUpload,
		maxFiles:		1,
		action:			form.prop("action"),
		name:			select_btn.prop('name'),
		accept:			select_btn.prop('accept'),
		maxSize:		options.maxSize * 1024,
		mode:			FileUploader.MODES.WIDGET,
		type:			options.type,
		firstReset:		true,
		additionalMenu:	false
	});
	
	select_btn.on('click', (e) => {
		if (select_btn.hasClass('disabled')) {
			e.preventDefault();
			e.stopPropagation();
			e.stopImmediatePropagation();
		}
	});
}

function initDragAndDrop() {
	FilesMonitor.init();
	
	let drag_place = $('#upload_form');
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

function destroyForm() {
	form = false;
}

module.on("componentpage", () => initForm());
module.on("componentpagedone", () => destroyForm());
