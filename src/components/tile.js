import { link } from '../utils';

import { get as i18n } from '../localization';
import { Movie, TvShow } from '../helpers/models';

/**
 * 
 * @param {{key: string, attrs: Movie | TvShow | {asCover: boolean}, events: any}} param0 
 * @returns 
 */
export default function Tile({ key, attrs = {}, events = {} }) {
  const tilePoster = attrs.asCover ? attrs.cover : attrs.poster;

  const { onPlay, onSelect, onHighlight, onHoldselect } = events;

  const showTopShadow = attrs.quality;
  const showBottomShadow = attrs.counter || attrs.isWatched || attrs.isUpdated;

  return (
    <lockup
      key={key}
      onPlay={onPlay}
      onSelect={onSelect || link(attrs.type, attrs)}
      onHighlight={onHighlight}
      onHoldselect={onHoldselect}
      autoHighlight={undefined}
    >
      <img
        src={tilePoster}
        width={attrs.asCover ? "400" : "190"}
        height={attrs.asCover ? "225" : "285"}
        class="tile-img"
        contentsMode="aspectFitBB"
        aspectRatio="0.75:1"
        style={`
          tv-placeholder: tv;
          tv-tint-color: linear-gradient(
            top,
            rgba(0, 0, 0, ${showTopShadow ? '0.7' : '0'})
            0.2,
            transparent,
            0.8,
            transparent,
            rgba(0, 0, 0, ${showBottomShadow ? '0.7' : '0'})
          );
          border-radius: 4;
        `}
      />
      <title
        class="tile-title"
        style="tv-text-highlight-style: marquee-on-highlight"
      >
        {attrs.title}
      </title>
      <subtitle class="tile-subtitle" style="font-size: 20">{i18n(`${attrs.type}-type`)}</subtitle>
      <overlay style="margin: 0; padding: 0;">
      {attrs.quality && (
            <textBadge
            style={`
              margin: 12 10 0 0;
              border-radius: 0;
              tv-align: right;
              tv-position: top;
              color: rgb(255, 255, 255);
              background-color: #b90505;
            `}
          >
            {attrs.quality}
          </textBadge>
        )}
      {(attrs.isUpdated || attrs.updateType) && (
            <textBadge
            style={`
              margin: 0 10 12 0;
              border-radius: 0;
              tv-align: center;
              tv-position: bottom;
              color: rgb(255, 255, 255);
              background-color: #b90505;
            `}
          >
            {attrs.updateType? attrs.updateType : i18n('tvshow-next')}
          </textBadge>
        )}
        {!attrs.isWatched && attrs.counter && (
          <textBadge
            type="fill"
            style={`
              font-size: 20;
              border-radius: 30;
              margin: 0 10 12 0;
              padding: 1 8;
              tv-align: right;
              tv-position: bottom;
              tv-tint-color: rgb(255, 255, 255);
            `}
          >
            {attrs.counter}
          </textBadge>
        )}
        {attrs.isWatched && (
          <textBadge
            type="fill"
            style={`
              font-size: 20;
              border-radius: 30;
              margin: 0 10 12 0;
              padding: 1 5;
              tv-align: right;
              tv-position: bottom;
              tv-tint-color: rgb(255, 255, 255);
            `}
          >
            ✓
          </textBadge>
        )}
      </overlay>
    </lockup>
  );
}
