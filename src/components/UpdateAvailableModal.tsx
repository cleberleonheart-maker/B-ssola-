import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { useThemeColors } from '../theme/ThemeContext';
import { useLanguage } from '../i18n/LanguageContext';
import { spacing, radius } from '../theme/colors';
import { APP_VERSION } from '../version.generated';
import {
  cancelApkDownload,
  downloadApk,
  installApk,
  isApkDownloaderAvailable,
  isDirectApkUrl,
  verifyApk,
} from '../services/apkUpdater';

type Props = {
  visible: boolean;
  versionName: string;
  updateUrl: string;
  message: string | null;
  required: boolean;
  /** SHA-256 esperado; `null` quando nenhuma fonte o sabe. */
  apkSha256: string | null;
  /** As duas fontes discordam: não instalamos, e dizemos porquê. */
  hashConflict: boolean;
  onClose: () => void;
};

type Status =
  | 'idle'
  | 'downloading'
  | 'verifying'
  | 'installing'
  | 'permission'
  | 'error'
  | 'insecure'
  | 'untrusted';

const UpdateAvailableModal = ({
  visible,
  versionName,
  updateUrl,
  message,
  required,
  apkSha256,
  hashConflict,
  onClose,
}: Props) => {
  const colors = useThemeColors();
  const { t } = useLanguage();
  const dismissable = !required;
  const [status, setStatus] = useState<Status>('idle');
  const [percent, setPercent] = useState(0);
  const apkUri = useRef<string | null>(null);
  const running = useRef(false);

  const launchInstall = useCallback(
    (uri: string) => {
      setStatus('installing');
      installApk(uri)
        .then(() => {
          setStatus('idle');
          onClose();
        })
        .catch(error => {
          setStatus(error?.code === 'install_permission' ? 'permission' : 'error');
        })
        .finally(() => {
          running.current = false;
        });
    },
    [onClose],
  );

  const [errorKind, setErrorKind] = useState<'generic' | 'timeout' | 'hash'>('generic');

  const openUpdate = useCallback(() => {
    if (running.current) {
      return;
    }
    if (!isApkDownloaderAvailable()) {
      Linking.openURL(updateUrl).catch(() => {});
      return;
    }
    if (!isDirectApkUrl(updateUrl)) {
      // URL rejeitada: ou não termina em .apk, ou não é HTTPS. Um link em
      // texto claro não vai para o navegador em silêncio — isso exporia o
      // download; o usuário escolhe abrir.
      setStatus('insecure');
      return;
    }
    if (hashConflict) {
      // Duas fontes com versões diferentes do mesmo ficheiro. Instalar seria
      // apostar numa delas sem saber qual — e um APK trocado, assinado com a
      // nossa chave, é exactamente o que o Android não apanha: instala por
      // cima. Recusar é a única resposta honesta.
      setStatus('untrusted');
      return;
    }
    running.current = true;
    setStatus('downloading');
    setErrorKind('generic');
    setPercent(0);
    const fallbackName = `bussola-${versionName.replace(/[^\w.-]+/g, '')}.apk`;
    downloadApk(updateUrl, fallbackName, progress => {
      if (progress.total > 0) {
        setPercent(
          Math.min(100, Math.round((progress.received / progress.total) * 100)),
        );
      }
    })
      .then(result => {
        setPercent(100);
        apkUri.current = result.uri;
        if (!result.uri) {
          setStatus('error');
          running.current = false;
          return;
        }
        if (!apkSha256) {
          // Nenhuma fonte sabe o hash. Instalar sem conferidor continua a ser
          // melhor do que não instalar, e é o que o app fazia até agora — mas
          // assim que a coluna `apk_sha256` existir, o hash passa a vir.
          launchInstall(result.uri);
          return;
        }
        setStatus('verifying');
        verifyApk(result.uri, apkSha256)
          .then(() => launchInstall(result.uri))
          .catch(error => {
            // `hash_mismatch` ou `hash_missing`: o arquivo não é o anunciado.
            // O nativo já o apagou, e um erro genérico aqui seria mentira — não
            // foi uma falha de rede, foi um APK que não devia ser instalado.
            //
            // `apk_verify_unavailable` é outra coisa: o módulo nativo não tem
            // `verify`, o que significa um APK mal construído. Aí dizer "o
            // ficheiro não é o anunciado" seria inventar um diagnóstico.
            if (error?.message === 'apk_verify_unavailable') {
              setErrorKind('generic');
            } else {
              setErrorKind('hash');
            }
            setStatus('error');
            running.current = false;
            apkUri.current = null;
          });
      })
      .catch(error => {
        // `download_cancelled` é o nosso próprio cancelamento ou o timeout:
        // a tela já voltou a "inativo", e marcar "erro" aqui mostraria um
        // aviso que o usuário acabou de provocar de propósito.
        if (error?.message === 'download_cancelled') {
          return;
        }
        if (error?.message === 'download_timeout') {
          setErrorKind('timeout');
        }
        setStatus('error');
        running.current = false;
      });
  }, [updateUrl, versionName, apkSha256, hashConflict, launchInstall]);

  const cancelDownload = useCallback(() => {
    // Só durante o download. Na fase de verificar não há nada para cancelar:
    // `cancelApkDownload` só conhece o download em curso, e chamar o botão
    // aqui punha o ecrã em "inativo" enquanto a verificação acabava e abria a
    // instalação na mesma — cancelar que não cancela.
    if (!running.current || status !== 'downloading') {
      return;
    }
    cancelApkDownload();
    running.current = false;
    setStatus('idle');
    setPercent(0);
  }, [status]);

  /**
   * Sem disparo automático. O modal abre sozinho ao detectar uma versão nova,
   * e o download começava 700 ms depois — antes de qualquer pessoa conseguir
   * ler "tem atualização", num aparelho que pode estar em dados móveis. Baixar
   * dezenas de MB é decisão do usuário, não efeito colateral de abrir o app.
   */
  useEffect(() => {
    if (!visible) {
      return;
    }
    return () => {
      if (running.current) {
        cancelApkDownload();
        running.current = false;
      }
    };
  }, [visible]);

  const progressWidth: `${number}%` = `${percent}%`;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={dismissable ? onClose : () => {}}>
      <View style={styles.backdrop}>
        <View style={[styles.card, { backgroundColor: colors.background }]}>
          <View style={[styles.badge, { backgroundColor: colors.accent }]}>
            <Text style={styles.badgeText}>📲</Text>
          </View>
          <Text style={[styles.title, { color: colors.text }]}>
            {t('upd_title')}
          </Text>
          <Text style={[styles.body, { color: colors.textMuted }]}>
            {t('upd_body', { local: APP_VERSION, remote: versionName })}
          </Text>

          {message ? (
            <Text style={[styles.message, { color: colors.text }]}>
              {message}
            </Text>
          ) : null}

          {status === 'downloading' && (
            <View style={styles.progressBlock}>
              <View
                style={[
                  styles.progressTrack,
                  { backgroundColor: colors.textMuted },
                ]}>
                <View
                  style={[
                    styles.progressFill,
                    { backgroundColor: colors.primary, width: progressWidth },
                  ]}
                />
              </View>
              <Text style={[styles.progressText, { color: colors.textMuted }]}>
                {t('upd_downloading', { percent })}
              </Text>
            </View>
          )}

          {status === 'verifying' ? (
            <View style={styles.progressBlock}>
              <ActivityIndicator color={colors.primary} />
              <Text style={[styles.progressText, { color: colors.textMuted }]}>
                {t('upd_verifying')}
              </Text>
            </View>
          ) : null}

          {status === 'permission' ? (
            <Text style={[styles.statusText, { color: colors.text }]}>
              {t('upd_allow_install')}
            </Text>
          ) : null}

          {status === 'error' ? (
            <Text
              style={[
                styles.statusText,
                { color: colors.danger ?? colors.primary },
              ]}>
              {errorKind === 'timeout'
                ? t('upd_error_timeout')
                : errorKind === 'hash'
                  ? t('upd_error_hash')
                  : t('upd_error')}
            </Text>
          ) : null}

          {status === 'untrusted' ? (
            <Text
              style={[
                styles.statusText,
                { color: colors.danger ?? colors.primary },
              ]}>
              {t('upd_error_hash_conflict')}
            </Text>
          ) : null}

          {status === 'insecure' ? (
            <Text
              style={[
                styles.statusText,
                { color: colors.danger ?? colors.primary },
              ]}>
              {t('upd_error_http')}
            </Text>
          ) : null}

          {status === 'downloading' ? (
            <Pressable onPress={cancelDownload} style={styles.laterButton}>
              <Text style={[styles.laterText, { color: colors.textMuted }]}>
                {t('upd_cancel')}
              </Text>
            </Pressable>
          ) : null}

          {status === 'downloading' || status === 'verifying' ? null : (
            <Pressable
              onPress={() => {
                if (status === 'permission' && apkUri.current) {
                  launchInstall(apkUri.current);
                  return;
                }
                openUpdate();
              }}
              disabled={status === 'installing'}
              style={[
                styles.button,
                { backgroundColor: colors.primary },
                status === 'installing' && styles.buttonDisabled,
              ]}>
              {status === 'installing' ? (
                <ActivityIndicator color={colors.background} />
              ) : (
                <Text style={[styles.buttonText, { color: colors.background }]}>
                  {status === 'error' || status === 'insecure' || status === 'untrusted'
                    ? t('upd_retry')
                    : t('upd_install')}
                </Text>
              )}
            </Pressable>
          )}

          {dismissable && (
            <Pressable onPress={onClose} style={styles.laterButton}>
              <Text style={[styles.laterText, { color: colors.textMuted }]}>
                {t('upd_later')}
              </Text>
            </Pressable>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    borderRadius: radius.lg,
    padding: spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 10,
  },
  badge: {
    alignSelf: 'center',
    width: 56,
    height: 56,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  badgeText: {
    fontSize: 26,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
  },
  body: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: 18,
  },
  message: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: 18,
  },
  button: {
    marginTop: spacing.lg,
    borderRadius: radius.full,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.85,
  },
  progressBlock: {
    marginTop: spacing.md,
    alignItems: 'center',
  },
  progressTrack: {
    width: '100%',
    height: 6,
    borderRadius: radius.full,
    overflow: 'hidden',
    opacity: 0.3,
  },
  progressFill: {
    height: 6,
    borderRadius: radius.full,
  },
  progressText: {
    marginTop: spacing.sm,
    fontSize: 13,
    fontWeight: '600',
  },
  statusText: {
    marginTop: spacing.md,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '800',
  },
  laterButton: {
    marginTop: spacing.md,
    borderRadius: radius.full,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  laterText: {
    fontSize: 13,
    fontWeight: '600',
  },
});

export default UpdateAvailableModal;