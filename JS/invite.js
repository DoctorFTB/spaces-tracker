import module from 'module';
import $ from './jquery';
import {Spaces, Codes} from './spacesLib';
import {L} from './utils';

module.on("componentpage", function () {
    // отправка приглашениея на телефон и почту
    $('#main').on('click', '.js-send_invite', function (e) {
	e.preventDefault();
	e.stopPropagation();
	
	var $this = $(this);
	
	if (!$this.hasClass('js-disable')){
	    $('.text-input_error').removeClass('text-input_error');
			    
	    var el = $(this),
		type = el.data('type'),
		tempObj = {},
		method = '';
		
	    if (type == 'sms'){
			method = 'friends.inviteSMS';
			tempObj.phone = $('#js-invite_phone_sms').val();
			tempObj.from = $('#js-invite_name_sms').val();
	    } else if (type == 'email'){
			method = 'friends.inviteEmail';
			tempObj.from = $('#js-invite_name_email').val();
			tempObj.email = $('#js-invite_email_email').val();
			tempObj.text = $('#js-invite_text_email').val();
	    }
	    
	    tempObj.CK = null;
       
	    Spaces.api(method, tempObj, function (res) {
		if (res.code == Codes.COMMON.SUCCESS){
		    if (type == 'sms'){
			$this.addClass('btn_clicked js-disable').html('<span class="ico ico_ok_white"></span> ' + L('Пригласили {0}', tempObj.phone));
		    } else if (type == 'email'){
			$this.addClass('btn_clicked js-disable').html('<span class="ico ico_ok_white"></span> ' + L('Пригласили {0}', tempObj.email));
		    }
		    
		    setTimeout(function(){
			if (type == 'sms'){
			    $('#js-invite_phone_sms').val('');
			    $('#js-invite_name_sms').val('');
			} else if (type == 'email'){
			    $('#js-invite_name_email').val('');
			    $('#js-invite_email_email').val('');
			    $('#js-invite_text_email').val('');
			}
			
			$this.removeClass('btn_clicked js-disable').html(L('Отправить приглашение'));
			
		    }, 3000);
		    
		    $('.system-message').remove();
		} else {
		    Spaces.showApiError(res);
		    
		    var err = parseInt(res.code);
		    
		    if (type == 'sms'){
			if (err == Codes.COMMON.ERR_WRONG_PHONE){
			    $('#js-invite_phone_sms').addClass('text-input_error');
			} else if (err == Codes.FRIENDS.ERR_FROM){
			    $('#js-invite_name_sms').addClass('text-input_error');
			}
		    } else if (type == 'email'){
			if (err == Codes.COMMON.ERR_WRONG_EMAIL){
			    $('#js-invite_email_email').addClass('text-input_error');
			} else if (err == Codes.FRIENDS.ERR_FROM){
			    $('#js-invite_name_email').addClass('text-input_error');
			}
		    }
		}
	    });
	
	}
    });
});
