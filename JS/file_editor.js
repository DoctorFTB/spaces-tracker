import module from 'module';
import $ from './jquery';
import Device from './device';
import {Spaces, Codes, Url} from './spacesLib';
import {L} from './utils';

var last_values = {},
	allow_fields = {
		new_name: 1,
		new_filename: 1
	},
	saving_in_process = false,
	delayed_saving = false;

function initModule(parent) {
	var form = $('#edit_form').on('text_save', 'textarea, input', function (e, data) {
		var el = this;
		if (!allow_fields[this.name])
			return;
		if (isFormChanged(form))
			saveForm(form);
	}).on('xxx_cats:saving', function (e, data) {
		setSaveBtnState(data.saved);
	});
	isFormChanged(form);
}

function setSaveBtnState(saved) {
	var status = $('button[name="cfms"]').toggleClass('disabled', !saved);
	status.find('.js-ico').toggleClass('ico_spinner', !saved);
	status.find('.js-btn_val').text(saved ? L('Готово') : L('Сохранение'));
}

function saveForm(form) {
	if (saving_in_process) {
		delayed_saving = true;
		return;
	}
	saving_in_process = true;
	
	var errors_map = {
		filename: 'new_filename',
		name: 'new_name'
	};
	
	var data = $.extend({
		Type: form.data('fileType') || 25
	}, Url.serializeForm(form));
	
	setSaveBtnState(false);
	
	Spaces.clearError("file_edit");
	
	var on_request_done = function () {
		saving_in_process = false;
		if (delayed_saving) {
			delayed_saving = false;
			if (isFormChanged(form)) {
				saveForm(form);
				return true;
			}
		}
	};
	
	Spaces.api("files.edit", data, function (res) {
		if (on_request_done())
			return;
		if (res.code != 0 && res.code != Codes.FILES.ERR_EDIT) {
			Spaces.showApiError(res, "file_edit", {onRetry: function () {
				saveForm(form);
			}});
		} else {
			if (res.code == Codes.FILES.ERR_EDIT) {
				for (var k in errors_map) {
					if (res.errors[k]) {
						Spaces.view.setInputError(form.find('[name="' + errors_map[k] + '"]'), res.errors[k]);
					}
				}
			}
			
			setSaveBtnState(true);
			$('.js-file_spinner').addClass('hide');
		}
	}, {
		onError: function (err) {
			if (on_request_done())
				return;
			Spaces.showError(err, "file_edit", {onRetry: function () {
				saveForm(form);
			}});
		}
	});
}

function isFormChanged(form) {
	var data = Url.serializeForm(form),
		changes = 0;
	for (var k in allow_fields) {
		if (("" + data[k]) != last_values[k]) {
			if (k in last_values)
				$('#file_spinner__' + k).removeClass('hide');
			
			last_values[k] = data[k] + "";
			
			++changes;
		}
	}
	return changes > 0;
}

module.on("componentpage", initModule);

