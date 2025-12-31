import module from 'module';
import $ from './jquery';
import {Spaces, Url} from './spacesLib';
import page_loader from './ajaxify';
import {HistoryManager} from './ajaxify';
import GALLERY from './gallery';
import {GalleryLoader} from './gallery';
import {L} from './utils';

var share2lt = {
	1: Spaces.FILES_LIST.NEW_FILES,
	2: Spaces.FILES_LIST.POPUlAR_NOW,
	3: Spaces.FILES_LIST.POPULAR_ALLTIME,
	4: Spaces.FILES_LIST.POPULAR_MONTH
};
var last_pgnav_req;
var tpl = {
	pagenavLoader: function () {
		return '<span class="ico ico_spinner m" /> <span class="m">' + L('Загрузка...') + '</span>';
	}
};

module.on("componentpage", function () {
	if (!page_loader.ok())
		return;
	
	var files_wrap = $('#sz_gallery_loader');
	if (files_wrap.data('moder') && !gallery_moder_enabled())
		return;
	var type = files_wrap.data('type');
	
	var cur_url = new Url(location.href),
		api_data, api_method = 'files.getFiles';
	
	if (type == 'user') {
		api_data = {
			address: cur_url.val('address'),
			name: cur_url.val('name'),
			Link_id: cur_url.val('Link_id'),
			Lt: cur_url.val('Lt') || cur_url.val('lt') || Spaces.FILES_LIST.DIRS,
			Dir: cur_url.val('Dir') || cur_url.val('dir') || 0,
			Mode: Spaces.RENDER_MODE.TILE
		};
	} else if (type == 'sz') {
		api_data = {
			Link_id: cur_url.val('Link_id'),
			Lt: share2lt[cur_url.val('list')] || cur_url.val('Lt') || cur_url.val('lt') || Spaces.FILES_LIST.DIRS,
			Dir: cur_url.val('Dir') || cur_url.val('dir') || 0,
			Sz: 1,
			Mode: Spaces.RENDER_MODE.TILE
		};
	}
	
	var pgn = get_pagination(),
		pgn_data = pgn.data() || {},
		base_url = new Url(pgn_data.url);
	
	var limit = pgn_data.on_page,
		total = pgn_data.count,
		offset = limit * (pgn_data.page - 1);
	
	GalleryLoader.setupLoaders(files_wrap.data({
		// apiData: $.extend(api_data, base_url.query),
		apiData: api_data,
		apiMethod: api_method,
		total: total,
		offset: offset,
		limit: limit,
		gc: true,
		hasMore: pgn.length > 0,
		itemWrap: '.js-file_item'
	}));
	
	files_wrap.on('galleryExit', function (e, data) {
		if (!pgn.length)
			return;
		
		var api_data = {
			Op: pgn_data.on_page,
			Flags: pgn_data.flags,
			url: pgn_data.url,
			pn: pgn_data.param,
			Cnt: data.total
		};
		api_data[pgn_data.param] = data.page;
		
		var current_pagenav = get_pagination();
		if (current_pagenav.data('page') != data.page) {
			pagination_spinner(current_pagenav);
			Spaces.cancelApi(last_pgnav_req);
			last_pgnav_req = Spaces.api("common.getPagination", api_data, function (res) {
				if (res.code == 0)
					get_pagination().off().replaceWith(res.pagination);
				else
					Spaces.showError(res);
			}, {
				retry: 5
			});
		}
	});
	
	files_wrap.on('galleryPageChanged', function (e, data) {
		if (!pgn.length)
			return;
		var dir = data.page - data.lastPage;
		if (dir > 0) {
			data.prevFiles.append(files_wrap.find('.js-file_item'));
		} else {
			data.nextFiles.prepend(files_wrap.find('.js-file_item'));
		}
		files_wrap.append(data.files);
		
		var curl = new Url(location.href);
		curl.query[pgn_data.param] = data.page;
		HistoryManager.replaceState(HistoryManager.state, document.title, curl.url(true));
		HistoryManager.pushState(HistoryManager.state, document.title, curl.url());
	});
});

function gallery_moder_enabled() {
	var k = "sz_gallery", enabled = Spaces.LocalStorage.get(k) === "true";
	$('#sz_gallery_sw').click(function () {
		Spaces.LocalStorage.set(k, !enabled);
		Spaces.redirect();
	}).css("opacity", enabled ? 1 : 0.5).attr("title", L("Просмотрщик")).show();
	return enabled;
}

function get_pagination() {
	return $('.pgn').first();
}

function pagination_spinner(pgn) {
	pgn.find('.pgn__range').html(tpl.pagenavLoader());
	pgn.find('.js-pagenav_toggle.pgn__button_press').click();
	pgn.find('.pgn__link, .pgn__button').addClass('pgn__link_disabled');
	pgn.click(function (e) {
		e.preventDefault();
		e.stopPropagation();
	}).css("pointer-events", "none");
}
