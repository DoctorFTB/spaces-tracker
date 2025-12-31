import module from 'module';
import cookie from './cookie';
import Spaces from './spacesLib';
import {ge, ce} from './utils';

const TIME_COLORS = [
	{ MIN: undefined,	MAX: 0.05,		BG: '#0dad59',	FG: 'white',	PSI: 'быстро',	GSC: 'быстро' },
	{ MIN: 0.05,		MAX: 0.1,		BG: '#87a12c',	FG: 'white',	PSI: 'средне',	GSC: 'быстро' },
	{ MIN: 0.1,			MAX: 0.25,		BG: '#faac00',	FG: 'black',	PSI: 'средне',	GSC: 'средне' },
	{ MIN: 0.25,		MAX: 0.3,		BG: '#fa7a21',	FG: 'black',	PSI: 'медленно',GSC: 'средне' },
	{ MIN: 0.3,			MAX: undefined,	BG: '#ed423d',	FG: 'white',	PSI: 'медленно',GSC: 'медленно' },
];
const METRICS = {
	__TIME__:		{PRECISION: 3, HEADER: '⟨rt⟩',	TITLE: 'Среднее реальное время'},
	__UTIME__:		{PRECISION: 2, HEADER: '⟨ut⟩',	TITLE: 'Среднее userland время'},
	__CNT__:		{PRECISION: 0, HEADER: '#',		TITLE: 'Кол-во вызовов'},
	__TIME__SUM__:	{PRECISION: 3, HEADER: 'Σ rt',	TITLE: 'Суммарное реальное время'},
	__UTIME__SUM__: {PRECISION: 2, HEADER: 'Σ ut',	TITLE: 'Суммарное userland время'},
};

let state, url_hash_params, first_init = false;

module.on("componentpage", function () {
	url_hash_params = new urlHashParams();
	state = {
		from: url_hash_params.get( 'from' )
			|| new Date( Math.round( new Date() / 300000 ) * 300000 - 86400000 ).toISOString().split( /\./ )[ 0 ],
		to: url_hash_params.get( 'to' )
			|| new Date( Math.round( new Date() / 300000 ) * 300000 ).toISOString().split( /\./ )[ 0 ],
		sort: '__TIME__SUM__',
		prof_data: {},
		expandeds: {},
		mode: undefined,
		metric_width: {
			__TIME__: 7,
			__UTIME__: 6,
			__CNT__: 3,
			__TIME__SUM__: 7,
			__UTIME__SUM__: 6,
		},
	};
	let param_show = url_hash_params.get( 'show' );
	if ( param_show ) {
		param_show = param_show.split( '==>' );
		let e = '';
		for ( let ps of param_show ) {
			if ( !ps.length )
				continue;
			e = e + '==>' + ps;
			state.expandeds[ e ] = true;
		}
	} else {
		state.expandeds = {
			'==>runner task': true,
			'==>WebApp::run': true,
		};
	}
	
	const stats_page = ge( "#prof_stats_page" );
	if ( stats_page )
		render_stats_page( stats_page );
	else {
		const debug_wdget = ge( '#webapp_prof' );
		debug_wdget.removeAttribute('onclick');
		
		if ( debug_wdget ) {
			if ( cookie.get( "webapp_prof" ) ) { // Профилирование включено
				state.mode = 'LOADING';
		
				Spaces.api( "system_prof.fetch_frames", {}, function ( res ) {
					if ( res.code != 0 ) {
						Spaces.showApiError( res );
						return;
					}
			
					state.prof_data = res.data;
					state.mode = 'ON';
				
					for ( let name in state.prof_data )
						upd_metric_width( state.prof_data[ name ] );
			
					render_debug_widget( debug_wdget );
				}, {
					onError: ( err ) => Spaces.showError( err )
				} );
		
			} else { // Профилирование можно включить
				state.mode = 'OFF';
			}
	
			render_debug_widget( debug_wdget );
			
			if (!first_init) {
				first_init = false;
				
				if (state.mode == "OFF")
					ge('#webapp_prof_enable').click();
			}
		}
	}
});

function upd_metric_width( prof_data ) {
	let changed = false;
	for ( let k in prof_data ) {
		if ( k in state.metric_width ) {
			const l = Number( prof_data[ k ] ).toFixed( METRICS[ k ].PRECISION ).toString().length;
			if ( l > state.metric_width[ k ] ) {
				state.metric_width[ k ] = l;
				changed = true;
			}
		}
		else if ( k !== '__HCID__' ) {
			upd_metric_width( prof_data[ k ] );
		}	
	}
	return changed;
}
	
function render_metric( container, type, value ) {
	let text = value === undefined
		? METRICS[ type ].HEADER
		: Number( value ).toFixed( METRICS[ type ].PRECISION ).toString()
		;
	
	if ( value === undefined && type === state.sort )
		text = '↓ ' + text;
	
	for ( let l = text.length; l < state.metric_width[ type ]; l++ )
		text = '&nbsp' + text;
	
	let metric = container.querySelector( `span[data-type='${type}']` );
	if ( !metric ) {
		metric = container.appendChild( ce( 'span',
			{ title: METRICS[ type ].TITLE },
			{ float: 'right', margin: '5px', 'white-space': 'pre', 'font-weight': ( value === undefined ? 'bold' : 'normal' ) },
			{ 'data-type': type },
		) );
		metric.addEventListener( 'click', ( ev ) => {
			state.sort = type;
			render_prof_node( container.parentElement, null, state.prof_data, '', 0 );
		} );
	}
	metric.innerHTML = text;
}

function render_metrics_block( container ) {
	return container.querySelector( "span[data-type='metrics']" )
		|| container.appendChild( ce( 'span', {}, { float: 'right', 'white-space': 'pre' }, { 'data-type': 'metrics' } ) );
}

function render_metric_values( container, data ) {
	container = render_metrics_block( container );
	for ( let m of Object.keys( METRICS ).reverse() )
		render_metric( container, m, data[ m ] );
}

function render_debug_widget( container ) {
	container.innerHTML = '';
	
	const anchor2stats = ce( 'a',
		{ href: '/admin/stat/prof/', innerText: 'Статистика профилирования' },
		{ float: 'left', margin: '5px', 'text-decoration': 'underline !important' }
	);
	
	if ( state.mode === 'OFF' ) {
		const switch_on_btn = ce( 'button', { innerHTML: 'Включить профилирование', id: 'webapp_prof_enable' }, { float: 'left', maring: '1px' } );
		switch_on_btn.addEventListener( 'click', () => {
			
			switch_on_btn.disabled = true;
			
			Spaces.api( "system_prof.get_token", {}, function ( res ) {
				
				switch_on_btn.disabled = false;
				
				if ( res.code != 0 ) {
					Spaces.showApiError( res );
					return;
				}
				
				cookie.set( "webapp_prof", res.token );
				
				state.prof_data = {};
				state.mode = 'ON';
				
				render_debug_widget( container );
			}, {
				onError: ( err ) => Spaces.showError( err )
			} );
		} );
		
		container.appendChild( switch_on_btn );
		container.appendChild( anchor2stats );
	} else {
		
		
		if ( state.mode === 'LOADING' ) {
			container.appendChild( ce( 'span', { className: 'grey', innerText: 'Загрузка...' }, { float: 'left', margin: '4px' } ) );
		}
		else if ( state.mode === 'ON' ) {
			
			if ( !Object.keys( state.prof_data ).length ) {
				container.appendChild( ce( 'span',
					{ className: 'grey', innerText: 'Нет данных', title: 'С момента последнего включения профилирования или показа профиля не собрано новых данных' },
					{ float: 'left', margin: '4px' }
				) );
			} else {
				
				const prof_node = container.querySelector( `div[data-node-name='root'` )
					|| container.appendChild( ce( 'div', {}, { 'margin-top': '1px' }, { 'data-node-name': 'root' } ) );
				
				render_prof_node( prof_node, 'Профили', state.prof_data, '', 0 );
			}
		}
		
		const switch_off_btn = ce( 'button', { innerHTML: 'Выключить профилирование' }, { float: 'left', maring: '1px' } );
		switch_off_btn.addEventListener( 'click', () => {
			cookie.remove( "webapp_prof" );
			state.mode = 'OFF';
			render_debug_widget( container );
		} );
		container.appendChild( switch_off_btn );
		container.appendChild( anchor2stats );
		
		const legend = container.appendChild( ce( 'span',
			{ title: 'Легенда цветовой дифференциации времени выполнения запросов' },
			{ float: 'left', margin: '5px' },
			{ 'data-type': 'legend' },
		) );
		for ( let tc of TIME_COLORS )
			legend.appendChild(
				ce( 'span',
					{
						innerText: `${tc.MIN === undefined ? '0' : tc.MIN * 1000}${tc.MAX === undefined ? '+' : '-' + tc.MAX * 1000}мс`,
						title: `PageSpeed Insights: ${tc.PSI}\nGoogle Search Console: ${tc.GSC}`,
					}, {
						backgroundColor: tc.BG,
						color: tc.FG,
						margin: '2px',
						padding: '2px 5px',
						'border-radius': '7px',
					}
				)
			);
		
		
		container.appendChild( ce( 'br', {}, { clear: 'both' } ) );
	}
}

function render_prof_node( container, node_name, prof_data, path, level, refetch = false ) {
	
	container.dataset.hcid = prof_data.__HCID__;
	container.style.marginLeft = level > 1 ? '20px' : 0;
	container.style.borderRadius = '11px 0 0 11px';
	
	let subnodes = container.querySelector( "div[data-type='subnodes']" );
	if ( refetch && subnodes )
		subnodes.remove();
	
	subnodes = container.querySelector( "div[data-type='subnodes']" )
		|| ce( 'div', {}, { 'padding-bottom': '1px' }, { 'data-type': 'subnodes' } );
	
	for ( let name in prof_data ) {
		if ( !( name in METRICS ) && name !== '__HCID__' ) {
			
			const subcontainer = subnodes.querySelector( `div[data-node-name='${name}'` ) || subnodes.appendChild( ce( 'div', {}, { 'margin-top': '1px' }, { 'data-node-name': name } ) );
			if ( level === 0 && /^WebApp::run /.test( name ) ) {
				for ( let tc of TIME_COLORS ) {
					if ( ( tc.MIN === undefined || prof_data[name].__TIME__ > tc.MIN )
						&& ( tc.MAX === undefined || prof_data[name].__TIME__ <= tc.MAX )
					) {
						subcontainer.style.backgroundColor = tc.BG;
						subcontainer.style.color = tc.FG;
					}
				}
			} else {
				subcontainer.style.backgroundColor = '#' + [ 1, 2, 3 ].map( _ => Number( 14 - level ).toString( 16 ) ).join( '' );
				subcontainer.style.color = level >= 12 ? 'white' : 'black';
			}
			render_prof_node( subcontainer, name, prof_data[ name ], path + '==>' + name, level + 1, refetch );
		}
	}
	subnodes.hidden = level > 0 && ( !state.expandeds[ path ] || !subnodes.children.length );
	
	for ( let m in METRICS )
		container.dataset[ m ] = prof_data[ m ];
	
	
	if ( level > 0 ) {
		const expand_btn = ( container.querySelector( 'button' )
			|| container.appendChild( ce( 'button',
				{
					onclick: function ( ev ) {
						
						if ( prof_data.__HCID__ && !state.expandeds[ path ] && !subnodes.children.length ) {
							this.disabled = true;
							fetch_data( prof_data, () => {
								state.expandeds[ path ] = true;
								render_prof_node( container, node_name, prof_data, path, level );
								this.disabled = false;
							} );
						} else {
							state.expandeds[ path ] = !state.expandeds[ path ];
							render_prof_node( container, node_name, prof_data, path, level );
						}
					},
				},
				{ 'min-width': '20px', 'width': '20px', 'height': '20px', 'padding': 0, 'margin': '2px', 'border-radius': '10px' },
			) )
		);
		expand_btn.innerText = state.expandeds[ path ] ? '-' : '+';
		
		if ( !subnodes.children.length ) {
			if(prof_data.__HCID__ ) {
				if( state.expandeds[ path ] ) {
					state.expandeds[ path ] = false;
					expand_btn.dispatchEvent( new Event( 'click' ) );
				}
			} else {
				expand_btn.hidden = true;
			}
		}
	}
	
	
	if ( node_name ) {
		const href = new urlHashParams().set( 'show', path ).location();
		container.querySelector( "a[data-type='node_name']" )
			|| container.appendChild( ce( 'a',
				{ name: path, innerHTML: node_name, href },
				{ display: 'inline-block', margin: '5px', color: container.style.color, 'text-decoration': 'underline !important' },
				{ 'data-type': 'node_name' },
			) );
	}
	
	
	render_metric_values( container, prof_data );
	
	let sns = Array.from(subnodes.children);
	sns.sort( ( a, b ) => b.dataset[ state.sort ] - a.dataset[ state.sort ] );
	for ( let sn of sns ) {
		sn.remove();
		subnodes.appendChild( sn );
	}
	
	if(! subnodes.parent)
		container.appendChild( subnodes );
	
	container.querySelector( `br[data-path='${path}']` )
		|| container.appendChild( ce( 'br', {}, { clear: 'both' }, { 'data-path': path } ) );
}

class urlHashParams {
	constructor() {
		if(document.location.hash.includes('='))
			for ( let p of document.location.hash.substr( 1 ).split( '&' ) )
				this[ p.substring( 0, p.indexOf( '=' ) ) ] = decodeURI(p.substring( p.indexOf( '=' ) + 1 ));
	}
	get( name ) {
		return this[ name ];
	}
	set( name, value ) {
		if ( value === undefined )
			delete ( this[ name ] );
		else
			this[ name ] = value;
		return this;
	}
	upd_location() {
		document.location.hash = this.location();
	}
	location() { 
		const loc = '#' + Object.keys( this ).sort().map( _ => `${_}=${this[ _ ]}` ).join( '&' );
		return loc;
	}
}

function fetch_data( prof_data, cb ) {
	
	if ( !( '__HCID__' in prof_data ) )
		throw new Error( 'no HCID' );
	
	Spaces.api( "system_prof.get_stats",
		{
			Hcid: prof_data.__HCID__,
			From: new Date( state.from ) / 1000,
			To: new Date( state.to ) / 1000,
		},
		function ( res ) {
			if ( res.code != 0 ) {
				Spaces.showApiError( res );
				return;
			}
			
			for ( let k in prof_data )
				if(! (k in METRICS))
					delete ( prof_data[ k ] );
			
			Object.assign( prof_data, res.data );
			
			/*
			if ( upd_metric_width( prof_data ) ) {
				render_prof_node( root_prof_node, 'Чекпоинты', state.prof_data, '', 0 );
			}
			*/
			
			cb();
		},
		{
			onError: ( err ) => {
				if ( err.status == 502 )
					setTimeout( () => { fetch_data( prof_data, cb ) }, 1000 );
				else
					throw new Error(err);
			}
		}
	);
}

function render_stats_page( container ) {
	
	const form = container.querySelector( 'form' ) || container.appendChild( ce( 'form' ) );
	
	Array.from(form.childNodes).filter( _ => _.nodeValue === 'Период с ' ).length || form.appendChild( document.createTextNode( 'Период с ' ) );
	const from_date = form.querySelector( 'input#from-date' )
		|| form.appendChild( ce( 'input', { id: 'from-date', type: 'date', value: state.from.split( 'T' )[ 0 ], required: true } ) );
	const from_time = form.querySelector( 'input#from-time' )
		|| form.appendChild( ce( 'input', { id: 'from-time', type: 'time', value: state.from.split( 'T' )[ 1 ], required: true, step: 300 } ) );
	
	Array.from(form.childNodes).filter( _ => _.nodeValue === ' по ' ).length || form.appendChild( document.createTextNode( ' по ' ) );
	const to_date = form.querySelector( 'input#to-date' )
		|| form.appendChild( ce( 'input', { id: 'to-date', type: 'date', value: state.to.split( 'T' )[ 0 ], required: true } ) );
	const to_time = form.querySelector( 'input#to-time' )
		|| form.appendChild( ce( 'input', { id: 'to-time', type: 'time', value: state.to.split( 'T' )[ 1 ], required: true, step: 300 } ) );
	
	const root_prof_node = container.querySelector( 'div#root_prof_node' ) || ce( 'div', { id: 'root_prof_node' } );
	
	const fetch_btn = ( form.querySelector( 'input[type=submit]' )
		|| form.appendChild( ce( 'input',
			{
				type: 'submit', value: 'Получить',
				onclick: function ( ev ) {
					state.prof_data = { __HCID__: 0 };
					state.from = from_date.value + 'T' + from_time.value;
					url_hash_params.set( 'from', state.from );
					state.to = to_date.value + 'T' + to_time.value;
					url_hash_params.set( 'to', state.to );
					url_hash_params.upd_location();
					
					fetch_data( state.prof_data, () => render_prof_node( root_prof_node, 'Чекпоинты', state.prof_data, '', 0, true ) );
					ev.preventDefault();
					return false;
				}
			},
			{ margin: '0 5px', padding: '4px 15px' },
		) )
	);
	
	
	if ( !root_prof_node.parentElement )
		container.appendChild( root_prof_node );
	
	render_prof_node( root_prof_node, 'Чекпоинты', state.prof_data, '', 0 );
	
	fetch_btn.dispatchEvent( new Event( 'click' ) );
}
