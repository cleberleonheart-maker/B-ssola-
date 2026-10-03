/**
 * @format
 */

// TEM de ser o primeiro import do ficheiro, antes de tudo o que toque no
// supabase-js.
//
// O Hermes nao regista um `URL` global, e o supabase-js valida o project URL com
// `new URL(...)`. Sem isto o `createClient` atira "Invalid supabaseUrl: Provided
// URL is malformed." — a excepcao era engolida pelo try/catch de `cloud.ts`, o
// `client` ficava `null` e o rastreio ao vivo respondia "nao foi possivel
// iniciar" com o Supabase todo saudavel. Passou despercebido durante varias
// versoes porque o Node (testes e CI) tem `URL`.
import 'react-native-url-polyfill/auto';

import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';

AppRegistry.registerComponent(appName, () => App);
