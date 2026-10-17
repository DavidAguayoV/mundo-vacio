// Entrada de la demo (demo.html): el mismo juego, con la ruta guiada y su avance aparte.
import '@fontsource/instrument-serif/400.css';
import '@fontsource/instrument-serif/400-italic.css';
import '@fontsource/instrument-sans/400.css';
import '@fontsource/instrument-sans/500.css';
import '@fontsource/instrument-sans/600.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import '../ui/styles.css';
import './demo.css';
import { Game } from '../game';
import { DEMO_NAMESPACE, useNamespace } from '../state/storage';
import { createDemo } from './demo';
import { applyPendingReset } from './reset';

// antes de crear el juego: todo lo que guarde va con el prefijo de la demo
useNamespace(DEMO_NAMESPACE);
applyPendingReset();

const params = new URLSearchParams(location.search);

new Game({
  debug: params.has('debug'),
  mode: createDemo({ kiosk: params.has('kiosco') }),
}).start();
