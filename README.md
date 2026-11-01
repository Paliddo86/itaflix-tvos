# TVML app for itaflix

[![CircleCI](https://circleci.com/gh/a-ignatov-parc/tvos-soap4.me.svg?style=svg)](https://circleci.com/gh/a-ignatov-parc/tvos-soap4.me)

This is proof of concept application written with help of [TVDML](https://github.com/a-ignatov-parc/tvdml) library using javascript and TVML support provided by [TVMLKit](https://developer.apple.com/reference/tvmlkit) in tvOS starting from tvOS 9.0. It uses [soap4.me](https://soap4.me/) api to show information about tv shows.

> Application is written for tvOS 11 and may have some UI issues in previous tvOS releases.

## Building project

In order to run TVML application localy you will have to build source code and serve result with web-server. Luckily this repo already includes all necessary tools.

The only requirement is installed LTS version of node.js and npm.

> You can install proper version of node.js using [nvm](https://github.com/creationix/nvm) with `nvm use` command.

To install everything you need to start and running this application use following command in terminal and wait until it's done.

```
npm run install-deps
```

Next step is to build and serve TVML application. You can do this with following command:

```
npm run serve
```

Now you can build Xcode project and run it in tvOS simulator or on Apple TV.

## Anime section

Dalla versione 5.2.0 l'app include una sezione **Anime** con [AnimeUnity](https://www.animeunity.co) come sorgente.
La sezione presenta le tre categorie native del sito (Ultimi Episodi, Ultime Aggiunte, In Evidenza)
e il dettaglio serie con la lista episodi. La riproduzione risolve l'embed via vixcloud.

La logica e' un port della controparte Kotlin del progetto Itaflix, adattato a TVML:
`src/request/animeunity.js`, `src/extractors/animeunity.js`, `src/routes/anime.js`, `src/routes/animeSeries.js`.
Il piano di implementazione e le verifiche sono in [docs/PLAN_ANIME_TVOS.md](docs/PLAN_ANIME_TVOS.md).

## Application

![App Icon](AppIcon.png)