import module from 'module';
import Spaces from '../spacesLib';

module.on("componentpage", function() {
	function gebi(id) {return document.getElementById(id)}
	
	let fetched = {};
	
	function renderProfileRow(mountpoint, data, deep) {
		let id = data.hcid;
		
		let el = document.createElement('div');
		mountpoint.appendChild(el);
		el.outerHTML = gebi('profile_row_TMPL').outerHTML.replace(/TMPL/g, id);
		el = gebi(`profile_row_${id}`);
		let bgc = 255 - deep * 10;
		el.style.backgroundColor = `rgb(${bgc}, ${bgc}, ${bgc})`;
		
		gebi(`profile_row_${id}_name`).innerHTML = data.name;
		if(data.main) {
			gebi(`profile_row_${id}_main_real_time_sum`).innerHTML = (+data.main.real_time).toFixed(3);
			gebi(`profile_row_${id}_main_user_time_sum`).innerHTML = (+data.main.user_time).toFixed(3);
			gebi(`profile_row_${id}_main_cnt`).innerHTML = +data.main.cnt;
			gebi(`profile_row_${id}_main_real_time_avg`).innerHTML
				= (+data.main.real_time_avg).toFixed(3);
			gebi(`profile_row_${id}_main_user_time_avg`).innerHTML
				= (+data.main.user_time_avg).toFixed(3);
		}
		
		
		let btn = gebi(`profile_row_${id}_btn`);
		btn.addEventListener('click', function () {
			if(this.value === '-') {
				this.value = '+';
				gebi(`profile_row_${id}_subprofs`).style.display = 'none';
			} else {
				if(id in fetched) {
					this.value = '-';
					gebi(`profile_row_${id}_subprofs`).style.display = 'block';
				} else {
					this.value = '…';
					this.disabled = true;
					Spaces.api("admin_stat.telemetry",
						{
							Hcid:		id,
							Main_from:	gebi('main_from').valueAsNumber / 1000 + new Date().getTimezoneOffset() * 60,
							Main_to:	gebi('main_to').valueAsNumber / 1000 + new Date().getTimezoneOffset() * 60,
							//Ctrl_from:	gebi('ctrl_from').valueAsNumber / 1000 + new Date().getTimezoneOffset() * 60,
							//Ctrl_to:	gebi('ctrl_to').valueAsNumber / 1000 + new Date().getTimezoneOffset() * 60,
						},
						res => {
							
							fetched[id] = true;
							
							let sortField = gebi('sort').value;
							
							let subprofiles = Object.values(res.subprofiles);
							
							subprofiles.forEach(sp => {
								sp.main.user_time_avg = sp.main.cnt ? (sp.main.user_time / sp.main.cnt) : 0;
								sp.main.real_time_avg = sp.main.cnt ? (sp.main.real_time / sp.main.cnt) : 0;
							});
							
							subprofiles.sort((a, b) => {return b.main[sortField] - a.main[sortField]});
							
							subprofiles.forEach(sp => 
								renderProfileRow(gebi(`profile_row_${id}_subprofs`), sp, deep + 1));
							
							btn.value = '-';
							btn.disabled = false;
							
						}
					);
				}
			}
			return true;
		});
	}
	
	function renderStatsRow(mountpoint, data) {
		let id = data.pid + '_' + data.cid;
		
		let el = document.createElement('div');
		mountpoint.appendChild(el);
		el.outerHTML = gebi('stats_row_TMPL').outerHTML.replace(/TMPL/g, id);
		
		gebi(`stats_row_${id}_pkg`).innerHTML = data.pkg;
		gebi(`stats_row_${id}_checkpoint`).innerHTML = data.checkpoint;
		
		if(data.main) {
			gebi(`stats_row_${id}_main_real_time_sum`).innerHTML = (+data.main.real_time).toFixed(3);
			gebi(`stats_row_${id}_main_user_time_sum`).innerHTML = (+data.main.user_time).toFixed(3);
			gebi(`stats_row_${id}_main_cnt`).innerHTML = +data.main.cnt;
			gebi(`stats_row_${id}_main_real_time_avg`).innerHTML
				= (+data.main.real_time_avg).toFixed(3);
			gebi(`stats_row_${id}_main_user_time_avg`).innerHTML
				= (+data.main.user_time_avg).toFixed(3);
		}
	}
	
	renderProfileRow(gebi('profiles'), {
		hcid: 0,
		name: 'Чекпоинт'
	}, 0);
	
	renderStatsRow(gebi('stats'), {
		pkg: 'Пакет',
		checkpoint: 'Чекпоинт',
	});
	
	gebi('stats_fetch_btn').addEventListener('click', function() {
		gebi('stats').innerHTML = '';
		renderStatsRow(gebi('stats'), {
			pkg: 'Пакет',
			checkpoint: 'Чекпоинт',
		});
		
		this.value = '…';
		this.disabled = true;
		let btn = this;
		
		Spaces.api("admin_stat.telemetry",
			{
				Stats: 1,
				Main_from:	gebi('main_from').valueAsNumber / 1000 + new Date().getTimezoneOffset() * 60,
				Main_to:	gebi('main_to').valueAsNumber / 1000 + new Date().getTimezoneOffset() * 60,
				//Ctrl_from:	gebi('ctrl_from').valueAsNumber / 1000 + new Date().getTimezoneOffset() * 60,
				//Ctrl_to:	gebi('ctrl_to').valueAsNumber / 1000 + new Date().getTimezoneOffset() * 60,
			},
			res => {
				
				let sortField = gebi('sort').value;
				
				let stats = res.stats;
				
				stats.forEach(st => {
					st.main.user_time_avg = st.main.cnt ? (st.main.user_time / st.main.cnt) : 0;
					st.main.real_time_avg = st.main.cnt ? (st.main.real_time / st.main.cnt) : 0;
				});
				
				stats.sort((a, b) => {return b.main[sortField] - a.main[sortField]});
				
				stats.forEach(st => 
					renderStatsRow(gebi('stats'), st));
				
				btn.value = 'Обновить';
				btn.disabled = false;
				
				
			}
		);
		
	});
	
	document.body.appendChild(gebi('webapp_telemetry'));
	gebi('main_wrap').style.display = 'none';
});
