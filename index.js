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
import { flushCrashes, installCrashReporter } from './src/services/crashReporter';

// Antes de `AppRegistry.registerComponent`: um erro nasce no primeiro render e
// no arranque, e um handler instalado depois já não apanha nenhum dos dois.
installCrashReporter();

// O que ficou de crashes anteriores. Não é awaited de propósito: isto corre
// antes de a app aparecer, e um `await` aqui seria um ecrã em branco à espera
// de rede. O relatório vai quando pode, que é o que interessa.
flushCrashes();

AppRegistry.registerComponent(appName, () => App);
