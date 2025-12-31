/*
 * Импорты, которые используются из HTML
 * Чтобы их не удалил tree-shaking
 * */
import { load } from '../ads/mobiads';
import { initOnPlay } from '../ads/clickunder';
import { renderDelayed, addClass, removeClass } from '../utils';
import { load as loadExternalVideo } from '../widgets/video/external';
