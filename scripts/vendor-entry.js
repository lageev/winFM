// Material Web 组件打包入口，仅引入项目实际使用的组件
// 重新打包：npm run build:assets
import '@material/web/icon/icon.js';
import '@material/web/iconbutton/icon-button.js';
import '@material/web/button/filled-button.js';
import '@material/web/button/filled-tonal-button.js';
import '@material/web/button/outlined-button.js';
import '@material/web/button/text-button.js';
import '@material/web/checkbox/checkbox.js';
import '@material/web/dialog/dialog.js';
import '@material/web/textfield/outlined-text-field.js';
import '@material/web/progress/linear-progress.js';
import '@material/web/menu/menu.js';
import '@material/web/menu/menu-item.js';
import { styles as typescaleStyles } from '@material/web/typography/md-typescale-styles.js';

if ('adoptedStyleSheets' in Document.prototype) {
  document.adoptedStyleSheets = [...document.adoptedStyleSheets, typescaleStyles.styleSheet];
}
