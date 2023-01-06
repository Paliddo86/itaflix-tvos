/* eslint camelcase: "off" */

import { supportUHD } from '../request/adc';

export default {
  'auth-checking': 'Verifica sottoscrizione...',

  'menu-my': 'My',
  'menu-tvshows': 'Serie TV',
  'menu-movies': 'Film',
  'menu-search': 'Home',
  'menu-genres': 'Generi',
  'menu-account': 'Utente',
  'menu-user': 'Utente',
  'menu-settings': 'Impostazioni',
  'menu-recomendations': 'Raccomandati',

  'genres-caption': 'Genere',

  'user-caption': 'Utente',
  'user-description': ({ till }) => `Scadenza sottoscrizione ${till}`,

  'user-account-active': 'Attivo',
  'user-turn-on-family-account-button': 'Turn On Family Account',
  'user-turn-on-family-account-title':
    'Are you sure you want to turn on Family Account?',
  'user-turn-on-family-account-action_button': 'Turn On',
  'user-turn-off-family-account-button': 'Turn Off Family Account',
  'user-turn-off-family-account-title':
    'Are you sure you want to turn off Family Account?',
  'user-turn-off-family-account-action_button': 'Turn Off',
  'user-switch-family-account-cancel_button': 'Cancel',

  'user-add-account-button': 'Add new account',
  'user-add-account-form-title': 'Account creation',
  'user-add-account-form-description': 'Enter name for new account.',
  'user-add-account-form-button': 'Add',

  'user-action-menu-title': ({ name }) => `What you want to do with "${name}"?`,
  'user-action-set-as-active-button': 'Set as Active',
  'user-action-rename-button': 'Rename',
  'user-action-delete-button': 'Delete',

  'user-rename-account-form-title': ({ name }) => `Rename account "${name}"`,
  'user-rename-account-form-description': 'Enter new name for the account.',
  'user-rename-account-form-button': 'Update',

  'user-logout-button': 'Esci',
  'user-logout-caption': 'sei sicuro di voler uscire?',
  'user-logout-logout_button': 'Esci',
  'user-logout-cancel_button': 'Annulla',

  'settings-caption': 'Impostazioni',

  'settings-titles-network': 'Rete',
  'settings-titles-about': 'Info',

  'settings-labels-video_quality': 'Qualità Video',
  'settings-labels-translation': 'Lingua',
  'settings-labels-video_playback': 'Video playback',
  'settings-labels-language': 'Lingua Interfaccia',
  'settings-labels-speedtest': 'Speed test',
  'settings-labels-version': 'Versione',

  'settings-descriptions-video_quality': () =>
    `Qualità video preferita se disponibile.\n4K (UHD) video ${
      supportUHD ? ' ' : ' non è '
    }supportata da questa periferica.`,
  'settings-descriptions-translation':
    'To be able to use subtitles special option must be activated in account preferences on soap4.me site. Until this will be done only localized episodes will be shown.',
  'settings-descriptions-video_playback':
    'Configura la modalità del player video. Puoi visualizzare tutti gli episofi di una stagione oppure solo uno.',

  'settings-values-sd': 'SD',
  'settings-values-hd': 'HD',
  'settings-values-fhd': 'Full HD',
  'settings-values-uhd': '4K (UHD)',
  'settings-values-subtitles': 'Priorità sottotitoli',
  'settings-values-localization': 'Priorità localizzazione',
  'settings-values-continues': 'Continua',
  'settings-values-by_episode': 'Per episodio',
  'settings-values-auto': 'Lingua di sistema',
  'settings-values-en': 'English',
  'settings-values-ru': 'Русский',
  'settings-values-it': 'Italiano',

  'speedtest-caption': 'Speed test',
  'speedtest-loading': 'Caricamento dal server...',
  'speedtest-begin': 'Inizio test',
  'speedtest-testing': 'Test velocità di downlod...',
  'speedtest-footnote':
    'Attendi il risultato altrimenti non verranno applicate le modifiche',
  'speedtest-error-title': 'Qualcosa è andato storto =(',
  'speedtest-error-description':
    'Verifica la connessione ad internet e riprova',

  'speedtest-result': ({ speed }) => `${speed} Mb/s`,
  'speedtest-result-too-slow': 'Molto lento. Saltato...',

  'speedtest-country-fr': 'France',
  'speedtest-country-de': 'Germany',
  'speedtest-country-nl': 'Netherlands',
  'speedtest-country-ru': 'Russian Federation',
  'speedtest-country-lt': 'Lithuania',
  'speedtest-country-by': 'Belarus',
  'speedtest-country-ca': 'Canada',
  'speedtest-country-es': 'Spain',
  'speedtest-country-gb': 'United Kingdom',
  'speedtest-country-it': 'Italy',
  'speedtest-country-se': 'Sweden',
  'speedtest-country-sg': 'Singapore',
  'speedtest-country-us': 'United States',
  'speedtest-country-il': 'Israel',
  'speedtest-country-md': 'Moldova',
  'speedtest-country-pl': 'Poland',
  'speedtest-country-at': 'Austria',
  'speedtest-country-bg': 'Bulgaria',
  'speedtest-country-cz': 'Czech Republic',

  'episode-more': 'Altro',
  'episode-mark-as-watched': 'Setta come visto',
  'episode-mark-as-unwatched': 'Setta come non visto',
  'episode-speedtest': 'Speed test',
  'episode-rate': 'Vota episodio',
  'episode-rate-title': ({ timeout }) =>
    `Vota episodio${timeout ? ` oppure aspetta ${timeout} secondi.` : ''}`,

  'season-title-more': 'Altro',
  'season-mark-as-watched': 'Setta stagione come vista',
  'season-mark-as-unwatched': 'Setta stagione come non vista',

  'tvshow-title': ({ title_en, title }) => title_en || title || '',
  'tvshow-title-from-episode': ({ soap_en }) => soap_en || '',
  'tvshow-episode-title': ({ title_en }) => title_en || '',
  'tvshow-episode-airdate': ({ airdate }) => `Andato in onda ${airdate}`,
  'tvshow-episode-menu-hint': 'tieni premuto per aprire il menù episodio',
  'tvshow-season': ({ seasonNumber }) => `Stagione ${seasonNumber}`,
  'tvshow-next': 'Nuovi Episodi',
  'tv-show-updates': 'Aggiornamenti Serie TV',

  'tvshow-status': 'Stato',
  'tvshow-genres': 'Generi',
  'tvshow-actors': 'Attori',
  'tvshow-seasons': 'Stagioni',
  'tvshow-also-watched': 'Correlati',
  'tvshow-ratings': 'Voti e recensioni',
  'tvshow-cast-crew': 'Attori e Cast',
  'tvshow-quality': 'Qualità',

  'tvshow-information': 'Informazioni',
  'tvshow-information-year': 'Anno',
  'tvshow-information-runtime': 'Durata Episodio',
  'tvshow-information-country': 'Paese',
  'tvshow-information-network': 'Distributore',

  'tvshow-languages': 'Linguaggi',
  'tvshow-languages-primary': 'Primario',
  'tvshow-languages-primary-values': 'Italiano, English',

  'tvshow-title-more': 'Altro',
  'tvshow-mark-as-watched': 'Setta Serie TV come vista',
  'tvshow-mark-as-unwatched': 'Setta Serie TV come non vista',

  'tvshow-average-imdb': ({ amount }) =>
    `Average of ${amount} IMDB user ratings.`,
  'tvshow-average-kinopoisk': ({ amount }) =>
    `Average of ${amount} Kinopoisk user ratings.`,
  'tvshow-average-soap': ({ amount }) =>
    `Average of ${amount} soap4.me user ratings.`,

  'tvshow-liked-by': 'Liked by',
  'tvshow-liked-by-people': ({ likes }) => `${likes} people`,
  'tvshow-liked-by-no-one': 'no one',

  'tvshow-status-ended': 'Completata',
  'tvshow-status-closed': 'Annullata',
  'tvshow-status-running': 'In Corso',
  'tvshow-status-pilot': 'Pilota',
  'tvshow-status-planned': 'Pianificata',
  'tvshow-status-production': 'In Produzione',

  'tvshow-control-continue-watching': 'Continua a guardare',
  'tvshow-control-show-trailer': 'Play\nTrailer',
  'tvshow-control-show-trailers': 'Visualizza\nTrailers',
  'tvshow-control-start-watching': 'Guarda',
  'tvshow-control-play': ({quality}) => `Guarda in ${quality}`,
  'tvshow-control-stop-watching': 'Ferma di guardare',
  'tvshow-control-rate': 'Vota Serie Tv',
  'tvshow-control-more': 'Altro',

  'new-episode-soon': 'Prossimi',
  'new-episode-day': 'Nuovi episodi del giorno',
  'new-episode-custom-date': ({ date }) => `Episodio ${date}`,

  'new-season-soon': 'Prossima',
  'new-season-day': 'Stagione del giorno',
  'new-season-custom-date': ({ date }) => `Stagione ${date}`,

  'my-caption': 'Preferiti',

  'my-closed': 'Conclusa',
  'my-watched': 'Vista',
  'my-new-episodes': 'Nuovi Episodi',

  'my-empty-list-title': 'Non possiedi una sottoscrizione',
  'my-empty-list-description':
    'You can start from adding some tv series from "TV Shows" sections',
  'my-empty-list-button': 'Vai a "Serie TV"',

  'my-recomendations': 'Raccomandati',
  'my-empty-recomendations': "You don't have any recomendations yet",

  'all-caption': 'Serie TV',

  'all-group-by': 'Raggruppa per',
  'all-group-by-title': ({ title }) => `Raggruppa per ${title}`,

  'all-group-title-name': 'Nome',
  'all-group-name-title': 'A — Z',

  'all-group-title-date': 'Data',

  'all-group-title-likes': 'Likes',
  'all-group-likes-title-over-thousand': ({ thousand }) => `Over ${thousand}k`,
  'all-group-likes-title-over-hundred': ({ hundred }) => `Over ${hundred}`,
  'all-group-likes-title-lower-hundred': ({ hundred }) => `Lower ${hundred}`,

  'all-group-title-rating': 'Voti',

  'all-group-title-country': 'Paese',

  'all-group-title-completeness': 'Non completati',
  'all-group-completeness-title': 'Completati',

  'all-group-title-uhd': '4K (UHD)',
  'all-group-uhd-title': 'A — Z',

  'search-latest': 'Ultime Serie TV',
  'search-popular': 'Serie TV più popolari',
  'search-persons': 'Persone',
  'search-actor': 'Attori',
  'search-tvshows': 'Serie TV',
  'search-result': 'Risultati Ricerca',

  'actor-tvshows': 'Serie TV',
  'actor-title': 'Attori',

  'authorize-caption': 'Autorizzazione',
  'authorize-description':
    'Hai bisogno di una sottoscrizione per visualizzare i contenuti',
  'authorize-user-description':
    'Per utilizzare il servizio su tv devi autorizzare il tuo account utente.\n\nL\'autorizzazione è necessaria per visualizzare i contenuti su tv.',
  'authorize-tvshow-description':
    'Verifica che il tuo account utente sia autorizzato',
  'authorize-control-trigger': 'Autorizza',

  'login-step1-caption': 'Inserisci la mail',
  'login-step1-placeholder': 'Login',
  'login-step1-button': 'Avanti',

  'login-step2-caption': 'Inserisci la password (minimo 6 caratteri)',
  'login-step2-placeholder': 'Password',
  'login-step2-button': 'Autorizza',

  'login-step3-caption': 'Autorizzo...',

  'login-error-wrong-login': 'Email o password non corretti',
  'login-error-something-went-wrong': 'Qualcosa non ha funzionato =(',

  'translation-localization': 'Lingua Interfaccia',
  'translation-subtitles': 'Sottotitoli',
};
