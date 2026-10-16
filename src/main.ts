import '@fontsource/instrument-serif/400.css';
import '@fontsource/instrument-serif/400-italic.css';
import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/500.css';
import '@fontsource/ibm-plex-sans/600.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import './ui/styles.css';
import { Game } from './game';

const params = new URLSearchParams(location.search);
const stress = Number(params.get('stress') ?? 0);

new Game({
  debug: params.has('debug'),
  stress: Number.isFinite(stress) && stress > 0 ? Math.min(500, Math.floor(stress)) : 0,
}).start();
